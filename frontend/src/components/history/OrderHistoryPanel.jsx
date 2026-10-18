import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Clock, History, X } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { getOrder } from '../../services/api'
import { FINAL_STATUSES, forgetOrder, readHistory, rememberOrder } from '../../utils/orderHistory'

// How often an order that is still being prepared is checked while the
// history is open (orders that are already Ready / Cancelled are checked once).
const REFRESH_MS = 5000

// What each status looks like. To the customer a "completed" order (closed by
// the staff) is still simply "Ready", like on the progress sheet.
const STATUS_STYLE = {
  preparing: { key: 'order.stage.preparing', Icon: Clock, pill: 'border-amber-400/30 bg-amber-500/15 text-amber-200' },
  almost: { key: 'order.stage.almost', Icon: Clock, pill: 'border-sky-400/30 bg-sky-500/15 text-sky-200' },
  ready: { key: 'order.stage.ready', Icon: Check, pill: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200' },
  completed: { key: 'order.stage.ready', Icon: Check, pill: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200' },
  cancelled: { key: 'history.cancelled', Icon: X, pill: 'border-red-400/30 bg-red-500/15 text-red-200' },
}

// "Today" / "Yesterday" / "Sat, 17 Oct" — orders can be from yesterday (they
// stay for 24 hours) and the order numbers start again every day, so the day
// matters to tell two "#3" apart.
function dayLabel(date, t, locale) {
  const day = new Date(date)
  const now = new Date()
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const daysAgo = Math.round((startOf(now) - startOf(day)) / 86400000)

  if (daysAgo <= 0) return t('history.today')
  if (daysAgo === 1) return t('history.yesterday')
  return day.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function OrderHistoryPanel({ open, onClose }) {
  const { t } = useLanguage()
  const [orders, setOrders] = useState(() => readHistory())

  // While the panel is open: show what the phone remembers straight away, then
  // ask the server for the latest status of each order (a Preparing order may
  // be Ready by now), and keep watching the ones that are still in progress.
  useEffect(() => {
    if (!open) return undefined

    let cancelled = false
    setOrders(readHistory())

    async function refresh(onlyUnfinished) {
      const targets = readHistory().filter(
        (order) => !onlyUnfinished || !FINAL_STATUSES.includes(order.status)
      )

      await Promise.all(
        targets.map(async (order) => {
          try {
            rememberOrder(await getOrder(order.id))
          } catch (error) {
            // The restaurant removed the order (e.g. merged two orders): it no
            // longer exists. Any other problem (no network) keeps the saved copy.
            if (error?.status === 404) forgetOrder(order.id)
          }
        })
      )

      if (!cancelled) setOrders(readHistory())
    }

    refresh(false)
    const timer = setInterval(() => refresh(true), REFRESH_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="order-history"
          role="dialog"
          aria-label={t('history.title')}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-[80] flex flex-col overflow-hidden bg-[#080303] will-change-[transform,opacity]"
        >
          {/* Same single static background as the chat */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(180,20,35,0.32),transparent_42%),radial-gradient(circle_at_0%_55%,rgba(100,10,20,0.26),transparent_46%),radial-gradient(circle_at_90%_100%,rgba(130,15,25,0.2),transparent_44%),linear-gradient(145deg,#120304_0%,#080303_45%,#140305_100%)]" />

          {/* HEADER */}
          <header className="relative z-10 flex items-center gap-3 border-b border-white/10 bg-black/20 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <button
              type="button"
              onClick={onClose}
              aria-label={t('history.close')}
              className="flex h-9 w-9 items-center justify-center rounded-full text-cream/80 transition hover:bg-white/10 hover:text-cream"
            >
              <ArrowLeft size={20} className="rtl:-scale-x-100" />
            </button>

            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-400/25 bg-red-950/50 text-cream">
              <History size={22} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-display text-base tracking-wide text-cream">{t('history.title')}</p>
              <p className="text-[11px] leading-snug text-cream/50">{t('history.sub')}</p>
            </div>
          </header>

          {/* ORDERS */}
          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            {orders.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-cream/40">
                  <History size={28} />
                </span>
                <p className="font-display text-lg text-cream/80">{t('history.empty')}</p>
                <p className="text-sm leading-relaxed text-cream/45">{t('history.emptyHint')}</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {orders.map((order) => (
                  <li key={order.id}>
                    <HistoryCard order={order} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function HistoryCard({ order }) {
  const { t, locale, formatMoney, formatTime, itemName, tableLabel } = useLanguage()
  const status = STATUS_STYLE[order.status] || STATUS_STYLE.preparing
  const StatusIcon = status.Icon

  return (
    <article
      aria-label={t('order.number', { n: order.number })}
      className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-lg"
    >
      {/* Number, table, time — and how the order ended */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="rounded-full border border-cream/15 bg-ink/50 px-2.5 py-1 text-xs font-semibold leading-none text-cream/85">
              <bdi>#{order.number}</bdi>
            </span>
            <span className="truncate text-sm text-cream/70">{tableLabel(order.tableId)}</span>
          </p>
          <p className="mt-1.5 text-xs text-cream/45">
            {dayLabel(order.createdAt, t, locale)} &middot; {formatTime(order.createdAt)}
          </p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.pill}`}
        >
          <StatusIcon size={13} />
          {t(status.key)}
        </span>
      </div>

      {/* Every dish, with what it cost */}
      <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
        {order.items.map((line, index) => (
          <li key={`${line.id ?? line.name}-${index}`} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-cream/90">
                {line.quantity} &times; {itemName(line)}
              </p>
              {line.quantity > 1 && (
                <p className="text-xs text-cream/40">{t('history.each', { price: formatMoney(line.unitPrice) })}</p>
              )}
            </div>
            <span className="shrink-0 text-cream/75">{formatMoney(line.unitPrice * line.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm font-semibold text-cream">
        <span>{t('order.total')}</span>
        <span>{formatMoney(order.total)}</span>
      </div>
    </article>
  )
}
