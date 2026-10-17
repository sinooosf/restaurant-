// Bulk test orders for the dashboard.
//
//   node scripts/bulk-orders.mjs create 500        add 500 random orders
//   node scripts/bulk-orders.mjs cancel            cancel all the orders made by this script
//   node scripts/bulk-orders.mjs ready             mark them ready
//   node scripts/bulk-orders.mjs almost            mark them "almost done"
//   node scripts/bulk-orders.mjs complete          mark them completed
//   node scripts/bulk-orders.mjs status            show how many are in each status
//
// Add  --some 100  to a cancel/ready/almost/complete command to change only
// 100 of them (picked at random). Run it from the backend folder.
//
// The ids of the orders it creates are saved in scripts/.bulk-orders.json, so
// the later commands never touch real customer orders.
//
// Settings (optional):  API_URL (default http://localhost:4000/api)
//                       ADMIN_PASSWORD (default: the one in backend/.env)
import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const API = (process.env.API_URL || `http://localhost:${process.env.PORT || 4000}/api`).replace(/\/$/, '')
const PASSWORD = process.env.ADMIN_PASSWORD
const FILE = join(dirname(fileURLToPath(import.meta.url)), '.bulk-orders.json')
const PARALLEL = 8

const [command, ...rest] = process.argv.slice(2)
const flag = (name) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : undefined
}

const TARGET = { cancel: 'cancelled', ready: 'ready', almost: 'almost', complete: 'completed' }

async function call(path, { method = 'GET', body, admin } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (admin) headers['x-admin-password'] = PASSWORD
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
      const data = await res.json().catch(() => ({}))
      if (res.ok) return data
      if (res.status >= 500 && attempt < 3) { await new Promise((r) => setTimeout(r, 500 * (attempt + 1))); continue }
      throw new Error(`${res.status} ${data.error || ''}`.trim())
    } catch (err) {
      if (attempt === 3 || /^\d{3}/.test(err.message)) throw err
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
}

// Runs `task` over `list` a few at a time, with a progress line.
async function pool(list, label, task) {
  let next = 0, done = 0, failed = 0, lastError = ''
  async function worker() {
    while (next < list.length) {
      const item = list[next++]
      try { await task(item) } catch (err) { failed += 1; lastError = err.message }
      done += 1
      if (done % 25 === 0 || done === list.length) process.stdout.write(`\r${label}: ${done}/${list.length}`)
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))
  process.stdout.write('\n')
  if (failed) console.log(`${failed} failed (last error: ${lastError})`)
  return failed
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const loadIds = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : [])
const saveIds = (ids) => writeFileSync(FILE, JSON.stringify(ids))

async function create(count) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Say how many, e.g.  create 500')
  const menu = await call('/menu')
  const dishes = menu.items.filter((i) => i.available)
  const tables = (await call('/tables')).map((t) => t.id)
  if (!dishes.length || !tables.length) throw new Error('The menu or the tables are empty.')

  const ids = loadIds()
  const failed = await pool(Array.from({ length: count }, (_, i) => i), 'Creating', async () => {
    const lines = Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => ({ id: pick(dishes).id, quantity: 1 + Math.floor(Math.random() * 3) }))
    // the same dish twice in one order is merged by the shop, so keep them unique
    const unique = [...new Map(lines.map((l) => [l.id, l])).values()]
    const order = await call('/orders', { method: 'POST', body: { tableId: pick(tables), items: unique } })
    ids.push(order.id)
  })
  saveIds(ids)
  console.log(`Done: ${count - failed} orders created (${ids.length} saved in total).`)
}

async function changeStatus(status) {
  let ids = loadIds()
  if (!ids.length) return console.log('No orders saved. Run  create 500  first.')
  const some = Number(flag('some'))
  if (some > 0) ids = [...ids].sort(() => Math.random() - 0.5).slice(0, some)
  const failed = await pool(ids, `Setting "${status}"`, (id) => call(`/admin/orders/${id}/status`, { method: 'PATCH', admin: true, body: { status } }))
  console.log(`Done: ${ids.length - failed} orders are now "${status}".`)
}

async function showStatus() {
  const ids = new Set(loadIds())
  const { orders } = await call('/admin/orders?range=all', { admin: true })
  const counts = {}
  for (const o of orders) if (ids.has(o.id)) counts[o.status] = (counts[o.status] || 0) + 1
  console.log(`${ids.size} orders saved by this script. Status:`, counts)
  if (orders.length >= 1000) console.log('(The dashboard API shows the newest 1000 orders only.)')
}

try {
  if (!PASSWORD && command !== 'create') throw new Error('ADMIN_PASSWORD not found. Run from the backend folder, or set it.')
  if (command === 'create') await create(Number(rest[0]))
  else if (TARGET[command]) await changeStatus(TARGET[command])
  else if (command === 'status') await showStatus()
  else console.log('Use: create <number> | cancel | ready | almost | complete | status   (optional: --some <number>)')
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
