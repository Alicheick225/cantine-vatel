import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fcfa, messageErreur } from '../../lib/format'
import { LIBELLE_ALLERGENE, type Allergene } from '../../lib/types'
import { Alerte, Bouton, Carte, Champ, Chargement } from '../../components/ui'
import { Photo } from '../../components/Plat'
import ChoixAllergies from '../../components/ChoixAllergies'
import { envoyerPhotoPlat } from '../../lib/photos'
import { IconPencil, IconPhotoUp } from '@tabler/icons-react'

interface Plat {
  id: number
  nom: string
  description: string | null
  prix: number
  type: 'plat' | 'accompagnement' | 'boisson' | 'dessert'
  allergenes: Allergene[]
  vegetarien: boolean
  photo_url: string | null
  actif: boolean
}
const TYPES = { plat: 'Plat', accompagnement: 'Accompagnement', boisson: 'Boisson', dessert: 'Dessert' } as const

export function usePlats() {
  return useQuery({
    queryKey: ['plats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plats').select('*').order('actif', { ascending: false }).order('type').order('nom')
      if (error) throw error
      return data as Plat[]
    },
  })
}

/**
 * Création d'un plat, ou modification d'un plat existant (nom, description, prix, type, allergènes, végétarien).
 * Un plat n'est jamais supprimé ; chaque modification est horodatée et inscrite au journal d'audit par la base.
 */
function FormulairePlat({ plat, onFini }: { plat?: Plat; onFini?: () => void }) {
  const qc = useQueryClient()
  const ref = useRef<HTMLDivElement>(null)
  const [nom, setNom] = useState(plat?.nom ?? '')
  const [description, setDescription] = useState(plat?.description ?? '')
  const [prix, setPrix] = useState(plat ? String(plat.prix) : '')
  const [type, setType] = useState<Plat['type']>(plat?.type ?? 'plat')
  const [allergenes, setAllergenes] = useState<Allergene[]>(plat?.allergenes ?? [])
  const [vegetarien, setVegetarien] = useState(plat?.vegetarien ?? false)
  useEffect(() => { if (plat) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [plat])
  const enregistrer = useMutation({
    mutationFn: async () => {
      const champs = { nom: nom.trim(), description: description.trim() || null, prix: Number(prix), type, allergenes, vegetarien }
      const { error } = plat
        ? await supabase.from('plats').update(champs).eq('id', plat.id)
        : await supabase.from('plats').insert(champs)
      if (error) throw error
    },
    onSuccess: () => {
      if (!plat) { setNom(''); setDescription(''); setPrix(''); setAllergenes([]); setVegetarien(false) }
      qc.invalidateQueries()
      onFini?.()
    },
  })
  const soumettre = (e: FormEvent) => { e.preventDefault(); enregistrer.mutate() }
  return (
    <div ref={ref} className="scroll-mt-4">
    <Carte className={plat ? 'ring-2 ring-ciel' : ''}>
      <form onSubmit={soumettre} className="space-y-3">
        <h2 className="font-bold text-marine">{plat ? `Modifier « ${plat.nom} »` : 'Nouveau plat'}</h2>
        <div className="grid sm:grid-cols-[2fr_1fr_1fr] gap-3">
          <Champ label="Nom" required minLength={2} value={nom} onChange={(e) => setNom(e.target.value)} />
          <Champ label="Prix (F CFA)" required type="number" min={50} step={50} value={prix} onChange={(e) => setPrix(e.target.value)} />
          <label className="block">
            <span className="text-sm font-semibold text-marine">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as Plat['type'])} className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2.5">
              {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <Champ label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <ChoixAllergies valeur={allergenes} onChange={setAllergenes} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={vegetarien} onChange={(e) => setVegetarien(e.target.checked)} className="size-4 accent-marine" /> Végétarien
        </label>
        {enregistrer.isError && <Alerte>{messageErreur(enregistrer.error)}</Alerte>}
        {!plat && enregistrer.isSuccess && <Alerte type="succes">Plat ajouté.</Alerte>}
        {plat && (allergenes.join() !== plat.allergenes.join()) && (
          <Alerte type="info">Les allergènes changent : les convives allergiques seront alertés dès le prochain affichage du menu.</Alerte>
        )}
        <div className="flex gap-2">
          <Bouton type="submit" disabled={enregistrer.isPending}>{plat ? 'Enregistrer les modifications' : 'Ajouter le plat'}</Bouton>
          {plat && <button type="button" onClick={onFini} className="px-4 text-sm underline text-encre-douce">Annuler</button>}
        </div>
      </form>
    </Carte>
    </div>
  )
}

