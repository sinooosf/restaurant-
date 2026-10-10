import { Check } from 'lucide-react'
import { useOrder } from '../../context/OrderContext'

const STAGE_LABELS = {
  preparing: 'Preparing',
  almost: 'Almost done',
  ready: 'Ready',
}

export default function OrderTracking() {
  const {
    order,
    stages,
    trackingVisible,
    hideTracking,
    cancel,
  } = useOrder()

  if (!order || !trackingVisible) {
    return null
  }

  const stageIndex = stages.indexOf(order.status)

  const fillPercent =
    stageIndex <= 0
      ? 0
      : (stageIndex / (stages.length - 1)) * 100

  // Only Preparing allows cancelling or adding more.
  const canModifyOrder = order.status === 'preparing'

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-sm rounded-t-3xl bg-panel p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:rounded-3xl">

        {/* Header */}
        <p className="text-center text-xs uppercase tracking-wide text-cream/50">
          Table {order.tableId} &middot; Order in progress
        </p>

        <h2 className="mt-1 text-center font-display text-xl text-cream">
          {order.status === 'ready'
            ? "It's ready!"
            : order.status === 'almost'
              ? 'Almost done!'
              : 'Your food is on the way'}
        </h2>

        {/* ------------------------------------------------------------- */}
        {/* PROGRESS */}
        {/* ------------------------------------------------------------- */}

        <div className="relative mt-8 px-2">

          <div className="absolute left-2 right-2 top-3 h-1 rounded-full bg-line" />

          <div
            className="absolute left-2 top-3 h-1 rounded-full bg-emerald-500 transition-all duration-700"
            style={{
              width: `calc(${fillPercent}% * (100% - 1rem) / 100%)`,
            }}
          />

          <div className="relative flex justify-between">
            {stages.map((stage, index) => {
              const reached = index <= stageIndex

              return (
                <div
                  key={stage}
                  className="flex flex-col items-center gap-2"
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
                    className={`text-[11px] ${
                      reached
                        ? 'text-cream'
                        : 'text-cream/40'
                    }`}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* ORDER ITEMS */}
        {/* ------------------------------------------------------------- */}

        <div className="mt-7 space-y-1.5 rounded-2xl bg-panel-light p-3">
          {order.items.map((line) => (
            <div
              key={line.id}
              className="flex justify-between gap-3 text-sm text-cream/80"
            >
              <span className="truncate">
                {line.quantity} &times; {line.name}
              </span>

              <span className="shrink-0">
                {line.unitPrice * line.quantity} DH
              </span>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* ACTIONS */}
        {/* ------------------------------------------------------------- */}

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
            Cancel order
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
            Add more
          </button>

        </div>

      </div>
    </div>
  )
}