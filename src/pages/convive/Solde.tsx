import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { dateHeure, fcfa, messageErreur } from '../../lib/format'
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
        .select('id, type, montant, moyen, solde_apres, cree_le')
        .order('cree_le', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Transaction[]
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
            {historique?.map((t) => {
              const credit = t.type !== 'debit'
              return (
                <li key={t.id} className="py-2.5 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold">
                      {tr(LIBELLES[t.type])}{t.moyen ? ` · ${MOYENS.find((m) => m.id === t.moyen)?.nom ?? 'Simulé'}` : ''}
                    </p>
                    <p className="text-xs text-encre-douce">{dateHeure(t.cree_le)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-bold ${credit ? 'text-valide' : 'text-encre'}`}>{credit ? '+' : '−'}{fcfa(t.montant)}</p>
                    <p className="text-xs text-encre-douce font-mono">{tr('solde {m}', { m: fcfa(t.solde_apres) })}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          {historique?.length === 0 && <p className="text-sm text-encre-douce">{tr("Aucune opération pour l'instant.")}</p>}
        </section>
      </div>
    </div>
  )
}
