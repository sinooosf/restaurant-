import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'

import { useLocation } from 'react-router-dom'

import {
  submitOrder,
  addItemsToOrder,
  getOrder,
  getActiveOrderForTable,
  cancelOrder as cancelOrderRequest,
} from '../services/api'

import { HOME_TABLE_ID, tableIdFromPath } from '../data/tables'
import { useCart } from './CartContext'
import { rememberOrder, readHistory } from '../utils/orderHistory'

const OrderContext = createContext(null)

export const ORDER_STAGES = [
  'preparing',
  'almost',
  'ready',
]

// Statuses the customer's sheet shows as "finished" (they close it with DONE).
const FINISHED = ['ready', 'completed', 'cancelled']

// Statuses after which the staff can do nothing more to the order, so the
// phone can stop asking the server about it. "Ready" is NOT one of them: the
// staff still press "Completed" afterwards, and the phone has to notice.
const CLOSED = ['completed', 'cancelled']

// How often to ask the backend "has this order's status changed yet?"
// The actual status comes from the dashboard — a staff member clicking
// "Almost ready" / "Ready" / "Cancel" there is what really moves this along.
const POLL_INTERVAL_MS = 2500

// Once the order is Ready only "Completed" can still follow, which is not
// urgent — so the phone checks less often (many phones may stay on this screen).
const READY_POLL_INTERVAL_MS = 10000

// The phone remembers an order until the customer taps "Done" — whatever the
// staff did to it (Ready, Completed, Cancelled). As a safety net, an order
// that was never closed is forgotten after this long, so a phone that comes
// back the next day does not see yesterday's meal.
const SAVED_ORDER_TTL_MS = 12 * 60 * 60 * 1000

// The phone remembers which order it placed at each table, so a finished
// ("Ready" / "Completed" / "Cancelled") order can still be closed after a reload.
const orderKey = (tableId) => `mtc-order-${tableId}`

function saveOrderId(tableId, id) {
  try {
    localStorage.setItem(orderKey(tableId), String(id))
  } catch {
    // storage blocked (private mode) — the order still works
  }
}

function readOrderId(tableId) {
  try {
    const saved = localStorage.getItem(orderKey(tableId))
    // Order ids are plain numbers; anything else in storage is junk.
    return saved && /^[1-9]\d{0,8}$/.test(saved) ? saved : null
  } catch {
    return null
  }
}

