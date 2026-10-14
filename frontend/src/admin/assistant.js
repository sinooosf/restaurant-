// ---------------------------------------------------------------------------
// ChefBot for the dashboard.
//
// This assistant is for the STAFF: it answers questions about the restaurant
// right now (orders, tables, sales, best sellers, the menu) using the same
// live data as the other dashboard pages. It is separate from the customer
// chatbot on the menu page.
//
// answer(text, password) -> { text, bullets?, footer?, actions? }
//   bullets: [{ tone, label }]     tone = a status / table state / 'neutral'
//   actions: [{ label, to }]       buttons that open a dashboard page
//
// To teach it a new question, add a rule to RULES at the bottom: a test on
// the (lowercase) text and a function that builds the answer.
// ---------------------------------------------------------------------------
import {
  adminFetchMenuItems,
  adminFetchCategories,
  adminFetchOrder,
  adminFetchOrders,
  adminFetchOverview,
  adminFetchTables,
} from '../services/api'
import { STATUS_META, clockTime, hourLabel, itemsSummary, money, orderTableLabel } from './components/format'

const has = (text, ...words) => words.some((w) => text.includes(w))
const plural = (n, word) => `${n} ${n === 1 ? word : word + (/(sh|ch|s|x)$/.test(word) ? 'es' : 's')}`
const pctChange = (now, before) => (before ? Math.round(((now - before) / before) * 100) : null)
const final = (item) => Math.round(item.price * (1 - (Number(item.discountPercent) || 0) / 100))
const OPEN = ['preparing', 'almost', 'ready']

// Every question that the quick buttons send.
export const QUICK_PROMPTS = {
  orders: 'How many orders do we have right now?',
  popular: "What's the most popular item today?",
  tables: 'What is the table status?',
  help: 'What can you help me with?',
}

// Data is fetched lazily, once per question.
function makeData(password) {
  const cache = {}
  const once = (key, fn) => (cache[key] ||= fn())
  return {
    today: () => once('today', () => adminFetchOverview(password, 'today')),
    yesterday: () => once('yesterday', () => adminFetchOverview(password, 'yesterday')),
    orders: () => once('orders', () => adminFetchOrders(password, 'today')),
    ordersYesterday: () => once('ordersY', () => adminFetchOrders(password, 'yesterday')),
    tables: () => once('tables', () => adminFetchTables(password)),
    menu: () => once('menu', () => adminFetchMenuItems(password)),
    categories: () => once('cats', () => adminFetchCategories(password)),
    order: (id) => adminFetchOrder(password, id),
  }
}

const openOrders = async (d) => (await d.orders()).orders.filter((o) => OPEN.includes(o.status))
const floorTables = async (d) => (await d.tables()).filter((t) => t.kind !== 'home')

/* ------------------------------ answers ------------------------------ */

async function activeOrders(d) {
  const { orders } = await d.orders()
  const today = await d.today()
  const counts = { preparing: 0, almost: 0, ready: 0 }
  orders.forEach((o) => counts[o.status] !== undefined && (counts[o.status] += 1))
  const active = counts.preparing + counts.almost + counts.ready

  if (!active) {
    return { text: `There are no active orders right now. Total orders today: ${today.current.orders}.`, actions: [{ label: 'Open Orders', to: '/admin/orders' }] }
  }
  return {
    text: `You currently have ${plural(active, 'active order')}:`,
    bullets: [
      { tone: 'preparing', label: `${counts.preparing} Preparing` },
      { tone: 'almost', label: `${counts.almost} Almost Ready` },
      { tone: 'ready', label: `${counts.ready} Ready` },
    ],
    footer: `Total orders today: ${today.current.orders}`,
    actions: [{ label: 'Open Orders', to: '/admin/orders' }],
  }
}

const countByStatus = (status, label) => async (d) => {
  const { counts } = await d.orders()
  const n = counts[status] || 0
  return { text: `${plural(n, 'order')} ${label} today.`, actions: [{ label: 'Open Orders', to: `/admin/orders` }] }
}

async function totalToday(d) {
  const t = await d.today()
  const y = await d.yesterday()
  const c = pctChange(t.current.orders, y.current.orders)
  return {
    text: `${plural(t.current.orders, 'order')} today (cancelled ones not counted)${c === null ? '.' : ` — ${c >= 0 ? 'up' : 'down'} ${Math.abs(c)}% compared with yesterday (${y.current.orders}).`}`,
  }
}

