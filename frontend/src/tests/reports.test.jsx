import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../services/api', () => ({ adminFetchReport: vi.fn() }))
vi.mock('../admin/AdminAuthContext', () => ({ useAdminAuth: () => ({ password: 'secret' }) }))
vi.mock('../admin/AdminShellContext', () => ({ useAdminShell: () => ({ setNavOpen: vi.fn(), summary: { pending: [] } }) }))

import { adminFetchReport } from '../services/api'
import AdminReports, { customProblem } from '../admin/pages/AdminReports'
import ReportsChart from '../admin/components/ReportsChart'
import { LanguageProvider } from '../i18n/LanguageContext'
import { dayLabel, dayLabelLong, dayRange } from '../admin/components/format'

const week = {
  range: 'week',
  today: '2026-10-23',
  from: '2026-10-17',
  to: '2026-10-23',
  previousFrom: '2026-10-10',
  previousTo: '2026-10-16',
  granularity: 'day',
  current: { orders: 40, revenue: 36000, cancelled: 2, avg: 900 },
  previous: { orders: 32, revenue: 30000, cancelled: 1, avg: 937 },
  series: ['17', '18', '19', '20', '21', '22', '23'].map((d, i) => ({
    key: `2026-10-${d}`, orders: i === 4 ? 0 : 5 + i, revenue: i === 4 ? 0 : 4000 + i * 1000,
  })),
  bestSellers: [
    { id: 'pizza-1', name: 'Margherita', quantity: 30, revenue: 13500, orders: 25 },
    { id: 'soup-5', name: 'Chorba', quantity: 12, revenue: 2160, orders: 10 },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LanguageProvider scope="admin">
        <AdminReports />
      </LanguageProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  adminFetchReport.mockResolvedValue(week)
})
afterEach(cleanup)

