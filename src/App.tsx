import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type Etat = 'verification' | 'ok' | 'erreur'

export default function App() {
  const [etat, setEtat] = useState<Etat>('verification')

  useEffect(() => {
    // Simple test de connexion à Supabase pour le premier déploiement.
    supabase.auth
      .getSession()
      .then(({ error }) => setEtat(error ? 'erreur' : 'ok'))
      .catch(() => setEtat('erreur'))
  }, [])

  return (
    <main className="min-h-dvh flex flex-col">
      <header className="bg-marine text-white px-6 py-8">
        <p className="text-sm opacity-80">Akwaba</p>
        <h1 className="font-titre font-black text-3xl mt-1">Cantine Vatel</h1>
        <p className="mt-2 text-sm opacity-90">Réservez votre repas, retirez-le sans attendre.</p>
      </header>
      <div className="h-1.5 bg-[linear-gradient(90deg,var(--color-marine)_0_40%,var(--color-ciel)_40%_70%,var(--color-action)_70%_88%,var(--color-refus)_88%)]" />
      <section className="p-6">
        <div className="bg-white border border-ligne rounded-xl p-4 max-w-md">
          <p className="font-semibold text-marine">Application en construction</p>
          <p className="text-sm text-encre-douce mt-1">
            Connexion à la base :{' '}
            {etat === 'verification' && 'vérification…'}
            {etat === 'ok' && <span className="text-valide font-semibold">opérationnelle</span>}
            {etat === 'erreur' && <span className="text-refus font-semibold">indisponible</span>}
          </p>
        </div>
      </section>
    </main>
  )
}
