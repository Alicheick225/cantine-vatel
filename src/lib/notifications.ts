import { useEffect } from 'react'
import { supabase } from './supabase'
import type { Ticket } from './donnees'
import { aujourdhui, fcfa } from './format'

/**
 * Notifications (bonus « notifications push en temps réel »).
 *  1. Push, même application fermée : l'appareil s'abonne au service push du navigateur (clé VAPID publique),
 *     l'abonnement est enregistré dans la base, et la fonction serveur « push » envoie :
 *     offre anti-gaspi lancée, rappel 10 minutes avant le créneau, solde bas de l'enfant (parent), test.
 *  2. Sans push (navigateur trop ancien) : notifications locales tant que l'application est ouverte.
 */
// Clé publique VAPID : publique par nature, la clé privée reste un secret côté Supabase.
const CLE_VAPID = 'BA9KxfMMCCgI17F7pQUJj3lZ1H0TT-xU7mTvSkMwmuqDSx05KehR3aMwKxIQoayORJ0naAiddB8YzCmVDcgJXYE'

export const notificationsDisponibles = () => typeof window !== 'undefined' && 'Notification' in window

export const pushDisponible = () =>
  notificationsDisponibles() && 'serviceWorker' in navigator && 'PushManager' in window

export const notificationsActives = () => notificationsDisponibles() && Notification.permission === 'granted'

const versOctets = (b64: string) => {
  const brut = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(brut, (c) => c.charCodeAt(0))
}

async function enregistrement() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
}

/** Abonnement push de cet appareil (null s'il n'est pas abonné). */
export async function abonnementActuel() {
  if (!pushDisponible()) return null
  const r = await navigator.serviceWorker.getRegistration()
  return (await r?.pushManager.getSubscription()) ?? null
}

/** Demande l'autorisation, abonne l'appareil au push et l'enregistre dans la base. */
export async function activerNotifications() {
  if (!notificationsDisponibles()) return false
  if ((await Notification.requestPermission()) !== 'granted') return false
  if (!pushDisponible()) return true // repli : notifications locales, application ouverte
  const r = await enregistrement()
  await navigator.serviceWorker.ready
  const abo = (await r.pushManager.getSubscription())
    ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(CLE_VAPID) }))
  const json = abo.toJSON()
  const { error } = await supabase.rpc('enregistrer_abonnement', {
    p_endpoint: abo.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth, p_appareil: navigator.userAgent,
  })
  if (error) throw error
  try { localStorage.setItem('push-actif', '1') } catch { /* stockage indisponible */ }
  return true
}

/** Désabonne cet appareil (dans le navigateur et dans la base). */
export async function desactiverNotifications() {
  const abo = await abonnementActuel()
  if (abo) {
    await supabase.rpc('supprimer_abonnement', { p_endpoint: abo.endpoint })
    await abo.unsubscribe()
  }
  try { localStorage.removeItem('push-actif') } catch { /* stockage indisponible */ }
}

/** Demande au serveur une notification de test, envoyée 8 secondes plus tard (le temps de fermer l'application). */
export async function envoyerNotificationTest() {
  const { data, error } = await supabase.functions.invoke('push', { body: { type: 'test' } })
  if (error) throw error
  return data as { envoyes: number; echecs: number }
}

/** Prévenir les convives d'une offre anti-gaspi (appelé par l'admin après lancer_offre). */
export async function annoncerOffre(menuJourId: number) {
  await supabase.functions.invoke('push', { body: { type: 'offre', menu_jour_id: menuJourId } })
}

// Si l'appareil reçoit le push, les notifications locales feraient doublon.
const pushActif = () => { try { return localStorage.getItem('push-actif') === '1' } catch { return false } }

function notifier(titre: string, corps: string, cle: string) {
  if (!notificationsActives() || pushActif()) return
  try {
    new Notification(titre, { body: corps, icon: '/icone-192.png', tag: cle })
  } catch {
    // Certains navigateurs mobiles n'autorisent les notifications que via un service worker.
    navigator.serviceWorker?.ready.then((r) => r.showNotification(titre, { body: corps, icon: '/icone-192.png', tag: cle }))
  }
}

export function useNotifications(tickets: Ticket[] | undefined) {
  // Offres de fin de service : prévenir dès que la cuisine en lance une.
  useEffect(() => {
    const canal = supabase
      .channel('notifications-offres')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'menus_jour' }, async (p) => {
        const m = p.new as { id: number; jour: string; plat_id: number; prix_offre: number | null; fin_offre: string | null }
        const ancien = p.old as { prix_offre?: number | null }
        if (!m.prix_offre || !m.fin_offre || m.jour !== aujourdhui() || ancien.prix_offre === m.prix_offre) return
        if (new Date(m.fin_offre).getTime() <= Date.now()) return
        const { data } = await supabase.from('plats').select('nom').eq('id', m.plat_id).single()
        notifier('Offre de fin de service', `${data?.nom ?? 'Un plat'} à ${fcfa(m.prix_offre)} jusqu'à ${new Date(m.fin_offre!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' })}. Réservez avant qu'il ne parte !`, `offre-${m.id}`)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  // Rappel 10 minutes avant le créneau du ticket du jour.
  useEffect(() => {
    const t = tickets?.find((x) => x.jour === aujourdhui() && x.statut === 'reservee' && x.creneau)
    if (!t?.creneau) return
    const debut = new Date(`${t.jour}T${t.creneau.heure_debut}Z`).getTime() // Abidjan = UTC+0
    const delai = debut - 10 * 60_000 - Date.now()
    if (delai < 0 || delai > 12 * 3600_000) return
    const id = setTimeout(
      () => notifier('Votre repas vous attend', `${t.menu?.plat?.nom ?? 'Votre plat'} : votre créneau commence dans 10 minutes. Ticket ${t.code_court}.`, `rappel-${t.id}`),
      delai,
    )
    return () => clearTimeout(id)
  }, [tickets])
}
