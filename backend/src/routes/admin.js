import { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
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
// ---------------------------------------------------------------------
router.get('/tables', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM restaurant_tables ORDER BY id ASC')
    res.json(result.rows.map(serializeTable))
  } catch (err) {
    next(err)
  }
})

router.post('/tables', async (req, res, next) => {
  try {
    const { id, label } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id is required, e.g. "6".' })
    const result = await pool.query(
      'INSERT INTO restaurant_tables (id, label) VALUES ($1, $2) RETURNING *',
      [String(id), label || `Table ${id}`],
    )
    res.status(201).json(serializeTable(result.rows[0]))
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `Table "${req.body.id}" already exists.` })
    next(err)
  }
})

router.delete('/tables/:id', async (req, res, next) => {
  try {
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
// Orders — list (today by default) + advance/cancel status
// ---------------------------------------------------------------------
router.get('/orders', async (req, res, next) => {
  try {
    const scope = req.query.scope === 'all' ? 'all' : 'today'
    const since = scope === 'today' ? "created_at >= date_trunc('day', now())" : 'TRUE'

    // Everything still in the kitchen, plus only the latest finished orders.
    const ordersResult = await pool.query(`
      (SELECT * FROM orders WHERE ${since} AND status IN ('preparing', 'almost'))
      UNION ALL
      (SELECT * FROM orders WHERE ${since} AND status IN ('ready', 'cancelled')
         ORDER BY created_at DESC LIMIT 30)
      ORDER BY created_at DESC
    `)

    // Real totals for the stat cards, so they stay correct even though
    // only the latest finished orders are sent.
    const countsResult = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM orders WHERE ${since} GROUP BY status`,
    )
    const counts = { preparing: 0, almost: 0, ready: 0, cancelled: 0 }
    for (const row of countsResult.rows) counts[row.status] = row.n

    const ids = ordersResult.rows.map((o) => o.id)
    const itemsResult = ids.length
      ? await pool.query('SELECT * FROM order_items WHERE order_id = ANY($1)', [ids])
      : { rows: [] }

    const itemsByOrder = {}
    for (const row of itemsResult.rows) {
      ;(itemsByOrder[row.order_id] ||= []).push(row)
    }

    const orders = ordersResult.rows.map((o) =>
      serializeOrder(o, itemsByOrder[o.id] || []),
    )
    res.json({ orders, counts })
  } catch (err) {
    next(err)
  }
})

const VALID_STATUSES = ['preparing', 'almost', 'ready', 'cancelled']

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body || {}
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
    }
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id],
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found.' })
    const itemsResult = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id])
    res.json(serializeOrder(result.rows[0], itemsResult.rows))
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------
// Earnings — today's total and order count. Always computed live from
// today's orders (never a stored counter), so it naturally "resets" at
// midnight with nothing to clear by hand, and nothing is ever lost.
// ---------------------------------------------------------------------
router.get('/earnings/today', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(total), 0)::int AS total,
         COUNT(*)::int AS order_count
       FROM orders
       WHERE created_at >= date_trunc('day', now())
         AND status != 'cancelled'`,
    )
    res.json({ total: result.rows[0].total, orderCount: result.rows[0].order_count })
  } catch (err) {
    next(err)
  }
})

export default router
