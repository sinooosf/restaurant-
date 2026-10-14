import { useMemo, useRef, useState } from 'react'
import { useLanguage } from '../../i18n/LanguageContext'
import { hourLabel, hourLabelLong, money } from './format'

// A hand-drawn SVG area chart (no chart library): today's line in red with a
// soft fill, the previous day dashed in gray, and a tooltip that follows the
// mouse — the same look as the design.

const W = 1000
const H = 330
const PAD = { left: 46, right: 22, top: 22, bottom: 38 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const OPEN_FROM = 9 // 9 AM
const OPEN_TO = 22 // 10 PM

function niceStep(rough) {
  if (rough <= 1) return 1
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

// Smooth curve through the points that never dips below the baseline.
function smoothPath(points) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2

    const clamp = (y) => Math.min(Math.max(y, PAD.top), PAD.top + PLOT_H)
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6)
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6)

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

export default function SalesChart({
  current,
  previous,
  metric = 'orders',
  isToday = true,
  nowHour = 23,
  currentLabel,
  previousLabel,
}) {
  const { t, lang, isRTL } = useLanguage()
  currentLabel = currentLabel ?? t('admin.common.today')
  previousLabel = previousLabel ?? t('admin.common.yesterday')
  const [hover, setHover] = useState(null)
  const wrapRef = useRef(null)

  const model = useMemo(() => {
    const value = (row) => (row ? row[metric] || 0 : 0)

    // Show 9 AM – 10 PM, widened if there were orders outside those hours.
    let from = OPEN_FROM
    let to = OPEN_TO
    for (const row of [...current, ...previous]) {
      if (value(row) > 0) {
        from = Math.min(from, row.hour)
        to = Math.max(to, row.hour)
      }
    }
    const hours = []
    for (let h = from; h <= to; h += 1) hours.push(h)

    const max = Math.max(1, ...hours.map((h) => Math.max(value(current[h]), value(previous[h]))))
    const step = niceStep(max / 4)
    const top = Math.max(step * Math.ceil(max / step), step)
    const ticks = []
    for (let t = 0; t <= top; t += step) ticks.push(t)

    const x = (index) => PAD.left + (hours.length === 1 ? PLOT_W / 2 : (index / (hours.length - 1)) * PLOT_W)
    const y = (v) => PAD.top + PLOT_H - (v / top) * PLOT_H

    const lastCurrent = isToday ? hours.filter((h) => h <= nowHour).length : hours.length
    const currentPoints = hours
      .slice(0, lastCurrent)
      .map((h, i) => ({ x: x(i), y: y(value(current[h])), v: value(current[h]), hour: h }))
    const previousPoints = hours.map((h, i) => ({ x: x(i), y: y(value(previous[h])), v: value(previous[h]), hour: h }))

    return { hours, ticks, top, x, y, currentPoints, previousPoints }
  }, [current, previous, metric, isToday, nowHour])

  const { hours, ticks, currentPoints, previousPoints, y } = model
  const baseline = PAD.top + PLOT_H

  const linePath = smoothPath(currentPoints)
  const areaPath =
    currentPoints.length > 1
      ? `${linePath} L ${currentPoints[currentPoints.length - 1].x} ${baseline} L ${currentPoints[0].x} ${baseline} Z`
      : ''

  function handleMove(event) {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return

    const svgX = ((event.clientX - box.left) / box.width) * W
    const raw = ((svgX - PAD.left) / PLOT_W) * (hours.length - 1)
    const index = Math.min(Math.max(Math.round(raw), 0), hours.length - 1)
    setHover(index)
  }

  const fmt = (v) => (metric === 'revenue' ? money(v, lang) : v)

  const hoverHour = hover === null ? null : hours[hover]
  const hoverCurrent = hover === null ? null : currentPoints[hover]
  const hoverPrevious = hover === null ? null : previousPoints[hover]
  const hoverX = hover === null ? 0 : model.x(hover)
  const tipTop = hover === null ? 0 : Math.min(hoverCurrent?.y ?? hoverPrevious.y, hoverPrevious.y)

  return (
    <div>
      {/* The plotted area always runs left to right; only the text is translated. */}
      <div
        ref={wrapRef}
        dir="ltr"
        className="relative"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none" role="img" aria-label={t('admin.ui.salesChart')}>
          <defs>
            <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f0222c" stopOpacity="0.42" />
              <stop offset="1" stopColor="#f0222c" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid + y labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#ffffff" strokeOpacity={t === 0 ? 0.18 : 0.06} />
              <text x={PAD.left - 12} y={y(t) + 4} textAnchor="end" fontSize="13" fill="#ffffff" fillOpacity="0.7">
                {metric === 'revenue' && t >= 1000 ? `${t / 1000}k` : t}
              </text>
            </g>
          ))}

          {/* x labels */}
          {hours.map((h, i) => (
            <text
              key={h}
              x={model.x(i)}
              y={H - 10}
              textAnchor="middle"
              fontSize="13"
              fill="#ffffff"
              fillOpacity="0.7"
              className={hours.length > 14 && i % 2 === 1 ? 'hidden' : ''}
            >
              {hourLabel(h, lang)}
            </text>
          ))}

          {/* Previous day */}
          <path d={smoothPath(previousPoints)} fill="none" stroke="#8d8d96" strokeWidth="2" strokeDasharray="6 6" />
          {previousPoints.map((p) => (
            <circle key={p.hour} cx={p.x} cy={p.y} r="2.6" fill="#8d8d96" />
          ))}

          {/* Today */}
          {areaPath && <path d={areaPath} fill="url(#sales-fill)" />}
          <path
            d={linePath}
            fill="none"
            stroke="#f0222c"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 8px rgba(240,34,44,0.55))' }}
          />
          {currentPoints.map((p) => (
            <circle key={p.hour} cx={p.x} cy={p.y} r="3" fill="#f0222c" />
          ))}

          {/* Hover guide */}
          {hover !== null && (
            <g>
              <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={baseline} stroke="#ffffff" strokeOpacity="0.35" strokeDasharray="4 4" />
              <circle cx={hoverX} cy={hoverPrevious.y} r="5.5" fill="#c9c9d0" stroke="#0f0f12" strokeWidth="2" />
              {hoverCurrent && (
                <circle cx={hoverX} cy={hoverCurrent.y} r="5.5" fill="#f0222c" stroke="#0f0f12" strokeWidth="2" />
              )}
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            className="pointer-events-none absolute z-10 min-w-[128px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#17171b]/95 px-3.5 py-2.5 text-xs shadow-xl shadow-black/50"
            style={{
              left: `${(hoverX / W) * 100}%`,
              top: `calc(${(tipTop / H) * 100}% - 78px)`,
            }}
          >
            <p className="mb-1.5 text-white/70">{hourLabelLong(hoverHour, lang)}</p>
            {hoverCurrent && (
              <p className="flex items-center gap-2 text-white">
                <span className="h-2 w-2 rounded-full bg-[#f0222c]" />
                {currentLabel}: {fmt(hoverCurrent.v)}
              </p>
            )}
            <p className="mt-1 flex items-center gap-2 text-white/80">
              <span className="h-2 w-2 rounded-full bg-[#8d8d96]" />
              {previousLabel}: {fmt(hoverPrevious.v)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-6 ps-2 text-[13px] text-white/75">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f0222c]" />
          {currentLabel}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#8d8d96]" />
          {previousLabel}
        </span>
      </div>
    </div>
  )
}
