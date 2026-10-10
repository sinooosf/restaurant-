-- ---------------------------------------------------------------------------
-- Schema for the Meet The Chefs ordering system.
-- Run once when setting up a fresh database: `npm run seed` runs this
-- automatically before inserting the starting data.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  image        TEXT NOT NULL,
  description  TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id                TEXT PRIMARY KEY,
  category_id       TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  price             INTEGER NOT NULL CHECK (price >= 0),
  image             TEXT NOT NULL,
  available         BOOLEAN NOT NULL DEFAULT TRUE,
  discount_percent  INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  is_best           BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

-- Named "restaurant_tables" because "table" is a reserved word in SQL.
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id          TEXT PRIMARY KEY,   -- matches the /table/:id link, e.g. '1'
  label       TEXT NOT NULL,      -- shown in the dashboard, e.g. "Table 1"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id          SERIAL PRIMARY KEY,
  table_id    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'preparing'
              CHECK (status IN ('preparing', 'almost', 'ready', 'cancelled')),
  total       INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  INTEGER NOT NULL
);

-- Custom questions the admin adds from the dashboard. The chatbot checks a
-- customer's message for the keyword (case-insensitive) and, if found,
-- replies with the answer.
CREATE TABLE IF NOT EXISTS chatbot_faqs (
  id          SERIAL PRIMARY KEY,
  keyword     TEXT NOT NULL,
  answer      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
