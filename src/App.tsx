import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Garde } from './auth/Garde'
import ConviveLayout from './layouts/ConviveLayout'
import Connexion from './pages/Connexion'
import Inscription from './pages/Inscription'
import Profil from './pages/convive/Profil'
import Menu from './pages/convive/Menu'
import Reserver from './pages/convive/Reserver'
import Tickets from './pages/convive/Tickets'
import Solde from './pages/convive/Solde'
import { EcranChargement } from './components/ui'

// Chargés à la demande : un convive sur téléphone ne télécharge jamais l'admin,
// le lecteur de QR du comptoir ni l'espace parent (réseau mobile lent).
const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const Aujourdhui = lazy(() => import('./pages/admin/Aujourdhui'))
const Comptoir = lazy(() => import('./pages/admin/Comptoir'))
const Menus = lazy(() => import('./pages/admin/Menus'))
const Plats = lazy(() => import('./pages/admin/Plats'))
const Prevision = lazy(() => import('./pages/admin/Prevision'))
const Journal = lazy(() => import('./pages/admin/Journal'))
const Rapports = lazy(() => import('./pages/admin/Rapports'))
const Passe = lazy(() => import('./pages/admin/Passe'))
const Equipe = lazy(() => import('./pages/admin/Equipe'))
const Parent = lazy(() => import('./pages/parent/Parent'))

export default function App() {
  return (
    <Suspense fallback={<EcranChargement />}>
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route path="/inscription" element={<Inscription />} />

      {/* Convive : étudiant ou personnel */}
      <Route element={<Garde roles={['convive']} />}>
        <Route element={<ConviveLayout />}>
          <Route path="/" element={<Menu />} />
          <Route path="/plat/:id" element={<Reserver />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/solde" element={<Solde />} />
          <Route path="/profil" element={<Profil />} />
        </Route>
      </Route>

      {/* Parent */}
      <Route element={<Garde roles={['parent']} />}>
        <Route path="/parent" element={<Parent />} />
      </Route>

      {/* Équipe du comptoir : le super-admin peut tout faire, la scanneuse scanne, la serveuse sert. */}
      <Route element={<Garde roles={['admin', 'scanneur']} />}>
        <Route path="/admin/comptoir" element={<Comptoir />} />
      </Route>
      <Route element={<Garde roles={['admin', 'serveur']} />}>
        <Route path="/admin/passe" element={<Passe />} />
      </Route>

      {/* Administrateur (super-admin) */}
      <Route element={<Garde roles={['admin']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Aujourdhui />} />
          <Route path="/admin/menus" element={<Menus />} />
          <Route path="/admin/plats" element={<Plats />} />
          <Route path="/admin/prevision" element={<Prevision />} />
          <Route path="/admin/journal" element={<Journal />} />
          <Route path="/admin/rapports" element={<Rapports />} />
          <Route path="/admin/equipe" element={<Equipe />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
