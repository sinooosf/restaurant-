import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HOME_TABLE_ID, fetchTableAvailability, isKnownTable, tableIdFromPath, verifyTable } from '../data/tables'

// How often the phone asks whether staff closed (or reopened) the table.
const CLOSED_CHECK_MS = 5000
const OPEN_CHECK_MS = 15000

// Works for both kinds of customer link: /table/:tableId and /ToHomeOrder.
//
// status:
//   'valid'    the table exists — show the menu
//   'checking' not in the list we loaded at startup — asking the server
//   'invalid'  the server confirmed it does not exist
//   'offline'  the server could not be reached (not the same as "not found")
//
// closed: 'cleaning' | 'out_of_service' | null — staff closed this table on the
// dashboard. Checked on every scan and then again every few seconds, so the
// message appears (and goes away) without the customer reloading.
export function useTableId() {
  const { pathname } = useLocation()
  const tableId = tableIdFromPath(pathname)

  const [checked, setChecked] = useState({ id: null, status: null })
  const [attempt, setAttempt] = useState(0)

  const known = tableId !== null && isKnownTable(tableId)

  const [closed, setClosed] = useState({ id: null, reason: null })

  useEffect(() => {
    // The To Home link has no table that could be cleaned.
    if (tableId === null || tableId === HOME_TABLE_ID) return

    let cancelled = false
    let timer = null

    async function check() {
      const reason = await fetchTableAvailability(tableId)
      if (cancelled) return
      // undefined = could not reach the server: keep showing what we showed.
      if (reason !== undefined) setClosed((prev) => (prev.id === tableId && prev.reason === reason ? prev : { id: tableId, reason }))
      timer = setTimeout(check, reason ? CLOSED_CHECK_MS : OPEN_CHECK_MS)
    }
    check()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tableId])

  useEffect(() => {
    if (tableId === null || known) return

    let cancelled = false
    verifyTable(tableId, { isCancelled: () => cancelled }).then((status) => {
      if (!cancelled) setChecked({ id: tableId, status })
    })

    return () => {
      cancelled = true
    }
  }, [tableId, known, attempt])

  let status = 'checking'
  if (tableId === null) status = 'invalid'
  else if (known || (checked.id === tableId && checked.status === 'valid')) status = 'valid'
  else if (checked.id === tableId) status = checked.status

  return {
    tableId,
    status,
    isValid: status === 'valid',
    closed: closed.id === tableId ? closed.reason : null,
    retry: () => {
      setChecked({ id: null, status: null })
      setAttempt((n) => n + 1)
    },
  }
}
