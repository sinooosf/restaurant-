import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { resetDatabase, startServer, firstMenuItems, killDbConnections } from './helpers.js'

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

const place = (tableId, items) => api('/orders', { method: 'POST', body: { tableId, items } })
const status = (id, s) => api(`/admin/orders/${id}/status`, { method: 'PATCH', admin: true, body: { status: s } })

describe('many customers at once', () => {
  it('300 simultaneous orders: all succeed, ids unique, totals exact', async () => {
    const tables = ['1', '2', '3', '4', '5', 'home']
    const jobs = Array.from({ length: 300 }, (_, i) =>
      place(tables[i % tables.length], [{ id: dishes[i % 3].id, quantity: (i % 4) + 1 }]),
    )
    const results = await Promise.all(jobs)
    const failed = results.filter((r) => r.status !== 201)
    assert.equal(failed.length, 0, `failures: ${failed.slice(0, 3).map((f) => f.status + f.text.slice(0, 80)).join(' | ')}`)
    assert.equal(new Set(results.map((r) => r.body.id)).size, 300)
    results.forEach((r, i) => {
      const unit = r.body.items[0].unitPrice
      assert.equal(r.body.total, unit * ((i % 4) + 1))
    })
    const list = (await api('/admin/orders?range=all', { admin: true })).body
    assert.equal(list.orders.length, 300)
    assert.equal(srv.alive(), true)
  })

  it('100 phones adding dishes to ONE order at the same time: no lost update', async () => {
    const order = (await place('1', [{ id: dishes[0].id, quantity: 1 }])).body
    const results = await Promise.all(
      Array.from({ length: 100 }, () => api(`/orders/${order.id}/items`, { method: 'POST', body: { items: [{ id: dishes[0].id, quantity: 1 }] } })),
    )
    assert.ok(results.every((r) => r.status === 200), results.filter((r) => r.status !== 200).map((r) => r.status).join(','))
    const final = (await api(`/orders/${order.id}`)).body
    assert.equal(final.items.find((i) => i.id === dishes[0].id).quantity, 101)
    assert.equal(final.total, final.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0))
  })

  it('kitchen status change racing with customer additions never corrupts the order', async () => {
    const order = (await place('2', [{ id: dishes[0].id, quantity: 1 }])).body
    const jobs = [
      ...Array.from({ length: 30 }, () => api(`/orders/${order.id}/items`, { method: 'POST', body: { items: [{ id: dishes[1].id, quantity: 1 }] } })),
      status(order.id, 'almost'),
      ...Array.from({ length: 30 }, () => api(`/orders/${order.id}/items`, { method: 'POST', body: { items: [{ id: dishes[1].id, quantity: 1 }] } })),
    ]
    const all = await Promise.all(jobs)
    const results = all.filter((_, i) => i !== 30) // index 30 is the kitchen's status change, not an addition
    assert.ok(all.every((r) => [200, 409].includes(r.status)), 'unexpected status')
    const final = (await api(`/orders/${order.id}`)).body
    assert.equal(final.status, 'almost')
    const added = final.items.find((i) => i.id === dishes[1].id)?.quantity || 0
    assert.equal(added, results.filter((r) => r.status === 200).length, 'accepted additions must equal what was stored')
    assert.equal(final.total, final.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0))
  })

  it('cancel racing with status change ends in one consistent state', async () => {
    const order = (await place('3', [{ id: dishes[0].id, quantity: 1 }])).body
    const [c1, c2, s1] = await Promise.all([
      api(`/orders/${order.id}/cancel`, { method: 'PATCH' }),
      api(`/orders/${order.id}/cancel`, { method: 'PATCH' }),
      status(order.id, 'ready'),
    ])
    assert.ok([c1, c2, s1].every((r) => r.status < 500))
    assert.ok(['cancelled', 'ready'].includes((await api(`/orders/${order.id}`)).body.status))
  })

  it('merging two orders into each other at once cannot deadlock or crash', async () => {
    for (const t of ['40', '41']) await api('/admin/tables', { method: 'POST', admin: true, body: { id: t } })
    const a = (await place('40', [{ id: dishes[0].id, quantity: 1 }])).body
    const b = (await place('41', [{ id: dishes[1].id, quantity: 2 }])).body
    const merge = (from, into) => api('/admin/orders/merge', { method: 'POST', admin: true, body: { fromOrderId: from, intoOrderId: into } })
    const results = await Promise.all([merge(a.id, b.id), merge(b.id, a.id), merge(a.id, b.id)])
    assert.ok(results.every((r) => r.status < 500), results.map((r) => r.status).join(','))
    assert.equal(results.filter((r) => r.status === 200).length, 1, 'exactly one merge may win')
  })

  it('two staff moving different orders to the same free table: only one wins', async () => {
    for (const t of ['50', '51', '52']) await api('/admin/tables', { method: 'POST', admin: true, body: { id: t } })
    const a = (await place('50', [{ id: dishes[0].id, quantity: 1 }])).body
    const b = (await place('51', [{ id: dishes[0].id, quantity: 1 }])).body
    const move = (id) => api(`/admin/orders/${id}/move`, { method: 'PATCH', admin: true, body: { tableId: '52' } })
    const results = await Promise.all([move(a.id), move(b.id)])
    assert.ok(results.every((r) => r.status < 500))
    const tables = (await api('/admin/tables', { admin: true })).body
    const t52 = tables.find((t) => t.id === '52')
    // Table 52 must hold at most one open order, not two.
    assert.ok(t52.openOrders <= 1, `table 52 holds ${t52.openOrders} open orders`)
  })
})

