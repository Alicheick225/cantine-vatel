import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { messageErreur } from '../lib/format'
import type { Allergene, Categorie } from '../lib/types'
import { Alerte, Bouton, Champ } from '../components/ui'
import ChoixAllergies from '../components/ChoixAllergies'
import { EnTetePublic } from './Connexion'
import { useLangue } from '../lib/i18n'

export default function Inscription() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useLangue()
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [categorie, setCategorie] = useState<Categorie | 'parent'>('etudiant')
  const [allergies, setAllergies] = useState<Allergene[]>([])
  const [vegetarien, setVegetarien] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const soumettre = async (e: FormEvent) => {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    // Le rôle n'est jamais envoyé : la base attribue toujours « convive ».
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: mdp,
      options: { data: categorie === 'parent' ? { nom: nom.trim(), role: 'parent' } : { nom: nom.trim(), categorie } },
    })
    if (!error && data.user && categorie !== 'parent' && (allergies.length || vegetarien)) {
      await supabase.from('profils').update({ allergies, vegetarien }).eq('id', data.user.id)
      qc.invalidateQueries({ queryKey: ['profil'] })
    }
    setEnvoi(false)
    if (error) return setErreur(messageErreur(error))
    navigate(categorie === 'parent' ? '/parent' : '/', { replace: true })
  }

  return (
    <div className="min-h-dvh max-w-lg mx-auto bg-white">
      <EnTetePublic />
      <form onSubmit={soumettre} className="p-6 space-y-4">
        <h2 className="font-titre font-black text-xl text-marine">{t('Créer un compte')}</h2>
        <Champ label={t('Nom complet')} required minLength={2} maxLength={80} value={nom} onChange={(e) => setNom(e.target.value)} />
        <Champ label={t('Email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Champ label={t('Mot de passe (6 caractères minimum)')} type="password" autoComplete="new-password" required minLength={6} value={mdp} onChange={(e) => setMdp(e.target.value)} />
        <fieldset>
          <legend className="text-sm font-semibold text-marine">{t('Vous êtes')}</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(['etudiant', 'personnel', 'parent'] as const).map((c) => (
              <button
                type="button"
                key={c}
                aria-pressed={categorie === c}
                onClick={() => setCategorie(c)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${categorie === c ? 'bg-ciel-clair border-ciel text-marine' : 'bg-white border-ligne text-encre-douce'}`}
              >
                {t(c === 'etudiant' ? 'Étudiant(e)' : c === 'personnel' ? 'Personnel' : "Parent d'élève")}
              </button>
            ))}
          </div>
        </fieldset>
        {categorie === 'parent' ? (
          <p className="text-xs text-encre-douce">{t('Après inscription, saisissez le code de liaison que votre enfant génère depuis son profil.')}</p>
        ) : (
          <>
            <ChoixAllergies valeur={allergies} onChange={setAllergies} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={vegetarien} onChange={(e) => setVegetarien(e.target.checked)} className="size-4 accent-marine" />
              {t('Je suis végétarien(ne)')}
            </label>
          </>
        )}
        {erreur && <Alerte>{t(erreur)}</Alerte>}
        <Bouton type="submit" className="w-full" disabled={envoi}>{envoi ? t('Création…') : t('Créer mon compte')}</Bouton>
        <p className="text-sm text-center text-encre-douce">
          {t('Déjà inscrit(e) ?')} <Link to="/connexion" className="text-marine font-semibold underline">{t('Se connecter')}</Link>
        </p>
      </form>
    </div>
  )
}
