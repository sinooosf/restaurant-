import { Router } from 'express'
import { pool } from '../db.js'
import { serializeFaq } from '../serialize.js'

const router = Router()

// GET /api/chatbot/faqs -> the custom questions added from the dashboard.
// The built-in questions (name, best dishes, hours...) stay in the
// frontend's code since they need live menu data — this endpoint only
// carries the extra ones the admin adds.
router.get('/faqs', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM chatbot_faqs ORDER BY created_at ASC',
    )
    res.json(result.rows.map(serializeFaq))
  } catch (err) {
    next(err)
  }
})

export default router
