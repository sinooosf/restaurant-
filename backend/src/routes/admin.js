import { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import { HOME_TABLE_ID } from '../migrate.js'
import { TZ, dayStartSql, TABLE_ORDER_SQL } from '../time.js'
import {
  serializeCategory,
  serializeMenuItem,
  serializeTable,
  serializeFaq,
  serializeOrder,
} from '../serialize.js'

const router = Router()

// POST /api/admin/login — not itself the security boundary (every other
// admin route re-checks the password on every request via requireAdmin).
// This endpoint just lets the dashboard show "wrong password" immediately
// at login time, instead of only failing later on the first real request.
router.post('/login', (req, res) => {
  const { password } = req.body || {}
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' })
  }
  res.json({ ok: true })
})

router.use(requireAdmin)

// ---------------------------------------------------------------------
// Categories (read-only list, used to populate the "category" dropdown
// when adding/editing a menu item in the dashboard)
// ---------------------------------------------------------------------
router.get('/categories', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY sort_order ASC')
    res.json(result.rows.map(serializeCategory))
  } catch (err) {
    next(err)
  }
})

router.post('/categories', async (req, res, next) => {
  try {
    const { id, name, image, description } = req.body || {}
    const slug = String(id || name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (!slug || !name?.trim()) {
      return res.status(400).json({ error: 'A category needs a name.' })
    }

    const next_sort = await pool.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories')
    const result = await pool.query(
      `INSERT INTO categories (id, name, image, description, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [slug, name.trim(), image || '/logo.png', description?.trim() || '', next_sort.rows[0].n],
    )
    res.status(201).json(serializeCategory(result.rows[0]))
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That category already exists.' })
    next(err)
  }
})

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const used = await pool.query('SELECT COUNT(*)::int AS n FROM menu_items WHERE category_id = $1', [req.params.id])
    if (used.rows[0].n > 0) {
      return res.status(409).json({ error: 'Move or delete the dishes in this category first.' })
    }
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found.' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------
router.get('/menu-items', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM menu_items ORDER BY category_id, sort_order ASC')
    res.json(result.rows.map(serializeMenuItem))
  } catch (err) {
    next(err)
  }
})

router.post('/menu-items', async (req, res, next) => {
  try {
    const { id, categoryId, name, price, image, available, discountPercent, isBest } = req.body || {}
    if (!id || !categoryId || !name || price == null || !image) {
      return res.status(400).json({ error: 'id, categoryId, name, price and image are all required.' })
    }
    const result = await pool.query(
      `INSERT INTO menu_items (id, category_id, name, price, image, available, discount_percent, is_best)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, categoryId, name, price, image, available ?? true, discountPercent ?? 0, isBest ?? false],
    )
    res.status(201).json(serializeMenuItem(result.rows[0]))
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `An item with id "${req.body.id}" already exists.` })
    next(err)
  }
})

