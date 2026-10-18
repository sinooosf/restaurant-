// Customer-side stress tests (the phone menu). Run:  node e2e/customer.mjs
import { URL, API, api, sleep, launch, watch, enterCustomer, horizontalOverflow, createRunner, expect } from './lib.mjs'

const { scenario, summary } = createRunner()
const browser = await launch()
const newPhone = (opts = {}) => browser.newContext({ viewport: { width: 390, height: 844 }, ...opts }).then(async (ctx) => ({ ctx, page: await ctx.newPage() }))

// "Add X" in English, "Ajouter X" in French, "أضف X" in Arabic
const addButtons = (page) => page.locator('button[aria-label^="Add "], button[aria-label^="Ajouter "], button[aria-label^="أضف "]')
const openChat = (page) => page.getByRole('button', { name: 'Open chat assistant' })
const findOrderOnTable = async (tableId) => {
  const r = await api(`/orders/table/${tableId}/active`)
  return r.body
}

await scenario('every language loads the menu; Arabic is right-to-left', async (p) => {
  for (const lang of ['en', 'fr', 'ar']) {
    const { ctx, page } = await newPhone()
    watch(page, p)
    await enterCustomer(page, '/table/1', lang)
    await addButtons(page).first().waitFor({ timeout: 15000 }).catch(() => p.push(`${lang}: no Add button`))
    const dir = await page.evaluate(() => document.documentElement.dir)
    expect(p, dir === (lang === 'ar' ? 'rtl' : 'ltr'), `${lang}: dir=${dir}`)
    expect(p, (await horizontalOverflow(page)) <= 0, `${lang}: horizontal overflow`)
    await ctx.close()
  }
})

await scenario('phones of every size: no sideways overflow, a whole card fits, order works', async (p) => {
  const sizes = [[320, 568], [360, 640], [375, 667], [390, 844], [430, 932], [768, 1024], [1280, 800]]
  for (const [w, h] of sizes) {
    const { ctx, page } = await newPhone({ viewport: { width: w, height: h } })
    watch(page, p)
    await enterCustomer(page, '/table/2')
    const over = await horizontalOverflow(page)
    expect(p, over <= 0, `${w}x${h}: page overflows sideways by ${over}px`)
    // is one full card visible above the cart bar?
    const fit = await page.evaluate(() => {
      const scroller = [...document.querySelectorAll('div')].find((e) => getComputedStyle(e).overflowY === 'auto' && e.scrollHeight > e.clientHeight)
      const card = document.querySelector('.menu-rise')
      const bar = [...document.querySelectorAll('div')].find((e) => e.className.includes('rounded-t-3xl') && e.className.includes('bottom-0'))
      if (!scroller || !card || !bar) return { missing: true }
      const c = card.getBoundingClientRect()
      return { cardBottom: c.bottom, barTop: bar.getBoundingClientRect().top, cardH: c.height }
    })
    if (!fit.missing) expect(p, fit.cardBottom <= fit.barTop + 1, `${w}x${h}: first card (${Math.round(fit.cardH)}px) is cut off by the cart bar`)
    await ctx.close()
  }
})

await scenario('chatbot: open/close 40 times quickly + hostile messages, no crash', async (p) => {
  const { ctx, page } = await newPhone()
  watch(page, p)
  await enterCustomer(page, '/table/1')
  for (let i = 0; i < 40; i += 1) {
    await openChat(page).click()
    await page.waitForTimeout(i % 3 === 0 ? 30 : 120)
    await page.getByRole('button', { name: 'Close chat' }).click({ timeout: 4000 }).catch(() => p.push(`close failed at ${i}`))
  }
  await openChat(page).click()
  const box = page.getByPlaceholder('Ask about the menu...')
  const nasty = ['', '   ', '<script>alert(1)</script>', 'x'.repeat(6000), '🍕🍕🍕🍕', 'مرحبا ما هي أفضل الأطباق', "'; DROP TABLE orders;--", '\u202e reversed', 'hello\n\nworld', 'pizza', 'what is the price of margherita']
  for (const text of nasty) {
    await box.fill(text)
    await box.press('Enter')
    await page.waitForTimeout(80)
  }
  await page.waitForTimeout(1500)
  expect(p, await page.locator('text=Close chat').count() + (await page.getByRole('button', { name: 'Close chat' }).count()) > 0, 'chat panel vanished')
  const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0)
  expect(p, heap < 250 * 1024 * 1024, `JS heap too large: ${Math.round(heap / 1048576)} MB`)
  await ctx.close()
})

