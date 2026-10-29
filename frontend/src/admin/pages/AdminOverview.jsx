import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Armchair,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  List,
  Star,
  UsersRound,
  XCircle,
  Hourglass,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import { adminFetchOverview } from '../../services/api'
import { useLanguage } from '../../i18n/LanguageContext'
import SalesChart from '../components/SalesChart'
import {
  Card,
  CardTitle,
  Dropdown,
  ErrorBanner,
  OrderExtras,
  PageTop,
  Spinner,
  StatCard,
  StatusBadge,
  TablePill,
  VibesCard,
} from '../components/ui'
import { clockTime, itemsSummary, money, orderNumber, percentChange } from '../components/format'

const POLL_MS = 10000

export default function AdminOverview() {
  const { password } = useAdminAuth()
  const [range, setRange] = useState('today')
  const [metric, setMetric] = useState('orders')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const { t } = useLanguage()

  useEffect(() => {
    let cancelled = false
    setData(null)

    async function load() {
      try {
        const result = await adminFetchOverview(password, range)
        if (!cancelled) {
          setData(result)
          setError('')
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [password, range])

  const isToday = range === 'today'
  const vs = isToday ? t('admin.overview.vsYesterday') : t('admin.overview.vsDayBefore')

  return (
    <div className="space-y-6">
      <PageTop
        title={t('admin.overview.title')}
        subtitle={isToday ? t('admin.overview.subtitleToday') : t('admin.overview.subtitleYesterday')}
        range={range}
        onRange={setRange}
        showBell={false}
      />

      <ErrorBanner message={error} onClose={() => setError('')} />

      {!data ? (
        <div className="flex justify-center py-32">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <Content data={data} metric={metric} setMetric={setMetric} range={range} setRange={setRange} vs={vs} isToday={isToday} />
      )}
    </div>
  )
}

function Content({ data, metric, setMetric, range, setRange, vs, isToday }) {
  const { current, previous, popular, quick, recent } = data
  const { t, lang, formatMoney, tableLabel, itemName } = useLanguage()

  const totalForBars = Math.max(1, quick.pending + quick.completed + quick.cancelled)

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          icon={<ClipboardList size={26} />}
          tone="red"
          label={t('admin.overview.totalOrders')}
          value={current.orders}
          delta={percentChange(current.orders, previous.orders)}
          sub={vs}
        />
        <StatCard
          icon={<CircleDollarSign size={28} />}
          tone="green"
          label={t('admin.overview.moneyMade')}
          value={formatMoney(current.revenue)}
          delta={percentChange(current.revenue, previous.revenue)}
          sub={vs}
        />
        <StatCard
          icon={<UsersRound size={26} />}
          tone="blue"
          label={t('admin.overview.avgOrder')}
          value={formatMoney(current.avg)}
          delta={percentChange(current.avg, previous.avg)}
          sub={vs}
        />
        <StatCard
          icon={<Star size={26} fill="currentColor" />}
          tone="purple"
          label={t('admin.overview.popular')}
          value={<span className="text-[22px]">{popular ? itemName(popular) : '—'}</span>}
          sub={popular ? t('admin.overview.orderCount', { count: popular.orders }) : t('admin.overview.noOrdersYet')}
        />
      </div>

      {/* Chart */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <CardTitle
            icon={<ChartNoAxesCombined size={26} />}
            title={t('admin.overview.salesTitle')}
            subtitle={isToday ? t('admin.overview.salesSubToday') : t('admin.overview.salesSubYesterday')}
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-full bg-white/[0.05] p-0.5">
              {[
                ['orders', t('admin.overview.metricOrders')],
                ['revenue', t('admin.overview.metricRevenue')],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetric(key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition sm:px-5 ${
                    metric === key ? 'bg-[#d9151f] text-white' : 'text-white/55 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Dropdown
              value={range}
              onChange={setRange}
              options={[
                { value: 'today', label: t('admin.common.today') },
                { value: 'yesterday', label: t('admin.common.yesterday') },
              ]}
              className="w-[130px]"
            />
          </div>
        </div>

        <div className="mt-4">
          <SalesChart
            current={data.hourly.current}
            previous={data.hourly.previous}
            metric={metric}
            isToday={isToday}
            nowHour={data.nowHour}
            currentLabel={isToday ? t('admin.common.today') : t('admin.common.yesterday')}
            previousLabel={isToday ? t('admin.common.yesterday') : t('admin.common.dayBefore')}
          />
        </div>
      </Card>

      {/* Bottom row */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card className="min-w-0 p-4 sm:p-6">
          <CardTitle
            icon={<List size={24} />}
            title={t('admin.overview.recentOrders')}
            action={
              <Link to="/admin/orders" className="text-sm font-medium text-[#f0222c] hover:text-[#ff5a63]">
                {t('admin.overview.viewAll')}
              </Link>
            }
          />

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-start text-sm">
              <thead>
                <tr className="text-[13px] text-white/50">
                  {['#', t('admin.overview.colTable'), t('admin.overview.colItems'), t('admin.overview.colTotal'), t('admin.overview.colTime'), t('admin.overview.colStatus')].map((h) => (
                    <th key={h} className="pb-3 pe-3 text-start font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-white/40">{t('admin.overview.noOrdersYet')}</td>
                  </tr>
                )}
                {recent.map((order) => (
                  <tr key={order.id} className="border-t border-white/[0.06] text-white/90">
                    <td className="py-3 pe-3 font-medium">#{orderNumber(order)}</td>
                    <td className="py-3 pe-3 text-white/70">
                      {tableLabel(order.tableId)}
                    </td>
                    <td className="max-w-[260px] py-3 pe-3 text-white/80">
                      <p className="truncate">{itemsSummary(order, 2, lang)}</p>
                      <OrderExtras order={order} className="mt-1" />
                    </td>
                    <td className="py-3 pe-3">{formatMoney(order.total)}</td>
                    <td className="py-3 pe-3 text-white/70">{clockTime(order.createdAt, lang)}</td>
                    <td className="py-3"><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <CardTitle icon={<ChartNoAxesCombined size={24} />} title={t('admin.overview.quickStats')} />

          <div className="mt-6 space-y-5">
            <QuickRow
              icon={<Armchair size={20} />}
              tint="bg-[#3a0d12] text-[#ff4650]"
              label={t('admin.overview.activeTables')}
              value={`${quick.activeTables} / ${quick.totalTables}`}
              pct={quick.totalTables ? (quick.activeTables / quick.totalTables) * 100 : 0}
              bar="bg-[#f0222c]"
            />
            <QuickRow
              icon={<Hourglass size={20} />}
              tint="bg-[#3b2a0e] text-amber-400"
              label={t('admin.overview.pendingOrders')}
              value={quick.pending}
              pct={(quick.pending / totalForBars) * 100}
              bar="bg-amber-500"
            />
            <QuickRow
              icon={<ClipboardCheck size={20} />}
              tint="bg-[#0d3324] text-emerald-400"
              label={t('admin.overview.completedToday')}
              value={quick.completed}
              pct={(quick.completed / totalForBars) * 100}
              bar="bg-emerald-500"
            />
            <QuickRow
              icon={<XCircle size={20} />}
              tint="bg-[#3a0d12] text-[#ff4650]"
              label={t('admin.overview.cancelledOrders')}
              value={quick.cancelled}
              pct={(quick.cancelled / totalForBars) * 100}
              bar="bg-[#f0222c]"
            />
          </div>
        </Card>

        <VibesCard className="min-h-[300px]" />
      </div>
    </>
  )
}

function QuickRow({ icon, tint, label, value, pct, bar }) {
  return (
    <div className="flex items-center gap-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/85">{label}</span>
          <span dir="ltr" className="font-semibold text-white">{value}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(pct, value ? 4 : 0))}%` }} />
        </div>
      </div>
    </div>
  )
}
