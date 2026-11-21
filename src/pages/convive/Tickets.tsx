import { useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useMesTickets, type Ticket } from '../../lib/donnees'
import { aujourdhui, fcfa, heure, jourLong, messageErreur } from '../../lib/format'
import { Alerte, BandeVatel, Bouton, Chargement } from '../../components/ui'
import { Photo } from '../../components/Plat'

const limiteAnnulation = (jour: string) => new Date(`${jour}T08:00:00Z`) // 8h à Abidjan (UTC+0)

function statutAffiche(t: Ticket) {
  if (t.statut === 'servie') return { texte: 'Servi', style: 'bg-valide-clair text-valide' }
  if (t.statut === 'annulee') return { texte: 'Annulé', style: 'bg-fond text-encre-douce' }
  if (t.jour < aujourdhui()) return { texte: 'Absent', style: 'bg-rare text-rare-texte' }
  return { texte: 'À retirer', style: 'bg-valide-clair text-valide' }
}

function GrandTicket({ t, nouveau }: { t: Ticket; nouveau: boolean }) {
  const qc = useQueryClient()
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
          <p className="text-xs text-encre-douce capitalize">{jourLong(t.jour)} · {t.creneau ? heure(t.creneau.heure_debut) : ''}</p>
          <span className="inline-block mt-1 rounded-full bg-valide-clair text-valide text-xs font-bold px-2">✓ À retirer</span>
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
        <p className="text-xs text-encre-douce">À présenter au comptoir · {fcfa(t.prix_paye)} payé</p>
        <p className="text-[11px] text-encre-douce mt-1">Pas de réseau au comptoir ? Faites une capture d'écran de ce ticket.</p>
        {annuler.isError && <div className="mt-2"><Alerte>{messageErreur(annuler.error)}</Alerte></div>}
        {annulable && (
          <Bouton
            variante="discret"
            className="mt-2"
            disabled={annuler.isPending}
            onClick={() => window.confirm(`Annuler ce repas ? ${fcfa(t.prix_paye)} vous seront remboursés.`) && annuler.mutate()}
          >
            Annuler (remboursé)
          </Bouton>
        )}
      </div>
      <BandeVatel />
    </article>
  )
}

function Etoiles({ t }: { t: Ticket }) {
  const qc = useQueryClient()
  const noter = useMutation({
    mutationFn: async (valeur: number) => {
      const { error } = await supabase.rpc('noter', { p_reservation: t.id, p_valeur: valeur })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })
  const note = t.note?.[0]?.valeur
  if (note) return <span className="text-xs text-encre-douce">Votre note : {'★'.repeat(note)}</span>
  return (
    <span className="flex items-center gap-0.5" aria-label="Noter ce repas">
      <span className="text-xs text-encre-douce mr-1">Noter :</span>
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} disabled={noter.isPending} onClick={() => noter.mutate(v)} className="text-lg leading-none text-action" aria-label={`${v} étoile${v > 1 ? 's' : ''}`}>
          ☆
        </button>
      ))}
    </span>
  )
}

export default function Tickets() {
  const { data: tickets, isLoading } = useMesTickets()
  const nouveau = (useLocation().state as { nouveau?: number } | null)?.nouveau
  const auj = aujourdhui()
  const aVenir = (tickets ?? []).filter((t) => t.statut === 'reservee' && t.jour >= auj).sort((a, b) => a.jour.localeCompare(b.jour))
  const historique = (tickets ?? []).filter((t) => !aVenir.includes(t))

  return (
    <div className="min-h-full">
      <div className="bg-marine px-4 pt-6 pb-6 space-y-4">
        <h1 className="font-titre font-black text-2xl text-white">Mes tickets</h1>
        {isLoading && <Chargement />}
        {!isLoading && aVenir.length === 0 && <p className="text-sm text-white/80">Aucun repas à retirer. Réservez depuis le menu.</p>}
        {aVenir.map((t) => <GrandTicket key={t.id} t={t} nouveau={t.id === nouveau} />)}
      </div>
      {historique.length > 0 && (
        <section className="px-4 py-4">
          <h2 className="font-bold text-marine text-sm mb-2">Historique</h2>
          <ul className="divide-y divide-ligne">
            {historique.map((t) => {
              const s = statutAffiche(t)
              return (
                <li key={t.id} className="py-2.5 flex items-center gap-3">
                  <Photo url={t.menu?.plat?.photo_url ?? null} nom={t.menu?.plat?.nom ?? '?'} className="w-11 h-11 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{t.menu?.plat?.nom}</span>
                      <span className={`rounded-full text-xs px-2 shrink-0 ${s.style}`}>{s.texte}</span>
                    </div>
                    <div className="flex justify-between gap-2 items-center">
                      <span className="text-xs text-encre-douce capitalize">{jourLong(t.jour)}</span>
                      {t.statut === 'servie' && <Etoiles t={t} />}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
