import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { CartProvider, useCart } from '../context/CartContext'

function wrapper({ children }) {
  return <CartProvider>{children}</CartProvider>
}

describe('CartContext', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    expect(result.current.totalCount).toBe(0)
    expect(result.current.totalPrice).toBe(0)
  })

  it('adds an item and totals it correctly', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => result.current.addItem('pizza-1')) // Margherita, 450 DH, no discount

    expect(result.current.totalCount).toBe(1)
    expect(result.current.totalPrice).toBe(450)
  })

  it('applies the item discount when totaling', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => result.current.addItem('pizza-10')) // Garden Veggie Deluxe, 550 DH, -50%

    expect(result.current.totalPrice).toBe(275)
  })

  it('increments quantity on repeated adds', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addItem('drink-1')
      result.current.addItem('drink-1')
    })

    const line = result.current.lines.find((l) => l.item.id === 'drink-1')
    expect(line.quantity).toBe(2)
    expect(result.current.totalCount).toBe(2)
  })

  it('removes an item entirely once its quantity hits zero', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => result.current.addItem('drink-1'))
    act(() => result.current.removeItem('drink-1'))

    expect(result.current.totalCount).toBe(0)
    expect(result.current.lines).toHaveLength(0)
  })

  it('clearCart empties everything', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addItem('drink-1')
      result.current.addItem('pizza-1')
      result.current.clearCart()
    })

    expect(result.current.totalCount).toBe(0)
  })
})
