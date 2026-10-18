import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../services/api', () => ({ getOrder: vi.fn() }))

import { getOrder } from '../services/api'
import {
  HISTORY_TTL_MS,
  cleanOrder,
  forgetOrder,
  readHistory,
  rememberOrder,
} from '../utils/orderHistory'
import { LanguageProvider } from '../i18n/LanguageContext'
import OrderHistoryPanel from '../components/history/OrderHistoryPanel'

const HOUR = 3600 * 1000
const NOW = new Date('2026-10-18T12:00:00Z').getTime()
const ago = (ms) => new Date(NOW - ms).toISOString()

const order = (id, extra = {}) => ({
  id,
  number: id,
  tableId: '4',
  status: 'preparing',
  total: 900,
  createdAt: ago(HOUR),
  items: [{ id: 'pizza-1', name: 'Margherita', quantity: 2, unitPrice: 450 }],
  ...extra,
})

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

describe('order history storage (24 hours)', () => {
  it('keeps an order until 24 hours after it was placed — then drops it', () => {
    rememberOrder(order(1, { createdAt: ago(23 * HOUR + 59 * 60000) }), NOW)
    expect(readHistory(NOW).map((o) => o.id)).toEqual([1])

    // one minute later it is 24h old: gone
    expect(readHistory(NOW + 2 * 60000)).toEqual([])
    expect(HISTORY_TTL_MS).toBe(24 * HOUR)
  })

  it('does not even store an order that is already older than 24 hours', () => {
    rememberOrder(order(1, { createdAt: ago(25 * HOUR) }), NOW)
    expect(readHistory(NOW)).toEqual([])
  })

  it('updating an order replaces it (new status / added dishes), never duplicates it', () => {
    rememberOrder(order(7), NOW)
    rememberOrder(order(7, { status: 'ready', total: 1350, items: [{ id: 'a', name: 'A', quantity: 3, unitPrice: 450 }] }), NOW)
    const list = readHistory(NOW)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 7, status: 'ready', total: 1350 })
  })

  it('lists the newest order first and can forget one', () => {
    rememberOrder(order(1, { createdAt: ago(5 * HOUR) }), NOW)
    rememberOrder(order(2, { createdAt: ago(1 * HOUR) }), NOW)
    rememberOrder(order(3, { createdAt: ago(3 * HOUR) }), NOW)
    expect(readHistory(NOW).map((o) => o.id)).toEqual([2, 3, 1])
    expect(forgetOrder(3, NOW).map((o) => o.id)).toEqual([2, 1])
  })

  it('shows the daily number, and falls back to the id when the server sent none', () => {
    rememberOrder(order(901, { number: 22 }), NOW)
    rememberOrder(order(902, { number: undefined }), NOW)
    const byId = Object.fromEntries(readHistory(NOW).map((o) => [o.id, o.number]))
    expect(byId).toEqual({ 901: 22, 902: 902 })
  })

  it('survives corrupted storage instead of crashing', () => {
    for (const junk of ['not json', '{"a":1}', 'null', '[1,"x",null,{"id":"zzz"}]', '[{"id":1}]']) {
      localStorage.setItem('mtc-order-history', junk)
      expect(readHistory(NOW)).toEqual([])
    }
    expect(cleanOrder({ ...order(1), status: 'exploded' })).toBeNull()
    expect(cleanOrder({ ...order(1), createdAt: 'yesterday-ish' })).toBeNull()
    expect(cleanOrder({ ...order(1), items: 'pizza' })).toBeNull()
    expect(cleanOrder(null)).toBeNull()
  })

  it('keeps working when the browser blocks storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => rememberOrder(order(1), NOW)).not.toThrow()
    spy.mockRestore()
  })
})

describe('order history panel', () => {
  const renderPanel = () =>
    render(
      <LanguageProvider scope="customer">
        <OrderHistoryPanel open onClose={() => {}} />
      </LanguageProvider>,
    )

  it('explains itself when there is nothing yet', async () => {
    getOrder.mockReset()
    renderPanel()
    expect(await screen.findByText('No orders yet')).toBeTruthy()
    expect(screen.getByText(/stay here for 24 hours/i)).toBeTruthy()
  })

  it('shows number, table, dishes with costs, total and the final status — Ready and Cancelled', async () => {
    const now = Date.now()
    const recent = (h) => new Date(now - h * HOUR).toISOString()
    rememberOrder(order(1, { number: 22, status: 'ready', createdAt: recent(2), items: [{ id: 'a', name: 'Margherita', quantity: 3, unitPrice: 450 }], total: 1350 }), now)
    rememberOrder(order(2, { number: 23, status: 'cancelled', tableId: 'home', createdAt: recent(1), items: [{ id: 'b', name: 'Soup', quantity: 1, unitPrice: 300 }], total: 300 }), now)
    // the server confirms what the phone remembers
    getOrder.mockImplementation(async (id) => readHistory().find((o) => o.id === Number(id)))

    renderPanel()

    expect(await screen.findByText('#22')).toBeTruthy()
    expect(screen.getByText('#23')).toBeTruthy()
    expect(screen.getByText('Ready')).toBeTruthy()
    expect(screen.getByText('Cancelled')).toBeTruthy()
    expect(screen.getByText('To Home')).toBeTruthy()
    expect(screen.getByText('450 DH each')).toBeTruthy()
    expect(screen.getAllByText('1,350 DH').length).toBeGreaterThan(0) // the dish line and the total
  })

  it('picks up a newer status from the server (Preparing -> Ready)', async () => {
    const now = Date.now()
    rememberOrder(order(5, { number: 5, status: 'preparing', createdAt: new Date(now - HOUR).toISOString() }), now)
    getOrder.mockResolvedValue(order(5, { number: 5, status: 'ready', createdAt: new Date(now - HOUR).toISOString() }))

    renderPanel()
    await waitFor(() => expect(screen.getByText('Ready')).toBeTruthy())
  })

  it('drops an order the restaurant no longer has, but keeps it when the network is down', async () => {
    const now = Date.now()
    const t = (h) => new Date(now - h * HOUR).toISOString()
    rememberOrder(order(8, { number: 8, createdAt: t(2) }), now)
    rememberOrder(order(9, { number: 9, createdAt: t(1) }), now)
    getOrder.mockImplementation(async (id) => {
      if (Number(id) === 8) throw Object.assign(new Error('gone'), { status: 404 })
      throw new Error('Failed to fetch') // offline
    })

    renderPanel()
    await waitFor(() => expect(screen.queryByText('#8')).toBeNull())
    expect(screen.getByText('#9')).toBeTruthy()
  })
})
