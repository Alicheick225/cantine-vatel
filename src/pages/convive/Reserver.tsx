import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { useCreneaux, useMenu, useMesTickets } from '../../lib/donnees'
import { ajouterJours, aujourdhui, fcfa, heure, jourLong, messageErreur } from '../../lib/format'
import { Alerte, Bouton, Chargement } from '../../components/ui'
import { Pastilles, Photo, Prix, allergenesARisque } from '../../components/Plat'
import { LIBELLE_ALLERGENE } from '../../lib/types'
import { IconArrowLeft } from '@tabler/icons-react'

export default function Reserver() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { profil } = useAuth()
  const debut = aujourdhui()
  const { data: menu, isLoading } = useMenu(debut, ajouterJours(debut, 13))
  const plat = menu?.find((p) => String(p.menu_jour_id) === id)
  const { data: creneaux } = useCreneaux(plat?.jour)
  const { data: tickets } = useMesTickets()
  const [creneau, setCreneau] = useState<number | null>(null)

  const reserver = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('reserver', { p_menu_jour: plat!.menu_jour_id, p_creneau: creneau })
      if (error) throw error
      return data as { reservation_id: number }
    },
    onSuccess: (r) => {
      qc.invalidateQueries()
      navigate('/tickets', { state: { nouveau: r.reservation_id } })
    },
  })

  if (isLoading) return <Chargement />
  if (!plat) return <div className="p-6"><Alerte>Plat introuvable.</Alerte><Link to="/" className="underline text-marine">Retour au menu</Link></div>

  const prix = plat.offre_active && plat.prix_offre ? plat.prix_offre : plat.prix
  const solde = profil?.solde ?? 0
  // Les offres anti-gaspillage ne comptent pas dans la limite d'un repas par jour.
  const dejaReserve = tickets?.find((t) => t.jour === plat.jour && t.statut !== 'annulee' && !t.est_offre)
  const risque = allergenesARisque(plat, profil?.allergies ?? [])
  const choisi = creneaux?.find((c) => c.creneau_id === creneau)
  const bloque =
    plat.type === 'boisson' ? 'Les boissons sont en vente au comptoir.'
    : dejaReserve && !plat.offre_active ? `Vous avez déjà réservé ce jour-là (${dejaReserve.menu?.plat?.nom}).`
    : !plat.reservable && !plat.offre_active ? 'Les réservations pour ce jour sont closes (limite : 8h le jour même).'
    : plat.restantes === 0 ? 'Plus de portion disponible pour ce plat.'
    : creneaux && creneaux.every((c) => c.passe || c.restantes === 0) ? 'Plus aucun créneau disponible ce jour-là.'
    : solde < prix ? `Solde insuffisant : ${fcfa(solde)} disponibles, ${fcfa(prix)} nécessaires.`
    : null

  return (
    <div>
      <div className="relative h-64">
        <Photo url={plat.photo_url} nom={plat.nom} className="absolute inset-0 w-full h-full" />
        <button onClick={() => navigate(-1)} aria-label="Retour" className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white text-marine shadow flex items-center justify-center"><IconArrowLeft size={20} /></button>
      </div>
      <div className="-mt-6 relative bg-white rounded-t-3xl px-5 pt-5 pb-6 space-y-4">
        <div>
          <div className="flex justify-between items-start gap-3">
            <h1 className="font-titre font-black text-xl text-marine">{plat.nom}</h1>
            <span className="text-lg"><Prix plat={plat} /></span>
          </div>
          <p className="text-sm text-encre-douce first-letter:uppercase">{jourLong(plat.jour)}</p>
          {plat.description && <p className="text-sm mt-1">{plat.description}</p>}
          <Pastilles plat={plat} allergies={profil?.allergies ?? []} />
        </div>

        {risque.length > 0 && (
          <Alerte>
            Attention : ce plat contient {risque.map((a) => LIBELLE_ALLERGENE[a].toLowerCase()).join(', ')}, signalé dans vos allergies.
          </Alerte>
        )}

        {!bloque && (
          <section>
            <h2 className="font-bold text-marine text-sm mb-2">Votre créneau de retrait</h2>
            <div className="grid grid-cols-4 gap-2">
              {creneaux?.map((c) => {
                const complet = c.restantes === 0
                const indisponible = complet || c.passe
                const actif = c.creneau_id === creneau
                return (
                  <button
                    key={c.creneau_id}
                    disabled={indisponible}
                    onClick={() => setCreneau(c.creneau_id)}
                    aria-pressed={actif}
                    aria-label={`${heure(c.heure_debut)}, ${c.passe ? 'passé' : complet ? 'complet' : `${c.restantes} places`}`}
                    className={`rounded-xl py-1.5 text-center border ${
                      actif ? 'bg-marine text-white border-marine ring-2 ring-ciel'
                      : indisponible ? 'bg-fond text-encre-douce/60 border-transparent line-through'
                      : 'bg-white border-ligne'
                    }`}
                  >
                    <span className="block font-mono text-sm">{heure(c.heure_debut)}</span>
                    <span className="block text-[11px] no-underline">{c.passe ? 'passé' : complet ? 'complet' : `${c.restantes} pl.`}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <div className="rounded-xl bg-ciel-clair px-3 py-2.5 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-encre-douce">Solde actuel</span><span className="font-mono">{fcfa(solde)}</span></div>
          {!bloque && <div className="flex justify-between"><span className="text-encre-douce">Solde après</span><span className="font-mono">{fcfa(solde - prix)}</span></div>}
          <div className="flex justify-between">
            <span className="text-encre-douce">Annulable</span>
            <span>{plat.offre_active ? 'non (offre)' : `jusqu'à 8h le ${jourLong(plat.jour)}`}</span>
          </div>
        </div>

        {bloque && <Alerte type="info">{bloque} {solde < prix && <Link to="/solde" className="underline font-semibold">Recharger</Link>}</Alerte>}
        {reserver.isError && <Alerte>{messageErreur(reserver.error)}</Alerte>}

        {!bloque && (
          <Bouton className="w-full text-base" disabled={!creneau || reserver.isPending} onClick={() => reserver.mutate()}>
            {reserver.isPending ? 'Réservation…' : choisi ? `Réserver pour ${heure(choisi.heure_debut).replace(':', 'h')}` : 'Choisissez un créneau'}
          </Bouton>
        )}
      </div>
    </div>
  )
}
