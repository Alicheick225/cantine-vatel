import { NavLink, Outlet } from 'react-router-dom'

const ONGLETS = [
  { to: '/', label: 'Menu', icone: '🍽' },
  { to: '/tickets', label: 'Tickets', icone: '🎟' },
  { to: '/solde', label: 'Solde', icone: '💳' },
  { to: '/profil', label: 'Profil', icone: '👤' },
]

export default function ConviveLayout() {
  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto bg-white shadow-sm">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 max-w-lg mx-auto bg-white border-t border-ligne flex justify-around pb-[env(safe-area-inset-bottom)]">
        {ONGLETS.map((o) => (
          <NavLink
            key={o.to}
            to={o.to}
            end={o.to === '/'}
            className={({ isActive }) =>
              `flex-1 text-center pt-2 pb-2.5 text-xs ${isActive ? 'text-marine font-bold' : 'text-encre-douce'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`block mx-auto mb-1 h-[3px] w-7 rounded ${isActive ? 'bg-ciel' : 'bg-transparent'}`} />
                <span aria-hidden className="block text-lg leading-none">{o.icone}</span>
                {o.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
