// ---------------------------------------------------------------------------
// Prints a small KITCHEN TICKET for one order (no prices — the kitchen only
// needs to know WHAT to cook, for WHICH table, and what the client asked for).
//
// It is made for a receipt printer (80 mm wide) but any printer works.
// Everything typed by customers (names, notes) is put in with textContent,
// never as HTML, so a note can never inject anything into the page.
// ---------------------------------------------------------------------------
import { clockTime, orderNumber, orderTableLabel } from './components/format'
import { itemName } from '../i18n/menuText'

const CSS = `
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 72mm; margin: 0 auto; padding: 4mm 0 6mm; font-family: "Courier New", monospace; color: #000; font-size: 13px; }
  .center { text-align: center; }
  .title { font-size: 15px; font-weight: 700; letter-spacing: 1px; }
  .number { font-size: 34px; font-weight: 700; line-height: 1.1; margin: 2mm 0; }
  .meta { font-size: 13px; }
  hr { border: 0; border-top: 2px dashed #000; margin: 3mm 0; }
  .line { display: flex; gap: 3mm; font-size: 16px; font-weight: 700; margin: 1.5mm 0; }
  .qty { min-width: 9mm; }
  .note { border: 2px solid #000; padding: 2mm; margin-top: 1mm; }
  .note-label { font-size: 12px; font-weight: 700; letter-spacing: 1px; }
  .note-text { font-size: 16px; font-weight: 700; margin-top: 1mm; white-space: pre-wrap; overflow-wrap: anywhere; }
  .foot { font-size: 11px; margin-top: 3mm; }
`

export function printKitchenTicket(order, { t, lang = 'en' }) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(frame)

  const cleanup = () => frame.remove()

  try {
    const doc = frame.contentDocument
    doc.open()
    doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>')
    doc.close()

    doc.documentElement.lang = lang
    doc.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    doc.title = `#${orderNumber(order)}`

    const style = doc.createElement('style')
    style.textContent = CSS
    doc.head.appendChild(style)

    const add = (parent, tag, text, className) => {
      const node = doc.createElement(tag)
      if (text !== undefined) node.textContent = text
      if (className) node.className = className
      parent.appendChild(node)
      return node
    }
    const body = doc.body

    add(body, 'div', t('admin.orders.ticket.title'), 'center title')
    add(body, 'div', `#${orderNumber(order)}`, 'center number')
    add(body, 'div', orderTableLabel(order, lang), 'center title')
    add(body, 'div', clockTime(order.createdAt, lang), 'center meta')
    add(body, 'hr')

    for (const item of order.items || []) {
      const row = add(body, 'div', undefined, 'line')
      add(row, 'span', `${item.quantity} ×`, 'qty')
      add(row, 'span', itemName(item, lang))
    }

    if (order.note) {
      add(body, 'hr')
      const box = add(body, 'div', undefined, 'note')
      add(box, 'div', t('admin.orders.ticket.note'), 'note-label')
      add(box, 'div', order.note, 'note-text')
    }

    add(body, 'hr')
    add(body, 'div', clockTime(new Date().toISOString(), lang), 'center foot')

    const win = frame.contentWindow
    win.addEventListener('afterprint', cleanup)
    // Safety net: remove the hidden page even if the browser never says "done".
    setTimeout(cleanup, 5 * 60 * 1000)

    // A moment for the browser to lay the page out, then open the print dialog.
    setTimeout(() => {
      try {
        win.focus()
        win.print()
      } catch {
        cleanup()
        window.alert(t('admin.orders.ticket.blocked'))
      }
    }, 80)
    return true
  } catch {
    cleanup()
    window.alert(t('admin.orders.ticket.blocked'))
    return false
  }
}
