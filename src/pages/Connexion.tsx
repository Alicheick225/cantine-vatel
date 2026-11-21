import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { messageErreur } from '../lib/format'
import { useAuth } from '../auth/AuthProvider'
import { accueilDuRole } from '../auth/Garde'
import { Alerte, BandeVatel, Bouton, Champ } from '../components/ui'
import { ChoixLangue, useLangue } from '../lib/i18n'

export function EnTetePublic() {
  const { t } = useLangue()
  return (
    <>
      <header className="bg-marine text-white px-6 pt-10 pb-8">
        <div className="flex justify-between items-center"><p className="text-sm opacity-80">{t('Akwaba')}</p><ChoixLangue /></div>
        <h1 className="font-titre font-black text-3xl mt-1">Cantine Vatel</h1>
        <p className="mt-2 text-sm opacity-90">{t('Réservez votre repas, retirez-le sans attendre.')}</p>
      </header>
      <BandeVatel />
    </>
  )
}

export default function Connexion() {
  const { session, profil } = useAuth()
  const { t } = useLangue()
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  if (session && profil) return <Navigate to={accueilDuRole(profil.role)} replace />

  const soumettre = async (e: FormEvent) => {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: mdp })
    setEnvoi(false)
    if (error) setErreur(messageErreur(error))
  }

  return (
    <div className="min-h-dvh max-w-lg mx-auto bg-white">
      <EnTetePublic />
      <form onSubmit={soumettre} className="p-6 space-y-4">
        <h2 className="font-titre font-black text-xl text-marine">{t('Connexion')}</h2>
        <Champ label={t('Email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Champ label={t('Mot de passe')} type="password" autoComplete="current-password" required value={mdp} onChange={(e) => setMdp(e.target.value)} />
        {erreur && <Alerte>{t(erreur)}</Alerte>}
        <Bouton type="submit" className="w-full" disabled={envoi}>{envoi ? t('Connexion…') : t('Se connecter')}</Bouton>
        <p className="text-sm text-center text-encre-douce">
          {t('Pas encore de compte ?')} <Link to="/inscription" className="text-marine font-semibold underline">{t('Créer un compte')}</Link>
        </p>
      </form>
    </div>
  )
}
