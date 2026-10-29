// ---------------------------------------------------------------------------
// The details a delivery order needs: a phone number and an address.
// The same rules as the server (backend/src/validate.js), so the customer is
// told what is wrong BEFORE anything is sent.
// ---------------------------------------------------------------------------

export const MAX_ADDRESS = 300

// 6–15 digits, optionally starting with "+", with spaces, dots, dashes or
// brackets between them: "0555 12 34 56", "+213 555 123 456".
export function isValidPhone(value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (text.length === 0 || text.length > 25) return false
  return /^\+?\d{6,15}$/.test(text.replace(/[\s.\-()]/g, ''))
}

export const isValidAddress = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_ADDRESS

// Which field is wrong: 'phone' | 'address' | null (both fine).
export function deliveryProblem({ phone, address }) {
  if (!isValidPhone(phone)) return 'phone'
  if (!isValidAddress(address)) return 'address'
  return null
}
