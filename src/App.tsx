import { Navigate, Route, Routes } from 'react-router-dom'
import { Garde } from './auth/Garde'
import ConviveLayout from './layouts/ConviveLayout'
import AdminLayout from './layouts/AdminLayout'
import Connexion from './pages/Connexion'
import Inscription from './pages/Inscription'
import Profil from './pages/convive/Profil'
import Bientot from './components/Bientot'

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route path="/inscription" element={<Inscription />} />

      {/* Convive : étudiant ou personnel */}
      <Route element={<Garde roles={['convive']} />}>
        <Route element={<ConviveLayout />}>
          <Route path="/" element={<Bientot titre="On mange quoi ?" />} />
          <Route path="/tickets" element={<Bientot titre="Mes tickets" />} />
          <Route path="/solde" element={<Bientot titre="Mon solde" />} />
          <Route path="/profil" element={<Profil />} />
        </Route>
      </Route>

      {/* Administrateur */}
      <Route element={<Garde roles={['admin']} />}>
        <Route path="/admin/comptoir" element={<Bientot titre="Comptoir" />} />
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Bientot titre="Aujourd'hui" />} />
          <Route path="/admin/menus" element={<Bientot titre="Menus" />} />
          <Route path="/admin/plats" element={<Bientot titre="Plats" />} />
          <Route path="/admin/prevision" element={<Bientot titre="Prévision" />} />
          <Route path="/admin/journal" element={<Bientot titre="Journal d'audit" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
