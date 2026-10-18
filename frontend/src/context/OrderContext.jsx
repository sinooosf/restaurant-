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
import { rememberOrder } from '../utils/orderHistory'

const OrderContext = createContext(null)

export const ORDER_STAGES = [
  'preparing',
  'almost',
  'ready',
]

// Statuses after which nothing more happens to the order.
const FINISHED = ['ready', 'completed', 'cancelled']

// How often to ask the backend "has this order's status changed yet?"
// The actual status comes from the dashboard — a staff member clicking
// "Almost ready" / "Ready" / "Cancel" there is what really moves this along.
const POLL_INTERVAL_MS = 2500

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

  const startPolling = useCallback(
    (orderId, forTableId) => {
      if (pollTimer.current) clearInterval(pollTimer.current)

      pollTimer.current = setInterval(async () => {
        try {
          const latest = await getOrder(orderId)

          setOrder((previous) => {
            if (!previous || previous.id !== orderId) return previous
            return latest
          })

          if (FINISHED.includes(latest.status)) {
            clearInterval(pollTimer.current)
            pollTimer.current = null

            // Make sure the customer sees it. No auto-close.
            setTrackingVisible(true)
          }
        } catch (error) {
          // The order no longer exists (the staff merged it into another
          // order, or it was removed): start over cleanly instead of
          // polling a ghost forever.
          if (error?.status === 404) {
            clearInterval(pollTimer.current)
            pollTimer.current = null
            clearOrderId(forTableId)
            setOrder(null)
            setTrackingVisible(false)
            return
          }

          // A single missed poll isn't worth surfacing to the customer —
          // it'll just try again on the next tick.
          console.error('Failed to refresh order status:', error)
        }
      }, POLL_INTERVAL_MS)
    },
    []
  )

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

        if (!isHome) {
          found = await withRetry(() => getActiveOrderForTable(tableId), { isCancelled })
        }

        if (!found) {
          const savedId = readOrderId(tableId)

          if (savedId) {
            try {
              const saved = await withRetry(() => getOrder(savedId), { isCancelled })

              const sameTable = String(saved.tableId) === String(tableId)
              const fresh = Date.now() - new Date(saved.createdAt).getTime() < SAVED_ORDER_TTL_MS

              // Only the customer's own "Done" button removes an order from
              // the phone — so Ready, Completed and Cancelled are all kept.
              // (A table's order that is still being prepared was already
              // brought back above by the active-order request.)
              const keep = isHome ? true : FINISHED.includes(saved.status)

              if (sameTable && fresh && keep) {
                found = saved
              } else {
                clearOrderId(tableId)
              }
            } catch (error) {
              // Gone for good (404) → forget it. Unreachable → keep the id,
              // so the next visit can still find the order.
              if (error?.status === 404) clearOrderId(tableId)
            }
          }
        }

        if (cancelled || !found) return

        saveOrderId(tableId, found.id)

        clearTimers()
        setOrder(found)
        setTrackingVisible(true)

        if (found.status === 'preparing' || found.status === 'almost') {
          startPolling(found.id, tableId)
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
  }, [tableId, clearTimers, startPolling])

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