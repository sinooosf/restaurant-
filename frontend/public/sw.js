// Service worker for the staff dashboard alerts. It does NOT cache anything;
// it only shows the notification the server pushes (new order / waiter call),
// even when the dashboard tab is closed or the browser is on another site.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  event.waitUntil(
    (async () => {
      // If the dashboard is open and in front, it already rings by itself.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows.some((c) => c.visibilityState === 'visible' && c.focused)) return

      await self.registration.showNotification(data.title || 'Meet The Chefs', {
        body: data.body || '',
        tag: data.tag,
        renotify: true,
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        data: { url: data.url || '/admin' },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/admin'

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((c) => new URL(c.url).pathname.startsWith('/admin'))
      if (open) {
        await open.focus()
        if ('navigate' in open) open.navigate(target).catch(() => {})
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})
