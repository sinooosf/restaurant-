// ---------------------------------------------------------------------------
// Which days does a report cover?
//
// Days are plain "YYYY-MM-DD" texts in the RESTAURANT's own time zone (see
// time.js) — never JavaScript Dates in the server's zone, which would shift a
// day near midnight. All the maths here is done on UTC dates, which have no
// daylight-saving surprises.
//
// A report always also covers the PREVIOUS period, so the dashboard can say
// "+12% compared with before":
//   - most ranges: the same number of days, right before this range;
//   - "this month": the same number of days from the start of last month;
//   - "last month": the month before it.
// ---------------------------------------------------------------------------

export const PRESETS = ['today', 'yesterday', 'week', 'last30', 'month', 'lastmonth', 'custom']
export const MAX_CUSTOM_DAYS = 366

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const MS = 86400000

function toUtc(day) {
  const m = DAY.exec(day)
  if (!m) return null
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  // Rejects 2026-02-31 and friends (they would silently roll over).
  return date.toISOString().slice(0, 10) === day ? date : null
}

export const isDay = (value) => typeof value === 'string' && toUtc(value) !== null

const fmt = (date) => date.toISOString().slice(0, 10)

export const addDays = (day, n) => fmt(new Date(toUtc(day).getTime() + n * MS))

// Number of days from `a` to `b`, both included (a = b -> 1).
export const spanDays = (a, b) => Math.round((toUtc(b) - toUtc(a)) / MS) + 1

function firstOfMonth(day, monthsBack = 0) {
  const d = toUtc(day)
  return fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1)))
}

function lastOfMonth(day, monthsBack = 0) {
  return addDays(firstOfMonth(day, monthsBack - 1), -1)
}

// -> { from, to, prevFrom, prevTo } or { error }
export function resolveRange({ range = 'week', from, to } = {}, today) {
  const sameLengthBefore = (f, t) => {
    const len = spanDays(f, t)
    return { prevFrom: addDays(f, -len), prevTo: addDays(f, -1) }
  }

  switch (range) {
    case 'today':
    case 'yesterday': {
      const day = range === 'today' ? today : addDays(today, -1)
      return { from: day, to: day, ...sameLengthBefore(day, day) }
    }
    case 'week': {
      const f = addDays(today, -6)
      return { from: f, to: today, ...sameLengthBefore(f, today) }
    }
    case 'last30': {
      const f = addDays(today, -29)
      return { from: f, to: today, ...sameLengthBefore(f, today) }
    }
    case 'month': {
      const f = firstOfMonth(today)
      const prevFrom = firstOfMonth(today, 1)
      const prevEnd = lastOfMonth(today, 1)
      const prevTo = addDays(prevFrom, spanDays(f, today) - 1)
      return { from: f, to: today, prevFrom, prevTo: prevTo > prevEnd ? prevEnd : prevTo }
    }
    case 'lastmonth':
      return {
        from: firstOfMonth(today, 1),
        to: lastOfMonth(today, 1),
        prevFrom: firstOfMonth(today, 2),
        prevTo: lastOfMonth(today, 2),
      }
    case 'custom': {
      if (!isDay(from) || !isDay(to)) return { error: 'Choose a start and an end date.' }
      const end = to > today ? today : to // nothing can have been sold in the future
      if (from > end) return { error: 'The start date must be before the end date.' }
      if (spanDays(from, end) > MAX_CUSTOM_DAYS) {
        return { error: `A report can cover at most ${MAX_CUSTOM_DAYS} days.` }
      }
      return { from, to: end, ...sameLengthBefore(from, end) }
    }
    default:
      return { error: `range must be one of: ${PRESETS.join(', ')}` }
  }
}

// Every day from `from` to `to`, as "YYYY-MM-DD" texts.
export function daysBetween(from, to) {
  const days = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}
