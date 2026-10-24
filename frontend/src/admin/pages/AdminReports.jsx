import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  ChartColumn,
  CircleDollarSign,
  ClipboardList,
  Clock,
  Crown,
  UsersRound,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import { adminFetchReport } from '../../services/api'
import { useLanguage } from '../../i18n/LanguageContext'
import ReportsChart from '../components/ReportsChart'
import { Card, CardTitle, ErrorBanner, PageTop, Spinner, StatCard } from '../components/ui'
import { dayLabel, dayRange, hourLabelLong, percentChange } from '../components/format'

const POLL_MS = 30000
const MAX_CUSTOM_DAYS = 366
const PRESETS = ['today', 'yesterday', 'week', 'last30', 'month', 'lastmonth', 'custom']

const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
const daysIn = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1

// Why the chosen custom dates cannot be used yet, as a translation key (or null).
export function customProblem(from, to) {
  if (!isDay(from) || !isDay(to)) return 'admin.reports.pickDates'
  if (from > to) return 'admin.reports.badOrder'
  if (daysIn(from, to) > MAX_CUSTOM_DAYS) return 'admin.reports.tooLong'
  return null
}

export default function AdminReports() {
  const { password } = useAdminAuth()
  const { t } = useLanguage()

  const [range, setRange] = useState('week')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [metric, setMetric] = useState('revenue')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const problem = range === 'custom' ? customProblem(from, to) : null

  useEffect(() => {
    if (problem) return undefined

    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const result = await adminFetchReport(password, { range, from, to })
        if (cancelled) return
        setData(result)
        setError('')
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [password, range, from, to, problem])

  function choose(next) {
    // "Choose dates" starts from the period that is on screen.
    if (next === 'custom' && !from && data) {
      setFrom(data.from)
      setTo(data.to)
    }
    setRange(next)
  }

  const today = data?.today

  return (
    <div className="space-y-6">
      <PageTop
        icon={<ChartColumn size={34} className="text-[#f0222c]" />}
        title={t('admin.reports.title')}
        subtitle={t('admin.reports.subtitle')}
        showBell={false}
      />

      <ErrorBanner message={error} onClose={() => setError('')} />

      {/* Period picker */}
      <div className="space-y-3">
        <div
          role="group"
          aria-label={t('admin.reports.rangeAria')}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
        >
          {PRESETS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={(event) => {
                // On a phone the row scrolls sideways: keep the chosen chip in view.
                event.currentTarget.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                choose(key)
              }}
              aria-pressed={range === key}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition sm:px-5 ${
                range === key ? 'bg-[#e11d28] text-white' : 'bg-white/[0.06] text-white/75 hover:bg-white/[0.11]'
              }`}
            >
              {key === 'custom' && <Calendar size={15} />}
              {t(`admin.reports.range.${key}`)}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-white/55">{t('admin.reports.from')}</span>
              <input
                type="date"
                value={from}
                max={to || today}
                onChange={(e) => setFrom(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="input h-11 w-[170px]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-white/55">{t('admin.reports.to')}</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="input h-11 w-[170px]"
              />
            </label>
            {problem && (
              <p role="alert" className="pb-3 text-sm text-amber-300">{t(problem)}</p>
            )}
          </div>
        )}
      </div>

      {!data ? (
        <div className="flex justify-center py-32">
          {problem ? null : <Spinner className="h-8 w-8" />}
        </div>
      ) : (
        <div aria-busy={loading} className={`space-y-6 transition-opacity ${loading || problem ? 'opacity-60' : ''}`}>
          <Content data={data} metric={metric} setMetric={setMetric} />
        </div>
      )}
    </div>
  )
}

function Content({ data, metric, setMetric }) {
  const { t, lang, formatMoney, itemName } = useLanguage()
  const { current, previous, series, bestSellers, granularity } = data
  const hourly = granularity === 'hour'

  // The best day (or, for a single day, the busiest hour).
  const peak = useMemo(() => {
    const top = series.reduce((best, row) => (row.revenue > (best?.revenue ?? 0) ? row : best), null)
    return top && top.revenue > 0 ? top : null
  }, [series])

  const maxSold = Math.max(1, ...bestSellers.map((b) => b.quantity))
  const hasSales = current.orders > 0

  return (
    <>
      <p className="-mt-2 text-sm text-white/50">
        {dayRange(data.from, data.to, lang)}
        <span className="mx-2 text-white/25">·</span>
        {t('admin.reports.compared', { range: dayRange(data.previousFrom, data.previousTo, lang) })}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<ClipboardList size={26} />}
          tone="red"
          label={t('admin.reports.orders')}
          value={current.orders}
          delta={percentChange(current.orders, previous.orders)}
          sub={current.cancelled > 0 ? t('admin.reports.cancelled', { count: current.cancelled }) : undefined}
        />
        <StatCard
          icon={<CircleDollarSign size={28} />}
          tone="green"
          label={t('admin.reports.sales')}
          value={formatMoney(current.revenue)}
          delta={percentChange(current.revenue, previous.revenue)}
        />
        <StatCard
          icon={<UsersRound size={26} />}
          tone="blue"
          label={t('admin.reports.avgOrder')}
          value={formatMoney(current.avg)}
          delta={percentChange(current.avg, previous.avg)}
        />
        <StatCard
          icon={hourly ? <Clock size={26} /> : <Crown size={26} />}
          tone="purple"
          label={hourly ? t('admin.reports.busiestHour') : t('admin.reports.bestDay')}
          value={
            <span className="text-[22px]">
              {peak ? (hourly ? hourLabelLong(peak.key, lang) : dayLabel(peak.key, lang)) : '—'}
            </span>
          }
          sub={peak ? formatMoney(peak.revenue) : undefined}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        {/* Chart */}
        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <CardTitle
              icon={<ChartColumn size={26} />}
              title={t('admin.reports.chartTitle')}
              subtitle={hourly ? t('admin.reports.chartSubHour') : t('admin.reports.chartSubDay')}
            />

            <div className="flex overflow-hidden rounded-full bg-white/[0.05] p-0.5">
              {[
                ['revenue', t('admin.reports.sales')],
                ['orders', t('admin.reports.orders')],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetric(key)}
                  aria-pressed={metric === key}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition sm:px-5 ${
                    metric === key ? 'bg-[#d9151f] text-white' : 'text-white/55 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <ReportsChart points={series} metric={metric} granularity={granularity} today={data.today} />
          </div>

          {!hasSales && <p className="mt-2 text-center text-sm text-white/40">{t('admin.reports.noSales')}</p>}
        </Card>

        {/* Best sellers */}
        <Card className="min-w-0 p-4 sm:p-6">
          <CardTitle
            icon={<Crown size={24} />}
            title={t('admin.reports.bestTitle')}
            subtitle={t('admin.reports.bestSub')}
          />

          {bestSellers.length === 0 ? (
            <p className="py-16 text-center text-sm text-white/40">{t('admin.reports.noSales')}</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {bestSellers.map((dish, index) => (
                <li key={dish.id} className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      index === 0 ? 'bg-[#d9151f] text-white' : 'bg-white/[0.07] text-white/70'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium text-white">{itemName(dish)}</span>
                      <span className="shrink-0 text-sm font-semibold text-white">{formatMoney(dish.revenue)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className={`h-full rounded-full ${index === 0 ? 'bg-[#f0222c]' : 'bg-[#a3101a]'}`}
                          style={{ width: `${Math.max(4, (dish.quantity / maxSold) * 100)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-white/55">{t('admin.reports.sold', { count: dish.quantity })}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  )
}
