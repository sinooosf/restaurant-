import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { resetDatabase, startServer, firstMenuItems, ADMIN_PASSWORD } from './helpers.js'

let srv
let api
let dishes

before(async () => {
  await resetDatabase()
  srv = await startServer()
  api = srv.api
  dishes = await firstMenuItems(api, 3)
})

after(async () => {
  await srv?.stop()
})

const place = (tableId, lines) => api('/orders', { method: 'POST', body: { tableId, items: lines } })
const line = (i = 0, quantity = 1) => ({ id: dishes[i].id, quantity })

// No request may EVER answer 5xx: a 500 means the server did not expect the input.
function noServerError(res, label) {
  assert.ok(res.status < 500, `${label}: got ${res.status} ${res.text.slice(0, 200)}`)
}

describe('public endpoints', () => {
  it('health, menu and tables answer', async () => {
    assert.equal((await api('/health')).status, 200)
    const menu = await api('/menu')
    assert.ok(menu.body.categories.length > 0 && menu.body.items.length > 0)
    const tables = await api('/tables')
    assert.ok(tables.body.some((t) => t.id === 'home' && t.kind === 'home'))
    assert.ok(tables.body.some((t) => t.id === '1'))
    assert.equal((await api('/chatbot/faqs')).status, 200)
  })

  it('looks one table up, and 404s (never 500s) on strange ids', async () => {
    assert.equal((await api('/tables/1')).status, 200)
    assert.equal((await api('/tables/home')).body.kind, 'home')
    for (const id of ['999', 'abc', '%27%20OR%201=1--', '..%2F..%2Fetc', '%00', 'x'.repeat(5000), '%E2%9C%93', '1;DROP%20TABLE%20orders']) {
      const res = await api(`/tables/${id}`)
      noServerError(res, `GET /tables/${id.slice(0, 20)}`)
      assert.equal(res.status, 404)
    }
  })

  it('unknown routes answer 404, wrong methods do not crash', async () => {
    assert.equal((await api('/nope')).status, 404)
    noServerError(await api('/menu', { method: 'DELETE' }), 'DELETE /menu')
    noServerError(await api('/orders', { method: 'PUT', body: {} }), 'PUT /orders')
  })
})

