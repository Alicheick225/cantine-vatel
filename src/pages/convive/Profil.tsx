import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fcfa, messageErreur } from '../../lib/format'
import { useAuth } from '../../auth/AuthProvider'
import type { Allergene, Profil as TProfil } from '../../lib/types'
import { Alerte, BandeVatel, Bouton, Carte, Champ } from '../../components/ui'
import ChoixAllergies from '../../components/ChoixAllergies'

export default function Profil() {
  const { profil } = useAuth()
  const [enregistre, setEnregistre] = useState(false)
  if (!profil) return null
  // La clé recrée le formulaire quand le profil change dans la base (valeurs toujours à jour).
  return (
    <FormulaireProfil
      key={`${profil.nom}|${profil.allergies.join()}|${profil.vegetarien}`}
      profil={profil}
      enregistre={enregistre}
      onEnregistre={setEnregistre}
    />
  )
}

function FormulaireProfil({ profil, enregistre, onEnregistre }: { profil: TProfil; enregistre: boolean; onEnregistre: (v: boolean) => void }) {
  const { deconnexion } = useAuth()
  const qc = useQueryClient()
  const [nom, setNom] = useState(profil.nom)
  const [allergies, setAllergies] = useState<Allergene[]>(profil.allergies)
  const [vegetarien, setVegetarien] = useState(profil.vegetarien)

  const enregistrer = useMutation({
    mutationFn: async () => {
      onEnregistre(false)
      const { error } = await supabase.from('profils').update({ nom: nom.trim(), allergies, vegetarien }).eq('id', profil.id)
      if (error) throw error
    },
    onSuccess: () => {
      onEnregistre(true)
      qc.invalidateQueries({ queryKey: ['profil'] })
    },
  })

  return (
    <div>
      <header className="bg-marine text-white px-5 pt-6 pb-5">
        <h1 className="font-titre font-black text-2xl">Mon profil</h1>
        <p className="text-sm opacity-85">{profil.email} · {profil.categorie === 'personnel' ? 'Personnel' : 'Étudiant(e)'} · solde {fcfa(profil.solde)}</p>
      </header>
      <BandeVatel />
      <div className="p-5 space-y-4">
        <Carte className="space-y-4">
          <Champ label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          <ChoixAllergies valeur={allergies} onChange={setAllergies} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={vegetarien} onChange={(e) => setVegetarien(e.target.checked)} className="size-4 accent-marine" />
            Je suis végétarien(ne)
          </label>
          {enregistrer.isError && <Alerte>{messageErreur(enregistrer.error)}</Alerte>}
          {enregistre && <Alerte type="succes">Profil enregistré.</Alerte>}
          <Bouton className="w-full" disabled={enregistrer.isPending} onClick={() => enregistrer.mutate()}>
            Enregistrer
          </Bouton>
        </Carte>
        <p className="text-xs text-encre-douce">
          Vos allergies sont signalées sur les plats concernés et affichées au comptoir au moment du service.
        </p>
        <Bouton variante="contour" className="w-full" onClick={deconnexion}>Se déconnecter</Bouton>
      </div>
    </div>
  )
}
