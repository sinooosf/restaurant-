import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and fill in your PostgreSQL connection string.',
  )
}

// Render (and most hosts) need SSL for external connections, but a local
// Postgres on your own machine does not — this turns SSL on only when the
// connection string doesn't point at localhost.
const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

export function query(text, params) {
  return pool.query(text, params)
}
