import { RefreshCw, WifiOff } from 'lucide-react'
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
