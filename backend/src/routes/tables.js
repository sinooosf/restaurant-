import { Router } from 'express'
import { pool } from '../db.js'
import { serializeTable } from '../serialize.js'
import { TABLE_ORDER_SQL } from '../time.js'

const router = Router()

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
    const result = await pool.query(
      'SELECT * FROM restaurant_tables WHERE id = $1',
      [req.params.id],
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found.' })
    }
    res.json(serializeTable(result.rows[0]))
  } catch (err) {
    next(err)
  }
})

export default router
