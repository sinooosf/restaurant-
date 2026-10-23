import express, { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin, checkAdminPassword, sendAuthError } from '../middleware/auth.js'
import { HOME_TABLE_ID } from '../migrate.js'
import { TZ, dayStartSql, TABLE_ORDER_SQL } from '../time.js'
import { checkDish, isInt, isText, normalizeTableId, numericId, safeTextId } from '../validate.js'
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
  const problem = checkAdminPassword(req, password)
  if (problem) return sendAuthError(res, problem)
  res.json({ ok: true })
})

router.use(requireAdmin)

// Every :id in a URL is checked for NUL bytes / absurd length first.
router.param('id', safeTextId)

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
// Pictures uploaded from the dashboard
//
// The browser sends the raw picture bytes (Content-Type: image/jpeg, ...).
// We check the real file signature (not just the label), limit the size, and
// store it in the database. The dish then points to it as "/uploads/<id>".
// SVG is refused on purpose: an SVG can carry scripts.
// ---------------------------------------------------------------------
const PICTURE_TYPES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/webp': (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  'image/gif': (b) => b.toString('ascii', 0, 4) === 'GIF8',
}

router.post(
  '/uploads',
  express.raw({ type: Object.keys(PICTURE_TYPES), limit: '4mb' }),
  async (req, res, next) => {
    try {
      const mime = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      const body = req.body

      if (!PICTURE_TYPES[mime] || !Buffer.isBuffer(body) || body.length < 12) {
        return res.status(400).json({ error: 'Send a JPG, PNG, WebP or GIF picture.' })
      }
      if (!PICTURE_TYPES[mime](body)) {
        return res.status(400).json({ error: 'That file is not a real picture of the type it claims.' })
      }

      const result = await pool.query(
        'INSERT INTO uploads (mime, data, size) VALUES ($1, $2, $3) RETURNING id',
        [mime, body, body.length],
      )
      res.status(201).json({ image: `/uploads/${result.rows[0].id}` })
    } catch (err) {
      next(err)
    }
  },
)

// Deletes an uploaded picture once no dish or category uses it any more.
async function dropUnusedUpload(imagePath) {
  const match = /^\/uploads\/([1-9]\d{0,8})$/.exec(imagePath || '')
  if (!match) return
  await pool.query(
    `DELETE FROM uploads WHERE id = $1
       AND NOT EXISTS (SELECT 1 FROM menu_items WHERE image = $2)
       AND NOT EXISTS (SELECT 1 FROM categories WHERE image = $2)`,
    [match[1], imagePath],
  )
}

