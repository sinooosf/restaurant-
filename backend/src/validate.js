// Small input checks shared by the routes. Every value that arrives from a
// browser is untrusted: a wrong TYPE (an object where text is expected), a
// number that is too big, or a strange character must produce a clear
// 400/404 answer — never a crash (500).

export const MAX_LINES_PER_ORDER = 50
export const MAX_QUANTITY = 99
export const MAX_PRICE = 100000 // DH. Keeps every order total far below the database's integer limit.

export const isText = (value, max = 200) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max && !value.includes('\u0000')

export const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max

// Order and FAQ ids are plain positive numbers.
export function numericId(req, res, next) {
  if (!/^[1-9]\d{0,8}$/.test(req.params.id)) {
    return res.status(404).json({ error: 'Not found.' })
  }
  next()
}

// Text ids (tables, dishes, categories): refuse the characters Postgres cannot
// store and absurd lengths before they reach a query.
export function safeTextId(req, res, next, value) {
  if (typeof value !== 'string' || value.length > 200 || value.includes('\u0000')) {
    return res.status(404).json({ error: 'Not found.' })
  }
  next()
}

// A table id from a request body: text or a whole number.
export function normalizeTableId(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return String(value)
  if (typeof value === 'string' && value.length > 0 && value.length <= 40 && !value.includes('\u0000')) return value
  return null
}

// A free-text note (kitchen note, dish description). Empty/missing is fine.
// Returns { value } (trimmed) or { error }.
export function cleanNote(value, max) {
  if (value === undefined || value === null) return { value: '' }
  if (typeof value !== 'string' || value.includes('\u0000')) return { error: 'The note must be text.' }
  const trimmed = value.trim()
  if (trimmed.length > max) return { error: `The note can be at most ${max} characters.` }
  return { value: trimmed }
}

export const MAX_ORDER_NOTE = 300
export const MAX_DISH_NOTE = 120

export const MAX_ADDRESS = 300

// A delivery phone number: 6–15 digits, optionally starting with "+", and
// spaces, dots, dashes or brackets between them ("0555 12 34 56",
// "+213 555 123 456"). Returns { value } (tidied) or { error }.
export function cleanPhone(value) {
  if (typeof value !== 'string' || value.includes('\u0000')) return { error: 'A phone number is required for delivery.' }
  const text = value.trim().replace(/\s+/g, ' ')
  const digits = text.replace(/[\s.\-()]/g, '')
  if (text.length > 25 || !/^\+?\d{6,15}$/.test(digits)) {
    return { error: 'Please enter a valid phone number for delivery.' }
  }
  return { value: text }
}

// A delivery address, written like a note (several lines are fine).
// Returns { value } (trimmed) or { error }.
export function cleanAddress(value) {
  if (typeof value !== 'string' || value.includes('\u0000') || value.trim().length === 0) {
    return { error: 'A delivery address is required.' }
  }
  const text = value.trim()
  if (text.length > MAX_ADDRESS) return { error: `The address can be at most ${MAX_ADDRESS} characters.` }
  return { value: text }
}

// Turns the `items` array of an order into clean lines, or an error message.
//   [{ id, quantity }]  ->  { lines } | { error }
export function parseOrderLines(items) {
  if (!Array.isArray(items) || items.length === 0) return { error: 'Cannot place an empty order.' }
  if (items.length > MAX_LINES_PER_ORDER) {
    return { error: `An order can have at most ${MAX_LINES_PER_ORDER} different dishes.` }
  }

  const lines = []
  for (const raw of items) {
    const id = raw?.id
    let quantity = raw?.quantity
    if (typeof quantity === 'string' && /^\d{1,3}$/.test(quantity)) quantity = Number(quantity)

    if (!isText(id, 100) || !isInt(quantity, 1, MAX_QUANTITY)) {
      return { error: `Each item needs a valid id and a quantity from 1 to ${MAX_QUANTITY}.` }
    }
    lines.push({ id, quantity })
  }
  return { lines }
}

// Checks the fields of a dish. `partial` = an edit (only validate what is sent).
export function checkDish(body, { partial = false } = {}) {
  const b = body && typeof body === 'object' ? body : {}
  const has = (k) => b[k] !== undefined && b[k] !== null

  if (!partial || has('name')) if (!isText(b.name, 120)) return 'The name must be 1–120 characters.'
  if (!partial || has('categoryId')) if (!isText(b.categoryId, 80)) return 'Choose a category.'
  if (!partial || has('image')) if (!isText(b.image, 500)) return 'The image path is required.'
  if (!partial || has('price')) if (!isInt(b.price, 0, MAX_PRICE)) return `The price must be a whole number from 0 to ${MAX_PRICE}.`
  if (has('discountPercent') && !isInt(b.discountPercent, 0, 90)) return 'The discount must be a whole number from 0 to 90.'
  if (has('available') && typeof b.available !== 'boolean') return '"available" must be true or false.'
  if (has('isBest') && typeof b.isBest !== 'boolean') return '"isBest" must be true or false.'
  if (has('description') && cleanNote(b.description, MAX_DISH_NOTE).error) return `The dish note must be text of at most ${MAX_DISH_NOTE} characters.`
  return null
}
