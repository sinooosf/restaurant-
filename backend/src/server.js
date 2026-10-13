import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import menuRoutes from './routes/menu.js'
import tableRoutes from './routes/tables.js'
import orderRoutes from './routes/orders.js'
import chatbotRoutes from './routes/chatbot.js'
import adminRoutes from './routes/admin.js'
import { ensureSchema } from './migrate.js'

const app = express()

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/menu', menuRoutes)
app.use('/api/tables', tableRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/chatbot', chatbotRoutes)
app.use('/api/admin', adminRoutes)

// Keep error responses in the same { error: "message" } shape everywhere,
// so the frontend only ever has to look in one place for it.
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on the server.' })
})

const port = process.env.PORT || 4000

// Bring an older database up to date (new columns, the To Home link...)
// before accepting any request.
ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Meet The Chefs API running on http://localhost:${port}`)
    })
  })
  .catch((err) => {
    console.error('Could not prepare the database:', err)
    process.exit(1)
  })
