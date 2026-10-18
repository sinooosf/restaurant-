# Meet The Chefs — Restaurant Ordering System

A full QR-code table ordering system: each table gets its own link,
customers order from their phone, and staff track it through a live
dashboard — Preparing → Almost done → Ready. React + Tailwind + Vitest on
the frontend, Node.js + Express + PostgreSQL on the backend.

## Quick start (both pieces)

**1. Backend first** — full instructions in `backend/README.md`, short version:

```bash
cd backend
npm install
cp .env.example .env      # then fill in your DATABASE_URL
npm run seed               # creates tables + starting menu
npm start                  # runs on http://localhost:4000
```

**2. Frontend, in a second terminal:**

```bash
cd frontend
npm install
cp .env.example .env       # points at the backend above
npm run dev                # runs on http://localhost:5173
```

Then open `http://localhost:5173/table/1` (table ids 1-5 exist by
default — add more anytime from the dashboard, see below).

To run the tests: `npm test` (inside `frontend/`).

## The staff dashboard

Go to `/admin` (e.g. `http://localhost:5173/admin`) and log in with the
password in `backend/.env` (`ADMIN_PASSWORD`, defaults to **G6dnC**).

From there:
- **Overview** — today's total earnings and order count. Resets itself at
  midnight automatically since it's always computed from today's actual
  orders, not a counter someone has to clear.
- **Orders** — every order placed today, updating every few seconds on its
  own. Click through Preparing → Almost done → Ready, or cancel.
- **Menu** — edit price, discount %, mark something unavailable, mark a
  dish as a "best" one, or add/remove items entirely.
- **Tables** — add or remove tables. A new table's `/table/<id>` link
  works immediately, no redeploy needed.
- **Chatbot** — add new question-and-answer pairs the chatbot should
  recognize (it checks for the keyword anywhere in what the customer
  types).

Everything here writes straight to the database — a customer scanning a
fresh QR code always sees the current state.

## The 5 table links

```
https://yourdomain.com/table/1
https://yourdomain.com/table/2
https://yourdomain.com/table/3
https://yourdomain.com/table/4
https://yourdomain.com/table/5
```

Print a QR code for each. Add a 6th (or more) anytime from
`/admin/tables` — it starts working immediately.

## Two things you can still swap in yourself

**The intro video.** Drop your video at `frontend/public/intro.mp4`
(exact name) and it plays automatically before the menu loads.

**Logo and chatbot mascot,** if you haven't already — `Logo.jsx` and
`ChatbotAvatar.jsx` under `frontend/src/components/brand/` have a one-line
comment showing how to swap in real image files.

## How the frontend talks to the backend

One file does all of it: `frontend/src/services/api.js`. Every other file
either imports plain data (`data/menu.js`, `data/tables.js`) that gets
filled in once at startup, or calls a function from `api.js` directly —
nothing is hardcoded to the mock data anymore.

A deliberate safety net: if the backend is ever unreachable, the frontend
falls back to the same built-in demo menu and tables this project always
shipped with, instead of showing a blank page. You'll see a console
warning, but the app keeps working.

**Order status** used to be a fake timer. Now it's real: placing an order
calls the backend, and the customer's phone polls for status changes every
2.5 seconds — which is exactly what changes when staff click through the
order on the dashboard.

## Security basics already handled

- **Prices are computed server-side**, never trusted from the browser —
  editing the page can't get someone a discount that isn't real.
- **The admin API re-checks the password on every request** (not just at
  login), so there's no session to expire or go stale.
- An **unavailable item is rejected server-side too**, even if something
  on the page briefly allowed clicking it.

## Project structure

```
restaurant-system/
├── backend/
│   ├── src/
│   │   ├── server.js              Express app entry
│   │   ├── db.js                  PostgreSQL connection
│   │   ├── schema.sql             table definitions
│   │   ├── seed.js                starting data (run once)
│   │   ├── middleware/auth.js     admin password check
│   │   └── routes/                menu, tables, orders, chatbot, admin
│   └── README.md                  full backend setup
└── frontend/
    └── src/
        ├── data/                  menu.js, tables.js (backend-loaded, with offline fallback)
        ├── services/api.js        the one file that calls the backend
        ├── context/               CartContext, OrderContext (now polls real status)
        ├── components/            Header, CategoryList, MenuItemCard, CartBar, OrderTracking, ChatbotPanel...
        ├── pages/                 TablePage, TableNotFound
        ├── admin/                 the whole staff dashboard
        │   ├── AdminAuthContext.jsx
        │   ├── AdminLayout.jsx / AdminLogin.jsx
        │   └── pages/             Overview, Orders, Menu, Tables, Chatbot
        └── tests/                 22 Vitest tests
```


---

## What changed in this version

- **Order numbers (#1, #2, #3…)** — every order gets a number that the customer sees at the top-left
  of the progress sheet and the staff see on the dashboard (Overview, Orders, notifications, ChefBot), so
  both can talk about the same order. The count **starts again at #1 at midnight** in `RESTAURANT_TZ`.
  (The database `id` is a different, ever-growing number used behind the scenes.) Existing orders are
  numbered automatically, per day, the first time the server starts.
- **ToHomeOrder link** — for customers who order without a table. Open `/ToHomeOrder`
  (it is always the last link in Tables → *QR Links*). Their orders appear in the
  dashboard as **To Home** instead of a table number. Each phone only ever sees its own
  To Home order.
- **New dashboard design** (Overview, Orders, Menu, Tables, Chatbot) in the red/black style.
  Orders now also have a **Completed** status (Preparing → Almost Ready → Ready → Completed).
- **Dashboard chatbot (ChefBot)** answers staff questions about live orders, tables, sales
  and best sellers. The old "add questions" screen was removed from the dashboard; the
  customer chatbot's existing FAQ answers still work.
- **Database upgrades are automatic**: the server adds the new columns when it starts, and
  keeps your existing data.
- Set `RESTAURANT_TZ` in `backend/.env` (default `Africa/Algiers`) so "today" matches your
  restaurant's clock.
- Run `npm install` in `frontend/` once (two new font packages were added).

---

## Testing (backend, frontend, browser stress tests)

**Backend** (37 tests: bad input, hostile text, 300 simultaneous orders, races, 1500-request load,
database connections being killed). It wipes the database it is pointed at, so it only uses
`TEST_DATABASE_URL` (never your `.env`) and refuses any database whose name does not contain "test":

```
createdb meet_the_chefs_test
cd backend
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/meet_the_chefs_test npm test
```

**Frontend unit tests** (65 tests): `cd frontend && npm test`

**Browser stress tests** (phones of every size, 3 languages, rapid taps, broken network,
corrupted storage, 12 phones at once, dashboard on 6 screen sizes, drag stress, big data).
Start the backend (on a throw-away/test database!) and the frontend, then:

```
cd frontend
npx playwright install chromium     # once
E2E_URL=http://localhost:5173 E2E_API=http://localhost:4000/api E2E_PASSWORD=your-staff-password npm run e2e
```

---

## Dish pictures from the dashboard

In **Menu → Add Item / Edit**, choose the picture from your computer (JPG, PNG, WebP or GIF).
It is resized in the browser, uploaded to the backend and stored in the database (table
`uploads`), so it survives redeploys. Dishes that already use `/images/...` paths keep working.
