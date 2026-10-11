import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChefHat,
  ClipboardList,
  LayoutGrid,
  LogOut,
  MessageCircle,
  Table2,
} from 'lucide-react'
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

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    // "admin-theme" gives the whole dashboard its own colors (see index.css).
    <div className="admin-theme relative min-h-dvh overflow-x-hidden bg-ink text-cream">

      {/* Soft background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-maroon/25 blur-[150px]" />
        <div className="absolute -right-40 top-1/3 h-[420px] w-[420px] rounded-full bg-sky-500/10 blur-[150px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-line/60 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-maroon-bright to-maroon shadow-lg shadow-maroon/30">
              <ChefHat size={20} className="text-white" />
            </div>

            <div className="leading-tight">
              <p className="font-display text-lg tracking-wide">
                MEET THE CHEFS
              </p>
              <p className="text-[11px] text-cream/45">Staff dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs capitalize text-cream/40 sm:block">
              {today}
            </span>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-xs font-medium text-cream/70 transition hover:border-maroon-bright/60 hover:bg-panel hover:text-cream"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mx-auto max-w-6xl px-4 pb-3">
          <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-line/60 bg-panel/70 p-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="relative shrink-0 rounded-xl px-4 py-2 text-sm font-medium"
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="admin-nav-pill"
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 32,
                        }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-maroon to-maroon-bright shadow-md shadow-maroon/30"
                      />
                    )}

                    <span
                      className={`relative z-10 flex items-center gap-2 transition-colors ${
                        isActive
                          ? 'text-white'
                          : 'text-cream/60 hover:text-cream'
                      }`}
                    >
                      <Icon size={15} /> {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