await scenario('cart: 300 rapid taps are capped at 99 and the order still works', async (p) => {
  const { ctx, page } = await newPhone()
  watch(page, p, { allow: ['Failed to send order'] })
  await enterCustomer(page, '/table/3')
  const first = addButtons(page).first()
  await first.click()
  const plus = page.locator('button[aria-label^="Add another"]').first()
  for (let i = 0; i < 150; i += 1) await plus.click({ delay: 0, timeout: 2000 }).catch(() => {})
  const qty = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('mtc-cart-table-3')); return k ? Math.max(...Object.values(JSON.parse(localStorage.getItem(k)).quantities)) : 0 })
  expect(p, qty <= 99, `quantity went over the server limit: ${qty}`)
  await page.getByRole('button', { name: /place the order/i }).click()
  await page.getByRole('button', { name: /yes, place order/i }).click()
  await page.waitForTimeout(2500)
  const order = await findOrderOnTable('3')
  expect(p, order && order.items[0].quantity === qty, `order was not stored with the cart quantity (${order?.items?.[0]?.quantity} vs ${qty})`)
  await ctx.close()
})

await scenario('order lifecycle: tracking follows the kitchen, add more, reload keeps it, completed stays until the customer taps Done, then lives on in the order history', async (p) => {
  const { ctx, page } = await newPhone()
  watch(page, p)
  await enterCustomer(page, '/table/4')
  await addButtons(page).first().click()
  await page.getByRole('button', { name: /place the order/i }).click()
  await page.getByRole('button', { name: /yes, place order/i }).click()
  await page.getByText('Your food is on the way').waitFor({ timeout: 8000 }).catch(() => p.push('tracking sheet did not open'))
  const order = await findOrderOnTable('4')
  expect(p, !!order, 'order not stored for table 4')
  // the customer sees the same "#N" as the dashboard, top-left of the sheet
  await page.getByText(`#${order.number}`, { exact: true }).waitFor({ timeout: 4000 }).catch(() => p.push('the order number (#N) is not shown on the tracking sheet'))
  await api(`/admin/orders/${order.id}/status`, { method: 'PATCH', admin: true, body: { status: 'almost' } })
  await page.getByText('Almost done!').waitFor({ timeout: 9000 }).catch(() => p.push('did not show "Almost done!" after the kitchen moved the order'))
  await api(`/admin/orders/${order.id}/status`, { method: 'PATCH', admin: true, body: { status: 'ready' } })
  await page.getByText("It's ready!").waitFor({ timeout: 9000 }).catch(() => p.push('did not show "It\'s ready!"'))
  await page.reload()
  await page.locator('[role=radio]').first().waitFor({ timeout: 45000 })
  await page.locator('[role=radiogroup]').locator('xpath=following-sibling::button').click()
  await page.getByText("It's ready!").waitFor({ timeout: 12000 }).catch(() => p.push('a ready order was not restored after reload'))
  await api(`/admin/orders/${order.id}/status`, { method: 'PATCH', admin: true, body: { status: 'completed' } })
  await page.reload()
  await page.locator('[role=radio]').first().waitFor({ timeout: 45000 })
  await page.locator('[role=radiogroup]').locator('xpath=following-sibling::button').click()
  await page.waitForTimeout(3500)
  // Completed by the staff is NOT the end for the customer: the order stays on
  // the phone until the customer taps DONE.
  await page.getByText("It's ready!").waitFor({ timeout: 12000 }).catch(() => p.push('a COMPLETED order was not kept after reload'))
  await page.getByRole('button', { name: /^done$/i }).click({ timeout: 4000 }).catch(() => p.push('no DONE button on a completed order'))
  await page.reload()
  await page.locator('[role=radio]').first().waitFor({ timeout: 45000 })
  await page.locator('[role=radiogroup]').locator('xpath=following-sibling::button').click()
  await page.waitForTimeout(3500)
  expect(p, (await page.getByText("It's ready!").count()) === 0, 'an order the customer closed with DONE came back after reload')
  // ...but it is still in the order history (kept for 24 hours), with its number and final status
  await page.getByRole('button', { name: /order history/i }).click({ timeout: 4000 }).catch(() => p.push('no order history button in the header'))
  await page.getByText(`#${order.number}`, { exact: true }).waitFor({ timeout: 8000 }).catch(() => p.push('the finished order is missing from the order history'))
  expect(p, (await page.getByText('Ready', { exact: true }).count()) > 0, 'the order history does not show the order as Ready')
  await ctx.close()
})

