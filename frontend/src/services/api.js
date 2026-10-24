// ---------------------------------------------------------------------------
// This file is the ONLY place in the app that talks to the backend.
//
// Base URL: set VITE_API_URL in a .env file to point at your backend
// (see frontend/.env.example). Defaults to localhost for local dev.
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'


// Pictures uploaded from the dashboard are stored by the backend and referenced
// as "/uploads/<id>". The browser needs the full address to show them, so the
// loaders below turn that into `<API>/uploads/<id>` — and turn it back before
// saving, so the database only ever holds the short form.
export function resolveImage(path) {
  return typeof path === 'string' && path.startsWith('/uploads/') ? `${API_BASE}${path}` : path
}

export function rawImage(url) {
  return typeof url === 'string' && url.startsWith(`${API_BASE}/uploads/`) ? url.slice(API_BASE.length) : url
}

const withImage = (row) => (row && typeof row === 'object' ? { ...row, image: resolveImage(row.image) } : row)

async function request(path, { method = 'GET', body, password, rawBody, rawType } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (rawBody) headers['Content-Type'] = rawType
  if (password) headers['x-admin-password'] = password

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: rawBody ?? (body ? JSON.stringify(body) : undefined),
  })

  let data
  let parsed = true
  try {
    data = await response.json()
  } catch {
    data = {}
    parsed = false
  }

  // A 200 whose body is not JSON (a proxy's error page, a sleeping host's
  // placeholder...) is NOT a real answer. Report it like a network problem,
  // so callers keep their fallbacks and retry instead of using empty data.
  if (response.ok && !parsed) {
    throw new Error(`The server sent an unexpected answer for ${path}.`)
  }

  // The server no longer accepts the saved staff password (it was changed):
  // tell the dashboard so it can send the person back to the login screen.
  if (response.status === 401 && password && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('mtc-admin-unauthorized'))
  }

  if (!response.ok) {
    const error = new Error(data.error || `Request to ${path} failed (${response.status})`)
    // Lets callers tell "the server said no" (404, 409...) apart from
    // "the server could not be reached" (no status at all).
    error.status = response.status
    throw error
  }

  return data
}

// ---------------------------------------------------------------------
// Public — used by the customer-facing app
// ---------------------------------------------------------------------

export async function fetchMenu() {
  const data = await request('/menu')
  return {
    ...data,
    categories: Array.isArray(data?.categories) ? data.categories.map(withImage) : data?.categories,
    items: Array.isArray(data?.items) ? data.items.map(withImage) : data?.items,
  }
}

export function fetchTables() {
  return request('/tables')
}

export function fetchTable(id) {
  return request(`/tables/${encodeURIComponent(id)}`)
}

export function fetchChatbotFaqs() {
  return request('/chatbot/faqs')
}

export function submitOrder({ tableId, items, note }) {
  // Only id + quantity are sent on purpose — the server looks up the real
  // name and price itself rather than trusting what the browser sends.
  // `note` is the customer's free text for the kitchen (optional).
  const trimmedItems = items.map((item) => ({ id: item.id, quantity: item.quantity }))
  const body = { tableId, items: trimmedItems }
  if (note && note.trim()) body.note = note.trim()
  return request('/orders', { method: 'POST', body })
}

export function getOrder(orderId) {
  return request(`/orders/${orderId}`)
}

export function getActiveOrderForTable(tableId) {
  return request(`/orders/table/${encodeURIComponent(tableId)}/active`)
}

export function addItemsToOrder(orderId, items, note) {
  const trimmedItems = items.map((item) => ({ id: item.id, quantity: item.quantity }))
  const body = { items: trimmedItems }
  if (note && note.trim()) body.note = note.trim()
  return request(`/orders/${orderId}/items`, { method: 'POST', body })
}

// The "Call waiter" button.
export function callWaiter(tableId) {
  return request('/waiter-calls', { method: 'POST', body: { tableId } })
}

export function getWaiterCall(id) {
  return request(`/waiter-calls/${id}`)
}

export function cancelOrder(orderId) {
  return request(`/orders/${orderId}/cancel`, { method: 'PATCH' })
}

// ---------------------------------------------------------------------
// Admin — every call needs the dashboard password. A wrong or missing
// password comes back as a normal thrown Error (see `request` above),
// which is what the "Incorrect password" UI everywhere here catches.
// ---------------------------------------------------------------------

export function adminLogin(password) {
  return request('/admin/login', { method: 'POST', body: { password } })
}

export async function adminFetchCategories(password) {
  const rows = await request('/admin/categories', { password })
  return Array.isArray(rows) ? rows.map(withImage) : rows
}

