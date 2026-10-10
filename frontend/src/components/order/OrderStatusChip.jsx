import { useOrder } from '../../context/OrderContext'

export default function OrderStatusChip() {
  const { order, trackingVisible, showTracking } = useOrder()

  if (!order || trackingVisible) return null

  const label = order.status === 'ready' ? 'Order ready!' : 'Order in progress'
  // The cart bar is always at the bottom of the screen, so this button
  // sits just above it.
  const bottomClass = 'bottom-40'

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