import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { fcfa, jourLong, messageErreur } from '../../lib/format'
import { Alerte, BandeVatel, Bouton, Carte, Champ, Chargement } from '../../components/ui'
import { Photo } from '../../components/Plat'

interface Enfant { id: string; nom: string; solde: number; allergies: string[] }
interface Repas { id: number; jour: string; statut: string; utilisateur_id: string; menu: { plat: { nom: string; photo_url: string | null } | null } | null }
type Moyen = 'wave' | 'orange_money'

function Recharge({ enfant }: { enfant: Enfant }) {
  const qc = useQueryClient()
  const [montant, setMontant] = useState<number | null>(null)
  const [moyen, setMoyen] = useState<Moyen>('wave')
  const [confirmer, setConfirmer] = useState(false)
  const recharger = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('recharger_enfant', { p_enfant: enfant.id, p_montant: montant, p_moyen: moyen })
      if (error) throw error
    },
    onSuccess: () => { setMontant(null); setConfirmer(false); qc.invalidateQueries() },
  })
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(['wave', 'orange_money'] as const).map((m) => (
          <button key={m} aria-pressed={moyen === m} onClick={() => setMoyen(m)}
            className={`rounded-xl py-2 text-sm font-bold border-2 ${moyen === m ? (m === 'wave' ? 'border-marine bg-[#1DC8F2] text-marine' : 'border-marine bg-[#FF7900] text-white') : 'border-ligne text-encre-douce'}`}>
            {m === 'wave' ? 'Wave' : 'Orange Money'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[1000, 2000, 5000, 10000].map((v) => (
          <button key={v} aria-pressed={montant === v} onClick={() => { setMontant(v); setConfirmer(false) }}
            className={`rounded-xl py-2 font-mono text-sm border ${montant === v ? 'bg-ciel-clair border-ciel text-marine font-bold' : 'border-ligne'}`}>
            {v.toLocaleString('fr-FR')}
          </button>
        ))}
      </div>
      {recharger.isError && <Alerte>{messageErreur(recharger.error)}</Alerte>}
      {recharger.isSuccess && <Alerte type="succes">Compte rechargé.</Alerte>}
      {!confirmer ? (
        <Bouton className="w-full" disabled={!montant} onClick={() => setConfirmer(true)}>
          {montant ? `Recharger ${fcfa(montant)}` : 'Choisissez un montant'}
        </Bouton>
      ) : (
        <div className="flex gap-2">
          <Bouton variante="contour" className="flex-1" onClick={() => setConfirmer(false)}>Retour</Bouton>
          <Bouton variante="valide" className="flex-1" disabled={recharger.isPending} onClick={() => recharger.mutate()}>
            Confirmer {fcfa(montant!)} pour {enfant.nom.split(' ')[0]}
          </Bouton>
        </div>
      )}
      <p className="text-[11px] text-encre-douce text-center">Paiement simulé pour la démonstration.</p>
    </div>
  )
}

export default function Parent() {
  const { profil, deconnexion } = useAuth()
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['enfants'],
    queryFn: async () => {
      const { data: enfants, error } = await supabase.from('profils').select('id, nom, solde, allergies').neq('id', profil!.id)
      if (error) throw error
      const { data: repas } = await supabase
        .from('reservations')
        .select('id, jour, statut, utilisateur_id, menu:menus_jour(plat:plats(nom, photo_url))')
        .neq('utilisateur_id', profil!.id)
        .order('jour', { ascending: false })
        .limit(40)
      return { enfants: (enfants ?? []) as Enfant[], repas: (repas ?? []) as unknown as Repas[] }
    },
    enabled: !!profil,
  })
  const lier = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('lier_enfant', { p_code: code })
      if (error) throw error
      const r = data as { ok: boolean; message?: string; enfant?: string }
      if (!r.ok) throw new Error(r.message)
      return r
    },
    onSuccess: () => { setCode(''); qc.invalidateQueries() },
  })
  const soumettre = (e: FormEvent) => { e.preventDefault(); lier.mutate() }
  const statut = (r: Repas) => r.statut === 'servie' ? 'Mangé' : r.statut === 'annulee' ? 'Annulé' : r.jour < new Date().toISOString().slice(0, 10) ? 'Absent' : 'Réservé'

  return (
    <div className="min-h-dvh max-w-lg mx-auto bg-white">
      <header className="bg-marine text-white px-5 pt-6 pb-5 flex justify-between items-start">
        <div>
          <p className="text-sm opacity-85">Akwaba {profil?.nom.split(' ')[0]}</p>
          <h1 className="font-titre font-black text-2xl">Espace parent</h1>
        </div>
        <button onClick={deconnexion} className="text-xs underline opacity-85 mt-1">Se déconnecter</button>
      </header>
      <BandeVatel />
      <div className="p-4 space-y-4">
        {isLoading && <Chargement />}
        {data?.enfants.map((e) => {
          const repas = data.repas.filter((r) => r.utilisateur_id === e.id).slice(0, 6)
          return (
            <Carte key={e.id} className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-bold text-marine">{e.nom}</h2>
                  {e.allergies.length > 0 && <p className="text-xs text-encre-douce">Allergies : {e.allergies.join(', ')}</p>}
                </div>
                <p className="font-mono text-xl text-marine">{fcfa(e.solde)}</p>
              </div>
              {e.solde < 2000 && <Alerte type="info">Solde bas : pensez à recharger le compte de {e.nom.split(' ')[0]}.</Alerte>}
              <Recharge enfant={e} />
              <div>
                <h3 className="text-sm font-bold text-marine mb-1">Ses derniers repas</h3>
                {repas.length === 0 && <p className="text-xs text-encre-douce">Aucun repas pour l'instant.</p>}
                <ul className="divide-y divide-ligne">
                  {repas.map((r) => (
                    <li key={r.id} className="py-2 flex items-center gap-2 text-sm">
                      <Photo url={r.menu?.plat?.photo_url ?? null} nom={r.menu?.plat?.nom ?? '?'} className="w-9 h-9 rounded-lg" />
                      <span className="flex-1">{r.menu?.plat?.nom}<span className="block text-xs text-encre-douce capitalize">{jourLong(r.jour)}</span></span>
                      <span className="text-xs rounded-full bg-fond px-2">{statut(r)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Carte>
          )
        })}
        <Carte>
          <form onSubmit={soumettre} className="space-y-2">
            <h2 className="font-bold text-marine">Lier un enfant</h2>
            <p className="text-xs text-encre-douce">Votre enfant génère un code depuis son profil (rubrique « Lier un parent »).</p>
            <Champ label="Code de liaison" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="ex. K7M2QX" />
            {lier.isError && <Alerte>{messageErreur(lier.error)}</Alerte>}
            {lier.isSuccess && <Alerte type="succes">{lier.data.enfant} est maintenant lié(e) à votre compte.</Alerte>}
            <Bouton type="submit" variante="marine" className="w-full" disabled={code.length < 6 || lier.isPending}>Lier</Bouton>
          </form>
        </Carte>
      </div>
    </div>
  )
}
