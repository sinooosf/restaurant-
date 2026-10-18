// ---------------------------------------------------------------------------
// ChefBot for the dashboard.
//
// This assistant is for the STAFF: it answers questions about the restaurant
// right now (orders, tables, sales, best sellers, the menu) using the same
// live data as the other dashboard pages. It is separate from the customer
// chatbot on the menu page.
//
// answer(text, password, lang) -> { text, bullets?, footer?, actions? }
//   lang = 'en' | 'fr' | 'ar'. Questions are understood in ANY of the three
//   languages; the answer comes back in the active one (see locales/admin-assistant.js).
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
import { STATUS_META, clockTime, hourLabel, itemsSummary, money, orderNumber, orderTableLabel } from './components/format'
import { localeOf, tableLabelFor, translate } from '../i18n/translate'
import { itemName, categoryName } from '../i18n/menuText'

// Lowercase, drop accents and Arabic marks, unify Arabic letter variants, so
// "Annulées" / "أفضل" / "افضل" all compare the same way.
const normalize = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[’]/g, "'")

const has = (text, ...words) => words.some((w) => text.includes(normalize(w)))
const pctChange = (now, before) => (before ? Math.round(((now - before) / before) * 100) : null)
const final = (item) => Math.round(item.price * (1 - (Number(item.discountPercent) || 0) / 100))
const OPEN = ['preparing', 'almost', 'ready']

const PROMPT_IDS = ['orders', 'popular', 'tables', 'help', 'sales', 'longest', 'home', 'hidden']

// Every question that the quick buttons send, in the chosen language.
export const quickPrompts = (lang = 'en') =>
  Object.fromEntries(PROMPT_IDS.map((id) => [id, translate(lang, `admin.assistant.q.${id}`)]))

// English version, kept for older imports.
export const QUICK_PROMPTS = quickPrompts('en')

