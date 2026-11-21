import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { ajouterJours, aujourdhui, jourCourt, jourLong, messageErreur } from '../../lib/format'
import { Alerte, Bouton, Carte, Chargement } from '../../components/ui'
import { Photo } from '../../components/Plat'

interface LignePrevision {
  jour: string
  menu_jour_id: number
  plat: string
  photo_url: string | null
  reservees: number
  estimees: number
  attendus: number
  a_preparer: number
  portions_prevues: number
  taux_presence: number
  moyenne_jour: number
}
interface Semaine { semaine: string; preparees: number; servies: number; jetees: number; sauvees: number }

const lundiDe = (iso: string) => ajouterJours(iso, -((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7))

export default function Prevision() {
  const qc = useQueryClient()
  const [lundi, setLundi] = useState(lundiDe(ajouterJours(aujourdhui(), 2)))
  const [jourChoisi, setJourChoisi] = useState<string | null>(null)
  const vendredi = ajouterJours(lundi, 4)

  const { data: lignes, isLoading, error } = useQuery({
    queryKey: ['prevision', lundi],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prevision', { p_debut: lundi, p_fin: vendredi })
      if (error) throw error
      return data as LignePrevision[]
    },
  })
  const { data: gaspillage } = useQuery({
    queryKey: ['gaspillage'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gaspillage_semaines', { p_semaines: 6 })
      if (error) throw error
      return data as Semaine[]
    },
  })
  const appliquer = useMutation({
    mutationFn: async (jour: string) => {
      const { error } = await supabase.rpc('appliquer_prevision', { p_jour: jour })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })

  const jours = [...new Set((lignes ?? []).map((l) => l.jour))]
  const jour = jourChoisi && jours.includes(jourChoisi) ? jourChoisi : jours[0]
  const parJour = jours.map((j) => {
    const ls = (lignes ?? []).filter((l) => l.jour === j)
    return { jour: j, reservees: ls.reduce((s, l) => s + l.reservees, 0), estimees: ls.reduce((s, l) => s + l.estimees, 0) }
  })
  const max = Math.max(1, ...parJour.map((d) => d.reservees + d.estimees))
  const detail = (lignes ?? []).filter((l) => l.jour === jour)
  const taux = lignes?.[0]?.taux_presence
  const maxG = Math.max(1, ...(gaspillage ?? []).map((g) => g.jetees))

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-titre font-black text-2xl text-marine">Prévision</h1>
          <p className="text-sm text-encre-douce">
            Repas attendus = réservations déjà faites + estimation selon les 4 dernières semaines (même jour de la semaine).
          </p>
        </div>
        <div className="flex gap-1">
          <Bouton variante="contour" className="!py-2" onClick={() => setLundi(ajouterJours(lundi, -7))}>← Semaine</Bouton>
          <Bouton variante="contour" className="!py-2" onClick={() => setLundi(ajouterJours(lundi, 7))}>Semaine →</Bouton>
        </div>
      </div>
      {isLoading && <Chargement />}
      {error && <Alerte>{messageErreur(error)}</Alerte>}

      {lignes && (
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-4">
          <Carte>
            <h2 className="font-bold text-marine">Repas attendus par jour</h2>
            <div className="flex gap-4 text-xs text-encre-douce mt-1">
              <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-serie-1 mr-1" />Déjà réservés</span>
              <span><i className="inline-block w-2.5 h-2.5 rounded-sm bg-serie-2 mr-1" />Estimation en plus</span>
            </div>
            <div className="mt-4 flex items-end gap-3 h-56 border-b border-ligne">
              {parJour.map((d) => (
                <button key={d.jour} onClick={() => setJourChoisi(d.jour)} aria-pressed={d.jour === jour}
                  title={`${jourLong(d.jour)} : ${d.reservees} réservés + ${d.estimees} estimés`}
                  className={`flex-1 h-full flex flex-col justify-end gap-0.5 rounded-t ${d.jour === jour ? 'outline-2 outline-offset-2 outline-ciel' : ''}`}>
                  <span className="text-xs font-mono text-center">{d.reservees + d.estimees}</span>
                  <div className="bg-serie-2 rounded-t" style={{ height: `${(d.estimees / max) * 85}%` }} />
                  <div className="bg-serie-1" style={{ height: `${(d.reservees / max) * 85}%` }} />
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-1">
              {parJour.map((d) => <span key={d.jour} className="flex-1 text-center text-xs text-encre-douce capitalize">{jourCourt(d.jour)}</span>)}
            </div>
            <p className="text-xs text-encre-douce mt-3">
              Taux de présence observé : <b>{taux} %</b>. Les réservations ferment à 8h le jour même : après, il n'y a plus d'estimation, seulement les réservés.
            </p>
          </Carte>

          <Carte>
            <div className="flex flex-wrap justify-between items-start gap-2">
              <div>
                <h2 className="font-bold text-marine capitalize">{jour && jourLong(jour)} · portions à préparer</h2>
                <p className="text-xs text-encre-douce">À préparer = attendus × présence ({taux} %) + 5 % de marge</p>
              </div>
              {jour && jour >= aujourdhui() && (
                <Bouton variante="marine" className="!py-2" disabled={appliquer.isPending} onClick={() => appliquer.mutate(jour)}>
                  Appliquer au menu
                </Bouton>
              )}
            </div>
            {appliquer.isSuccess && <div className="mt-2"><Alerte type="succes">Portions prévues mises à jour dans le menu.</Alerte></div>}
            {appliquer.isError && <div className="mt-2"><Alerte>{messageErreur(appliquer.error)}</Alerte></div>}
            <table className="w-full text-sm mt-2">
              <thead className="text-xs text-encre-douce text-left">
                <tr><th className="py-1.5">Plat</th><th>Réservés</th><th>Estimés</th><th>Attendus</th><th>Prévu</th><th>À préparer</th></tr>
              </thead>
              <tbody className="divide-y divide-ligne">
                {detail.map((l) => (
                  <tr key={l.menu_jour_id}>
                    <td className="py-2"><div className="flex items-center gap-2"><Photo url={l.photo_url} nom={l.plat} className="w-8 h-8 rounded-md" /><b>{l.plat}</b></div></td>
                    <td className="font-mono">{l.reservees}</td>
                    <td className="font-mono">+{l.estimees}</td>
                    <td className="font-mono">{l.attendus}</td>
                    <td className="font-mono text-encre-douce">{l.portions_prevues}</td>
                    <td><span className="font-mono font-bold rounded-full bg-ciel-clair text-marine px-2.5 py-0.5">{l.a_preparer}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.some((l) => l.portions_prevues - l.a_preparer >= 10) && (
              <p className="mt-3 rounded-xl bg-rare text-rare-texte text-xs px-3 py-2">
                Certaines portions prévues dépassent largement la prévision : les appliquer évite de préparer pour rien.
              </p>
            )}
          </Carte>
        </div>
      )}

      {gaspillage && gaspillage.length > 0 && (
        <Carte>
          <h2 className="font-bold text-marine">Gaspillage des 6 dernières semaines</h2>
          <p className="text-xs text-encre-douce">Portions préparées mais non servies, par semaine</p>
          <div className="mt-4 flex items-end gap-3 h-32 border-b border-ligne">
            {gaspillage.map((g) => (
              <div key={g.semaine} className="flex-1 h-full flex flex-col justify-end" title={`Semaine du ${jourLong(g.semaine)} : ${g.jetees} jetées sur ${g.preparees} préparées`}>
                <span className="text-xs font-mono text-center">{g.jetees}</span>
                <div className="bg-serie-2 rounded-t" style={{ height: `${(g.jetees / maxG) * 85}%` }} />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-1">
            {gaspillage.map((g) => <span key={g.semaine} className="flex-1 text-center text-xs text-encre-douce">{jourCourt(g.semaine)}</span>)}
          </div>
          <p className="text-xs text-encre-douce mt-2">
            Total : {gaspillage.reduce((s, g) => s + g.jetees, 0)} portions jetées sur {gaspillage.reduce((s, g) => s + g.preparees, 0)} préparées
            ({Math.round((gaspillage.reduce((s, g) => s + g.jetees, 0) / Math.max(1, gaspillage.reduce((s, g) => s + g.preparees, 0))) * 100)} %).
          </p>
        </Carte>
      )}
    </div>
  )
}