router.put('/menu-items/:id', async (req, res, next) => {
  try {
    const { categoryId, name, price, image, available, discountPercent, isBest } = req.body || {}
    const result = await pool.query(
      `UPDATE menu_items SET
         category_id = COALESCE($1, category_id),
         name = COALESCE($2, name),
         price = COALESCE($3, price),
         image = COALESCE($4, image),
         available = COALESCE($5, available),
         discount_percent = COALESCE($6, discount_percent),
         is_best = COALESCE($7, is_best)
       WHERE id = $8
       RETURNING *`,
      [categoryId, name, price, image, available, discountPercent, isBest, req.params.id],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Menu item not found.' })
    res.json(serializeMenuItem(result.rows[0]))
  } catch (err) {
    next(err)
  }
})

router.delete('/menu-items/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM menu_items WHERE id = $1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Menu item not found.' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------
// Tables
//
// A table is "occupied" while it has an order that is preparing, almost
// done or ready (i.e. not yet completed/cancelled by the staff). The staff
// can additionally mark a free table as "cleaning" or "out of service".
// ---------------------------------------------------------------------
const OPEN_STATUSES = ['preparing', 'almost', 'ready']

function tableState(row, hasOrder) {
  if (row.kind === 'home') return 'home'
  if (row.status === 'out_of_service') return 'out_of_service'
  if (hasOrder) return 'occupied'
  if (row.status === 'cleaning') return 'cleaning'
  return 'available'
}

router.get('/tables', async (req, res, next) => {
  try {
    const tablesResult = await pool.query(
      `SELECT t.* FROM restaurant_tables t ORDER BY ${TABLE_ORDER_SQL}`,
    )

    // Every order that is still open, newest first (one per table is shown).
    const openResult = await pool.query(
      `SELECT * FROM orders
        WHERE status = ANY($1)
          AND created_at > now() - interval '6 hours'
        ORDER BY created_at DESC`,
      [OPEN_STATUSES],
    )

    const ids = openResult.rows.map((o) => o.id)
    const itemsResult = ids.length
      ? await pool.query('SELECT * FROM order_items WHERE order_id = ANY($1)', [ids])
      : { rows: [] }
    const itemsByOrder = {}
    for (const row of itemsResult.rows) (itemsByOrder[row.order_id] ||= []).push(row)

    const latestByTable = {}
    const openCountByTable = {}
    for (const o of openResult.rows) {
      openCountByTable[o.table_id] = (openCountByTable[o.table_id] || 0) + 1
      if (!latestByTable[o.table_id]) latestByTable[o.table_id] = o
    }

    res.json(
      tablesResult.rows.map((row) => {
        const open = latestByTable[row.id]
        return {
          ...serializeTable(row),
          override: row.status,
          state: tableState(row, Boolean(open)),
          openOrders: openCountByTable[row.id] || 0,
          order: open ? serializeOrder(open, itemsByOrder[open.id] || []) : null,
        }
      }),
    )
  } catch (err) {
    next(err)
  }
})

router.post('/tables', async (req, res, next) => {
  try {
    const { id, label, seats } = req.body || {}
    const cleanId = String(id ?? '').trim()

    if (!cleanId) return res.status(400).json({ error: 'id is required, e.g. "6".' })
    if (!/^[A-Za-z0-9_-]+$/.test(cleanId)) {
      return res.status(400).json({ error: 'The table ID can only use letters, numbers, - and _.' })
    }
    if (cleanId.toLowerCase() === HOME_TABLE_ID) {
      return res.status(400).json({ error: '"home" is reserved for the ToHomeOrder link.' })
    }

    const seatCount = Math.min(Math.max(parseInt(seats, 10) || 4, 1), 20)

    const result = await pool.query(
      'INSERT INTO restaurant_tables (id, label, seats) VALUES ($1, $2, $3) RETURNING *',
      [cleanId, String(label || '').trim() || `Table ${cleanId}`, seatCount],
    )
    res.status(201).json(serializeTable(result.rows[0]))
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `Table "${req.body.id}" already exists.` })
    next(err)
  }
})

