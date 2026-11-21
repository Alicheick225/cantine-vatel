import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { messageErreur } from '../lib/format'
import { useAuth } from '../auth/AuthProvider'
import { accueilDuRole } from '../auth/Garde'
import { Alerte, BandeVatel, Bouton, Champ } from '../components/ui'
import { ChoixLangue, useLangue } from '../lib/i18n'
import { Logo } from '../components/Logo'
import GuideInstallation from '../components/GuideInstallation'
import { IconLeaf, IconQrcode, IconToolsKitchen2 } from '@tabler/icons-react'

/**
 * Mise en page des pages publiques (connexion, inscription).
 * Téléphone : bandeau marine puis formulaire. Ordinateur : écran partagé, présentation à gauche, formulaire centré à droite.
 */
export function PagePublique({ children }: { children: ReactNode }) {
  const { t } = useLangue()
  const atouts = [
    { Icone: IconToolsKitchen2, texte: t('Le menu de la semaine, réservé en quelques secondes') },
    { Icone: IconQrcode, texte: t('Un ticket QR : vous retirez votre plat sans attendre') },
    { Icone: IconLeaf, texte: t('Moins de file, moins de gaspillage') },
  ]
  return (
    <div className="min-h-dvh bg-white md:grid md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.3fr_1fr]">
      <aside className="relative bg-marine text-white md:min-h-dvh">
        <BandeVatel className="hidden md:block absolute top-0 inset-x-0" />
        <div className="px-6 pt-8 pb-7 md:px-12 md:py-14 md:h-full md:flex md:flex-col md:justify-between lg:px-20">
          <div className="flex justify-between items-center">
            <Logo taille={48} className="ring-1 ring-white/20 rounded-[14px]" />
            <ChoixLangue />
          </div>
          <div>
            <h1 className="font-titre font-black text-3xl md:text-5xl mt-4 md:mt-0">Cantine Vatel</h1>
            <p className="mt-2 text-sm md:text-lg opacity-90 max-w-md">{t('Réservez votre repas, retirez-le sans attendre.')}</p>
            <ul className="hidden md:block mt-10 space-y-4">
              {atouts.map(({ Icone, texte }) => (
                <li key={texte} className="flex items-center gap-3">
                  <span className="rounded-xl bg-white/10 p-2"><Icone size={22} aria-hidden /></span>
                  <span className="opacity-95">{texte}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="hidden md:block text-xs opacity-60">Vatel Abidjan</p>
        </div>
      </aside>
      <BandeVatel className="md:hidden" />
      <main className="md:flex md:items-center md:justify-center md:py-10 md:overflow-y-auto">
        <div className="w-full max-w-md mx-auto px-6 py-6 space-y-6">
          {children}
          <GuideInstallation />
        </div>
      </main>
    </div>
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
    <PagePublique>
      <form onSubmit={soumettre} className="space-y-4">
        <h2 className="font-titre font-black text-xl text-marine">{t('Connexion')}</h2>
        <Champ label={t('Email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Champ label={t('Mot de passe')} type="password" autoComplete="current-password" required value={mdp} onChange={(e) => setMdp(e.target.value)} />
        {erreur && <Alerte>{t(erreur)}</Alerte>}
        <Bouton type="submit" className="w-full" disabled={envoi}>{envoi ? t('Connexion…') : t('Se connecter')}</Bouton>
        <p className="text-sm text-center text-encre-douce">
          {t('Pas encore de compte ?')} <Link to="/inscription" className="text-marine font-semibold underline">{t('Créer un compte')}</Link>
        </p>
      </form>
    </PagePublique>
  )
}
