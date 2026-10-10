import { Router } from 'express'
import { pool } from '../db.js'
import { serializeTable } from '../serialize.js'

const router = Router()

// GET /api/tables -> the list of real tables, so the frontend can tell a
// valid /table/:id link apart from a made-up one — and so adding a table
// from the dashboard makes its QR link work immediately, with no redeploy.
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM restaurant_tables ORDER BY id ASC',
    )
    res.json(result.rows.map(serializeTable))
  } catch (err) {
    next(err)
  }
})

export default router
