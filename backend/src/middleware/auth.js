import { timingSafeEqual, createHash } from 'node:crypto'

// Every admin-only route is protected by this one check: the request must
// carry the correct password in an `x-admin-password` header. There's no
// session or token to expire or go stale — the dashboard just keeps the
// password (entered once at login) and resends it with every request.
// Simple on purpose: one admin, one password, nothing to get out of sync.
//
// Guessing protection: after too many WRONG passwords from the same address,
// that address is blocked for a while (like a door that stays shut for 15
// minutes after too many wrong keys). A correct password clears the count.

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILS = Number(process.env.ADMIN_MAX_FAILS) || 10

// address -> { count, resetAt }
const failures = new Map()

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function blockedFor(key, now = Date.now()) {
  const entry = failures.get(key)
  if (!entry) return 0
  if (entry.resetAt <= now) {
    failures.delete(key)
    return 0
  }
  return entry.count >= MAX_FAILS ? entry.resetAt - now : 0
}

function recordFailure(key, now = Date.now()) {
  const entry = failures.get(key)
  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    entry.count += 1
  }

  // Keep the table small if someone sprays requests from many addresses.
  if (failures.size > 5000) {
    for (const [k, v] of failures) if (v.resetAt <= now) failures.delete(k)
  }
}

// Compares two passwords without leaking (through timing) how many leading
// characters were right. Hashing first makes both sides the same length.
function samePassword(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

// Returns null when the password is right, or the HTTP answer to send.
export function checkAdminPassword(req, provided) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    return { status: 500, error: 'Server is missing ADMIN_PASSWORD in its .env file.' }
  }

  const key = clientKey(req)
  const wait = blockedFor(key)
  if (wait > 0) {
    return {
      status: 429,
      error: 'Too many wrong passwords. Try again in a few minutes.',
      retryAfter: Math.ceil(wait / 1000),
    }
  }

  if (!samePassword(provided, expected)) {
    recordFailure(key)
    return { status: 401, error: 'Incorrect admin password.' }
  }

  failures.delete(key)
  return null
}

export function sendAuthError(res, problem) {
  if (problem.retryAfter) res.set('Retry-After', String(problem.retryAfter))
  return res.status(problem.status).json({ error: problem.error })
}

export function requireAdmin(req, res, next) {
  const problem = checkAdminPassword(req, req.header('x-admin-password'))
  if (problem) return sendAuthError(res, problem)
  next()
}
