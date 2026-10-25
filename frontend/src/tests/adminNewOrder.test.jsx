import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../services/api', () => ({
  adminFetchMenuItems: vi.fn(),
  adminFetchCategories: vi.fn(),
  adminFetchTables: vi.fn(),
  adminCreateOrder: vi.fn(),
}))
const refreshSummary = vi.fn()
vi.mock('../admin/AdminAuthContext', () => ({ useAdminAuth: () => ({ password: 'secret' }) }))
vi.mock('../admin/AdminShellContext', () => ({
  useAdminShell: () => ({ setNavOpen: vi.fn(), summary: { pending: [] }, refreshSummary }),
}))

import { adminCreateOrder, adminFetchCategories, adminFetchMenuItems, adminFetchTables } from '../services/api'
import AdminNewOrder, { finalPrice } from '../admin/pages/AdminNewOrder'
import { LanguageProvider } from '../i18n/LanguageContext'

const items = [
  { id: 1, name: 'Margherita', categoryId: 'pizza', price: 1000, discountPercent: 10, available: true, image: '' },
  { id: 2, name: 'Chorba', categoryId: 'soup', price: 500, discountPercent: 0, available: true, image: '' },
  { id: 3, name: 'Tiramisu', categoryId: 'dessert', price: 400, discountPercent: 0, available: false, image: '' },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <LanguageProvider scope="admin">
        <AdminNewOrder />
      </LanguageProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  adminFetchMenuItems.mockResolvedValue(items)
  adminFetchCategories.mockResolvedValue([
    { id: 'pizza', name: 'Pizza' }, { id: 'soup', name: 'Soup' }, { id: 'dessert', name: 'Dessert' },
  ])
  adminFetchTables.mockResolvedValue([
    { id: '1', state: 'available', openOrders: 0 },
    { id: '2', state: 'occupied', openOrders: 1 },
    { id: '3', state: 'cleaning', openOrders: 0 },
    { id: 'home', state: 'available', openOrders: 0 },
  ])
  adminCreateOrder.mockResolvedValue({ id: 99, number: 7 })
})
afterEach(cleanup)

const send = () => screen.getByRole('button', { name: 'Send to the kitchen' })

describe('Dashboard: New order', () => {
  it('uses the same rounding as the server', () => {
    expect(finalPrice(items[0])).toBe(900)
  })

  it('cannot be sent until a table and a dish are chosen', async () => {
    renderPage()
    await screen.findByText('Margherita')
    expect(send()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Add Margherita' }))
    expect(send()).toBeDisabled() // still no table

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } })
    expect(send()).not.toBeDisabled()
  })

  it('closed tables cannot be chosen; To Home can', async () => {
    renderPage()
    await screen.findByText('Margherita')
    const cleaning = screen.getByRole('option', { name: /Table 3/ })
    expect(cleaning).toBeDisabled()
    expect(screen.getByRole('option', { name: /Table 2.*open order/ })).not.toBeDisabled()
    expect(screen.getByRole('option', { name: /^To Home/i })).not.toBeDisabled()
  })

  it('sends only ids and quantities with the note, then shows the order number', async () => {
    renderPage()
    await screen.findByText('Margherita')
    const add = screen.getByRole('button', { name: 'Add Margherita' })
    fireEvent.click(add)
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Margherita' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Soup' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Chorba' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'home' } })
    fireEvent.change(screen.getByPlaceholderText(/no onions/i), { target: { value: 'no salt' } })
    fireEvent.click(send())

    await waitFor(() => expect(adminCreateOrder).toHaveBeenCalledTimes(1))
    expect(adminCreateOrder).toHaveBeenCalledWith('secret', {
      tableId: 'home',
      items: [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }],
      note: 'no salt',
    })
    expect(await screen.findByText(/Order #7 sent to the kitchen/)).toBeInTheDocument()
    expect(refreshSummary).toHaveBeenCalledWith({ silent: true })
    expect(send()).toBeDisabled() // form was reset
  })

  it('shows the server error and keeps the order', async () => {
    adminCreateOrder.mockRejectedValue(new Error('This table is out of service.'))
    renderPage()
    await screen.findByText('Margherita')
    fireEvent.click(screen.getByRole('button', { name: 'Add Margherita' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } })
    fireEvent.click(send())

    expect(await screen.findByText(/out of service/)).toBeInTheDocument()
    expect(send()).not.toBeDisabled()
  })

  it('does not let an unavailable dish be added', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Dessert' }))
    await screen.findByText('Tiramisu')
    expect(screen.queryByRole('button', { name: 'Add Tiramisu' })).not.toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })
})

describe('Dashboard: New order filters', () => {
  it('has no "All" chip, opens the first category, and search looks in every category', async () => {
    renderPage()
    await screen.findByText('Margherita')
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument()
    expect(screen.queryByText('Chorba')).not.toBeInTheDocument() // other category

    fireEvent.change(screen.getByPlaceholderText('Search a dish…'), { target: { value: 'chor' } })
    expect(screen.getByText('Chorba')).toBeInTheDocument()
    expect(screen.queryByText('Margherita')).not.toBeInTheDocument()
  })
})
