import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Minus, Plus, ShoppingCart } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import FadeImage from '../ui/FadeImage'

export default function CartBar({
  onPlaceOrder,
  placing,
  placeLabel = 'PLACE THE ORDER',
  // The list of dishes can be opened from outside (the cart button in the
  // header). If TablePage doesn't pass these, it opens/closes by itself.
  expanded: expandedProp,
  onToggleExpanded,
}) {
  const {
    lines,
    totalCount,
    totalPrice,
    addItem,
    removeItem,
  } = useCart()

  const [internalExpanded, setInternalExpanded] = useState(false)

  const isControlled = expandedProp !== undefined
  const expanded = isControlled ? expandedProp : internalExpanded

  function toggleExpanded() {
    if (isControlled) onToggleExpanded?.()
    else setInternalExpanded((prev) => !prev)
  }

  const canPlaceOrder = totalCount > 0 && !placing

  async function handlePlaceOrder() {
    if (!canPlaceOrder) return

    try {
      await onPlaceOrder()
    } catch (error) {
      console.error('Failed to place order:', error)
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-line bg-panel px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.45)]">

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
            <div className="mb-3 max-h-52 space-y-2 overflow-y-auto pr-1">
              {totalCount === 0 ? (
                <p className="rounded-xl bg-panel-light px-3 py-4 text-center text-sm text-cream/50">
                  Your order is empty. Add something tasty from the menu!
                </p>
              ) : (
                lines.map(({ item, quantity, lineTotal }) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 rounded-xl bg-panel-light p-2"
                  >
                    <FadeImage
                      src={item.image}
                      alt={item.name}
                      className="h-11 w-11 shrink-0 rounded-lg"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-cream">
                        {item.name}
                      </p>

                      <p className="text-xs text-cream/50">
                        {lineTotal} DH
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove one ${item.name}`}
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
                        aria-label={`Add another ${item.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-cream"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
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

          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-maroon-bright px-1 text-[10px] font-semibold">
            {totalCount}
          </span>
        </span>

        <span className="flex-1 text-left">
          <span className="block text-sm font-semibold text-cream">
            Your order
          </span>

          <span className="block text-xs text-cream/50">
            {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </span>
        </span>

        <span className="text-sm font-semibold text-cream">
          {totalPrice} DH
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
        {placing ? 'PLEASE WAIT…' : placeLabel}
      </button>
    </div>
  )
}