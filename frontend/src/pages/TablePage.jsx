import { useEffect, useMemo, useState } from 'react'
import {
  CATEGORIES,
  MENU_ITEMS,
  getItemsForCategory,
} from '../data/menu'
import { useTableId } from '../hooks/useTableId'
import { useCart } from '../context/CartContext'
import { useOrder } from '../context/OrderContext'
import Header from '../components/layout/Header'
import CategoryList from '../components/menu/CategoryList'
import MenuSection from '../components/menu/MenuSection'
import SearchResultsOverlay from '../components/menu/SearchResultsOverlay'
import CartBar from '../components/cart/CartBar'
import OrderTracking from '../components/order/OrderTracking'
import OrderStatusChip from '../components/order/OrderStatusChip'
import ChatbotPanel from '../components/chatbot/ChatbotPanel'
import TableNotFound from './TableNotFound'

export default function TablePage() {
  const { tableId, isValid } = useTableId()

  const [activeCategoryId, setActiveCategoryId] = useState(
    CATEGORIES[0].id
  )

  const [searchTerm, setSearchTerm] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [chatbotOpen, setChatbotOpen] = useState(false)

  // Controls the "Is this your last order?" confirmation.
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false)

  const [placing, setPlacing] = useState(false)

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
    const term = searchTerm.trim().toLowerCase()

    if (!term) {
      return [...MENU_ITEMS].sort(
        (a, b) => Number(b.isBest) - Number(a.isBest)
      )
    }

    return [...MENU_ITEMS]
      .filter((item) =>
        item.name.toLowerCase().includes(term)
      )
      .sort(
        (a, b) => Number(b.isBest) - Number(a.isBest)
      )
  }, [searchTerm])

  if (!isValid) {
    return <TableNotFound />
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
        await order.addToOrder(cart.lines)
      } else {
        await order.placeOrder(tableId, cart.lines)
      }

      // Both of them open the tracking screen automatically.
      setConfirmOrderOpen(false)
    } catch (error) {
      console.error('Failed to send order:', error)
      setOrderError(
        error?.message || 'Something went wrong. Please try again.'
      )
    } finally {
      setPlacing(false)
    }
  }

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------

  return (
    <div className="relative flex h-full flex-col bg-ink">

      {/* HEADER */}
      <Header
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onOpenSearch={handleOpenSearch}
        onOpenCart={() =>
          document
            .getElementById('cart-anchor')
            ?.scrollIntoView()
        }
        onOpenChatbot={() => setChatbotOpen(true)}
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
        <MenuSection items={visibleItems} />
      </div>

      {/* SEARCH */}
      <SearchResultsOverlay
        open={searchOpen}
        items={searchResults}
        onClose={handleCloseSearch}
      />

      {/* CART ANCHOR */}
      <div id="cart-anchor" />

      {/* CART */}
      <CartBar
        onPlaceOrder={handleRequestPlaceOrder}
        placing={placing}
        placeLabel={
          addingToOrder ? 'ADD TO YOUR ORDER' : 'PLACE THE ORDER'
        }
      />

      {/* "Order in progress" button, for when the tracking screen is hidden */}
      <OrderStatusChip />

      {/* ORDER TRACKING */}
      <OrderTracking />

      {/* CHATBOT */}
      <ChatbotPanel
        open={chatbotOpen}
        onClose={() => setChatbotOpen(false)}
        onNavigateToCategory={handleNavigateFromChat}
      />

      {/* ------------------------------------------------------------------ */}
      {/* LAST ORDER CONFIRMATION */}
      {/* ------------------------------------------------------------------ */}

      {confirmOrderOpen && (
        <div
          className="absolute inset-0 z-[100] flex items-center justify-center bg-black/55 px-5 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !placing) {
              setConfirmOrderOpen(false)
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-line bg-panel p-5 shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-xl text-cream">
              {addingToOrder
                ? 'Add these to your order?'
                : 'Is this your last order?'}
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-cream/55">
              {addingToOrder
                ? 'These dishes will be added to the order you already placed. The kitchen sees them right away.'
                : 'If you are finished ordering, confirm and we will send your order to the kitchen.'}
            </p>

            {/* Current order summary */}
            <div className="mt-4 rounded-2xl bg-panel-light p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-cream/60">
                  {cart.totalCount}{' '}
                  {cart.totalCount === 1 ? 'item' : 'items'}
                </span>

                <span className="text-sm font-semibold text-cream">
                  {cart.totalPrice} DH
                </span>
              </div>

              <div className="mt-2 space-y-1">
                {cart.lines.map((line) => (
                  <div
                    key={line.item.id}
                    className="flex justify-between gap-3 text-xs text-cream/45"
                  >
                    <span className="truncate">
                      {line.quantity} × {line.item.name}
                    </span>

                    <span className="shrink-0">
                      {line.lineTotal} DH
                    </span>
                  </div>
                ))}
              </div>
            </div>

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
                NO, KEEP SHOPPING
              </button>

              <button
                type="button"
                onClick={handleConfirmPlaceOrder}
                disabled={placing}
                className="flex-1 rounded-full bg-maroon py-3 text-sm font-semibold text-cream transition hover:bg-maroon-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                {placing
                  ? 'SENDING…'
                  : addingToOrder
                    ? 'YES, ADD THEM'
                    : 'YES, PLACE ORDER'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}