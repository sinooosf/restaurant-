// Every admin-only route is protected by this one check: the request must
// carry the correct password in an `x-admin-password` header. There's no
// session or token to expire or go stale — the dashboard just keeps the
// password (entered once at login) and resends it with every request.
// Simple on purpose: one admin, one password, nothing to get out of sync.
export function requireAdmin(req, res, next) {
  const provided = req.header('x-admin-password')
  const expected = process.env.ADMIN_PASSWORD

  if (!expected) {
    return res.status(500).json({ error: 'Server is missing ADMIN_PASSWORD in its .env file.' })
  }

  if (provided !== expected) {
    return res.status(401).json({ error: 'Incorrect admin password.' })
  }

  next()
}
