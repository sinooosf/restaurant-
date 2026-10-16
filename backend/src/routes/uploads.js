import { Router } from 'express'
import { pool } from '../db.js'
import { numericId } from '../validate.js'

const router = Router()

// GET /api/uploads/:id -> the picture itself.
// Pictures never change once stored (a new upload gets a new id), so browsers
// may keep them for a year.
router.get('/:id', numericId, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT mime, data FROM uploads WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Picture not found.' })

    res.set({
      'Content-Type': result.rows[0].mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // The picture is shown on another address (the frontend), which is allowed.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    })
    res.send(result.rows[0].data)
  } catch (err) {
    next(err)
  }
})

export default router
