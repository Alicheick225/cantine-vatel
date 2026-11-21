export type Role = 'convive' | 'admin' | 'parent' | 'scanneur' | 'serveur'
export type Categorie = 'etudiant' | 'personnel'

export const ALLERGENES = ['arachide', 'gluten', 'lait', 'oeuf', 'poisson', 'crustaces', 'soja', 'sesame'] as const
export type Allergene = (typeof ALLERGENES)[number]
export const LIBELLE_ALLERGENE: Record<Allergene, string> = {
  arachide: 'Arachide', gluten: 'Gluten', lait: 'Lait', oeuf: 'Œuf',
  poisson: 'Poisson', crustaces: 'Crustacés', soja: 'Soja', sesame: 'Sésame',
}

export interface Profil {
  id: string
  nom: string
  email: string | null
  role: Role
  categorie: Categorie | null
  allergies: Allergene[]
  vegetarien: boolean
  solde: number
}

export interface PlatMenu {
  menu_jour_id: number
  jour: string
  plat_id: number
  nom: string
  description: string | null
  prix: number
  type: 'plat' | 'accompagnement' | 'boisson' | 'dessert'
  allergenes: Allergene[]
  vegetarien: boolean
  photo_url: string | null
  portions_prevues: number
  reservees: number
  restantes: number
  note_moyenne: number | null
  nb_notes: number
  prix_offre: number | null
  fin_offre: string | null
  offre_active: boolean
  reservable: boolean
}

export interface Creneau {
  creneau_id: number
  heure_debut: string
  capacite: number
  reservees: number
  restantes: number
  passe: boolean
}