export default function Plats() {
  const qc = useQueryClient()
  const { data: plats, isLoading } = usePlats()
  const [enEdition, setEnEdition] = useState<Plat | null>(null)
  const modifier = useMutation({
    mutationFn: async (m: { id: number; champs: Partial<Plat> }) => {
      const { error } = await supabase.from('plats').update(m.champs).eq('id', m.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })
  const photo = useMutation({
    mutationFn: async ({ id, fichier }: { id: number; fichier: File }) => {
      const url = await envoyerPhotoPlat(id, fichier)
      const { error } = await supabase.from('plats').update({ photo_url: url }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="font-titre font-black text-2xl text-marine">Plats</h1>
      <p className="text-sm text-encre-douce">Un plat n'est jamais supprimé : on le modifie ou on le désactive, pour garder l'historique des réservations et des notes. Touchez une photo pour la changer (elle est réduite automatiquement).</p>
      {modifier.isError && <Alerte>{messageErreur(modifier.error)}</Alerte>}
      {photo.isError && <Alerte>{messageErreur(photo.error)}</Alerte>}
      {photo.isPending && <Alerte type="info">Envoi de la photo…</Alerte>}
      {isLoading && <Chargement />}
      {enEdition && <FormulairePlat key={enEdition.id} plat={enEdition} onFini={() => setEnEdition(null)} />}
      <Carte className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-encre-douce border-b border-ligne">
            <tr><th className="p-3">Plat</th><th className="p-3">Type</th><th className="p-3">Allergènes</th><th className="p-3">Prix</th><th className="p-3">Statut</th><th className="p-3"><span className="sr-only">Modifier</span></th></tr>
          </thead>
          <tbody className="divide-y divide-ligne">
            {plats?.map((p) => (
              <tr key={p.id} className={p.actif ? '' : 'opacity-50'}>
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <label className="relative cursor-pointer shrink-0" title="Changer la photo">
                      <Photo url={p.photo_url} nom={p.nom} className="w-11 h-11 rounded-lg" />
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-marine text-white p-0.5"><IconPhotoUp size={12} aria-hidden /></span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Changer la photo de ${p.nom}`}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) photo.mutate({ id: p.id, fichier: f }); e.target.value = '' }} />
                    </label>
                    <div>
                      <b>{p.nom}</b>{p.vegetarien && <span className="ml-1.5 rounded-full bg-valide-clair text-valide text-xs px-2">Végétarien</span>}
                      <p className="text-xs text-encre-douce">{p.description}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">{TYPES[p.type]}</td>
                <td className="p-3 text-xs">{p.allergenes.map((a) => LIBELLE_ALLERGENE[a]).join(', ') || '—'}</td>
                <td className="p-3">
                  <input
                    type="number" min={50} step={50} defaultValue={p.prix} aria-label={`Prix de ${p.nom}`}
                    onBlur={(e) => Number(e.target.value) !== p.prix && Number(e.target.value) > 0 && modifier.mutate({ id: p.id, champs: { prix: Number(e.target.value) } })}
                    className="w-24 rounded-lg border border-ligne px-2 py-1 font-mono"
                  />
                  <span className="sr-only">{fcfa(p.prix)}</span>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => modifier.mutate({ id: p.id, champs: { actif: !p.actif } })}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${p.actif ? 'bg-valide-clair text-valide' : 'bg-fond text-encre-douce'}`}
                  >
                    {p.actif ? 'Actif' : 'Désactivé'}
                  </button>
                </td>
                <td className="p-3">
                  <button onClick={() => setEnEdition(p)} className="inline-flex items-center gap-1 rounded-lg border border-ligne px-2.5 py-1 text-xs font-semibold text-marine hover:bg-ciel-clair">
                    <IconPencil size={14} aria-hidden /> Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>
      <FormulairePlat />
    </div>
  )
}
