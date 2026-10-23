import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CATEGORIES,
  MENU_ITEMS,
  getItemsForCategory,
} from '../data/menu'
import { useTableId } from '../hooks/useTableId'
import { HOME_TABLE_ID, tableLabel } from '../data/tables'
import { useCart } from '../context/CartContext'
import { useOrder } from '../context/OrderContext'
import { useLanguage } from '../i18n/LanguageContext'
import { itemMatchesSearch } from '../i18n/menuText'
import Header from '../components/layout/Header'
import CategoryList from '../components/menu/CategoryList'
import MenuSection from '../components/menu/MenuSection'
import SearchResultsOverlay from '../components/menu/SearchResultsOverlay'
import CartBar from '../components/cart/CartBar'
import OrderTracking from '../components/order/OrderTracking'
import OrderStatusChip from '../components/order/OrderStatusChip'
import CallWaiterButton from '../components/waiter/CallWaiterButton'
import ChatbotPanel, { ChatbotBoundary } from '../components/chatbot/ChatbotPanel'
import OrderHistoryPanel from '../components/history/OrderHistoryPanel'
import TableNotFound from './TableNotFound'
import { TableChecking, TableClosed, TableOffline } from './TableStatusScreens'

// The server's error messages are written in English. Recognise the common
// ones and show them in the customer's language; anything else gets a
// friendly generic message.
function friendlyOrderError(message, t) {
  const text = String(message || '')
  if (/not available right now/i.test(text)) return t('err.unavailable')
  if (/already (finished|started)|no longer/i.test(text)) return t('err.finished')
  if (/being cleaned|out of service/i.test(text)) return t('err.tableClosed')
  if (/empty order|nothing to add/i.test(text)) return t('err.empty')
  return t('err.generic')
}

