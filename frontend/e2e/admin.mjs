// Dashboard stress tests. Run:  node e2e/admin.mjs
import { URL, API, PASSWORD, api, sleep, launch, watch, adminLogin, horizontalOverflow, createRunner, expect } from './lib.mjs'

const { scenario, summary } = createRunner()
const browser = await launch()

async function staff(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts })
  if (opts.lang) await ctx.addInitScript((l) => localStorage.setItem('meetthechefs.admin.language', l), opts.lang)
  const page = await ctx.newPage()
  return { ctx, page }
}
const orderViaApi = (tableId, items) => api('/orders', { method: 'POST', body: { tableId, items } })
async function seedOrders(n) {
  const menu = (await api('/menu')).body.items.filter((i) => i.available)
  const tables = ['1', '2', '3', '4', '5', 'home']
  const jobs = []
  for (let i = 0; i < n; i += 1) jobs.push(orderViaApi(tables[i % 6], [{ id: menu[i % menu.length].id, quantity: (i % 3) + 1 }]))
  const res = await Promise.all(jobs)
  const ids = res.filter((r) => r.status === 201).map((r) => r.body.id)
  // spread statuses around
  await Promise.all(ids.map((id, i) => i % 5 === 0 ? null : api(`/admin/orders/${id}/status`, { method: 'PATCH', admin: true, body: { status: ['almost', 'ready', 'completed', 'cancelled'][i % 4] } })))
  return ids
}

