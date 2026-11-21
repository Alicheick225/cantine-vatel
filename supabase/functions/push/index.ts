// Fonction serveur « push » : envoie les notifications push, même quand l'application est fermée.
//   { type: 'test' }                      → l'utilisateur connecté reçoit une notification de test (après 8 s)
//   { type: 'offre', menu_jour_id }       → un admin vient de lancer une offre anti-gaspi : tous les convives sont prévenus
//   { type: 'tour' } + x-cron-secret      → appelé chaque minute par pg_cron : rappels de créneau, solde bas des parents
// Les clés VAPID et le secret de pg_cron sont des secrets Supabase (jamais dans Git).
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const base = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})
webpush.setVapidDetails(Deno.env.get('VAPID_SUJET')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const repondre = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json' } })

interface Message { titre: string; corps: string; url?: string; cle?: string }

/** Envoie un message à tous les appareils des utilisateurs donnés ; retire les abonnements expirés. */
async function envoyer(utilisateurs: string[], m: Message) {
  if (utilisateurs.length === 0) return { envoyes: 0, echecs: 0 }
  const { data: abonnements } = await base.from('abonnements_push').select('id, endpoint, p256dh, auth').in('utilisateur_id', utilisateurs)
  let envoyes = 0, echecs = 0
  await Promise.all((abonnements ?? []).map(async (a) => {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify({ titre: m.titre, corps: m.corps, url: m.url ?? '/', cle: m.cle }),
        { TTL: 3600, urgency: 'high' },
      )
      envoyes++
    } catch (e) {
      echecs++
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await base.from('abonnements_push').delete().eq('id', a.id) // appareil désabonné
    }
  }))
  return { envoyes, echecs }
}

/** Vrai si l'utilisateur a au moins un appareil abonné (sinon on ne marque rien comme envoyé). */
async function aUnAppareil(utilisateur: string) {
  const { count } = await base.from('abonnements_push').select('id', { count: 'exact', head: true }).eq('utilisateur_id', utilisateur)
  return (count ?? 0) > 0
}

/** Anti-doublon : vrai seulement la première fois qu'une clé est vue. */
async function premiereFois(cle: string) {
  const { error } = await base.from('notifications_envoyees').insert({ cle })
  return !error
}

async function utilisateurDuJeton(req: Request) {
  const jeton = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jeton) return null
  const { data } = await base.auth.getUser(jeton)
  if (!data.user) return null
  const { data: profil } = await base.from('profils').select('id, role, nom').eq('id', data.user.id).single()
  return profil as { id: string; role: string; nom: string } | null
}

const heureAbidjan = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' })
const fcfa = (n: number) => `${n.toLocaleString('fr-FR').replace(/ /g, ' ')} F`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const { type, menu_jour_id } = await req.json().catch(() => ({}))

  // ----- Notification de test : fermez l'application, elle arrive quelques secondes plus tard.
  if (type === 'test') {
    const moi = await utilisateurDuJeton(req)
    if (!moi) return repondre({ erreur: 'Connexion requise.' }, 401)
    await new Promise((r) => setTimeout(r, 8000))
    const r = await envoyer([moi.id], { titre: 'Cantine Vatel', corps: `Bonjour ${moi.nom.split(' ')[0]}, les notifications sont bien activées sur cet appareil.`, url: '/profil', cle: 'test' })
    return repondre(r)
  }

  // ----- Offre anti-gaspi lancée par un admin : tous les convives abonnés sont prévenus.
  if (type === 'offre') {
    const moi = await utilisateurDuJeton(req)
    if (moi?.role !== 'admin') return repondre({ erreur: 'Réservé aux administrateurs.' }, 403)
    const { data: m } = await base.from('menus_jour').select('id, prix_offre, fin_offre, plat:plats(nom)').eq('id', menu_jour_id).single()
    const plat = (m?.plat as { nom?: string } | null)?.nom
    if (!m?.prix_offre || !m.fin_offre) return repondre({ erreur: 'Aucune offre en cours sur ce plat.' }, 400)
    if (!(await premiereFois(`offre:${m.id}:${m.prix_offre}`))) return repondre({ envoyes: 0, deja: true })
    const { data: convives } = await base.from('profils').select('id').eq('role', 'convive')
    const r = await envoyer((convives ?? []).map((c) => c.id), {
      titre: 'Offre anti-gaspi',
      corps: `${plat ?? 'Un plat'} à ${fcfa(m.prix_offre)} jusqu'à ${heureAbidjan(m.fin_offre)}. Réservez avant qu'il ne parte !`,
      url: `/plat/${m.id}`,
      cle: `offre-${m.id}`,
    })
    return repondre(r)
  }

  // ----- Tour de la minute (pg_cron) : rappels de créneau et solde bas des parents.
  if (type === 'tour') {
    if (req.headers.get('x-cron-secret') !== Deno.env.get('PUSH_CRON_SECRET')) return repondre({ erreur: 'Non autorisé.' }, 401)
    const maintenant = Date.now()
    const jour = new Date(maintenant).toISOString().slice(0, 10) // Abidjan = UTC+0
    let rappels = 0, soldes = 0

    // Rappel 10 minutes avant le créneau du ticket du jour.
    const { data: tickets } = await base.from('reservations')
      .select('id, utilisateur_id, code_court, creneau:creneaux(heure_debut), menu:menus_jour(plat:plats(nom))')
      .eq('jour', jour).eq('statut', 'reservee')
    for (const t of tickets ?? []) {
      const debut = (t.creneau as { heure_debut?: string } | null)?.heure_debut
      if (!debut) continue
      const minutes = (new Date(`${jour}T${debut}Z`).getTime() - maintenant) / 60000
      if (minutes <= 0 || minutes > 10) continue
      if (!(await aUnAppareil(t.utilisateur_id)) || !(await premiereFois(`rappel:${t.id}`))) continue
      const plat = ((t.menu as { plat?: { nom?: string } } | null)?.plat?.nom) ?? 'Votre plat'
      await envoyer([t.utilisateur_id], {
        titre: 'Votre repas vous attend',
        corps: `${plat} : votre créneau de ${debut.slice(0, 5).replace(':', 'h')} commence dans ${Math.ceil(minutes)} min. Ticket ${t.code_court}.`,
        url: '/tickets',
        cle: `rappel-${t.id}`,
      })
      rappels++
    }

    // Solde bas d'un enfant : son parent est prévenu une fois par jour.
    const { data: liens } = await base.from('liens_parent').select('parent_id, enfant:profils!liens_parent_enfant_id_fkey(id, nom, solde)').eq('valide', true)
    for (const l of liens ?? []) {
      const e = l.enfant as { id: string; nom: string; solde: number } | null
      if (!e || e.solde >= 2000) continue
      if (!(await aUnAppareil(l.parent_id)) || !(await premiereFois(`solde:${l.parent_id}:${e.id}:${jour}`))) continue
      await envoyer([l.parent_id], {
        titre: 'Solde bas',
        corps: `Il ne reste que ${fcfa(e.solde)} sur le compte cantine de ${e.nom.split(' ')[0]}. Rechargez en un geste.`,
        url: '/parent',
        cle: `solde-${e.id}`,
      })
      soldes++
    }
    return repondre({ rappels, soldes })
  }

  return repondre({ erreur: 'Type inconnu.' }, 400)
})
