import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Armchair,
  ArrowRightLeft,
  ChefHat,
  ChevronRight,
  CircleX,
  Clock3,
  Copy,
  ExternalLink,
  LayoutGrid,
  Link2,
  Merge,
  Plus,
  Printer,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import {
  adminCreateTable,
  adminDeleteTable,
  adminFetchMenuItems,
  adminFetchTables,
  adminMergeOrders,
  adminMoveOrder,
  adminUpdateTable,
} from '../../services/api'
import {
  Card,
  CardTitle,
  ErrorBanner,
  Field,
  GhostButton,
  Modal,
  PageTop,
  PrimaryButton,
  Spinner,
  StatCard,
  VibesCard,
} from '../components/ui'
import { clockTime, itemsSummary, money } from '../components/format'
import FadeImage from '../../components/ui/FadeImage'

const POLL_MS = 5000

const STATE = {
  available: { label: 'Available', border: '#12c27a', fill: 'rgba(18,194,122,0.16)', badge: 'bg-[#0f5a3a] text-[#7df0b8]', dot: 'bg-emerald-500' },
  occupied: { label: 'Occupied', border: '#f0222c', fill: 'rgba(217,21,31,0.38)', badge: 'bg-[#8a0f17] text-[#ffc9cc]', dot: 'bg-[#f0222c]' },
  cleaning: { label: 'Cleaning', border: '#ffa726', fill: 'rgba(255,167,38,0.22)', badge: 'bg-[#8a4b0f] text-[#ffd9a8]', dot: 'bg-amber-500' },
  out_of_service: { label: 'Out of Service', border: '#6f6f78', fill: 'rgba(120,120,130,0.2)', badge: 'bg-[#2a2b31] text-[#d6d6db]', dot: 'bg-zinc-500' },
}

