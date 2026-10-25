import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronUp, Minus, Plus, Search, SquarePlus, Trash2, X } from 'lucide-react'
import { useIsDesktop } from '../useIsDesktop'
import { useLanguage } from '../../i18n/LanguageContext'
import { useAdminAuth } from '../AdminAuthContext'
import { useAdminShell } from '../AdminShellContext'
import { adminCreateOrder, adminFetchCategories, adminFetchMenuItems, adminFetchTables } from '../../services/api'
import FadeImage from '../../components/ui/FadeImage'
import { Card, CardTitle, ErrorBanner, GhostButton, PageTop, PrimaryButton, Spinner } from '../components/ui'

const MAX_NOTE = 300
const REFRESH_MS = 30000

// Same rounding the server uses, so the total shown here matches the order.
export const finalPrice = (item) =>
  Math.round(Number(item.price) * (1 - (Number(item.discountPercent) || 0) / 100))

export default function AdminNewOrder() {
  const { password } = useAdminAuth()
  const { refreshSummary } = useAdminShell()
  const { t, formatMoney, itemName, categoryName, tableLabel } = useLanguage()

  const [items, setItems] = useState(null)
  const [categories, setCategories] = useState([])
  const [tables, setTables] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false) // phone: the order opens as a sheet
  const isDesktop = useIsDesktop()

  const [lines, setLines] = useState({}) // itemId -> quantity
  const [tableId, setTableId] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null) // { number, table }

  const load = useCallback(async () => {
    try {
      const [menu, cats, tbs] = await Promise.all([
        adminFetchMenuItems(password),
        adminFetchCategories(password),
        adminFetchTables(password),
      ])
      setItems(Array.isArray(menu) ? menu : [])
      setCategories(Array.isArray(cats) ? cats : [])
      setTables(Array.isArray(tbs) ? tbs : [])
    } catch (err) {
      setError(err.message)
      setItems((current) => current || [])
    }
  }, [password])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const byId = useMemo(() => new Map((items || []).map((item) => [item.id, item])), [items])

  // The first category is open by default; typing in the search looks in all of them.
  const activeCategory = categories.some((c) => c.id === category) ? category : categories[0]?.id ?? null

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (items || []).filter((item) =>
      term
        ? item.name.toLowerCase().includes(term) || itemName(item).toLowerCase().includes(term)
        : activeCategory === null || item.categoryId === activeCategory,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, activeCategory])

  const orderLines = Object.entries(lines)
    .map(([id, quantity]) => ({ item: byId.get(Number(id)) ?? byId.get(id), quantity, id }))
    .filter((line) => line.item)
  const gone = orderLines.find((line) => !line.item.available)
  const count = orderLines.reduce((sum, line) => sum + line.quantity, 0)
  const total = orderLines.reduce((sum, line) => sum + finalPrice(line.item) * line.quantity, 0)

  const [flash, setFlash] = useState(null) // id of the tile just tapped
  const flashTimer = useRef(null)
  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const change = (item, delta) => {
    setSent(null)
    if (delta > 0) {
      setFlash(item.id)
      clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlash(null), 220)
    }
    setLines((current) => {
      const next = { ...current }
      const quantity = (next[item.id] || 0) + delta
      if (quantity <= 0) delete next[item.id]
      else next[item.id] = Math.min(quantity, 50)
      return next
    })
  }

  const tableOptions = tables.map((table) => {
    const closed = table.state === 'cleaning' || table.state === 'out_of_service'
    let label = tableLabel(table.id)
    if (closed) label += ` — ${t(`admin.tables.state.${table.state}`)}`
    else if (table.openOrders > 0) label += ` — ${t('admin.newOrder.hasOrder')}`
    return { id: table.id, label, closed }
  })

  const problem = !tableId
    ? t('admin.newOrder.needTable')
    : !count
      ? t('admin.newOrder.needDish')
      : gone
        ? t('admin.newOrder.gone', { name: itemName(gone.item) })
        : ''

  async function place() {
    if (problem || sending) return
    setSending(true)
    setError('')
    try {
      const result = await adminCreateOrder(password, {
        tableId,
        items: orderLines.map((line) => ({ id: line.item.id, quantity: line.quantity })),
        note,
      })
      setSent({ number: result.number ?? result.id, table: tableLabel(tableId) })
      setLines({})
      setNote('')
      setTableId('')
      setSheetOpen(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      refreshSummary?.({ silent: true })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const summaryPanel = (
    <>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-white/55">{t('admin.newOrder.table')}</span>
        <select className="input" value={tableId} onChange={(e) => { setTableId(e.target.value); setSent(null) }}>
          <option value="">{t('admin.newOrder.chooseTable')}</option>
          {tableOptions.map((option) => (
            <option key={option.id} value={option.id} disabled={option.closed}>{option.label}</option>
          ))}
        </select>
      </label>

      <ul className="mt-4 space-y-2">
        {orderLines.length === 0 && <li className="py-4 text-center text-sm text-white/45">{t('admin.newOrder.empty')}</li>}
        {orderLines.map(({ item, quantity }) => (
          <li key={item.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${item.available ? 'border-white/[0.07]' : 'border-amber-500/50 bg-amber-500/10'}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{itemName(item)}</p>
              <p className="text-xs text-white/50">{formatMoney(finalPrice(item) * quantity)}</p>
            </div>
            <button type="button" aria-label={t('admin.newOrder.removeAria', { name: itemName(item) })} onClick={() => change(item, -1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] lg:h-7 lg:w-7"><Minus size={14} /></button>
            <span className="w-5 text-center text-sm">{quantity}</span>
            <button type="button" aria-label={t('admin.newOrder.addAria', { name: itemName(item) })} onClick={() => change(item, 1)} disabled={!item.available} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] disabled:opacity-40 lg:h-7 lg:w-7"><Plus size={14} /></button>
            <button type="button" aria-label={t('admin.newOrder.removeAria', { name: itemName(item) })} onClick={() => change(item, -quantity)} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 hover:text-red-400 lg:h-7 lg:w-7"><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium text-white/55">{t('admin.newOrder.note')}</span>
        <textarea className="input min-h-[72px]" maxLength={MAX_NOTE} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('admin.newOrder.notePlaceholder')} />
      </label>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
        <span className="text-white/60">{t('admin.newOrder.total')}</span>
        <span className="text-xl font-bold text-white">{formatMoney(total)}</span>
      </div>

      {gone && <p role="alert" className="mt-3 text-sm text-amber-300">{t('admin.newOrder.gone', { name: itemName(gone.item) })}</p>}

      <PrimaryButton className="mt-4 w-full !py-3.5" disabled={Boolean(problem) || sending} onClick={place} title={problem || undefined}>
        {sending ? t('admin.newOrder.sending') : t('admin.newOrder.place')}
      </PrimaryButton>
      {orderLines.length > 0 && (
        <GhostButton className="mt-2 w-full" onClick={() => setLines({})}>{t('admin.newOrder.clear')}</GhostButton>
      )}
    </>
  )

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageTop icon={<SquarePlus size={26} />} title={t('admin.newOrder.title')} subtitle={t('admin.newOrder.subtitle')} />

      <ErrorBanner message={error} onClose={() => setError('')} />
      {sent && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <Check size={18} />
          <span className="font-medium">{t('admin.newOrder.sent', { number: sent.number, table: sent.table })}</span>
          <Link to={`/admin/orders?q=${encodeURIComponent(sent.number)}`} className="ms-auto underline">
            {t('admin.newOrder.viewOrders')}
          </Link>
        </div>
      )}

      {/* minmax(0, …) lets the columns shrink to the screen instead of stretching to the widest content */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 lg:rounded-2xl lg:border lg:border-white/[0.07] lg:bg-[#0f0f12] lg:p-5">
          {/* Search + categories stay in view while the dishes scroll (phones and tablets) */}
          <div className="sticky top-14 z-10 -mx-4 space-y-3 bg-[#09090b] px-4 pb-3 pt-1 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:p-0">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                className="input"
                style={{ paddingInlineStart: '2.5rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.newOrder.searchPlaceholder')}
                aria-label={t('admin.newOrder.searchPlaceholder')}
              />
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCategory(c.id); setSearch('') }}
                  aria-pressed={!search.trim() && activeCategory === c.id}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
                    !search.trim() && activeCategory === c.id ? 'border-[#d9151f] bg-[#d9151f] text-white' : 'border-white/10 bg-[#121215] text-white/75 hover:bg-white/5'
                  }`}
                >
                  {categoryName(c)}
                </button>
              ))}
            </div>
          </div>

          {items === null ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-white/45">{t('admin.newOrder.noDishes')}</p>
          ) : (
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] sm:gap-3 lg:mt-4">
              {visible.map((item) => {
                const qty = lines[item.id] || 0
                const name = itemName(item)
                const discounted = Number(item.discountPercent) > 0
                return (
                  <div
                    key={item.id}
                    data-testid="dish-tile"
                    onClick={item.available ? () => change(item, 1) : undefined}
                    className={`flex min-w-0 select-none items-center gap-3 overflow-hidden rounded-2xl border bg-[#0f0f12] p-2.5 transition duration-150 sm:flex-col sm:items-stretch sm:gap-0 lg:bg-[#0b0b0d] ${qty ? 'border-[#d9151f]' : 'border-white/[0.07]'} ${item.available ? 'cursor-pointer' : 'opacity-50'} ${flash === item.id ? 'translate-y-1.5 scale-[0.98]' : ''}`}
                  >
                    <FadeImage src={item.image} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-white/5 sm:h-24 sm:w-full" />
                    <div className="min-w-0 flex-1 sm:mt-2 sm:flex-none">
                      <h3 className="truncate text-sm font-semibold text-white" title={name}>{name}</h3>
                      <p className="mt-0.5 text-sm font-bold text-white">
                        {formatMoney(finalPrice(item))}
                        {discounted && <span className="ms-1.5 text-[11px] font-normal text-white/40 line-through" dir="auto">{formatMoney(item.price)}</span>}
                      </p>
                    </div>
                    <div className="shrink-0 sm:mt-2">
                      {!item.available ? (
                        <span className="text-xs text-white/50">{t('admin.newOrder.unavailable')}</span>
                      ) : qty ? (
                        <div className="flex items-center justify-between gap-1 rounded-xl bg-white/[0.06] p-1 sm:gap-0">
                          <button type="button" aria-label={t('admin.newOrder.removeAria', { name })} onClick={(e) => { e.stopPropagation(); change(item, -1) }} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"><Minus size={16} /></button>
                          <span className="min-w-5 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
                          <button type="button" aria-label={t('admin.newOrder.addAria', { name })} onClick={(e) => { e.stopPropagation(); change(item, 1) }} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"><Plus size={16} /></button>
                        </div>
                      ) : (
                        <button type="button" aria-label={t('admin.newOrder.addAria', { name })} onClick={(e) => { e.stopPropagation(); change(item, 1) }} className="flex h-11 w-11 items-center justify-center gap-1.5 rounded-xl bg-[#d9151f] text-sm font-medium text-white hover:bg-[#f0222c] sm:h-9 sm:w-full">
                          <Plus size={16} /> <span className="hidden sm:inline">{t('admin.newOrder.add')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Computers: the order sits beside the dishes */}
        {isDesktop && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Card className="p-5">
              <CardTitle title={t('admin.newOrder.summary')} />
              <div className="mt-4">{summaryPanel}</div>
            </Card>
          </div>
        )}
      </div>

      {/* Phones and tablets: a bar with the total; tapping it opens the order as a sheet */}
      {!isDesktop && (count > 0 || sheetOpen) && !sheetOpen && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-white/10 bg-[#0b0b0d]/95 p-3 backdrop-blur">
          <PrimaryButton className="w-full justify-between !py-3.5" onClick={() => setSheetOpen(true)}>
            <span className="flex items-center gap-2"><ChevronUp size={18} /> {t('admin.newOrder.review')} · {t('admin.newOrder.itemsCount', { count })}</span>
            <span>{formatMoney(total)}</span>
          </PrimaryButton>
        </div>
      )}

      {!isDesktop && sheetOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/70" onMouseDown={(e) => { if (e.target === e.currentTarget) setSheetOpen(false) }}>
          <div className="fade-up max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#101013] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:mx-auto sm:max-w-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{t('admin.newOrder.summary')}</h2>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label={t('admin.ui.close')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70"><X size={18} /></button>
            </div>
            {summaryPanel}
          </div>
        </div>
      )}
    </div>
  )
}
