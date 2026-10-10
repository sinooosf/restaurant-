import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'

import { matchPath, useLocation } from 'react-router-dom'

import {
  submitOrder,
  addItemsToOrder,
  getOrder,
  getActiveOrderForTable,
  cancelOrder as cancelOrderRequest,
} from '../services/api'

import { useCart } from './CartContext'

const OrderContext = createContext(null)

export const ORDER_STAGES = [
  'preparing',
  'almost',
  'ready',
]

// How often to ask the backend "has this order's status changed yet?"
// The actual status comes from the dashboard — a staff member clicking
// "Almost done" / "Ready" / "Cancel" there is what really moves this along.
const POLL_INTERVAL_MS = 2500

// The phone remembers which order it placed at each table, so a finished
// ("Ready" / "Cancelled") order can still be closed after a reload.
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
    return localStorage.getItem(orderKey(tableId))
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

export function OrderProvider({ children }) {
  const [order, setOrder] = useState(null)
  const [trackingVisible, setTrackingVisible] = useState(false)

  const pollTimer = useRef(null)

  // CartProvider is above OrderProvider in App.jsx,
  // so OrderContext can safely access the cart.
  const cart = useCart()

  // Which table is this phone looking at? (from the /table/:tableId address)
  const location = useLocation()
  const tableId = matchPath('/table/:tableId', location.pathname)?.params
    .tableId

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

  const startPolling = useCallback((orderId) => {
    if (pollTimer.current) clearInterval(pollTimer.current)

    pollTimer.current = setInterval(async () => {
      try {
        const latest = await getOrder(orderId)

        setOrder((previous) => {
          if (!previous || previous.id !== orderId) return previous
          return latest
        })

        if (latest.status === 'ready' || latest.status === 'cancelled') {
          clearInterval(pollTimer.current)
          pollTimer.current = null

          // Make sure the customer sees it. No auto-close.
          setTrackingVisible(true)
        }
      } catch (error) {
        // A single missed poll isn't worth surfacing to the customer —
        // it'll just try again on the next tick.
        console.error('Failed to refresh order status:', error)
      }
    }, POLL_INTERVAL_MS)
  }, [])

  // -------------------------------------------------------------------------
  // RESTORE — when someone opens (or re-scans) a table's page:
  //  1. if the table already has an order in progress, bring it back;
  //  2. otherwise, if THIS phone has an order that finished (Ready /
  //     Cancelled) but was never closed, show it so it can be closed.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!tableId) return

    let cancelled = false

    async function restore() {
      try {
        let found = await getActiveOrderForTable(tableId)

        if (!found) {
          const savedId = readOrderId(tableId)

          if (savedId) {
            try {
              const saved = await getOrder(savedId)

              if (saved.status === 'ready' || saved.status === 'cancelled') {
                found = saved
              } else {
                clearOrderId(tableId)
              }
            } catch {
              clearOrderId(tableId)
            }
          }
        }

        if (cancelled || !found) return

        saveOrderId(tableId, found.id)

        clearTimers()
        setOrder(found)
        setTrackingVisible(true)

        if (found.status === 'preparing' || found.status === 'almost') {
          startPolling(found.id)
        }
      } catch (error) {
        // If this fails the customer simply sees a fresh page.
        console.error('Failed to restore the table order:', error)
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
      startPolling(created.id)

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
  // FINISH — the customer closes a Ready or Cancelled order. Everything goes
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