import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isKnownTable, tableIdFromPath, verifyTable } from '../data/tables'

// Works for both kinds of customer link: /table/:tableId and /ToHomeOrder.
//
// status:
//   'valid'    the table exists — show the menu
//   'checking' not in the list we loaded at startup — asking the server
//   'invalid'  the server confirmed it does not exist
//   'offline'  the server could not be reached (not the same as "not found")
export function useTableId() {
  const { pathname } = useLocation()
  const tableId = tableIdFromPath(pathname)

  const [checked, setChecked] = useState({ id: null, status: null })
  const [attempt, setAttempt] = useState(0)

  const known = tableId !== null && isKnownTable(tableId)

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
    retry: () => {
      setChecked({ id: null, status: null })
      setAttempt((n) => n + 1)
    },
  }
}
