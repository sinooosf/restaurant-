import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { callWaiter, getWaiterCall } from '../services/api'
import { isOpenLink, tableIdFromPath } from '../data/tables'

// ---------------------------------------------------------------------------
// The "Call waiter" button's brain.
//
//   idle     -> the button says "Call waiter"
//   sending  -> the request is on its way
//   waiting  -> the dashboard is ringing; we ask every few seconds if a staff
//               member answered
//   answered -> the waiter came (shown for a few seconds, then back to idle)
//   error    -> the server could not be reached (tap to retry)
//
// The phone remembers the open call, so reloading the page keeps showing
// "Waiter is coming…" instead of letting the customer ring again.
// ---------------------------------------------------------------------------
const WaiterContext = createContext(null)

const POLL_MS = 4000
const ANSWERED_SHOWN_MS = 5000
const SAVED_TTL_MS = 3 * 60 * 60 * 1000
const storageKey = (tableId) => `mtc-waiter-${tableId}`

function readSaved(tableId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(tableId)) || 'null')
    if (!saved || !Number.isInteger(saved.id) || Date.now() - saved.savedAt > SAVED_TTL_MS) return null
    return saved.id
  } catch {
    return null
  }
}

function save(tableId, id) {
  try {
    if (id === null) localStorage.removeItem(storageKey(tableId))
    else localStorage.setItem(storageKey(tableId), JSON.stringify({ id, savedAt: Date.now() }))
  } catch {
    // storage blocked: the button still works, it just won't survive a reload
  }
}

export function WaiterProvider({ children }) {
  const { pathname } = useLocation()
  const tableId = tableIdFromPath(pathname)
  // The "To Home" and "Delivery" links have no table, so nobody to call.
  const available = Boolean(tableId) && !isOpenLink(tableId)

  const [status, setStatus] = useState('idle')
  const callId = useRef(null)
  const timer = useRef(null)
  const answeredTimer = useRef(null)

  const stopPolling = useCallback(() => {
    clearInterval(timer.current)
    timer.current = null
  }, [])

  const startPolling = useCallback(
    (id, forTable) => {
      stopPolling()
      callId.current = id

      const check = async () => {
        try {
          const call = await getWaiterCall(id)
          if (callId.current !== id) return
          if (call.resolved) finish(forTable)
        } catch (error) {
          // The call is gone (404): start over. A network error: try again later.
          if (error?.status === 404 && callId.current === id) finish(forTable, true)
        }
      }

      function finish(table, silent = false) {
        stopPolling()
        callId.current = null
        save(table, null)
        if (silent) {
          setStatus('idle')
          return
        }
        setStatus('answered')
        clearTimeout(answeredTimer.current)
        answeredTimer.current = setTimeout(() => setStatus('idle'), ANSWERED_SHOWN_MS)
      }

      timer.current = setInterval(check, POLL_MS)
    },
    [stopPolling]
  )

  // When the table changes (or on first load): pick up a call that is still open.
  useEffect(() => {
    stopPolling()
    callId.current = null
    setStatus('idle')
    if (!available) return

    const saved = readSaved(tableId)
    if (saved !== null) {
      setStatus('waiting')
      startPolling(saved, tableId)
      // check straight away instead of waiting for the first tick
      getWaiterCall(saved)
        .then((call) => {
          if (callId.current !== saved) return
          if (call.resolved) {
            stopPolling()
            callId.current = null
            save(tableId, null)
            setStatus('idle')
          }
        })
        .catch((error) => {
          if (error?.status === 404 && callId.current === saved) {
            stopPolling()
            callId.current = null
            save(tableId, null)
            setStatus('idle')
          }
        })
    }

    return () => {
      stopPolling()
      clearTimeout(answeredTimer.current)
    }
  }, [tableId, available, startPolling, stopPolling])

  const call = useCallback(async () => {
    if (!available || status === 'sending' || status === 'waiting') return
    clearTimeout(answeredTimer.current)
    setStatus('sending')
    try {
      const created = await callWaiter(tableId)
      save(tableId, created.id)
      setStatus('waiting')
      startPolling(created.id, tableId)
    } catch (error) {
      console.error('Could not call the waiter:', error)
      setStatus('error')
    }
  }, [available, status, tableId, startPolling])

  const value = useMemo(() => ({ available, status, call }), [available, status, call])
  return <WaiterContext.Provider value={value}>{children}</WaiterContext.Provider>
}

// The button is an extra: if for any reason the provider is missing, the menu
// must still work — so the button simply hides itself instead of crashing.
const INERT = { available: false, status: 'idle', call: () => {} }

export function useWaiter() {
  return useContext(WaiterContext) || INERT
}
