import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { adminFetchSummary } from '../services/api'
import { useAdminAuth } from './AdminAuthContext'

const ShellContext = createContext(null)

const SUMMARY_POLL_MS = 5000

// A short two-note chime made with the browser's own audio (no sound file).
// Browsers only allow sound after the user has clicked something once on the
// page — logging in counts.
let audioCtx = null
function playNewOrderSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    audioCtx = audioCtx || new AudioContext()
    if (audioCtx.state === 'suspended') audioCtx.resume()

    ;[[880, 0], [1175, 0.18], [1568, 0.36]].forEach(([freq, delay]) => {
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
    // no sound available — the badge and bell still show the new order
  }
}

// Shared by the whole dashboard: the live "pending orders" count (the red
// badge next to Orders in the sidebar, and the notification bell) and the
// open/closed state of the sidebar on small screens.
export function AdminShellProvider({ children }) {
  const { password } = useAdminAuth()

  const [summary, setSummary] = useState({ pendingCount: 0, pending: [] })
  const [navOpen, setNavOpen] = useState(false)
  const mounted = useRef(true)
  const seenIds = useRef(null) // order ids already known (null until the first load)

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

      setSummary(data)
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

  const value = useMemo(
    () => ({ summary, refreshSummary, navOpen, setNavOpen }),
    [summary, refreshSummary, navOpen]
  )

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useAdminShell() {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useAdminShell must be used within AdminShellProvider')
  return ctx
}
