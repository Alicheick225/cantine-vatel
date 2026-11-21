import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { dateHeure, fcfa, jourLong, messageErreur } from '../../lib/format'
import { IconChevronDown } from '@tabler/icons-react'
import { Alerte, BandeVatel, Bouton, Carte, Chargement } from '../../components/ui'
import { useLangue } from '../../lib/i18n'

type Moyen = 'wave' | 'orange_money'
const MOYENS: { id: Moyen; nom: string; couleur: string }[] = [
  { id: 'wave', nom: 'Wave', couleur: 'bg-[#1DC8F2] text-marine' },
  { id: 'orange_money', nom: 'Orange Money', couleur: 'bg-[#FF7900] text-white' },
]
const MONTANTS = [1000, 2000, 5000, 10000]
const LIBELLES = { recharge: 'Recharge', debit: 'Repas', remboursement: 'Remboursement' } as const

interface Transaction {
  id: number
  type: keyof typeof LIBELLES
  montant: number
  moyen: string | null
  solde_apres: number
  cree_le: string
  cree_par: string | null
  reservation: { jour: string; code_court: string; est_offre: boolean; menu: { plat: { nom: string } | null } | null } | null
}

/** Une opération du solde, qui s'ouvre au toucher pour donner le détail. */
function LigneOperation({ t, moi }: { t: Transaction; moi?: string }) {
  const { t: tr } = useLangue()
  const [ouvert, setOuvert] = useState(false)
  const credit = t.type !== 'debit'
  const avant = credit ? t.solde_apres - t.montant : t.solde_apres + t.montant
  const ligne = (libelle: string, valeur: React.ReactNode) => (
    <div className="flex justify-between gap-3"><dt className="text-encre-douce">{tr(libelle)}</dt><dd className="text-right">{valeur}</dd></div>
  )
  return (
    <li className="py-2.5 text-sm">
      <button onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} className="w-full flex justify-between gap-3 text-left items-center">
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            {tr(LIBELLES[t.type])}{t.moyen ? ` · ${MOYENS.find((m) => m.id === t.moyen)?.nom ?? 'Simulé'}` : ''}
            {t.reservation?.menu?.plat && <span className="font-normal text-encre-douce"> · {t.reservation.menu.plat.nom}</span>}
          </p>
          <p className="text-xs text-encre-douce">{dateHeure(t.cree_le)}</p>
        </div>
        <div className="text-right">
          <p className={`font-mono font-bold ${credit ? 'text-valide' : 'text-encre'}`}>{credit ? '+' : '−'}{fcfa(t.montant)}</p>
          <p className="text-xs text-encre-douce font-mono">{tr('solde {m}', { m: fcfa(t.solde_apres) })}</p>
        </div>
        <IconChevronDown size={18} className={`shrink-0 text-encre-douce transition-transform ${ouvert ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {ouvert && (
        <dl className="mt-2 rounded-xl bg-fond p-3 space-y-1">
          {ligne('Opération', <span className="font-mono">n° {t.id}</span>)}
          {ligne('Date et heure', dateHeure(t.cree_le))}
          {t.moyen && ligne('Moyen de paiement', <>{MOYENS.find((m) => m.id === t.moyen)?.nom}<span className="block text-xs text-encre-douce">{tr('paiement simulé (démonstration)')}</span></>)}
          {t.type === 'recharge' && t.cree_par && moi && t.cree_par !== moi && ligne('Payée par', tr('votre parent'))}
          {t.reservation && ligne('Repas', <>{t.reservation.menu?.plat?.nom}{t.reservation.est_offre ? ` · ${tr('offre anti-gaspi')}` : ''}<span className="block text-xs text-encre-douce first-letter:uppercase">{jourLong(t.reservation.jour)} · {t.reservation.code_court}</span></>)}
          {t.type === 'remboursement' && ligne('Motif', tr('annulation avant 8h'))}
          {ligne('Solde avant', <span className="font-mono">{fcfa(avant)}</span>)}
          {ligne('Solde après', <span className="font-mono font-bold">{fcfa(t.solde_apres)}</span>)}
        </dl>
      )}
    </li>
  )
}

export default function Solde() {
  const { profil } = useAuth()
  const { t: tr } = useLangue()
  const qc = useQueryClient()
  const [moyen, setMoyen] = useState<Moyen>('wave')
  const [montant, setMontant] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState(false)

  const { data: historique, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, type, montant, moyen, solde_apres, cree_le, cree_par, reservation:reservations(jour, code_court, est_offre, menu:menus_jour(plat:plats(nom)))')
        .order('cree_le', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as unknown as Transaction[]
    },
  })

  const recharger = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('recharger', { p_montant: montant, p_moyen: moyen })
      if (error) throw error
    },
    onSuccess: () => {
      setConfirmation(false)
      setMontant(null)
      qc.invalidateQueries()
    },
  })

  const solde = profil?.solde ?? 0
  const nomMoyen = MOYENS.find((m) => m.id === moyen)!.nom

  return (
    <div>
      <header className="bg-marine text-white px-5 pt-6 pb-6">
        <h1 className="font-titre font-black text-2xl">{tr('Mon solde')}</h1>
        <p className="font-mono text-4xl mt-2">{fcfa(solde)}</p>
      </header>
      <BandeVatel />
      <div className="p-4 space-y-4">
        {solde < 2000 && <Alerte type="info">{tr('Votre solde est bas. Rechargez pour réserver vos prochains repas.')}</Alerte>}
        {recharger.isSuccess && <Alerte type="succes">{tr('Recharge effectuée.')}</Alerte>}

        <Carte className="space-y-3">
          <h2 className="font-bold text-marine">{tr('Recharger')}</h2>
          <div className="grid grid-cols-2 gap-2">
            {MOYENS.map((m) => (
              <button key={m.id} aria-pressed={moyen === m.id} onClick={() => setMoyen(m.id)}
                className={`rounded-xl px-3 py-2.5 text-sm font-bold border-2 ${moyen === m.id ? 'border-marine ' + m.couleur : 'border-ligne bg-white text-encre-douce'}`}>
                {m.nom}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MONTANTS.map((v) => (
              <button key={v} aria-pressed={montant === v} onClick={() => { setMontant(v); setConfirmation(false) }}
                className={`rounded-xl py-2 font-mono text-sm border ${montant === v ? 'bg-ciel-clair border-ciel text-marine font-bold' : 'bg-white border-ligne'}`}>
                {v.toLocaleString('fr-FR')}
              </button>
            ))}
          </div>
          {!confirmation ? (
            <Bouton className="w-full" disabled={!montant} onClick={() => setConfirmation(true)}>
              {montant ? tr('Recharger {m}', { m: fcfa(montant) }) : tr('Choisissez un montant')}
            </Bouton>
          ) : (
            <div className="rounded-xl border border-ligne p-3 space-y-2">
              <p className="text-sm">{tr('Confirmez-vous le paiement de {m} via {moyen} ?', { m: fcfa(montant!), moyen: nomMoyen })}</p>
              <p className="text-xs text-encre-douce">{tr("Paiement simulé pour la démonstration : aucun argent réel n'est débité.")}</p>
              {recharger.isError && <Alerte>{tr(messageErreur(recharger.error))}</Alerte>}
              <div className="flex gap-2">
                <Bouton variante="contour" className="flex-1" onClick={() => setConfirmation(false)}>{tr('Retour')}</Bouton>
                <Bouton variante="valide" className="flex-1" disabled={recharger.isPending} onClick={() => recharger.mutate()}>
                  {recharger.isPending ? tr('Paiement…') : tr('Confirmer')}
                </Bouton>
              </div>
            </div>
          )}
        </Carte>

        <section>
          <h2 className="font-bold text-marine text-sm mb-1">{tr('Historique')}</h2>
          {isLoading && <Chargement />}
          <ul className="divide-y divide-ligne">
            {historique?.map((t) => <LigneOperation key={t.id} t={t} moi={profil?.id} />)}
          </ul>
          {historique?.length === 0 && <p className="text-sm text-encre-douce">{tr("Aucune opération pour l'instant.")}</p>}
        </section>
      </div>
    </div>
  )
}
