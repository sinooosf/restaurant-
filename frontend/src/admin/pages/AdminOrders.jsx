import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Ban,
  Check,
  ChevronRight,
  Clock3,
  PackageCheck,
  RefreshCw,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import {
  adminFetchOrders,
  adminUpdateOrderStatus,
} from '../../services/api'

const NEXT_STATUS = {
  preparing: 'almost',
  almost: 'ready',
}

const STATUS_LABEL = {
  preparing: 'Preparing',
  almost: 'Almost done',
  ready: 'Ready',
  cancelled: 'Cancelled',
}

const STATUS_COLOR = {
  preparing: {
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    dot: 'bg-amber-400',
  },
  almost: {
    badge: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    dot: 'bg-sky-400',
  },
  ready: {
    badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  cancelled: {
    badge: 'bg-white/5 text-white/35 border-white/10',
    dot: 'bg-white/30',
  },
}

const REFRESH_MS = 4000

/* -------------------------------------------------------------------------- */
/* SOUND                                                                      */
/* -------------------------------------------------------------------------- */

let audioCtx

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function playDing() {
  try {
    const ctx = getCtx()
    ;[880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t = ctx.currentTime + i * 0.18

      osc.type = 'sine'
      osc.frequency.value = freq

      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)

      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch {
    // sound is optional, never break the page over it
  }
}

export default function AdminOrders() {
  const { password } = useAdminAuth()

  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const [soundOn, setSoundOn] = useState(true)
  const soundOnRef = useRef(true)
  const seenIds = useRef(null)

  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    soundOnRef.current = next
    if (next) playDing()
  }

  useEffect(() => {
    let cancelled = false

    // Browsers block sound until the user clicks the page once.
    const unlock = () => getCtx()
    window.addEventListener('click', unlock, { once: true })

    async function refresh() {
      try {
        setRefreshing(true)

        const data = await adminFetchOrders(password)

        if (!cancelled) {
          // Ding when an order id shows up that we haven't seen before.
          // The first load only records the ids, so it stays silent.
          if (seenIds.current) {
            const hasNew = data.some((o) => !seenIds.current.has(o.id))
            if (hasNew && soundOnRef.current) playDing()
          }
          seenIds.current = new Set(data.map((o) => o.id))

          setOrders(data)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setRefreshing(false)
        }
      }
    }

    refresh()

    const interval = setInterval(refresh, REFRESH_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('click', unlock)
    }
  }, [password])

  async function advance(order) {
    const next = NEXT_STATUS[order.status]

    if (!next) return

    try {
      const updated = await adminUpdateOrderStatus(
        password,
        order.id,
        next
      )

      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? updated : o
        )
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function cancelOrder(order) {
    try {
      const updated = await adminUpdateOrderStatus(
        password,
        order.id,
        'cancelled'
      )

      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? updated : o
        )
      )
    } catch (err) {
      setError(err.message)
    }
  }

  const stats = useMemo(() => {
    return {
      active: orders.filter(
        (order) =>
          order.status === 'preparing' ||
          order.status === 'almost'
      ).length,

      preparing: orders.filter(
        (order) => order.status === 'preparing'
      ).length,

      almost: orders.filter(
        (order) => order.status === 'almost'
      ).length,

      ready: orders.filter(
        (order) => order.status === 'ready'
      ).length,
    }
  }, [orders])

  const activeOrders = orders.filter(
    (order) =>
      order.status === 'preparing' ||
      order.status === 'almost'
  )

  const completedOrders = orders.filter(
    (order) =>
      order.status === 'ready' ||
      order.status === 'cancelled'
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-maroon-bright">
            <Utensils size={13} />
            Kitchen
          </div>

          <h1 className="font-display text-3xl font-semibold tracking-tight text-cream">
            Today's orders
          </h1>

          <p className="mt-1 text-sm text-cream/40">
            Manage incoming orders and update their progress.
          </p>
        </div>

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={toggleSound}
            className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-xs text-cream/60 transition hover:bg-panel-light"
          >
            {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
            Sound {soundOn ? 'on' : 'off'}
          </button>

          <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-xs text-cream/40">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>

            Live
          </div>

          <div className="flex items-center gap-2 text-xs text-cream/25">
            <RefreshCw
              size={13}
              className={refreshing ? 'animate-spin' : ''}
            />

            Every 4 sec
          </div>

        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

        <OrderStat
          label="Active"
          value={stats.active}
          active
        />

        <OrderStat
          label="Preparing"
          value={stats.preparing}
        />

        <OrderStat
          label="Almost done"
          value={stats.almost}
        />

        <OrderStat
          label="Ready"
          value={stats.ready}
        />

      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">
            {error}
          </p>

          <button
            type="button"
            onClick={() => setError('')}
            className="text-xs text-red-300/60 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active orders */}
      <section>

        <div className="mb-3 flex items-center justify-between">

          <div>
            <h2 className="text-sm font-semibold text-cream">
              Active orders
            </h2>

            <p className="mt-0.5 text-xs text-cream/30">
              Orders that still need attention
            </p>
          </div>

          <span className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-cream/40">
            {activeOrders.length}
          </span>

        </div>

        {activeOrders.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAdvance={advance}
                onCancel={cancelOrder}
              />
            ))}
          </div>
        )}

      </section>

      {/* Completed */}
      {completedOrders.length > 0 && (
        <section className="pt-2">

          <div className="mb-3 flex items-center justify-between">

            <div>
              <h2 className="text-sm font-semibold text-cream/70">
                Completed
              </h2>

              <p className="mt-0.5 text-xs text-cream/25">
                Ready and cancelled orders
              </p>
            </div>

            <span className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-cream/30">
              {completedOrders.length}
            </span>

          </div>

          <div className="space-y-2">

            {completedOrders.map((order) => (
              <CompletedOrder
                key={order.id}
                order={order}
              />
            ))}

          </div>

        </section>
      )}

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* ORDER CARD                                                                 */
/* -------------------------------------------------------------------------- */