describe('placing orders', () => {
  it('prices come from the server, discounts applied, client prices ignored', async () => {
    const res = await api('/orders', {
      method: 'POST',
      body: { tableId: '1', items: [{ id: dishes[0].id, quantity: 2, unitPrice: 1, price: 1, name: 'HACKED', total: 1 }], total: 1 },
    })
    assert.equal(res.status, 201)
    const unit = dishes[0].discountPercent ? Math.round(dishes[0].price * (1 - dishes[0].discountPercent / 100)) : dishes[0].price
    assert.equal(res.body.total, unit * 2)
    assert.notEqual(res.body.items[0].name, 'HACKED')
    assert.equal(res.body.status, 'preparing')
  })

  it('rejects every kind of malformed order with 400 (never 500)', async () => {
    const bad = [
      ['no body', undefined],
      ['empty object', {}],
      ['no table', { items: [line()] }],
      ['empty items', { tableId: '1', items: [] }],
      ['items not array', { tableId: '1', items: 'pizza' }],
      ['items object', { tableId: '1', items: { id: 'x' } }],
      ['null line', { tableId: '1', items: [null] }],
      ['line without id', { tableId: '1', items: [{ quantity: 1 }] }],
      ['qty 0', { tableId: '1', items: [line(0, 0)] }],
      ['qty negative', { tableId: '1', items: [line(0, -3)] }],
      ['qty fraction', { tableId: '1', items: [line(0, 1.5)] }],
      ['qty text', { tableId: '1', items: [line(0, 'abc')] }],
      ['qty null', { tableId: '1', items: [{ id: dishes[0].id, quantity: null }] }],
      ['qty huge', { tableId: '1', items: [line(0, 1e9)] }],
      ['qty beyond int', { tableId: '1', items: [line(0, 99999999999)] }],
      ['qty Infinity-ish', { tableId: '1', items: [{ id: dishes[0].id, quantity: 1e400 }] }],
      ['table is object', { tableId: { a: 1 }, items: [line()] }],
      ['table is array', { tableId: ['1'], items: [line()] }],
      ['table is boolean', { tableId: true, items: [line()] }],
      ['unknown table', { tableId: '9999', items: [line()] }],
      ['sql in table', { tableId: "1' OR '1'='1", items: [line()] }],
      ['item id object', { tableId: '1', items: [{ id: { x: 1 }, quantity: 1 }] }],
      ['item id array', { tableId: '1', items: [{ id: ['a'], quantity: 1 }] }],
      ['unknown item', { tableId: '1', items: [{ id: 'does-not-exist', quantity: 1 }] }],
      ['sql in item', { tableId: '1', items: [{ id: "x'; DROP TABLE orders;--", quantity: 1 }] }],
      ['200 lines', { tableId: '1', items: Array.from({ length: 200 }, () => line()) }],
    ]
    for (const [label, body] of bad) {
      const res = await api('/orders', { method: 'POST', body })
      assert.equal(res.status, 400, `${label}: expected 400, got ${res.status} ${res.text.slice(0, 160)}`)
    }
  })

  it('handles broken or oversized request bodies', async () => {
    const broken = await api('/orders', { method: 'POST', raw: '{"tableId": ', headers: { 'content-type': 'application/json' } })
    assert.equal(broken.status, 400)
    const wrongType = await api('/orders', { method: 'POST', raw: 'tableId=1', headers: { 'content-type': 'text/plain' } })
    noServerError(wrongType, 'text/plain body')
    const huge = await api('/orders', { method: 'POST', raw: JSON.stringify({ tableId: '1', items: [], pad: 'x'.repeat(3_000_000) }), headers: { 'content-type': 'application/json' } })
    assert.equal(huge.status, 413)
    assert.ok(srv.alive())
  })

  it('rejects unavailable dishes', async () => {
    const all = await api('/admin/menu-items', { admin: true })
    const hidden = all.body.find((i) => !i.available)
    if (!hidden) return
    const res = await place('1', [{ id: hidden.id, quantity: 1 }])
    assert.equal(res.status, 400)
  })

  it('identical lines are accepted and totalled correctly', async () => {
    const res = await place('2', [line(0, 1), line(0, 2)])
    assert.equal(res.status, 201)
    const unit = res.body.items[0].unitPrice
    assert.equal(res.body.total, unit * 3)
  })
})

