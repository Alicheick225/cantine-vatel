import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useMesTickets, type Ticket } from '../../lib/donnees'
import { aujourdhui, dateHeure, fcfa, heure, jourLong, messageErreur } from '../../lib/format'
import { Alerte, BandeVatel, Bouton, Chargement } from '../../components/ui'
import { Photo } from '../../components/Plat'
import { IconChevronDown, IconCircleCheck } from '@tabler/icons-react'
import { LIBELLE_ALLERGENE, type Allergene } from '../../lib/types'
import { useLangue } from '../../lib/i18n'

const limiteAnnulation = (jour: string) => new Date(`${jour}T08:00:00Z`) // 8h à Abidjan (UTC+0)

function statutAffiche(t: Ticket) {
  if (t.statut === 'servie') return { texte: 'Servi', style: 'bg-valide-clair text-valide' }
  if (t.statut === 'annulee') return { texte: 'Annulé', style: 'bg-fond text-encre-douce' }
  if (t.jour < aujourdhui()) return { texte: 'Absent', style: 'bg-rare text-rare-texte' }
  return { texte: 'À retirer', style: 'bg-valide-clair text-valide' }
}

function GrandTicket({ t, nouveau }: { t: Ticket; nouveau: boolean }) {
  const qc = useQueryClient()
  const { t: tr } = useLangue()
  const annuler = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('annuler', { p_reservation: t.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })
  const annulable = !t.est_offre && new Date() < limiteAnnulation(t.jour)

  return (
    <article className={`rounded-3xl overflow-hidden bg-white shadow-lg ${nouveau ? 'ring-4 ring-ciel' : ''}`}>
      <div className="flex gap-3 p-4 items-center">
        <Photo url={t.menu?.plat?.photo_url ?? null} nom={t.menu?.plat?.nom ?? '?'} className="w-16 h-16 rounded-full shrink-0" />
        <div className="min-w-0">
          <p className="font-bold text-marine">{t.menu?.plat?.nom}</p>
          <p className="text-xs text-encre-douce first-letter:uppercase">{jourLong(t.jour)} · {t.creneau ? heure(t.creneau.heure_debut) : ''}</p>
          <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-valide-clair text-valide text-xs font-bold px-2"><IconCircleCheck size={13} aria-hidden /> {tr('À retirer')}</span>
        </div>
      </div>
      <div className="relative h-4" aria-hidden>
        <div className="absolute inset-x-4 top-2 border-t-2 border-dashed border-ligne" />
        <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-marine" />
        <div className="absolute -right-2.5 top-0 w-5 h-5 rounded-full bg-marine" />
      </div>
      <div className="px-4 pb-4 pt-2 text-center">
        <QRCodeSVG value={t.jeton_qr} size={168} fgColor="#072A5D" className="mx-auto" aria-label={`QR code du ticket ${t.code_court}`} />
        <p className="font-mono text-2xl tracking-widest text-marine mt-2">{t.code_court}</p>
        <p className="text-xs text-encre-douce">{tr('À présenter au comptoir · {prix} payé', { prix: fcfa(t.prix_paye) })}</p>
        <p className="text-[11px] text-encre-douce mt-1">{tr("Pas de réseau au comptoir ? Faites une capture d'écran de ce ticket.")}</p>
        {annuler.isError && <div className="mt-2"><Alerte>{tr(messageErreur(annuler.error))}</Alerte></div>}
        {annulable && (
          <Bouton
            variante="discret"
            className="mt-2"
            disabled={annuler.isPending}
            onClick={() => window.confirm(tr('Annuler ce repas ? {prix} vous seront remboursés.', { prix: fcfa(t.prix_paye) })) && annuler.mutate()}
          >
            {tr('Annuler (remboursé)')}
          </Bouton>
        )}
      </div>
      <BandeVatel />
    </article>
  )
}

const noteDe = (t: Ticket) => (Array.isArray(t.note) ? t.note[0] : t.note) ?? null

/** Étoiles en lecture seule. */
function EtoilesFixes({ valeur }: { valeur: number }) {
  const { t: tr } = useLangue()
  return <span className="text-xs text-action" aria-label={tr('Votre note : {n} sur 5', { n: valeur })}>{'★'.repeat(valeur)}{'☆'.repeat(5 - valeur)}</span>
}

/** Noter un repas servi : de 1 à 5 étoiles, et un commentaire facultatif (280 caractères). Une seule fois. */
function Noter({ t }: { t: Ticket }) {
  const qc = useQueryClient()
  const { t: tr } = useLangue()
  const [valeur, setValeur] = useState(0)
  const [commentaire, setCommentaire] = useState('')
  const noter = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('noter', { p_reservation: t.id, p_valeur: valeur, p_commentaire: commentaire.trim() || null })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })
  const libelles = ['', 'Décevant', 'Moyen', 'Bon', 'Très bon', 'Excellent']
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-marine">{tr('Notez ce repas')}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} type="button" onClick={() => setValeur(v)} aria-pressed={valeur >= v}
            className="text-3xl leading-none text-action" aria-label={tr('{n} sur 5', { n: v })}>
            {valeur >= v ? '★' : '☆'}
          </button>
        ))}
        {valeur > 0 && <span className="ml-2 text-sm text-encre-douce">{tr(libelles[valeur])}</span>}
      </div>
      {valeur > 0 && (
        <>
          <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value.slice(0, 280))} rows={2}
            placeholder={tr('Un mot pour la cuisine (facultatif)')}
            className="w-full rounded-xl border border-ligne px-3 py-2 text-sm" aria-label={tr('Commentaire')} />
          <div className="flex justify-between items-center">
            <span className="text-xs text-encre-douce">{commentaire.length}/280</span>
            <Bouton className="!py-1.5 !px-4 text-sm" disabled={noter.isPending} onClick={() => noter.mutate()}>{tr('Envoyer ma note')}</Bouton>
          </div>
        </>
      )}
      {noter.isError && <Alerte>{tr(messageErreur(noter.error))}</Alerte>}
    </div>
  )
}

