import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { messageErreur } from '../../lib/format'
import { Alerte, Carte, Chargement } from '../../components/ui'

interface Ligne {
  id: number
  horodatage: string
  acteur: string | null
  role_acteur: string | null
  action: string
  table_nom: string | null
  ligne_id: string | null
  anciennes_valeurs: Record<string, unknown> | null
  nouvelles_valeurs: Record<string, unknown> | null
  operation: string | null
  details: Record<string, unknown> | null
  ip: string | null
  agent: string | null
}

const ACTIONS: Record<string, { texte: string; style: string }> = {
  INSERT: { texte: 'Ajout', style: 'bg-ciel-clair text-marine' },
  UPDATE: { texte: 'Modification', style: 'bg-rare text-rare-texte' },
  DELETE: { texte: 'Suppression', style: 'bg-fond text-encre' },
  REFUS: { texte: 'Refus', style: 'bg-refus text-white' },
}
const AUDIT = new Set(['cree_le', 'cree_par', 'modifie_le', 'modifie_par'])

/** Champs modifiés (quoi), sans les colonnes d'audit. */
function changements(l: Ligne) {
  if (l.action === 'REFUS') return Object.entries(l.details ?? {}).map(([k, v]) => `${k} : ${String(v)}`).join(' · ')
  if (l.action !== 'UPDATE') return ''
  const a = l.anciennes_valeurs ?? {}, n = l.nouvelles_valeurs ?? {}
  return Object.keys(n)
    .filter((k) => !AUDIT.has(k) && JSON.stringify(a[k]) !== JSON.stringify(n[k]))
    .map((k) => `${k} : ${JSON.stringify(a[k])} → ${JSON.stringify(n[k])}`)
    .join(' · ')
}

const navigateur = (ua: string | null) => {
  if (!ua) return '—'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : ''
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Autre'
  return `${nav}${os ? ' · ' + os : ''}`
}

export default function Journal() {
  const [action, setAction] = useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['journal', action],
    refetchInterval: 10_000,
    queryFn: async () => {
      let q = supabase.from('journal_audit').select('*').order('id', { ascending: false }).limit(150)
      if (action) q = q.eq('action', action)
      const { data, error } = await q
      if (error) throw error
      const lignes = data as Ligne[]
      const ids = [...new Set(lignes.map((l) => l.acteur).filter(Boolean))] as string[]
      const { data: profils } = ids.length
        ? await supabase.from('profils').select('id, nom').in('id', ids)
        : { data: [] as { id: string; nom: string }[] }
      const noms = new Map((profils ?? []).map((p) => [p.id, p.nom]))
      return lignes.map((l) => ({ ...l, nom: l.acteur ? noms.get(l.acteur) ?? 'inconnu' : null }))
    },
  })

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-titre font-black text-2xl text-marine">Journal d'audit</h1>
          <p className="text-sm text-encre-douce">
            Traçabilité (critère T de DICT) : <b>qui</b>, <b>quoi</b>, <b>quand</b>, <b>comment</b> et <b>où</b> pour chaque action. Journal écrit par la base, impossible à modifier ou à effacer.
          </p>
        </div>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-xl border border-ligne bg-white px-3 py-2 text-sm" aria-label="Filtrer par action">
          <option value="">Toutes les actions</option>
          {Object.entries(ACTIONS).map(([v, a]) => <option key={v} value={v}>{a.texte}</option>)}
        </select>
      </div>
      {isLoading && <Chargement />}
      {error && <Alerte>{messageErreur(error)}</Alerte>}
      <Carte className="!p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-encre-douce border-b border-ligne">
            <tr><th className="p-2.5">Quand</th><th className="p-2.5">Qui</th><th className="p-2.5">Quoi</th><th className="p-2.5">Comment</th><th className="p-2.5">Où</th></tr>
          </thead>
          <tbody className="divide-y divide-ligne align-top">
            {data?.map((l) => (
              <tr key={l.id}>
                <td className="p-2.5 font-mono whitespace-nowrap">
                  {new Date(l.horodatage).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Abidjan' })}
                </td>
                <td className="p-2.5">
                  <b>{l.nom ?? 'Système'}</b>
                  <span className="block text-encre-douce">{l.role_acteur}</span>
                </td>
                <td className="p-2.5">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${ACTIONS[l.action]?.style ?? 'bg-fond'}`}>{ACTIONS[l.action]?.texte ?? l.action}</span>{' '}
                  <span className="font-mono">{l.table_nom}{l.ligne_id ? ` #${l.ligne_id.slice(0, 8)}` : ''}</span>
                  {changements(l) && <span className="block mt-1 text-encre-douce break-all">{changements(l)}</span>}
                </td>
                <td className="p-2.5 font-mono">{l.operation ?? '—'}</td>
                <td className="p-2.5">
                  <span className="font-mono">{l.ip || '—'}</span>
                  <span className="block text-encre-douce">{navigateur(l.agent)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>
    </div>
  )
}