describe('Reports page', () => {
  it('opens on the last 7 days with totals, the change, the best day and the best sellers', async () => {
    renderPage()

    expect(await screen.findByText('40')).toBeInTheDocument()
    expect(adminFetchReport).toHaveBeenCalledWith('secret', { range: 'week', from: '', to: '' })
    expect(screen.getByText(/\+25%/)).toBeInTheDocument() // 40 orders vs 32
    expect(screen.getByText(/2 cancelled/i)).toBeInTheDocument()
    expect(screen.getByText(/Compared with Oct 10 – Oct 16/)).toBeInTheDocument()

    // best sellers, best first
    const list = screen.getByRole('list')
    const rows = list.querySelectorAll('li')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toMatch(/Margherita/)
    expect(rows[0].textContent).toMatch(/30 sold/)
    expect(rows[1].textContent).toMatch(/Chorba/)

    // best day = the day with the most sales (Oct 23)
    expect(screen.getByText('Best day').parentElement.textContent).toMatch(/Oct 23/)
  })

  it('asks again for the period that was picked', async () => {
    renderPage()
    await screen.findByText('40')

    fireEvent.click(screen.getByRole('button', { name: 'This month' }))
    await waitFor(() => expect(adminFetchReport).toHaveBeenLastCalledWith('secret', { range: 'month', from: '', to: '' }))
    expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Last month' }))
    await waitFor(() => expect(adminFetchReport).toHaveBeenLastCalledWith('secret', { range: 'lastmonth', from: '', to: '' }))
  })

  it('"Choose dates" starts from the period on screen, asks for the new dates, and refuses a bad order', async () => {
    renderPage()
    await screen.findByText('40')

    fireEvent.click(screen.getByRole('button', { name: /choose dates/i }))
    const [from, to] = Array.from(document.querySelectorAll('input[type=date]'))
    expect(from.value).toBe('2026-10-17')
    expect(to.value).toBe('2026-10-23')
    await waitFor(() => expect(adminFetchReport).toHaveBeenLastCalledWith('secret', { range: 'custom', from: '2026-10-17', to: '2026-10-23' }))

    fireEvent.change(from, { target: { value: '2026-10-05' } })
    await waitFor(() => expect(adminFetchReport).toHaveBeenLastCalledWith('secret', { range: 'custom', from: '2026-10-05', to: '2026-10-23' }))

    // start after end: a clear message, and no request is sent
    adminFetchReport.mockClear()
    fireEvent.change(from, { target: { value: '2026-10-30' } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/start date must be before the end date/i)
    expect(adminFetchReport).not.toHaveBeenCalled()
  })

  it('shows a message when there were no sales, and a hint instead of nothing', async () => {
    adminFetchReport.mockResolvedValue({
      ...week,
      current: { orders: 0, revenue: 0, cancelled: 0, avg: 0 },
      previous: { orders: 0, revenue: 0, cancelled: 0, avg: 0 },
      series: week.series.map((p) => ({ ...p, orders: 0, revenue: 0 })),
      bestSellers: [],
    })
    renderPage()
    expect((await screen.findAllByText('No sales in this period.')).length).toBe(2)
  })

  it('a single day shows the busiest hour instead of the best day', async () => {
    adminFetchReport.mockResolvedValue({
      ...week, range: 'today', from: '2026-10-23', to: '2026-10-23', previousFrom: '2026-10-22', previousTo: '2026-10-22',
      granularity: 'hour',
      series: Array.from({ length: 24 }, (_, h) => ({ key: h, orders: h === 13 ? 4 : 0, revenue: h === 13 ? 2400 : 0 })),
    })
    renderPage()
    expect(await screen.findByText('Busiest hour')).toBeInTheDocument()
    expect(screen.getByText('Busiest hour').parentElement.textContent).toMatch(/1:00 PM/)
    expect(screen.getByText('One bar per hour')).toBeInTheDocument()
  })

  it('reports a server problem instead of failing silently', async () => {
    adminFetchReport.mockRejectedValue(new Error('The server is asleep'))
    renderPage()
    expect(await screen.findByText(/server is asleep/i)).toBeInTheDocument()
  })
})

describe('custom date checks', () => {
  it('explains what is wrong', () => {
    expect(customProblem('', '')).toBe('admin.reports.pickDates')
    expect(customProblem('2026-10-01', '')).toBe('admin.reports.pickDates')
    expect(customProblem('2026-10-10', '2026-10-01')).toBe('admin.reports.badOrder')
    expect(customProblem('2025-01-01', '2026-10-01')).toBe('admin.reports.tooLong')
    expect(customProblem('2026-10-01', '2026-10-01')).toBeNull()
    expect(customProblem('2026-01-01', '2026-12-31')).toBeNull()
  })
})

describe('report dates', () => {
  it('never slip to the neighbouring day (whatever the computer time zone)', () => {
    expect(dayLabel('2026-10-17', 'en')).toBe('Oct 17')
    expect(dayLabel('2026-01-01', 'en')).toBe('Jan 1')
    expect(dayLabelLong('2026-10-17', 'en')).toMatch(/Sat.*Oct 17, 2026/)
    expect(dayRange('2026-10-17', '2026-10-23', 'en')).toBe('Oct 17 – Oct 23')
    expect(dayRange('2026-10-17', '2026-10-17', 'en')).toBe('Oct 17')
  })
})

describe('ReportsChart', () => {
  it('draws one bar per day with sales, a dot for a day without, and highlights the best', () => {
    const { container } = render(
      <LanguageProvider scope="admin">
        <ReportsChart points={week.series} metric="revenue" granularity="day" today="2026-10-23" />
      </LanguageProvider>
    )
    expect(screen.getByRole('img', { name: /bar chart of sales/i })).toBeInTheDocument()
    const bars = container.querySelectorAll('rect[fill="url(#report-bar)"]')
    expect(bars).toHaveLength(6) // 7 days, one without sales
    // the best day is the only fully opaque one
    expect(Array.from(bars).filter((b) => b.getAttribute('opacity') === '1')).toHaveLength(1)
  })
})
