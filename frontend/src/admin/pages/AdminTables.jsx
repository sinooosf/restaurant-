import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Armchair,
  ChevronRight,
  CircleX,
  Clock3,
  Copy,
  ExternalLink,
  LayoutGrid,
  Link2,
  Minus,
  Plus,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'
import { useAdminAuth } from '../AdminAuthContext'
import {
  adminCreateTable,
  adminDeleteTable,
  adminFetchTables,
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
  useClickOutside,
} from '../components/ui'
import { clockTime } from '../components/format'

const POLL_MS = 5000

const STATE = {
  available: { labelKey: 'admin.tables.state.available', border: '#12c27a', badge: 'bg-[#0f5a3a] text-[#7df0b8]', dot: 'bg-emerald-500' },
  occupied: { labelKey: 'admin.tables.state.occupied', border: '#f0222c', badge: 'bg-[#8a0f17] text-[#ffc9cc]', dot: 'bg-[#f0222c]' },
  cleaning: { labelKey: 'admin.tables.state.cleaning', border: '#ffa726', badge: 'bg-[#8a4b0f] text-[#ffd9a8]', dot: 'bg-amber-500' },
  out_of_service: { labelKey: 'admin.tables.state.out_of_service', border: '#6f6f78', badge: 'bg-[#2a2b31] text-[#d6d6db]', dot: 'bg-zinc-500' },
}

// Tables live in the dining area, below the kitchen wall.
const MIN_X = 6
const MAX_X = 94
const MIN_Y = 33
const MAX_Y = 88

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

// Where a table sits when nobody has moved it yet: a tidy grid.
function defaultPosition(index, total) {
  const cols = 4
  const rows = Math.max(1, Math.ceil(total / cols))
  const col = index % cols
  const row = Math.floor(index / cols)
  return {
    x: ((col + 0.5) / cols) * 100,
    y: rows === 1 ? 55 : 40 + (row * 46) / (rows - 1),
  }
}