await scenario('login: wrong password, guard, logout, expired password', async (p) => {
  const { ctx, page } = await staff()
  watch(page, p, { allow: ['401', 'Failed to load resource'] })
  await page.goto(`${URL}/admin`)
  await page.waitForURL(/login/, { timeout: 8000 }).catch(() => p.push('/admin did not redirect to login when logged out'))
  await page.locator('input[type=password]').fill('wrong')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  expect(p, /login/.test(page.url()), 'wrong password let the user in')
  expect(p, (await page.locator('body').innerText()).length > 30, 'login page blank after wrong password')
  for (const path of ['/admin/orders', '/admin/menu', '/admin/tables', '/admin/chatbot']) {
    await page.goto(`${URL}${path}`); await page.waitForTimeout(600)
    expect(p, /login/.test(page.url()), `${path} opened without logging in`)
  }
  await adminLogin(page)
  // server starts refusing the password (changed on the server): the dashboard must not break
  await ctx.route('**/api/admin/**', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Incorrect password."}' }))
  await page.goto(`${URL}/admin/orders`); await page.waitForTimeout(2500)
  expect(p, /login/.test(page.url()), 'a rejected password did not send the user back to the login screen')
  expect(p, (await page.locator('body').innerText()).trim().length > 30, 'blank screen after the password stopped working')
  await ctx.close()
})

await scenario('every page on 6 screen sizes x English/Arabic: no errors, no sideways scroll', async (p) => {
  await seedOrders(30)
  const sizes = [[1920, 1080], [1536, 864], [1366, 768], [1024, 768], [820, 1180], [390, 844]]
  for (const lang of ['en', 'ar']) {
    for (const [w, h] of sizes) {
      const { ctx, page } = await staff({ viewport: { width: w, height: h }, lang })
      watch(page, p)
      await adminLogin(page)
      for (const path of ['/admin', '/admin/orders', '/admin/menu', '/admin/tables', '/admin/chatbot']) {
        await page.goto(`${URL}${path}`); await page.waitForTimeout(1300)
        const over = await horizontalOverflow(page)
        if (over > 0) p.push(`${lang} ${w}x${h} ${path}: sideways overflow ${over}px`)
        const blank = (await page.locator('main').innerText()).trim().length < 20
        if (blank) p.push(`${lang} ${w}x${h} ${path}: blank page`)
      }
      await ctx.close()
    }
  }
})

await scenario('chatbot page fits the screen without page scrolling (desktop sizes)', async (p) => {
  for (const [w, h] of [[1920, 1080], [1536, 864], [1440, 900], [1366, 768], [1280, 720]]) {
    const { ctx, page } = await staff({ viewport: { width: w, height: h } })
    watch(page, p)
    await adminLogin(page)
    await page.goto(`${URL}/admin/chatbot`); await page.waitForTimeout(1200)
    const scrolls = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    expect(p, scrolls <= 1, `${w}x${h}: chatbot page scrolls vertically by ${scrolls}px`)
    await ctx.close()
  }
})

await scenario('chatbot answers 30 questions in 3 languages and gibberish without crashing', async (p) => {
  const { ctx, page } = await staff()
  watch(page, p, { allow: ['404'] }) // "order #99999" legitimately answers 404
  await adminLogin(page)
  await page.goto(`${URL}/admin/chatbot`); await page.waitForTimeout(1000)
  const qs = ['hi', 'How many orders do we have right now?', "What's the most popular item today?", 'table status', 'how much did we make today', 'longest wait', 'any to home orders', 'which items are hidden', 'help', 'is table 3 free', 'order #1', 'order #99999', 'average order', 'busiest hour', 'price of margherita', 'what is ready', 'latest order', 'biggest order', 'most expensive dish', 'discounts', 'how many seats', 'cheapest', 'كم عدد الطلبات الآن', 'combien de commandes', 'الطاولات الحرة', '', '    ', 'x'.repeat(8000), '<img src=x onerror=alert(1)>', "'; DROP TABLE orders;--", '🍕🍕🍕', '\u202e']
  const box = page.locator('form input').first()
  for (const q of qs) { await box.fill(q); await box.press('Enter'); await page.waitForTimeout(250) }
  await page.waitForTimeout(2500)
  const bubbles = await page.locator('p.whitespace-pre-line').count()
  expect(p, bubbles >= 25, `only ${bubbles} answers appeared`)
  // quick action buttons
  const buttons = page.locator('main button').filter({ hasText: /\w/ })
  const n = Math.min(await buttons.count(), 40)
  for (let i = 0; i < n; i += 1) await buttons.nth(i).click({ timeout: 1500 }).catch(() => {})
  await page.waitForTimeout(1500)
  expect(p, (await page.locator('main').innerText()).length > 100, 'page empty after clicking everything')
  await ctx.close()
})

await scenario('Orders page with 400 orders: pagination, search, filter, status changes, no sideways scroll', async (p) => {
  await seedOrders(400)
  const { ctx, page } = await staff({ viewport: { width: 1280, height: 800 } })
  watch(page, p)
  await adminLogin(page)
  await page.goto(`${URL}/admin/orders`); await page.waitForTimeout(2500)
  const over = await page.evaluate(() => { const t = document.querySelector('table'); let e = t; while (e && e !== document.body) { if (e.scrollWidth > e.clientWidth + 1) return e.tagName + ':' + (e.scrollWidth - e.clientWidth); e = e.parentElement } return 0 })
  expect(p, !over, `the orders table scrolls sideways (${over})`)
  expect(p, (await page.locator('tbody tr').count()) === 10, 'page 1 should show 10 rows')
  for (const label of ['2', '3', '5']) await page.getByRole('button', { name: label, exact: true }).first().click({ timeout: 2000 }).catch(() => {})
  const search = page.locator('input[type=text], input:not([type])').first()
  for (const term of ['#12', 'pizza', 'to home', 'zzzzzz', "'; --", '<b>', '']) { await search.fill(term); await page.waitForTimeout(250) }
  // rapid status changes through the row menu
  await search.fill('')
  for (let i = 0; i < 12; i += 1) {
    const row = page.locator('tbody tr').nth(i % 10)
    await row.locator('button').last().click({ timeout: 2000 }).catch(() => {})
    await page.locator('div.absolute button').first().click({ timeout: 800 }).catch(() => {})
  }
  // open and close the detail dialog repeatedly
  for (let i = 0; i < 8; i += 1) { await page.locator('tbody tr').first().locator('button').first().click().catch(() => {}); await page.keyboard.press('Escape') }
  await page.waitForTimeout(1500)
  expect(p, (await page.locator('main').innerText()).length > 100, 'page empty after the abuse')
  await ctx.close()
})

await scenario('Tables page: 60 random drags, options menu on every table, seats +/- spam, add and remove 25 tables', async (p) => {
  const { ctx, page } = await staff({ viewport: { width: 1440, height: 1000 } })
  watch(page, p)
  await adminLogin(page)
  await page.goto(`${URL}/admin/tables`); await page.waitForTimeout(2000)
  for (let i = 0; i < 25; i += 1) await api('/admin/tables', { method: 'POST', admin: true, body: { id: String(100 + i), seats: (i % 10) + 1 } })
  await page.reload(); await page.waitForTimeout(2500)
  const tables = page.locator('div[role=button][aria-label^="Table"]')
  const count = await tables.count()
  expect(p, count >= 30, `only ${count} tables drawn`)
  const floor = await page.locator('div.select-none').first().boundingBox()
  for (let i = 0; i < 60; i += 1) {
    const t = tables.nth(i % count); const box = await t.boundingBox()
    if (!box) continue
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    // sometimes far outside the floor
    const tx = i % 7 === 0 ? floor.x - 400 : floor.x + Math.random() * floor.width
    const ty = i % 9 === 0 ? floor.y + floor.height + 300 : floor.y + 160 + Math.random() * (floor.height - 200)
    await page.mouse.move(tx, ty, { steps: 4 })
    await page.mouse.up()
  }
  await page.waitForTimeout(2500)
  // every table must still be inside the floor
  const outside = await page.evaluate(() => {
    const fl = document.querySelector('div.select-none').getBoundingClientRect()
    return [...document.querySelectorAll('div[role=button][aria-label^="Table"]')].filter((el) => { const r = el.getBoundingClientRect(); return r.left < fl.left - 70 || r.right > fl.right + 70 || r.top < fl.top - 70 || r.bottom > fl.bottom + 70 }).length
  })
  expect(p, outside === 0, `${outside} tables ended up outside the floor`)
  const saved = (await api('/admin/tables', { admin: true })).body.filter((t) => t.posX !== null).length
  expect(p, saved >= 20, `only ${saved} positions were saved`)
  // option menu on many tables, spam the + / - buttons
  for (let i = 0; i < 12; i += 1) {
    await tables.nth(i).dblclick({ force: true, timeout: 2000 }).catch(() => {})
    for (let k = 0; k < 6; k += 1) await page.getByRole('button', { name: /more places|plus/i }).first().click({ timeout: 500 }).catch(() => {})
    await page.keyboard.press('Escape')
  }
  await tables.nth(3).click({ button: 'right', force: true }).catch(() => {})
  await page.keyboard.press('Escape')
  const seatsOk = (await api('/admin/tables', { admin: true })).body.filter((t) => t.kind !== 'home').every((t) => t.seats >= 1 && t.seats <= 20)
  expect(p, seatsOk, 'a table got an impossible number of seats')
  for (let i = 0; i < 25; i += 1) await api(`/admin/tables/${100 + i}`, { method: 'DELETE', admin: true })
  await page.waitForTimeout(6000)
  expect(p, (await tables.count()) < count, 'deleted tables did not disappear from the floor')
  await ctx.close()
})

await scenario('Menu page: hostile names, edits, availability spam, categories', async (p) => {
  const cats = (await api('/admin/categories', { admin: true })).body
  const nasty = `<img src=x onerror=alert('xss')>"><script>alert(2)</script> 🍕 ' OR 1=1`
  const made = await api('/admin/menu-items', { method: 'POST', admin: true, body: { id: 'xss-dish', categoryId: cats[0].id, name: nasty, price: 100000, image: '/logo.png' } })
  expect(p, made.status === 201, `could not create dish: ${made.status}`)
  const { ctx, page } = await staff({ viewport: { width: 1440, height: 900 } })
  watch(page, p)
  await adminLogin(page)
  await page.goto(`${URL}/admin/menu`); await page.waitForTimeout(2200)
  expect(p, (await page.locator('main').innerText()).includes('<img src=x'), 'hostile name is not shown as plain text')
  const toggles = page.locator('button[role=switch]')
  const n = await toggles.count()
  for (let i = 0; i < Math.min(n, 15); i += 1) { await toggles.nth(i).click().catch(() => {}); await toggles.nth(i).click().catch(() => {}) }
  await page.getByRole('button', { name: /add item/i }).click().catch(() => {})
  await page.keyboard.press('Escape')
  await page.getByText(/\+ Add Category/i).first().click().catch(() => {})
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1500)
  const after = (await api('/admin/menu-items', { admin: true })).body
  expect(p, after.length >= 40, 'dishes disappeared')
  await api('/admin/menu-items/xss-dish', { method: 'DELETE', admin: true })
  await ctx.close()
})