// Change seats / label, or set the manual status (auto | cleaning | out_of_service).
router.patch('/tables/:id', async (req, res, next) => {
  try {
    const { seats, label, status } = req.body || {}

    if (status !== undefined && !['auto', 'cleaning', 'out_of_service'].includes(status)) {
      return res.status(400).json({ error: 'status must be auto, cleaning or out_of_service.' })
    }

    const seatCount = seats === undefined ? null : Math.min(Math.max(parseInt(seats, 10) || 1, 1), 20)

    const result = await pool.query(
      `UPDATE restaurant_tables SET
         seats  = COALESCE($1, seats),
         label  = COALESCE($2, label),
         status = COALESCE($3, status)
       WHERE id = $4 AND kind = 'table'
       RETURNING *`,
      [seatCount, label?.trim() || null, status ?? null, req.params.id],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Table not found.' })
    res.json(serializeTable(result.rows[0]))
  } catch (err) {
    next(err)
  }
})

router.delete('/tables/:id', async (req, res, next) => {
  try {
    if (req.params.id === HOME_TABLE_ID) {
      return res.status(400).json({ error: 'The ToHomeOrder link is built in and cannot be removed.' })
    }

    const busy = await pool.query(
      `SELECT 1 FROM orders WHERE table_id = $1 AND status = ANY($2) AND created_at > now() - interval '6 hours' LIMIT 1`,
      [req.params.id, OPEN_STATUSES],
    )
    if (busy.rows.length > 0) {
      return res.status(409).json({ error: 'This table has an order in progress. Finish or cancel it first.' })
    }

    const result = await pool.query('DELETE FROM restaurant_tables WHERE id = $1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Table not found.' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------
// Chatbot FAQs
// ---------------------------------------------------------------------
router.get('/chatbot-faqs', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM chatbot_faqs ORDER BY created_at ASC')
    res.json(result.rows.map(serializeFaq))
  } catch (err) {
    next(err)
  }
})

router.post('/chatbot-faqs', async (req, res, next) => {
  try {
    const { keyword, answer } = req.body || {}
    if (!keyword || !answer) return res.status(400).json({ error: 'keyword and answer are both required.' })
    const result = await pool.query(
      'INSERT INTO chatbot_faqs (keyword, answer) VALUES ($1, $2) RETURNING *',
      [keyword, answer],
    )
    res.status(201).json(serializeFaq(result.rows[0]))
  } catch (err) {
    next(err)
  }
})

router.put('/chatbot-faqs/:id', async (req, res, next) => {
  try {
    const { keyword, answer } = req.body || {}
    const result = await pool.query(
      `UPDATE chatbot_faqs SET keyword = COALESCE($1, keyword), answer = COALESCE($2, answer)
       WHERE id = $3 RETURNING *`,
      [keyword, answer, req.params.id],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'FAQ not found.' })
    res.json(serializeFaq(result.rows[0]))
  } catch (err) {
    next(err)
  }
})

router.delete('/chatbot-faqs/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM chatbot_faqs WHERE id = $1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'FAQ not found.' })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------
// Orders — list, one order, status changes, move and merge
// ---------------------------------------------------------------------
const VALID_STATUSES = ['preparing', 'almost', 'ready', 'completed', 'cancelled']

// range: 'today' | 'yesterday' | 'all'  →  [from, to) as SQL conditions
function rangeCondition(range) {
  if (range === 'all') return { sql: 'TRUE', params: [] }
  const [a, b] = range === 'yesterday' ? [-1, 0] : [0, 1]
  return {
    sql: `created_at >= ${dayStartSql('$1', a)} AND created_at < ${dayStartSql('$1', b)}`,
    params: [TZ],
  }
}

async function attachItems(orderRows) {
  const ids = orderRows.map((o) => o.id)
  const itemsResult = ids.length
    ? await pool.query('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id', [ids])
    : { rows: [] }

  const itemsByOrder = {}
  for (const row of itemsResult.rows) (itemsByOrder[row.order_id] ||= []).push(row)

  return orderRows.map((o) => serializeOrder(o, itemsByOrder[o.id] || []))
}

router.get('/orders', async (req, res, next) => {
  try {
    const range = ['today', 'yesterday', 'all'].includes(req.query.range)
      ? req.query.range
      : req.query.scope === 'all' ? 'all' : 'today'
    const cond = rangeCondition(range)

    const ordersResult = await pool.query(
      `SELECT * FROM orders WHERE ${cond.sql} ORDER BY created_at DESC LIMIT 1000`,
      cond.params,
    )

    const countsResult = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM orders WHERE ${cond.sql} GROUP BY status`,
      cond.params,
    )
    const counts = { preparing: 0, almost: 0, ready: 0, completed: 0, cancelled: 0 }
    for (const row of countsResult.rows) counts[row.status] = row.n

    res.json({ orders: await attachItems(ordersResult.rows), counts })
  } catch (err) {
    next(err)
  }
})

// Tiny payload polled by the dashboard shell: the red badge next to
// "Orders" in the sidebar and the notification bell.
router.get('/summary', async (req, res, next) => {
  try {
    const pending = await pool.query(
      `SELECT * FROM orders
        WHERE status IN ('preparing', 'almost')
          AND created_at > now() - interval '12 hours'
        ORDER BY created_at DESC
        LIMIT 8`,
    )
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM orders
        WHERE status IN ('preparing', 'almost')
          AND created_at > now() - interval '12 hours'`,
    )
    res.json({
      pendingCount: count.rows[0].n,
      pending: await attachItems(pending.rows),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/orders/:id', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Order not found.' })
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found.' })
    res.json((await attachItems(result.rows))[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body || {}
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
    }
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [status, req.params.id],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found.' })
    res.json((await attachItems(result.rows))[0])
  } catch (err) {
    next(err)
  }
})

// Move an order to another (free) table.
router.patch('/orders/:id/move', async (req, res, next) => {
  try {
    const { tableId } = req.body || {}

    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id])
    const order = orderResult.rows[0]
    if (!order) return res.status(404).json({ error: 'Order not found.' })
    if (!OPEN_STATUSES.includes(order.status)) {
      return res.status(409).json({ error: 'Only an order in progress can be moved.' })
    }

    const target = await pool.query(
      `SELECT * FROM restaurant_tables WHERE id = $1 AND kind = 'table'`,
      [tableId],
    )
    if (target.rows.length === 0) return res.status(404).json({ error: 'That table does not exist.' })
    if (target.rows[0].status === 'out_of_service') {
      return res.status(409).json({ error: 'That table is out of service.' })
    }

    const busy = await pool.query(
      `SELECT 1 FROM orders WHERE table_id = $1 AND status = ANY($2)
          AND created_at > now() - interval '6 hours' AND id <> $3 LIMIT 1`,
      [tableId, OPEN_STATUSES, order.id],
    )
    if (busy.rows.length > 0) {
      return res.status(409).json({ error: 'That table already has an order. Use "Merge Tables" instead.' })
    }

    const updated = await pool.query(
      'UPDATE orders SET table_id = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [tableId, order.id],
    )
    res.json((await attachItems(updated.rows))[0])
  } catch (err) {
    next(err)
  }
})

// Merge two open orders into one: every dish of `fromOrderId` goes into
// `intoOrderId`, and the emptied order is removed.
router.post('/orders/merge', async (req, res, next) => {
  const fromId = Number(req.body?.fromOrderId)
  const intoId = Number(req.body?.intoOrderId)

  if (!Number.isInteger(fromId) || !Number.isInteger(intoId) || fromId === intoId) {
    return res.status(400).json({ error: 'Pick two different orders to merge.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const locked = await client.query(
      'SELECT * FROM orders WHERE id = ANY($1) ORDER BY id FOR UPDATE',
      [[fromId, intoId]],
    )
    const from = locked.rows.find((o) => o.id === fromId)
    const into = locked.rows.find((o) => o.id === intoId)

    if (!from || !into) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Order not found.' })
    }
    if (!OPEN_STATUSES.includes(from.status) || !OPEN_STATUSES.includes(into.status)) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Only orders in progress can be merged.' })
    }

    const lines = await client.query('SELECT * FROM order_items WHERE order_id = $1', [fromId])
    for (const line of lines.rows) {
      const same = await client.query(
        'SELECT id FROM order_items WHERE order_id = $1 AND item_id = $2 AND unit_price = $3',
        [intoId, line.item_id, line.unit_price],
      )
      if (same.rows.length > 0) {
        await client.query('UPDATE order_items SET quantity = quantity + $1 WHERE id = $2', [line.quantity, same.rows[0].id])
      } else {
        await client.query(
          'INSERT INTO order_items (order_id, item_id, name, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
          [intoId, line.item_id, line.name, line.quantity, line.unit_price],
        )
      }
    }

    await client.query('DELETE FROM orders WHERE id = $1', [fromId])
    await client.query(
      `UPDATE orders
          SET total = (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM order_items WHERE order_id = $1),
              updated_at = now()
        WHERE id = $1`,
      [intoId],
    )

    await client.query('COMMIT')

    const merged = await pool.query('SELECT * FROM orders WHERE id = $1', [intoId])
    res.json((await attachItems(merged.rows))[0])
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

// ---------------------------------------------------------------------
// Overview — everything the Overview page and the assistant need, in one
// request. Always computed live from the orders themselves (no counters to
// reset), in the restaurant's own time zone.
//
// range = 'today' (default) or 'yesterday'. Every number is compared with
// the day before it.
// ---------------------------------------------------------------------
function emptyHours() {
  return Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }))
}

