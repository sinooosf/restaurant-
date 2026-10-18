// ---------------------------------------------------------------------------
// Safe, repeatable database upgrades.
//
// schema.sql only creates things that don't exist yet, so a database made
// with an OLDER version of this project never gets the newer columns by
// itself. ensureSchema() adds whatever is missing every time the server
// starts (and every time you run `npm run seed`). Running it twice does
// nothing the second time, and it never deletes or rewrites your data.
// ---------------------------------------------------------------------------
import { pool } from './db.js'
import { TZ } from './time.js'

export const HOME_TABLE_ID = 'home'

export async function ensureSchema() {
  // Newer table columns
  await pool.query(`
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS kind   TEXT    NOT NULL DEFAULT 'table';
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS seats  INTEGER NOT NULL DEFAULT 4;
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS status TEXT    NOT NULL DEFAULT 'auto';
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS pos_x REAL;
    ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS pos_y REAL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  `)

  // Orders can now also be "completed" (served and closed by the staff).
  await pool.query(`
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('preparing', 'almost', 'ready', 'completed', 'cancelled'));
  `)

  // The special "ToHomeOrder" link: for customers who order without a table.
  await pool.query(
    `INSERT INTO restaurant_tables (id, label, kind, seats)
     VALUES ($1, 'To Home', 'home', 0)
     ON CONFLICT (id) DO UPDATE SET kind = 'home', label = 'To Home'`,
    [HOME_TABLE_ID],
  )

  await pool.query(`
    CREATE TABLE IF NOT EXISTS uploads (
      id          SERIAL PRIMARY KEY,
      mime        TEXT NOT NULL,
      data        BYTEA NOT NULL,
      size        INTEGER NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);
  `)

  // The order NUMBER the staff and the customer see ("#22"). It is not the
  // database id: it counts the orders of one day and starts again at 1 after
  // midnight (restaurant time zone). `order_day` is the day an order belongs to.
  await pool.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_day     DATE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS daily_number  INTEGER;
  `)

  // Number the orders that were placed before this upgrade (oldest first, per
  // day), continuing after any number that is already taken that day.
  await pool.query(
    `UPDATE orders o
        SET order_day = x.d,
            daily_number = x.n + COALESCE(
              (SELECT MAX(daily_number) FROM orders t WHERE t.order_day = x.d), 0)
       FROM (SELECT id,
                    (created_at AT TIME ZONE $1)::date AS d,
                    ROW_NUMBER() OVER (PARTITION BY (created_at AT TIME ZONE $1)::date
                                       ORDER BY created_at, id) AS n
               FROM orders
              WHERE daily_number IS NULL) x
      WHERE o.id = x.id`,
    [TZ],
  )

  // A safety net: two orders of the same day can never share a number.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_day_number ON orders(order_day, daily_number);
  `)
}