async function ordersYesterday(d) {
  const y = await d.yesterday()
  return { text: `Yesterday you had ${plural(y.current.orders, 'order')} and made ${money(y.current.revenue)}.` }
}

async function sales(d) {
  const t = await d.today()
  const y = await d.yesterday()
  const c = pctChange(t.current.revenue, y.current.revenue)
  return {
    text: `Today you made ${money(t.current.revenue)} from ${plural(t.current.orders, 'order')}.${c === null ? '' : ` That is ${c >= 0 ? 'up' : 'down'} ${Math.abs(c)}% compared with yesterday (${money(y.current.revenue)}).`}`,
  }
}

async function salesYesterday(d) {
  const y = await d.yesterday()
  return { text: `Yesterday's sales: ${money(y.current.revenue)} from ${plural(y.current.orders, 'order')} (average ${money(y.current.avg)}).` }
}

async function average(d) {
  const t = await d.today()
  const y = await d.yesterday()
  const c = pctChange(t.current.avg, y.current.avg)
  return { text: `The average order value today is ${money(t.current.avg)}${c === null ? '.' : ` (${c >= 0 ? '+' : ''}${c}% vs. yesterday).`}` }
}

async function popular(d) {
  const t = await d.today()
  if (!t.popular) return { text: 'No orders yet today, so there is no best seller yet.' }
  const share = t.current.orders ? Math.round((t.popular.orders / t.current.orders) * 100) : 0
  return {
    text: `The most popular item today is ${t.popular.name} — ${plural(t.popular.orders, 'order')} so far (${share}% of total orders).`,
    bullets: t.topItems.slice(1, 4).map((i, n) => ({ tone: 'neutral', label: `${n + 2}. ${i.name} — ${plural(i.orders, 'order')}` })),
    actions: [{ label: 'Open Menu', to: '/admin/menu' }],
  }
}

async function topItems(d) {
  const t = await d.today()
  if (!t.topItems.length) return { text: 'No orders yet today.' }
  return {
    text: 'Top dishes today:',
    bullets: t.topItems.map((i, n) => ({ tone: 'neutral', label: `${n + 1}. ${i.name} — ${plural(i.quantity, 'portion')} in ${plural(i.orders, 'order')}` })),
  }
}

async function bestSellerFlags(d) {
  const best = (await d.menu()).filter((i) => i.isBest)
  return best.length
    ? { text: `${plural(best.length, 'dish')} marked as Best Seller:`, bullets: best.slice(0, 10).map((i) => ({ tone: 'neutral', label: i.name })), actions: [{ label: 'Open Menu', to: '/admin/menu' }] }
    : { text: 'No dish is marked as Best Seller.' }
}

async function busiestHour(d) {
  const t = await d.today()
  const rows = t.hourly.current.filter((h) => h.orders > 0)
  if (!rows.length) return { text: 'No orders yet today, so there is no busy hour yet.' }
  const top = rows.reduce((a, b) => (b.orders > a.orders ? b : a))
  return { text: `Your busiest hour today is ${hourLabel(top.hour)} with ${plural(top.orders, 'order')} (${money(top.revenue)}).` }
}

async function lookupOrder(d, id) {
  try {
    const o = await d.order(id)
    return {
      text: `Order #${o.id} — ${orderTableLabel(o)}`,
      bullets: [
        { tone: o.status, label: STATUS_META[o.status].label },
        { tone: 'neutral', label: itemsSummary(o, 6) },
        { tone: 'neutral', label: `Total: ${money(o.total)} · ${clockTime(o.createdAt)}` },
      ],
      actions: [{ label: 'View in Orders', to: `/admin/orders?q=${o.id}` }],
    }
  } catch {
    return { text: `I couldn't find an order #${id}.` }
  }
}

async function latestOrder(d) {
  const { orders } = await d.orders()
  if (!orders.length) return { text: 'There are no orders yet today.' }
  return lookupOrder(d, orders[0].id)
}

