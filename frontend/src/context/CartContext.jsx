import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from 'react'

import { MENU_ITEMS, getFinalPrice } from '../data/menu'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [quantities, setQuantities] = useState({})

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