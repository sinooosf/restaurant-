// Same pattern as data/menu.js: start with the 5 built-in demo tables,
// then loadTables() swaps in whatever the backend actually has. If the
// backend is offline, the built-in list stays — so /table/1 through
// /table/5 always work even with no server running.
import { fetchTables } from '../services/api'

export let VALID_TABLE_IDS = ['1', '2', '3', '4', '5']

export async function loadTables() {
  try {
    const tables = await fetchTables()
    if (Array.isArray(tables) && tables.length) {
      VALID_TABLE_IDS = tables.map((table) => table.id)
    }
  } catch (err) {
    console.warn('Could not load tables from the backend — using the built-in demo tables instead.', err)
  }
}
