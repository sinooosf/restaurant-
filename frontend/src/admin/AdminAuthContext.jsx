import { createContext, useCallback, useContext, useState } from 'react'
import { adminLogin } from '../services/api'

const AdminAuthContext = createContext(null)
const STORAGE_KEY = 'mtc-admin-password'

// Deliberately simple: the "session" is just the password itself, kept in
// localStorage and resent with every admin request (see services/api.js).
// There's no token to expire or fall out of sync — if the password is
// wrong or has been changed on the server, every request just fails with
// a normal "Incorrect password" error that each page already handles.
export function AdminAuthProvider({ children }) {
  const [password, setPassword] = useState(() => localStorage.getItem(STORAGE_KEY) || '')

  const login = useCallback(async (candidate) => {
    await adminLogin(candidate) // throws if wrong — let the caller catch it
    localStorage.setItem(STORAGE_KEY, candidate)
    setPassword(candidate)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setPassword('')
  }, [])

  return (
    <AdminAuthContext.Provider value={{ password, isAuthed: Boolean(password), login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  return ctx
}