router.post('/categories', async (req, res, next) => {
  try {
    const { id, name, image, description } = req.body || {}
    if (!isText(name, 80) || (id !== undefined && !isText(id, 80)) || (image !== undefined && !isText(image, 500)) || (description !== undefined && typeof description !== 'string')) {
      return res.status(400).json({ error: 'A category needs a name (up to 80 characters).' })
    }
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

// A category that still has dishes is only deleted when the dashboard asks
// for it explicitly with ?withDishes=true — the dishes are removed with it.
// Past orders are not affected (order lines keep their own name and price).
router.delete('/categories/:id', async (req, res, next) => {
  const withDishes = req.query.withDishes === 'true'
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const dishes = await client.query('SELECT image FROM menu_items WHERE category_id = $1', [req.params.id])
    if (dishes.rows.length > 0 && !withDishes) {
      await client.query('ROLLBACK').catch(() => {})
      return res.status(409).json({ error: 'This category still has dishes. Confirm to delete it together with its dishes.' })
    }

    // The menu_items rows go with the category (ON DELETE CASCADE).
    const result = await client.query('DELETE FROM categories WHERE id = $1 RETURNING id, image', [req.params.id])
    if (result.rows.length === 0) {
      await client.query('ROLLBACK').catch(() => {})
      return res.status(404).json({ error: 'Category not found.' })
    }
    await client.query('COMMIT')

    // Free the space of the uploaded pictures (category + its dishes) now unused.
    for (const image of [result.rows[0].image, ...dishes.rows.map((d) => d.image)]) {
      await dropUnusedUpload(image).catch(() => {})
    }
    res.json({ ok: true, removedDishes: dishes.rows.length })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    next(err)
  } finally {
    client.release()
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
    if (id !== undefined && id !== null && !isText(id, 80)) {
      return res.status(400).json({ error: 'The id must be text (or leave it out).' })
    }
    const problem = checkDish(req.body)
    if (problem) return res.status(400).json({ error: problem })

    // No id given (the dashboard form never sends one): make it from the name,
    // e.g. "Spicy Burger" -> "spicy-burger-4f2a". A random tail keeps it unique.
    const slug = String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'dish'
    const newId = id || `${slug}-${Math.random().toString(16).slice(2, 6)}`

    const result = await pool.query(
      `INSERT INTO menu_items (id, category_id, name, price, image, available, discount_percent, is_best)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [newId, categoryId, name, price, image, available ?? true, discountPercent ?? 0, isBest ?? false],
    )
    res.status(201).json(serializeMenuItem(result.rows[0]))
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `An item with id "${String(req.body?.id).slice(0, 60)}" already exists.` })
    if (err.code === '23503') return res.status(400).json({ error: 'That category does not exist.' })
    next(err)
  }
})

router.put('/menu-items/:id', async (req, res, next) => {
  try {
    const { categoryId, name, price, image, available, discountPercent, isBest } = req.body || {}
    const problem = checkDish(req.body, { partial: true })
    if (problem) return res.status(400).json({ error: problem })
    const before = await pool.query('SELECT image FROM menu_items WHERE id = $1', [req.params.id])
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
    // The old uploaded picture (if any) is no longer used: free the space.
    if (before.rows[0] && before.rows[0].image !== result.rows[0].image) {
      await dropUnusedUpload(before.rows[0].image).catch(() => {})
    }
    res.json(serializeMenuItem(result.rows[0]))
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'That category does not exist.' })
    next(err)
  }
})

router.delete('/menu-items/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM menu_items WHERE id = $1 RETURNING id, image', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Menu item not found.' })
    await dropUnusedUpload(result.rows[0].image).catch(() => {})
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
    if ((typeof id !== 'string' && typeof id !== 'number') || (label !== undefined && label !== null && !isText(label, 60))) {
      return res.status(400).json({ error: 'id is required, e.g. "6".' })
    }
    const cleanId = String(id ?? '').trim()
    if (cleanId.length > 40) return res.status(400).json({ error: 'The table ID can be at most 40 characters.' })

    if (!cleanId) return res.status(400).json({ error: 'id is required, e.g. "6".' })
    if (!/^[A-Za-z0-9_-]+$/.test(cleanId)) {
      return res.status(400).json({ error: 'The table ID can only use letters, numbers, - and _.' })
    }
    if (cleanId.toLowerCase() === HOME_TABLE_ID) {
      return res.status(400).json({ error: '"home" is reserved for the ToHomeOrder link.' })
    }

    const seatCount = Math.min(Math.max(Math.trunc(Number(seats)) || 4, 1), 20)

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

// Floor-plan position in % (0-100), or null when not sent.
const pct = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, 0), 100) : null)

// Change seats / label, or set the manual status (auto | cleaning | out_of_service).
router.patch('/tables/:id', async (req, res, next) => {
  try {
    const { seats, label, status, posX, posY } = req.body || {}
    if (label !== undefined && label !== null && !isText(label, 60)) {
      return res.status(400).json({ error: 'The label must be 1–60 characters.' })
    }
    if (seats !== undefined && seats !== null && !Number.isFinite(Number(seats))) {
      return res.status(400).json({ error: 'seats must be a number.' })
    }

    if (status !== undefined && !['auto', 'cleaning', 'out_of_service'].includes(status)) {
      return res.status(400).json({ error: 'status must be auto, cleaning or out_of_service.' })
    }

    const seatCount = seats === undefined || seats === null ? null : Math.min(Math.max(Math.trunc(Number(seats)) || 1, 1), 20)

    const result = await pool.query(
      `UPDATE restaurant_tables SET
         seats  = COALESCE($1, seats),
         label  = COALESCE($2, label),
         status = COALESCE($3, status),
         pos_x  = COALESCE($5, pos_x),
         pos_y  = COALESCE($6, pos_y)
       WHERE id = $4 AND kind = 'table'
       RETURNING *`,
      [seatCount, (typeof label === 'string' ? label.trim() : '') || null, status ?? null, req.params.id, pct(posX), pct(posY)],
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
    if (!isText(keyword, 200) || !isText(answer, 2000)) return res.status(400).json({ error: 'keyword and answer are both required.' })
    const result = await pool.query(
      'INSERT INTO chatbot_faqs (keyword, answer) VALUES ($1, $2) RETURNING *',
      [keyword, answer],
    )
    res.status(201).json(serializeFaq(result.rows[0]))
  } catch (err) {
    next(err)
  }
})

router.put('/chatbot-faqs/:id', numericId, async (req, res, next) => {
  try {
    const { keyword, answer } = req.body || {}
    if ((keyword != null && !isText(keyword, 200)) || (answer != null && !isText(answer, 2000))) {
      return res.status(400).json({ error: 'keyword and answer must be text.' })
    }
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

router.delete('/chatbot-faqs/:id', numericId, async (req, res, next) => {
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

router.get('/orders/:id', numericId, async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Order not found.' })
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found.' })
    res.json((await attachItems(result.rows))[0])
  } catch (err) {
    next(err)
  }
})

router.patch('/orders/:id/status', numericId, async (req, res, next) => {
  try {
    const status = req.body?.status
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
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
// The target table's row is locked while we check and move, so two staff
// members cannot both send an order to the same free table at the same time.
router.patch('/orders/:id/move', numericId, async (req, res, next) => {
  const tableId = normalizeTableId(req.body?.tableId)
  if (tableId === null) return res.status(404).json({ error: 'That table does not exist.' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const target = await client.query(
      `SELECT * FROM restaurant_tables WHERE id = $1 AND kind = 'table' FOR UPDATE`,
      [tableId],
    )
    if (target.rows.length === 0) {
      await client.query('ROLLBACK').catch(() => {})
      return res.status(404).json({ error: 'That table does not exist.' })
    }
    if (target.rows[0].status === 'out_of_service') {
      await client.query('ROLLBACK').catch(() => {})
      return res.status(409).json({ error: 'That table is out of service.' })
    }

    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id])
    const order = orderResult.rows[0]
    if (!order) {
      await client.query('ROLLBACK').catch(() => {})
      return res.status(404).json({ error: 'Order not found.' })
    }
    if (!OPEN_STATUSES.includes(order.status)) {
      await client.query('ROLLBACK').catch(() => {})
      return res.status(409).json({ error: 'Only an order in progress can be moved.' })
    }

    const busy = await client.query(
      `SELECT 1 FROM orders WHERE table_id = $1 AND status = ANY($2)
          AND created_at > now() - interval '6 hours' AND id <> $3 LIMIT 1`,
      [tableId, OPEN_STATUSES, order.id],
    )
    if (busy.rows.length > 0) {
      await client.query('ROLLBACK').catch(() => {})
      return res.status(409).json({ error: 'That table already has an order. Use "Merge Tables" instead.' })
    }

    const updated = await client.query(
      'UPDATE orders SET table_id = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [tableId, order.id],
    )
    const items = await client.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [order.id])
    await client.query('COMMIT')
    res.json(serializeOrder(updated.rows[0], items.rows))
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    next(err)
  } finally {
    client.release()
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
      await client.query('ROLLBACK').catch(() => {})
      return res.status(404).json({ error: 'Order not found.' })
    }
    if (!OPEN_STATUSES.includes(from.status) || !OPEN_STATUSES.includes(into.status)) {
      await client.query('ROLLBACK').catch(() => {})
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

    const merged = await client.query('SELECT * FROM orders WHERE id = $1', [intoId])
    const mergedItems = await client.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [intoId])
    await client.query('COMMIT')
    res.json(serializeOrder(merged.rows[0], mergedItems.rows))
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
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
