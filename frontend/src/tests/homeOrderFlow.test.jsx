import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// A tiny fake "server" holding one order. The tests change its status the way
// a staff member clicking through the dashboard would, and can switch the
// server off (asleep / no signal).
const server = { order: null, down: false, orderCalls: 0 }

const networkError = () => new Error('Failed to fetch') // no `status`: the server was never reached

vi.mock('../services/api', () => ({
  submitOrder: vi.fn(async ({ tableId, items }) => {
    server.order = {
      id: 77,
      number: 5,
      tableId,
      status: 'preparing',
      total: 300,
      createdAt: new Date().toISOString(),
      items: items.map((i) => ({ id: i.id, name: 'Dish', quantity: i.quantity, unitPrice: 300 })),
    }
    return { ...server.order }
  }),
  addItemsToOrder: vi.fn(),
  getOrder: vi.fn(async (id) => {
    server.orderCalls += 1
    if (server.down) throw networkError()
    if (!server.order || String(server.order.id) !== String(id)) {
      const error = new Error('Order not found.')
      error.status = 404
      throw error
    }
    return { ...server.order }
  }),
  // Tables: the shared "order in progress" lookup. The To Home link never uses it.
  getActiveOrderForTable: vi.fn(async (tableId) => {
    if (server.down) throw networkError()
    return server.order && server.order.tableId === tableId && ['preparing', 'almost'].includes(server.order.status)
      ? { ...server.order }
      : null
  }),
  cancelOrder: vi.fn(),
  fetchTable: vi.fn(),
  fetchTables: vi.fn(),
}))

import { CartProvider } from '../context/CartContext'
import { OrderProvider, useOrder } from '../context/OrderContext'

let latest
function Probe() {
  latest = useOrder()
  return (
    <div>
      <span data-testid="status">{latest.order ? latest.order.status : 'none'}</span>
      <span data-testid="visible">{String(latest.trackingVisible)}</span>
    </div>
  )
}

function Phone({ path }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <CartProvider>
        <OrderProvider>
          <Probe />
        </OrderProvider>
      </CartProvider>
    </MemoryRouter>
  )
}

const LINES = [{ item: { id: 'x', name: 'Dish' }, quantity: 1, unitPrice: 300 }]

const status = () => screen.getByTestId('status').textContent
const settle = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const customerComesBack = () => act(async () => { document.dispatchEvent(new Event('visibilitychange')) })

async function placeOrderOnAPhone(path, tableId) {
  const phone = render(<Phone path={path} />)
  await settle(10)
  await act(async () => {
    await latest.placeOrder(tableId, LINES)
  })
  return phone
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  server.order = null
  server.down = false
  server.orderCalls = 0
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe.each([
  ['the To Home link', '/ToHomeOrder', 'home'],
  ['a table link', '/table/3', '3'],
])('%s', (_name, path, tableId) => {
  it.each(['preparing', 'almost', 'ready', 'completed'])(
    'brings a %s order back after the customer leaves the site and returns, until DONE',
    async (finalStatus) => {
      const first = await placeOrderOnAPhone(path, tableId)
      expect(status()).toBe('preparing')

      server.order.status = finalStatus
      first.unmount() // the customer leaves the site

      render(<Phone path={path} />) // ...and comes back
      await settle(50)
      expect(status()).toBe(finalStatus)
      expect(screen.getByTestId('visible').textContent).toBe('true')

      // DONE sends the page back to zero, and it stays at zero.
      await act(async () => {
        latest.finishOrder()
      })
      expect(status()).toBe('none')
      expect(localStorage.getItem(`mtc-order-${tableId}`)).toBeNull()

      // (A table's order that is still being prepared belongs to the whole
      // table, so it is found again by design; DONE only exists once it is
      // Ready / Completed / Cancelled.)
      if (finalStatus === 'ready' || finalStatus === 'completed') {
        cleanup()
        render(<Phone path={path} />)
        await settle(50)
        expect(status()).toBe('none')
      }
    },
  )

  it('follows the order all the way to Completed — also after it was Ready — then stops asking', async () => {
    await placeOrderOnAPhone(path, tableId)

    server.order.status = 'ready'
    await settle(3000)
    expect(status()).toBe('ready')

    // The customer has not tapped DONE yet; now the staff complete the order.
    server.order.status = 'completed'
    await settle(11000)
    expect(status()).toBe('completed')

    const callsWhenClosed = server.orderCalls
    await settle(60000)
    expect(server.orderCalls).toBe(callsWhenClosed)
  })

  it('notices a change the moment the customer comes back to the page', async () => {
    await placeOrderOnAPhone(path, tableId)
    server.order.status = 'ready'
    await settle(3000)
    expect(status()).toBe('ready')

    // The phone was in a pocket: Completed happened while it was asleep.
    server.order.status = 'completed'
    await customerComesBack()
    await settle(10)
    expect(status()).toBe('completed')
  })

  it('still shows the order (from the phone\'s own copy) when the server cannot be reached, then catches up', async () => {
    const first = await placeOrderOnAPhone(path, tableId)
    first.unmount()

    server.down = true
    render(<Phone path={path} />)
    await settle(10000)
    expect(status()).toBe('preparing')
    expect(screen.getByTestId('visible').textContent).toBe('true')

    // The server wakes up and the kitchen has moved on.
    server.down = false
    server.order.status = 'almost'
    await settle(3000)
    expect(status()).toBe('almost')
  })

  it('looks for the order again when the customer comes back after a failed load', async () => {
    const first = await placeOrderOnAPhone(path, tableId)
    first.unmount()
    localStorage.removeItem('mtc-order-history') // no copy on this phone either

    server.down = true
    render(<Phone path={path} />)
    await settle(10000)
    expect(status()).toBe('none')

    server.down = false
    await customerComesBack()
    await settle(50)
    expect(status()).toBe('preparing')
  })

  it('forgets an order the server no longer has', async () => {
    const first = await placeOrderOnAPhone(path, tableId)
    first.unmount()

    server.order = null // removed on the dashboard
    render(<Phone path={path} />)
    await settle(50)
    expect(status()).toBe('none')
    expect(localStorage.getItem(`mtc-order-${tableId}`)).toBeNull()
  })
})