export async function adminFetchMenuItems(password) {
  const rows = await request('/admin/menu-items', { password })
  return Array.isArray(rows) ? rows.map(withImage) : rows
}

export async function adminCreateMenuItem(password, item) {
  const created = await request('/admin/menu-items', {
    method: 'POST',
    body: { ...item, image: rawImage(item.image) },
    password,
  })
  return withImage(created)
}

export async function adminUpdateMenuItem(password, id, changes) {
  const updated = await request(`/admin/menu-items/${id}`, {
    method: 'PUT',
    body: changes.image === undefined ? changes : { ...changes, image: rawImage(changes.image) },
    password,
  })
  return withImage(updated)
}

// Sends one picture (a Blob/File of type image/jpeg, png, webp or gif) and
// returns its short path, e.g. "/uploads/12".
export function adminUploadImage(password, blob) {
  return request('/admin/uploads', { method: 'POST', password, rawBody: blob, rawType: blob.type })
}

export function adminResolveWaiterCall(password, id) {
  return request(`/admin/waiter-calls/${id}/resolve`, { method: 'PATCH', password })
}

export function adminDeleteMenuItem(password, id) {
  return request(`/admin/menu-items/${id}`, { method: 'DELETE', password })
}

export function adminFetchTables(password) {
  return request('/admin/tables', { password })
}

export function adminCreateTable(password, table) {
  return request('/admin/tables', { method: 'POST', body: table, password })
}

export function adminUpdateTable(password, id, changes) {
  return request(`/admin/tables/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes, password })
}

export async function adminCreateCategory(password, category) {
  return withImage(await request('/admin/categories', { method: 'POST', body: category, password }))
}

export function adminDeleteCategory(password, id, { withDishes = false } = {}) {
  const query = withDishes ? '?withDishes=true' : ''
  return request(`/admin/categories/${encodeURIComponent(id)}${query}`, { method: 'DELETE', password })
}

export function adminDeleteTable(password, id) {
  return request(`/admin/tables/${id}`, { method: 'DELETE', password })
}

export function adminFetchFaqs(password) {
  return request('/admin/chatbot-faqs', { password })
}

export function adminCreateFaq(password, faq) {
  return request('/admin/chatbot-faqs', { method: 'POST', body: faq, password })
}

export function adminUpdateFaq(password, id, changes) {
  return request(`/admin/chatbot-faqs/${id}`, { method: 'PUT', body: changes, password })
}

export function adminDeleteFaq(password, id) {
  return request(`/admin/chatbot-faqs/${id}`, { method: 'DELETE', password })
}

export function adminFetchOrders(password, range = 'today') {
  return request(`/admin/orders?range=${encodeURIComponent(range)}`, { password })
}

export function adminFetchOrder(password, id) {
  return request(`/admin/orders/${encodeURIComponent(id)}`, { password })
}

export function adminFetchSummary(password) {
  return request('/admin/summary', { password })
}

export function adminFetchOverview(password, range = 'today') {
  return request(`/admin/overview?range=${encodeURIComponent(range)}`, { password })
}

// Sales report. `range` is today | yesterday | week | last30 | month |
// lastmonth | custom (custom also needs `from` and `to`, as YYYY-MM-DD).
export function adminFetchReport(password, { range = 'week', from, to } = {}) {
  const query = new URLSearchParams({ range })
  if (range === 'custom') {
    query.set('from', from || '')
    query.set('to', to || '')
  }
  return request(`/admin/reports?${query}`, { password })
}

// A waiter places an order from the dashboard (guest without a phone).
// Only id + quantity are sent: the server uses its own names and prices.
export function adminCreateOrder(password, { tableId, items, note }) {
  const body = { tableId, items: items.map((item) => ({ id: item.id, quantity: item.quantity })) }
  if (note && note.trim()) body.note = note.trim()
  return request('/admin/orders', { method: 'POST', body, password })
}

export function adminMoveOrder(password, id, tableId) {
  return request(`/admin/orders/${id}/move`, { method: 'PATCH', body: { tableId }, password })
}

export function adminMergeOrders(password, fromOrderId, intoOrderId) {
  return request('/admin/orders/merge', { method: 'POST', body: { fromOrderId, intoOrderId }, password })
}

export function adminUpdateOrderStatus(password, id, status) {
  return request(`/admin/orders/${id}/status`, { method: 'PATCH', body: { status }, password })
}

export function adminFetchEarningsToday(password) {
  return request('/admin/earnings/today', { password })
}