await scenario('huge numbers do not break the Overview layout', async (p) => {
  await api('/admin/menu-items', { method: 'POST', admin: true, body: { id: 'gold-dish', categoryId: (await api('/admin/categories', { admin: true })).body[0].id, name: 'Golden Platter With A Very Very Long Name That Keeps Going And Going', price: 100000, image: '/logo.png' } })
  for (let i = 0; i < 6; i += 1) await orderViaApi('1', [{ id: 'gold-dish', quantity: 99 }])
  const { ctx, page } = await staff({ viewport: { width: 1280, height: 800 } })
  watch(page, p)
  await adminLogin(page)
  await page.waitForTimeout(2500)
  expect(p, (await horizontalOverflow(page)) <= 0, 'overview scrolls sideways with big numbers')
  const clipped = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && /\d{1,3}(,\d{3}){2,}/.test(e.textContent) && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 20)))
  expect(p, clipped.length === 0, `big numbers are cut off: ${clipped.join(', ')}`)
  await page.goto(`${URL}/admin/orders`); await page.waitForTimeout(1500)
  expect(p, (await horizontalOverflow(page)) <= 0, 'orders page scrolls sideways with big numbers')
  await api('/admin/menu-items/gold-dish', { method: 'DELETE', admin: true })
  await ctx.close()
})