/** Détail d'un repas de l'historique : déroulé au toucher. */
function DetailRepas({ t }: { t: Ticket }) {
  const { t: tr } = useLangue()
  const plat = t.menu?.plat
  const note = noteDe(t)
  const ligne = (libelle: string, valeur: React.ReactNode) => (
    <div className="flex justify-between gap-3"><dt className="text-encre-douce">{tr(libelle)}</dt><dd className="text-right">{valeur}</dd></div>
  )
  return (
    <div className="mt-2 rounded-xl bg-fond p-3 space-y-3 text-sm">
      {plat?.description && <p>{plat.description}</p>}
      <dl className="space-y-1">
        {ligne('Code du ticket', <span className="font-mono">{t.code_court}</span>)}
        {t.creneau && ligne('Créneau', heure(t.creneau.heure_debut))}
        {ligne('Prix payé', <span className="font-mono">{fcfa(t.prix_paye)}{t.est_offre ? ` · ${tr('offre anti-gaspi')}` : ''}</span>)}
        {t.cree_le && ligne('Réservé le', dateHeure(t.cree_le))}
        {t.scanne_le && ligne('Validé au comptoir', dateHeure(t.scanne_le))}
        {t.remis_le && t.remis_le !== t.scanne_le && ligne('Plat remis', dateHeure(t.remis_le))}
        {t.annule_le && ligne('Annulé le', <>{dateHeure(t.annule_le)}{!t.est_offre && <span className="block text-xs text-valide">{tr('remboursé sur votre solde')}</span>}</>)}
        {t.statut === 'reservee' && t.jour < aujourdhui() && ligne('Statut', <span className="text-rare-texte">{tr('non retiré, non remboursé')}</span>)}
        {(plat?.allergenes?.length ?? 0) > 0 && ligne('Allergènes', (plat!.allergenes as Allergene[]).map((a) => tr(LIBELLE_ALLERGENE[a].toLowerCase())).join(', '))}
      </dl>
      {t.statut === 'servie' && (note ? (
        <div className="border-t border-ligne pt-2">
          <p className="text-sm font-semibold text-marine">{tr('Votre note')}</p>
          <EtoilesFixes valeur={note.valeur} />
          {note.commentaire && <p className="text-sm italic mt-1">« {note.commentaire} »</p>}
        </div>
      ) : <div className="border-t border-ligne pt-2"><Noter t={t} /></div>)}
      {plat?.id && <Link to={`/avis/${plat.id}`} className="inline-block text-sm text-marine underline">{tr('Voir les avis sur ce plat')}</Link>}
    </div>
  )
}

function LigneHistorique({ t }: { t: Ticket }) {
  const { t: tr } = useLangue()
  const [ouvert, setOuvert] = useState(false)
  const s = statutAffiche(t)
  const note = noteDe(t)
  return (
    <li className="py-2.5">
      <button onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} className="w-full flex items-center gap-3 text-left">
        <Photo url={t.menu?.plat?.photo_url ?? null} nom={t.menu?.plat?.nom ?? '?'} className="w-11 h-11 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between gap-2">
            <span className="text-sm font-semibold truncate">{t.menu?.plat?.nom}</span>
            <span className={`rounded-full text-xs px-2 shrink-0 ${s.style}`}>{tr(s.texte)}</span>
          </div>
          <div className="flex justify-between gap-2 items-center">
            <span className="text-xs text-encre-douce first-letter:uppercase">{jourLong(t.jour)}</span>
            {t.statut === 'servie' && (note ? <EtoilesFixes valeur={note.valeur} /> : <span className="text-xs font-semibold text-action">{tr('À noter')}</span>)}
          </div>
        </div>
        <IconChevronDown size={18} className={`shrink-0 text-encre-douce transition-transform ${ouvert ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {ouvert && <DetailRepas t={t} />}
    </li>
  )
}

export default function Tickets() {
  const { data: tickets, isLoading } = useMesTickets()
  const nouveau = (useLocation().state as { nouveau?: number } | null)?.nouveau
  const { t: tr } = useLangue()
  const auj = aujourdhui()
  const aVenir = (tickets ?? []).filter((t) => t.statut === 'reservee' && t.jour >= auj).sort((a, b) => a.jour.localeCompare(b.jour))
  const historique = (tickets ?? []).filter((t) => !aVenir.includes(t))

  return (
    <div className="min-h-full">
      <div className="bg-marine px-4 pt-6 pb-6 space-y-4">
        <h1 className="font-titre font-black text-2xl text-white">{tr('Mes tickets')}</h1>
        {!navigator.onLine && <p className="rounded-xl bg-white/15 text-white text-sm px-3 py-2">{tr('Hors ligne : voici vos derniers tickets enregistrés.')}</p>}
        {isLoading && <Chargement />}
        {!isLoading && aVenir.length === 0 && <p className="text-sm text-white/80">{tr('Aucun repas à retirer. Réservez depuis le menu.')}</p>}
        {aVenir.map((t) => <GrandTicket key={t.id} t={t} nouveau={t.id === nouveau} />)}
      </div>
      {historique.length > 0 && (
        <section className="px-4 py-4">
          <h2 className="font-bold text-marine text-sm mb-2">{tr('Historique')}</h2>
          <ul className="divide-y divide-ligne">
            {historique.map((t) => <LigneHistorique key={t.id} t={t} />)}
          </ul>
        </section>
      )}
    </div>
  )
}
