import { useCallback, useEffect, useState } from 'react'
import { adminPushKey, adminPushSubscribe, adminPushUnsubscribe } from '../services/api'

// Turns the dashboard's alerts on or off for THIS device. When on, the server
// pushes a notification (with the device's own sound) for every new order and
// waiter call, even if the dashboard is closed or the browser is on another site.
//
// status: 'unsupported' | 'denied' | 'off' | 'on' | 'working'

const supported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

function keyToBytes(base64) {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  return registration ? registration.pushManager.getSubscription() : null
}

export function usePushAlerts(password) {
  const [status, setStatus] = useState(supported() ? 'off' : 'unsupported')

  // On load: if alerts were already turned on here, make sure the server still
  // knows this device (it may have been reset) — quietly, no prompt.
  useEffect(() => {
    if (!supported() || !password) return undefined
    let cancelled = false
    ;(async () => {
      try {
        if (Notification.permission === 'denied') return setStatus('denied')
        const sub = await currentSubscription()
        if (cancelled) return
        if (sub && Notification.permission === 'granted') {
          await adminPushSubscribe(password, sub.toJSON())
          if (!cancelled) setStatus('on')
        }
      } catch {
        // stay "off": the person can try again with the button
      }
    })()
    return () => {
      cancelled = true
    }
  }, [password])

  const enable = useCallback(async () => {
    if (!supported()) return false
    setStatus('working')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        return false
      }
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const { publicKey } = await adminPushKey(password)
      const sub =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }))
      await adminPushSubscribe(password, sub.toJSON())
      setStatus('on')
      return true
    } catch {
      setStatus('off')
      return false
    }
  }, [password])

  const disable = useCallback(async () => {
    setStatus('working')
    try {
      const sub = await currentSubscription()
      if (sub) {
        await adminPushUnsubscribe(password, sub.endpoint).catch(() => {})
        await sub.unsubscribe()
      }
    } catch {
      // ignore
    }
    setStatus('off')
  }, [password])

  return { status, enable, disable }
}
