import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { IconArrowLeft, IconStarFilled } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { dateHeure, note } from '../../lib/format'
import { Alerte, Chargement } from '../../components/ui'
import { useLangue } from '../../lib/i18n'

interface Avis {
  moyenne: number | null
  nombre: number
  repartition: Record<string, number>
  commentaires: { valeur: number; commentaire: string; cree_le: string; prenom: string }[]
}

/** Les avis d'un plat : moyenne, répartition des étoiles et derniers commentaires (prénom seulement). */
export function BlocAvis({ platId }: { platId: number }) {
  const { t } = useLangue()
  const { data, isLoading, error } = useQuery({
    queryKey: ['avis', platId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('avis_plat', { p_plat: platId })
      if (error) throw error
      return data as Avis
    },
  })
  if (isLoading) return <Chargement />
  if (error || !data) return <Alerte>{t('Impossible de charger les avis.')}</Alerte>
  if (data.nombre === 0) return <p className="text-sm text-encre-douce">{t('Pas encore d\'avis sur ce plat.')}</p>
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="font-titre font-black text-3xl text-marine">{note(data.moyenne ?? 0)}</p>
          <p className="text-xs text-encre-douce">{t('{n} avis', { n: data.nombre })}</p>
        </div>
        <div className="flex-1 space-y-0.5">
          {[5, 4, 3, 2, 1].map((v) => {
            const n = data.repartition[String(v)] ?? 0
            return (
              <div key={v} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right">{v}</span>
                <IconStarFilled size={11} className="text-action" aria-hidden />
                <div className="flex-1 h-2 rounded-full bg-fond overflow-hidden">
                  <div className="h-full bg-action" style={{ width: `${(n / data.nombre) * 100}%` }} />
                </div>
                <span className="w-8 text-encre-douce">{n}</span>
              </div>
            )
          })}
        </div>
      </div>
      {data.commentaires.length > 0 && (
        <ul className="space-y-2">
          {data.commentaires.map((c, i) => (
            <li key={i} className="rounded-xl bg-fond p-3 text-sm">
              <div className="flex justify-between gap-2">
                <b>{c.prenom}</b>
                <span className="text-action">{'★'.repeat(c.valeur)}{'☆'.repeat(5 - c.valeur)}</span>
              </div>
              <p className="mt-0.5">{c.commentaire}</p>
              <p className="text-xs text-encre-douce mt-0.5">{dateHeure(c.cree_le)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function PageAvis() {
  const { platId } = useParams()
  const navigate = useNavigate()
  const { t } = useLangue()
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} aria-label={t('Retour')} className="w-9 h-9 rounded-full bg-white text-marine shadow flex items-center justify-center"><IconArrowLeft size={20} /></button>
        <h1 className="font-titre font-black text-xl text-marine">{t('Avis des convives')}</h1>
      </div>
      <BlocAvis platId={Number(platId)} />
    </div>
  )
}
