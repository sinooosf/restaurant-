import { Router } from 'express'
import { pool } from '../db.js'
import { serializeTable } from '../serialize.js'
import { TABLE_ORDER_SQL } from '../time.js'
import { normalizeTableId } from '../validate.js'

const router = Router()

// Why customers cannot order at this table right now, or null.
//   'out_of_service'  staff took the table out of service
//   'cleaning'        staff marked it as being cleaned — but only while nobody
//                     has an order in progress there (the dashboard shows such
//                     a table as "occupied", so the guests keep their table)
export async function unavailableReason(db, row) {
  // The home and delivery links have no table that could be cleaned.
  if (row.kind !== 'table') return null
  if (row.status === 'out_of_service') return 'out_of_service'
  if (row.status === 'cleaning') {
    const open = await db.query(
      `SELECT 1 FROM orders
        WHERE table_id = $1 AND status IN ('preparing', 'almost', 'ready')
          AND created_at > now() - interval '6 hours' LIMIT 1`,
      [row.id],
    )
    return open.rows.length === 0 ? 'cleaning' : null
  }
  return null
}

// GET /api/tables -> the list of real tables (plus the special "home" link),
// so the frontend can tell a valid /table/:id link apart from a made-up one —
// and so adding a table from the dashboard makes its QR link work
// immediately, with no redeploy.
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT t.* FROM restaurant_tables t ORDER BY ${TABLE_ORDER_SQL}`,
    )
    res.json(result.rows.map(serializeTable))
  } catch (err) {
    next(err)
  }
})

// GET /api/tables/:id -> one table, or 404.
// The customer app calls this when a scanned link isn't in the list it
// loaded at startup (for example a table added a minute ago, or the list
// request failed while the server was waking up). Asking the server
// directly is what makes a brand-new table work on the very first scan.
router.get('/:id', async (req, res, next) => {
  try {
    if (normalizeTableId(req.params.id) === null) {
      return res.status(404).json({ error: 'Table not found.' })
    }
    const result = await pool.query(
      'SELECT * FROM restaurant_tables WHERE id = $1',
      [req.params.id],
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found.' })
    }
    const row = result.rows[0]
    res.json({ ...serializeTable(row), unavailable: await unavailableReason(pool, row) })
  } catch (err) {
    next(err)
  }
})

export default router
