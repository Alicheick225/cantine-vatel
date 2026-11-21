import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { BandeVatel } from '../components/ui'

const LIENS = [
  { to: '/admin', label: "Aujourd'hui" },
  { to: '/admin/menus', label: 'Menus' },
  { to: '/admin/plats', label: 'Plats' },
  { to: '/admin/prevision', label: 'Prévision' },
  { to: '/admin/journal', label: "Journal d'audit" },
]

export default function AdminLayout() {
  const { profil, deconnexion } = useAuth()
  return (
    <div className="min-h-dvh md:flex">
      <aside className="bg-marine text-white md:w-56 md:min-h-dvh flex md:flex-col">
        <BandeVatel className="hidden md:block" />
        <div className="px-4 py-3 md:py-5 flex items-center gap-2">
          <span className="w-8 h-8 rounded bg-white text-marine font-titre font-black flex items-center justify-center">V</span>
          <div className="hidden md:block">
            <p className="font-titre font-black text-sm">Cantine Vatel</p>
            <p className="text-xs opacity-70">Abidjan · gestion</p>
          </div>
        </div>
        <nav className="flex md:flex-col overflow-x-auto flex-1">
          {LIENS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/admin'}
              className={({ isActive }) =>
                `whitespace-nowrap px-4 py-2.5 text-sm ${isActive ? 'bg-white/10 font-semibold md:border-l-4 md:border-ciel' : 'text-white/80'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <Link to="/admin/comptoir" className="m-2 md:m-3 rounded-xl bg-action text-marine font-bold text-sm px-3 py-2.5 whitespace-nowrap">
            Ouvrir le comptoir
          </Link>
        </nav>
        <div className="hidden md:block px-4 py-4 text-xs border-t border-white/10">
          <p className="font-semibold">{profil?.nom}</p>
          <button onClick={deconnexion} className="mt-1 underline opacity-80">Se déconnecter</button>
        </div>
      </aside>
      <main className="flex-1 bg-fond p-4 md:p-6 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
