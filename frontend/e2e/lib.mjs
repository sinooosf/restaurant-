// Shared helpers for the browser stress tests.
import { chromium } from 'playwright'

export const URL = process.env.E2E_URL || 'http://localhost:5173'
export const API = process.env.E2E_API || 'http://localhost:4100/api'
export const PASSWORD = process.env.E2E_PASSWORD // the staff password of the backend you test against
if (!PASSWORD) throw new Error('Set E2E_PASSWORD to the ADMIN_PASSWORD of the backend you are testing.')

export async function api(path, { method = 'GET', body, admin = false } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(admin ? { 'x-admin-password': PASSWORD } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launch() {
  return chromium.launch()
}

// Collects every JavaScript error, console error, failed page and surprise
// popup (alert) on a page. `allow` = substrings of console errors to ignore.
export function watch(page, bucket, { allow = [] } = {}) {
  const base = ['ERR_NAME_NOT_RESOLVED', 'ERR_INTERNET_DISCONNECTED']
  page.on('pageerror', (e) => bucket.push(`PAGE ERROR: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    if ([...base, ...allow].some((a) => text.includes(a))) return
    bucket.push(`CONSOLE: ${text.slice(0, 220)}`)
  })
  page.on('dialog', (d) => { bucket.push(`UNEXPECTED DIALOG: ${d.message()}`); d.dismiss() })
  page.on('crash', () => bucket.push('PAGE CRASHED'))
}

// Customer: open an address, get past the intro and the language screen.
export async function enterCustomer(page, path = '/table/1', lang = 'en') {
  await page.goto(`${URL}${path}`)
  await page.locator('[role=radio]').first().waitFor({ timeout: 45000 })
  const idx = { en: 0, fr: 1, ar: 2 }[lang]
  await page.locator('[role=radio]').nth(idx).click()
  await page.locator('[role=radiogroup]').locator('xpath=following-sibling::button').click()
  await page.waitForTimeout(600)
}

export async function adminLogin(page, lang = null) {
  await page.goto(`${URL}/admin/login`)
  await page.locator('input[type=password]').fill(PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/admin\/?$/, { timeout: 15000 })
  await page.waitForTimeout(500)
}

export async function horizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

// A tiny test runner: each scenario is isolated; a failure never stops the rest.
export function createRunner() {
  const results = []
  async function scenario(name, fn) {
    if (process.env.E2E_ONLY && !new RegExp(process.env.E2E_ONLY, 'i').test(name)) return
    const t0 = Date.now()
    const problems = []
    try {
      await fn(problems)
    } catch (e) {
      problems.push(`THREW: ${String(e.message).split('\n')[0]}`)
    }
    const ok = problems.length === 0
    results.push({ name, ok, problems })
    console.log(`${ok ? '✅' : '❌'} ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
    problems.slice(0, 8).forEach((p) => console.log(`     - ${p}`))
  }
  function summary() {
    const failed = results.filter((r) => !r.ok)
    console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`)
    return failed.length
  }
  return { scenario, summary, results }
}

export function expect(problems, condition, message) {
  if (!condition) problems.push(message)
}
