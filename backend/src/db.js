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
  max: 10,
  // Do not wait forever for a free connection or a slow query: after these
  // limits the request fails cleanly instead of hanging the restaurant.
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 20_000,
  keepAlive: true,
})

// Hosts (Render, Supabase...) close idle database connections now and then.
// Without this listener, node treats that as an unhandled error and the whole
// server dies. With it, the pool simply drops the broken connection and opens
// a new one on the next request.
pool.on('error', (err) => {
  console.error('Database connection dropped (the pool will reconnect):', err.message)
})

export function query(text, params) {
  return pool.query(text, params)
}