async function biggestOrder(d) {
  const { orders } = await d.orders()
  const real = orders.filter((o) => o.status !== 'cancelled')
  if (!real.length) return { text: 'There are no orders yet today.' }
  const top = real.reduce((a, b) => (b.total > a.total ? b : a))
  return lookupOrder(d, top.id)
}

async function longestWaiting(d) {
  const open = (await openOrders(d)).filter((o) => o.status !== 'ready')
  if (!open.length) return { text: 'Nothing is waiting in the kitchen right now. 🎉' }
  const o = open[open.length - 1]
  const mins = Math.max(0, Math.round((Date.now() - new Date(o.createdAt)) / 60000))
  return { text: `The longest wait is order #${o.id} (${orderTableLabel(o)}) — about ${plural(mins, 'minute')}, still ${STATUS_META[o.status].label.toLowerCase()}.`, actions: [{ label: 'View in Orders', to: `/admin/orders?q=${o.id}` }] }
}

async function readyOrders(d) {
  const ready = (await d.orders()).orders.filter((o) => o.status === 'ready')
  if (!ready.length) return { text: 'No order is waiting to be served right now.' }
  return { text: `${plural(ready.length, 'order')} ready to be served:`, bullets: ready.map((o) => ({ tone: 'ready', label: `#${o.id} — ${orderTableLabel(o)}` })), actions: [{ label: 'Open Orders', to: '/admin/orders' }] }
}

async function homeOrders(d) {
  const home = (await d.orders()).orders.filter((o) => o.tableId === 'home')
  const open = home.filter((o) => OPEN.includes(o.status))
  return {
    text: `To Home: ${plural(open.length, 'order')} in progress, ${home.length} in total today.`,
    bullets: open.map((o) => ({ tone: o.status, label: `#${o.id} — ${itemsSummary(o)}` })),
    actions: [{ label: 'Open Orders', to: '/admin/orders?q=to%20home' }],
  }
}

async function tableOrders(d, n) {
  const { orders } = await d.orders()
  const mine = orders.filter((o) => String(o.tableId) === String(n))
  if (!mine.length) return { text: `Table ${n} has no orders today.` }
  const last = mine[0]
  return {
    text: `Table ${n} has had ${plural(mine.length, 'order')} today. The latest is #${last.id}:`,
    bullets: [
      { tone: last.status, label: STATUS_META[last.status].label },
      { tone: 'neutral', label: itemsSummary(last, 6) },
      { tone: 'neutral', label: `Total: ${money(last.total)}` },
    ],
  }
}

async function tablesSummary(d) {
  const tables = await floorTables(d)
  const by = (s) => tables.filter((t) => t.state === s)
  const occ = by('occupied')
  const bullets = [
    { tone: 'occupied', label: `${occ.length} Occupied` },
    { tone: 'available', label: `${by('available').length} Available` },
  ]
  if (by('cleaning').length) bullets.push({ tone: 'cleaning', label: `${by('cleaning').length} Cleaning` })
  if (by('out_of_service').length) bullets.push({ tone: 'neutral', label: `${by('out_of_service').length} Out of Service` })
  return {
    text: `You have ${tables.length} tables.${occ.length ? ` Occupied: ${occ.map((t) => t.label).join(', ')}.` : ''}`,
    bullets,
    actions: [{ label: 'Open Tables', to: '/admin/tables' }],
  }
}

const tablesInState = (state, label) => async (d) => {
  const list = (await floorTables(d)).filter((t) => t.state === state)
  if (!list.length) return { text: `No table is ${label} right now.` }
  return { text: `${plural(list.length, 'table')} ${label}: ${list.map((t) => t.label).join(', ')}.`, actions: [{ label: 'Open Tables', to: '/admin/tables' }] }
}

async function freeSeats(d) {
  const free = (await floorTables(d)).filter((t) => t.state === 'available')
  const seats = free.reduce((s, t) => s + t.seats, 0)
  return { text: `${plural(free.length, 'free table')} with ${plural(seats, 'place')} in total.` }
}

async function totalSeats(d) {
  const all = await floorTables(d)
  return { text: `The restaurant has ${plural(all.length, 'table')} with ${plural(all.reduce((s, t) => s + t.seats, 0), 'place')} in total.` }
}

