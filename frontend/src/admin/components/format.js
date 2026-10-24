import {
  formatMoney,
  formatTime,
  localeOf,
  tableLabelFor,
  translate,
} from '../../i18n/translate'
import { itemName } from '../../i18n/menuText'

// 450 -> "450 DH" / "450 دج"
export function money(value, lang = 'en') {
  return formatMoney(lang, value)
}

export function clockTime(date, lang = 'en') {
  return formatTime(lang, date)
}

// 14 -> "2 PM" / "14 h" / "2 م"
export function hourLabel(hour, lang = 'en') {
  if (lang === 'fr') return `${hour} h`
  const h = ((hour + 11) % 12) + 1
  return `${h} ${translate(lang, hour < 12 ? 'admin.ui.am' : 'admin.ui.pm')}`
}

// 14 -> "2:00 PM" / "14:00" / "2:00 م" (used in chart tooltips)
export function hourLabelLong(hour, lang = 'en') {
  if (lang === 'fr') return `${hour}:00`
  const h = ((hour + 11) % 12) + 1
  return `${h}:00 ${translate(lang, hour < 12 ? 'admin.ui.am' : 'admin.ui.pm')}`
}

// "2x Pizza, 1x Coke" (first two dishes, then "+N")
export function itemsSummary(order, max = 2, lang = 'en') {
  const items = order?.items || []
  if (items.length === 0) return '—'

  const shown = items.slice(0, max).map((item) => `${item.quantity}x ${itemName(item, lang)}`)
  const extra = items.length - max

  return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ')
}

export function orderTableLabel(order, lang = 'en') {
  return tableLabelFor(lang, order?.tableId)
}

// Date + weekday helpers for the active language (kept here so pages share them).
export function longDate(date, lang = 'en') {
  return new Date(date).toLocaleDateString(localeOf(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

// The number staff and customer both see ("#22"): today's running order
// number, which starts again at 1 after midnight. The database `id` is a
// different thing (unique forever) and is only used behind the scenes.
export function orderNumber(order) {
  return order?.number ?? order?.id
}

// Report days are plain "YYYY-MM-DD" texts. They are shown at noon UTC so the
// computer's own time zone can never move them to the neighbouring day.
const dayDate = (day) => new Date(`${day}T12:00:00Z`)

// "2026-10-17" -> "Oct 17" / "17 oct." / "17 أكتوبر"
export function dayLabel(day, lang = 'en') {
  return dayDate(day).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// "2026-10-17" -> "Sat, Oct 17, 2026" (tooltips)
export function dayLabelLong(day, lang = 'en') {
  return dayDate(day).toLocaleDateString(localeOf(lang), {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

// "Oct 17 – Oct 23" (just "Oct 17" for a single day)
export function dayRange(from, to, lang = 'en') {
  return from === to ? dayLabel(from, lang) : `${dayLabel(from, lang)} – ${dayLabel(to, lang)}`
}

// +12% / -4% / null when there is nothing to compare with.
export function percentChange(current, previous) {
  if (!previous) return null
  return Math.round(((current - previous) / previous) * 100)
}

export const STATUS_META = {
  preparing: { label: 'Preparing', labelKey: 'admin.status.preparing', pill: 'bg-[#8a4b0f] text-[#ffd9a8]', dot: 'bg-orange-500' },
  almost: { label: 'Almost Ready', labelKey: 'admin.status.almost', pill: 'bg-[#0b57c9] text-white', dot: 'bg-blue-500' },
  ready: { label: 'Ready', labelKey: 'admin.status.ready', pill: 'bg-[#5b32e8] text-white', dot: 'bg-violet-500' },
  completed: { label: 'Completed', labelKey: 'admin.status.completed', pill: 'bg-[#2a2b31] text-[#d6d6db]', dot: 'bg-zinc-400' },
  cancelled: { label: 'Cancelled', labelKey: 'admin.status.cancelled', pill: 'bg-[#7d1117] text-[#ffc9cc]', dot: 'bg-red-600' },
}

// What the staff can do next with an order.
export const NEXT_STATUS = {
  preparing: { to: 'almost', label: 'Mark as almost ready', labelKey: 'admin.next.almost' },
  almost: { to: 'ready', label: 'Mark as ready', labelKey: 'admin.next.ready' },
  ready: { to: 'completed', label: 'Mark as completed', labelKey: 'admin.next.completed' },
}
