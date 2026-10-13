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
import SalesChart from '../components/SalesChart'
import {
  Card,
  CardTitle,
  Dropdown,
  ErrorBanner,
  PageTop,
  Spinner,
  StatCard,
  StatusBadge,
  TablePill,
  VibesCard,
} from '../components/ui'
import { clockTime, itemsSummary, money, percentChange } from '../components/format'

const POLL_MS = 10000

export default function AdminOverview() {
  const { password } = useAdminAuth()
  const [range, setRange] = useState('today')
  const [metric, setMetric] = useState('orders')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

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
  const vs = isToday ? 'vs. yesterday' : 'vs. day before'

  return (
    <div className="space-y-6">
      <PageTop
        title="Overview"
        subtitle={isToday ? "Here's what's happening at your restaurant today." : "Here's how your restaurant did yesterday."}
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

  const totalForBars = Math.max(1, quick.pending + quick.completed + quick.cancelled)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<ClipboardList size={26} />}
          tone="red"
          label="Total Orders"
          value={current.orders}
          delta={percentChange(current.orders, previous.orders)}
          sub={vs}
        />
        <StatCard
          icon={<CircleDollarSign size={28} />}
          tone="green"
          label="Money Made"
          value={money(current.revenue)}
          delta={percentChange(current.revenue, previous.revenue)}
          sub={vs}
        />
        <StatCard
          icon={<UsersRound size={26} />}
          tone="blue"
          label="Avg. Order Value"
          value={money(current.avg)}
          delta={percentChange(current.avg, previous.avg)}
          sub={vs}
        />
        <StatCard
          icon={<Star size={26} fill="currentColor" />}
          tone="purple"
          label="Most Popular Item"
          value={<span className="text-[22px]">{popular ? popular.name : '—'}</span>}
          sub={popular ? `${popular.orders} order${popular.orders === 1 ? '' : 's'}` : 'No orders yet'}
        />
      </div>

      {/* Chart */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <CardTitle
            icon={<ChartNoAxesCombined size={26} />}
            title="Sales & Orders Overview"
            subtitle={isToday ? "Today's performance compared to the previous day." : "Yesterday's performance compared to the day before."}
          />

          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded-full bg-white/[0.05] p-0.5">
              {[
                ['orders', 'Orders'],
                ['revenue', 'Revenue'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetric(key)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition ${
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
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
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
            currentLabel={isToday ? 'Today' : 'Yesterday'}
            previousLabel={isToday ? 'Yesterday' : 'Day before'}
          />
        </div>
      </Card>

      {/* Bottom row */}
      <div className="grid gap-4 xl:grid-cols-[1.9fr_1fr_0.95fr]">
        <Card className="p-6">
          <CardTitle
            icon={<List size={24} />}
            title="Recent Orders"
            action={
              <Link to="/admin/orders" className="text-sm font-medium text-[#f0222c] hover:text-[#ff5a63]">
                View all →
              </Link>
            }
          />

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-[13px] text-white/50">
                  {['#', 'Table', 'Items', 'Total', 'Time', 'Status'].map((h) => (
                    <th key={h} className="pb-3 pr-3 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-white/40">No orders yet.</td>
                  </tr>
                )}
                {recent.map((order) => (
                  <tr key={order.id} className="border-t border-white/[0.06] text-white/90">
                    <td className="py-3 pr-3 font-medium">#{order.id}</td>
                    <td className="py-3 pr-3 text-white/70">
                      {order.tableId === 'home' ? 'To Home' : `Table ${order.tableId}`}
                    </td>
                    <td className="max-w-[170px] truncate py-3 pr-3 text-white/80">{itemsSummary(order)}</td>
                    <td className="py-3 pr-3">{money(order.total)}</td>
                    <td className="py-3 pr-3 text-white/70">{clockTime(order.createdAt)}</td>
                    <td className="py-3"><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <CardTitle icon={<ChartNoAxesCombined size={24} />} title="Quick Stats" />

          <div className="mt-6 space-y-5">
            <QuickRow
              icon={<Armchair size={20} />}
              tint="bg-[#3a0d12] text-[#ff4650]"
              label="Active Tables"
              value={`${quick.activeTables} / ${quick.totalTables}`}
              pct={quick.totalTables ? (quick.activeTables / quick.totalTables) * 100 : 0}
              bar="bg-[#f0222c]"
            />
            <QuickRow
              icon={<Hourglass size={20} />}
              tint="bg-[#3b2a0e] text-amber-400"
              label="Pending Orders"
              value={quick.pending}
              pct={(quick.pending / totalForBars) * 100}
              bar="bg-amber-500"
            />
            <QuickRow
              icon={<ClipboardCheck size={20} />}
              tint="bg-[#0d3324] text-emerald-400"
              label="Completed Today"
              value={quick.completed}
              pct={(quick.completed / totalForBars) * 100}
              bar="bg-emerald-500"
            />
            <QuickRow
              icon={<XCircle size={20} />}
              tint="bg-[#3a0d12] text-[#ff4650]"
              label="Cancelled Orders"
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
          <span className="font-semibold text-white">{value}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(pct, value ? 4 : 0))}%` }} />
        </div>
      </div>
    </div>
  )
}
