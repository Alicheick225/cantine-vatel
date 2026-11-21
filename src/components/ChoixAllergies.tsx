import { ALLERGENES, LIBELLE_ALLERGENE, type Allergene } from '../lib/types'
import { useLangue } from '../lib/i18n'

export default function ChoixAllergies({ valeur, onChange }: { valeur: Allergene[]; onChange: (v: Allergene[]) => void }) {
  const { t } = useLangue()
  const basculer = (a: Allergene) => onChange(valeur.includes(a) ? valeur.filter((x) => x !== a) : [...valeur, a])
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-marine">{t('Allergies (facultatif)')}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALLERGENES.map((a) => {
          const actif = valeur.includes(a)
          return (
            <button
              type="button"
              key={a}
              aria-pressed={actif}
              onClick={() => basculer(a)}
              className={`rounded-full px-3 py-1.5 text-sm border ${actif ? 'bg-marine text-white border-marine' : 'bg-white text-encre border-ligne'}`}
            >
              {t(LIBELLE_ALLERGENE[a])}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
