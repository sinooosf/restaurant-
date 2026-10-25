import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { resetDatabase, TEST_DB } from './helpers.js'

// push.js runs in this process so the sender can be replaced by a fake one.
process.env.DATABASE_URL = TEST_DB
const { pool } = await import('../src/db.js')
const push = await import('../src/push.js')

const sent = []
before(async () => {
  await resetDatabase()
  push._setSender(async (subscription, body) => {
    if (subscription.endpoint.includes('gone')) throw Object.assign(new Error('gone'), { statusCode: 410 })
    sent.push({ subscription, body: JSON.parse(body) })
  })
  await pool.query("INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ('https://p.invalid/ok','k','a'), ('https://p.invalid/gone','k','a')")
})
after(async () => {
  await pool.end()
})

describe('push notifications', () => {
  it('creates the keys once and keeps them', async () => {
    const a = await push.getVapid()
    assert.ok(a.publicKey && a.privateKey)
    const stored = (await pool.query("SELECT value FROM app_settings WHERE key = 'vapid_public'")).rows[0].value
    assert.equal(stored, a.publicKey)
  })

  it('a new order reaches every browser, with the table and the dishes', async () => {
    await push.sendPush({ title: 'x' }) // warm up
    sent.length = 0
    push.notifyNewOrder({ id: 9, number: 12, tableId: '3', items: [{ quantity: 2, name: 'Pizza' }, { quantity: 1, name: 'Soup' }] })
    await new Promise((r) => setTimeout(r, 300))
    assert.equal(sent.length, 1)
    assert.equal(sent[0].body.title, 'New order #12 · Table 3')
    assert.equal(sent[0].body.body, '2x Pizza, 1x Soup')
  })

  it('a browser that unsubscribed (410) is forgotten', async () => {
    const left = (await pool.query('SELECT endpoint FROM push_subscriptions')).rows.map((r) => r.endpoint)
    assert.deepEqual(left, ['https://p.invalid/ok'])
  })

  it('a waiter call and To Home wording', async () => {
    sent.length = 0
    push.notifyWaiterCall({ id: 1, tableId: '5' })
    push.notifyNewOrder({ id: 2, number: 1, tableId: 'home', items: [] })
    await new Promise((r) => setTimeout(r, 300))
    const titles = sent.map((s) => s.body.title).sort()
    assert.deepEqual(titles, ['New order #1 · To Home', 'Table 5 is calling a waiter'])
  })
})
