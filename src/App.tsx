import { Navigate, Route, Routes } from 'react-router-dom'
import { Garde } from './auth/Garde'
import ConviveLayout from './layouts/ConviveLayout'
import AdminLayout from './layouts/AdminLayout'
import Connexion from './pages/Connexion'
import Inscription from './pages/Inscription'
import Profil from './pages/convive/Profil'
import Menu from './pages/convive/Menu'
import Reserver from './pages/convive/Reserver'
import Tickets from './pages/convive/Tickets'
import Solde from './pages/convive/Solde'
import Bientot from './components/Bientot'
import Aujourdhui from './pages/admin/Aujourdhui'
import Comptoir from './pages/admin/Comptoir'
import Menus from './pages/admin/Menus'
import Plats from './pages/admin/Plats'

export default function App() {
  return (
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

      {/* Administrateur */}
      <Route element={<Garde roles={['admin']} />}>
        <Route path="/admin/comptoir" element={<Comptoir />} />
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Aujourdhui />} />
          <Route path="/admin/menus" element={<Menus />} />
          <Route path="/admin/plats" element={<Plats />} />
          <Route path="/admin/prevision" element={<Bientot titre="Prévision" />} />
          <Route path="/admin/journal" element={<Bientot titre="Journal d'audit" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
