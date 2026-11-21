import { LIBELLE_ALLERGENE, type Allergene, type PlatMenu } from '../lib/types'
import { fcfa, note } from '../lib/format'
import { useLangue } from '../lib/i18n'
import { IconAlertTriangle, IconFlame } from '@tabler/icons-react'

export function Photo({ url, nom, className = '' }: { url: string | null; nom: string; className?: string }) {
  if (url) return <img src={url} alt={nom} loading="lazy" className={`object-cover bg-ciel-clair ${className}`} />
  return (
    <div aria-hidden className={`bg-ciel-clair text-marine font-titre font-black flex items-center justify-center ${className}`}>
      {nom.slice(0, 1)}
    </div>
  )
}

/** Allergènes du plat que la personne ne doit pas manger. */
export const allergenesARisque = (plat: Pick<PlatMenu, 'allergenes'>, allergies: Allergene[]) =>
  plat.allergenes.filter((a) => allergies.includes(a))

export function Prix({ plat }: { plat: PlatMenu }) {
  if (plat.offre_active && plat.prix_offre)
    return (
      <span className="font-mono whitespace-nowrap">
        <span className="text-valide font-bold">{fcfa(plat.prix_offre)}</span>{' '}
        <s className="text-encre-douce text-xs">{fcfa(plat.prix)}</s>
      </span>
    )
  return <span className="font-mono whitespace-nowrap">{fcfa(plat.prix)}</span>
}

export function Pastilles({ plat, allergies }: { plat: PlatMenu; allergies: Allergene[] }) {
  const risque = allergenesARisque(plat, allergies)
  const { t } = useLangue()
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {plat.note_moyenne && <span className="text-xs text-encre-douce">{note(plat.note_moyenne)} ★ ({plat.nb_notes})</span>}
      {plat.vegetarien && <span className="rounded-full bg-valide-clair text-valide text-xs px-2">{t('Végétarien')}</span>}
      {plat.offre_active && <span className="rounded-full bg-valide text-white text-xs px-2">{t('Offre fin de service')}</span>}
      {plat.restantes === 0 ? (
        <span className="rounded-full bg-fond text-encre-douce text-xs px-2">{t('Épuisé')}</span>
      ) : plat.restantes <= 10 ? (
        <span className="rounded-full bg-rare text-rare-texte text-xs font-bold px-2 inline-flex items-center gap-0.5"><IconFlame size={13} aria-hidden />{t('Plus que {n}', { n: plat.restantes })}</span>
      ) : null}
      {risque.length > 0 && (
        <span className="rounded-full bg-refus/10 text-refus text-xs font-bold px-2 inline-flex items-center gap-0.5">
          <IconAlertTriangle size={13} aria-hidden /> {t('Contient : {liste}', { liste: risque.map((a) => t(LIBELLE_ALLERGENE[a].toLowerCase())).join(', ') })}
        </span>
      )}
    </div>
  )
}
