import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  EllipsisVertical,
  Funnel,
  List,
  LifeBuoy,
  Search,
  Star,
  UsersRound,
  Zap,
  ChefHat,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import { useAdminShell } from '../AdminShellContext'
import {
  adminFetchOrders,
  adminFetchOverview,
  adminUpdateOrderStatus,
} from '../../services/api'
import {
  Card,
  CardTitle,
  Dropdown,
  ErrorBanner,
  Modal,
  PageTop,
  PrimaryButton,
  GhostButton,
  Spinner,
  StatCard,
  StatusBadge,
  TablePill,
  useClickOutside,
} from '../components/ui'
import {
  NEXT_STATUS,
  STATUS_META,
  clockTime,
  itemsSummary,
  money,
  orderTableLabel,
  percentChange,
} from '../components/format'

const PAGE_SIZE = 10
const POLL_MS = 5000

const STATUS_FILTER = [
  { value: 'all', label: 'All Status' },
  ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
]

export default function AdminOrders() {
  const { password } = useAdminAuth()
  const { refreshSummary } = useAdminShell()

  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  // /admin/orders?q=1023 opens the page already searching for that order
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      const [orders, stats] = await Promise.all([
        adminFetchOrders(password, range),
        adminFetchOverview(password, range),
      ])
      setData(orders)
      setOverview(stats)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [password, range])

  useEffect(() => {
    setData(null)
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  async function changeStatus(order, next) {
    setBusyId(order.id)
    try {
      const updated = await adminUpdateOrderStatus(password, order.id, next)
      setSelected((current) => (current && current.id === updated.id ? updated : current))
      await Promise.all([load(), refreshSummary()])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/^#/, '')
    return (data?.orders || []).filter((order) => {
      if (status !== 'all' && order.status !== status) return false
      if (!term) return true
      return (
        String(order.id).includes(term) ||
        orderTableLabel(order).toLowerCase().includes(term) ||
        order.items.some((item) => item.name.toLowerCase().includes(term))
      )
    })
  }, [data, search, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => setPage(1), [search, status, range])

  const isToday = range === 'today'
  const vs = isToday ? 'vs. yesterday' : 'vs. day before'

  return (
    <div className="space-y-6">
      <PageTop
        icon={<ClipboardList size={34} className="text-[#f0222c]" />}
        title="Orders"
        subtitle="Manage and track all incoming orders in real time."
        range={range}
        onRange={setRange}
      />

      <ErrorBanner message={error} onClose={() => setError('')} />

      {!data || !overview ? (
        <div className="flex justify-center py-32">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<ClipboardList size={26} />} tone="red" label="Total Orders" value={overview.current.orders} delta={percentChange(overview.current.orders, overview.previous.orders)} sub={vs} />
            <StatCard icon={<CircleDollarSign size={28} />} tone="green" label="Total Sales" value={money(overview.current.revenue)} delta={percentChange(overview.current.revenue, overview.previous.revenue)} sub={vs} />
            <StatCard icon={<UsersRound size={26} />} tone="orange" label="Avg. Order Value" value={money(overview.current.avg)} delta={percentChange(overview.current.avg, overview.previous.avg)} sub={vs} />
            <StatCard icon={<Star size={26} fill="currentColor" />} tone="purple" label="Completed Orders" value={overview.current.completed} delta={percentChange(overview.current.completed, overview.previous.completed)} sub={vs} />
          </div>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
            {/* All orders */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle icon={<List size={24} />} title="All Orders" />

                <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                  <div className="relative min-w-[200px] max-w-[330px] flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by order ID, table, item..."
                      className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#121215] pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#f0222c]/60"
                    />
                  </div>
                  <Dropdown
                    value={status}
                    onChange={setStatus}
                    options={STATUS_FILTER}
                    icon={<Funnel size={15} className="text-white/70" />}
                    className="w-[160px]"
                  />
                </div>
              </div>

              <div className="mt-5">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[64px]" />
                    <col className="w-[108px]" />
                    <col />
                    <col className="w-[104px]" />
                    <col className="w-[124px]" />
                    <col className="hidden w-[92px] md:table-column" />
                    <col className="w-[112px]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-white/[0.07] text-[13px] text-white/50">
                      {['#', 'Table', 'Items', 'Total', 'Status', 'Time', 'Actions'].map((h) => (
                        <th key={h} className={`pb-3 pr-3 font-normal ${h === 'Time' ? 'hidden md:table-cell' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-white/40">
                          {data.orders.length === 0 ? 'No orders yet.' : 'No orders match your search.'}
                        </td>
                      </tr>
                    )}
                    {rows.map((order) => (
                      <tr key={order.id} className="border-b border-white/[0.05] last:border-0">
                        <td className="py-3.5 pr-3 font-medium text-white">#{order.id}</td>
                        <td className="py-3.5 pr-3"><TablePill tableId={order.tableId} /></td>
                        <td className="truncate py-3.5 pr-3 text-white/85">{itemsSummary(order)}</td>
                        <td className="py-3.5 pr-3 text-white">{money(order.total)}</td>
                        <td className="py-3.5 pr-3"><StatusBadge status={order.status} /></td>
                        <td className="hidden py-3.5 pr-3 text-white/70 md:table-cell">{clockTime(order.createdAt)}</td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelected(order)}
                              className="rounded-lg bg-white/[0.07] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.13]"
                            >
                              View
                            </button>
                            <RowMenu order={order} busy={busyId === order.id} onChange={changeStatus} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-white/50">
                <span>
                  {filtered.length === 0
                    ? 'Showing 0 orders'
                    : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} orders`}
                </span>
                <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
              </div>
            </Card>

            {/* Right column */}
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1 2xl:content-start">
              <OrderStatusPanel counts={data.counts} />
              <RecentActivity orders={data.orders} />
            </div>
          </div>
        </>
      )}

      {selected && (
        <OrderModal
          order={data?.orders.find((o) => o.id === selected.id) || selected}
          busy={busyId === selected.id}
          onChange={changeStatus}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Pagination({ page, pageCount, onChange }) {
  const pages = []
  const start = Math.max(1, Math.min(page - 2, pageCount - 4))
  for (let p = start; p <= Math.min(pageCount, start + 4); p += 1) pages.push(p)

  return (
    <div className="flex items-center gap-1.5">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`h-9 w-9 rounded-lg text-sm font-medium transition ${
            p === page ? 'bg-[#e11d28] text-white' : 'text-white/65 hover:bg-white/[0.07]'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Previous page"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/65 hover:bg-white/[0.07] disabled:opacity-30"
      >
        <ChevronLeft size={17} />
      </button>
      <button
        type="button"
        onClick={() => onChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        aria-label="Next page"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/65 hover:bg-white/[0.07] disabled:opacity-30"
      >
        <ChevronRight size={17} />
      </button>
    </div>
  )
}

function RowMenu({ order, busy, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, () => setOpen(false), open)

  const next = NEXT_STATUS[order.status]
  const canCancel = order.status !== 'cancelled' && order.status !== 'completed'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`More actions for order ${order.id}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/[0.08] hover:text-white"
      >
        {busy ? <Spinner className="h-4 w-4" /> : <EllipsisVertical size={17} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#141417] py-1 shadow-2xl shadow-black/60">
          {next && (
            <MenuButton onClick={() => { setOpen(false); onChange(order, next.to) }}>{next.label}</MenuButton>
          )}
          {canCancel && (
            <MenuButton danger onClick={() => { setOpen(false); onChange(order, 'cancelled') }}>Cancel order</MenuButton>
          )}
          {!next && !canCancel && <p className="px-4 py-2 text-xs text-white/40">No actions available.</p>}
        </div>
      )}
    </div>
  )
}

function MenuButton({ danger, children, ...props }) {
  return (
    <button
      type="button"
      className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-white/[0.06] ${danger ? 'text-red-400' : 'text-white/85'}`}
      {...props}
    >
      {children}
    </button>
  )
}

function OrderStatusPanel({ counts }) {
  const rows = [
    ['preparing', 'Preparing'],
    ['almost', 'Almost Ready'],
    ['ready', 'Ready'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
  ]

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <CardTitle icon={<LifeBuoy size={24} />} title="Order Status" />
        <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/85">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f0222c]" /> Live
        </span>
      </div>

      <ul className="mt-4 divide-y divide-white/[0.06]">
        {rows.map(([key, label]) => (
          <li key={key} className="flex items-center gap-3 py-2.5 text-sm">
            <span className={`h-[18px] w-[18px] rounded-full ${STATUS_META[key].dot}`} />
            <span className="flex-1 text-white/90">{label}</span>
            <span className="font-medium text-white">{counts[key] || 0}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-3 border-t border-white/[0.07] pt-4">
        <ChefHat size={34} className="text-[#f0222c]" strokeWidth={1.4} />
        <div>
          <p className="text-sm text-white/90">From table to kitchen</p>
          <p className="text-xs text-white/45">Keep the good food coming!</p>
        </div>
      </div>
    </Card>
  )
}

function RecentActivity({ orders }) {
  const items = [...orders]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5)
    .map((order) => {
      const isNew =
        order.status === 'preparing' &&
        new Date(order.updatedAt) - new Date(order.createdAt) < 5000

      const text = isNew
        ? `New order from ${orderTableLabel(order)}`
        : order.status === 'completed' ? 'Completed'
        : order.status === 'cancelled' ? 'Cancelled'
        : `Status changed to ${STATUS_META[order.status].label}`

      return { order, isNew, text }
    })

  return (
    <Card className="p-6">
      <CardTitle icon={<Zap size={24} fill="currentColor" />} title="Recent Activity" />

      <ul className="mt-4 space-y-4">
        {items.length === 0 && <li className="py-4 text-center text-sm text-white/40">Nothing yet today.</li>}
        {items.map(({ order, isNew, text }) => (
          <li key={order.id} className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${
                isNew ? 'bg-[#d9151f]' : order.status === 'cancelled' ? 'bg-[#7d1117]' : order.status === 'completed' ? 'bg-[#2a2b31]' : 'bg-[#12a56b]'
              }`}
            >
              {isNew ? <ClipboardList size={19} /> : <Check size={19} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Order #{order.id}</p>
              <p className="truncate text-xs text-white/50">{text}</p>
            </div>
            <span className="text-xs text-white/40">{clockTime(order.updatedAt)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function OrderModal({ order, busy, onChange, onClose }) {
  const next = NEXT_STATUS[order.status]
  const canCancel = order.status !== 'cancelled' && order.status !== 'completed'

  return (
    <Modal
      title={`Order #${order.id}`}
      subtitle={`${orderTableLabel(order)} · ${clockTime(order.createdAt)}`}
      onClose={onClose}
    >
      <div className="flex items-center justify-between">
        <StatusBadge status={order.status} />
        <span className="text-lg font-bold text-white">{money(order.total)}</span>
      </div>

      <ul className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-white/[0.02]">
        {order.items.map((item) => (
          <li key={`${item.id}-${item.unitPrice}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-white/90">{item.quantity} × {item.name}</span>
            <span className="text-white/60">{money(item.quantity * item.unitPrice)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {canCancel && (
          <GhostButton disabled={busy} onClick={() => onChange(order, 'cancelled')} className="!border-red-500/30 !text-red-300">
            Cancel order
          </GhostButton>
        )}
        {next && (
          <PrimaryButton disabled={busy} onClick={() => onChange(order, next.to)}>
            {busy ? 'Saving…' : next.label}
          </PrimaryButton>
        )}
      </div>
    </Modal>
  )
}
