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

function renderAtTable(tableId) {
  return render(
    <MemoryRouter initialEntries={[`/table/${tableId}`]}>
      <CartProvider>
        <OrderProvider>
          <Routes>
            <Route path="/table/:tableId" element={<TablePage />} />
          </Routes>
        </OrderProvider>
      </CartProvider>
    </MemoryRouter>,
  )
}

describe('Table routing', () => {
  it('shows the menu for a valid table id', () => {
    renderAtTable('3')
    expect(screen.getByText('MENU')).toBeInTheDocument()
  })

  it('shows a friendly message for a table id outside 1-5', () => {
    renderAtTable('99')
    expect(screen.getByText('Table not found')).toBeInTheDocument()
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
