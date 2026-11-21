import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { BandeVatel } from '../components/ui'
import { IconBowlChopsticks, IconCalendarWeek, IconChartLine, IconLayoutDashboard, IconListSearch, IconLogout, IconReportAnalytics, IconScan, IconToolsKitchen2 } from '@tabler/icons-react'

// Les mêmes icônes que la maquette admin (Tabler Icons, contour).
const LIENS = [
  { to: '/admin', label: "Aujourd'hui", Icone: IconLayoutDashboard },
  { to: '/admin/menus', label: 'Menus', Icone: IconCalendarWeek },
  { to: '/admin/plats', label: 'Plats', Icone: IconBowlChopsticks },
  { to: '/admin/prevision', label: 'Prévision', Icone: IconChartLine },
  { to: '/admin/rapports', label: 'Rapports', Icone: IconReportAnalytics },
  { to: '/admin/journal', label: "Journal d'audit", Icone: IconListSearch },
]

export default function AdminLayout() {
  const { profil, deconnexion } = useAuth()
  return (
    <div className="min-h-dvh md:flex">
      <aside className="bg-marine text-white md:w-56 md:min-h-dvh flex md:flex-col print:hidden">
        <BandeVatel className="hidden md:block" />
        <div className="px-4 py-3 md:py-5 flex items-center gap-2">
          <span className="w-8 h-8 rounded bg-white text-marine font-titre font-black flex items-center justify-center">V</span>
          <div className="hidden md:block">
            <p className="font-titre font-black text-sm">Cantine Vatel</p>
            <p className="text-xs opacity-70">Abidjan · gestion</p>
          </div>
        </div>
        <nav className="flex md:flex-col overflow-x-auto flex-1">
          {LIENS.map(({ to, label, Icone }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 whitespace-nowrap px-4 py-2.5 text-sm ${isActive ? 'bg-white/10 font-semibold md:border-l-4 md:border-ciel md:pl-3' : 'text-white/80'}`
              }
            >
              <Icone size={18} stroke={1.7} aria-hidden />
              {label}
            </NavLink>
          ))}
          <Link to="/admin/comptoir" className="m-2 md:m-3 flex items-center gap-2 rounded-xl bg-action text-marine font-bold text-sm px-3 py-2.5 whitespace-nowrap">
            <IconScan size={20} stroke={2} aria-hidden /> Ouvrir le comptoir
          </Link>
          <Link to="/admin/passe" className="mx-2 md:mx-3 mb-2 flex items-center gap-2 rounded-xl border border-white/30 text-white text-sm px-3 py-2 whitespace-nowrap">
            <IconToolsKitchen2 size={18} aria-hidden /> Écran du passe
          </Link>
          <button onClick={deconnexion} className="md:hidden flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm text-white/80">
            <IconLogout size={18} aria-hidden /> Se déconnecter
          </button>
        </nav>
        <div className="hidden md:block px-4 py-4 text-xs border-t border-white/10">
          <p className="font-semibold">{profil?.nom}</p>
          <button onClick={deconnexion} className="mt-1 underline opacity-80">Se déconnecter</button>
        </div>
      </aside>
      <main className="flex-1 bg-fond p-4 md:p-6 min-w-0 print:bg-white print:p-0">
        <Outlet />
      </main>
    </div>
  )
}
