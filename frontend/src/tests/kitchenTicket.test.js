import { describe, it, expect, vi, afterEach } from 'vitest'
import { printKitchenTicket } from '../admin/printTicket'
import { translate } from '../i18n/translate'

const t = (key, params) => translate('en', key, params)

afterEach(() => {
  document.querySelectorAll('iframe').forEach((f) => f.remove())
})

describe('printKitchenTicket', () => {
  const order = {
    id: 9,
    number: 14,
    tableId: '3',
    createdAt: new Date().toISOString(),
    note: '<img src=x onerror=alert(1)> no onions',
    items: [
      { id: 'a', name: 'Margherita', quantity: 2, unitPrice: 450 },
      { id: 'b', name: '<b>Evil</b> dish', quantity: 1, unitPrice: 100 },
    ],
  }

  it('prints the dishes and the client note — as plain text, never as HTML', async () => {
    printKitchenTicket(order, { t, lang: 'en' })

    const frame = document.querySelector('iframe')
    const print = vi.fn()
    frame.contentWindow.print = print
    const doc = frame.contentDocument

    expect(doc.body.textContent).toContain('#14')
    expect(doc.body.textContent).toContain('2 ×')
    expect(doc.body.textContent).toContain('Margherita')
    expect(doc.querySelector('.note-text').textContent).toBe('<img src=x onerror=alert(1)> no onions')
    // nothing a customer typed became a real element
    expect(doc.querySelector('img')).toBeNull()
    expect(doc.querySelector('b')).toBeNull()
    // the kitchen ticket shows no prices
    expect(doc.body.textContent).not.toMatch(/450|DH/)

    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('has no note box when the client wrote nothing', () => {
    printKitchenTicket({ ...order, note: '' }, { t, lang: 'en' })
    expect(document.querySelector('iframe').contentDocument.querySelector('.note')).toBeNull()
  })
})
