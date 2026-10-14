import { Link } from 'react-router-dom'
import { HOME_TABLE_ID, VALID_TABLE_IDS } from '../data/tables'
import { useLanguage } from '../i18n/LanguageContext'

export default function TableNotFound() {
  const { t } = useLanguage()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-cream">
      <p className="font-display text-2xl">{t('table.notFound')}</p>
      <p className="max-w-xs text-sm text-cream/60">
        {t('table.notFoundText')}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {VALID_TABLE_IDS.filter((id) => id !== HOME_TABLE_ID).map((id) => (
          <Link
            key={id}
            to={`/table/${id}`}
            className="rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-cream"
          >
            {t('common.table', { id })}
          </Link>
        ))}
      </div>
    </div>
  )
}
