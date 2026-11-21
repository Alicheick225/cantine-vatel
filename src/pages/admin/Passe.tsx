import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { useTempsReel } from '../../lib/temps-reel'
import { messageErreur } from '../../lib/format'
import { LIBELLE_ALLERGENE, type Allergene } from '../../lib/types'
import { BandeVatel, Quitter } from '../../components/ui'

interface ALaFile {
  id: number
  code_court: string
  scanne_le: string
  plat: string
  allergenes_plat: Allergene[]
  convive: string
  allergies: Allergene[]
  vegetarien: boolean
}

/** Écran du passe (configuration 2) : la file des tickets validés à l'entrée, du plus ancien au plus récent. */
export default function Passe() {
  const qc = useQueryClient()
  useTempsReel('passe')
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  const { data: file, error } = useQuery({
    queryKey: ['passe'],
    // La serveuse ne lit pas la table des réservations : la file lui arrive par une fonction dédiée,
    // rafraîchie toutes les 4 secondes (et aussitôt en temps réel pour l'admin).
    refetchInterval: 4_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('file_du_passe')
      if (error) throw error
      return data as ALaFile[]
    },
  })
  const remettre = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc('remettre', { p_reservation: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })
  const attente = (iso: string) => Math.max(0, Math.round((maintenant - new Date(iso).getTime()) / 60000))

  return (
    <div className="min-h-dvh bg-marine text-white flex flex-col">
      <BandeVatel />
      <header className="flex items-center justify-between px-4 pt-4">
        <div>
          <h1 className="font-titre font-black text-lg">Écran du passe</h1>
          <p className="text-sm opacity-85">{file?.length ?? 0} plat{(file?.length ?? 0) > 1 ? 's' : ''} à remettre · mis à jour en direct</p>
        </div>
        <Quitter />
      </header>
      {error && <p className="m-4 rounded-xl bg-refus px-3 py-2 text-sm">{messageErreur(error)}</p>}
      {remettre.isError && <p className="m-4 rounded-xl bg-refus px-3 py-2 text-sm">{messageErreur(remettre.error)}</p>}
      <ol className="flex-1 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 content-start">
        {file?.map((t, i) => (
          <li key={t.id} className={`rounded-2xl p-4 text-marine ${i === 0 ? 'bg-white ring-4 ring-action' : 'bg-white/90'}`}>
            <div className="flex justify-between items-start gap-2">
              <span className="font-mono text-sm">{t.code_court}</span>
              <span className={`text-xs font-bold ${attente(t.scanne_le) >= 5 ? 'text-refus' : 'text-encre-douce'}`}>
                {attente(t.scanne_le) === 0 ? "à l'instant" : `il y a ${attente(t.scanne_le)} min`}
              </span>
            </div>
            <p className="font-titre font-black text-2xl mt-1">{t.plat}</p>
            <p className="text-sm text-encre-douce">{t.convive}</p>
            {(t.allergenes_plat ?? []).some((a) => t.allergies.includes(a)) && (
              <p className="mt-2 rounded-lg bg-refus text-white font-bold text-sm px-2 py-1 inline-flex items-center gap-1">
                <IconAlertTriangle size={14} /> Le plat contient un allergène déclaré : vérifier avant de servir
              </p>
            )}
            {(t.allergies.length || t.vegetarien) ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.allergies.map((a) => (
                  <span key={a} className="rounded-lg bg-rare text-rare-texte font-bold text-sm px-2 py-0.5 inline-flex items-center gap-1">
                    <IconAlertTriangle size={14} /> Allergie : {LIBELLE_ALLERGENE[a].toLowerCase()}
                    {!(t.allergenes_plat ?? []).includes(a) && <span className="font-normal">· absent de ce plat</span>}
                  </span>
                ))}
                {t.vegetarien && <span className="rounded-lg bg-valide-clair text-valide font-bold text-sm px-2 py-0.5">Végétarien</span>}
              </div>
            ) : null}
            <button
              onClick={() => remettre.mutate(t.id)}
              disabled={remettre.isPending}
              className="mt-3 w-full rounded-xl bg-valide text-white font-extrabold py-3 inline-flex items-center justify-center gap-2"
            >
              <IconCheck size={20} /> Remis
            </button>
          </li>
        ))}
        {file?.length === 0 && <li className="text-center opacity-80 py-10 sm:col-span-2 lg:col-span-3">Aucun plat en attente. Les tickets validés à l'entrée apparaîtront ici.</li>}
      </ol>
    </div>
  )
}