export default function AdminTables() {
  const { password } = useAdminAuth()
  const { t, lang, tableLabel } = useLanguage()

  const [tables, setTables] = useState(null)
  const [error, setError] = useState('')
  const [highlightId, setHighlightId] = useState(null)
  const [dialog, setDialog] = useState(null) // 'add' | 'links'
  const [menu, setMenu] = useState(null) // { id, x, y }
  const [busy, setBusy] = useState(false)
  const [localPos, setLocalPos] = useState({}) // positions being dragged / just dropped

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

  const floor = useMemo(() => (tables || []).filter((tb) => tb.kind !== 'home'), [tables])
  const homeLink = (tables || []).find((tb) => tb.kind === 'home')

  const count = (state) => floor.filter((tb) => tb.state === state).length
  const pct = (n) => (floor.length ? Math.round((n / floor.length) * 100) : 0)

  const positionOf = (table, index) =>
    localPos[table.id] ||
    (table.posX !== null && table.posY !== null
      ? { x: table.posX, y: table.posY }
      : defaultPosition(index, floor.length))

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

  async function savePosition(table, pos) {
    const ok = await run(() => adminUpdateTable(password, table.id, { posX: pos.x, posY: pos.y }))
    // The server copy is now the truth — stop overriding it locally.
    setLocalPos((prev) => {
      const next = { ...prev }
      delete next[table.id]
      return next
    })
    return ok
  }

  const menuTable = menu ? floor.find((tb) => tb.id === menu.id) : null

  function removeTable(table) {
    if (!window.confirm(t('admin.tables.confirmRemove', { table: tableLabel(table.id) }))) return
    setMenu(null)
    run(() => adminDeleteTable(password, table.id))
  }

  return (
    <div className="space-y-6">
      <PageTop
        icon={<Armchair size={34} />}
        title={t('admin.tables.title')}
        subtitle={t('admin.tables.subtitle')}
      />

      <ErrorBanner message={error} onClose={() => setError('')} />

      {!tables ? (
        <div className="flex justify-center py-32">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<Armchair size={26} />} tone="red" label={t('admin.tables.total')} value={floor.length} sub={t('admin.tables.inRestaurant')} />
            <StatCard icon={<UsersRound size={26} />} tone="green" label={t('admin.tables.occupiedTables')} value={count('occupied')} sub={`${pct(count('occupied'))}%`} />
            <StatCard icon={<Clock3 size={26} />} tone="orange" label={t('admin.tables.availableTables')} value={count('available')} sub={`${pct(count('available'))}%`} />
            <StatCard icon={<CircleX size={26} />} tone="gray" label={t('admin.tables.state.out_of_service')} value={count('out_of_service')} sub={`${pct(count('out_of_service'))}%`} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            {/* The floor takes the whole left side */}
            <Card className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle icon={<LayoutGrid size={22} />} title={t('admin.tables.floor')} />
                <div className="flex flex-wrap items-center gap-2">
                  <GhostButton className="h-10" onClick={() => setDialog('links')}>
                    <Link2 size={15} /> {t('admin.tables.qrLinks')}
                  </GhostButton>
                  <PrimaryButton className="h-10" onClick={() => setDialog('add')}>
                    <Plus size={16} /> {t('admin.tables.addTable')}
                  </PrimaryButton>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
                <div className="flex flex-wrap items-center gap-4">
                  {Object.entries(STATE).map(([key, s]) => (
                    <span key={key} className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} /> {t(s.labelKey)}
                    </span>
                  ))}
                </div>
                <span className="text-white/40">{t('admin.tables.dragHint')}</span>
              </div>

              <Floor
                tables={floor}
                positionOf={positionOf}
                highlightId={highlightId}
                onMove={(table, pos) => setLocalPos((prev) => ({ ...prev, [table.id]: pos }))}
                onDrop={savePosition}
                onMenu={(table, x, y) => {
                  setHighlightId(table.id)
                  setMenu({ id: table.id, x, y })
                }}
                menu={menu}
                menuContent={
                  menuTable && (
                    <TableMenu
                      table={menuTable}
                      busy={busy}
                      onSeats={(seats) => run(() => adminUpdateTable(password, menuTable.id, { seats }))}
                      onStatus={(status) => run(() => adminUpdateTable(password, menuTable.id, { status }))}
                      onRemove={() => removeTable(menuTable)}
                      onClose={() => setMenu(null)}
                    />
                  )
                }
              />
            </Card>

            {/* Right column */}
            <div className="space-y-4">
              <Card className="p-5">
                <CardTitle icon={<Armchair size={22} />} title={t('admin.tables.statusPanel')} />
                <ul className="mt-3 divide-y divide-white/[0.06]">
                  {floor.map((tb) => {
                    const s = STATE[tb.state]
                    return (
                      <li key={tb.id}>
                        <button
                          type="button"
                          onClick={() => setHighlightId(tb.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-1 py-3 text-start sm:gap-3 transition hover:bg-white/[0.04] ${tb.id === highlightId ? 'bg-white/[0.05]' : ''}`}
                        >
                          <span className={`h-3 w-3 rounded-full ${s.dot}`} />
                          <span className="w-[62px] text-sm text-white">{tableLabel(tb.id)}</span>
                          <span className="flex w-9 items-center gap-1 text-xs text-white/55">
                            <UsersRound size={13} /> {tb.seats}
                          </span>
                          <span className={`min-w-[84px] rounded-full px-2 py-1 text-center sm:min-w-[92px] sm:px-3 text-xs font-medium ${s.badge}`}>{t(s.labelKey)}</span>
                          <span className="min-w-0 flex-1 truncate text-end text-xs text-white/45">
                            {tb.order ? clockTime(tb.order.createdAt, lang) : ''}
                          </span>
                          <ChevronRight size={15} className="text-white/45 rtl:-scale-x-100" />
                        </button>
                      </li>
                    )
                  })}
                  {floor.length === 0 && <li className="py-8 text-center text-sm text-white/40">{t('admin.tables.empty')}</li>}
                </ul>

                {homeLink && (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.05] px-3 py-3">
                    <span className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="flex-1 text-sm text-white">{t('common.toHome')}</span>
                    <span className="text-xs text-white/55">{t('admin.tables.inProgress', { count: homeLink.openOrders })}</span>
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
          nextId={String(Math.max(0, ...floor.map((tb) => parseInt(tb.id, 10) || 0)) + 1)}
          onClose={() => setDialog(null)}
          onSave={async (table) => {
            const ok = await run(() => adminCreateTable(password, table))
            if (ok) {
              setHighlightId(table.id)
              setDialog(null)
            }
          }}
        />
      )}

      {dialog === 'links' && <LinksModal tables={floor} onClose={() => setDialog(null)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Floor plan                                                          */
/* ------------------------------------------------------------------ */

function Floor({ tables, positionOf, highlightId, onMove, onDrop, onMenu, menu, menuContent }) {
  const { t } = useLanguage()
  const ref = useRef(null)

  return (
    // On a phone (narrower than 768px) the floor keeps a fixed size and scrolls sideways, so tables
    // never overlap. On bigger screens the whole floor is shown, no scrolling.
    <div className="mt-4 overflow-x-auto rounded-xl">
    <div
      ref={ref}
      dir="ltr" // the floor plan is a physical map: saved positions never mirror
      className="relative h-[640px] select-none max-md:min-w-[760px] overflow-hidden rounded-xl border border-white/[0.1]"
      style={{
        // Dark tiled floor
        backgroundColor: '#121214',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px), radial-gradient(circle at 50% 70%, rgba(255,255,255,0.04), transparent 65%)',
        backgroundSize: '56px 56px, 56px 56px, 100% 100%',
      }}
    >
      <Kitchen />

      {tables.map((table, index) => (
        <DraggableTable
          key={table.id}
          table={table}
          pos={positionOf(table, index)}
          highlighted={table.id === highlightId}
          floorRef={ref}
          onMove={(pos) => onMove(table, pos)}
          onDrop={(pos) => onDrop(table, pos)}
          onMenu={(x, y) => onMenu(table, x, y)}
        />
      ))}

      {/* Entrance */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
        <span className="mb-1 text-[11px] tracking-widest text-white/55">↑ {t('admin.tables.entrance')}</span>
        <div className="h-[10px] w-40 rounded-t-md border border-b-0 border-amber-700/60 bg-gradient-to-b from-[#7a5230] to-[#4b2f19]" />
      </div>

      {menu && menuContent && <MenuPopup menu={menu} floorRef={ref}>{menuContent}</MenuPopup>}
    </div>
    </div>
  )
}

// A believable kitchen: tiled back wall, fridge, hood + stove with burners,
// sink, a wooden prep island and a lit pass-through window to the dining room.
function Kitchen() {
  const { t } = useLanguage()
  const steel = 'linear-gradient(135deg, #c9ced6 0%, #8c929c 45%, #b7bcc5 100%)'

  return (
    <div className="absolute inset-x-[3%] top-3 h-[150px] overflow-hidden rounded-lg border border-white/15 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
      {/* Tiled wall */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#d8d4cc',
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.12) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          opacity: 0.9,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40" />

      {/* Sign */}
      <div className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded bg-[#1b1b1e] px-3 py-0.5 text-[10px] font-bold tracking-[0.35em] text-white/85 shadow">
        {t('admin.tables.kitchen')}
      </div>

      {/* Fridge */}
      <div className="absolute bottom-[26px] left-3 h-[104px] w-[54px] rounded-md border border-black/30" style={{ background: steel }}>
        <div className="absolute left-0 right-0 top-[38px] h-px bg-black/30" />
        <div className="absolute right-1.5 top-4 h-6 w-1 rounded bg-black/50" />
        <div className="absolute right-1.5 top-[48px] h-9 w-1 rounded bg-black/50" />
      </div>

      {/* Hood over the stove */}
      <div className="absolute left-[16%] top-5 h-[34px] w-[26%] [clip-path:polygon(12%_0,88%_0,100%_100%,0_100%)]" style={{ background: steel }} />

      {/* Stove with 4 burners and a pot */}
      <div className="absolute bottom-[26px] left-[16%] h-[62px] w-[26%] rounded-md border border-black/30" style={{ background: steel }}>
        <div className="grid h-[30px] grid-cols-4 gap-1.5 px-2 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="relative aspect-square rounded-full border-2 border-[#2a2a2e] bg-[#1a1a1d]">
              <span className={`absolute inset-[3px] rounded-full ${i === 1 || i === 2 ? 'bg-orange-500/80 shadow-[0_0_10px_rgba(255,120,0,0.9)]' : 'bg-transparent'}`} />
            </span>
          ))}
        </div>
        <div className="mt-2 flex justify-around px-2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full border border-black/40 bg-[#2a2a2e]" />
          ))}
        </div>
        <span className="absolute -top-[13px] left-[30%] h-[13px] w-[26px] rounded-t-md bg-[#2b2b30] ring-1 ring-black/40" />
      </div>

      {/* Sink */}
      <div className="absolute bottom-[26px] left-[45%] h-[62px] w-[16%] rounded-md border border-black/30" style={{ background: steel }}>
        <div className="absolute inset-x-2 top-3 h-[26px] rounded bg-[#6d737d] shadow-[inset_0_3px_6px_rgba(0,0,0,0.5)]" />
        <span className="absolute -top-[14px] left-1/2 h-[14px] w-1.5 -translate-x-1/2 rounded-t bg-[#9aa0a9]" />
        <span className="absolute -top-[14px] left-1/2 h-1.5 w-4 rounded-r bg-[#9aa0a9]" />
      </div>

      {/* Prep island (wood) */}
      <div className="absolute bottom-[26px] left-[64%] h-[48px] w-[16%] rounded-md border border-black/40 bg-gradient-to-b from-[#a8794c] to-[#6e4a2b]">
        <span className="absolute left-2 top-1.5 h-4 w-8 rounded-sm bg-[#d9b98a]" />
        <span className="absolute left-12 top-2 h-1.5 w-8 rounded-full bg-[#c9ced6]" />
      </div>

      {/* Pass-through window (lit) */}
      <div className="absolute bottom-[26px] right-3 h-[70px] w-[13%] rounded-md border-2 border-[#4a3320] bg-gradient-to-b from-amber-300/90 to-amber-600/70 shadow-[0_0_24px_rgba(255,170,60,0.55)]">
        <div className="absolute inset-x-0 bottom-1 mx-auto h-2 w-3/4 rounded-sm bg-black/25" />
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-semibold tracking-wider text-amber-200">{t('admin.tables.pass')}</span>
      </div>

      {/* Counter edge + floor line */}
      <div className="absolute inset-x-0 bottom-[18px] h-2 bg-gradient-to-b from-[#bfc4cc] to-[#7d838d]" />
      <div className="absolute inset-x-0 bottom-0 h-[18px] bg-gradient-to-b from-[#2a2a2e] to-[#17171a]" />
    </div>
  )
}

function DraggableTable({ table, pos, highlighted, floorRef, onMove, onDrop, onMenu }) {
  const { t, tableLabel } = useLanguage()
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)

  function pointerDown(event) {
    if (event.button !== 0) return // right-click is for the menu
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startX: event.clientX, startY: event.clientY, origin: pos, moved: false, last: pos }
  }

  function pointerMove(event) {
    const d = drag.current
    const box = floorRef.current?.getBoundingClientRect()
    if (!d || !box) return

    const dx = event.clientX - d.startX
    const dy = event.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < 4) return

    d.moved = true
    setDragging(true)
    d.last = {
      x: clamp(d.origin.x + (dx / box.width) * 100, MIN_X, MAX_X),
      y: clamp(d.origin.y + (dy / box.height) * 100, MIN_Y, MAX_Y),
    }
    onMove(d.last)
  }

  function pointerUp(event) {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (d?.moved) onDrop(d.last)
    // A finger has no right-click or double-click: a simple tap opens the options.
    else if (d && event.type === 'pointerup' && event.pointerType === 'touch') {
      const r = floorRef.current.getBoundingClientRect()
      onMenu(event.clientX - r.left, event.clientY - r.top)
    }
  }

  const s = STATE[table.state]
  const round = table.seats >= 6
  const size = round ? 66 : 62
  const box = 128
  const seats = Math.min(table.seats, 10)

  const chairs = []
  if (round) {
    for (let i = 0; i < seats; i += 1) {
      const angle = (i / seats) * Math.PI * 2 - Math.PI / 2
      chairs.push({ x: box / 2 + Math.cos(angle) * 46, y: box / 2 + Math.sin(angle) * 46, w: 17, h: 17, round: true })
    }
  } else {
    const perSide = Math.min(seats, 4)
    const top = Math.ceil(perSide / 2)
    const bottom = Math.floor(perSide / 2)
    const place = (n, y) =>
      Array.from({ length: n }, (_, i) => ({ x: box / 2 + (i - (n - 1) / 2) * 26, y, w: 21, h: 11 }))
    chairs.push(...place(top, box / 2 - size / 2 - 9), ...place(bottom, box / 2 + size / 2 + 9))
    if (seats > 4) {
      const extra = seats - 4
      if (extra >= 1) chairs.push({ x: box / 2 - size / 2 - 9, y: box / 2, w: 11, h: 21 })
      if (extra >= 2) chairs.push({ x: box / 2 + size / 2 + 9, y: box / 2, w: 11, h: 21 })
    }
  }

  return (
    <div
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onDoubleClick={(e) => {
        const r = floorRef.current.getBoundingClientRect()
        onMenu(e.clientX - r.left, e.clientY - r.top)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        const r = floorRef.current.getBoundingClientRect()
        onMenu(e.clientX - r.left, e.clientY - r.top)
      }}
      role="button"
      tabIndex={0}
      aria-label={t('admin.tables.tableAria', { table: tableLabel(table.id), state: t(s.labelKey) })}
      className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none ${dragging ? 'z-30 cursor-grabbing' : 'z-10 cursor-grab'}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: box, height: box }}
    >
      {/* Soft shadow on the floor */}
      <span
        className="absolute rounded-full bg-black/50 blur-md"
        style={{ left: (box - size) / 2 - 4, top: (box - size) / 2 + 8, width: size + 8, height: size, borderRadius: round ? 999 : 14 }}
      />

      {chairs.map((c, i) => (
        <span
          key={i}
          className="absolute bg-gradient-to-b from-[#8b5e3c] to-[#5a3a22] shadow-[0_2px_4px_rgba(0,0,0,0.6)] ring-1 ring-black/40"
          style={{ left: c.x - c.w / 2, top: c.y - c.h / 2, width: c.w, height: c.h, borderRadius: c.round ? 999 : 5 }}
        />
      ))}

      {/* Wooden top, ringed with the status color */}
      <span
        className="absolute flex flex-col items-center justify-center text-white transition-transform"
        style={{
          left: (box - size) / 2,
          top: (box - size) / 2,
          width: size,
          height: size,
          borderRadius: round ? 999 : 12,
          border: `3px solid ${s.border}`,
          background:
            'repeating-linear-gradient(95deg, rgba(0,0,0,0.0) 0 7px, rgba(0,0,0,0.12) 7px 8px), linear-gradient(145deg, #a8794c, #6b4526)',
          boxShadow: highlighted
            ? `0 0 0 3px rgba(255,255,255,0.4), 0 0 24px ${s.border}`
            : `0 0 16px ${s.border}66, inset 0 2px 4px rgba(255,255,255,0.18)`,
          transform: dragging ? 'scale(1.08)' : 'none',
        }}
      >
        <span className="rounded-md bg-black/55 px-1.5 text-[17px] font-bold leading-[22px]">{table.id}</span>
        <span className="mt-0.5 flex items-center gap-0.5 rounded bg-black/45 px-1 text-[10px] text-white/90">
          <UsersRound size={10} /> {table.seats}
        </span>
      </span>
    </div>
  )
}

// Positions the options popup next to where the click happened.
function MenuPopup({ menu, floorRef, children }) {
  const { dir } = useLanguage()
  const width = 236
  const box = floorRef.current?.getBoundingClientRect()
  const left = clamp(menu.x + 8, 8, (box?.width || 800) - width - 8)
  const top = clamp(menu.y + 8, 8, (box?.height || 600) - 290)

  return (
    <div dir={dir} className="absolute z-40" style={{ left, top, width }}>
      {children}
    </div>
  )
}

function TableMenu({ table, busy, onSeats, onStatus, onRemove, onClose }) {
  const { t, tableLabel } = useLanguage()
  const ref = useRef(null)
  useClickOutside(ref, onClose, true)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const s = STATE[table.state]

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      className="fade-up rounded-xl border border-white/12 bg-[#151518] p-3 shadow-2xl shadow-black/70"
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-sm font-semibold text-white">{tableLabel(table.id)}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${s.badge}`}>{t(s.labelKey)}</span>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-white/[0.05] px-3 py-2">
        <span className="text-xs text-white/70">{t('admin.tables.places')}</span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={busy || table.seats <= 1}
            onClick={() => onSeats(table.seats - 1)}
            aria-label={t('admin.tables.fewerPlaces')}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
          >
            <Minus size={14} />
          </button>
          <span className="w-5 text-center text-sm font-semibold text-white">{table.seats}</span>
          <button
            type="button"
            disabled={busy || table.seats >= 20}
            onClick={() => onSeats(table.seats + 1)}
            aria-label={t('admin.tables.morePlaces')}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {table.state !== 'occupied' && (
        <div className="mt-2 grid grid-cols-1 gap-1">
          {[
            ['auto', t('admin.tables.state.available')],
            ['cleaning', t('admin.tables.state.cleaning')],
            ['out_of_service', t('admin.tables.state.out_of_service')],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() => onStatus(value)}
              className={`rounded-lg px-3 py-1.5 text-start text-xs transition ${
                table.override === value ? 'bg-[#d9151f] text-white' : 'text-white/80 hover:bg-white/[0.08]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={busy || table.state === 'occupied'}
        onClick={onRemove}
        className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 transition hover:bg-red-500/10 disabled:opacity-35"
      >
        <Trash2 size={14} /> {t('admin.tables.removeTable')}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

function AddTableModal({ nextId, onClose, onSave }) {
  const { t } = useLanguage()
  const [id, setId] = useState(nextId)
  const [seats, setSeats] = useState(4)
  const [saving, setSaving] = useState(false)

  return (
    <Modal title={t('admin.tables.addTitle')} subtitle={t('admin.tables.addSubtitle')} onClose={onClose}>
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
          <Field label={t('admin.tables.tableNumber')} hint={t('admin.tables.tableNumberHint')}>
            <input className="input" required value={id} onChange={(e) => setId(e.target.value)} />
          </Field>
          <Field label={t('admin.tables.places')}>
            <input className="input" type="number" min="1" max="20" value={seats} onChange={(e) => setSeats(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <GhostButton onClick={onClose}>{t('admin.tables.cancel')}</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? t('admin.tables.adding') : t('admin.tables.addButton')}</PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}

function LinksModal({ tables, onClose }) {
  const { t, tableLabel } = useLanguage()
  const [copied, setCopied] = useState('')

  const rows = [
    ...tables.map((tb) => ({ key: tb.id, label: tableLabel(tb.id), path: `/table/${tb.id}` })),
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
      window.prompt(t('admin.tables.copyPrompt'), url)
    }
  }

  return (
    <Modal wide title={t('admin.tables.linksTitle')} subtitle={t('admin.tables.linksSubtitle')} onClose={onClose}>
      <ul className="divide-y divide-white/[0.06]">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:flex-nowrap">
            <span className={`w-[110px] shrink-0 rounded-lg px-3 py-1 text-center text-xs font-semibold text-white ${row.special ? 'bg-[#8a4b0f]' : 'bg-[#5a0b10]'}`}>
              {row.label}
            </span>
            <code className="order-last min-w-0 basis-full truncate text-xs text-white/55 sm:order-none sm:flex-1 sm:basis-auto">
              {window.location.origin}{row.path}
            </code>
            {row.special && <span className="hidden text-[11px] text-amber-400/80 sm:block">{t('admin.tables.noTableOrders')}</span>}
            <button type="button" onClick={() => copy(row)} className="ms-auto flex items-center gap-1.5 sm:ms-0 rounded-lg bg-white/[0.07] px-3 py-1.5 text-xs text-white transition hover:bg-white/[0.14]">
              <Copy size={13} /> {copied === row.key ? t('admin.tables.copied') : t('admin.tables.copy')}
            </button>
            <a href={row.path} target="_blank" rel="noreferrer" aria-label={t('admin.tables.open', { label: row.label })} className="text-white/50 hover:text-white">
              <ExternalLink size={15} className="rtl:-scale-x-100" />
            </a>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