await scenario('customer cancel + staff cancel both end cleanly', async (p) => {
  const { ctx, page } = await newPhone()
  watch(page, p)
  await enterCustomer(page, '/table/5')
  await addButtons(page).first().click()
  await page.getByRole('button', { name: /place the order/i }).click()
  await page.getByRole('button', { name: /yes, place order/i }).click()
  await page.getByText('Your food is on the way').waitFor({ timeout: 8000 })
  await page.getByRole('button', { name: /cancel order/i }).click({ timeout: 4000 }).catch(() => p.push('no cancel button'))
  await page.waitForTimeout(1500)
  expect(p, (await findOrderOnTable('5')) === null, 'order still active after cancel')
  // staff cancels a new one
  await addButtons(page).first().click()
  await page.getByRole('button', { name: /place the order/i }).click()
  await page.getByRole('button', { name: /yes, place order/i }).click()
  await page.getByText('Your food is on the way').waitFor({ timeout: 8000 })
  const o = await findOrderOnTable('5')
  await api(`/admin/orders/${o.id}/status`, { method: 'PATCH', admin: true, body: { status: 'cancelled' } })
  await page.getByText('Your order was cancelled').waitFor({ timeout: 9000 }).catch(() => p.push('staff cancellation not shown'))
  await ctx.close()
})

await scenario('To Home link: own order stays on this phone only', async (p) => {
  const a = await newPhone(); const b = await newPhone()
  watch(a.page, p); watch(b.page, p)
  await enterCustomer(a.page, '/ToHomeOrder')
  await addButtons(a.page).first().click()
  await a.page.getByRole('button', { name: /place the order/i }).click()
  await a.page.getByRole('button', { name: /yes, place order/i }).click()
  await a.page.getByText('Your food is on the way').waitFor({ timeout: 8000 })
  await enterCustomer(b.page, '/ToHomeOrder')
  await b.page.waitForTimeout(3000)
  expect(p, (await b.page.getByText('Your food is on the way').count()) === 0, 'second phone sees the first phone\'s To Home order')
  await a.ctx.close(); await b.ctx.close()
})

await scenario('server errors: failing / slow / offline API never crashes the menu', async (p) => {
  const allow = ['Failed to', 'Could not', 'net::ERR', 'status of 5', 'Failed to restore']
  // (a) API completely unreachable from the start
  let { ctx, page } = await newPhone()
  watch(page, p, { allow })
  await ctx.route('**/api/**', (r) => r.abort())
  await enterCustomer(page, '/table/1')
  expect(p, (await addButtons(page).count()) > 0, 'offline: built-in menu did not show')
  await addButtons(page).first().click()
  await page.getByRole('button', { name: /place the order/i }).click()
  await page.getByRole('button', { name: /yes, place order/i }).click()
  await page.waitForTimeout(1500)
  expect(p, (await page.locator('body').innerText()).length > 50, 'offline: page went blank after failed order')
  await ctx.close()
  // (b) 500 on everything
  ;({ ctx, page } = await newPhone())
  watch(page, p, { allow })
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }))
  await enterCustomer(page, '/table/2')
  await addButtons(page).first().click()
  await page.getByRole('button', { name: /place the order/i }).click()
  await page.getByRole('button', { name: /yes, place order/i }).click()
  await page.waitForTimeout(1500)
  expect(p, (await page.locator('body').innerText()).length > 50, '500s: page went blank')
  await ctx.close()
  // (c) garbage (HTML) instead of JSON
  ;({ ctx, page } = await newPhone())
  watch(page, p, { allow })
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html>proxy error</html>' }))
  await enterCustomer(page, '/table/1')
  expect(p, (await addButtons(page).count()) > 0, 'HTML instead of JSON: menu did not show')
  await ctx.close()
  // (d) very slow server (4 s per request)
  ;({ ctx, page } = await newPhone())
  watch(page, p, { allow })
  await ctx.route('**/api/**', async (r) => { await sleep(4000); r.continue() })
  await enterCustomer(page, '/table/1')
  expect(p, (await addButtons(page).count()) > 0, 'slow server: menu did not show')
  await ctx.close()
})

await scenario('connection lost while tracking, then restored', async (p) => {
  const { ctx, page } = await newPhone()
  watch(page, p, { allow: ['Failed to', 'net::ERR'] })
  await enterCustomer(page, '/table/1')
  await addButtons(page).first().click()
  await page.getByRole('button', { name: /place the order/i }).click()
  await page.getByRole('button', { name: /yes, place order/i }).click()
  await page.getByText('Your food is on the way').waitFor({ timeout: 8000 })
  await ctx.setOffline(true)
  await page.waitForTimeout(6000)
  await ctx.setOffline(false)
  const o = await findOrderOnTable('1')
  await api(`/admin/orders/${o.id}/status`, { method: 'PATCH', admin: true, body: { status: 'ready' } })
  await page.getByText("It's ready!").waitFor({ timeout: 12000 }).catch(() => p.push('tracking did not recover after the connection came back'))
  await ctx.close()
})

