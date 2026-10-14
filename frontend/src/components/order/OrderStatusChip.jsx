import { AnimatePresence, motion } from 'framer-motion'
import { useOrder } from '../../context/OrderContext'
import { useLanguage } from '../../i18n/LanguageContext'

export default function OrderStatusChip() {
  const { order, trackingVisible, showTracking } = useOrder()
  const { t } = useLanguage()

  // Only shown while the customer has an order but the status screen is hidden.
  const show = Boolean(order) && !trackingVisible

  const label =
    order?.status === 'ready' ? t('order.chipReady') : t('order.chipProgress')

  // The cart bar is always at the bottom of the screen, so this button
  // sits just above it.
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          key="status-chip"
          type="button"
          onClick={showTracking}
          initial={{ opacity: 0, y: 16, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.92 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-40 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-ink shadow-lg"
        >
          {label} &middot; {t('order.viewStatus')}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