async function biggestFreeTable(d) {
  const free = (await floorTables(d)).filter((t) => t.state === 'available')
  if (!free.length) return { text: 'No table is free right now.' }
  const t = free.reduce((a, b) => (b.seats > a.seats ? b : a))
  return { text: `The biggest free table is ${t.label} with ${plural(t.seats, 'place')}.` }
}

async function tableStatus(d, n) {
  const t = (await floorTables(d)).find((x) => String(x.id) === String(n))
  if (!t) return { text: `I can't find a table ${n}.` }
  const label = { available: 'available', occupied: 'occupied', cleaning: 'being cleaned', out_of_service: 'out of service' }[t.state]
  return { text: `${t.label} (${plural(t.seats, 'place')}) is ${label}${t.order ? ` since ${clockTime(t.order.createdAt)}` : ''}.` }
}

async function longestOccupied(d) {
  const occ = (await floorTables(d)).filter((t) => t.order)
  if (!occ.length) return { text: 'No table is occupied right now.' }
  const t = occ.reduce((a, b) => (new Date(b.order.createdAt) < new Date(a.order.createdAt) ? b : a))
  const mins = Math.round((Date.now() - new Date(t.order.createdAt)) / 60000)
  return { text: `${t.label} has been occupied the longest — about ${plural(mins, 'minute')} (since ${clockTime(t.order.createdAt)}).` }
}

async function hiddenItems(d) {
  const items = await d.menu()
  const hidden = items.filter((i) => !i.available)
  if (!hidden.length) return { text: `All ${items.length} menu items are available.` }
  return { text: `${plural(hidden.length, 'item')} currently hidden from customers:`, bullets: hidden.slice(0, 10).map((i) => ({ tone: 'neutral', label: i.name })), actions: [{ label: 'Open Menu', to: '/admin/menu' }] }
}

async function discounted(d) {
  const list = (await d.menu()).filter((i) => Number(i.discountPercent) > 0)
  if (!list.length) return { text: 'No dish has a discount right now.' }
  return { text: `${plural(list.length, 'dish')} on discount:`, bullets: list.slice(0, 10).map((i) => ({ tone: 'neutral', label: `${i.name} — -${i.discountPercent}% (${money(final(i))})` })) }
}

async function menuCount(d) {
  const items = await d.menu()
  const cats = await d.categories()
  return {
    text: `The menu has ${plural(items.length, 'item')} in ${plural(cats.length, 'category')} (${items.filter((i) => i.available).length} available).`,
    bullets: cats.map((c) => ({ tone: 'neutral', label: `${c.name}: ${items.filter((i) => i.categoryId === c.id).length}` })),
  }
}

async function priciest(d) {
  const items = await d.menu()
  const top = items.reduce((a, b) => (final(b) > final(a) ? b : a))
  return { text: `The most expensive dish is ${top.name} at ${money(final(top))}.` }
}

async function cheapest(d) {
  const items = await d.menu()
  const low = items.reduce((a, b) => (final(b) < final(a) ? b : a))
  return { text: `The cheapest dish is ${low.name} at ${money(final(low))}.` }
}

async function priceOf(d, text) {
  const items = await d.menu()
  const found = items.filter((i) => text.includes(i.name.toLowerCase()))
  if (!found.length) return null
  const i = found.sort((a, b) => b.name.length - a.name.length)[0]
  const disc = Number(i.discountPercent) > 0 ? ` (${i.discountPercent}% off, was ${money(i.price)})` : ''
  return { text: `${i.name} costs ${money(final(i))}${disc}. It is ${i.available ? 'available' : 'currently hidden from customers'}.` }
}

const help = () => ({
  text: 'I answer questions about your restaurant in real time. Try:',
  bullets: [
    { tone: 'preparing', label: 'Orders — “how many orders now?”, “order #12”, “what is ready?”, “longest wait”' },
    { tone: 'almost', label: 'Sales — “how much did we make?”, “yesterday’s sales”, “average order”, “busiest hour”' },
    { tone: 'ready', label: 'Dishes — “most popular item”, “top 5”, “hidden items”, “price of margherita”' },
    { tone: 'available', label: 'Tables — “free tables”, “is table 4 free?”, “how many seats?”' },
    { tone: 'neutral', label: 'To Home — “any to home orders?”' },
  ],
})

