import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { submitOrder, addItemsToOrder } from '../services/api'

let sent
beforeEach(() => {
  sent = []
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    sent.push({ url, body: init?.body ? JSON.parse(init.body) : undefined })
    return { ok: true, status: 200, json: async () => ({ id: 1 }) }
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('the client note travels with the order', () => {
  it('is sent (trimmed) when the client wrote one', async () => {
    await submitOrder({ tableId: '1', items: [{ id: 'a', quantity: 1, name: 'x', unitPrice: 5 }], note: '  no onions  ' })
    expect(sent[0].body).toEqual({ tableId: '1', items: [{ id: 'a', quantity: 1 }], note: 'no onions' })
  })

  it('is left out when empty, and also works for "add more"', async () => {
    await submitOrder({ tableId: '1', items: [{ id: 'a', quantity: 1 }], note: '   ' })
    expect(sent[0].body).not.toHaveProperty('note')

    await addItemsToOrder(5, [{ id: 'b', quantity: 2 }], 'extra spicy')
    expect(sent[1].body).toEqual({ items: [{ id: 'b', quantity: 2 }], note: 'extra spicy' })
  })
})
