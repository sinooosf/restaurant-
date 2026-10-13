import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react'

import { useLocation } from 'react-router-dom'

import { MENU_ITEMS, getFinalPrice } from '../data/menu'
import { tableIdFromPath } from '../data/tables'

const CartContext = createContext(null)

// A saved cart is forgotten after this long, so the next guest at a table
// doesn't inherit someone else's old selections.
const CART_TTL_MS = 6 * 60 * 60 * 1000

// Reads the cart saved on this phone for one table (or an empty cart).
function readSavedCart(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}

    const saved = JSON.parse(raw)
    if (!saved || Date.now() - saved.savedAt > CART_TTL_MS) return {}

    const clean = {}
    for (const [itemId, qty] of Object.entries(saved.quantities || {})) {
      if (Number.isInteger(qty) && qty > 0) clean[itemId] = qty
    }
    return clean
  } catch {
    return {}
  }
}

export function CartProvider({ children }) {
  // Which table is this phone looking at? (from the /table/:tableId address)
  const location = useLocation()
  const tableId = tableIdFromPath(location.pathname)
  const storageKey = tableId ? `mtc-cart-table-${tableId}` : null

  const [quantities, setQuantities] = useState({})
  const [hydratedKey, setHydratedKey] = useState(null)

  // 1) When the table is known, load the cart saved for it.
  useEffect(() => {
    if (!storageKey) return

    setQuantities(readSavedCart(storageKey))
    setHydratedKey(storageKey)
  }, [storageKey])

  // 2) Save every change (only after loading, so we never wipe a saved cart).
  useEffect(() => {
    if (!storageKey || hydratedKey !== storageKey) return

    try {
      if (Object.keys(quantities).length === 0) {
        localStorage.removeItem(storageKey)
      } else {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ quantities, savedAt: Date.now() })
        )
      }
    } catch {
      // Storage can be blocked (private mode). The cart still works,
      // it just won't be remembered.
    }
  }, [quantities, storageKey, hydratedKey])

  const addItem = useCallback((itemId) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }))
  }, [])

  const removeItem = useCallback((itemId) => {
    setQuantities((prev) => {
      const current = prev[itemId] || 0

      if (current <= 1) {
        const next = { ...prev }
        delete next[itemId]
        return next
      }

      return {
        ...prev,
        [itemId]: current - 1,
      }
    })
  }, [])

  const clearCart = useCallback(() => {
    setQuantities({})
  }, [])

  const restoreItems = useCallback((items) => {
    setQuantities((prev) => {
      const next = { ...prev }

      for (const item of items) {
        next[item.id] = (next[item.id] || 0) + item.quantity
      }

      return next
    })
  }, [])

  const lines = useMemo(() => {
    return Object.entries(quantities)
      .map(([itemId, quantity]) => {
        const item = MENU_ITEMS.find(
          (menuItem) => menuItem.id === itemId
        )

        if (!item) return null

        const unitPrice = getFinalPrice(item)

        return {
          item,
          quantity,
          unitPrice,
          lineTotal: unitPrice * quantity,
        }
      })
      .filter(Boolean)
  }, [quantities])

  const totalCount = useMemo(() => {
    return lines.reduce(
      (sum, line) => sum + line.quantity,
      0
    )
  }, [lines])

  const totalPrice = useMemo(() => {
    return lines.reduce(
      (sum, line) => sum + line.lineTotal,
      0
    )
  }, [lines])

  const value = {
    quantities,
    lines,
    totalCount,
    totalPrice,
    addItem,
    removeItem,
    clearCart,
    restoreItems,
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error(
      'useCart must be used within a CartProvider'
    )
  }

  return context
}