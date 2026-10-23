import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The fake server: which reason (if any) staff gave for closing the table.
const server = { unavailable: null, down: false }

vi.mock('../services/api', () => ({
  fetchTable: vi.fn(async (id) => {
    if (server.down) throw new Error('Failed to fetch')
    return { id, label: `Table ${id}`, kind: 'table', unavailable: server.unavailable }
  }),
  fetchTables: vi.fn(async () => [{ id: '1' }]),
  fetchMenu: vi.fn(),
  fetchChatbotFaqs: vi.fn(async () => []),
  submitOrder: vi.fn(),
  addItemsToOrder: vi.fn(),
  getOrder: vi.fn(),
  getActiveOrderForTable: vi.fn(async () => null),
  cancelOrder: vi.fn(),
  callWaiter: vi.fn(),
  getWaiterCall: vi.fn(),
}))

import { CartProvider } from '../context/CartContext'
import { OrderProvider } from '../context/OrderContext'
import { LanguageProvider } from '../i18n/LanguageContext'
import TablePage from '../pages/TablePage'
import { Routes, Route } from 'react-router-dom'

function renderTable(id) {
  return render(
    <MemoryRouter initialEntries={[`/table/${id}`]}>
      <LanguageProvider scope="customer">
        <CartProvider>
          <OrderProvider>
            <Routes>
              <Route path="/table/:tableId" element={<TablePage />} />
            </Routes>
          </OrderProvider>
        </CartProvider>
      </LanguageProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  server.unavailable = null
  server.down = false
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('a table staff closed on the dashboard', () => {
  it('shows "being cleaned" instead of the menu', async () => {
    server.unavailable = 'cleaning'
    renderTable('1')
    expect(await screen.findByText(/this table is being cleaned/i)).toBeInTheDocument()
    expect(screen.queryByText('MENU')).toBeNull()
  })

  it('shows "out of service" instead of the menu', async () => {
    server.unavailable = 'out_of_service'
    renderTable('1')
    expect(await screen.findByText(/this table is out of service/i)).toBeInTheDocument()
    expect(screen.queryByText('MENU')).toBeNull()
  })

  it('opens the menu by itself once staff reopen the table', async () => {
    server.unavailable = 'cleaning'
    renderTable('1')
    await screen.findByText(/this table is being cleaned/i)

    server.unavailable = null
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(await screen.findByText('MENU')).toBeInTheDocument()
    expect(screen.queryByText(/being cleaned/i)).toBeNull()
  })

  it('closes the menu when staff close the table while a guest is browsing', async () => {
    renderTable('1')
    expect(await screen.findByText('MENU')).toBeInTheDocument()

    server.unavailable = 'out_of_service'
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16000)
    })
    expect(await screen.findByText(/out of service/i)).toBeInTheDocument()
  })

  it('a lost connection never closes (or reopens) a table by mistake', async () => {
    server.unavailable = 'cleaning'
    renderTable('1')
    await screen.findByText(/this table is being cleaned/i)

    server.down = true
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000)
    })
    expect(screen.getByText(/this table is being cleaned/i)).toBeInTheDocument()
  })
})
