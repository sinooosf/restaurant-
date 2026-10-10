import { Router } from 'express'
import { pool } from '../db.js'
import { serializeCategory, serializeMenuItem } from '../serialize.js'

const router = Router()

// GET /api/menu -> { categories, items } — everything the customer-facing
// app needs to render the menu, in one call.
router.get('/', async (req, res, next) => {
  try {
    const categoriesResult = await pool.query(
      'SELECT * FROM categories ORDER BY sort_order ASC',
    )
    const itemsResult = await pool.query(
      'SELECT * FROM menu_items ORDER BY is_best DESC, sort_order ASC',
    )

    res.json({
      categories: categoriesResult.rows.map(serializeCategory),
      items: itemsResult.rows.map(serializeMenuItem),
    })
  } catch (err) {
    next(err)
  }
})

export default router
