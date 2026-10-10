import { useEffect, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Receipt,
  TrendingUp,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import { adminFetchEarningsToday } from '../../services/api'

export default function AdminOverview() {
  const { password } = useAdminAuth()
  const [earnings, setEarnings] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    adminFetchEarningsToday(password)
      .then((data) => {
        if (!cancelled) setEarnings(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [password])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-maroon-bright">
            Analytics
          </p>

          <h1 className="mt-1 font-display text-3xl font-semibold text-cream">
            Today
          </h1>

          <p className="mt-1 text-sm text-cream/40">
            Your restaurant performance for today.
          </p>
        </div>

        <div className="text-xs text-cream/30">
          Resets automatically at midnight
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Main analytics */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

        <AnalyticsCard
          icon={DollarSign}
          label="Earnings"
          value={earnings ? `${formatNumber(earnings.total)} DA` : '…'}
          change="+12.5%"
          positive
          chart="earnings"
        />

        <AnalyticsCard
          icon={Receipt}
          label="Orders"
          value={earnings ? formatNumber(earnings.orderCount) : '…'}
          change="+8.2%"
          positive
          chart="orders"
        />

      </div>

      {/* Activity */}
      <div className="rounded-3xl border border-line bg-panel p-5 sm:p-6">

        <div className="flex items-start justify-between">

          <div>
            <p className="text-sm font-medium text-cream">
              Today's activity
            </p>

            <p className="mt-1 text-xs text-cream/35">
              Revenue and order activity throughout the day
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-line bg-panel-light px-3 py-1.5 text-xs text-cream/40">
            <span className="h-1.5 w-1.5 rounded-full bg-maroon-bright" />
            Today
          </div>

        </div>

        <ActivityChart />

      </div>
    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* ANALYTICS CARD                                                             */
/* -------------------------------------------------------------------------- */

function AnalyticsCard({
  icon: Icon,
  label,
  value,
  change,
  positive,
  chart,
}) {
  return (
    <div className="group overflow-hidden rounded-3xl border border-line bg-panel">

      <div className="flex min-h-[250px] flex-col justify-between p-5">

        {/* Top */}
        <div className="flex items-start justify-between">

          <div>
            <div className="flex items-center gap-2 text-sm text-cream/45">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-maroon/80">
                <Icon
                  size={15}
                  className="text-cream"
                />
              </div>

              {label}
            </div>

            <p className="mt-4 font-display text-3xl font-semibold tracking-tight text-cream">
              {value}
            </p>

            <div className="mt-2 flex items-center gap-2">

              <span
                className={`flex items-center gap-1 text-xs font-medium ${
                  positive
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {positive ? (
                  <ArrowUpRight size={13} />
                ) : (
                  <ArrowDownRight size={13} />
                )}

                {change}
              </span>

              <span className="text-xs text-cream/25">
                vs yesterday
              </span>

            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-cream/20">
            <TrendingUp size={12} />
            Live
          </div>

        </div>

        {/* Chart */}
        <MiniChart type={chart} />

      </div>
    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* MINI CHART                                                                 */
/* -------------------------------------------------------------------------- */

function MiniChart({ type }) {
  const earningsPoints =
    '0,105 35,96 70,110 105,82 140,90 175,62 210,70 245,46 280,57 315,34 350,42 385,20'

  const orderPoints =
    '0,115 35,108 70,112 105,94 140,101 175,75 210,84 245,62 280,69 315,45 350,53 385,30'

  const points =
    type === 'earnings'
      ? earningsPoints
      : orderPoints

  return (
    <div className="relative mt-6 h-[105px] overflow-hidden">

      {/* Horizontal grid */}
      <div className="absolute inset-x-0 top-0 border-t border-line/60" />
      <div className="absolute inset-x-0 top-1/4 border-t border-line/40" />
      <div className="absolute inset-x-0 top-1/2 border-t border-line/40" />
      <div className="absolute inset-x-0 top-3/4 border-t border-line/40" />
      <div className="absolute inset-x-0 bottom-0 border-t border-line/60" />

      {/* Gradient area */}
      <svg
        viewBox="0 0 385 125"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient
            id={`gradient-${type}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#E50914"
              stopOpacity="0.28"
            />

            <stop
              offset="100%"
              stopColor="#E50914"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        <polygon
          points={`${points} 385,125 0,125`}
          fill={`url(#gradient-${type})`}
        />

        {/* Main line */}
        <polyline
          points={points}
          fill="none"
          stroke="#E50914"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End point */}
        <circle
          cx="385"
          cy={type === 'earnings' ? '20' : '30'}
          r="4"
          fill="#E50914"
        />

        <circle
          cx="385"
          cy={type === 'earnings' ? '20' : '30'}
          r="8"
          fill="#E50914"
          opacity="0.15"
        />
      </svg>

      {/* Time labels */}
      <div className="absolute inset-x-0 bottom-0 flex justify-between pt-2 text-[9px] text-cream/20">
        <span>08:00</span>
        <span>10:00</span>
        <span>12:00</span>
        <span>14:00</span>
        <span>16:00</span>
        <span>18:00</span>
        <span>20:00</span>
      </div>

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* FULL ACTIVITY CHART                                                        */
/* -------------------------------------------------------------------------- */

function ActivityChart() {
  const points =
    '0,180 45,164 90,172 135,142 180,151 225,119 270,132 315,92 360,104 405,67 450,82 495,50 540,62 585,32 630,44 675,18'

  return (
    <div className="mt-8">

      <div className="relative h-[280px] w-full">

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 flex h-full flex-col justify-between pb-7 text-[10px] text-cream/20">
          <span>High</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>Low</span>
        </div>

        {/* Chart area */}
        <div className="absolute inset-y-0 left-10 right-0">

          {/* Grid */}
          <div className="absolute inset-x-0 top-0 border-t border-line/60" />
          <div className="absolute inset-x-0 top-1/4 border-t border-line/40" />
          <div className="absolute inset-x-0 top-1/2 border-t border-line/40" />
          <div className="absolute inset-x-0 top-3/4 border-t border-line/40" />
          <div className="absolute inset-x-0 bottom-7 border-t border-line/60" />

          {/* Vertical guides */}
          <div className="absolute inset-y-0 left-1/6 border-l border-line/20" />
          <div className="absolute inset-y-0 left-2/6 border-l border-line/20" />
          <div className="absolute inset-y-0 left-3/6 border-l border-line/20" />
          <div className="absolute inset-y-0 left-4/6 border-l border-line/20" />
          <div className="absolute inset-y-0 left-5/6 border-l border-line/20" />

          <svg
            viewBox="0 0 675 210"
            preserveAspectRatio="none"
            className="absolute inset-x-0 top-0 h-[calc(100%-28px)] w-full"
          >
            <defs>
              <linearGradient
                id="activity-fill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#E50914"
                  stopOpacity="0.22"
                />

                <stop
                  offset="100%"
                  stopColor="#E50914"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <polygon
              points={`${points} 675,210 0,210`}
              fill="url(#activity-fill)"
            />

            <polyline
              points={points}
              fill="none"
              stroke="#E50914"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <circle
              cx="675"
              cy="18"
              r="4"
              fill="#E50914"
            />

            <circle
              cx="675"
              cy="18"
              r="9"
              fill="#E50914"
              opacity="0.12"
            />
          </svg>

          {/* X-axis */}
          <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-cream/20">
            <span>08:00</span>
            <span>10:00</span>
            <span>12:00</span>
            <span>14:00</span>
            <span>16:00</span>
            <span>18:00</span>
            <span>20:00</span>
            <span>22:00</span>
          </div>

        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">

        <div className="flex items-center gap-2 text-xs text-cream/35">
          <span className="h-2 w-2 rounded-full bg-maroon-bright" />
          Restaurant activity
        </div>

        <p className="text-xs text-cream/20">
          Updated automatically
        </p>

      </div>
    </div>
  )
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('fr-DZ')
}