import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { adminFetchSummary } from '../services/api'
import { useAdminAuth } from './AdminAuthContext'

const ShellContext = createContext(null)

const SUMMARY_POLL_MS = 5000

// Shared by the whole dashboard: the live "pending orders" count (the red
// badge next to Orders in the sidebar, and the notification bell) and the
// open/closed state of the sidebar on small screens.
export function AdminShellProvider({ children }) {
  const { password } = useAdminAuth()

  const [summary, setSummary] = useState({ pendingCount: 0, pending: [] })
  const [navOpen, setNavOpen] = useState(false)
  const mounted = useRef(true)

  const refreshSummary = useCallback(async () => {
    try {
      const data = await adminFetchSummary(password)
      if (mounted.current) setSummary(data)
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
