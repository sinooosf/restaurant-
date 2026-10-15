// ---------------------------------------------------------------------------
// This file is the ONLY place in the app that talks to the backend.
//
// Base URL: set VITE_API_URL in a .env file to point at your backend
// (see frontend/.env.example). Defaults to localhost for local dev.
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'


async function request(path, { method = 'GET', body, password } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (password) headers['x-admin-password'] = password

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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

export function fetchMenu() {
  return request('/menu')
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

export function submitOrder({ tableId, items }) {
  // Only id + quantity are sent on purpose — the server looks up the real
  // name and price itself rather than trusting what the browser sends.
  const trimmedItems = items.map((item) => ({ id: item.id, quantity: item.quantity }))
  return request('/orders', { method: 'POST', body: { tableId, items: trimmedItems } })
}

export function getOrder(orderId) {
  return request(`/orders/${orderId}`)
}

export function getActiveOrderForTable(tableId) {
  return request(`/orders/table/${encodeURIComponent(tableId)}/active`)
}

export function addItemsToOrder(orderId, items) {
  const trimmedItems = items.map((item) => ({ id: item.id, quantity: item.quantity }))
  return request(`/orders/${orderId}/items`, { method: 'POST', body: { items: trimmedItems } })
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

export function adminFetchCategories(password) {
  return request('/admin/categories', { password })
}

export function adminFetchMenuItems(password) {
  return request('/admin/menu-items', { password })
}

export function adminCreateMenuItem(password, item) {
  return request('/admin/menu-items', { method: 'POST', body: item, password })
}

export function adminUpdateMenuItem(password, id, changes) {
  return request(`/admin/menu-items/${id}`, { method: 'PUT', body: changes, password })
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

export function adminCreateCategory(password, category) {
  return request('/admin/categories', { method: 'POST', body: category, password })
}

export function adminDeleteCategory(password, id) {
  return request(`/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE', password })
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
