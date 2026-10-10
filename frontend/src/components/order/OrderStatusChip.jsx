import { useOrder } from '../../context/OrderContext'
import { useCart } from '../../context/CartContext'

export default function OrderStatusChip() {
  const { order, trackingVisible, showTracking } = useOrder()
  const { totalCount } = useCart()

  if (!order || trackingVisible) return null

  const label = order.status === 'ready' ? 'Order ready!' : 'Order in progress'
  // Sit above the cart bar when it's visible, otherwise just above the
  // bottom edge of the screen.
  const bottomClass = totalCount > 0 ? 'bottom-24' : 'bottom-6'

  return (
    <button
      type="button"
      onClick={showTracking}
      className={`absolute ${bottomClass} left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-ink shadow-lg`}
    >
      {label} &middot; view status
    </button>
  )
}