describe('load', () => {
  it('1500 mixed requests, 100 at a time: no 5xx, sane latency', async () => {
    const ordersList = (await api('/admin/orders?range=all', { admin: true })).body.orders
    const oneId = ordersList[0].id
    const kinds = [
      () => api('/menu'),
      () => api('/tables'),
      () => api(`/orders/${oneId}`),
      () => api('/orders/table/1/active'),
      () => api('/admin/overview', { admin: true }),
      () => api('/admin/orders', { admin: true }),
      () => api('/admin/summary', { admin: true }),
      () => api('/admin/tables', { admin: true }),
      () => place('4', [{ id: dishes[0].id, quantity: 1 }]),
    ]
    const times = []
    const bad = []
    const started = Date.now()
    for (let batch = 0; batch < 15; batch += 1) {
      await Promise.all(
        Array.from({ length: 100 }, async (_, i) => {
          const t0 = Date.now()
          const res = await kinds[(batch * 100 + i) % kinds.length]()
          times.push(Date.now() - t0)
          if (res.status >= 500) bad.push(res.status)
        }),
      )
    }
    times.sort((a, b) => a - b)
    const p95 = times[Math.floor(times.length * 0.95)]
    console.log(`      1500 requests in ${Date.now() - started} ms · median ${times[750]} ms · p95 ${p95} ms · max ${times.at(-1)} ms`)
    assert.equal(bad.length, 0, `5xx responses: ${bad.length}`)
    assert.ok(p95 < 5000, `p95 latency too high: ${p95} ms`)
  })

  it('the dashboard overview stays correct with thousands of orders', async () => {
    const o = (await api('/admin/overview', { admin: true })).body
    const list = (await api('/admin/orders?range=all', { admin: true })).body.orders
    assert.equal(o.current.orders, list.filter((x) => x.status !== 'cancelled').length)
    assert.ok(o.hourly.current.reduce((s, h) => s + h.orders, 0) === o.current.orders)
  })
})

describe('when the database misbehaves', () => {
  it('survives every database connection being killed, and recovers', async () => {
    assert.equal((await api('/menu')).status, 200)
    await killDbConnections()
    let ok = false
    for (let i = 0; i < 6 && !ok; i += 1) {
      const res = await api('/menu').catch(() => ({ status: 0 }))
      ok = res.status === 200
      if (!ok) await new Promise((r) => setTimeout(r, 300))
    }
    assert.ok(srv.alive(), `the server process died:\n${srv.logs().slice(-600)}`)
    assert.ok(ok, 'the server never recovered after its database connections were killed')
    assert.equal((await place('1', [{ id: dishes[0].id, quantity: 1 }])).status, 201)
  })

  it('survives connections being killed in the middle of a busy burst', async () => {
    const burst = Array.from({ length: 80 }, () => place('2', [{ id: dishes[0].id, quantity: 1 }]))
    setTimeout(() => killDbConnections().catch(() => {}), 30)
    const results = await Promise.all(burst.map((p) => p.catch(() => ({ status: 0 }))))
    assert.ok(srv.alive(), 'the server process died during the burst')
    assert.ok(results.every((r) => r.status === 201 || r.status >= 500 || r.status === 0), 'only clean success or clean failure allowed')
    await new Promise((r) => setTimeout(r, 500))
    let recovered = false
    for (let i = 0; i < 6 && !recovered; i += 1) {
      recovered = (await api('/health')).status === 200 && (await api('/menu')).status === 200
      if (!recovered) await new Promise((r) => setTimeout(r, 300))
    }
    assert.ok(recovered)
  })
})
