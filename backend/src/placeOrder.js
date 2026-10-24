// ---------------------------------------------------------------------------
// Creating an order — ONE place, used by the customer's phone (POST /api/orders)
// and by the waiter's "New order" screen on the dashboard (POST /api/admin/orders),
// so both follow exactly the same rules.
//
// Only `id` and `quantity` from each line are trusted. Name and price are
// always looked up fresh from menu_items here on the server — never taken
// from the browser — so there is no way to place an order for a price that
// isn't the real, current one.
//
// Returns { order } on success, or { status, error } to send back as-is.
// ---------------------------------------------------------------------------
import { pool } from './db.js'
import { serializeOrder } from './serialize.js'
import { TZ } from './time.js'
import { unavailableReason } from './routes/tables.js'
import { MAX_ORDER_NOTE, cleanNote, normalizeTableId, parseOrderLines } from './validate.js'

// Orders are numbered one after the other (#1, #2, #3...) and the count starts
// again at 1 after midnight. Two orders placed at the same instant must never
// get the same number, so the numbering step takes this lock (it is released
// automatically at COMMIT). It is the last thing a new order does, so it is
// held for a few milliseconds only.
const ORDER_NUMBER_LOCK = 7301

export async function placeOrder(body) {
  const tableId = normalizeTableId(body?.tableId)
  if (!tableId) return { status: 400, error: 'tableId is required.' }

  const parsed = parseOrderLines(body?.items)
  if (parsed.error) return { status: 400, error: parsed.error }

  const note = cleanNote(body?.note, MAX_ORDER_NOTE)
  if (note.error) return { status: 400, error: note.error }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const tableCheck = await client.query('SELECT * FROM restaurant_tables WHERE id = $1', [tableId])
    if (tableCheck.rows.length === 0) {
      await client.query('ROLLBACK').catch(() => {})
      return { status: 400, error: `Unknown table: ${tableId}` }
    }

    // A menu that was already open on a phone (or a dashboard screen) must not
    // be able to order for a table the staff are cleaning or have taken out
    // of service.
    const closed = await unavailableReason(client, tableCheck.rows[0])
    if (closed) {
      await client.query('ROLLBACK').catch(() => {})
      return {
        status: 409,
        error: closed === 'cleaning'
          ? 'This table is being cleaned. Please wait a moment.'
          : 'This table is out of service. Please ask a staff member.',
      }
    }

    const resolvedLines = []
    for (const { id, quantity } of parsed.lines) {
      const itemResult = await client.query('SELECT * FROM menu_items WHERE id = $1', [id])
      const item = itemResult.rows[0]
      if (!item) {
        await client.query('ROLLBACK').catch(() => {})
        return { status: 400, error: `Unknown menu item: ${String(id).slice(0, 60)}` }
      }
      if (!item.available) {
        await client.query('ROLLBACK').catch(() => {})
        return { status: 400, error: `"${item.name}" is not available right now.` }
      }

      const unitPrice = item.discount_percent
        ? Math.round(item.price * (1 - item.discount_percent / 100))
        : item.price

      resolvedLines.push({ id: item.id, name: item.name, quantity, unitPrice })
    }

    const total = resolvedLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)

    const orderResult = await client.query(
      'INSERT INTO orders (table_id, status, total, note) VALUES ($1, $2, $3, $4) RETURNING *',
      [tableId, 'preparing', total, note.value],
    )
    let order = orderResult.rows[0]

    for (const line of resolvedLines) {
      await client.query(
        'INSERT INTO order_items (order_id, item_id, name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
        [order.id, line.id, line.name, line.quantity, line.unitPrice],
      )
    }

    // Give the order today's next number: 1 + the highest number used today
    // (today = the restaurant's own day, so it starts again at 1 after midnight).
    await client.query('SELECT pg_advisory_xact_lock($1)', [ORDER_NUMBER_LOCK])
    const numbered = await client.query(
      `UPDATE orders
          SET order_day = today.d,
              daily_number = COALESCE((SELECT MAX(daily_number) FROM orders WHERE order_day = today.d), 0) + 1
         FROM (SELECT (now() AT TIME ZONE $2)::date AS d) today
        WHERE orders.id = $1
        RETURNING orders.*`,
      [order.id, TZ],
    )
    order = numbered.rows[0]

    await client.query('COMMIT')
    return {
      order: serializeOrder(order, resolvedLines.map((l) => ({
        item_id: l.id, name: l.name, quantity: l.quantity, unit_price: l.unitPrice,
      }))),
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
