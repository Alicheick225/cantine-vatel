import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { ajouterJours, aujourdhui, jourLong, messageErreur } from '../../lib/format'
import { Alerte, Bouton, Carte, Chargement } from '../../components/ui'
import { usePlats } from './Plats'

interface LigneMenu {
  id: number
  jour: string
  plat_id: number
  portions_prevues: number
  portions_preparees: number | null
  plat: { nom: string; type: string }
  reservations: { count: number }[]
}

const lundiDe = (iso: string) => {
  const d = new Date(iso + 'T12:00:00Z')
  const decal = (d.getUTCDay() + 6) % 7
  return ajouterJours(iso, -decal)
}

function Jour({ jour, lignes }: { jour: string; lignes: LigneMenu[] }) {
  const qc = useQueryClient()
  const { data: plats } = usePlats()
  const [ajout, setAjout] = useState('')
  const passe = jour < aujourdhui()
  const action = useMutation({
    mutationFn: async (f: () => PromiseLike<{ error: unknown }>) => {
      const { error } = await f()
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })
  const disponibles = (plats ?? []).filter((p) => p.actif && !lignes.some((l) => l.plat_id === p.id))

  return (
    <Carte>
      <h2 className="font-bold text-marine capitalize">{jourLong(jour)}</h2>
      {action.isError && <div className="mt-2"><Alerte>{messageErreur(action.error)}</Alerte></div>}
      <ul className="mt-2 divide-y divide-ligne text-sm">
        {lignes.map((l) => {
          const nbRes = l.reservations[0]?.count ?? 0
          return (
            <li key={l.id} className="py-2 flex flex-wrap items-center gap-2">
              <span className="flex-1 min-w-32 font-semibold">{l.plat.nom}</span>
              <label className="text-xs text-encre-douce flex items-center gap-1">
                Prévues
                <input type="number" min={0} defaultValue={l.portions_prevues} aria-label={`Portions prévues ${l.plat.nom}`}
                  onBlur={(e) => Number(e.target.value) !== l.portions_prevues &&
                    action.mutate(() => supabase.from('menus_jour').update({ portions_prevues: Number(e.target.value) }).eq('id', l.id))}
                  className="w-16 rounded-lg border border-ligne px-2 py-1 font-mono text-encre" />
              </label>
              {passe || jour === aujourdhui() ? (
                <label className="text-xs text-encre-douce flex items-center gap-1">
                  Préparées
                  <input type="number" min={0} defaultValue={l.portions_preparees ?? ''} aria-label={`Portions préparées ${l.plat.nom}`}
                    onBlur={(e) => e.target.value !== '' && Number(e.target.value) !== l.portions_preparees &&
                      action.mutate(() => supabase.from('menus_jour').update({ portions_preparees: Number(e.target.value) }).eq('id', l.id))}
                    className="w-16 rounded-lg border border-ligne px-2 py-1 font-mono text-encre" />
                </label>
              ) : null}
              <span className="text-xs text-encre-douce w-24 text-right">{nbRes} réservation{nbRes > 1 ? 's' : ''}</span>
              {nbRes === 0 && !passe && (
                <button className="text-xs text-refus underline" onClick={() => action.mutate(() => supabase.from('menus_jour').delete().eq('id', l.id))}>
                  Retirer
                </button>
              )}
            </li>
          )
        })}
        {lignes.length === 0 && <li className="py-2 text-encre-douce">Aucun plat ce jour-là.</li>}
      </ul>
      {!passe && (
        <div className="mt-2 flex gap-2">
          <select value={ajout} onChange={(e) => setAjout(e.target.value)} className="flex-1 rounded-xl border border-ligne bg-white px-3 py-2 text-sm" aria-label="Plat à ajouter">
            <option value="">Ajouter un plat…</option>
            {disponibles.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          <Bouton variante="marine" className="!py-2" disabled={!ajout || action.isPending}
            onClick={() => { action.mutate(() => supabase.from('menus_jour').insert({ jour, plat_id: Number(ajout), portions_prevues: 40 })); setAjout('') }}>
            Ajouter
          </Bouton>
        </div>
      )}
    </Carte>
  )
}

export default function Menus() {
  const [lundi, setLundi] = useState(lundiDe(ajouterJours(aujourdhui(), 2)))
  const jours = [0, 1, 2, 3, 4].map((i) => ajouterJours(lundi, i))
  const { data, isLoading, error } = useQuery({
    queryKey: ['menus-admin', lundi],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menus_jour')
        .select('id, jour, plat_id, portions_prevues, portions_preparees, plat:plats(nom, type), reservations(count)')
        .gte('jour', jours[0]).lte('jour', jours[4])
        .neq('reservations.statut', 'annulee')
        .order('jour')
      if (error) throw error
      return data as unknown as LigneMenu[]
    },
  })

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-titre font-black text-2xl text-marine">Menus de la semaine</h1>
          <p className="text-sm text-encre-douce">Composez chaque jour et ajustez les portions. Après le service, saisissez les portions préparées pour mesurer le gaspillage.</p>
        </div>
        <div className="flex gap-1">
          <Bouton variante="contour" className="!py-2" onClick={() => setLundi(ajouterJours(lundi, -7))}>← Semaine</Bouton>
          <Bouton variante="contour" className="!py-2" onClick={() => setLundi(ajouterJours(lundi, 7))}>Semaine →</Bouton>
        </div>
      </div>
      {isLoading && <Chargement />}
      {error && <Alerte>{messageErreur(error)}</Alerte>}
      {data && jours.map((j) => <Jour key={j} jour={j} lignes={data.filter((l) => l.jour === j)} />)}
    </div>
  )
}
