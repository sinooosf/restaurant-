import { BellRing, Check, LoaderCircle } from 'lucide-react'
import { useWaiter } from '../../context/WaiterContext'
import { useLanguage } from '../../i18n/LanguageContext'

// One button, two looks:
//   variant="floating"  a bright pill that stays on the menu screen
//   variant="inline"    a full-width row inside the order status sheet
export default function CallWaiterButton({ variant = 'floating', style, className = '' }) {
  const { available, status, call } = useWaiter()
  const { t } = useLanguage()

  if (!available) return null

  const busy = status === 'sending'
  const waiting = status === 'waiting'
  const answered = status === 'answered'
  const failed = status === 'error'

  const label = busy
    ? t('waiter.calling')
    : waiting
      ? t('waiter.waiting')
      : answered
        ? t('waiter.came')
        : failed
          ? t('waiter.retry')
          : t('waiter.call')

  const icon = busy ? (
    <LoaderCircle size={18} className="animate-spin" />
  ) : answered ? (
    <Check size={18} />
  ) : (
    <BellRing size={18} className={status === 'idle' ? 'animate-[wiggle_2.4s_ease-in-out_infinite] motion-reduce:animate-none' : ''} />
  )

  const colors = answered
    ? 'bg-emerald-500 text-ink'
    : waiting || busy
      ? 'bg-panel-light text-cream ring-1 ring-cream/25'
      : failed
        ? 'bg-red-600 text-cream'
        : 'bg-maroon-bright text-cream hover:bg-maroon'

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={call}
        disabled={busy || waiting}
        aria-live="polite"
        className={`flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition disabled:cursor-default ${colors} ${className}`}
      >
        {icon}
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={call}
      disabled={busy || waiting}
      aria-live="polite"
      style={style}
      className={`absolute end-3 z-[35] flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-[0_6px_20px_rgba(0,0,0,0.55)] transition disabled:cursor-default ${colors} ${className}`}
    >
      {icon}
      {label}
    </button>
  )
}
