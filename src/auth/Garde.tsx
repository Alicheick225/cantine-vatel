import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Chargement } from '../components/ui'
import type { Role } from '../lib/types'

/** Page d'accueil selon le rôle (confort d'interface : la vraie protection est dans la base). */
export const accueilDuRole = (role: Role | undefined) => (role === 'admin' ? '/admin' : role === 'parent' ? '/parent' : '/')

export function Garde({ roles }: { roles: Role[] }) {
  const { session, profil, chargement } = useAuth()
  if (chargement) return <Chargement />
  if (!session) return <Navigate to="/connexion" replace />
  if (!profil) return <Chargement texte="Préparation de votre profil…" />
  if (!roles.includes(profil.role)) return <Navigate to={accueilDuRole(profil.role)} replace />
  return <Outlet />
}