const say = (text) => () => ({ text })

/* ------------------------------ the rules ----------------------------- */
// The first rule whose `when` is true answers. Specific rules come first.
const RULES = [
  { when: (t) => /^(hi|hello|hey|salam|salut|bonjour|good (morning|evening|afternoon))\b/.test(t), run: say("Hello! 👋 I'm ChefBot. Ask me about orders, tables, sales or the menu.") },
  { when: (t) => has(t, 'thank', 'merci', 'shukran'), run: say("You're welcome! Anything else I can check for you?") },
  { when: (t) => /^(bye|goodbye|see you|ok bye)/.test(t), run: say('See you! Good service today. 👨‍🍳') },
  { when: (t) => has(t, 'who are you', 'your name', 'what are you'), run: say("I'm ChefBot, the dashboard assistant. I read your live orders, tables and menu to answer questions fast.") },
  { when: (t) => has(t, 'what time', 'time is it', 'current time'), run: () => ({ text: `It is ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} now.` }) },
  { when: (t) => has(t, "today's date", 'what day', 'what date', 'date today'), run: () => ({ text: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }) },

  { when: (t) => has(t, 'add') && has(t, 'menu', 'item', 'dish'), run: () => ({ text: 'Open the Menu page and press “Add Item”. I can take you there:', actions: [{ label: 'Add a menu item', to: '/admin/menu?new=1' }] }) },
  { when: (t) => has(t, 'add', 'new') && has(t, 'table'), run: () => ({ text: 'Open Tables and press “Add Table” — its ordering link works right away.', actions: [{ label: 'Open Tables', to: '/admin/tables' }] }) },
  { when: (t) => has(t, 'move', 'drag', 'rearrange', 'layout'), run: () => ({ text: 'On the Tables page, hold a table and drag it where you want. It stays there. Double-click or right-click a table to change its places or remove it.', actions: [{ label: 'Open Tables', to: '/admin/tables' }] }) },
  { when: (t) => has(t, 'qr', 'link', 'scan'), run: () => ({ text: 'Tables → “QR Links” lists every ordering link (and ToHomeOrder, for customers without a table). Copy one and turn it into a QR code.', actions: [{ label: 'Open Tables', to: '/admin/tables' }] }) },
  { when: (t) => has(t, 'cancel') && has(t, 'how', 'can i'), run: say('Open Orders, click the ⋮ menu on the order and choose “Cancel order”. Customers can only cancel while it is still “Preparing”.') },
  { when: (t) => has(t, 'change status', 'update status', 'mark as', 'mark order'), run: () => ({ text: 'In Orders, press “View” (or ⋮) on an order and choose the next step: Almost ready → Ready → Completed.', actions: [{ label: 'Open Orders', to: '/admin/orders' }] }) },
  { when: (t) => has(t, 'help', 'faq', 'what can you', 'what do you', 'commands', 'examples'), run: help },

  // Specific order / table lookups
  { when: (t) => /#\s*\d+|order\s*(number|no\.?)?\s*\d+/.test(t), run: (d, t) => lookupOrder(d, (t.match(/#\s*(\d+)/) || t.match(/order\s*(?:number|no\.?)?\s*(\d+)/))[1]) },
  { when: (t) => /table\s*#?\s*\d+/.test(t) && has(t, 'order', 'ordered', 'eat'), run: (d, t) => tableOrders(d, t.match(/table\s*#?\s*(\d+)/)[1]) },
  { when: (t) => /table\s*#?\s*\d+/.test(t), run: (d, t) => tableStatus(d, t.match(/table\s*#?\s*(\d+)/)[1]) },

  // Orders
  { when: (t) => has(t, 'to home', 'tohome', 'take away', 'takeaway', 'take-away', 'delivery'), run: homeOrders },
  { when: (t) => has(t, 'latest order', 'last order', 'newest order', 'most recent order', 'new order'), run: latestOrder },
  { when: (t) => has(t, 'biggest order', 'largest order', 'highest order', 'most expensive order'), run: biggestOrder },
  { when: (t) => has(t, 'longest wait', 'waiting the longest', 'oldest order', 'delayed', 'late order', 'how long'), run: longestWaiting },
  { when: (t) => has(t, 'ready') && has(t, 'order', 'serve', 'what', 'which', 'any'), run: readyOrders },
  { when: (t) => has(t, 'cancelled', 'canceled') && has(t, 'how many', 'order', 'any'), run: countByStatus('cancelled', 'were cancelled') },
  { when: (t) => has(t, 'completed', 'finished', 'served') && has(t, 'how many', 'order'), run: countByStatus('completed', 'were completed') },
  { when: (t) => has(t, 'preparing', 'cooking', 'in the kitchen', 'being prepared') && has(t, 'how many', 'order', 'what'), run: countByStatus('preparing', 'are being prepared') },
  { when: (t) => has(t, 'yesterday') && has(t, 'order'), run: ordersYesterday },
  { when: (t) => has(t, 'yesterday') && has(t, 'sales', 'revenue', 'made', 'money', 'earn'), run: salesYesterday },
  { when: (t) => has(t, 'total orders', 'orders today', 'how many orders today', 'orders did we'), run: totalToday },
  { when: (t) => has(t, 'busiest', 'peak', 'rush', 'busy hour', 'rush hour'), run: busiestHour },

  // Sales
  { when: (t) => has(t, 'average', 'avg'), run: average },
  { when: (t) => has(t, 'sales', 'revenue', 'money', 'earn', 'made', 'income', 'profit', 'turnover', 'how much did'), run: sales },

  // Dishes
  { when: (t) => has(t, 'top 5', 'top five', 'top dishes', 'top items', 'ranking'), run: topItems },
  { when: (t) => has(t, 'popular', 'best sell', 'bestsell', 'top sell', 'most ordered', 'top item', 'favorite', 'favourite', 'most sold'), run: popular },
  { when: (t) => has(t, 'marked as best', 'best seller flag', 'which are best'), run: bestSellerFlags },
  { when: (t) => has(t, 'unavailable', 'out of stock', 'hidden', 'not available', 'disabled'), run: hiddenItems },
  { when: (t) => has(t, 'discount', 'promo', 'on sale', 'offer'), run: discounted },
  { when: (t) => has(t, 'most expensive', 'priciest', 'highest price'), run: priciest },
  { when: (t) => has(t, 'cheapest', 'lowest price'), run: cheapest },
  { when: (t) => has(t, 'how many items', 'how many dishes', 'menu size', 'categories', 'how many categories'), run: menuCount },

  // Tables
  { when: (t) => has(t, 'longest') && has(t, 'table', 'occupied', 'seated'), run: longestOccupied },
  { when: (t) => has(t, 'biggest', 'largest') && has(t, 'table'), run: biggestFreeTable },
  { when: (t) => has(t, 'how many seats', 'how many places', 'capacity', 'total seats', 'total places'), run: totalSeats },
  { when: (t) => has(t, 'free seats', 'seats left', 'places left', 'room for', 'space'), run: freeSeats },
  { when: (t) => has(t, 'free', 'available', 'empty', 'vacant') && has(t, 'table'), run: tablesInState('available', 'free') },
  { when: (t) => has(t, 'occupied', 'taken', 'busy', 'full') && has(t, 'table'), run: tablesInState('occupied', 'occupied') },
  { when: (t) => has(t, 'cleaning', 'being cleaned', 'to clean'), run: tablesInState('cleaning', 'being cleaned') },
  { when: (t) => has(t, 'out of service', 'closed table', 'broken'), run: tablesInState('out_of_service', 'out of service') },
  { when: (t) => has(t, 'table', 'occupan', 'floor', 'seat'), run: tablesSummary },

  // Generic order questions last
  { when: (t) => has(t, 'order', 'pending', 'active', 'kitchen', 'current', 'right now', 'waiting'), run: activeOrders },
]

export async function answer(rawText, password) {
  const text = rawText.toLowerCase().trim()
  const data = makeData(password)

  // "How much is the margherita?" — price lookups need the menu first.
  if (has(text, 'price', 'how much is', 'how much does', 'cost')) {
    const found = await priceOf(data, text)
    if (found) return found
  }

  const rule = RULES.find((r) => r.when(text))
  if (rule) return rule.run(data, text)

  return {
    text: "I'm not sure about that one. Try asking about orders, tables, sales or dishes — or type “help” to see examples.",
  }
}
