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
import { useLanguage } from '../../i18n/LanguageContext'
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
  orderNumber,
} from '../components/format'

const PAGE_SIZE = 10
const POLL_MS = 5000

export default function AdminOrders() {
  const { password } = useAdminAuth()
  const { refreshSummary } = useAdminShell()
  const { t, lang } = useLanguage()

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

  const statusFilter = useMemo(
    () => [
      { value: 'all', label: t('admin.orders.statusAll') },
      ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: t(meta.labelKey) })),
    ],
    [t]
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/^#/, '')
    return (data?.orders || []).filter((order) => {
      if (status !== 'all' && order.status !== status) return false
      if (!term) return true
      return (
        String(orderNumber(order)).includes(term) ||
        orderTableLabel(order, lang).toLowerCase().includes(term) ||
        order.items.some((item) => item.name.toLowerCase().includes(term))
      )
    })
  }, [data, search, status, lang])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => setPage(1), [search, status, range])

  const isToday = range === 'today'
  const vs = isToday ? t('admin.orders.vsYesterday') : t('admin.orders.vsDayBefore')

  return (
    <div className="space-y-6">
      <PageTop
        icon={<ClipboardList size={34} className="text-[#f0222c]" />}
        title={t('admin.orders.title')}
        subtitle={t('admin.orders.subtitle')}
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
            <StatCard icon={<ClipboardList size={26} />} tone="red" label={t('admin.orders.totalOrders')} value={overview.current.orders} delta={percentChange(overview.current.orders, overview.previous.orders)} sub={vs} />
            <StatCard icon={<CircleDollarSign size={28} />} tone="green" label={t('admin.orders.totalSales')} value={money(overview.current.revenue, lang)} delta={percentChange(overview.current.revenue, overview.previous.revenue)} sub={vs} />
            <StatCard icon={<UsersRound size={26} />} tone="orange" label={t('admin.orders.avgOrder')} value={money(overview.current.avg, lang)} delta={percentChange(overview.current.avg, overview.previous.avg)} sub={vs} />
            <StatCard icon={<Star size={26} fill="currentColor" />} tone="purple" label={t('admin.orders.completedOrders')} value={overview.current.completed} delta={percentChange(overview.current.completed, overview.previous.completed)} sub={vs} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
            {/* All orders */}
            <Card className="min-w-0 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle icon={<List size={24} />} title={t('admin.orders.allOrders')} />

                <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                  <div className="relative min-w-0 basis-full flex-1 sm:min-w-[200px] sm:max-w-[330px] sm:basis-auto">
                    <Search size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-white/45" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('admin.orders.searchPlaceholder')}
                      className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#121215] ps-10 pe-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#f0222c]/60"
                    />
                  </div>
                  <Dropdown
                    value={status}
                    onChange={setStatus}
                    options={statusFilter}
                    icon={<Funnel size={15} className="text-white/70" />}
                    className="w-full sm:w-[160px]"
                  />
                </div>
              </div>

              {/* Phones: one card per order */}
              <ul className="mt-4 space-y-3 md:hidden">
                {rows.length === 0 && (
                  <li className="py-12 text-center text-sm text-white/40">
                    {data.orders.length === 0 ? t('admin.orders.empty') : t('admin.orders.noMatch')}
                  </li>
                )}
                {rows.map((order) => (
                  <li key={order.id} className="rounded-2xl border border-white/[0.07] bg-[#0b0b0d] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-semibold text-white">#{orderNumber(order)}</span>
                        <TablePill tableId={order.tableId} />
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-2.5 text-sm text-white/80">{itemsSummary(order, 2, lang)}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{money(order.total, lang)}</p>
                        <p className="text-xs text-white/50">{clockTime(order.createdAt, lang)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelected(order)}
                          className="rounded-lg bg-white/[0.07] px-4 py-2 text-xs font-medium text-white transition hover:bg-white/[0.13]"
                        >
                          {t('admin.orders.view')}
                        </button>
                        <RowMenu order={order} busy={busyId === order.id} onChange={changeStatus} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Tablets and computers: the table */}
              <div className="mt-5 hidden md:block">
                <table className="w-full table-fixed text-start text-sm">
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
                      {[['id', '#'], ['table', t('admin.orders.col.table')], ['items', t('admin.orders.col.items')], ['total', t('admin.orders.col.total')], ['status', t('admin.orders.col.status')], ['time', t('admin.orders.col.time')], ['actions', t('admin.orders.col.actions')]].map(([key, h]) => (
                        <th key={key} className={`pb-3 pe-3 font-normal ${key === 'time' ? 'hidden md:table-cell' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-white/40">
                          {data.orders.length === 0 ? t('admin.orders.empty') : t('admin.orders.noMatch')}
                        </td>
                      </tr>
                    )}
                    {rows.map((order) => (
                      <tr key={order.id} className="border-b border-white/[0.05] last:border-0">
                        <td className="py-3.5 pe-3 font-medium text-white">#{orderNumber(order)}</td>
                        <td className="py-3.5 pe-3"><TablePill tableId={order.tableId} /></td>
                        <td className="truncate py-3.5 pe-3 text-white/85">{itemsSummary(order, 2, lang)}</td>
                        <td className="py-3.5 pe-3 text-white">{money(order.total, lang)}</td>
                        <td className="py-3.5 pe-3"><StatusBadge status={order.status} /></td>
                        <td className="hidden py-3.5 pe-3 text-white/70 md:table-cell">{clockTime(order.createdAt, lang)}</td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelected(order)}
                              className="rounded-lg bg-white/[0.07] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.13]"
                            >
                              {t('admin.orders.view')}
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
                    ? t('admin.orders.showingNone')
                    : t('admin.orders.showing', {
                        from: (safePage - 1) * PAGE_SIZE + 1,
                        to: Math.min(safePage * PAGE_SIZE, filtered.length),
                        count: filtered.length,
                      })}
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
  const { t } = useLanguage()
  const pages = []
  const start = Math.max(1, Math.min(page - 2, pageCount - 4))
  for (let p = start; p <= Math.min(pageCount, start + 4); p += 1) pages.push(p)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
        aria-label={t('admin.orders.prevPage')}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/65 hover:bg-white/[0.07] disabled:opacity-30"
      >
        <ChevronLeft size={17} className="rtl:-scale-x-100" />
      </button>
      <button
        type="button"
        onClick={() => onChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        aria-label={t('admin.orders.nextPage')}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/65 hover:bg-white/[0.07] disabled:opacity-30"
      >
        <ChevronRight size={17} className="rtl:-scale-x-100" />
      </button>
    </div>
  )
}

function RowMenu({ order, busy, onChange }) {
  const { t } = useLanguage()
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
        aria-label={t('admin.orders.moreActions', { id: orderNumber(order) })}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/65 transition hover:bg-white/[0.08] hover:text-white"
      >
        {busy ? <Spinner className="h-4 w-4" /> : <EllipsisVertical size={17} />}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#141417] py-1 shadow-2xl shadow-black/60">
          {next && (
            <MenuButton onClick={() => { setOpen(false); onChange(order, next.to) }}>{t(next.labelKey)}</MenuButton>
          )}
          {canCancel && (
            <MenuButton danger onClick={() => { setOpen(false); onChange(order, 'cancelled') }}>{t('admin.orders.cancelOrder')}</MenuButton>
          )}
          {!next && !canCancel && <p className="px-4 py-2 text-xs text-white/40">{t('admin.orders.noActions')}</p>}
        </div>
      )}
    </div>
  )
}

function MenuButton({ danger, children, ...props }) {
  return (
    <button
      type="button"
      className={`block w-full px-4 py-2 text-start text-sm transition hover:bg-white/[0.06] ${danger ? 'text-red-400' : 'text-white/85'}`}
      {...props}
    >
      {children}
    </button>
  )
}

function OrderStatusPanel({ counts }) {
  const { t } = useLanguage()
  const rows = ['preparing', 'almost', 'ready', 'completed', 'cancelled']

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <CardTitle icon={<LifeBuoy size={24} />} title={t('admin.orders.statusPanel')} />
        <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/85">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f0222c]" /> {t('admin.orders.live')}
        </span>
      </div>

      <ul className="mt-4 divide-y divide-white/[0.06]">
        {rows.map((key) => (
          <li key={key} className="flex items-center gap-3 py-2.5 text-sm">
            <span className={`h-[18px] w-[18px] rounded-full ${STATUS_META[key].dot}`} />
            <span className="flex-1 text-white/90">{t(STATUS_META[key].labelKey)}</span>
            <span className="font-medium text-white">{counts[key] || 0}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-3 border-t border-white/[0.07] pt-4">
        <ChefHat size={34} className="text-[#f0222c]" strokeWidth={1.4} />
        <div>
          <p className="text-sm text-white/90">{t('admin.orders.tableToKitchen')}</p>
          <p className="text-xs text-white/45">{t('admin.orders.keepGoing')}</p>
        </div>
      </div>
    </Card>
  )
}

function RecentActivity({ orders }) {
  const { t, lang } = useLanguage()
  const items = [...orders]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5)
    .map((order) => {
      const isNew =
        order.status === 'preparing' &&
        new Date(order.updatedAt) - new Date(order.createdAt) < 5000

      const text = isNew
        ? t('admin.orders.newOrderFrom', { table: orderTableLabel(order, lang) })
        : order.status === 'completed' ? t('admin.orders.activityCompleted')
        : order.status === 'cancelled' ? t('admin.orders.activityCancelled')
        : t('admin.orders.statusChanged', { status: t(STATUS_META[order.status].labelKey) })

      return { order, isNew, text }
    })

  return (
    <Card className="p-4 sm:p-6">
      <CardTitle icon={<Zap size={24} fill="currentColor" />} title={t('admin.orders.recent')} />

      <ul className="mt-4 space-y-4">
        {items.length === 0 && <li className="py-4 text-center text-sm text-white/40">{t('admin.orders.nothingYet')}</li>}
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
              <p className="text-sm font-medium text-white">{t('admin.orders.orderNo', { id: orderNumber(order) })}</p>
              <p className="truncate text-xs text-white/50">{text}</p>
            </div>
            <span className="text-xs text-white/40">{clockTime(order.updatedAt, lang)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function OrderModal({ order, busy, onChange, onClose }) {
  const { t, lang } = useLanguage()
  const next = NEXT_STATUS[order.status]
  const canCancel = order.status !== 'cancelled' && order.status !== 'completed'

  return (
    <Modal
      title={t('admin.orders.orderNo', { id: orderNumber(order) })}
      subtitle={`${orderTableLabel(order, lang)} · ${clockTime(order.createdAt, lang)}`}
      onClose={onClose}
    >
      <div className="flex items-center justify-between">
        <StatusBadge status={order.status} />
        <span className="text-lg font-bold text-white">{money(order.total, lang)}</span>
      </div>

      <ul className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.07] bg-white/[0.02]">
        {order.items.map((item) => (
          <li key={`${item.id}-${item.unitPrice}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-white/90">{item.quantity} × {item.name}</span>
            <span className="text-white/60">{money(item.quantity * item.unitPrice, lang)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {canCancel && (
          <GhostButton disabled={busy} onClick={() => onChange(order, 'cancelled')} className="!border-red-500/30 !text-red-300">
            {t('admin.orders.cancelOrder')}
          </GhostButton>
        )}
        {next && (
          <PrimaryButton disabled={busy} onClick={() => onChange(order, next.to)}>
            {busy ? t('admin.orders.saving') : t(next.labelKey)}
          </PrimaryButton>
        )}
      </div>
    </Modal>
  )
}
