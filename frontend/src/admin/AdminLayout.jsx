import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { ChefHat, ClipboardList, LayoutGrid, LogOut, MessageCircle, Table2 } from 'lucide-react'
import { useAdminAuth } from './AdminAuthContext'

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/menu', label: 'Menu', icon: ChefHat },
  { to: '/admin/tables', label: 'Tables', icon: Table2 },
  { to: '/admin/chatbot', label: 'Chatbot', icon: MessageCircle },
]

export default function AdminLayout() {
  const { isAuthed, logout } = useAdminAuth()

  if (!isAuthed) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div className="min-h-dvh bg-ink text-cream">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <p className="font-display text-lg tracking-wide">MEET THE CHEFS <span className="text-cream/40">/ staff</span></p>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-cream/70 transition hover:bg-panel"
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-maroon text-cream' : 'text-cream/60 hover:bg-panel hover:text-cream'
                }`
              }
            >
              <Icon size={15} /> {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
