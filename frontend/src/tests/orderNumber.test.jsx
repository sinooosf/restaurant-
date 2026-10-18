import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Today's orders as the server sends them: `id` is the database id (never
// shown), `number` is the "#22" that staff and customer both see.
const TODAY = [
  { id: 901, number: 22, tableId: '4', status: 'preparing', total: 450, createdAt: new Date().toISOString(), items: [{ id: 'pizza-1', name: 'Margherita', quantity: 1, unitPrice: 450 }] },
  { id: 902, number: 23, tableId: '2', status: 'ready', total: 300, createdAt: new Date().toISOString(), items: [{ id: 'pizza-1', name: 'Margherita', quantity: 1, unitPrice: 300 }] },
]

vi.mock('../services/api', () => ({
  adminFetchOverview: vi.fn(),
  adminFetchOrders: vi.fn(async () => ({ orders: TODAY, counts: {} })),
  adminFetchTables: vi.fn(async () => []),
  adminFetchMenuItems: vi.fn(async () => []),
  adminFetchCategories: vi.fn(async () => []),
  adminFetchOrder: vi.fn(async (_pw, id) => TODAY.find((o) => String(o.id) === String(id))),
}))

import { adminFetchOrder } from '../services/api'
import { answer } from '../admin/assistant'
import { orderNumber } from '../admin/components/format'

describe('the order number (#22) — not the database id', () => {
  it('orderNumber shows the daily number, and falls back to the id for an old server', () => {
    expect(orderNumber({ id: 901, number: 22 })).toBe(22)
    expect(orderNumber({ id: 901 })).toBe(901)
  })

  it('the staff assistant finds "order #22" by the number they see on the dashboard', async () => {
    const reply = await answer('what is in order #22', 'pw', 'en')
    expect(reply.text).toContain('#22')
    expect(reply.text).not.toContain('901')
    expect(adminFetchOrder).toHaveBeenCalledWith('pw', 901) // fetched by the real id behind the scenes
  })

  it('"order #901" is NOT found: 901 is a database id, not an order number of today', async () => {
    const reply = await answer('order #901', 'pw', 'en')
    expect(reply.text).toMatch(/couldn't find an order #901/i)
  })

  it('lists of orders print numbers, not ids', async () => {
    const reply = await answer('which orders are ready?', 'pw', 'en')
    const labels = (reply.bullets || []).map((b) => b.label).join(' ')
    expect(labels).toContain('#23')
    expect(labels).not.toContain('902')
  })
})

// ---- the customer's tracking sheet --------------------------------------
vi.mock('../context/OrderContext', () => ({
  useOrder: () => ({
    order: { id: 901, number: 22, tableId: '4', status: 'preparing', total: 450, items: [{ id: 'pizza-1', name: 'Margherita', quantity: 1, unitPrice: 450 }] },
    stages: ['preparing', 'almost', 'ready'],
    trackingVisible: true,
    hideTracking: () => {},
    cancel: () => {},
    finishOrder: () => {},
  }),
}))

import { LanguageProvider } from '../i18n/LanguageContext'
import OrderTracking from '../components/order/OrderTracking'

describe('customer tracking sheet', () => {
  it('shows the same #22 the dashboard shows, labelled for screen readers', () => {
    render(
      <LanguageProvider scope="customer">
        <OrderTracking />
      </LanguageProvider>,
    )
    const badge = screen.getByText('#22')
    expect(badge.closest('[aria-label]').getAttribute('aria-label')).toBe('Order #22')
    expect(screen.queryByText('#901')).toBeNull()
  })
})
