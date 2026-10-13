import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from '../context/CartContext'
import { OrderProvider } from '../context/OrderContext'
import TablePage from '../pages/TablePage'

// This test renders TablePage in isolation (not the full App), so the
// backend-loading functions are never called — CATEGORIES/MENU_ITEMS stay
// at their built-in fallback values, which is exactly what we want here.
// Only the order-placement calls actually used by OrderContext need a
// stand-in, so the test doesn't depend on a real backend running.
vi.mock('../services/api', () => ({
  fetchMenu: vi.fn(),
  fetchTables: vi.fn(),
  // Asks the server about one table: 99 does not exist, everything else does.
  fetchTable: vi.fn(async (id) => {
    if (id === '99') throw Object.assign(new Error('Table not found.'), { status: 404 })
    return { id, label: `Table ${id}`, kind: id === 'home' ? 'home' : 'table', seats: 4 }
  }),
  getActiveOrderForTable: vi.fn(async () => null),
  fetchChatbotFaqs: vi.fn(),
  submitOrder: vi.fn(async ({ tableId, items }) => ({
    id: 'order-test-1',
    tableId,
    items,
    status: 'preparing',
    total: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    createdAt: new Date().toISOString(),
  })),
  getOrder: vi.fn(async () => ({
    id: 'order-test-1',
    tableId: '4',
    items: [],
    status: 'preparing',
    total: 0,
    createdAt: new Date().toISOString(),
  })),
  cancelOrder: vi.fn(async (id) => ({ id, status: 'cancelled' })),
}))

function renderAtPath(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CartProvider>
        <OrderProvider>
          <Routes>
            <Route path="/table/:tableId" element={<TablePage />} />
            <Route path="/ToHomeOrder" element={<TablePage />} />
          </Routes>
        </OrderProvider>
      </CartProvider>
    </MemoryRouter>,
  )
}

const renderAtTable = (tableId) => renderAtPath(`/table/${tableId}`)

describe('Table routing', () => {
  it('shows the menu for a valid table id', () => {
    renderAtTable('3')
    expect(screen.getByText('MENU')).toBeInTheDocument()
  })

  it('shows a friendly message for a table the server does not know', async () => {
    renderAtTable('99')
    expect(await screen.findByText('Table not found')).toBeInTheDocument()
  })

  it('opens a table that was added from the dashboard after the app loaded', async () => {
    // "6" is not in the built-in list, but the server knows it.
    renderAtTable('6')
    expect(await screen.findByText('MENU')).toBeInTheDocument()
  })

  it('opens the ToHomeOrder link and labels the order "To Home"', async () => {
    const user = userEvent.setup()
    renderAtPath('/ToHomeOrder')

    await user.click(await screen.findByRole('button', { name: /^add margherita$/i }))
    await user.click(screen.getByRole('button', { name: /place the order/i }))
    await user.click(screen.getByRole('button', { name: /yes, place order/i }))

    await waitFor(() => {
      expect(screen.getByText(/to home/i)).toBeInTheDocument()
    })
  })

  it('attaches the scanned table id to a placed order', async () => {
    const user = userEvent.setup()
    renderAtTable('4')

    await user.click(screen.getByRole('button', { name: /^add margherita$/i }))
    await user.click(screen.getByRole('button', { name: /place the order/i }))
    // Placing an order now asks for confirmation first.
    await user.click(screen.getByRole('button', { name: /yes, place order/i }))

    await waitFor(() => {
      expect(screen.getByText(/table 4/i)).toBeInTheDocument()
    })
  })
})
