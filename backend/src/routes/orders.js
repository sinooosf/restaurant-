import { Router } from 'express'
import { pool } from '../db.js'
import { serializeOrder } from '../serialize.js'
import { HOME_TABLE_ID } from '../migrate.js'
import { placeOrder } from '../placeOrder.js'
import { notifyNewOrder } from '../push.js'
import { MAX_ORDER_NOTE, cleanNote, normalizeTableId, numericId, parseOrderLines } from '../validate.js'

const router = Router()

// `db` is the pool, or a client that is already checked out. A route that
// holds a client must pass it here: asking the pool for a SECOND connection
// while holding one makes busy moments deadlock (every request waits for a
// connection that only another waiting request could give back).
async function loadOrder(id, db = pool) {
  const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [id])
  if (orderResult.rows.length === 0) return null
  const itemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [id])
  return serializeOrder(orderResult.rows[0], itemsResult.rows)
}

// POST /api/orders  { tableId, items: [{ id, quantity }], note? }
// (the rules live in ../placeOrder.js, shared with the dashboard's "New order")
router.post('/', async (req, res, next) => {
  try {
    const result = await placeOrder(req.body)
    if (result.error) return res.status(result.status).json({ error: result.error })
    notifyNewOrder(result.order) // alert the staff, even if the dashboard is closed
    res.status(201).json(result.order)
  } catch (err) {
    next(err)
  }
})

// GET /api/orders/table/:tableId/active — the order a table still has in
// progress, so scanning the QR code again brings it back.
router.get('/table/:tableId/active', async (req, res, next) => {
  try {
    // "To Home" orders belong to one customer each — two people ordering
    // through that link at the same time must never see each other's order.
    // Their own phone remembers its order id instead.
    if (req.params.tableId === HOME_TABLE_ID || normalizeTableId(req.params.tableId) === null) return res.json(null)

    const result = await pool.query(
      `SELECT id FROM orders
        WHERE table_id = $1
          AND status IN ('preparing', 'almost')
          AND created_at > now() - interval '3 hours'
        ORDER BY created_at DESC
        LIMIT 1`,
      [req.params.tableId],
    )
    if (result.rows.length === 0) return res.json(null)
    res.json(await loadOrder(result.rows[0].id))
  } catch (err) {
    next(err)
  }
})

// POST /api/orders/:id/items  { items: [{ id, quantity }] }
//
// "Add more": puts extra dishes into an order that is still "preparing".
// It edits the SAME order (no second order is created), so the kitchen sees
// one ticket per visit. Once the kitchen moves the order on, it is locked.
router.post('/:id/items', numericId, async (req, res, next) => {
  const parsed = parseOrderLines(req.body?.items)
  if (parsed.error) return res.status(400).json({ error: parsed.error === 'Cannot place an empty order.' ? 'Nothing to add.' : parsed.error })

  const note = cleanNote(req.body?.note, MAX_ORDER_NOTE)
  if (note.error) return res.status(400).json({ error: note.error })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Lock the row so two phones at one table can't edit it at the same time.
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [req.params.id],
    )
    const order = orderResult.rows[0]

    if (!order) {
      await client.query('ROLLBACK').catch(() => {})
      return res.status(404).json({ error: 'Order not found.' })
    }
    if (order.status !== 'preparing') {
      await client.query('ROLLBACK').catch(() => {})
      return res.status(409).json({
        error:
          'The kitchen is already finishing this order, so it can no longer be changed.',
      })
    }

    for (const { id, quantity } of parsed.lines) {
      const itemResult = await client.query('SELECT * FROM menu_items WHERE id = $1', [id])
      const item = itemResult.rows[0]
      if (!item) {
        await client.query('ROLLBACK').catch(() => {})
        return res.status(400).json({ error: `Unknown menu item: ${String(id).slice(0, 60)}` })
      }
      if (!item.available) {
        await client.query('ROLLBACK').catch(() => {})
        return res.status(400).json({ error: `"${item.name}" is not available right now.` })
      }

      const unitPrice = item.discount_percent
        ? Math.round(item.price * (1 - item.discount_percent / 100))
        : item.price

      // Same dish at the same price: raise its quantity. Otherwise add a line.
      const existing = await client.query(
        'SELECT id FROM order_items WHERE order_id = $1 AND item_id = $2 AND unit_price = $3',
        [order.id, item.id, unitPrice],
      )
      if (existing.rows.length > 0) {
        await client.query(
          'UPDATE order_items SET quantity = quantity + $1 WHERE id = $2',
          [quantity, existing.rows[0].id],
        )
      } else {
        await client.query(
          'INSERT INTO order_items (order_id, item_id, name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
          [order.id, item.id, item.name, quantity, unitPrice],
        )
      }
    }

    // The total is always recomputed from the lines, never trusted from the browser.
    // A note sent with the extra dishes is added under the first one.
    await client.query(
      `UPDATE orders
          SET total = (SELECT COALESCE(SUM(quantity * unit_price), 0)
                         FROM order_items WHERE order_id = $1),
              note = CASE WHEN $2 = '' THEN note
                          WHEN note = '' THEN $2
                          ELSE left(note || E'\n' || $2, 1000) END,
              updated_at = now()
        WHERE id = $1`,
      [order.id, note.value],
    )

    const updatedOrder = await loadOrder(order.id, client)
    await client.query('COMMIT')
    res.json(updatedOrder)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    next(err)
  } finally {
    client.release()
  }
})

// GET /api/orders/:id — used by the customer's browser to poll for status
// changes after placing an order (see context/OrderContext.jsx).
router.get('/:id', numericId, async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found.' })
    res.json(order)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/orders/:id/cancel — the customer's own "Cancel order" button.
router.patch('/:id/cancel', numericId, async (req, res, next) => {
  try {
    const existing = await loadOrder(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Order not found.' })

    // Only a dish that hasn't started cooking can be cancelled by the customer.
    if (existing.status !== 'preparing') {
      return res.status(409).json({
        error: 'The kitchen already started this order, so it can no longer be cancelled.',
      })
    }

    await pool.query(
      "UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1",
      [req.params.id],
    )
    res.json(await loadOrder(req.params.id))
  } catch (err) {
    next(err)
  }
})

export default router