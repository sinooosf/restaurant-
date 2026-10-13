// The restaurant's own time zone. "Today" on the dashboard means today in
// THIS zone, not in the database server's zone (Render's servers run in UTC,
// which would reset the daily numbers an hour early/late for a restaurant in
// Algeria). Change it with RESTAURANT_TZ in .env — any IANA name works,
// e.g. "Europe/Paris", "Africa/Casablanca".
export const TZ = process.env.RESTAURANT_TZ || 'Africa/Algiers'

// SQL for the start of the day that is `offset` days from today, in TZ.
// `tzParam` is the placeholder holding TZ, e.g. "$1".
export function dayStartSql(tzParam, offset = 0) {
  const days = Number.isInteger(offset) ? offset : 0
  return `((date_trunc('day', now() AT TIME ZONE ${tzParam}) + interval '${days} day') AT TIME ZONE ${tzParam})`
}

// Sort tables numerically (1, 2, 10 — not 1, 10, 2) with the special
// "home" link always last.
export const TABLE_ORDER_SQL = `
  (t.kind = 'home') ASC,
  NULLIF(regexp_replace(t.id, '\\D', '', 'g'), '')::int ASC NULLS LAST,
  t.id ASC
`
