// Web Push: a notification (with the phone's/computer's own sound) that
// appears even when the dashboard is closed or the browser is on another site.
import webpush from 'web-push'
import { pool } from './db.js'

let vapid = null

// The push keys come from the environment, or are created once and kept in the
// database, so alerts work without any setup (and keep working after restarts).
export async function getVapid() {
  if (vapid) return vapid
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
  } else {
    const found = await pool.query("SELECT key, value FROM app_settings WHERE key IN ('vapid_public', 'vapid_private')")
    const map = Object.fromEntries(found.rows.map((r) => [r.key, r.value]))
    if (map.vapid_public && map.vapid_private) {
      vapid = { publicKey: map.vapid_public, privateKey: map.vapid_private }
    } else {
      const fresh = webpush.generateVAPIDKeys()
      // Two servers starting together: the first insert wins, both read it back.
      await pool.query(
        "INSERT INTO app_settings (key, value) VALUES ('vapid_public', $1), ('vapid_private', $2) ON CONFLICT DO NOTHING",
        [fresh.publicKey, fresh.privateKey],
      )
      const again = await pool.query("SELECT key, value FROM app_settings WHERE key IN ('vapid_public', 'vapid_private')")
      const m = Object.fromEntries(again.rows.map((r) => [r.key, r.value]))
      vapid = { publicKey: m.vapid_public, privateKey: m.vapid_private }
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', vapid.publicKey, vapid.privateKey)
  return vapid
}

// The function that really sends (replaced in tests so nothing leaves the machine).
let sender = (subscription, body) => webpush.sendNotification(subscription, body, { TTL: 3600, urgency: 'high' })
export function _setSender(fn) {
  sender = fn
}

// Sends to every saved browser. Never throws and never makes the caller wait:
// a customer's order must not fail because a notification did.
export async function sendPush(payload) {
  try {
    await getVapid()
    const rows = (await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions')).rows
    const body = JSON.stringify(payload)
    await Promise.all(
      rows.map(async (row) => {
        try {
          await sender({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body)
        } catch (err) {
          // The browser unsubscribed or the address is gone: forget it.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [row.endpoint]).catch(() => {})
          }
        }
      }),
    )
  } catch (err) {
    console.warn('Push notification failed:', err?.message || err)
  }
}

const tableName = (id) =>
  String(id) === 'home' ? 'To Home' : String(id) === 'delivery' ? 'Delivery' : `Table ${id}`

export function notifyNewOrder(order) {
  const items = (order.items || []).slice(0, 3).map((i) => `${i.quantity}x ${i.name}`).join(', ')
  sendPush({
    title: `New order #${order.number} · ${tableName(order.tableId)}`,
    body: items || 'A new order is waiting.',
    tag: `order-${order.id}`,
    url: '/admin/orders',
  })
}

export function notifyWaiterCall(call) {
  sendPush({
    title: `${tableName(call.tableId)} is calling a waiter`,
    body: 'Tap to open the dashboard.',
    tag: `waiter-${call.id}`,
    url: '/admin',
  })
}
