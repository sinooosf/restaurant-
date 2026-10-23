import { Ban, RefreshCw, Sparkles, WifiOff } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

// Shown for a moment while we ask the server whether a scanned table exists
// (only when it isn't in the list loaded at startup).
export function TableChecking() {
  const { t } = useLanguage()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-cream">
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-cream/15 border-t-maroon-bright" />
      <p className="font-display text-xl">{t('table.opening')}</p>
      <p className="max-w-xs text-sm text-cream/50">
        {t('table.openingText')}
      </p>
    </div>
  )
}

// Shown when the server could not be reached at all. Deliberately NOT the
// "Table not found" screen: the table is probably fine, the connection isn't.
export function TableOffline({ onRetry }) {
  const { t } = useLanguage()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-cream">
      <WifiOff size={34} className="text-maroon-bright" />
      <p className="font-display text-xl">{t('table.offline')}</p>
      <p className="max-w-xs text-sm text-cream/55">
        {t('table.offlineText')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-maroon-bright"
      >
        <RefreshCw size={15} /> {t('table.retry')}
      </button>
    </div>
  )
}

// Shown instead of the menu when staff marked the table as "cleaning" or "out
// of service" on the dashboard. It opens the menu by itself as soon as the
// table is open again (useTableId keeps asking the server).
export function TableClosed({ reason, tableLabel, onRetry }) {
  const { t } = useLanguage()
  const cleaning = reason === 'cleaning'
  const Icon = cleaning ? Sparkles : Ban

  return (
    <div role="status" className="flex h-full flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-cream">
      <span
        className={`flex h-20 w-20 items-center justify-center rounded-full border-2 ${
          cleaning ? 'border-amber-400/60 bg-amber-400/10 text-amber-300' : 'border-red-500/60 bg-red-500/10 text-red-300'
        }`}
      >
        <Icon size={34} />
      </span>
      <p className="text-xs uppercase tracking-wide text-cream/50">{tableLabel}</p>
      <p className="font-display text-2xl">{cleaning ? t('table.cleaning') : t('table.outOfService')}</p>
      <p className="max-w-xs text-sm leading-relaxed text-cream/60">
        {cleaning ? t('table.cleaningText') : t('table.outOfServiceText')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-cream/80 transition hover:bg-panel-light"
      >
        <RefreshCw size={15} /> {t('table.checkAgain')}
      </button>
    </div>
  )
}