router.get('/overview', async (req, res, next) => {
  try {
    const range = req.query.range === 'yesterday' ? 'yesterday' : 'today'
    const offset = range === 'yesterday' ? -1 : 0

    const bounds = await pool.query(
      `SELECT ${dayStartSql('$1', offset)}     AS start,
              ${dayStartSql('$1', offset + 1)} AS "end",
              ${dayStartSql('$1', offset - 1)} AS prev_start,
              EXTRACT(HOUR FROM now() AT TIME ZONE $1)::int AS now_hour`,
      [TZ],
    )
    const { start, end, prev_start: prevStart, now_hour: nowHour } = bounds.rows[0]

    async function totals(from, to) {
      const r = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status <> 'cancelled')::int                       AS orders,
           COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0)::int        AS revenue,
           COUNT(*) FILTER (WHERE status IN ('preparing', 'almost'))::int           AS pending,
           COUNT(*) FILTER (WHERE status IN ('ready', 'completed'))::int            AS completed,
           COUNT(*) FILTER (WHERE status = 'cancelled')::int                        AS cancelled
         FROM orders WHERE created_at >= $1 AND created_at < $2`,
        [from, to],
      )
      const row = r.rows[0]
      return { ...row, avg: row.orders ? Math.round(row.revenue / row.orders) : 0 }
    }

    async function hourly(from, to) {
      const r = await pool.query(
        `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE $3)::int AS hour,
                COUNT(*)::int AS orders,
                COALESCE(SUM(total), 0)::int AS revenue
           FROM orders
          WHERE created_at >= $1 AND created_at < $2 AND status <> 'cancelled'
          GROUP BY hour`,
        [from, to, TZ],
      )
      const hours = emptyHours()
      for (const row of r.rows) hours[row.hour] = row
      return hours
    }

    const [current, previous, hoursNow, hoursPrev] = await Promise.all([
      totals(start, end),
      totals(prevStart, start),
      hourly(start, end),
      hourly(prevStart, start),
    ])

    const top = await pool.query(
      `SELECT oi.item_id AS id,
              MAX(oi.name) AS name,
              SUM(oi.quantity)::int AS quantity,
              COUNT(DISTINCT o.id)::int AS orders
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= $1 AND o.created_at < $2 AND o.status <> 'cancelled'
        GROUP BY oi.item_id
        ORDER BY orders DESC, quantity DESC
        LIMIT 5`,
      [start, end],
    )

    const tableCounts = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM restaurant_tables WHERE kind = 'table') AS total_tables,
         (SELECT COUNT(DISTINCT o.table_id)::int
            FROM orders o JOIN restaurant_tables t ON t.id = o.table_id AND t.kind = 'table'
           WHERE o.status = ANY($1) AND o.created_at > now() - interval '6 hours') AS occupied_tables`,
      [OPEN_STATUSES],
    )

    const recent = await pool.query(
      `SELECT * FROM orders WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at DESC LIMIT 5`,
      [start, end],
    )

    res.json({
      range,
      nowHour,
      current,
      previous,
      popular: top.rows[0] || null,
      topItems: top.rows,
      hourly: { current: hoursNow, previous: hoursPrev },
      quick: {
        activeTables: tableCounts.rows[0].occupied_tables,
        totalTables: tableCounts.rows[0].total_tables,
        pending: current.pending,
        completed: current.completed,
        cancelled: current.cancelled,
      },
      recent: await attachItems(recent.rows),
    })
  } catch (err) {
    next(err)
  }
})

// Kept for older clients: today's total and order count.
router.get('/earnings/today', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(total), 0)::int AS total,
         COUNT(*)::int AS order_count
       FROM orders
       WHERE created_at >= ${dayStartSql('$1', 0)}
         AND status != 'cancelled'`,
      [TZ],
    )
    res.json({ total: result.rows[0].total, orderCount: result.rows[0].order_count })
  } catch (err) {
    next(err)
  }
})

export default router
