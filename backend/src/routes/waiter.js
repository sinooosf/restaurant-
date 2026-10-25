import { Router } from 'express'
import { pool } from '../db.js'
import { notifyWaiterCall } from '../push.js'
import { normalizeTableId, numericId } from '../validate.js'

const router = Router()

// POST /api/waiter-calls  { tableId }
//
// The customer's "Call waiter" button. Each table can have ONE open call:
// tapping again while the first is still waiting just returns that same call
// (the database enforces it with a unique index, so even two phones tapping
// at the same instant make a single call).
router.post('/', async (req, res, next) => {
  try {
    const tableId = normalizeTableId(req.body?.tableId)
    if (!tableId) return res.status(400).json({ error: 'tableId is required.' })

    // Only real tables have a waiter to call (not the "To Home" link).
    const table = await pool.query("SELECT id FROM restaurant_tables WHERE id = $1 AND kind = 'table'", [tableId])
    if (table.rows.length === 0) return res.status(400).json({ error: `Unknown table: ${tableId}` })

    // A call nobody answered for hours is stale: close it so a new one can open.
    await pool.query(
      "UPDATE waiter_calls SET resolved_at = now() WHERE table_id = $1 AND resolved_at IS NULL AND created_at < now() - interval '3 hours'",
      [tableId],
    )

    const created = await pool.query(
      'INSERT INTO waiter_calls (table_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *',
      [tableId],
    )
    if (created.rows[0]) {
      const c = created.rows[0]
      notifyWaiterCall({ id: c.id, tableId: c.table_id })
      return res.status(201).json({ id: c.id, tableId: c.table_id, createdAt: c.created_at, resolved: false })
    }

    const existing = await pool.query('SELECT * FROM waiter_calls WHERE table_id = $1 AND resolved_at IS NULL', [tableId])
    const c = existing.rows[0]
    if (!c) return res.status(409).json({ error: 'Please try again.' })
    res.json({ id: c.id, tableId: c.table_id, createdAt: c.created_at, resolved: false })
  } catch (err) {
    next(err)
  }
})

// GET /api/waiter-calls/:id — the phone checks whether the waiter answered.
router.get('/:id', numericId, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM waiter_calls WHERE id = $1', [req.params.id])
    const c = result.rows[0]
    if (!c) return res.status(404).json({ error: 'Call not found.' })
    res.json({ id: c.id, tableId: c.table_id, createdAt: c.created_at, resolved: c.resolved_at !== null })
  } catch (err) {
    next(err)
  }
})

export default router
