import { NavLink, Outlet } from 'react-router-dom'
import { IconTicket, IconToolsKitchen2, IconUser, IconWallet } from '@tabler/icons-react'
import { useLangue } from '../lib/i18n'
import { useMesTickets } from '../lib/donnees'
import { useNotifications } from '../lib/notifications'

// Les mêmes icônes que la maquette (Tabler Icons, contour).
const ONGLETS = [
  { to: '/', label: 'Menu', Icone: IconToolsKitchen2 },
  { to: '/tickets', label: 'Tickets', Icone: IconTicket },
  { to: '/solde', label: 'Solde', Icone: IconWallet },
  { to: '/profil', label: 'Profil', Icone: IconUser },
]

export default function ConviveLayout() {
  const { t } = useLangue()
  const { data: tickets } = useMesTickets()
  useNotifications(tickets)
  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto bg-white">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 max-w-lg mx-auto bg-white border-t border-ligne flex justify-around pb-[env(safe-area-inset-bottom)]">
        {ONGLETS.map(({ to, label, Icone }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={t(label)}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center pt-2 pb-2.5 text-[11px] ${isActive ? 'text-marine font-bold' : 'text-encre-douce'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`mb-1 h-[3px] w-7 rounded ${isActive ? 'bg-ciel' : 'bg-transparent'}`} />
                <Icone size={22} stroke={isActive ? 2 : 1.6} aria-hidden />
                <span className="mt-0.5">{t(label)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