describe('reading, adding to and cancelling orders', () => {
  it('weird order ids give 404, never 500', async () => {
    for (const id of ['abc', '-1', '1.5', '0', '99999999999999999999999', '%27', '1%20OR%201=1', 'x'.repeat(3000)]) {
      for (const [method, suffix] of [['GET', ''], ['PATCH', '/cancel'], ['POST', '/items']]) {
        const res = await api(`/orders/${id}${suffix}`, { method, body: method === 'GET' ? undefined : { items: [line()] } })
        noServerError(res, `${method} /orders/${id.slice(0, 12)}${suffix}`)
        assert.ok([400, 404].includes(res.status), `${method} ${id.slice(0, 12)}${suffix} -> ${res.status}`)
      }
    }
  })

  it('active order is found per table; unknown and home tables give null', async () => {
    const created = await place('3', [line()])
    const active = await api('/orders/table/3/active')
    assert.equal(active.body.id, created.body.id)
    assert.equal((await api('/orders/table/9999/active')).body, null)
    assert.equal((await api('/orders/table/home/active')).body, null)
    noServerError(await api(`/orders/table/${encodeURIComponent("1' OR 1=1--")}/active`), 'sql in table')
  })

  it('adds dishes to the same order and recomputes the total', async () => {
    const created = await place('4', [line(0, 1)])
    const more = await api(`/orders/${created.body.id}/items`, { method: 'POST', body: { items: [line(0, 2), line(1, 1)] } })
    assert.equal(more.status, 200)
    const expected = more.body.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    assert.equal(more.body.total, expected)
    assert.equal(more.body.items.find((i) => i.id === dishes[0].id).quantity, 3)
    for (const bad of [{}, { items: [] }, { items: 'x' }, { items: [{ id: 'nope', quantity: 1 }] }, { items: [line(0, 0)] }, { items: [line(0, 1e9)] }]) {
      const res = await api(`/orders/${created.body.id}/items`, { method: 'POST', body: bad })
      assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 60))
    }
  })

  it('locks the order once the kitchen has started', async () => {
    const created = await place('5', [line()])
    await api(`/admin/orders/${created.body.id}/status`, { method: 'PATCH', admin: true, body: { status: 'almost' } })
    assert.equal((await api(`/orders/${created.body.id}/items`, { method: 'POST', body: { items: [line()] } })).status, 409)
    assert.equal((await api(`/orders/${created.body.id}/cancel`, { method: 'PATCH' })).status, 409)
  })

  it('customer cancel works once, then 409; unknown order 404', async () => {
    const created = await place('6', [line()]).catch(() => null)
    const order = created?.status === 201 ? created : await place('home', [line()])
    const id = order.body.id
    assert.equal((await api(`/orders/${id}/cancel`, { method: 'PATCH' })).body.status, 'cancelled')
    assert.equal((await api(`/orders/${id}/cancel`, { method: 'PATCH' })).status, 409)
    assert.equal((await api('/orders/99999999/cancel', { method: 'PATCH' })).status, 404)
    assert.equal((await api(`/orders/${id}/items`, { method: 'POST', body: { items: [line()] } })).status, 409)
  })
})

describe('admin protection', () => {
  const routes = [
    ['GET', '/admin/orders'], ['GET', '/admin/summary'], ['GET', '/admin/overview'], ['GET', '/admin/tables'],
    ['GET', '/admin/menu-items'], ['GET', '/admin/categories'], ['GET', '/admin/chatbot-faqs'], ['GET', '/admin/orders/1'],
    ['POST', '/admin/tables'], ['PATCH', '/admin/tables/1'], ['DELETE', '/admin/tables/1'],
    ['POST', '/admin/menu-items'], ['PUT', '/admin/menu-items/x'], ['DELETE', '/admin/menu-items/x'],
    ['POST', '/admin/categories'], ['DELETE', '/admin/categories/x'], ['PATCH', '/admin/orders/1/status'],
    ['PATCH', '/admin/orders/1/move'], ['POST', '/admin/orders/merge'], ['POST', '/admin/chatbot-faqs'],
    ['GET', '/admin/earnings/today'],
  ]

  it('refuses every admin route without / with a wrong password', async () => {
    for (const [method, path] of routes) {
      const none = await api(path, { method, body: method === 'GET' ? undefined : {} })
      assert.equal(none.status, 401, `${method} ${path} without password -> ${none.status}`)
      const wrong = await api(path, { method, admin: true, password: 'nope', body: method === 'GET' ? undefined : {} })
      assert.equal(wrong.status, 401, `${method} ${path} wrong password -> ${wrong.status}`)
    }
    for (const pw of ['', ' ', ADMIN_PASSWORD.toUpperCase(), 'x'.repeat(10000)]) {
      const res = await api('/admin/orders', { admin: true, password: pw })
      assert.equal(res.status, 401, `password ${JSON.stringify(pw.slice(0, 10))}`)
    }
  })

  it('login succeeds with the right password', async () => {
    assert.equal((await api('/admin/orders', { admin: true })).status, 200)
  })
})