await scenario('new-order chime and notification bell work (and nothing breaks without audio)', async (p) => {
  const { ctx, page } = await staff()
  watch(page, p)
  await ctx.addInitScript(() => { window.__beeps = 0; const A = window.AudioContext; window.AudioContext = class extends A { createOscillator() { window.__beeps += 1; return super.createOscillator() } } })
  await adminLogin(page)
  await page.waitForTimeout(6000)
  const menu = (await api('/menu')).body.items.filter((i) => i.available)
  await orderViaApi('2', [{ id: menu[0].id, quantity: 1 }])
  await page.waitForTimeout(7500)
  const beeps = await page.evaluate(() => window.__beeps)
  expect(p, beeps >= 3, `no chime played for a new order (oscillators started: ${beeps})`)
  // the same page again with audio missing entirely
  const b = await staff()
  watch(b.page, p)
  await b.ctx.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext })
  await adminLogin(b.page)
  await b.page.waitForTimeout(5500)
  await orderViaApi('3', [{ id: menu[0].id, quantity: 1 }])
  await b.page.waitForTimeout(7000)
  expect(p, (await b.page.locator('main').innerText()).length > 50, 'dashboard broke when audio is unavailable')
  await ctx.close(); await b.ctx.close()
})

await scenario('server dies while the dashboard is open: clear error, no blank screen', async (p) => {
  const { ctx, page } = await staff()
  watch(page, p, { allow: ['Failed to', 'net::ERR'] })
  await adminLogin(page)
  for (const path of ['/admin', '/admin/orders', '/admin/menu', '/admin/tables', '/admin/chatbot']) {
    await page.goto(`${URL}${path}`); await page.waitForTimeout(1200)
    await ctx.route('**/api/admin/**', (r) => r.abort())
    await page.waitForTimeout(6500)
    const text = (await page.locator('main').innerText()).trim()
    expect(p, text.length > 20, `${path}: blank page after the server went away`)
    await ctx.unroute('**/api/admin/**')
    await page.waitForTimeout(6500)
    expect(p, (await page.locator('main').innerText()).trim().length > 40, `${path}: did not recover`)
  }
  await ctx.close()
})

await scenario('page switching 60 times in a row (memory, timers, unmounted updates)', async (p) => {
  const { ctx, page } = await staff()
  watch(page, p)
  await adminLogin(page)
  const paths = ['/admin', '/admin/orders', '/admin/menu', '/admin/tables', '/admin/chatbot']
  for (let i = 0; i < 60; i += 1) { await page.locator(`a[href="${paths[i % 5]}"]`).first().click().catch(() => {}); await page.waitForTimeout(90) }
  await page.waitForTimeout(1500)
  const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0)
  expect(p, heap < 300 * 1024 * 1024, `heap ${Math.round(heap / 1048576)} MB`)
  expect(p, (await page.locator('main').innerText()).length > 50, 'blank after rapid navigation')
  await ctx.close()
})


