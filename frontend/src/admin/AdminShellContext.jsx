import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { adminFetchSummary, adminResolveWaiterCall } from '../services/api'
import { useAdminAuth } from './AdminAuthContext'

const ShellContext = createContext(null)

const SUMMARY_POLL_MS = 5000

// A short two-note chime made with the browser's own audio (no sound file).
// Browsers only allow sound after the user has clicked something once on the
// page — logging in counts.
let audioCtx = null
function playTones(tones) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    audioCtx = audioCtx || new AudioContext()
    if (audioCtx.state === 'suspended') audioCtx.resume()

    tones.forEach(([freq, delay]) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      const t = audioCtx.currentTime + delay
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(t)
      osc.stop(t + 0.55)
    })
  } catch {
    // no sound available — the badge, bell and banner still show the news
  }
}

// New order: three rising notes.
const playNewOrderSound = () => playTones([[880, 0], [1175, 0.18], [1568, 0.36]])
// A table calls the waiter: a different, doorbell-like "ding-dong ding-dong"
// so staff can tell it apart from a new order without looking.
const playWaiterSound = () => playTones([[1319, 0], [988, 0.28], [1319, 0.7], [988, 0.98]])

// Shared by the whole dashboard: the live "pending orders" count (the red
// badge next to Orders in the sidebar, and the notification bell) and the
// open/closed state of the sidebar on small screens.
export function AdminShellProvider({ children }) {
  const { password } = useAdminAuth()

  const [summary, setSummary] = useState({ pendingCount: 0, pending: [], waiterCalls: [] })
  const [navOpen, setNavOpen] = useState(false)
  const mounted = useRef(true)
  const seenIds = useRef(null) // order ids already known (null until the first load)
  const seenCalls = useRef(null) // waiter-call ids already known

  const refreshSummary = useCallback(async () => {
    try {
      const data = await adminFetchSummary(password)
      if (!mounted.current) return

      // A new order appeared since the last check -> play the chime.
      const ids = new Set(data.pending.map((o) => o.id))
      if (seenIds.current && [...ids].some((id) => !seenIds.current.has(id))) {
        playNewOrderSound()
      }
      seenIds.current = new Set([...(seenIds.current || []), ...ids])

      // A table pressed "Call waiter" -> ring.
      const calls = Array.isArray(data.waiterCalls) ? data.waiterCalls : []
      const callIds = new Set(calls.map((c) => c.id))
      if (seenCalls.current && [...callIds].some((id) => !seenCalls.current.has(id))) {
        playWaiterSound()
      }
      seenCalls.current = new Set([...(seenCalls.current || []), ...callIds])

      setSummary({ ...data, waiterCalls: calls })
    } catch {
      // A missed poll is fine — the next one will catch up.
    }
  }, [password])

  useEffect(() => {
    mounted.current = true
    refreshSummary()
    const timer = setInterval(refreshSummary, SUMMARY_POLL_MS)

    return () => {
      mounted.current = false
      clearInterval(timer)
    }
  }, [refreshSummary])

  // A staff member went to the table: the alert disappears right away.
  const resolveWaiterCall = useCallback(
    async (id) => {
      setSummary((prev) => ({ ...prev, waiterCalls: (prev.waiterCalls || []).filter((c) => c.id !== id) }))
      try {
        await adminResolveWaiterCall(password, id)
      } catch {
        // not saved: the next refresh brings the alert back, so nothing is lost
      }
      refreshSummary()
    },
    [password, refreshSummary]
  )

  const value = useMemo(
    () => ({ summary, refreshSummary, resolveWaiterCall, navOpen, setNavOpen }),
    [summary, refreshSummary, resolveWaiterCall, navOpen]
  )

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useAdminShell() {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useAdminShell must be used within AdminShellProvider')
  return ctx
}
