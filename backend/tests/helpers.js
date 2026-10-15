// Test helpers: start the real server against a THROW-AWAY database.
//
// Safety: these tests wipe and re-create every table in the database they are
// pointed at, so they ONLY use TEST_DATABASE_URL — never the DATABASE_URL in
// your .env (that may be your real restaurant). Example:
//
//   createdb meet_the_chefs_test
//   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/meet_the_chefs_test npm test
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const TEST_DB = process.env.TEST_DATABASE_URL
export const ADMIN_PASSWORD = 'test-password'

export function assertSafeDatabase() {
  if (!TEST_DB) {
    throw new Error('Set TEST_DATABASE_URL to an empty throw-away database to run the tests.')
  }
  const name = new URL(TEST_DB).pathname.replace('/', '')
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to wipe database "${name}": its name must contain "test".`)
  }
}

export async function resetDatabase() {
  assertSafeDatabase()
  const isLocal = /localhost|127\.0\.0\.1/.test(TEST_DB)
  const client = new pg.Client({ connectionString: TEST_DB, ssl: isLocal ? false : { rejectUnauthorized: false } })
  await client.connect()
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await client.end()

  const seed = spawnSync('node', ['src/seed.js'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: TEST_DB },
    encoding: 'utf8',
  })
  if (seed.status !== 0) throw new Error(`Seeding failed: ${seed.stderr || seed.stdout}`)
}

export async function startServer(extraEnv = {}) {
  const port = 4600 + Math.floor(Math.random() * 300)
  const child = spawn('node', ['src/server.js'], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DB,
      PORT: String(port),
      ADMIN_PASSWORD,
      FRONTEND_ORIGIN: 'http://localhost:5173',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let log = ''
  child.stdout.on('data', (d) => (log += d))
  child.stderr.on('data', (d) => (log += d))

  const base = `http://localhost:${port}/api`

  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) break
    } catch {
      /* still starting */
    }
    if (child.exitCode !== null) throw new Error(`Server exited early:\n${log}`)
    await new Promise((r) => setTimeout(r, 250))
  }

  async function api(path, { method = 'GET', body, admin = false, password, headers = {}, raw } = {}) {
    const h = { ...headers }
    if (admin) h['x-admin-password'] = password ?? ADMIN_PASSWORD
    if (body !== undefined && raw === undefined) h['content-type'] = 'application/json'
    const res = await fetch(`${base}${path}`, {
      method,
      headers: h,
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* not json */
    }
    return { status: res.status, body: json, text }
  }

  return {
    api,
    base,
    child,
    logs: () => log,
    alive: () => child.exitCode === null,
    stop: () => new Promise((resolve) => {
      if (child.exitCode !== null) return resolve()
      child.once('exit', resolve)
      child.kill('SIGTERM')
    }),
  }
}

// Kills every open database connection (simulates the host restarting the
// database or dropping idle connections — which really happens on free tiers).
export async function killDbConnections() {
  const isLocal = /localhost|127\.0\.0\.1/.test(TEST_DB)
  const client = new pg.Client({ connectionString: TEST_DB, ssl: isLocal ? false : { rejectUnauthorized: false } })
  await client.connect()
  await client.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()',
  )
  await client.end()
}

export async function firstMenuItems(api, n = 3) {
  const menu = await api('/menu')
  return menu.body.items.filter((i) => i.available).slice(0, n)
}
