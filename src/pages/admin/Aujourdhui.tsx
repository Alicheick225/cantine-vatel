import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { IconAlertTriangle } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { useTableauBord, type LignePlat } from '../../lib/donnees'
import { useTempsReel } from '../../lib/temps-reel'
import { ajouterJours, aujourdhui, fcfa, heure, jourLong, messageErreur } from '../../lib/format'
import { Alerte, Bouton, Carte, Chargement } from '../../components/ui'
import { Photo } from '../../components/Plat'

const restantes = (p: LignePlat) => (p.portions_preparees ?? p.portions_prevues) - p.reservees
const prixOffre = (prix: number) => Math.max(50, Math.round(prix / 2 / 50) * 50)

function Kpi({ titre, valeur, detail }: { titre: string; valeur: string; detail?: string }) {
  return (
    <Carte className="!p-3">
      <p className="text-xs text-encre-douce">{titre}</p>
      <p className="font-mono text-2xl text-marine mt-1">{valeur}</p>
      {detail && <p className="text-xs text-encre-douce mt-0.5">{detail}</p>}
    </Carte>
  )
}

export default function Aujourdhui() {
  const [jour, setJour] = useState(aujourdhui())
  const { data: tb, isLoading, error } = useTableauBord(jour)
  const qc = useQueryClient()
  useTempsReel('admin-aujourdhui')
  const estAujourdhui = jour === aujourdhui()

  const offre = useMutation({
    mutationFn: async (p: LignePlat) => {
      const fin = new Date(Date.now() + 45 * 60_000).toISOString()
      const { error } = await supabase.rpc('lancer_offre', { p_menu_jour: p.menu_jour_id, p_prix: prixOffre(p.prix), p_fin: fin })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })

  const plats = (tb?.plats ?? []).filter((p) => p.type !== 'boisson')
  // Une offre n'a de sens que pendant le service : il doit rester au moins un créneau à venir (15 min chacun).
  const serviceEnCours = estAujourdhui && (tb?.creneaux ?? []).some(
    (c) => Date.now() < new Date(`${jour}T${c.heure_debut}Z`).getTime() + 15 * 60_000,
  )
  const suggestion = serviceEnCours
    ? [...plats].filter((p) => !p.offre_active && restantes(p) >= 8).sort((a, b) => restantes(b) - restantes(a))[0]
    : undefined
  const maxCreneau = Math.max(1, ...(tb?.creneaux ?? []).map((c) => c.reservees))

  // Éviter les ruptures : plats des 7 prochains jours dont la demande prévue dépasse les portions prévues,
  // et plats du jour presque épuisés.
  const { data: ruptures } = useQuery({
    queryKey: ['ruptures'],
    queryFn: async () => {
      const auj = aujourdhui()
      const { data, error } = await supabase.rpc('prevision', { p_debut: ajouterJours(auj, 1), p_fin: ajouterJours(auj, 7) })
      if (error) throw error
      return (data as { jour: string; menu_jour_id: number; plat: string; attendus: number; portions_prevues: number }[])
        .filter((l) => l.attendus > l.portions_prevues)
        .sort((a, b) => a.jour.localeCompare(b.jour))
    },
  })
  const presqueEpuises = estAujourdhui ? plats.filter((p) => restantes(p) > 0 && restantes(p) <= 5) : []

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-titre font-black text-2xl text-marine first-letter:uppercase">{jourLong(jour)}</h1>
          <p className="text-xs text-encre-douce">
            {estAujourdhui ? 'Mis à jour en direct' : 'Consultation'} <span className="inline-block w-2 h-2 rounded-full bg-valide ml-1" aria-hidden />
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Bouton variante="contour" className="!py-2" onClick={() => setJour(ajouterJours(jour, -1))} aria-label="Jour précédent">←</Bouton>
          <input type="date" value={jour} onChange={(e) => e.target.value && setJour(e.target.value)} className="rounded-xl border border-ligne px-2 py-2 text-sm bg-white" aria-label="Choisir le jour" />
          <Bouton variante="contour" className="!py-2" onClick={() => setJour(ajouterJours(jour, 1))} aria-label="Jour suivant">→</Bouton>
          {!estAujourdhui && <Bouton variante="discret" className="!py-2" onClick={() => setJour(aujourdhui())}>Aujourd'hui</Bouton>}
        </div>
      </div>

      {isLoading && <Chargement />}
      {error && <Alerte>{messageErreur(error)}</Alerte>}

      {tb && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi titre="Repas réservés" valeur={String(tb.reservees)} />
            <Kpi titre="Déjà servis" valeur={String(tb.servies)} detail={tb.reservees ? `${Math.round((tb.servies / tb.reservees) * 100)} % des réservés` : undefined} />
            <Kpi titre="Présence (7 jours)" valeur={tb.taux_presence_7j != null ? `${tb.taux_presence_7j} %` : '—'} detail="servis / réservés" />
            <Kpi titre="Portions sauvées" valeur={String(tb.portions_sauvees)} detail="offres fin de service" />
            <Kpi titre="Recettes du jour" valeur={fcfa(tb.recettes)} detail="paiements d'avance" />
          </div>

          {offre.isError && <Alerte>{messageErreur(offre.error)}</Alerte>}

          {((ruptures?.length ?? 0) > 0 || presqueEpuises.length > 0) && (
            <Carte className="!bg-rare border-rare-texte/20">
              <p className="font-bold text-rare-texte flex items-center gap-1.5"><IconAlertTriangle size={18} aria-hidden /> Risques de rupture</p>
              <ul className="text-sm mt-1 space-y-0.5">
                {presqueEpuises.map((p) => (
                  <li key={p.menu_jour_id}>Aujourd'hui : <b>{p.nom}</b>, plus que {restantes(p)} portion{restantes(p) > 1 ? 's' : ''}.</li>
                ))}
                {ruptures?.slice(0, 6).map((r) => (
                  <li key={r.menu_jour_id} className="first-letter:uppercase">
                    {jourLong(r.jour)} : <b>{r.plat}</b>, {r.attendus} attendus pour {r.portions_prevues} portions prévues (+{r.attendus - r.portions_prevues}).
                  </li>
                ))}
              </ul>
              {(ruptures?.length ?? 0) > 0 && (
                <Link to="/admin/prevision" className="inline-block mt-2 text-sm font-semibold text-marine underline">Ajuster avec la prévision →</Link>
              )}
            </Carte>
          )}

          {suggestion && (
            <Carte className="!bg-valide-clair border-valide/30">
              <p className="font-bold text-valide">Suggestion anti-gaspillage</p>
              <p className="text-sm mt-1">
                Il reste <b>{restantes(suggestion)} portions de {suggestion.nom}</b> non réservées. Proposer une offre à{' '}
                <b className="font-mono">{fcfa(prixOffre(suggestion.prix))}</b> (−50 %) pendant 45 minutes ?
              </p>
              <Bouton variante="valide" className="mt-2 !py-2" disabled={offre.isPending} onClick={() => offre.mutate(suggestion)}>
                Lancer l'offre
              </Bouton>
            </Carte>
          )}

          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
            <Carte>
              <h2 className="font-bold text-marine">Commandes par plat</h2>
              <p className="text-xs text-encre-douce">Servis et réservés, comparés aux portions préparées</p>
              {plats.length === 0 && <p className="text-sm text-encre-douce mt-3">Aucun menu ce jour-là.</p>}
              <ul className="mt-2 divide-y divide-ligne">
                {plats.map((p) => {
                  const total = p.portions_preparees ?? p.portions_prevues
                  const reste = restantes(p)
                  return (
                    <li key={p.menu_jour_id} className="py-2.5 flex items-center gap-3">
                      <Photo url={p.photo_url} nom={p.nom} className="w-10 h-10 rounded-lg shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2 text-sm">
                          <b className="truncate">{p.nom}</b>
                          <span className="font-mono shrink-0">{p.servies} / {p.reservees} <span className="text-encre-douce">sur {total}</span></span>
                        </div>
                        <div className="mt-1.5 flex h-2 rounded bg-fond overflow-hidden gap-0.5" title={`${p.servies} servis, ${p.reservees - p.servies} réservés non servis, ${Math.max(reste, 0)} non réservés`}>
                          <div className="bg-serie-1" style={{ width: `${(p.servies / total) * 100}%` }} />
                          <div className="bg-ciel" style={{ width: `${((p.reservees - p.servies) / total) * 100}%` }} />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-encre-douce">
                            {p.offre_active ? `Offre en cours : ${fcfa(p.prix_offre!)} jusqu'à ${new Date(p.fin_offre!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' })}` : `${Math.max(reste, 0)} non réservées`}
                          </span>
                          {serviceEnCours && !p.offre_active && reste > 0 && (
                            <button className="text-xs font-semibold text-valide underline" disabled={offre.isPending} onClick={() => offre.mutate(p)}>
                              Offre −50 %
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="flex gap-4 text-xs text-encre-douce mt-2">
                <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-serie-1 mr-1" />Servis</span>
                <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-ciel mr-1" />Réservés, pas encore servis</span>
                <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-fond border border-ligne mr-1" />Non réservées</span>
              </div>
            </Carte>

            <Carte>
              <h2 className="font-bold text-marine">Affluence par créneau</h2>
              <p className="text-xs text-encre-douce">Réservations par quart d'heure</p>
              <div className="mt-4 flex items-end gap-1.5 h-36 border-b border-ligne">
                {tb.creneaux.map((c) => (
                  <div key={c.heure_debut} className="flex-1 flex flex-col justify-end h-full" title={`${heure(c.heure_debut)} : ${c.reservees} réservés, ${c.servies} servis`}>
                    {c.reservees > 0 && <span className="text-[10px] font-mono text-center">{c.reservees}</span>}
                    <div className="bg-serie-1 rounded-t" style={{ height: `${(c.reservees / maxCreneau) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mt-1">
                {tb.creneaux.map((c) => (
                  <span key={c.heure_debut} className="flex-1 text-center text-[10px] font-mono text-encre-douce">{heure(c.heure_debut)}</span>
                ))}
              </div>
            </Carte>
          </div>
        </>
      )}
    </div>
  )
}
