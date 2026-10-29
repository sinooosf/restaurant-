import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { resetDatabase, startServer, firstMenuItems } from './helpers.js'

let srv
let api
let dishes

before(async () => {
  await resetDatabase()
  srv = await startServer()
  api = srv.api
  dishes = await firstMenuItems(api, 2)
})

after(async () => {
  await srv?.stop()
})

const items = () => [{ id: dishes[0].id, quantity: 1 }]
const order = (body) => api('/orders', { method: 'POST', body: { tableId: 'delivery', items: items(), ...body } })

describe('delivery link', () => {
  it('exists as a built-in link, listed after the tables and home', async () => {
    const tables = (await api('/tables')).body
    const ids = tables.map((t) => t.id)
    assert.ok(ids.includes('delivery'))
    assert.equal(tables.find((t) => t.id === 'delivery').kind, 'delivery')
    assert.ok(ids.indexOf('delivery') > ids.indexOf('home'))
    assert.equal((await api('/tables/delivery')).status, 200)
  })

  it('refuses an order without a phone number or address (400)', async () => {
    assert.equal((await order({})).status, 400)
    assert.equal((await order({ phone: '0555 12 34 56' })).status, 400)
    assert.equal((await order({ address: 'Rue 5, Blida' })).status, 400)
    assert.equal((await order({ phone: 'abc', address: 'Rue 5' })).status, 400)
    assert.equal((await order({ phone: '123', address: 'Rue 5' })).status, 400)
    assert.equal((await order({ phone: '0555123456', address: '   ' })).status, 400)
    assert.equal((await order({ phone: { a: 1 }, address: 'x' })).status, 400)
    assert.equal((await order({ phone: '0555123456', address: 'x'.repeat(301) })).status, 400)
  })

  it('accepts a valid delivery order and returns type, phone and address', async () => {
    const res = await order({ phone: '+213 555 123 456', address: 'Rue 5,\nBuilding B, 2nd floor' })
    assert.equal(res.status, 201)
    assert.equal(res.body.type, 'delivery')
    assert.equal(res.body.tableId, 'delivery')
    assert.equal(res.body.phone, '+213 555 123 456')
    assert.equal(res.body.address, 'Rue 5,\nBuilding B, 2nd floor')
    const again = (await api(`/orders/${res.body.id}`)).body
    assert.equal(again.phone, '+213 555 123 456')
  })

  it('shows the delivery details to the staff in the orders list', async () => {
    const list = (await api('/admin/orders', { admin: true })).body.orders
    const mine = list.find((o) => o.type === 'delivery')
    assert.ok(mine)
    assert.ok(mine.phone && mine.address)
  })

  it('never returns another customer\'s delivery order as "active"', async () => {
    assert.equal((await api('/orders/table/delivery/active')).body, null)
  })

  it('ignores phone/address on ordinary tables and the home link', async () => {
    const t = await api('/orders', { method: 'POST', body: { tableId: '1', items: items(), phone: '0555123456', address: 'x' } })
    assert.equal(t.status, 201)
    assert.equal(t.body.type, 'table')
    assert.equal(t.body.phone, '')
    const h = await api('/orders', { method: 'POST', body: { tableId: 'home', items: items() } })
    assert.equal(h.status, 201)
    assert.equal(h.body.type, 'home')
  })

  it('cannot be removed or re-created from the dashboard, and cannot be moved or merged', async () => {
    assert.equal((await api('/admin/tables/delivery', { method: 'DELETE', admin: true })).status, 400)
    assert.equal((await api('/admin/tables', { method: 'POST', admin: true, body: { id: 'Delivery' } })).status, 400)

    const d = (await order({ phone: '0555123456', address: 'Rue 9' })).body
    assert.equal((await api(`/admin/orders/${d.id}/move`, { method: 'PATCH', admin: true, body: { tableId: '2' } })).status, 409)
    const other = (await order({ phone: '0555123457', address: 'Rue 10' })).body
    const merged = await api('/admin/orders/merge', { method: 'POST', admin: true, body: { fromOrderId: d.id, intoOrderId: other.id } })
    assert.equal(merged.status, 409)
  })

  it('lets staff place a delivery order from the dashboard, with the same rules', async () => {
    const bad = await api('/admin/orders', { method: 'POST', admin: true, body: { tableId: 'delivery', items: items() } })
    assert.equal(bad.status, 400)
    const ok = await api('/admin/orders', { method: 'POST', admin: true, body: { tableId: 'delivery', items: items(), phone: '0555123456', address: 'Rue 1' } })
    assert.equal(ok.status, 201)
    assert.equal(ok.body.type, 'delivery')
  })
})

describe('categories: edit and order', () => {
  const cats = async () => (await api('/menu')).body.categories.map((c) => c.id)

  it('edits name, picture and description', async () => {
    const id = (await cats())[0]
    const res = await api(`/admin/categories/${id}`, { method: 'PUT', admin: true, body: { name: 'Renamed', image: '/images/x.png', description: 'New text' } })
    assert.equal(res.status, 200)
    assert.equal(res.body.name, 'Renamed')
    const menu = (await api('/menu')).body.categories.find((c) => c.id === id)
    assert.equal(menu.name, 'Renamed')
    assert.ok(menu.image.endsWith('/images/x.png'))
    assert.equal(menu.description, 'New text')
  })

  it('moves a category first, last, up and down — the customer menu follows', async () => {
    const before = await cats()
    const last = before[before.length - 1]
    assert.equal((await api(`/admin/categories/${last}`, { method: 'PUT', admin: true, body: { position: 'first' } })).status, 200)
    let now = await cats()
    assert.equal(now[0], last)
    assert.equal((await api(`/admin/categories/${last}`, { method: 'PUT', admin: true, body: { position: 'down' } })).status, 200)
    now = await cats()
    assert.equal(now[1], last)
    assert.equal((await api(`/admin/categories/${last}`, { method: 'PUT', admin: true, body: { position: 'up' } })).status, 200)
    assert.equal((await cats())[0], last)
    assert.equal((await api(`/admin/categories/${last}`, { method: 'PUT', admin: true, body: { position: 'last' } })).status, 200)
    now = await cats()
    assert.equal(now[now.length - 1], last)
    assert.deepEqual([...now].sort(), [...before].sort())
  })

  it('adds a new category at the top when asked', async () => {
    const res = await api('/admin/categories', { method: 'POST', admin: true, body: { name: 'Desserts', position: 'first' } })
    assert.equal(res.status, 201)
    assert.equal((await cats())[0], res.body.id)
  })

  it('refuses bad input (never 500) and unknown categories (404)', async () => {
    const id = (await cats())[0]
    for (const body of [{ name: '' }, { name: 'x'.repeat(81) }, { position: 'sideways' }, { image: 5 }, { description: 'x'.repeat(300) }]) {
      assert.equal((await api(`/admin/categories/${id}`, { method: 'PUT', admin: true, body })).status, 400)
    }
    assert.equal((await api('/admin/categories/nope', { method: 'PUT', admin: true, body: { name: 'x' } })).status, 404)
    assert.equal((await api(`/admin/categories/${id}`, { method: 'PUT', body: { name: 'x' } })).status, 401)
  })
})
