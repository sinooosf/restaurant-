# Backend — Meet The Chefs API

Node.js + Express + PostgreSQL. Powers the customer ordering app and the
`/admin` staff dashboard in the frontend.

## 1. Set up PostgreSQL

You need a PostgreSQL database somewhere — either on your own machine, or a
free one on a host like Render (this pairs well with hosting the backend on
Render and the frontend on Vercel, as discussed).

**Local Postgres:** install it, then create a database:

```bash
createdb meet_the_chefs
```

**Render (or similar):** create a Postgres instance there and copy its
connection string — you'll need it in the next step.

## 2. Configure

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set:
- `DATABASE_URL` — your connection string from step 1
- `ADMIN_PASSWORD` — the dashboard login password (defaults to `G6dnC`, change it before this goes live for real)
- `FRONTEND_ORIGIN` — where your frontend runs (comma-separate more than one, e.g. localhost + your deployed domain)

## 3. Create the tables and starting menu

```bash
npm run seed
```

This creates every table (`schema.sql`) and, only if the database is
currently empty, fills it with the 40 starting menu items, 5 tables, and 2
example chatbot questions. Safe to run again later — it won't touch
anything you've since edited from the dashboard.

## 4. Run it

```bash
npm start
```

The API listens on `http://localhost:4000` by default (`PORT` in `.env`).
Check it's alive: `curl http://localhost:4000/api/health`.

The frontend needs to know this address too — set `VITE_API_URL` in
`frontend/.env` to match (see `frontend/.env.example`).

## How the pieces fit together

- **Customer app** (`/table/:id`) talks to the public endpoints: `GET
  /api/menu`, `GET /api/tables`, `GET /api/chatbot/faqs`, and the order
  endpoints.
- **Staff dashboard** (`/admin`) talks to everything under `/api/admin/*`,
  which all require the `x-admin-password` header — the dashboard handles
  that automatically once you log in.
- **Order status** (Preparing -> Almost done -> Ready) is set by staff
  clicking through it on `/admin/orders`. The customer's phone polls every
  few seconds and updates on its own — nothing to refresh manually on
  either side.
- **Prices are never trusted from the browser.** Placing an order only
  sends item ids and quantities; the server looks up the real price
  itself. This also means an item marked unavailable can't be ordered even
  if someone tampers with the page.

## Security note on the admin password

This uses one shared password for the whole dashboard, sent with every
request — intentionally simple for a single-restaurant tool, not built for
multiple staff accounts or permission levels. That's a reasonable
trade-off for what this is, but if you ever want individual staff logins
or role-based access, that's a real upgrade to plan for separately, not
something to bolt on later by accident.

## Deploying

Any Node host works. For Render specifically: create a "Web Service"
pointed at the `backend` folder, set the same environment variables from
`.env` in Render's dashboard (not a checked-in `.env` file), and use its
managed Postgres for `DATABASE_URL`. Run `npm run seed` once (Render's
shell tab, or run it locally pointed at the Render database) to set up the
starting data.