export default function AdminTables() {
  const { password } = useAdminAuth()
  const navigate = useNavigate()

  const [tables, setTables] = useState(null)
  const [menu, setMenu] = useState([])
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [dialog, setDialog] = useState(null) // 'add' | 'links' | 'move' | 'merge'
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setTables(await adminFetchTables(password))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [password])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    adminFetchMenuItems(password).then(setMenu).catch(() => {})
  }, [password])

  const floor = useMemo(() => (tables || []).filter((t) => t.kind !== 'home'), [tables])
  const homeLink = (tables || []).find((t) => t.kind === 'home')

  // Keep a table selected: the first busy one, else the first one.
  useEffect(() => {
    if (!floor.length) return
    if (!selectedId || !floor.some((t) => t.id === selectedId)) {
      setSelectedId((floor.find((t) => t.state === 'occupied') || floor[0]).id)
    }
  }, [floor, selectedId])

  const selected = floor.find((t) => t.id === selectedId) || null

  const count = (state) => floor.filter((t) => t.state === state).length
  const pct = (n) => (floor.length ? Math.round((n / floor.length) * 100) : 0)

  async function run(task) {
    setBusy(true)
    try {
      await task()
      await load()
      setError('')
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const setOverride = (table, status) => run(() => adminUpdateTable(password, table.id, { status }))

  function deleteTable(table) {
    if (!window.confirm(`Remove ${table.label}? Its QR link will stop working.`)) return
    run(() => adminDeleteTable(password, table.id))
  }

  const dishImage = (order) => {
    const first = order?.items?.[0]
    return menu.find((m) => m.id === first?.id)?.image || null
  }

  return (
    <div className="space-y-6">
      <PageTop
        icon={<Armchair size={34} />}
        title="Tables"
        subtitle="Manage your restaurant tables and their current status."
      >
        <GhostButton className="hidden h-11 md:inline-flex" onClick={() => setDialog('links')}>
          <Link2 size={16} /> QR Links
        </GhostButton>
        <PrimaryButton className="h-11" onClick={() => setDialog('add')}>
          <Plus size={17} /> Add Table
        </PrimaryButton>
      </PageTop>

      <ErrorBanner message={error} onClose={() => setError('')} />

      {!tables ? (
        <div className="flex justify-center py-32">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<Armchair size={26} />} tone="red" label="Total Tables" value={floor.length} sub="in restaurant" />
            <StatCard icon={<UsersRound size={26} />} tone="green" label="Occupied Tables" value={count('occupied')} sub={`${pct(count('occupied'))}%`} />
            <StatCard icon={<Clock3 size={26} />} tone="orange" label="Available Tables" value={count('available')} sub={`${pct(count('available'))}%`} />
            <StatCard icon={<CircleX size={26} />} tone="gray" label="Out of Service" value={count('out_of_service')} sub={`${pct(count('out_of_service'))}%`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
            <div className="space-y-4">
              {/* Floor */}
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle icon={<LayoutGrid size={22} />} title="Restaurant Floor" />
                  <div className="flex flex-wrap items-center gap-4 text-xs text-white/70">
                    {Object.entries(STATE).map(([key, s]) => (
                      <span key={key} className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} /> {s.label}
                      </span>
                    ))}
                  </div>
                </div>

                <Floor tables={floor} selectedId={selectedId} onSelect={setSelectedId} />
              </Card>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <DetailCard
                  table={selected}
                  image={dishImage(selected?.order)}
                  busy={busy}
                  onViewOrder={() => navigate(`/admin/orders?q=${selected.order.id}`)}
                  onOverride={setOverride}
                  onDelete={deleteTable}
                />

                <Card className="p-5">
                  <CardTitle icon={<LayoutGrid size={20} />} title="Quick Actions" />
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <ActionButton
                      icon={<Plus size={17} className="text-[#f0222c]" />}
                      label="New Order"
                      disabled={!selected || selected.state === 'out_of_service'}
                      onClick={() => window.open(`/table/${selected.id}`, '_blank')}
                    />
                    <ActionButton
                      icon={<ArrowRightLeft size={16} />}
                      label="Move Table"
                      disabled={!selected?.order}
                      onClick={() => setDialog('move')}
                    />
                    <ActionButton
                      icon={<Merge size={16} />}
                      label="Merge Tables"
                      disabled={!selected?.order || floor.filter((t) => t.order && t.id !== selected.id).length === 0}
                      onClick={() => setDialog('merge')}
                    />
                    <ActionButton
                      icon={<Printer size={16} />}
                      label="Print Bill"
                      disabled={!selected?.order}
                      onClick={() => printBill(selected)}
                    />
                  </div>
                </Card>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <Card className="p-5">
                <CardTitle icon={<Armchair size={22} />} title="Table Status" />
                <ul className="mt-3 divide-y divide-white/[0.06]">
                  {floor.map((t) => {
                    const s = STATE[t.state]
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className={`flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left transition hover:bg-white/[0.04] ${t.id === selectedId ? 'bg-white/[0.05]' : ''}`}
                        >
                          <span className={`h-3 w-3 rounded-full ${s.dot}`} />
                          <span className="w-[62px] text-sm text-white">{t.label}</span>
                          <span className="flex w-9 items-center gap-1 text-xs text-white/55">
                            <UsersRound size={13} /> {t.seats}
                          </span>
                          <span className={`min-w-[92px] rounded-full px-3 py-1 text-center text-xs font-medium ${s.badge}`}>{s.label}</span>
                          <span className="flex-1 text-right text-xs text-white/45">
                            {t.order ? clockTime(t.order.createdAt) : ''}
                          </span>
                          <ChevronRight size={15} className="text-white/45" />
                        </button>
                      </li>
                    )
                  })}
                  {floor.length === 0 && <li className="py-8 text-center text-sm text-white/40">No tables yet — add your first one.</li>}
                </ul>

                {homeLink && (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.05] px-3 py-3">
                    <span className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="flex-1 text-sm text-white">To Home</span>
                    <span className="text-xs text-white/55">
                      {homeLink.openOrders} in progress
                    </span>
                  </div>
                )}
              </Card>

              <VibesCard className="min-h-[200px]" />
            </div>
          </div>
        </>
      )}

      {dialog === 'add' && (
        <AddTableModal
          nextId={String(Math.max(0, ...floor.map((t) => parseInt(t.id, 10) || 0)) + 1)}
          onClose={() => setDialog(null)}
          onSave={async (table) => {
            const ok = await run(() => adminCreateTable(password, table))
            if (ok) {
              setSelectedId(table.id)
              setDialog(null)
            }
          }}
        />
      )}

      {dialog === 'links' && <LinksModal tables={floor} onClose={() => setDialog(null)} />}

      {dialog === 'move' && selected?.order && (
        <PickModal
          title={`Move ${selected.label}`}
          subtitle="Choose a free table for this order."
          options={floor.filter((t) => t.state === 'available')}
          empty="No free table available."
          onClose={() => setDialog(null)}
          onPick={async (t) => {
            const ok = await run(() => adminMoveOrder(password, selected.order.id, t.id))
            if (ok) {
              setSelectedId(t.id)
              setDialog(null)
            }
          }}
          note={(t) => `${t.seats} seats`}
        />
      )}

      {dialog === 'merge' && selected?.order && (
        <PickModal
          title={`Merge ${selected.label}`}
          subtitle="Its dishes will be added to the order of the table you choose."
          options={floor.filter((t) => t.order && t.id !== selected.id)}
          empty="No other table has an order."
          onClose={() => setDialog(null)}
          onPick={async (t) => {
            const ok = await run(() => adminMergeOrders(password, selected.order.id, t.order.id))
            if (ok) {
              setSelectedId(t.id)
              setDialog(null)
            }
          }}
          note={(t) => `Order #${t.order.id}`}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Floor plan                                                          */
/* ------------------------------------------------------------------ */

const COLS = 4
const ROW_H = 140

function Floor({ tables, selectedId, onSelect }) {
  const rows = Math.max(1, Math.ceil(tables.length / COLS))
  const height = 120 + rows * ROW_H

  return (
    <div
      className="relative mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[radial-gradient(circle_at_50%_0%,#17171b,#0b0b0d_70%)]"
      style={{ height }}
    >
      {/* Kitchen */}
      <div className="absolute left-1/2 top-4 flex h-[58px] w-[34%] min-w-[140px] -translate-x-1/2 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-sm text-white/70">
        Kitchen
      </div>

      {tables.map((table, index) => {
        const col = index % COLS
        const row = Math.floor(index / COLS)
        return (
          <div
            key={table.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${((col + 0.5) / COLS) * 100}%`,
              top: 112 + row * ROW_H + (col % 2 === 1 ? 6 : 0),
            }}
          >
            <TableShape table={table} selected={table.id === selectedId} onClick={() => onSelect(table.id)} />
          </div>
        )
      })}

      {/* Entrance */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center text-white/60">
        <span className="text-lg leading-none">↑</span>
        <span className="text-xs">Entrance</span>
      </div>
    </div>
  )
}

function TableShape({ table, selected, onClick }) {
  const s = STATE[table.state]
  const round = table.seats >= 6
  const size = round ? 62 : 58
  const box = 118
  const seats = Math.min(table.seats, 8)

  const chairs = []
  if (round) {
    for (let i = 0; i < seats; i += 1) {
      const angle = (i / seats) * Math.PI * 2
      chairs.push({ x: box / 2 + Math.cos(angle) * 44, y: box / 2 + Math.sin(angle) * 44, w: 16, h: 16, round: true })
    }
  } else {
    const top = Math.ceil(Math.min(seats, 4) / 2)
    const bottom = Math.floor(Math.min(seats, 4) / 2)
    const place = (n, y) =>
      Array.from({ length: n }, (_, i) => ({ x: box / 2 + (i - (n - 1) / 2) * 24, y, w: 20, h: 9 }))
    chairs.push(...place(top, box / 2 - size / 2 - 8), ...place(bottom, box / 2 + size / 2 + 8))
    if (seats > 4) {
      chairs.push({ x: box / 2 - size / 2 - 8, y: box / 2, w: 9, h: 20 }, { x: box / 2 + size / 2 + 8, y: box / 2, w: 9, h: 20 })
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${table.label}, ${s.label}`}
      className="relative block transition hover:scale-[1.04]"
      style={{ width: box, height: box }}
    >
      {chairs.map((c, i) => (
        <span
          key={i}
          className="absolute bg-[#3a2a22]/90"
          style={{
            left: c.x - c.w / 2,
            top: c.y - c.h / 2,
            width: c.w,
            height: c.h,
            borderRadius: c.round ? 999 : 4,
          }}
        />
      ))}

      <span
        className="absolute flex flex-col items-center justify-center text-white"
        style={{
          left: (box - size) / 2,
          top: (box - size) / 2,
          width: size,
          height: size,
          borderRadius: round ? 999 : 10,
          border: `2px solid ${s.border}`,
          background: s.fill,
          boxShadow: selected
            ? `0 0 0 3px rgba(255,255,255,0.35), 0 0 22px ${s.border}`
            : `0 0 16px ${s.border}55`,
        }}
      >
        <span className="text-[19px] font-bold leading-none">{table.id}</span>
        <span className="mt-1 flex items-center gap-0.5 text-[10px] text-white/75">
          <UsersRound size={10} /> {table.seats}
        </span>
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: s.border }} />
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */

function DetailCard({ table, image, busy, onViewOrder, onOverride, onDelete }) {
  if (!table) {
    return <Card className="flex items-center justify-center p-6 text-sm text-white/40">Select a table.</Card>
  }

  const s = STATE[table.state]

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-[#d9151f] px-3.5 py-1.5 text-sm font-semibold text-white">{table.label}</span>
        <span className="flex items-center gap-1.5 text-sm text-white/65">
          <UsersRound size={15} /> {table.seats}
        </span>
        <span className={`rounded-full px-3.5 py-1 text-xs font-medium ${s.badge}`}>{s.label}</span>
      </div>

      {table.order ? (
        <div className="mt-4 flex items-center gap-4">
          {image ? (
            <FadeImage src={image} className="h-[68px] w-[68px] shrink-0 rounded-xl bg-white/5" />
          ) : (
            <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/40">
              <ChefHat size={26} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Order #{table.order.id}</p>
            <p className="truncate text-xs text-white/60">{itemsSummary(table.order)}</p>
            <p className="mt-1 text-xs text-white/40">
              {clockTime(table.order.createdAt)} · {money(table.order.total)}
            </p>
          </div>
          <button
            type="button"
            onClick={onViewOrder}
            className="flex items-center gap-2 rounded-xl border border-[#d9151f]/70 px-4 py-2 text-sm font-medium text-white transition hover:bg-[#d9151f]/15"
          >
            View Order <ChevronRight size={15} />
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/50">
          {table.state === 'out_of_service' ? 'This table is not being used.' : 'No order at this table right now.'}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-4">
        {table.state !== 'occupied' && (
          <>
            {[
              ['auto', 'Available'],
              ['cleaning', 'Cleaning'],
              ['out_of_service', 'Out of Service'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                onClick={() => onOverride(table, value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  table.override === value ? 'bg-[#d9151f] text-white' : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.12]'
                }`}
              >
                {label}
              </button>
            ))}
          </>
        )}
        <button
          type="button"
          onClick={() => onDelete(table)}
          disabled={busy || table.state === 'occupied'}
          aria-label={`Remove ${table.label}`}
          className="ml-auto flex items-center gap-1.5 text-xs text-white/40 transition hover:text-red-400 disabled:opacity-30"
        >
          <Trash2 size={14} /> Remove
        </button>
      </div>
    </Card>
  )
}

function ActionButton({ icon, label, ...props }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 text-sm text-white/90 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
      {...props}
    >
      {icon}
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

function AddTableModal({ nextId, onClose, onSave }) {
  const [id, setId] = useState(nextId)
  const [seats, setSeats] = useState(4)
  const [saving, setSaving] = useState(false)

  return (
    <Modal title="Add a table" subtitle="Its ordering link works as soon as you save." onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setSaving(true)
          await onSave({ id: id.trim(), seats: Number(seats) || 4 })
          setSaving(false)
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Table number" hint="Used in the link: /table/6">
            <input className="input" required value={id} onChange={(e) => setId(e.target.value)} />
          </Field>
          <Field label="Seats">
            <input className="input" type="number" min="1" max="20" value={seats} onChange={(e) => setSeats(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add table'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}

function LinksModal({ tables, onClose }) {
  const [copied, setCopied] = useState('')

  const rows = [
    ...tables.map((t) => ({ key: t.id, label: t.label, path: `/table/${t.id}` })),
    // The special link, always last: orders to take home (no table).
    { key: 'home', label: 'ToHomeOrder', path: '/ToHomeOrder', special: true },
  ]

  async function copy(row) {
    const url = `${window.location.origin}${row.path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(row.key)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <Modal wide title="Ordering links" subtitle="Turn each link into a QR code and put it on the matching table." onClose={onClose}>
      <ul className="divide-y divide-white/[0.06]">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 py-3">
            <span className={`w-[110px] shrink-0 rounded-lg px-3 py-1 text-center text-xs font-semibold text-white ${row.special ? 'bg-[#8a4b0f]' : 'bg-[#5a0b10]'}`}>
              {row.label}
            </span>
            <code className="min-w-0 flex-1 truncate text-xs text-white/55">
              {window.location.origin}{row.path}
            </code>
            {row.special && <span className="hidden text-[11px] text-amber-400/80 sm:block">orders without a table</span>}
            <button type="button" onClick={() => copy(row)} className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.14]">
              <Copy size={13} /> {copied === row.key ? 'Copied' : 'Copy'}
            </button>
            <a href={row.path} target="_blank" rel="noreferrer" aria-label={`Open ${row.label}`} className="text-white/50 hover:text-white">
              <ExternalLink size={15} />
            </a>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function PickModal({ title, subtitle, options, empty, note, onPick, onClose }) {
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      {options.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/45">{empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {options.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-[#f0222c]/60 hover:bg-white/[0.07]"
              >
                <span className="block text-sm font-semibold text-white">{t.label}</span>
                <span className="block text-xs text-white/45">{note(t)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function printBill(table) {
  const order = table.order
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  const lines = order.items
    .map((i) => `<tr><td>${i.quantity} × ${esc(i.name)}</td><td style="text-align:right">${i.quantity * i.unitPrice} DH</td></tr>`)
    .join('')

  const win = window.open('', '_blank', 'width=380,height=600')
  if (!win) return
  win.document.write(`<!doctype html><title>Bill #${order.id}</title>
  <body style="font-family:monospace;padding:18px;max-width:320px;margin:auto">
  <h2 style="text-align:center;margin:0">Meet The Chefs</h2>
  <p style="text-align:center;margin:4px 0 14px">${esc(table.label)} · Order #${order.id}<br>${new Date(order.createdAt).toLocaleString()}</p>
  <table style="width:100%;border-collapse:collapse">${lines}</table>
  <hr><table style="width:100%"><tr><td><b>Total</b></td><td style="text-align:right"><b>${order.total} DH</b></td></tr></table>
  <p style="text-align:center;margin-top:16px">Thank you!</p></body>`)
  win.document.close()
  win.focus()
  win.print()
}