describe('admin: menu and categories', () => {
  it('validates new dishes', async () => {
    const base = { id: 'test-dish', categoryId: 'pizza', name: 'Test', price: 100, image: '/x.jpg' }
    const cats = await api('/admin/categories', { admin: true })
    const cat = cats.body[0].id
    const ok = await api('/admin/menu-items', { method: 'POST', admin: true, body: { ...base, categoryId: cat } })
    assert.equal(ok.status, 201, ok.text)
    assert.equal((await api('/admin/menu-items', { method: 'POST', admin: true, body: { ...base, categoryId: cat } })).status, 409)
    const bad = [
      { ...base, id: 'b1', categoryId: cat, price: -5 }, { ...base, id: 'b2', categoryId: cat, price: 'abc' },
      { ...base, id: 'b3', categoryId: cat, price: 1e12 }, { ...base, id: 'b4', categoryId: cat, price: 10.5 },
      { ...base, id: 'b5', categoryId: cat, discountPercent: 150 }, { ...base, id: 'b6', categoryId: cat, discountPercent: -1 },
      { ...base, id: 'b7', categoryId: 'no-such-category' }, { ...base, id: 'b8', categoryId: cat, name: '' },
      { ...base, id: 'b9', categoryId: cat, name: 'x'.repeat(5000) }, { ...base, id: { a: 1 }, categoryId: cat },
      { ...base, id: 'b10', categoryId: cat, available: 'yes' }, {},
    ]
    for (const body of bad) {
      const res = await api('/admin/menu-items', { method: 'POST', admin: true, body })
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body).slice(0, 80)}, got ${res.status} ${res.text.slice(0, 100)}`)
    }
  })

  it('validates edits and deletes', async () => {
    for (const body of [{ price: -1 }, { price: 'x' }, { discountPercent: 500 }, { categoryId: 'ghost' }, { name: '' }]) {
      const res = await api('/admin/menu-items/test-dish', { method: 'PUT', admin: true, body })
      assert.equal(res.status, 400, JSON.stringify(body))
    }
    assert.equal((await api('/admin/menu-items/test-dish', { method: 'PUT', admin: true, body: { price: 120, available: false } })).body.price, 120)
    assert.equal((await api('/admin/menu-items/ghost', { method: 'PUT', admin: true, body: { price: 1 } })).status, 404)
    assert.equal((await api('/admin/menu-items/test-dish', { method: 'DELETE', admin: true })).status, 200)
    assert.equal((await api('/admin/menu-items/test-dish', { method: 'DELETE', admin: true })).status, 404)
  })

  it('categories: create, duplicate, protect non-empty, delete', async () => {
    assert.equal((await api('/admin/categories', { method: 'POST', admin: true, body: { name: 'Desserts' } })).status, 201)
    assert.equal((await api('/admin/categories', { method: 'POST', admin: true, body: { name: 'Desserts' } })).status, 409)
    for (const body of [{}, { name: '' }, { name: '   ' }, { name: '!!!' }, { name: { a: 1 } }]) {
      assert.equal((await api('/admin/categories', { method: 'POST', admin: true, body })).status, 400, JSON.stringify(body))
    }
    assert.equal((await api('/admin/categories/pizza', { method: 'DELETE', admin: true })).status, 409)
    assert.equal((await api('/admin/categories/desserts', { method: 'DELETE', admin: true })).status, 200)
    assert.equal((await api('/admin/categories/desserts', { method: 'DELETE', admin: true })).status, 404)
  })
})

describe('admin: tables', () => {
  it('adds tables with validation; the link works immediately', async () => {
    const ok = await api('/admin/tables', { method: 'POST', admin: true, body: { id: '20', seats: 6 } })
    assert.equal(ok.status, 201)
    assert.equal((await api('/tables/20')).status, 200)
    assert.equal((await place('20', [line()])).status, 201)
    assert.equal((await api('/admin/tables', { method: 'POST', admin: true, body: { id: '20' } })).status, 409)
    for (const body of [{}, { id: '' }, { id: '  ' }, { id: 'a b' }, { id: '../x' }, { id: 'home' }, { id: 'HOME' }, { id: 'x'.repeat(200) }, { id: { a: 1 } }, { id: '1;--' }, { id: '<script>' }]) {
      const res = await api('/admin/tables', { method: 'POST', admin: true, body })
      assert.equal(res.status, 400, `${JSON.stringify(body).slice(0, 40)} -> ${res.status}`)
    }
    const big = await api('/admin/tables', { method: 'POST', admin: true, body: { id: '21', seats: 9999 } })
    assert.equal(big.body.seats, 20)
    const neg = await api('/admin/tables', { method: 'POST', admin: true, body: { id: '22', seats: -4 } })
    assert.ok(neg.body.seats >= 1)
  })

  it('patches seats, status and position with clamping', async () => {
    const t = await api('/admin/tables/21', { method: 'PATCH', admin: true, body: { seats: 3, status: 'cleaning', posX: 150, posY: -20 } })
    assert.equal(t.status, 200)
    assert.equal(t.body.seats, 3)
    assert.equal(t.body.posX, 100)
    assert.equal(t.body.posY, 0)
    for (const body of [{ status: 'banana' }, { status: 5 }]) {
      assert.equal((await api('/admin/tables/21', { method: 'PATCH', admin: true, body })).status, 400)
    }
    for (const body of [{ posX: 'abc' }, { posX: null, posY: {} }, { seats: 'many' }]) {
      noServerError(await api('/admin/tables/21', { method: 'PATCH', admin: true, body }), JSON.stringify(body))
    }
    assert.equal((await api('/admin/tables/ghost', { method: 'PATCH', admin: true, body: { seats: 2 } })).status, 404)
    assert.equal((await api('/admin/tables/home', { method: 'PATCH', admin: true, body: { seats: 2 } })).status, 404)
  })

  it('shows occupied tables and refuses to delete a busy one; home cannot be deleted', async () => {
    const list = await api('/admin/tables', { admin: true })
    const t20 = list.body.find((t) => t.id === '20')
    assert.equal(t20.state, 'occupied')
    assert.equal((await api('/admin/tables/20', { method: 'DELETE', admin: true })).status, 409)
    assert.equal((await api('/admin/tables/home', { method: 'DELETE', admin: true })).status, 400)
    assert.equal((await api('/admin/tables/21', { method: 'DELETE', admin: true })).status, 200)
    assert.equal((await api('/admin/tables/21', { method: 'DELETE', admin: true })).status, 404)
    assert.equal((await api('/tables/21')).status, 404)
  })
})

describe('admin: orders, move and merge', () => {
  const setStatus = (id, status) => api(`/admin/orders/${id}/status`, { method: 'PATCH', admin: true, body: { status } })

  it('walks an order through every status and validates input', async () => {
    const o = (await place('home', [line()])).body
    for (const s of ['almost', 'ready', 'completed']) assert.equal((await setStatus(o.id, s)).body.status, s)
    for (const bad of ['', 'banana', null, 5, undefined]) assert.equal((await setStatus(o.id, bad)).status, 400, String(bad))
    assert.equal((await setStatus(99999999, 'ready')).status, 404)
    assert.equal((await setStatus('abc', 'ready')).status, 404)
  })

  it('moves and merges orders, and refuses nonsense', async () => {
    await api('/admin/tables', { method: 'POST', admin: true, body: { id: '30' } })
    await api('/admin/tables', { method: 'POST', admin: true, body: { id: '31' } })
    await api('/admin/tables', { method: 'POST', admin: true, body: { id: '32' } })
    const a = (await place('30', [line(0, 1)])).body
    const b = (await place('31', [line(0, 2), line(1, 1)])).body

    const move = (id, tableId) => api(`/admin/orders/${id}/move`, { method: 'PATCH', admin: true, body: { tableId } })
    assert.equal((await move(a.id, '31')).status, 409) // busy
    assert.equal((await move(a.id, 'ghost')).status, 404)
    assert.equal((await move(a.id, 'home')).status, 404)
    assert.equal((await move(a.id, undefined)).status, 404)
    await api('/admin/tables/32', { method: 'PATCH', admin: true, body: { status: 'out_of_service' } })
    assert.equal((await move(a.id, '32')).status, 409)
    await api('/admin/tables/32', { method: 'PATCH', admin: true, body: { status: 'auto' } })
    assert.equal((await move(a.id, '32')).body.tableId, '32')

    const merge = (from, into) => api('/admin/orders/merge', { method: 'POST', admin: true, body: { fromOrderId: from, intoOrderId: into } })
    assert.equal((await merge(a.id, a.id)).status, 400)
    assert.equal((await merge('x', b.id)).status, 400)
    assert.equal((await merge(a.id, 99999999)).status, 404)
    const merged = await merge(a.id, b.id)
    assert.equal(merged.status, 200)
    assert.equal(merged.body.items.find((i) => i.id === dishes[0].id).quantity, 3)
    assert.equal(merged.body.total, merged.body.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0))
    assert.equal((await api(`/orders/${a.id}`)).status, 404) // the emptied order is gone

    await setStatus(b.id, 'completed')
    const c = (await place('30', [line()])).body
    assert.equal((await merge(c.id, b.id)).status, 409) // closed order
    assert.equal((await move(b.id, '30')).status, 409)
  })

  it('overview, summary, lists and earnings answer with sane numbers', async () => {
    for (const range of ['today', 'yesterday', 'banana', '', "'; DROP TABLE orders;--"]) {
      const res = await api(`/admin/overview?range=${encodeURIComponent(range)}`, { admin: true })
      assert.equal(res.status, 200, range)
      assert.equal(res.body.hourly.current.length, 24)
      assert.ok(res.body.current.orders >= 0)
    }
    const today = (await api('/admin/overview', { admin: true })).body
    const list = (await api('/admin/orders?range=today', { admin: true })).body
    assert.equal(today.current.orders, list.orders.filter((o) => o.status !== 'cancelled').length)
    assert.equal(today.current.revenue, list.orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0))
    for (const range of ['today', 'yesterday', 'all', 'zzz']) assert.equal((await api(`/admin/orders?range=${range}`, { admin: true })).status, 200)
    const summary = await api('/admin/summary', { admin: true })
    assert.equal(summary.body.pendingCount, list.counts.preparing + list.counts.almost)
    assert.equal((await api('/admin/earnings/today', { admin: true })).status, 200)
    assert.equal((await api('/admin/orders/abc', { admin: true })).status, 404)
    assert.equal((await api('/admin/orders/99999999', { admin: true })).status, 404)
  })

  it('faq CRUD validates input', async () => {
    const created = await api('/admin/chatbot-faqs', { method: 'POST', admin: true, body: { keyword: 'wifi', answer: 'Password: chef123' } })
    assert.equal(created.status, 201, created.text)
    for (const body of [{}, { keyword: '' }, { keyword: 'x' }, { answer: 'x' }, { keyword: { a: 1 }, answer: 'x' }]) {
      assert.ok([400].includes((await api('/admin/chatbot-faqs', { method: 'POST', admin: true, body })).status), JSON.stringify(body))
    }
    assert.equal((await api(`/admin/chatbot-faqs/${created.body.id}`, { method: 'DELETE', admin: true })).status, 200)
    assert.equal((await api(`/admin/chatbot-faqs/${created.body.id}`, { method: 'DELETE', admin: true })).status, 404)
    assert.equal((await api('/admin/chatbot-faqs/abc', { method: 'DELETE', admin: true })).status, 404)
  })

  it('stores hostile text safely (XSS / SQL) and returns it unchanged', async () => {
    const nasty = `<img src=x onerror=alert(1)> ' OR 1=1; -- "quotes" \u202e emoji 🍕`
    const cats = await api('/admin/categories', { admin: true })
    const res = await api('/admin/menu-items', { method: 'POST', admin: true, body: { id: 'nasty', categoryId: cats.body[0].id, name: nasty, price: 10, image: '/x.jpg' } })
    assert.equal(res.status, 201)
    assert.equal((await api('/menu')).body.items.find((i) => i.id === 'nasty').name, nasty)
    await api('/admin/menu-items/nasty', { method: 'DELETE', admin: true })
    assert.ok(srv.alive())
  })
})

describe('server health after all of the above', () => {
  it('is still running and answering', async () => {
    assert.ok(srv.alive())
    assert.equal((await api('/health')).status, 200)
  })
})