function OrderCard({
  order,
  onAdvance,
  onCancel,
}) {
  const next = NEXT_STATUS[order.status]

  const time = new Date(order.createdAt).toLocaleTimeString(
    [],
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  )

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-line bg-panel transition duration-300 hover:border-white/15">

      {/* Red active indicator */}
      <div className="absolute left-0 top-0 h-full w-1 bg-maroon-bright" />

      <div className="p-5">

        {/* Top */}
        <div className="flex items-start justify-between gap-4">

          <div className="flex items-center gap-4">

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-maroon/80">

              <span className="font-display text-lg font-semibold text-cream">
                {order.tableId}
              </span>

            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-cream/30">
                Table
              </p>

              <p className="font-display text-xl font-semibold text-cream">
                {order.tableId}
              </p>

              <div className="mt-1 flex items-center gap-1.5 text-xs text-cream/35">
                <Clock3 size={12} />
                {time}
              </div>
            </div>

          </div>

          <StatusBadge status={order.status} />

        </div>

        {/* Divider */}
        <div className="my-5 border-t border-line" />

        {/* Items */}
        <div className="space-y-3">

          {order.items.map((line, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4"
            >

              <div className="flex min-w-0 items-center gap-3">

                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-xs font-semibold text-cream/60">
                  {line.quantity}
                </span>

                <span className="truncate text-sm text-cream/70">
                  {line.name}
                </span>

              </div>

              <span className="shrink-0 text-xs text-cream/25">
                ×{line.quantity}
              </span>

            </div>
          ))}

        </div>

        {/* Bottom */}
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="text-[10px] uppercase tracking-wider text-cream/25">
              Order total
            </p>

            <p className="mt-0.5 text-lg font-semibold text-cream">
              {formatMoney(order.total)}
            </p>
          </div>

          <div className="flex gap-2">

            <button
              type="button"
              onClick={() => onCancel(order)}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-medium text-cream/45 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
            >
              <Ban size={14} />
              Cancel
            </button>

            <button
              type="button"
              onClick={() => onAdvance(order)}
              className="flex h-10 items-center gap-2 rounded-xl bg-maroon px-4 text-xs font-semibold text-cream transition hover:bg-maroon-bright"
            >
              {STATUS_LABEL[next]}

              <ChevronRight size={14} />
            </button>

          </div>

        </div>

      </div>
    </article>
  )
}


/* -------------------------------------------------------------------------- */
/* STATUS                                                                     */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }) {
  const colors = STATUS_COLOR[status]

  return (
    <span
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${colors.badge}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${colors.dot}`}
      />

      {STATUS_LABEL[status]}
    </span>
  )
}


/* -------------------------------------------------------------------------- */
/* STATS                                                                      */
/* -------------------------------------------------------------------------- */

function OrderStat({
  label,
  value,
  active = false,
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        active
          ? 'border-maroon/30 bg-maroon/10'
          : 'border-line bg-panel'
      }`}
    >
      <p className="text-xs text-cream/35">
        {label}
      </p>

      <p className="mt-2 font-display text-2xl font-semibold text-cream">
        {value}
      </p>
    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* COMPLETED ORDER                                                            */
/* -------------------------------------------------------------------------- */

function CompletedOrder({ order }) {
  const time = new Date(order.createdAt).toLocaleTimeString(
    [],
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  )

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-4 py-3 opacity-70">

      <div className="flex min-w-0 items-center gap-3">

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
          {order.status === 'ready' ? (
            <Check
              size={16}
              className="text-emerald-400"
            />
          ) : (
            <Ban
              size={16}
              className="text-cream/25"
            />
          )}
        </div>

        <div className="min-w-0">

          <p className="text-sm font-medium text-cream/70">
            Table {order.tableId}
          </p>

          <p className="truncate text-xs text-cream/25">
            {time} · {order.total} DA
          </p>

        </div>

      </div>

      <StatusBadge status={order.status} />

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* EMPTY                                                                      */
/* -------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/50 px-6 py-16 text-center">

      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
        <PackageCheck
          size={24}
          className="text-cream/20"
        />
      </div>

      <p className="mt-4 text-sm font-medium text-cream/50">
        No active orders
      </p>

      <p className="mt-1 max-w-xs text-xs leading-5 text-cream/25">
        New restaurant orders will automatically appear here.
      </p>

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('fr-DZ')} DA`
}