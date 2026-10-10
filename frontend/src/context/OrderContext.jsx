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
// The actual status now comes from the dashboard — a staff member clicking
// "Almost done" / "Ready" there is what really moves this along.
const POLL_INTERVAL_MS = 2500
const READY_DISPLAY_MS = 3000

export function OrderProvider({ children }) {
  const [order, setOrder] = useState(null)
  const [trackingVisible, setTrackingVisible] = useState(false)

  const timers = useRef([])
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
    timers.current.forEach((timer) => {
      clearTimeout(timer)
    })
    timers.current = []

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
  // (or someone cancels it), then stops on its own.
  // -------------------------------------------------------------------------

  const startPolling = useCallback((orderId) => {
    pollTimer.current = setInterval(async () => {
      try {
        const latest = await getOrder(orderId)

        setOrder((previous) => {
          if (!previous || previous.id !== orderId) return previous
          return latest
        })

        if (latest.status === 'ready') {
          clearInterval(pollTimer.current)
          pollTimer.current = null

          const closeTimer = setTimeout(() => {
            setTrackingVisible(false)
          }, READY_DISPLAY_MS)

          timers.current.push(closeTimer)
        } else if (latest.status === 'cancelled') {
          clearInterval(pollTimer.current)
          pollTimer.current = null
        }
      } catch (error) {
        // A single missed poll isn't worth surfacing to the customer —
        // it'll just try again on the next tick.
        console.error('Failed to refresh order status:', error)
      }
    }, POLL_INTERVAL_MS)
  }, [])

  // -------------------------------------------------------------------------
  // RESTORE — when someone opens (or re-scans) a table's page, ask the server
  // if that table already has an order in progress. If so, bring it back with
  // its tracking screen, no matter which phone or browser is used.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!tableId) return

    let cancelled = false

    async function restore() {
      try {
        const active = await getActiveOrderForTable(tableId)

        if (cancelled || !active) return

        clearTimers()
        setOrder(active)
        setTrackingVisible(true)
        startPolling(active.id)
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
  // PLACE ORDER
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

      // Actually send the order to the backend. The server computes the
      // real prices itself — this call can throw (e.g. an item went
      // unavailable seconds ago), so TablePage's try/catch around this is
      // what the customer actually sees if it fails.
      const created = await submitOrder({
        tableId,
        items,
      })

      clearTimers()

      // Save the created order.
      setOrder(created)

      // Immediately show tracking.
      setTrackingVisible(true)

      // Start watching for real status changes from the dashboard.
      startPolling(created.id)

      return created
    },
    [clearTimers, startPolling]
  )

  // -------------------------------------------------------------------------
  // CANCEL ORDER
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

      // Remove the active order.
      setOrder(null)

      // Close tracking.
      setTrackingVisible(false)

      // Cancel means the current cart/order is completely gone.
      cart.clearCart()
    } catch (error) {
      console.error('Failed to cancel order:', error)
    }
  }, [order, clearTimers, cart])

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
    cancel,

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