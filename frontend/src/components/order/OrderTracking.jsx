import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { useOrder } from '../../context/OrderContext'
import { useLanguage } from '../../i18n/LanguageContext'

const STAGE_KEYS = {
  preparing: 'order.stage.preparing',
  almost: 'order.stage.almost',
  ready: 'order.stage.ready',
}

export default function OrderTracking() {
  const {
    order,
    stages,
    trackingVisible,
    hideTracking,
    cancel,
    finishOrder,
  } = useOrder()

  // The sheet gets everything through props (not from the context) so it
  // can still draw itself correctly while it slides away.
  return (
    <AnimatePresence>
      {order && trackingVisible && (
        <TrackingSheet
          key="tracking"
          order={order}
          stages={stages}
          hideTracking={hideTracking}
          cancel={cancel}
          finishOrder={finishOrder}
        />
      )}
    </AnimatePresence>
  )
}

function TrackingSheet({
  order,
  stages,
  hideTracking,
  cancel,
  finishOrder,
}) {
  const { t, formatMoney, itemName, tableLabel } = useLanguage()
  const isCancelled = order.status === 'cancelled'
  // "completed" is the staff closing a ready order — to the customer it is still "ready".
  const isReady = order.status === 'ready' || order.status === 'completed'
  const isFinished = isCancelled || isReady

  const stageIndex = isReady ? stages.length - 1 : stages.indexOf(order.status)

  const fillPercent =
    stageIndex <= 0
      ? 0
      : (stageIndex / (stages.length - 1)) * 100

  // Only Preparing allows cancelling or adding more.
  const canModifyOrder = order.status === 'preparing'

  const subtitle = isCancelled
    ? t('order.sub.cancelled')
    : isReady
      ? t('order.sub.ready')
      : t('order.sub.progress')

  const title = isCancelled
    ? t('order.title.cancelled')
    : isReady
      ? t('order.title.ready')
      : order.status === 'almost'
        ? t('order.title.almost')
        : t('order.title.progress')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
    >
      <motion.div
        initial={{ y: 70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 70, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-t-3xl bg-panel p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:rounded-3xl"
      >

        {/* Header */}
        <p className="text-center text-xs uppercase tracking-wide text-cream/50">
          {tableLabel(order.tableId)} &middot; {subtitle}
        </p>

        <h2 className="mt-1 text-center font-display text-xl text-cream">
          {title}
        </h2>

        {/* ------------------------------------------------------------- */}
        {/* PROGRESS (or the cancelled message) */}
        {/* ------------------------------------------------------------- */}

        {isCancelled ? (
          <div className="mt-6 flex flex-col items-center gap-3 px-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-500/60 bg-red-500/10 text-red-300">
              <X size={22} />
            </div>

            <p className="text-sm leading-relaxed text-cream/60">
              {t('order.cancelledText')}
            </p>
          </div>
        ) : (
          <div className="relative mt-8 px-2">

            {/* The line runs from the middle of the first circle to the middle of
                the last one. Three equal columns keep the circles in the same
                places whatever the language (French labels are longer). */}
            <div className="absolute inset-x-[16.667%] top-3 h-1 rounded-full bg-line">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${fillPercent}%` }}
              />
            </div>

            <div className="relative grid grid-cols-3">
              {stages.map((stage, index) => {
                const reached = index <= stageIndex

                return (
                  <div
                    key={stage}
                    className="flex min-w-0 flex-col items-center gap-2"
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors ${
                        reached
                          ? 'border-emerald-500 bg-emerald-500 text-ink'
                          : 'border-line bg-panel text-cream/40'
                      }`}
                    >
                      {reached ? (
                        <Check size={14} />
                      ) : (
                        index + 1
                      )}
                    </div>

                    <span
                      className={`text-center text-[11px] leading-tight ${
                        reached
                          ? 'text-cream'
                          : 'text-cream/40'
                      }`}
                    >
                      {t(STAGE_KEYS[stage])}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* ORDER ITEMS */}
        {/* ------------------------------------------------------------- */}

        <div
          className={`mt-7 max-h-44 space-y-1.5 overflow-y-auto rounded-2xl bg-panel-light p-3 ${
            isCancelled ? 'opacity-60' : ''
          }`}
        >
          {order.items.map((line, index) => (
            <div
              key={`${line.id}-${index}`}
              className="flex justify-between gap-3 text-sm text-cream/80"
            >
              <span className="truncate">
                {line.quantity} &times; {itemName(line)}
              </span>

              <span className="shrink-0">
                {formatMoney(line.unitPrice * line.quantity)}
              </span>
            </div>
          ))}

          <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-semibold text-cream">
            <span>{t('order.total')}</span>
            <span>{formatMoney(order.total)}</span>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* ACTIONS */}
        {/* ------------------------------------------------------------- */}

        {isFinished ? (
          // Ready or Cancelled: the customer closes it themselves.
          <div className="mt-5">
            <button
              type="button"
              onClick={finishOrder}
              className="w-full rounded-full bg-maroon py-3 text-sm font-semibold text-cream transition hover:bg-maroon-bright"
            >
              {isReady ? t('order.done') : t('order.close')}
            </button>
          </div>
        ) : (
          <div className="mt-5 flex gap-3">

            {/* CANCEL */}
            <button
              type="button"
              onClick={cancel}
              disabled={!canModifyOrder}
              className={`flex-1 rounded-full border py-3 text-sm font-semibold transition ${
                canModifyOrder
                  ? 'border-line text-cream/70 hover:bg-panel-light'
                  : 'cursor-not-allowed border-line/50 text-cream/20'
              }`}
            >
              {t('order.cancel')}
            </button>

            {/* ADD MORE */}
            <button
              type="button"
              onClick={hideTracking}
              disabled={!canModifyOrder}
              className={`flex-1 rounded-full py-3 text-sm font-semibold transition ${
                canModifyOrder
                  ? 'bg-maroon text-cream hover:bg-maroon-bright'
                  : 'cursor-not-allowed bg-ink text-cream/20'
              }`}
            >
              {t('order.addMore')}
            </button>

          </div>
        )}

      </motion.div>
    </motion.div>
  )
}
