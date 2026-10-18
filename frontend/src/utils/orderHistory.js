// ---------------------------------------------------------------------------
// The customer's order history — kept on THIS phone only.
//
// Every order that is shown on the phone is remembered here (what was ordered,
// what it cost, when, its number and its latest status). Nothing is removed
// when the customer taps "Done" on the progress sheet: an order stays in the
// history until 24 hours after it was placed, then it disappears by itself.
//
// Storage can be blocked (private mode) or hold junk (an old version, someone
// editing it), so every read checks the shape of what it finds and every
// write is wrapped: the app keeps working without a history instead of
// crashing.
// ---------------------------------------------------------------------------

const KEY = 'mtc-order-history'

// An order stays in the history for this long after it was PLACED.
export const HISTORY_TTL_MS = 24 * 60 * 60 * 1000

// A phone will never order this many times a day; the cap only protects
// the storage from growing without limit.
const MAX_ORDERS = 40
const MAX_ITEMS_PER_ORDER = 60

export const FINAL_STATUSES = ['ready', 'completed', 'cancelled']
const STATUSES = ['preparing', 'almost', 'ready', 'completed', 'cancelled']

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

// Returns a clean copy of an order, or null if it does not look like one.
export function cleanOrder(raw) {
  if (!raw || typeof raw !== 'object') return null

  const id = Number(raw.id)
  if (!Number.isInteger(id) || id < 1) return null

  const created = new Date(raw.createdAt)
  if (Number.isNaN(created.getTime())) return null

  if (!STATUSES.includes(raw.status)) return null
  if (!isNumber(raw.total) || raw.total < 0) return null
  if (!Array.isArray(raw.items)) return null

  const items = []
  for (const line of raw.items.slice(0, MAX_ITEMS_PER_ORDER)) {
    if (!line || typeof line !== 'object') return null
    if (typeof line.name !== 'string' || !isNumber(line.quantity) || !isNumber(line.unitPrice)) return null
    items.push({
      id: typeof line.id === 'string' || typeof line.id === 'number' ? line.id : undefined,
      name: line.name.slice(0, 200),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })
  }

  const number = Number(raw.number)

  return {
    id,
    // The "#22" people see. Older servers did not send one: use the id.
    number: Number.isInteger(number) && number > 0 ? number : id,
    tableId: String(raw.tableId ?? ''),
    status: raw.status,
    total: raw.total,
    createdAt: created.toISOString(),
    items,
  }
}

export const isExpired = (order, now = Date.now()) =>
  now - new Date(order.createdAt).getTime() >= HISTORY_TTL_MS

// Newest first.
const newestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id

function readRaw() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(orders) {
  try {
    localStorage.setItem(KEY, JSON.stringify(orders))
  } catch {
    // storage blocked or full — the history simply is not saved
  }
}

// The orders of the last 24 hours, newest first. Anything older (or broken)
// is dropped from the storage while we are at it.
export function readHistory(now = Date.now()) {
  const stored = readRaw()
  const seen = new Set()
  const kept = []

  for (const raw of stored) {
    const order = cleanOrder(raw)
    if (!order || isExpired(order, now) || seen.has(order.id)) continue
    seen.add(order.id)
    kept.push(order)
  }

  kept.sort(newestFirst)
  const result = kept.slice(0, MAX_ORDERS)

  if (result.length !== stored.length) writeRaw(result)
  return result
}

// Adds an order, or refreshes it if it is already there (new status, dishes
// added to it...). Returns the updated history.
export function rememberOrder(order, now = Date.now()) {
  const clean = cleanOrder(order)
  if (!clean || isExpired(clean, now)) return readHistory(now)

  const others = readHistory(now).filter((existing) => existing.id !== clean.id)
  const next = [clean, ...others].sort(newestFirst).slice(0, MAX_ORDERS)
  writeRaw(next)
  return next
}

export function forgetOrder(id, now = Date.now()) {
  const next = readHistory(now).filter((order) => order.id !== id)
  writeRaw(next)
  return next
}
