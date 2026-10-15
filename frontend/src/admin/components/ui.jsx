import { useEffect, useRef, useState } from 'react'
import { Bell, Calendar, ChevronDown, Globe, Menu as MenuIcon } from 'lucide-react'
import { useAdminShell } from '../AdminShellContext'
import { useLanguage } from '../../i18n/LanguageContext'
import { STATUS_META, clockTime, itemsSummary, orderTableLabel } from './format'

// A clock that ticks every few seconds ("14:32", 24-hour like the design).
export function useClock() {
  const { locale } = useLanguage()
  const read = () =>
    new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

  const [time, setTime] = useState(read)

  useEffect(() => {
    setTime(read())
    const timer = setInterval(() => setTime(read()), 5000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  return time
}

// Closes a popup when the user clicks anywhere else.
export function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return

    function handle(event) {
      if (ref.current && !ref.current.contains(event.target)) onOutside()
    }

    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [ref, onOutside, active])
}

/* ---------------------------------------------------------------------- */
/* Cards                                                                  */
/* ---------------------------------------------------------------------- */

export function Card({ className = '', children, ...rest }) {
  return (
    <section
      className={`rounded-2xl border border-white/[0.07] bg-[#0f0f12] ${className}`}
      {...rest}
    >
      {children}
    </section>
  )
}

export function CardTitle({ icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <span className="text-[#f0222c]">{icon}</span>}
        <div>
          <h2 className="text-[17px] font-semibold leading-tight text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

const TONES = {
  red: 'bg-gradient-to-br from-[#f0222c] to-[#b80f19] shadow-[0_6px_18px_rgba(217,21,31,0.35)]',
  green: 'bg-gradient-to-br from-[#12c27a] to-[#0a9460] shadow-[0_6px_18px_rgba(18,194,122,0.28)]',
  blue: 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] shadow-[0_6px_18px_rgba(59,130,246,0.28)]',
  purple: 'bg-gradient-to-br from-[#7c4dff] to-[#5527d9] shadow-[0_6px_18px_rgba(124,77,255,0.3)]',
  orange: 'bg-gradient-to-br from-[#ffa726] to-[#f57c00] shadow-[0_6px_18px_rgba(255,167,38,0.28)]',
  gray: 'bg-gradient-to-br from-[#4a4b52] to-[#34353a]',
}

export function IconTile({ tone = 'red', children, className = '' }) {
  return (
    <span
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

// Long amounts (59,400,000 DH) shrink instead of being cut off.
function bigNumberSize(value) {
  const length = typeof value === 'string' || typeof value === 'number' ? String(value).length : 0
  if (length > 16) return 'text-[16px]'
  if (length > 12) return 'text-[20px]'
  if (length > 9) return 'text-[24px]'
  return 'text-[30px]'
}

// The big number cards across the top of every page.
//   delta: a number (percent, shown green/red with an arrow) or null
export function StatCard({ icon, tone, label, value, delta, sub, children }) {
  return (
    <Card className="relative overflow-hidden px-5 py-5">
      <div className="pointer-events-none absolute -start-8 -top-8 h-28 w-28 rounded-full bg-[#d9151f]/[0.07] blur-2xl" />
      <div className="relative flex items-center gap-4">
        <IconTile tone={tone}>{icon}</IconTile>

        <div className="min-w-0">
          <p className="text-[13px] text-white/70">{label}</p>
          <p className={`mt-0.5 break-words font-bold leading-tight text-white ${bigNumberSize(value)}`}>{value}</p>

          {delta !== undefined && delta !== null && (
            <p
              className={`mt-0.5 text-[13px] font-medium ${
                delta >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              <span dir="ltr" className="inline-block">
                {delta >= 0 ? '↑' : '↓'} {delta >= 0 ? '+' : ''}
                {delta}%
              </span>
            </p>
          )}

          {sub && <p className="text-[13px] text-white/50">{sub}</p>}
          {children}
        </div>
      </div>
    </Card>
  )
}

/* ---------------------------------------------------------------------- */
/* Small pieces                                                           */
/* ---------------------------------------------------------------------- */

export function StatusBadge({ status, className = '' }) {
  const { t } = useLanguage()
  const meta = STATUS_META[status] || STATUS_META.completed
  return (
    <span
      className={`inline-flex min-w-[88px] items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${meta.pill} ${className}`}
    >
      {t(meta.labelKey)}
    </span>
  )
}

export function TablePill({ tableId }) {
  const { tableLabel } = useLanguage()
  const isHome = String(tableId) === 'home'
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium text-white ${
        isHome ? 'bg-[#8a4b0f]' : 'bg-[#5a0b10]'
      }`}
    >
      {tableLabel(tableId)}
    </span>
  )
}

export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-[#f0222c] ${className}`}
    />
  )
}

export function ErrorBanner({ message, onClose }) {
  const { t } = useLanguage()
  if (!message) return null
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
      <span>{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label={t('admin.ui.close')} className="text-red-300/70 hover:text-red-200">
          ✕
        </button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* Dropdown (the "Today", "All Status", "All Categories" pills)           */
/* ---------------------------------------------------------------------- */

export function Dropdown({ value, options, onChange, icon, className = '', align = 'right', ariaLabel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  const current = options.find((option) => option.value === value) || options[0]

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-white/[0.09] bg-[#121215] px-4 text-sm font-medium text-white/90 transition hover:border-white/20"
      >
        {icon}
        <span className="flex-1 whitespace-nowrap text-start">{current.label}</span>
        <ChevronDown size={15} className={`text-white/50 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute top-full z-40 mt-2 min-w-full overflow-hidden rounded-xl border border-white/10 bg-[#141417] py-1 shadow-2xl shadow-black/60 ${
            align === 'right' ? 'end-0' : 'start-0'
          }`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`block w-full whitespace-nowrap px-4 py-2 text-start text-sm transition hover:bg-white/[0.06] ${
                option.value === value ? 'text-[#ff4650]' : 'text-white/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* Top bar: title on the left, date picker + clock + bell on the right    */
/* ---------------------------------------------------------------------- */

export function PageTop({ icon, title, subtitle, range, onRange, showBell = true, children }) {
  const clock = useClock()
  const { setNavOpen } = useAdminShell()
  const { t, lang, setLang, languages } = useLanguage()

  const rangeOptions = [
    { value: 'today', label: t('admin.common.today') },
    { value: 'yesterday', label: t('admin.common.yesterday') },
  ]
  const languageOptions = languages.map((language) => ({ value: language.code, label: language.name }))

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label={t('admin.ui.openMenu')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/70 lg:hidden"
        >
          <MenuIcon size={19} />
        </button>

        {icon && <span className="hidden text-white sm:block">{icon}</span>}

        <div className="min-w-0">
          <h1 className="text-[32px] font-bold leading-none tracking-tight text-white">{title}</h1>
          <p className="mt-2 truncate text-sm text-white/65">{subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {children}

        {showBell && <Bell_ />}

        {onRange && (
          <Dropdown
            value={range}
            onChange={onRange}
            options={rangeOptions}
            icon={<Calendar size={17} className="text-white/80" />}
            className="hidden sm:block"
          />
        )}

        <Dropdown
          value={lang}
          onChange={setLang}
          options={languageOptions}
          icon={<Globe size={17} className="text-white/80" />}
          className="shrink-0"
          ariaLabel={t('admin.ui.language')}
        />

        <span className="hidden text-[17px] font-medium tabular-nums text-white md:block">{clock}</span>
      </div>
    </div>
  )
}

// The notification bell: a red dot while orders are waiting, and a list of
// them when clicked.
function Bell_() {
  const { summary } = useAdminShell()
  const { t, lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('admin.ui.notifications')}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl text-white/85 transition hover:bg-white/[0.06]"
      >
        <Bell size={21} />
        {summary.pendingCount > 0 && (
          <span className="absolute end-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[#f0222c] ring-2 ring-[#09090b]" />
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#141417] shadow-2xl shadow-black/60">
          <p className="border-b border-white/[0.07] px-4 py-3 text-sm font-semibold text-white">
            {summary.pendingCount > 0
              ? t('admin.ui.ordersWaiting', { count: summary.pendingCount })
              : t('admin.ui.noOrdersWaiting')}
          </p>

          <div className="max-h-72 overflow-y-auto">
            {summary.pending.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-white/40">{t('admin.ui.allCaughtUp')}</p>
            ) : (
              summary.pending.map((order) => (
                <div key={order.id} className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      #{order.id} · {orderTableLabel(order, lang)}
                    </p>
                    <p className="truncate text-xs text-white/45">{itemsSummary(order, 2, lang)}</p>
                  </div>
                  <span className="text-xs text-white/40">{clockTime(order.createdAt, lang)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* Modal                                                                  */
/* ---------------------------------------------------------------------- */

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  const { t } = useLanguage()
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`fade-up max-h-[90dvh] w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#101013] shadow-2xl shadow-black/70 ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('admin.ui.close')}
            className="rounded-lg px-2 py-1 text-white/50 transition hover:bg-white/[0.07] hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/55">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-white/30">{hint}</span>}
    </label>
  )
}

export function PrimaryButton({ className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#d9151f] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(217,21,31,0.3)] transition hover:bg-[#f0222c] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function GhostButton({ className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------------- */
/* The two photo cards with handwritten text                              */
/* ---------------------------------------------------------------------- */

export function VibesCard({ className = '' }) {
  const { t } = useLanguage()
  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/menu/pizza/pizza6.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br rtl:bg-gradient-to-bl from-black/85 via-black/70 to-[#3a0a0d]/70" />
      <div className="absolute -end-6 top-4 h-28 w-28 rounded-full bg-amber-400/20 blur-2xl" />

      <div className="relative flex h-full flex-col p-6">
        <span className="text-xl text-amber-400">♛</span>
        <h3 className="mt-2 text-[22px] font-bold leading-snug text-white">{t('admin.ui.vibesTitle')}</h3>
        <p className="mt-2 max-w-[200px] text-sm leading-relaxed text-white/60">
          {t('admin.ui.vibesText')}
        </p>
        <svg viewBox="0 0 120 12" className="mt-2 w-24 text-[#f0222c] rtl:-scale-x-100" fill="none">
          <path d="M2 8 C 30 2, 60 11, 118 3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>

        <p className="font-script mt-auto pt-4 text-end text-2xl leading-tight text-white/90">
          Good Food
          <br />
          Happy People
        </p>
      </div>
    </Card>
  )
}

export function GoodFoodCard({ className = '' }) {
  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/menu/pizza/pizza7.jpg')" }}
      />
      <div className="absolute inset-0 rtl:bg-gradient-to-l bg-gradient-to-r from-black/90 via-black/65 to-[#3a0a0d]/40" />

      <div className="relative flex h-full flex-col justify-center px-7 py-6">
        <p className="font-script text-3xl leading-tight text-white">
          Good Food
          <br />
          Happy People
        </p>
        <svg viewBox="0 0 120 12" className="mt-1 w-24 text-[#f0222c] rtl:-scale-x-100" fill="none">
          <path d="M2 8 C 30 2, 60 11, 118 3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    </Card>
  )
}
