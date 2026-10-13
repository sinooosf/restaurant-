// ---------------------------------------------------------------------------
// ChefBot for the dashboard.
//
// This assistant is for the STAFF: it answers questions about the restaurant
// right now (orders, tables, best sellers, sales, the menu) using the same
// live data as the other dashboard pages. It is a separate thing from the
// customer chatbot on the menu page.
//
// answer(text, password) -> { text, bullets?, actions? }
//   bullets: [{ tone: 'orange' | 'blue' | 'violet' | ..., label }]
//   actions: [{ label, to }]   (buttons that open a dashboard page)
// ---------------------------------------------------------------------------
import {
  adminFetchMenuItems,
  adminFetchOrder,
  adminFetchOrders,
  adminFetchOverview,
  adminFetchTables,
} from '../services/api'
import { STATUS_META, itemsSummary, money, orderTableLabel } from './components/format'

const has = (text, ...words) => words.some((w) => text.includes(w))
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export const QUICK_PROMPTS = {
  orders: 'How many orders do we have right now?',
  popular: "What's the most popular item today?",
  tables: 'What is the table status?',
  help: 'What can you help me with?',
}

async function ordersAnswer(password) {
  const o = await adminFetchOverview(password, 'today')
  const { orders } = await adminFetchOrders(password, 'today')

  const counts = { preparing: 0, almost: 0, ready: 0 }
  orders.forEach((order) => {
    if (counts[order.status] !== undefined) counts[order.status] += 1
  })
  const active = counts.preparing + counts.almost + counts.ready

  if (active === 0) {
    return {
      text: `There are no active orders right now. Total orders today: ${o.current.orders}.`,
      actions: [{ label: 'Open Orders', to: '/admin/orders' }],
    }
  }

  return {
    text: `You currently have ${plural(active, 'active order')}:`,
    bullets: [
      { tone: 'preparing', label: `${counts.preparing} Preparing` },
      { tone: 'almost', label: `${counts.almost} Almost Ready` },
      { tone: 'ready', label: `${counts.ready} Ready` },
    ],
    footer: `Total orders today: ${o.current.orders}`,
    actions: [{ label: 'Open Orders', to: '/admin/orders' }],
  }
}

async function popularAnswer(password) {
  const o = await adminFetchOverview(password, 'today')
  if (!o.popular) return { text: 'No orders yet today, so there is no best seller yet.' }

  const share = o.current.orders ? Math.round((o.popular.orders / o.current.orders) * 100) : 0
  const others = o.topItems.slice(1, 4)

  return {
    text: `The most popular item today is ${o.popular.name} — ${plural(o.popular.orders, 'order')} so far (${share}% of total orders).`,
    bullets: others.map((item, i) => ({ tone: 'neutral', label: `${i + 2}. ${item.name} — ${plural(item.orders, 'order')}` })),
    actions: [{ label: 'Open Menu', to: '/admin/menu' }],
  }
}

async function tablesAnswer(password) {
  const all = await adminFetchTables(password)
  const tables = all.filter((t) => t.kind !== 'home')
  const by = (state) => tables.filter((t) => t.state === state)
  const occupied = by('occupied')

  const bullets = [
    { tone: 'occupied', label: `${occupied.length} Occupied` },
    { tone: 'available', label: `${by('available').length} Available` },
  ]
  if (by('cleaning').length) bullets.push({ tone: 'cleaning', label: `${by('cleaning').length} Cleaning` })
  if (by('out_of_service').length) bullets.push({ tone: 'neutral', label: `${by('out_of_service').length} Out of Service` })

  return {
    text: `You have ${tables.length} tables.${occupied.length ? ` Occupied: ${occupied.map((t) => t.label).join(', ')}.` : ''}`,
    bullets,
    actions: [{ label: 'Open Tables', to: '/admin/tables' }],
  }
}

async function salesAnswer(password) {
  const o = await adminFetchOverview(password, 'today')
  const change = o.previous.revenue
    ? Math.round(((o.current.revenue - o.previous.revenue) / o.previous.revenue) * 100)
    : null

  return {
    text: `Today you made ${money(o.current.revenue)} from ${plural(o.current.orders, 'order')} — an average of ${money(o.current.avg)} per order.${
      change === null ? '' : ` That is ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% compared with yesterday.`
    }`,
  }
}