export default function TablePage() {
  const { tableId, status: tableStatus, retry: retryTable, closed: tableClosed } = useTableId()
  const { t, formatMoney, itemName } = useLanguage()
  const isHome = tableId === HOME_TABLE_ID

  const [activeCategoryId, setActiveCategoryId] = useState(
    CATEGORIES[0].id
  )

  const [searchTerm, setSearchTerm] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [chatbotOpen, setChatbotOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // The list of dishes in the cart bar (opened by the cart button in the header).
  const [cartOpen, setCartOpen] = useState(false)

  // Controls the "Is this your last order?" confirmation.
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false)

  const [placing, setPlacing] = useState(false)

  // The customer's optional note for the kitchen ("no onions"), typed in the
  // confirmation box and sent with the order.
  const [orderNote, setOrderNote] = useState('')

  // Height of the cart bar at the bottom — the menu keeps that much room
  // below its last row (see MenuSection).
  const [cartBarHeight, setCartBarHeight] = useState(150)
  const handleCartBarHeight = useCallback((height) => setCartBarHeight(height), [])

  // Shown inside the confirmation if the server refuses (e.g. the kitchen
  // already finished the order so nothing can be added anymore).
  const [orderError, setOrderError] = useState('')

  const cart = useCart()
  const order = useOrder()

  // True once the customer already has an order running: new dishes are
  // ADDED to that order instead of creating a second one.
  const addingToOrder = Boolean(order.order)

  // While the customer is looking at their order status, search is off
  // (the chatbot stays available).
  const searchLocked = Boolean(order.order) && order.trackingVisible

  useEffect(() => {
    if (searchLocked) {
      setSearchOpen(false)
      setSearchTerm('')
    }
  }, [searchLocked])

  // -------------------------------------------------------------------------
  // NORMAL MENU
  // -------------------------------------------------------------------------

  const visibleItems = useMemo(() => {
    return [...getItemsForCategory(activeCategoryId)].sort(
      (a, b) => Number(b.isBest) - Number(a.isBest)
    )
  }, [activeCategoryId])

  // -------------------------------------------------------------------------
  // SEARCH RESULTS
  // -------------------------------------------------------------------------

  const searchResults = useMemo(() => {
    const term = searchTerm.trim()

    if (!term) {
      return [...MENU_ITEMS].sort(
        (a, b) => Number(b.isBest) - Number(a.isBest)
      )
    }

    return [...MENU_ITEMS]
      // matches the English, French or Arabic name
      .filter((item) => itemMatchesSearch(item, term))
      .sort(
        (a, b) => Number(b.isBest) - Number(a.isBest)
      )
  }, [searchTerm])

  if (tableStatus === 'checking') return <TableChecking />
  if (tableStatus === 'offline') return <TableOffline onRetry={retryTable} />
  if (tableStatus !== 'valid') return <TableNotFound />

  // Staff closed this table. "Out of service" always shows its message. A
  // table "being cleaned" does not interrupt guests who already have an order
  // running, so they can still follow it.
  if (tableClosed === 'out_of_service' || (tableClosed && !order.order)) {
    return <TableClosed reason={tableClosed} tableLabel={tableLabel(tableId, t)} onRetry={retryTable} />
  }

  // -------------------------------------------------------------------------
  // CATEGORY
  // -------------------------------------------------------------------------

  function handleSelectCategory(categoryId) {
    setSearchTerm('')
    setSearchOpen(false)
    setActiveCategoryId(categoryId)
  }

  // -------------------------------------------------------------------------
  // CHATBOT
  // -------------------------------------------------------------------------

  function handleNavigateFromChat(categoryId) {
    handleSelectCategory(categoryId)
    setChatbotOpen(false)
  }

  // -------------------------------------------------------------------------
  // SEARCH
  // -------------------------------------------------------------------------

  function handleOpenSearch() {
    if (searchLocked) return
    setSearchOpen(true)
  }

  function handleCloseSearch() {
    setSearchOpen(false)
    setSearchTerm('')
  }

  // -------------------------------------------------------------------------
  // PLACE ORDER
  // -------------------------------------------------------------------------

  // CartBar calls this FIRST.
  // We don't submit anything yet.
  function handleRequestPlaceOrder() {
    if (cart.totalCount === 0 || placing) {
      return
    }

    setOrderError('')
    setConfirmOrderOpen(true)
  }

  // User clicked NO.
  // Simply close the confirmation and keep shopping.
  function handleContinueShopping() {
    setOrderError('')
    setConfirmOrderOpen(false)
  }

  // User clicked YES.
  // THIS is where the real order is submitted.
  async function handleConfirmPlaceOrder() {
    if (cart.totalCount === 0 || placing) {
      return
    }

    setPlacing(true)
    setOrderError('')

    try {
      if (order.order) {
        // Already ordering: add these dishes to the SAME order.
        await order.addToOrder(cart.lines, orderNote)
      } else {
        await order.placeOrder(tableId, cart.lines, orderNote)
      }

      // Both of them open the tracking screen automatically.
      setOrderNote('')
      setConfirmOrderOpen(false)
      setCartOpen(false)
    } catch (error) {
      console.error('Failed to send order:', error)
      setOrderError(friendlyOrderError(error?.message, t))
    } finally {
      setPlacing(false)
    }
  }

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------

  return (
    <div className="relative flex h-full flex-col bg-ink">

      {/* Everything under the chat is hidden while it is open, so the
          browser stops painting (and animating) a whole menu nobody can see. */}
      <div className={`flex min-h-0 flex-1 flex-col ${chatbotOpen || historyOpen ? 'invisible' : ''}`}>

      {/* HEADER */}
      <Header
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onOpenSearch={handleOpenSearch}
        onOpenCart={() => setCartOpen((open) => !open)}
        onOpenChatbot={() => setChatbotOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        searchDisabled={searchLocked}
      />

      {/* CATEGORIES */}
      <div className="shrink-0 pb-2 pt-1">
        <CategoryList
          categories={CATEGORIES}
          activeCategoryId={activeCategoryId}
          onSelect={handleSelectCategory}
        />
      </div>

      {/* NORMAL MENU */}
      <div className="min-h-0 flex-1">
        <MenuSection
          items={visibleItems}
          resetKey={activeCategoryId}
          bottomInset={cartBarHeight}
        />
      </div>

      {/* SEARCH */}
      <SearchResultsOverlay
        open={searchOpen}
        items={searchResults}
        onClose={handleCloseSearch}
      />

      {/* CART */}
      <CartBar
        onPlaceOrder={handleRequestPlaceOrder}
        placing={placing}
        expanded={cartOpen}
        onToggleExpanded={() => setCartOpen((open) => !open)}
        onHeightChange={handleCartBarHeight}
        placeLabel={
          addingToOrder ? t('cart.addToOrder') : t('cart.place')
        }
      />

      {/* "Order in progress" button, for when the tracking screen is hidden */}
      <OrderStatusChip />

      {/* CALL WAITER — always visible, just above the cart bar. When the
          "order in progress" button is showing it sits one step higher. */}
      <CallWaiterButton
        style={{ bottom: cartBarHeight + 12 + (order.order && !order.trackingVisible ? 48 : 0) }}
      />

      {/* ORDER TRACKING */}
      <OrderTracking />

      </div>

      {/* CHATBOT */}
      <ChatbotBoundary open={chatbotOpen} onCrash={() => setChatbotOpen(false)}>
        <ChatbotPanel
          open={chatbotOpen}
          onClose={() => setChatbotOpen(false)}
          onNavigateToCategory={handleNavigateFromChat}
        />
      </ChatbotBoundary>

      {/* ORDER HISTORY */}
      <OrderHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />

      {/* ------------------------------------------------------------------ */}
      {/* LAST ORDER CONFIRMATION */}
      {/* ------------------------------------------------------------------ */}

      <AnimatePresence>
      {confirmOrderOpen && (
        <motion.div
          key="confirm-order"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-[100] flex items-center justify-center bg-black/55 px-5 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !placing) {
              setConfirmOrderOpen(false)
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm rounded-3xl border border-line bg-panel p-5 shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-xl text-cream">
              {addingToOrder
                ? t('confirm.titleAdd')
                : t('confirm.titleLast')}
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-cream/55">
              {addingToOrder
                ? t('confirm.bodyAdd')
                : isHome
                  ? t('confirm.bodyHome')
                  : t('confirm.bodyTable')}
            </p>

            {/* Current order summary */}
            <div className="mt-4 rounded-2xl bg-panel-light p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-cream/60">
                  {t('common.items', { count: cart.totalCount })}
                </span>

                <span className="text-sm font-semibold text-cream">
                  {formatMoney(cart.totalPrice)}
                </span>
              </div>

              <div className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                {cart.lines.map((line) => (
                  <div
                    key={line.item.id}
                    className="flex justify-between gap-3 text-xs text-cream/45"
                  >
                    <span className="truncate">
                      {line.quantity} × {itemName(line.item)}
                    </span>

                    <span className="shrink-0">
                      {formatMoney(line.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Note for the kitchen */}
            <label className="mt-3 block">
              <span className="text-xs font-semibold text-cream/60">{t('note.label')}</span>
              <textarea
                value={orderNote}
                onChange={(event) => setOrderNote(event.target.value.slice(0, 300))}
                maxLength={300}
                rows={2}
                disabled={placing}
                placeholder={t('note.placeholder')}
                className="mt-1 w-full resize-none rounded-xl border border-line bg-panel-light px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-maroon-bright focus:outline-none"
              />
            </label>

            {orderError && (
              <p className="mt-3 text-sm leading-relaxed text-red-300">
                {orderError}
              </p>
            )}

            {/* Buttons */}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleContinueShopping}
                disabled={placing}
                className="flex-1 rounded-full border border-line py-3 text-sm font-semibold text-cream/75 transition hover:bg-panel-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('confirm.no')}
              </button>

              <button
                type="button"
                onClick={handleConfirmPlaceOrder}
                disabled={placing}
                className="flex-1 rounded-full bg-maroon py-3 text-sm font-semibold text-cream transition hover:bg-maroon-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                {placing
                  ? t('confirm.sending')
                  : addingToOrder
                    ? t('confirm.yesAdd')
                    : t('confirm.yesPlace')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

    </div>
  )
}
