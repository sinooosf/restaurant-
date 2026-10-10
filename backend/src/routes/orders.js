import { Router } from 'express'
import { pool } from '../db.js'
import { serializeOrder } from '../serialize.js'

const router = Router()

async function loadOrder(id) {
  const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [id])
  if (orderResult.rows.length === 0) return null
  const itemsResult = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [id])
  return serializeOrder(orderResult.rows[0], itemsResult.rows)
}

// POST /api/orders  { tableId, items: [{ id, quantity }] }
//
// Only `id` and `quantity` from each line are trusted. Name and price are
// always looked up fresh from menu_items here on the server — never taken
// from what the customer's browser sends — so there's no way to place an
// order for a price that isn't the real, current one.
router.post('/', async (req, res, next) => {
  const { tableId, items } = req.body || {}

  if (!tableId) {
    return res.status(400).json({ error: 'tableId is required.' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cannot place an empty order.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const tableCheck = await client.query('SELECT id FROM restaurant_tables WHERE id = $1', [tableId])
    if (tableCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: `Unknown table: ${tableId}` })
    }

    const resolvedLines = []
    for (const line of items) {
      const quantity = Number(line?.quantity)
      if (!line?.id || !Number.isInteger(quantity) || quantity <= 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Each item needs a valid id and a positive quantity.' })
      }

      const itemResult = await client.query('SELECT * FROM menu_items WHERE id = $1', [line.id])
      const item = itemResult.rows[0]
      if (!item) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Unknown menu item: ${line.id}` })
      }
      if (!item.available) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `"${item.name}" is not available right now.` })
      }

      const unitPrice = item.discount_percent
        ? Math.round(item.price * (1 - item.discount_percent / 100))
        : item.price

      resolvedLines.push({ id: item.id, name: item.name, quantity, unitPrice })
    }

    const total = resolvedLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)

    const orderResult = await client.query(
      'INSERT INTO orders (table_id, status, total) VALUES ($1, $2, $3) RETURNING *',
      [tableId, 'preparing', total],
    )
    const order = orderResult.rows[0]

    for (const line of resolvedLines) {
      await client.query(
        'INSERT INTO order_items (order_id, item_id, name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
        [order.id, line.id, line.name, line.quantity, line.unitPrice],
      )
    }

    await client.query('COMMIT')
    res.status(201).json(serializeOrder(order, resolvedLines.map((l) => ({
      item_id: l.id, name: l.name, quantity: l.quantity, unit_price: l.unitPrice,
    }))))
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

// GET /api/orders/:id — used by the customer's browser to poll for status
// changes after placing an order (see context/OrderContext.jsx).
router.get('/:id', async (req, res, next) => {
  try {
    const order = await loadOrder(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found.' })
    res.json(order)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/orders/:id/cancel — the customer's own "Cancel order" button.
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const result = await pool.query(
      "UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING *",
      [req.params.id],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found.' })
    const order = await loadOrder(req.params.id)
    res.json(order)
  } catch (err) {
    next(err)
  }
})

export default router