async function orderLookup(password, id) {
  try {
    const order = await adminFetchOrder(password, id)
    return {
      text: `Order #${order.id} — ${orderTableLabel(order)}`,
      bullets: [
        { tone: order.status, label: STATUS_META[order.status].label },
        { tone: 'neutral', label: itemsSummary(order, 6) },
        { tone: 'neutral', label: `Total: ${money(order.total)}` },
      ],
      actions: [{ label: 'View in Orders', to: `/admin/orders?q=${order.id}` }],
    }
  } catch {
    return { text: `I couldn't find an order #${id}.` }
  }
}

async function homeAnswer(password) {
  const tables = await adminFetchTables(password)
  const home = tables.find((t) => t.kind === 'home')
  const n = home?.openOrders || 0
  return {
    text: n
      ? `${plural(n, 'To Home order')} in progress right now.`
      : 'There are no To Home orders in progress right now.',
    actions: [{ label: 'Open Orders', to: '/admin/orders?q=to%20home' }],
  }
}

async function hiddenAnswer(password) {
  const items = await adminFetchMenuItems(password)
  const hidden = items.filter((i) => !i.available)
  if (hidden.length === 0) return { text: `All ${items.length} menu items are available.` }
  return {
    text: `${plural(hidden.length, 'item')} currently hidden from customers:`,
    bullets: hidden.slice(0, 8).map((i) => ({ tone: 'neutral', label: i.name })),
    actions: [{ label: 'Open Menu', to: '/admin/menu' }],
  }
}

export async function answer(rawText, password) {
  const text = rawText.toLowerCase().trim()

  const idMatch = text.match(/(?:order\s*)?#\s*(\d+)|order\s+(?:number\s+)?(\d+)/)
  if (idMatch) return orderLookup(password, idMatch[1] || idMatch[2])

  if (/^(hi|hello|hey|salam|salut|bonjour)\b/.test(text)) {
    return { text: "Hello! 👋 I'm ChefBot. Ask me about orders, tables, sales or the menu." }
  }

  if (has(text, 'add') && has(text, 'menu', 'item', 'dish')) {
    return {
      text: 'Sure — open the Menu page and press “Add Item”. I can take you there:',
      actions: [{ label: 'Add a menu item', to: '/admin/menu?new=1' }],
    }
  }

  if (has(text, 'add') && has(text, 'table')) {
    return {
      text: 'Open the Tables page and press “Add Table”. Its ordering link works right away.',
      actions: [{ label: 'Open Tables', to: '/admin/tables' }],
    }
  }

  if (has(text, 'help', 'faq', 'what can you', 'how do')) {
    return {
      text: 'I can answer questions about your restaurant in real time:',
      bullets: [
        { tone: 'preparing', label: 'Orders — “How many orders right now?”, “Check order #12”' },
        { tone: 'available', label: 'Tables — “Which tables are free?”' },
        { tone: 'ready', label: 'Best sellers — “What is the most popular item?”' },
        { tone: 'almost', label: 'Sales — “How much did we make today?”' },
        { tone: 'neutral', label: 'Menu — “Which items are hidden?”' },
      ],
    }
  }

  if (has(text, 'popular', 'best sell', 'bestsell', 'top sell', 'most ordered', 'top item')) return popularAnswer(password)
  if (has(text, 'unavailable', 'out of stock', 'hidden', 'not available')) return hiddenAnswer(password)
  if (has(text, 'to home', 'tohome', 'take away', 'takeaway', 'take-away')) return homeAnswer(password)
  if (has(text, 'table', 'occupan', 'seat', 'free')) return tablesAnswer(password)
  if (has(text, 'sales', 'revenue', 'money', 'earn', 'made', 'income', 'average', 'avg')) return salesAnswer(password)
  if (has(text, 'order', 'pending', 'active', 'kitchen', 'current')) return ordersAnswer(password)

  return {
    text: "I'm not sure about that one. Try asking about orders, tables, best sellers or today's sales.",
    actions: [],
  }
}