await scenario('Add Item with a picture chosen from the computer (the real form, submitted)', async (p) => {
  const { ctx, page } = await staff({ viewport: { width: 1440, height: 1000 } })
  watch(page, p, { allow: ['400'] })
  await adminLogin(page)
  await page.goto(`${URL}/admin/menu`); await page.waitForTimeout(2200)
  const before = (await api('/admin/menu-items', { admin: true })).body.length
  const open = async () => { await page.getByRole('button', { name: /add item/i }).click(); await page.locator('form input').first().waitFor() }

  // 1) no picture -> a clear message, nothing saved
  await open()
  await page.locator('form input').first().fill('Camel Burger')
  await page.locator('form input[type=number]').first().fill('450')
  await page.locator('form button[type=submit]').click()
  await page.getByRole('alert').waitFor({ timeout: 3000 }).catch(() => p.push('no message when the picture is missing'))
  expect(p, (await api('/admin/menu-items', { admin: true })).body.length === before, 'a dish was saved without a picture')

  // 2) things that are not pictures
  for (const [file, label] of [['/tmp/not-image.txt', 'text file'], ['/tmp/fake.png', 'fake png'], ['/tmp/huge.png', 'huge file']]) {
    await page.getByTestId('item-picture-input').setInputFiles(file)
    await page.waitForTimeout(700)
    const msg = (await page.getByRole('alert').count()) > 0
    expect(p, msg, `${label}: no error message shown`)
  }
  expect(p, (await api('/admin/menu-items', { admin: true })).body.length === before, 'a dish was saved with a bad file')

  // 3) a big phone-style photo: accepted, resized, saved
  await page.getByTestId('item-picture-input').setInputFiles('/tmp/test-dish.jpg')
  await page.waitForTimeout(1500)
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(2500)
  const items = (await api('/admin/menu-items', { admin: true })).body
  const made = items.find((i) => i.name === 'Camel Burger')
  expect(p, !!made, 'the dish was not created')
  expect(p, made && /^\/uploads\/\d+$/.test(made.image), `dish picture is not an upload: ${made?.image}`)
  if (made) {
    const res = await fetch(`${API}${made.image}`)
    const bytes = (await res.arrayBuffer()).byteLength
    expect(p, res.status === 200 && res.headers.get('content-type') === 'image/jpeg', 'stored picture cannot be read back')
    expect(p, bytes < 700 * 1024, `picture was not resized (${Math.round(bytes / 1024)} KB)`)
  }

  // 4) it shows on the dashboard card and on the customer's phone
  await page.waitForTimeout(800)
  const cardOk = await page.evaluate(() => [...document.images].some((i) => i.src.includes('/uploads/') && i.naturalWidth > 0))
  expect(p, cardOk, 'uploaded picture does not display on the dashboard card')
  const cust = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const phone = await cust.newPage()
  watch(phone, p)
  const { enterCustomer } = await import('./lib.mjs')
  await enterCustomer(phone, '/ToHomeOrder')
  const onPhone = await phone.waitForFunction(() => [...document.images].some((i) => i.src.includes('/uploads/') && i.naturalWidth > 0), null, { timeout: 15000 }).then(() => true).catch(() => false)
  expect(p, onPhone, 'uploaded picture does not display on the customer menu')
  await cust.close()

  // 5) edit: replace the picture, the old one is freed
  if (made) {
    await page.reload(); await page.waitForTimeout(2200)
    await page.locator('input[placeholder]').first().fill('Camel Burger')
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /edit camel burger/i }).click({ timeout: 4000 }).catch(() => p.push('no edit button'))
    await page.getByTestId('item-picture-input').setInputFiles('/tmp/test-dish2.png')
    await page.waitForTimeout(900)
    await page.locator('form button[type=submit]').click()
    await page.waitForTimeout(2200)
    const after = (await api('/admin/menu-items', { admin: true })).body.find((i) => i.id === made.id)
    expect(p, after && after.image !== made.image, 'the picture was not replaced')
    expect(p, (await fetch(`${API}${made.image}`)).status === 404, 'the replaced picture was not removed')
    await api(`/admin/menu-items/${made.id}`, { method: 'DELETE', admin: true })
  }
  await ctx.close()
})

await scenario('Arabic prices use دج (never د.م) on the menu and the dashboard', async (p) => {
  const { enterCustomer } = await import('./lib.mjs')
  const cust = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const phone = await cust.newPage()
  watch(phone, p)
  await enterCustomer(phone, '/ToHomeOrder', 'ar')
  const text = await phone.locator('body').innerText()
  expect(p, text.includes('دج'), 'customer menu (Arabic) does not show دج')
  expect(p, !text.includes('د.م'), 'customer menu (Arabic) still shows د.م')
  await cust.close()
  const { ctx, page } = await staff({ lang: 'ar' })
  watch(page, p)
  await adminLogin(page)
  for (const path of ['/admin', '/admin/orders', '/admin/menu']) {
    await page.goto(`${URL}${path}`); await page.waitForTimeout(1800)
    const t = await page.locator('main').innerText()
    expect(p, !t.includes('د.م'), `${path}: still shows د.م`)
  }
  await page.goto(`${URL}/admin/menu`); await page.waitForTimeout(1500)
  expect(p, (await page.locator('main').innerText()).includes('دج'), 'dashboard menu (Arabic) does not show دج')
  await ctx.close()
})

await browser.close()
process.exit(summary() ? 1 : 0)
