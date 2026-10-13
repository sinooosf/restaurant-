// ---------------------------------------------------------------------------
// Tables.
//
// Every QR link lands on a table id:
//   /table/1 ... /table/N   -> a real table
//   /ToHomeOrder            -> the special "order without a table" link
//                              (its id is always "home")
//
// loadTables() asks the backend which tables exist (during the intro). Two
// safety nets make a table added from the dashboard work on the first scan
// even if that list is stale or the request failed (for example the server
// was still waking up):
//   1. verifyTable() asks the server about ONE table directly, and retries
//      while the server is unreachable instead of giving up;
//   2. the built-in demo list below keeps /table/1-5 working offline.
// ---------------------------------------------------------------------------
import { matchPath } from 'react-router-dom'
import { fetchTable, fetchTables } from '../services/api'

export const HOME_TABLE_ID = 'home'
export const HOME_PATH = '/ToHomeOrder'

export let VALID_TABLE_IDS = ['1', '2', '3', '4', '5', HOME_TABLE_ID]

function remember(id) {
  if (!VALID_TABLE_IDS.includes(id)) VALID_TABLE_IDS = [...VALID_TABLE_IDS, id]
}

export async function loadTables() {
  try {
    const tables = await fetchTables()
    if (Array.isArray(tables) && tables.length) {
      VALID_TABLE_IDS = [...new Set([...tables.map((table) => String(table.id)), HOME_TABLE_ID])]
    }
  } catch (err) {
    console.warn('Could not load tables from the backend — using the built-in demo tables instead.', err)
  }
}

export function isKnownTable(id) {
  return VALID_TABLE_IDS.includes(String(id))
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Resolves to 'valid' | 'invalid' | 'offline'.
//   valid   — the server knows this table
//   invalid — the server answered and said it does not exist
//   offline — the server could not be reached after several tries
export async function verifyTable(id, { tries = 6, delayMs = 2000, isCancelled = () => false } = {}) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (isCancelled()) return 'offline'

    try {
      const table = await fetchTable(id)
      if (table?.id !== undefined) remember(String(table.id))
      return 'valid'
    } catch (err) {
      if (err?.status === 404) return 'invalid'
      // Network error / 5xx (a sleeping server): wait a little and try again.
      if (attempt < tries - 1) await wait(delayMs)
    }
  }
  return 'offline'
}

// The id of the table in a customer address, or null.
export function tableIdFromPath(pathname) {
  if (matchPath({ path: HOME_PATH, end: true }, pathname)) return HOME_TABLE_ID
  return matchPath('/table/:tableId', pathname)?.params.tableId ?? null
}

// What to call a table on screen.
export function tableLabel(tableId) {
  return String(tableId) === HOME_TABLE_ID ? 'To Home' : `Table ${tableId}`
}