function clearOrderId(tableId) {
  try {
    localStorage.removeItem(orderKey(tableId))
  } catch {
    // ignore
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Runs `task`, and tries again while the SERVER cannot be reached (network
// error or a 5xx while it wakes up). A real answer — including "404 not
// found" — is returned/thrown immediately.
async function withRetry(task, { tries = 5, delayMs = 1500, isCancelled = () => false } = {}) {
  let lastError
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (isCancelled()) throw new Error('cancelled')
    try {
      return await task()
    } catch (error) {
      lastError = error
      const answered = error?.status && error.status < 500
      if (answered) throw error
      if (attempt < tries - 1) await wait(delayMs)
    }
  }
  throw lastError
}

export function OrderProvider({ children }) {
  const [order, setOrder] = useState(null)
  const [trackingVisible, setTrackingVisible] = useState(false)

  // Bumped to look for the customer's order again (see "COMING BACK" below).
  const [restoreTick, setRestoreTick] = useState(0)

  const pollTimer = useRef(null)

  // CartProvider is above OrderProvider in App.jsx,
  // so OrderContext can safely access the cart.
  const cart = useCart()

  // Which table is this phone looking at? (/table/:tableId or /ToHomeOrder)
  const { pathname } = useLocation()
  const tableId = tableIdFromPath(pathname)

  // -------------------------------------------------------------------------
  // ORDER HISTORY — every order this phone shows (placed, restored, moved on
  // by the kitchen, added to...) is remembered for 24 hours, so the history
  // button in the header can list it even after the customer taps "Done".
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (order) rememberOrder(order)
  }, [order])

  // -------------------------------------------------------------------------
  // TIMER HELPERS
  // -------------------------------------------------------------------------

  const clearTimers = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  // -------------------------------------------------------------------------
  // POLLING — watches the real order until the kitchen marks it ready
  // (or the restaurant cancels it), then stops on its own. When that happens
  // the tracking screen opens (if it was hidden) and STAYS open until the
  // customer closes it.
  // -------------------------------------------------------------------------

  // The latest order on screen, readable from timers and window events
  // (which would otherwise see an old copy of `order`).
  const orderRef = useRef(null)
  useEffect(() => {
    orderRef.current = order
  }, [order])

  const pollEvery = useRef(POLL_INTERVAL_MS)
  const checkRef = useRef(null)

  const startPolling = useCallback(
    (orderId, forTableId, everyMs = POLL_INTERVAL_MS) => {
      if (pollTimer.current) clearInterval(pollTimer.current)

      pollEvery.current = everyMs
      pollTimer.current = setInterval(() => {
        checkRef.current?.(orderId, forTableId)
      }, everyMs)
    },
    []
  )

  // One "has anything changed?" check. Used by the timer, and also right
  // away when the customer comes back to the page (see further down).
  const checkOrder = useCallback(
    async (orderId, forTableId) => {
      try {
        const latest = await getOrder(orderId)

        // The customer closed the order (or moved to another table) while we
        // were waiting for the answer: nothing to update.
        const shown = orderRef.current
        if (!shown || shown.id !== orderId) return

        setOrder((previous) => {
          if (!previous || previous.id !== orderId) return previous
          return latest
        })

        // Make sure the customer sees it the moment it changes to
        // Ready / Completed / Cancelled. No auto-close.
        if (FINISHED.includes(latest.status) && shown.status !== latest.status) {
          setTrackingVisible(true)
        }

        const tooOld = Date.now() - new Date(latest.createdAt).getTime() > SAVED_ORDER_TTL_MS

        if (CLOSED.includes(latest.status) || tooOld) {
          clearTimers()
          return
        }

        // Ready: only the staff's "Completed" can still follow — watch it,
        // but less often.
        if (latest.status === 'ready' && pollEvery.current !== READY_POLL_INTERVAL_MS) {
          startPolling(orderId, forTableId, READY_POLL_INTERVAL_MS)
        }
      } catch (error) {
        // The order no longer exists (the staff merged it into another
        // order, or it was removed): start over cleanly instead of
        // polling a ghost forever.
        if (error?.status === 404) {
          clearTimers()
          clearOrderId(forTableId)
          setOrder(null)
          setTrackingVisible(false)
          return
        }

        // A single missed poll isn't worth surfacing to the customer —
        // it'll just try again on the next tick.
        console.error('Failed to refresh order status:', error)
      }
    },
    [clearTimers, startPolling]
  )

  useEffect(() => {
    checkRef.current = checkOrder
  }, [checkOrder])

  // -------------------------------------------------------------------------
  // COMING BACK — a phone that was in the pocket (another app, a locked
  // screen, the browser's Back button) may have missed the kitchen moving the
  // order on, or may have failed to load it while the connection was down.
  // The moment the customer is back, ask again right away instead of waiting
  // for the next tick (or never: the timer stops once nothing is in progress).
  // -------------------------------------------------------------------------

  useEffect(() => {
    function onReturn() {
      if (document.visibilityState === 'hidden') return

      const current = orderRef.current

      // Nothing on screen: try to find the order again.
      if (!current) {
        setRestoreTick((n) => n + 1)
        return
      }

      if (CLOSED.includes(current.status)) return

      const forTableId = String(current.tableId)
      checkRef.current?.(current.id, forTableId)

      if (!pollTimer.current) {
        startPolling(
          current.id,
          forTableId,
          current.status === 'ready' ? READY_POLL_INTERVAL_MS : POLL_INTERVAL_MS
        )
      }
    }

    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('pageshow', onReturn)
    window.addEventListener('online', onReturn)

    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('pageshow', onReturn)
      window.removeEventListener('online', onReturn)
    }
  }, [startPolling])

  // -------------------------------------------------------------------------
  // RESTORE — when someone opens (or re-scans) a table's page:
  //  1. if the table already has an order in progress, bring it back;
  //  2. otherwise, if THIS phone has an order that finished (Ready /
  //     Completed / Cancelled) but was never closed with "Done", show it
  //     so it can be closed.
  //
  // For the To Home link there is no shared table: only step 2 applies, and
  // it also brings back an order that is still being prepared.
  //
  // Every request retries while the server is unreachable, so a sleeping
  // server (or a flaky connection) no longer makes a customer's order
  // "disappear" when they come back to it.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!tableId) return

    // Looking again (the customer came back) while their order is already on
    // screen: nothing to find.
    const shown = orderRef.current
    if (restoreTick > 0 && shown && String(shown.tableId) === String(tableId)) return

    // Another table than the one we were showing: start from a clean slate.
    clearTimers()
    setOrder((previous) =>
      previous && String(previous.tableId) === String(tableId) ? previous : null
    )
    setTrackingVisible(false)

    let cancelled = false
    const isCancelled = () => cancelled
    const isHome = tableId === HOME_TABLE_ID

    async function restore() {
      try {
        let found = null
        let serverDown = false

        if (!isHome) {
          try {
            found = await withRetry(() => getActiveOrderForTable(tableId), { isCancelled })
          } catch (error) {
            if (error?.message === 'cancelled') throw error
            // Could not reach the server at all: fall back on this phone's own
            // copy of the order below, instead of showing a blank page.
            serverDown = true
          }
        }

        if (!found) {
          const savedId = readOrderId(tableId)

          if (savedId) {
            let saved = null
            let fromCopy = false

            try {
              saved = await withRetry(() => getOrder(savedId), {
                isCancelled,
                tries: serverDown ? 1 : 5,
              })
            } catch (error) {
              if (error?.message === 'cancelled') throw error

              if (error?.status === 404) {
                // Gone for good → forget it.
                clearOrderId(tableId)
              } else {
                // The server cannot be reached right now (asleep, no signal).
                // The phone keeps a copy of every order it showed, so the
                // customer still sees their order — it refreshes by itself as
                // soon as the server answers again.
                saved = readHistory().find((entry) => String(entry.id) === String(savedId)) || null
                fromCopy = saved !== null
              }
            }

            if (saved) {
              const sameTable = String(saved.tableId) === String(tableId)
              const fresh = Date.now() - new Date(saved.createdAt).getTime() < SAVED_ORDER_TTL_MS

              // Only the customer's own "Done" button removes an order from
              // the phone — so Ready, Completed and Cancelled are all kept.
              // (A table's order that is still being prepared was already
              // brought back above by the active-order request.)
              const keep = isHome || fromCopy || FINISHED.includes(saved.status)

              if (sameTable && fresh && keep) {
                found = saved
              } else {
                clearOrderId(tableId)
              }
            }
          }
        }

        if (cancelled || !found) return

        saveOrderId(tableId, found.id)

        clearTimers()
        setOrder(found)
        setTrackingVisible(true)

        // Keep watching until the staff close the order (Completed) or it is
        // cancelled — also while it is Ready, and also when what we show is
        // only the phone's own copy (it catches up when the server answers).
        if (!CLOSED.includes(found.status)) {
          startPolling(
            found.id,
            tableId,
            found.status === 'ready' ? READY_POLL_INTERVAL_MS : POLL_INTERVAL_MS
          )
        }
      } catch (error) {
        // If this fails the customer simply sees a fresh page.
        if (error?.message !== 'cancelled') {
          console.error('Failed to restore the table order:', error)
        }
      }
    }

    restore()

    return () => {
      cancelled = true
    }
  }, [tableId, restoreTick, clearTimers, startPolling])

  // -------------------------------------------------------------------------
  // PLACE ORDER (the first order of a visit)
  // -------------------------------------------------------------------------

  const placeOrder = useCallback(
    async (tableId, lines) => {
      if (!lines || lines.length === 0) {
        return null
      }

      const items = lines.map((line) => ({
        id: line.item.id,
        name: line.item.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      }))

      // The server computes the real prices itself. This call can throw
      // (e.g. an item went unavailable seconds ago); TablePage shows that.
      const created = await submitOrder({
        tableId,
        items,
      })

      clearTimers()
      saveOrderId(tableId, created.id)

      // The dishes now live inside the order, so the cart starts empty
      // again (anything added from now on is an addition to this order).
      cart.clearCart()

      setOrder(created)
      setTrackingVisible(true)
      startPolling(created.id, tableId)

      return created
    },
    [clearTimers, startPolling, cart]
  )

  // -------------------------------------------------------------------------
  // ADD MORE — adds dishes to the SAME order (no new order is created)
  // -------------------------------------------------------------------------

  const addToOrder = useCallback(
    async (lines) => {
      if (!order || !lines || lines.length === 0) {
        return null
      }

      const items = lines.map((line) => ({
        id: line.item.id,
        quantity: line.quantity,
      }))

      // Throws if the kitchen already moved past "Preparing".
      const updated = await addItemsToOrder(order.id, items)

      cart.clearCart()
      setOrder(updated)
      setTrackingVisible(true)

      return updated
    },
    [order, cart]
  )

  // -------------------------------------------------------------------------
  // CANCEL ORDER (the customer's own button)
  // -------------------------------------------------------------------------

  const cancel = useCallback(async () => {
    if (!order) {
      return
    }

    // Only Preparing orders can be cancelled.
    if (order.status !== 'preparing') {
      return
    }

    clearTimers()

    try {
      await cancelOrderRequest(order.id)

      // The order leaves the screen, but stays in the history as "cancelled".
      rememberOrder({ ...order, status: 'cancelled' })

      if (tableId) clearOrderId(tableId)

      // Cancel means the current cart/order is completely gone.
      setOrder(null)
      setTrackingVisible(false)
      cart.clearCart()
    } catch (error) {
      console.error('Failed to cancel order:', error)
    }
  }, [order, tableId, clearTimers, cart])

  // -------------------------------------------------------------------------
  // FINISH — the customer closes a Ready, Completed or Cancelled order. Everything goes
  // back to zero: no order, empty cart, fresh page for the next order.
  // -------------------------------------------------------------------------

  const finishOrder = useCallback(() => {
    clearTimers()

    if (tableId) clearOrderId(tableId)

    setOrder(null)
    setTrackingVisible(false)
    cart.clearCart()
  }, [tableId, clearTimers, cart])

  // -------------------------------------------------------------------------
  // TRACKING
  // -------------------------------------------------------------------------

  const hideTracking = useCallback(() => {
    setTrackingVisible(false)
  }, [])

  const showTracking = useCallback(() => {
    if (!order) {
      return
    }

    setTrackingVisible(true)
  }, [order])

  // -------------------------------------------------------------------------
  // CONTEXT VALUE
  // -------------------------------------------------------------------------

  const value = {
    order,
    stages: ORDER_STAGES,
    trackingVisible,

    placeOrder,
    addToOrder,
    cancel,
    finishOrder,

    hideTracking,
    showTracking,
  }

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  )
}

export function useOrder() {
  const ctx = useContext(OrderContext)

  if (!ctx) {
    throw new Error(
      'useOrder must be used within an OrderProvider'
    )
  }

  return ctx
}