await scenario('corrupted browser storage cannot crash the app', async (p) => {
  const junk = ['{', 'null', '"text"', '[1,2,3]', '{"quantities":"abc","savedAt":"x"}', '{"quantities":{"pizza-1":1e300,"nope":5,"x":-4,"y":1.5},"savedAt":' + Date.now() + '}', 'x'.repeat(200000)]
  for (const value of junk) {
    const { ctx, page } = await newPhone()
    watch(page, p)
    await ctx.addInitScript(([v]) => { localStorage.setItem('mtc-cart-table-1', v); localStorage.setItem('mtc-order-1', v); localStorage.setItem('meetthechefs.admin.language', v) }, [value])
    await enterCustomer(page, '/table/1')
    expect(p, (await addButtons(page).count()) > 0, `storage "${value.slice(0, 30)}" broke the menu`)
    await ctx.close()
  }
})

await scenario('strange addresses show a proper screen', async (p) => {
  for (const path of ['/', '/table/99999', '/table/%00', '/table/%3Cscript%3Ealert(1)%3C/script%3E', '/table/' + 'a'.repeat(3000), '/nothing/here', '/ToHomeOrder/', '/tohomeorder', '/table/1/extra']) {
    const { ctx, page } = await newPhone()
    watch(page, p, { allow: ['Failed to', '404', '400'] })
    try {
      await enterCustomer(page, path)
      await page.waitForTimeout(1500)
      const text = (await page.locator('body').innerText()).trim()
      expect(p, text.length > 10, `${path.slice(0, 30)}: blank page`)
    } catch (e) { p.push(`${path.slice(0, 30)}: ${e.message.split('\n')[0]}`) }
    await ctx.close()
  }
})

await scenario('table removed / order merged while the customer is looking', async (p) => {
  await api('/admin/tables', { method: 'POST', admin: true, body: { id: '71' } })
  await api('/admin/tables', { method: 'POST', admin: true, body: { id: '72' } })
  const { ctx, page } = await newPhone()
  watch(page, p, { allow: ['Failed to', '404'] })
  await enterCustomer(page, '/table/71')
  await addButtons(page).first().click()
  await page.getByRole('button', { name: /place the order/i }).click()
  await page.getByRole('button', { name: /yes, place order/i }).click()
  await page.getByText('Your food is on the way').waitFor({ timeout: 8000 })
  const mine = await findOrderOnTable('71')
  const other = (await api('/orders', { method: 'POST', body: { tableId: '72', items: [{ id: mine.items[0].id, quantity: 1 }] } })).body
  await api('/admin/orders/merge', { method: 'POST', admin: true, body: { fromOrderId: mine.id, intoOrderId: other.id } })
  await page.waitForTimeout(6000)
  expect(p, (await page.getByText('Your food is on the way').count()) === 0, 'phone still tracks an order that no longer exists')
  expect(p, (await page.locator('body').innerText()).length > 50, 'page blank after the order disappeared')
  await ctx.close()
})

await scenario('12 phones ordering at the same moment', async (p) => {
  const before = (await api('/admin/orders?range=all', { admin: true })).body.orders.length
  const tables = ['1', '2', '3', '4', '5', 'home', 'home', 'home', 'home', 'home', 'home', 'home'] // a table is shared by everyone sitting at it, so only the To Home link gives separate orders
  await Promise.all(tables.map(async (t, i) => {
    const { ctx, page } = await newPhone()
    watch(page, p)
    try {
      await enterCustomer(page, t === 'home' ? '/ToHomeOrder' : `/table/${t}`, ['en', 'fr', 'ar'][i % 3])
      await addButtons(page).nth(i % 3).click()
      const place = page.locator('button').filter({ hasText: /PLACE THE ORDER|PASSER|تأكيد|إرسال|اطلب/i }).first()
      await place.click({ timeout: 20000 })
      await page.locator('[role=dialog] button, button').filter({ hasText: /YES, PLACE ORDER|OUI|نعم/i }).first().click({ timeout: 20000 })
      // wait (up to 25 s, the machine is busy with 12 browsers) for the server to confirm
      await page.waitForFunction((k) => localStorage.getItem(k), `mtc-order-${t}`, { timeout: 25000 }).catch(() => {})
      const saved = await page.evaluate((k) => localStorage.getItem(k), `mtc-order-${t}`)
      if (!saved) p.push(`phone ${i} (${t}, lang ${['en','fr','ar'][i % 3]}): the order was never confirmed by the server`)
    } catch (e) { p.push(`phone ${i}: ${e.message.split('\n')[0]}`) }
    await ctx.close()
  }))
  const after = (await api('/admin/orders?range=all', { admin: true })).body.orders.length
  if (after - before !== 12) {
    const all = (await api('/admin/orders?range=all', { admin: true })).body.orders
    p.push(`by table: ${JSON.stringify(all.reduce((m, o) => ((m[o.tableId] = (m[o.tableId] || 0) + 1), m), {}))}`)
  }
  expect(p, after - before === 12, `expected 12 new orders, found ${after - before}`)
})

await browser.close()
process.exit(summary() ? 1 : 0)
