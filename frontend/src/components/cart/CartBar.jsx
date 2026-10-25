import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimation } from 'framer-motion'
import { ChevronDown, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import FadeImage from '../ui/FadeImage'
import { useLanguage } from '../../i18n/LanguageContext'

export default function CartBar({
  onPlaceOrder,
  placing,
  placeLabel,
  // The list of dishes can be opened from outside (the cart button in the
  // header). If TablePage doesn't pass these, it opens/closes by itself.
  expanded: expandedProp,
  onToggleExpanded,
  // Called with the bar's real height (and again whenever it changes, e.g.
  // when the list of dishes opens) so the menu can leave exactly enough
  // room below its last row.
  onHeightChange,
}) {
  const {
    lines,
    totalCount,
    totalPrice,
    addItem,
    removeItem,
    removeLine,
  } = useCart()

  const { t, formatMoney, itemName } = useLanguage()
  const [internalExpanded, setInternalExpanded] = useState(false)
  const barRef = useRef(null)

  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar || !onHeightChange) return

    let frame = 0
    const report = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => onHeightChange(Math.ceil(bar.getBoundingClientRect().height)))
    }

    report()

    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(frame)

    const observer = new ResizeObserver(report)
    observer.observe(bar)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [onHeightChange])

  const isControlled = expandedProp !== undefined
  const expanded = isControlled ? expandedProp : internalExpanded

  function toggleExpanded() {
    if (isControlled) onToggleExpanded?.()
    else setInternalExpanded((prev) => !prev)
  }

  const canPlaceOrder = totalCount > 0 && !placing

  // Tapping anywhere outside the cart closes the open list (no need to find
  // the little arrow). The header's cart button toggles by itself, so it is
  // left alone here, otherwise it would close and reopen at the same time.
  useEffect(() => {
    if (!expanded) return undefined
    function onOutside(event) {
      if (barRef.current?.contains(event.target)) return
      if (event.target.closest?.('[data-cart-toggle]')) return
      toggleExpanded()
    }
    document.addEventListener('pointerdown', onOutside)
    return () => document.removeEventListener('pointerdown', onOutside)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, isControlled, onToggleExpanded])

  async function handlePlaceOrder() {
    if (!canPlaceOrder) return

    try {
      await onPlaceOrder()
    } catch (error) {
      console.error('Failed to place order:', error)
    }
  }

  return (
    <div
      ref={barRef}
      className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-line bg-panel px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.45)]"
    >

      {/* EXPANDED CART (slides open and closed smoothly) */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="cart-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mb-3 max-h-52 space-y-2 overflow-y-auto pe-1">
              {totalCount === 0 ? (
                <p className="rounded-xl bg-panel-light px-3 py-4 text-center text-sm text-cream/50">
                  {t('cart.empty')}
                </p>
              ) : (
                lines.map(({ item, quantity, lineTotal }) => (
                  <SwipeRow key={item.id} onRemove={() => removeLine(item.id)}>
                    <FadeImage
                      src={item.image}
                      alt={itemName(item)}
                      className="h-11 w-11 shrink-0 rounded-lg"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-cream">
                        {itemName(item)}
                      </p>

                      <p className="text-xs text-cream/50">
                        {formatMoney(lineTotal)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={t('item.removeOne', { name: itemName(item) })}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-cream"
                      >
                        <Minus size={12} />
                      </button>

                      <span className="w-4 text-center text-xs text-cream">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => addItem(item.id)}
                        aria-label={t('item.addAnother', { name: itemName(item) })}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-cream"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </SwipeRow>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ORDER SUMMARY */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center gap-3 py-1"
        aria-expanded={expanded}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-cream">
          <ShoppingCart size={16} />

          <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-maroon-bright px-1 text-[10px] font-semibold">
            {totalCount}
          </span>
        </span>

        <span className="flex-1 text-start">
          <span className="block text-sm font-semibold text-cream">
            {t('cart.title')}
          </span>

          <span className="block text-xs text-cream/50">
            {t('common.items', { count: totalCount })}
          </span>
        </span>

        <span className="text-sm font-semibold text-cream">
          {formatMoney(totalPrice)}
        </span>

        <ChevronDown
          size={18}
          className={`text-cream/60 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* PLACE ORDER */}
      <button
        type="button"
        onClick={handlePlaceOrder}
        disabled={!canPlaceOrder}
        className={`mt-2 w-full rounded-full py-3.5 font-display text-sm tracking-wide transition ${
          canPlaceOrder
            ? 'bg-maroon text-cream hover:bg-maroon-bright'
            : 'cursor-not-allowed bg-ink text-cream/30'
        }`}
      >
        {placing ? t('cart.wait') : placeLabel || t('cart.place')}
      </button>
    </div>
  )
}

// A dish line you can swipe left or right to remove it, like dismissing a
// notification: a red trash can shows behind it, and letting go past the
// halfway mark (or with a quick flick) deletes the dish.
const SWIPE_DISTANCE = 90
const SWIPE_SPEED = 500

function SwipeRow({ children, onRemove }) {
  const controls = useAnimation()
  const [dragging, setDragging] = useState(false)

  async function handleDragEnd(_event, info) {
    setDragging(false)
    const far = Math.abs(info.offset.x) > SWIPE_DISTANCE
    const flick = Math.abs(info.velocity.x) > SWIPE_SPEED && Math.abs(info.offset.x) > 30
    if (far || flick) {
      const direction = info.offset.x > 0 ? 1 : -1
      await controls.start({ x: direction * 420, opacity: 0, transition: { duration: 0.18 } })
      onRemove()
    } else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 500, damping: 35 } })
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-maroon-bright">
      {/* The trash can waiting behind the dish, on both sides */}
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-between px-4 text-cream transition-opacity ${dragging ? 'opacity-100' : 'opacity-0'}`}
      >
        <Trash2 size={18} />
        <Trash2 size={18} />
      </span>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        animate={controls}
        onDragStart={() => setDragging(true)}
        onDragEnd={handleDragEnd}
        data-testid="swipe-row"
        className="relative flex touch-pan-y items-center gap-2.5 rounded-xl bg-panel-light p-2"
      >
        {children}
      </motion.div>
    </div>
  )
}
