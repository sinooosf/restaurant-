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

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || `Request to ${path} failed (${response.status})`)
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

export function adminFetchOrders(password) {
  return request('/admin/orders', { password })
}

export function adminUpdateOrderStatus(password, id, status) {
  return request(`/admin/orders/${id}/status`, { method: 'PATCH', body: { status }, password })
}

export function adminFetchEarningsToday(password) {
  return request('/admin/earnings/today', { password })
}
