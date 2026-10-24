import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import {
  Armchair,
  BellRing,
  ChartColumn,
  ClipboardList,
  House,
  LogOut,
  MessageSquareMore,
  Utensils,
} from 'lucide-react'
import { useAdminAuth } from './AdminAuthContext'
import { AdminShellProvider, useAdminShell } from './AdminShellContext'
import { useLanguage } from '../i18n/LanguageContext'
import { orderTableLabel } from './components/format'

const NAV_ITEMS = [
  { to: '/admin', labelKey: 'admin.layout.nav.overview', icon: House, end: true },
  { to: '/admin/orders', labelKey: 'admin.layout.nav.orders', icon: ClipboardList, badge: true },
  { to: '/admin/reports', labelKey: 'admin.layout.nav.reports', icon: ChartColumn },
  { to: '/admin/menu', labelKey: 'admin.layout.nav.menu', icon: Utensils },
  { to: '/admin/tables', labelKey: 'admin.layout.nav.tables', icon: Armchair },
  { to: '/admin/chatbot', labelKey: 'admin.layout.nav.chatbot', icon: MessageSquareMore },
]

export default function AdminLayout() {
  const { isAuthed } = useAdminAuth()

  if (!isAuthed) {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <AdminShellProvider>
      <Shell />
    </AdminShellProvider>
  )
}

function Shell() {
  const { logout } = useAdminAuth()
  const { summary, navOpen, setNavOpen } = useAdminShell()
  const { pathname } = useLocation()
  const { t } = useLanguage()

  // Close the slide-over menu after choosing a page (small screens).
  useEffect(() => {
    setNavOpen(false)
  }, [pathname, setNavOpen])

  return (
    // "admin-theme" gives the whole dashboard its own colors (see index.css).
    <div className="admin-theme relative min-h-dvh bg-[#09090b] text-white">

      {/* Dark backdrop behind the slide-over menu (small screens) */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* ------------------------------------------------------------ */}
      {/* SIDEBAR                                                       */}
      {/* ------------------------------------------------------------ */}
      <aside
        className={`fixed inset-y-0 start-0 z-40 flex w-[232px] flex-col overflow-hidden border-e border-[#3a0d11]/70 bg-gradient-to-b from-[#0d0d10] via-[#0b0b0d] to-[#0b0809] transition-transform duration-300 lg:translate-x-0 rtl:lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        }`}
      >
        {/* Red ribbon decoration at the bottom */}
        <svg
          className="pointer-events-none absolute bottom-0 start-0 h-[52%] w-full rtl:-scale-x-100"
          viewBox="0 0 232 420"
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="ribbon-a" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#7a0c12" stopOpacity="0.95" />
              <stop offset="1" stopColor="#d9151f" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="ribbon-b" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#d9151f" stopOpacity="0.55" />
              <stop offset="1" stopColor="#d9151f" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 420 L0 250 C 70 300, 150 230, 232 120 L232 420 Z" fill="url(#ribbon-a)" />
          <path d="M0 330 C 70 360, 160 280, 232 170" stroke="url(#ribbon-b)" strokeWidth="2.5" />
          <path d="M0 360 C 80 385, 170 310, 232 205" stroke="url(#ribbon-b)" strokeWidth="1.5" />
        </svg>

        {/* Brand */}
        <div className="relative flex flex-col items-center px-5 pb-3 pt-5">
          <img src="/logo.png" alt="Meet The Chefs" className="h-[88px] w-auto object-contain" />
          <p className="mt-1 text-[11px] tracking-wide text-white/55">Good Food · Happy People</p>
        </div>

        {/* Navigation */}
        <nav className="relative mt-4 flex flex-col gap-2 px-3">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3.5 rounded-xl px-5 py-3.5 text-[15px] font-medium transition ${
                  isActive
                    ? 'bg-gradient-to-r rtl:bg-gradient-to-l from-[#d9151f] to-[#c4121c] text-white shadow-[0_8px_24px_rgba(217,21,31,0.35)]'
                    : 'text-white/75 hover:bg-white/[0.05] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={21} strokeWidth={1.8} />
                  <span className="flex-1">{t(labelKey)}</span>

                  {badge && summary.pendingCount > 0 && (
                    <span
                      className={`flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                        isActive ? 'bg-white/90 text-[#c4121c]' : 'bg-[#e11d28] text-white'
                      }`}
                    >
                      {summary.pendingCount > 99 ? '99+' : summary.pendingCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="relative mt-auto px-3 pb-6">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3.5 rounded-xl px-5 py-3.5 text-[15px] font-medium text-white/80 transition hover:bg-white/[0.07] hover:text-white"
          >
            <LogOut size={21} strokeWidth={1.8} />
            {t('admin.layout.logout')}
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------ */}
      {/* PAGE                                                          */}
      {/* ------------------------------------------------------------ */}
      <main className="min-h-dvh px-4 pb-10 pt-6 sm:px-6 lg:ms-[232px] lg:px-7 xl:px-8">
        <WaiterAlerts />
        <Outlet />
      </main>
    </div>
  )
}


// Red banners at the top of every page: "Table 3 is calling a waiter".
// They stay until a staff member presses "Answered" (the sound rings once,
// when the call arrives — see AdminShellContext).
function WaiterAlerts() {
  const { summary, resolveWaiterCall } = useAdminShell()
  const { t, lang } = useLanguage()
  const calls = summary.waiterCalls || []

  if (calls.length === 0) return null

  return (
    <div role="alert" className="sticky top-2 z-20 mb-5 space-y-2">
      {calls.map((call) => {
        const minutes = Math.max(0, Math.floor((Date.now() - new Date(call.createdAt).getTime()) / 60000))
        return (
          <div
            key={call.id}
            className="flex items-center gap-3 rounded-2xl border border-[#f0222c]/60 bg-[#2a0709]/95 px-4 py-3 shadow-[0_8px_30px_rgba(217,21,31,0.35)] backdrop-blur"
          >
            <span className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-full bg-[#d9151f] text-white">
              <BellRing size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-white">
                {t('admin.layout.waiter.title', { table: orderTableLabel({ tableId: call.tableId }, lang) })}
              </p>
              <p className="text-xs text-white/55">
                {minutes === 0 ? t('admin.layout.waiter.now') : t('admin.layout.waiter.ago', { n: minutes })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => resolveWaiterCall(call.id)}
              className="shrink-0 rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold text-[#c4121c] transition hover:bg-white"
            >
              {t('admin.layout.waiter.answered')}
            </button>
          </div>
        )
      })}
    </div>
  )
}
