import { tableLabel } from '../../data/tables'

export function money(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('en-US')} DH`
}

export function clockTime(date) {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// 14 -> "2 PM"
export function hourLabel(hour) {
  const h = ((hour + 11) % 12) + 1
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`
}

// "2x Pizza, 1x Coke" (first two dishes, then "+N more")
export function itemsSummary(order, max = 2) {
  const items = order?.items || []
  if (items.length === 0) return '—'

  const shown = items.slice(0, max).map((item) => `${item.quantity}x ${item.name}`)
  const extra = items.length - max

  return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ')
}

export function orderTableLabel(order) {
  return tableLabel(order?.tableId)
}

// +12% / -4% / null when there is nothing to compare with.
export function percentChange(current, previous) {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}

export const STATUS_META = {
  preparing: { label: 'Preparing', pill: 'bg-[#8a4b0f] text-[#ffd9a8]', dot: 'bg-orange-500' },
  almost: { label: 'Almost Ready', pill: 'bg-[#0b57c9] text-white', dot: 'bg-blue-500' },
  ready: { label: 'Ready', pill: 'bg-[#5b32e8] text-white', dot: 'bg-violet-500' },
  completed: { label: 'Completed', pill: 'bg-[#2a2b31] text-[#d6d6db]', dot: 'bg-zinc-400' },
  cancelled: { label: 'Cancelled', pill: 'bg-[#7d1117] text-[#ffc9cc]', dot: 'bg-red-600' },
}

// What the staff can do next with an order.
export const NEXT_STATUS = {
  preparing: { to: 'almost', label: 'Mark as almost ready' },
  almost: { to: 'ready', label: 'Mark as ready' },
  ready: { to: 'completed', label: 'Mark as completed' },
}
