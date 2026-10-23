import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// A tiny fake server for the "Call waiter" button.
const server = { calls: [], nextId: 1, down: false }

vi.mock('../services/api', () => ({
  callWaiter: vi.fn(async (tableId) => {
    if (server.down) throw new Error('Failed to fetch')
    const open = server.calls.find((c) => c.tableId === tableId && !c.resolved)
    if (open) return { ...open }
    const call = { id: server.nextId++, tableId, resolved: false }
    server.calls.push(call)
    return { ...call }
  }),
  getWaiterCall: vi.fn(async (id) => {
    const call = server.calls.find((c) => c.id === id)
    if (!call) {
      const error = new Error('Call not found.')
      error.status = 404
      throw error
    }
    return { ...call }
  }),
}))

import { WaiterProvider } from '../context/WaiterContext'
import CallWaiterButton from '../components/waiter/CallWaiterButton'
import { LanguageProvider } from '../i18n/LanguageContext'
import { callWaiter } from '../services/api'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider scope="customer">
        <WaiterProvider>
          <CallWaiterButton />
        </WaiterProvider>
      </LanguageProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  server.calls = []
  server.nextId = 1
  server.down = false
  localStorage.clear()
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('Call waiter button', () => {
  it('is on every table page, but not on the To Home link', () => {
    renderAt('/table/3')
    expect(screen.getByRole('button', { name: /call waiter/i })).toBeInTheDocument()
    cleanup()

    renderAt('/ToHomeOrder')
    expect(screen.queryByRole('button', { name: /call waiter/i })).toBeNull()
  })

  it('rings once, shows "coming", and cannot be pressed twice', async () => {
    renderAt('/table/3')
    fireEvent.click(screen.getByRole('button', { name: /call waiter/i }))

    const waiting = await screen.findByRole('button', { name: /waiter is coming/i })
    expect(waiting).toBeDisabled()
    expect(callWaiter).toHaveBeenCalledTimes(1)
    expect(callWaiter).toHaveBeenCalledWith('3')

    fireEvent.click(waiting)
    expect(callWaiter).toHaveBeenCalledTimes(1)
  })

  it('remembers the open call after a reload, and shows "came" when staff answer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderAt('/table/2')
      fireEvent.click(screen.getByRole('button', { name: /call waiter/i }))
      await screen.findByRole('button', { name: /waiter is coming/i })

      // The page is reloaded: still waiting, and no second call is made.
      cleanup()
      renderAt('/table/2')
      await screen.findByRole('button', { name: /waiter is coming/i })
      expect(callWaiter).toHaveBeenCalledTimes(1)

      // A staff member answers on the dashboard.
      server.calls[0].resolved = true
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4500)
      })
      expect(await screen.findByText(/your waiter came/i)).toBeInTheDocument()

      // After a few seconds it is ready for the next call.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5500)
      })
      expect(screen.getByRole('button', { name: /call waiter/i })).toBeEnabled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows a retry message when the server cannot be reached', async () => {
    server.down = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderAt('/table/1')
    fireEvent.click(screen.getByRole('button', { name: /call waiter/i }))
    const retry = await screen.findByRole('button', { name: /tap to retry/i })

    server.down = false
    fireEvent.click(retry)
    expect(await screen.findByRole('button', { name: /waiter is coming/i })).toBeInTheDocument()
  })
})