// Data is fetched lazily, once per question. `d.lang` / `d.tr` give every
// answer function the language and a translator.
function makeData(password, lang) {
  const cache = {}
  const once = (key, fn) => (cache[key] ||= fn())
  const tr = (key, params) => translate(lang, `admin.assistant.${key}`, params)
  return {
    lang,
    tr,
    // "3 orders" / "3 طلبات" — a number with its unit, in the right plural form.
    cnt: (unit, n) => tr(`u.${unit}`, { count: n }),
    money: (v) => money(v, lang),
    time: (date) => clockTime(date, lang),
    hour: (h) => hourLabel(h, lang),
    dish: (item) => itemName(item, lang),
    status: (s) => translate(lang, STATUS_META[s].labelKey),
    table: (t) => (/^Table \d+$/i.test(t.label || '') || !t.label ? tableLabelFor(lang, t.id) : t.label),
    orderTable: (o) => orderTableLabel(o, lang),
    items: (o, max) => itemsSummary(o, max, lang),
    open: (label, to) => ({ label: tr(label), to }),
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
  const toOrders = d.open('openOrders', '/admin/orders')

  if (!active) {
    return { text: d.tr('noActive', { total: today.current.orders }), actions: [toOrders] }
  }
  return {
    text: d.tr('activeIntro', { orders: d.cnt('activeOrder', active) }),
    bullets: ['preparing', 'almost', 'ready'].map((s) => ({ tone: s, label: `${counts[s]} ${d.status(s)}` })),
    footer: d.tr('totalFooter', { total: today.current.orders }),
    actions: [toOrders],
  }
}

const countByStatus = (status) => async (d) => {
  const { counts } = await d.orders()
  return { text: d.tr(`count.${status}`, { n: counts[status] || 0 }), actions: [d.open('openOrders', '/admin/orders')] }
}

// "Up 12% compared with yesterday (30)." (or null when there is nothing to compare)
const compare = (d, upKey, downKey, change, prev) =>
  change === null ? '' : ` ${d.tr(change >= 0 ? upKey : downKey, { pct: Math.abs(change), prev })}`

async function totalToday(d) {
  const t = await d.today()
  const y = await d.yesterday()
  const c = pctChange(t.current.orders, y.current.orders)
  return { text: d.tr('totalToday', { orders: d.cnt('order', t.current.orders) }) + compare(d, 'cmpOrdersUp', 'cmpOrdersDown', c, y.current.orders) }
}

async function ordersYesterday(d) {
  const y = await d.yesterday()
  return { text: d.tr('ordersYesterday', { orders: d.cnt('order', y.current.orders), money: d.money(y.current.revenue) }) }
}

async function sales(d) {
  const t = await d.today()
  const y = await d.yesterday()
  const c = pctChange(t.current.revenue, y.current.revenue)
  return {
    text:
      d.tr('sales', { money: d.money(t.current.revenue), orders: d.cnt('order', t.current.orders) }) +
      compare(d, 'cmpSalesUp', 'cmpSalesDown', c, d.money(y.current.revenue)),
  }
}

async function salesYesterday(d) {
  const y = await d.yesterday()
  return { text: d.tr('salesYesterday', { money: d.money(y.current.revenue), orders: d.cnt('order', y.current.orders), avg: d.money(y.current.avg) }) }
}

async function average(d) {
  const t = await d.today()
  const y = await d.yesterday()
  const c = pctChange(t.current.avg, y.current.avg)
  return { text: d.tr('average', { avg: d.money(t.current.avg) }) + (c === null ? '' : ` ${d.tr('avgChange', { pct: `${c >= 0 ? '+' : ''}${c}%` })}`) }
}

async function popular(d) {
  const t = await d.today()
  if (!t.popular) return { text: d.tr('noBestSeller') }
  const share = t.current.orders ? Math.round((t.popular.orders / t.current.orders) * 100) : 0
  return {
    text: d.tr('popular', { name: d.dish(t.popular), orders: d.cnt('order', t.popular.orders), share }),
    bullets: t.topItems.slice(1, 4).map((i, n) => ({ tone: 'neutral', label: d.tr('popularRow', { rank: n + 2, name: d.dish(i), orders: d.cnt('order', i.orders) }) })),
    actions: [d.open('openMenu', '/admin/menu')],
  }
}

async function topItems(d) {
  const t = await d.today()
  if (!t.topItems.length) return { text: d.tr('noOrdersToday') }
  return {
    text: d.tr('topTitle'),
    bullets: t.topItems.map((i, n) => ({
      tone: 'neutral',
      label: d.tr('topRow', { rank: n + 1, name: d.dish(i), portions: d.cnt('portion', i.quantity), orders: d.cnt('order', i.orders) }),
    })),
  }
}

async function bestSellerFlags(d) {
  const best = (await d.menu()).filter((i) => i.isBest)
  return best.length
    ? { text: d.tr('bestFlags', { dishes: d.cnt('dish', best.length) }), bullets: best.slice(0, 10).map((i) => ({ tone: 'neutral', label: d.dish(i) })), actions: [d.open('openMenu', '/admin/menu')] }
    : { text: d.tr('noBestFlags') }
}

async function busiestHour(d) {
  const t = await d.today()
  const rows = t.hourly.current.filter((h) => h.orders > 0)
  if (!rows.length) return { text: d.tr('noBusy') }
  const top = rows.reduce((a, b) => (b.orders > a.orders ? b : a))
  return { text: d.tr('busiest', { hour: d.hour(top.hour), orders: d.cnt('order', top.orders), money: d.money(top.revenue) }) }
}

// Staff say "order 22" meaning the number they SEE on the dashboard: today's
// running number, not the database id. Find that one among today's orders.
async function lookupOrderNumber(d, number) {
  const { orders } = await d.orders()
  const found = orders.find((o) => String(orderNumber(o)) === String(number))
  if (!found) return { text: d.tr('orderNotFound', { id: number }) }
  return lookupOrder(d, found.id)
}

async function lookupOrder(d, id) {
  try {
    const o = await d.order(id)
    return {
      text: d.tr('orderLine', { id: orderNumber(o), table: d.orderTable(o) }),
      bullets: [
        { tone: o.status, label: d.status(o.status) },
        { tone: 'neutral', label: d.items(o, 6) },
        { tone: 'neutral', label: d.tr('orderTotal', { money: d.money(o.total), time: d.time(o.createdAt) }) },
      ],
      actions: [d.open('viewInOrders', `/admin/orders?q=${orderNumber(o)}`)],
    }
  } catch {
    return { text: d.tr('orderNotFound', { id }) }
  }
}

async function latestOrder(d) {
  const { orders } = await d.orders()
  if (!orders.length) return { text: d.tr('noOrdersYet') }
  return lookupOrder(d, orders[0].id)
}

async function biggestOrder(d) {
  const { orders } = await d.orders()
  const real = orders.filter((o) => o.status !== 'cancelled')
  if (!real.length) return { text: d.tr('noOrdersYet') }
  const top = real.reduce((a, b) => (b.total > a.total ? b : a))
  return lookupOrder(d, top.id)
}

async function longestWaiting(d) {
  const open = (await openOrders(d)).filter((o) => o.status !== 'ready')
  if (!open.length) return { text: d.tr('nothingWaiting') }
  const o = open[open.length - 1]
  const mins = Math.max(0, Math.round((Date.now() - new Date(o.createdAt)) / 60000))
  return {
    text: d.tr('longestWait', { id: orderNumber(o), table: d.orderTable(o), minutes: d.cnt('minute', mins), status: d.status(o.status).toLowerCase() }),
    actions: [d.open('viewInOrders', `/admin/orders?q=${orderNumber(o)}`)],
  }
}

async function readyOrders(d) {
  const ready = (await d.orders()).orders.filter((o) => o.status === 'ready')
  if (!ready.length) return { text: d.tr('noReady') }
  return {
    text: d.tr('readyList', { orders: d.cnt('order', ready.length) }),
    bullets: ready.map((o) => ({ tone: 'ready', label: `#${orderNumber(o)} — ${d.orderTable(o)}` })),
    actions: [d.open('openOrders', '/admin/orders')],
  }
}

async function homeOrders(d) {
  const home = (await d.orders()).orders.filter((o) => o.tableId === 'home')
  const open = home.filter((o) => OPEN.includes(o.status))
  return {
    text: d.tr('homeSummary', { open: d.cnt('order', open.length), total: home.length }),
    bullets: open.map((o) => ({ tone: o.status, label: `#${orderNumber(o)} — ${d.items(o)}` })),
    actions: [d.open('openOrders', '/admin/orders?q=to%20home')],
  }
}

async function tableOrders(d, n) {
  const { orders } = await d.orders()
  const mine = orders.filter((o) => String(o.tableId) === String(n))
  if (!mine.length) return { text: d.tr('tableNoOrders', { n }) }
  const last = mine[0]
  return {
    text: d.tr('tableOrders', { n, orders: d.cnt('order', mine.length), id: orderNumber(last) }),
    bullets: [
      { tone: last.status, label: d.status(last.status) },
      { tone: 'neutral', label: d.items(last, 6) },
      { tone: 'neutral', label: d.tr('totalOnly', { money: d.money(last.total) }) },
    ],
  }
}

async function tablesSummary(d) {
  const tables = await floorTables(d)
  const by = (s) => tables.filter((t) => t.state === s)
  const occ = by('occupied')
  const bullets = [
    { tone: 'occupied', label: d.tr('bOccupied', { n: occ.length }) },
    { tone: 'available', label: d.tr('bAvailable', { n: by('available').length }) },
  ]
  if (by('cleaning').length) bullets.push({ tone: 'cleaning', label: d.tr('bCleaning', { n: by('cleaning').length }) })
  if (by('out_of_service').length) bullets.push({ tone: 'neutral', label: d.tr('bOut', { n: by('out_of_service').length }) })
  return {
    text: d.tr('tablesYou', { tables: d.cnt('table', tables.length) }) + (occ.length ? d.tr('tablesOccupied', { list: occ.map((t) => d.table(t)).join(d.lang === 'ar' ? '، ' : ', ') }) : ''),
    bullets,
    actions: [d.open('openTables', '/admin/tables')],
  }
}

const tablesInState = (state) => async (d) => {
  const list = (await floorTables(d)).filter((t) => t.state === state)
  if (!list.length) return { text: d.tr(`stn.${state}`) }
  return {
    text: d.tr('tablesInState', { title: d.tr(`stp.${state}`), count: list.length, list: list.map((t) => d.table(t)).join(d.lang === 'ar' ? '، ' : ', ') }),
    actions: [d.open('openTables', '/admin/tables')],
  }
}

async function freeSeats(d) {
  const free = (await floorTables(d)).filter((t) => t.state === 'available')
  const seats = free.reduce((s, t) => s + t.seats, 0)
  return { text: d.tr('freeSeats', { tables: d.cnt('freeTable', free.length), places: d.cnt('place', seats) }) }
}

async function totalSeats(d) {
  const all = await floorTables(d)
  return { text: d.tr('totalSeats', { tables: d.cnt('table', all.length), places: d.cnt('place', all.reduce((s, t) => s + t.seats, 0)) }) }
}

async function biggestFreeTable(d) {
  const free = (await floorTables(d)).filter((t) => t.state === 'available')
  if (!free.length) return { text: d.tr('stn.available') }
  const t = free.reduce((a, b) => (b.seats > a.seats ? b : a))
  return { text: d.tr('biggestFree', { table: d.table(t), places: d.cnt('place', t.seats) }) }
}

async function tableStatus(d, n) {
  const t = (await floorTables(d)).find((x) => String(x.id) === String(n))
  if (!t) return { text: d.tr('tableNotFound', { n }) }
  return {
    text: d.tr('tableStatus', {
      table: d.table(t),
      places: d.cnt('place', t.seats),
      state: d.tr(`s.${t.state}`),
      since: t.order ? d.tr('since', { time: d.time(t.order.createdAt) }) : '',
    }),
  }
}

async function longestOccupied(d) {
  const occ = (await floorTables(d)).filter((t) => t.order)
  if (!occ.length) return { text: d.tr('stn.occupied') }
  const t = occ.reduce((a, b) => (new Date(b.order.createdAt) < new Date(a.order.createdAt) ? b : a))
  const mins = Math.round((Date.now() - new Date(t.order.createdAt)) / 60000)
  return { text: d.tr('longestOccupied', { table: d.table(t), minutes: d.cnt('minute', mins), time: d.time(t.order.createdAt) }) }
}

async function hiddenItems(d) {
  const items = await d.menu()
  const hidden = items.filter((i) => !i.available)
  if (!hidden.length) return { text: d.tr('allAvailable', { n: items.length }) }
  return { text: d.tr('hiddenList', { items: d.cnt('item', hidden.length) }), bullets: hidden.slice(0, 10).map((i) => ({ tone: 'neutral', label: d.dish(i) })), actions: [d.open('openMenu', '/admin/menu')] }
}

async function discounted(d) {
  const list = (await d.menu()).filter((i) => Number(i.discountPercent) > 0)
  if (!list.length) return { text: d.tr('noDiscount') }
  return {
    text: d.tr('discountList', { dishes: d.cnt('dish', list.length) }),
    bullets: list.slice(0, 10).map((i) => ({ tone: 'neutral', label: d.tr('discountRow', { name: d.dish(i), pct: i.discountPercent, money: d.money(final(i)) }) })),
  }
}

async function menuCount(d) {
  const items = await d.menu()
  const cats = await d.categories()
  return {
    text: d.tr('menuCount', { items: d.cnt('item', items.length), categories: d.cnt('category', cats.length), n: items.filter((i) => i.available).length }),
    bullets: cats.map((c) => ({ tone: 'neutral', label: `${categoryName(c, d.lang)}: ${items.filter((i) => i.categoryId === c.id).length}` })),
  }
}

async function priciest(d) {
  const items = await d.menu()
  const top = items.reduce((a, b) => (final(b) > final(a) ? b : a))
  return { text: d.tr('priciest', { name: d.dish(top), money: d.money(final(top)) }) }
}

async function cheapest(d) {
  const items = await d.menu()
  const low = items.reduce((a, b) => (final(b) < final(a) ? b : a))
  return { text: d.tr('cheapest', { name: d.dish(low), money: d.money(final(low)) }) }
}

async function priceOf(d, text) {
  const items = await d.menu()
  // Matches the English, French or Arabic name of the dish.
  const names = (i) => [i.name, itemName(i, 'fr'), itemName(i, 'ar')].map((n) => normalize(n || ''))
  const found = items.filter((i) => names(i).some((n) => n && text.includes(n)))
  if (!found.length) return null
  const i = found.sort((a, b) => b.name.length - a.name.length)[0]
  const disc = Number(i.discountPercent) > 0 ? d.tr('priceDisc', { pct: i.discountPercent, was: d.money(i.price) }) : ''
  return { text: `${d.tr('priceLine', { name: d.dish(i), money: d.money(final(i)), disc })} ${d.tr(i.available ? 'priceAvail' : 'priceHidden')}` }
}

const help = (d) => ({
  text: d.tr('help'),
  bullets: [
    { tone: 'preparing', label: d.tr('help.orders') },
    { tone: 'almost', label: d.tr('help.sales') },
    { tone: 'ready', label: d.tr('help.dishes') },
    { tone: 'available', label: d.tr('help.tables') },
    { tone: 'neutral', label: d.tr('help.home') },
  ],
})

const say = (key, actions) => (d) => ({ text: d.tr(key), ...(actions ? { actions: actions(d) } : {}) })

/* ------------------------------ the rules ----------------------------- */
// The first rule whose `when` is true answers. Specific rules come first.
// Each rule lists English words plus the same idea in French and Arabic.
const RULES = [
  { when: (t) => /^(hi|hello|hey|salam|salut|bonjour|bonsoir|good (morning|evening|afternoon))(?![a-z])|^(مرحبا|اهلا|السلام)/.test(t), run: say('hello') },
  { when: (t) => has(t, 'thank', 'merci', 'shukran', 'شكرا', 'شكر'), run: say('thanks') },
  { when: (t) => /^(bye|goodbye|see you|ok bye|au revoir|a bientot|مع السلامه|الى اللقاء)/.test(t), run: say('bye') },
  { when: (t) => has(t, 'who are you', 'your name', 'what are you', 'qui es-tu', 'qui es tu', 'comment tu t', 'من انت', 'ما اسمك'), run: say('whoami') },
  { when: (t) => has(t, 'what time', 'time is it', 'current time', 'quelle heure', 'كم الساعه', 'الساعه كم'), run: (d) => ({ text: d.tr('timeNow', { time: new Date().toLocaleTimeString(localeOf(d.lang), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) }) }) },
  { when: (t) => has(t, "today's date", 'what day', 'what date', 'date today', 'quel jour', 'quelle date', 'تاريخ اليوم', 'اي يوم'), run: (d) => ({ text: new Date().toLocaleDateString(localeOf(d.lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }) },

  { when: (t) => has(t, 'add') && has(t, 'menu', 'item', 'dish'), run: say('howAddItem', (d) => [d.open('addMenuItem', '/admin/menu?new=1')]) },
  { when: (t) => has(t, 'add', 'new') && has(t, 'table'), run: say('howAddTable', (d) => [d.open('openTables', '/admin/tables')]) },
  { when: (t) => has(t, 'move', 'drag', 'rearrange', 'layout', 'deplacer', 'glisser', 'سحب', 'نقل الطاوله'), run: say('howMove', (d) => [d.open('openTables', '/admin/tables')]) },
  { when: (t) => has(t, 'qr', 'link', 'scan', 'lien'), run: say('howQr', (d) => [d.open('openTables', '/admin/tables')]) },
  { when: (t) => has(t, 'cancel', 'annuler', 'الغاء') && has(t, 'how', 'can i', 'comment', 'كيف'), run: say('howCancel') },
  { when: (t) => has(t, 'change status', 'update status', 'mark as', 'mark order', 'changer le statut', 'تغيير الحاله'), run: say('howStatus', (d) => [d.open('openOrders', '/admin/orders')]) },
  { when: (t) => has(t, 'help', 'faq', 'what can you', 'what do you', 'commands', 'examples', 'aide', 'que peux', 'exemples', 'مساعد', 'ساعد', 'ماذا يمكنك', 'امثله'), run: help },

  // Specific order / table lookups
  { when: (t) => /#\s*\d+|order\s*(number|no\.?)?\s*\d+|commande\s*(numero|n°)?\s*\d+|طلب\s*(رقم)?\s*\d+/.test(t), run: (d, t) => lookupOrderNumber(d, (t.match(/#\s*(\d+)/) || t.match(/(?:order|commande|طلب)\s*(?:number|no\.?|numero|n°|رقم)?\s*(\d+)/))[1]) },
  { when: (t) => /(table|طاوله)\s*#?\s*\d+/.test(t) && has(t, 'order', 'ordered', 'eat', 'commande', 'طلب'), run: (d, t) => tableOrders(d, t.match(/(?:table|طاوله)\s*#?\s*(\d+)/)[1]) },
  { when: (t) => /(table|طاوله)\s*#?\s*\d+/.test(t), run: (d, t) => tableStatus(d, t.match(/(?:table|طاوله)\s*#?\s*(\d+)/)[1]) },

  // Orders
  { when: (t) => has(t, 'to home', 'tohome', 'take away', 'takeaway', 'take-away', 'delivery', 'emporter', 'livraison', 'للمنزل', 'توصيل', 'سفري'), run: homeOrders },
  { when: (t) => has(t, 'latest order', 'last order', 'newest order', 'most recent order', 'new order', 'derniere commande', 'dernière commande', 'اخر طلب'), run: latestOrder },
  { when: (t) => has(t, 'biggest order', 'largest order', 'highest order', 'most expensive order', 'plus grosse commande', 'اكبر طلب'), run: biggestOrder },
  { when: (t) => has(t, 'longest wait', 'waiting the longest', 'oldest order', 'delayed', 'late order', 'how long', 'plus longtemps', 'attend depuis', 'اطول وقت', 'اطول انتظار', 'ينتظر منذ'), run: longestWaiting },
  { when: (t) => (has(t, 'ready') && has(t, 'order', 'serve', 'what', 'which', 'any')) || (has(t, 'pretes', 'prete', 'جاهز') && has(t, 'commande', 'طلب', 'quelle', 'des ')), run: readyOrders },
  { when: (t) => (has(t, 'cancelled', 'canceled') && has(t, 'how many', 'order', 'any')) || (has(t, 'annulee', 'ملغ') && has(t, 'combien', 'commande', 'كم', 'طلب')), run: countByStatus('cancelled') },
  { when: (t) => (has(t, 'completed', 'finished', 'served') && has(t, 'how many', 'order')) || (has(t, 'terminee', 'مكتمل') && has(t, 'combien', 'commande', 'كم', 'طلب')), run: countByStatus('completed') },
  { when: (t) => (has(t, 'preparing', 'cooking', 'in the kitchen', 'being prepared') && has(t, 'how many', 'order', 'what')) || (has(t, 'en preparation', 'قيد التحضير') && has(t, 'combien', 'commande', 'كم', 'طلب')), run: countByStatus('preparing') },
  { when: (t) => has(t, 'yesterday', 'hier', 'امس', 'البارحه') && has(t, 'order', 'commande', 'طلب'), run: ordersYesterday },
  { when: (t) => has(t, 'yesterday', 'hier', 'امس', 'البارحه') && has(t, 'sales', 'revenue', 'made', 'money', 'earn', 'ventes', 'gagn', 'مبيعات', 'ربح', 'ايراد'), run: salesYesterday },
  { when: (t) => has(t, 'total orders', 'orders today', 'how many orders today', 'orders did we', 'total des commandes', 'commandes aujourd', 'اجمالي الطلبات', 'طلبات اليوم'), run: totalToday },
  { when: (t) => has(t, 'busiest', 'peak', 'rush', 'busy hour', 'rush hour', 'heure de pointe', 'pointe', 'ساعه الذروه', 'الذروه'), run: busiestHour },

  // Sales
  { when: (t) => has(t, 'average', 'avg', 'panier moyen', 'moyenne', 'متوسط'), run: average },
  { when: (t) => has(t, 'sales', 'revenue', 'money', 'earn', 'made', 'income', 'profit', 'turnover', 'how much did', 'ventes', 'gagn', 'chiffre d', 'recette', 'encaiss', 'مبيعات', 'ربح', 'ايراد', 'دخل', 'كسبنا'), run: sales },

  // Dishes
  { when: (t) => has(t, 'top 5', 'top five', 'top dishes', 'top items', 'ranking', 'top 5', 'classement', 'افضل 5', 'افضل الاطباق'), run: topItems },
  { when: (t) => has(t, 'popular', 'best sell', 'bestsell', 'top sell', 'most ordered', 'top item', 'favorite', 'favourite', 'most sold', 'populaire', 'plus vendu', 'plus commande', 'اكثر طبق', 'الاكثر طلبا', 'الاكثر مبيعا', 'شعبيه', 'مبيعا'), run: popular },
  { when: (t) => has(t, 'marked as best', 'best seller flag', 'which are best', 'marque meilleure', 'موسومه'), run: bestSellerFlags },
  { when: (t) => has(t, 'unavailable', 'out of stock', 'hidden', 'not available', 'disabled', 'masque', 'cache', 'indisponible', 'مخفي', 'غير متوفر', 'نفد'), run: hiddenItems },
  { when: (t) => has(t, 'discount', 'promo', 'on sale', 'offer', 'reduction', 'remise', 'خصم', 'تخفيض', 'عروض'), run: discounted },
  { when: (t) => has(t, 'most expensive', 'priciest', 'highest price', 'plus cher', 'اغلي', 'الاغلي'), run: priciest },
  { when: (t) => has(t, 'cheapest', 'lowest price', 'moins cher', 'ارخص', 'الارخص'), run: cheapest },
  { when: (t) => has(t, 'how many items', 'how many dishes', 'menu size', 'categories', 'how many categories', 'combien de plats', 'combien d\'articles', 'catégories', 'كم صنف', 'كم طبق', 'الفئات'), run: menuCount },

  // Tables
  { when: (t) => has(t, 'longest', 'plus longtemps', 'اطول') && has(t, 'table', 'occupied', 'seated', 'occupee', 'طاول', 'مشغول'), run: longestOccupied },
  { when: (t) => has(t, 'biggest', 'largest', 'plus grande', 'اكبر') && has(t, 'table', 'طاول'), run: biggestFreeTable },
  { when: (t) => has(t, 'how many seats', 'how many places', 'capacity', 'total seats', 'total places', 'combien de places', 'capacite', 'كم مقعد', 'عدد المقاعد', 'سعه'), run: totalSeats },
  { when: (t) => has(t, 'free seats', 'seats left', 'places left', 'room for', 'space', 'places libres', 'places restantes', 'مقاعد شاغره', 'مقاعد متبقيه'), run: freeSeats },
  { when: (t) => has(t, 'free', 'available', 'empty', 'vacant', 'libre', 'vide', 'شاغر', 'فارغ') && has(t, 'table', 'طاول'), run: tablesInState('available') },
  { when: (t) => has(t, 'occupied', 'taken', 'busy', 'full', 'occupee', 'مشغول') && has(t, 'table', 'طاول'), run: tablesInState('occupied') },
  { when: (t) => has(t, 'cleaning', 'being cleaned', 'to clean', 'nettoyage', 'تنظيف'), run: tablesInState('cleaning') },
  { when: (t) => has(t, 'out of service', 'closed table', 'broken', 'hors service', 'خارج الخدمه'), run: tablesInState('out_of_service') },
  { when: (t) => has(t, 'table', 'occupan', 'floor', 'seat', 'طاول', 'etat des'), run: tablesSummary },

  // Generic order questions last
  { when: (t) => has(t, 'order', 'pending', 'active', 'kitchen', 'current', 'right now', 'waiting', 'commande', 'en ce moment', 'cuisine', 'طلب', 'الان', 'حاليا'), run: activeOrders },
]

export async function answer(rawText, password, lang = 'en') {
  const text = normalize(rawText).trim()
  const data = makeData(password, lang)

  // "How much is the margherita?" — price lookups need the menu first.
  if (has(text, 'price', 'how much is', 'how much does', 'cost', 'prix', 'combien coute', 'combien est', 'سعر', 'بكم', 'كم سعر')) {
    const found = await priceOf(data, text)
    if (found) return found
  }

  const rule = RULES.find((r) => r.when(text))
  if (rule) return rule.run(data, text)

  return { text: data.tr('fallback') }
}
