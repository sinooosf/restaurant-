import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { dayLabel, dayLabelLong, hourLabel, hourLabelLong, money } from './format'

// A hand-drawn SVG bar chart (no chart library), in the same look as the
// Overview chart: one bar per day (or per hour when the report covers a single
// day), the best bar highlighted, and a tooltip that follows the pointer.
// The drawing is as wide as its card (1 unit = 1 screen pixel) so a phone
// shows the whole period without sideways scrolling.

const MIN_W = 280
const COMPACT_BELOW = 560
const PAD_WIDE = { left: 50, right: 14, top: 18, bottom: 38 }
const PAD_COMPACT = { left: 40, right: 10, top: 16, bottom: 34 }

function niceStep(rough) {
  if (rough <= 1) return 1
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

export default function ReportsChart({ points, metric = 'revenue', granularity = 'day', today }) {
  const { t, lang, isRTL } = useLanguage()
  const [width, setWidth] = useState(720)
  const [hover, setHover] = useState(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined

    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setWidth(w)
    }
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const W = Math.max(MIN_W, width)
  const compact = W < COMPACT_BELOW
  const H = compact ? 260 : 320
  const PAD = compact ? PAD_COMPACT : PAD_WIDE
  const PLOT_W = W - PAD.left - PAD.right
  const PLOT_H = H - PAD.top - PAD.bottom
  const fontSize = compact ? 11 : 13
  const baseline = PAD.top + PLOT_H

  const model = useMemo(() => {
    // For one day the quiet night hours would be empty space: show the hours
    // from the first to the last one with sales, at least 9 AM – 10 PM.
    let rows = points
    if (granularity === 'hour') {
      let from = 9
      let to = 22
      for (const row of points) {
        if (row[metric] > 0) {
          from = Math.min(from, row.key)
          to = Math.max(to, row.key)
        }
      }
      rows = points.filter((row) => row.key >= from && row.key <= to)
    }

    const max = Math.max(1, ...rows.map((row) => row[metric]))
    const step = niceStep(max / 4)
    const top = Math.max(step * Math.ceil(max / step), step)
    const ticks = []
    for (let v = 0; v <= top; v += step) ticks.push(v)

    const slot = PLOT_W / Math.max(1, rows.length)
    const barW = Math.max(1, Math.min(slot * 0.72, 46))
    const peak = rows.reduce((best, row, i) => (row[metric] > (rows[best]?.[metric] ?? -1) ? i : best), 0)

    return { rows, top, ticks, slot, barW, peak }
  }, [points, metric, granularity, PLOT_W])

  const { rows, top, ticks, slot, barW, peak } = model
  const y = (v) => PAD.top + PLOT_H - (v / top) * PLOT_H
  const cx = (i) => PAD.left + slot * i + slot / 2
  // Label only as many bars as fit without touching (every day for a week,
  // every few days for a month).
  const labelEvery = Math.max(1, Math.ceil(56 / slot))

  const labelOf = (row) => (granularity === 'hour' ? hourLabel(row.key, lang) : dayLabel(row.key, lang))
  const longLabelOf = (row) => (granularity === 'hour' ? hourLabelLong(row.key, lang) : dayLabelLong(row.key, lang))
  const fmt = (v) => (metric === 'revenue' ? money(v, lang) : v)

  function handleMove(event) {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box || box.width === 0 || rows.length === 0) return
    const svgX = ((event.clientX - box.left) / box.width) * W
    const index = Math.floor((svgX - PAD.left) / slot)
    setHover(Math.min(Math.max(index, 0), rows.length - 1))
  }

  const hovered = hover !== null ? rows[hover] : null

  return (
    <div
      ref={wrapRef}
      dir="ltr"
      className="relative w-full"
      onPointerMove={handleMove}
      onPointerDown={handleMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" role="img" aria-label={t('admin.reports.chartAria')}>
        <defs>
          <linearGradient id="report-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0222c" />
            <stop offset="1" stopColor="#a3101a" />
          </linearGradient>
        </defs>

        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#ffffff" strokeOpacity={v === 0 ? 0.18 : 0.06} />
            <text x={PAD.left - 10} y={y(v) + 4} textAnchor="end" fontSize={fontSize} fill="#ffffff" fillOpacity="0.7">
              {metric === 'revenue' && v >= 1000 ? `${v / 1000}k` : v}
            </text>
          </g>
        ))}

        {rows.map((row, i) => {
          const value = row[metric]
          const h = Math.max(value > 0 ? 2 : 0, (value / top) * PLOT_H)
          const isHover = hover === i
          return (
            <g key={row.key}>
              {value > 0 && (
                <rect
                  x={cx(i) - barW / 2}
                  y={baseline - h}
                  width={barW}
                  height={h}
                  rx={Math.min(4, barW / 2)}
                  fill="url(#report-bar)"
                  opacity={isHover || i === peak ? 1 : 0.62}
                />
              )}
              {/* A small dot marks "no sales" so an empty day is not mistaken for missing data. */}
              {value === 0 && <circle cx={cx(i)} cy={baseline - 2} r={Math.min(2, barW / 2)} fill="#ffffff" fillOpacity="0.25" />}
              {granularity === 'day' && row.key === today && (
                <rect x={cx(i) - slot / 2 + 1} y={PAD.top} width={slot - 2} height={PLOT_H} fill="#ffffff" fillOpacity="0.035" />
              )}
              {i % labelEvery === 0 && (
                <text x={cx(i)} y={H - 10} textAnchor="middle" fontSize={fontSize} fill="#ffffff" fillOpacity="0.7">
                  {labelOf(row)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hovered && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="pointer-events-none absolute z-10 min-w-[132px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#17171b]/95 px-3.5 py-2.5 text-xs shadow-xl shadow-black/50"
          style={{
            left: `${(Math.min(Math.max(cx(hover), 76), W - 76) / W) * 100}%`,
            top: `calc(${(Math.min(y(hovered[metric]), baseline - 6) / H) * 100}% - 74px)`,
          }}
        >
          <p className="mb-1.5 text-white/70">{longLabelOf(hovered)}</p>
          <p className="text-white">
            <span className="me-2 inline-block h-2 w-2 rounded-full bg-[#f0222c]" />
            {t('admin.reports.sales')}: {money(hovered.revenue, lang)}
          </p>
          <p className="mt-1 text-white/80">
            <span className="me-2 inline-block h-2 w-2 rounded-full bg-[#8d8d96]" />
            {t('admin.reports.orders')}: {hovered.orders}
          </p>
        </div>
      )}
    </div>
  )
}
