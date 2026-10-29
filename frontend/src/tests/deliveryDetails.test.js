import { describe, it, expect, vi, afterEach } from 'vitest'
import { deliveryProblem, isValidAddress, isValidPhone } from '../utils/deliveryDetails'
import { isOpenLink, tableIdFromPath, tableLabel } from '../data/tables'
import { submitOrder } from '../services/api'

describe('delivery details', () => {
  it('accepts normal phone numbers and refuses nonsense', () => {
    for (const ok of ['0555 12 34 56', '+213 555 123 456', '(021) 55-44-33', '0555123456']) expect(isValidPhone(ok)).toBe(true)
    for (const bad of ['', '  ', 'abc', '123', '05a5123456', '1'.repeat(30), null, undefined, 5]) expect(isValidPhone(bad)).toBe(false)
  })

  it('needs a written address (several lines are fine)', () => {
    expect(isValidAddress('Rue 5,\nBuilding B')).toBe(true)
    expect(isValidAddress('   ')).toBe(false)
    expect(isValidAddress('x'.repeat(301))).toBe(false)
  })

  it('says which field is wrong, phone first', () => {
    expect(deliveryProblem({ phone: '', address: '' })).toBe('phone')
    expect(deliveryProblem({ phone: '0555123456', address: '' })).toBe('address')
    expect(deliveryProblem({ phone: '0555123456', address: 'Rue 1' })).toBeNull()
  })
})

describe('the /delivery link', () => {
  it('is recognised as its own link and named Delivery', () => {
    expect(tableIdFromPath('/delivery')).toBe('delivery')
    expect(isOpenLink('delivery')).toBe(true)
    expect(isOpenLink('home')).toBe(true)
    expect(isOpenLink('3')).toBe(false)
    expect(tableLabel('delivery')).toBe('Delivery')
  })
})

describe('sending a delivery order', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the phone and the address with the order', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, text: async () => '{"id":1}', json: async () => ({ id: 1 }) }))
    vi.stubGlobal('fetch', fetchMock)
    await submitOrder({ tableId: 'delivery', items: [{ id: 'a', quantity: 1 }], phone: ' 0555123456 ', address: ' Rue 1 ' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.phone).toBe('0555123456')
    expect(body.address).toBe('Rue 1')
  })
})
