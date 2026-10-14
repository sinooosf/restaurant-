
import { Utensils } from 'lucide-react'
import MenuItemCard from './MenuItemCard'
 
// Local animation for the shine that sweeps across the MENU badge.
const STYLES = `
@keyframes menu-shine {
  0%, 60% { transform: translateX(-160%) skewX(-20deg); }
  100%    { transform: translateX(420%) skewX(-20deg); }
}
@keyframes menu-pulse {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}
.menu-shine { animation: menu-shine 4s ease-in-out infinite; }
@keyframes menu-rise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: none; }
}
.menu-pulse { animation: menu-pulse 2.6s ease-in-out infinite; }
.menu-rise  { animation: menu-rise 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
`
 
// `resetKey` changes whenever another category is chosen. It makes the list
// start again from the very top (and replay the fade-in) every time.
// `bottomInset` is the height of the cart bar that floats over the bottom of
// the screen. The list keeps that much room (plus a comfortable gap) below its
// last row, so the final dishes can always be scrolled fully into view
// without ever sliding under the bar.
export default function MenuSection({ items, resetKey, bottomInset = 150 }) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-ink px-4">
      <style>{STYLES}</style>
 
      {/* MENU stays completely fixed */}
      <div className="shrink-0 bg-ink py-3 short:py-1.5">
        <div className="flex items-center gap-3">
          {/* Left line + diamond */}
          <div className="flex flex-1 items-center">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-maroon-bright/70" />
            <span className="menu-pulse ml-1 h-1.5 w-1.5 rotate-45 bg-maroon-bright" />
          </div>
 
          {/* Badge: gradient border + glow */}
          <div className="rounded-full bg-gradient-to-r from-maroon-bright via-cream/70 to-maroon-bright p-[1.5px] shadow-[0_0_24px_rgba(179,24,28,0.45)]">
            <div className="relative flex items-center gap-2.5 overflow-hidden rounded-full bg-ink px-5 py-1.5">
              {/* Light sweep */}
              <div className="menu-shine pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
 
              {/* Soft inner glow */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-maroon/25 to-transparent" />
 
              <Utensils
                size={15}
                className="relative text-maroon-bright"
              />
 
              <h2 className="relative font-display text-2xl leading-none tracking-[0.3em] text-cream">
                MENU
              </h2>
 
              <span className="relative rounded-full bg-maroon px-2 py-0.5 text-[10px] font-semibold text-cream">
                {items.length}
              </span>
            </div>
          </div>
 
          {/* Right diamond + line */}
          <div className="flex flex-1 items-center">
            <span className="menu-pulse mr-1 h-1.5 w-1.5 rotate-45 bg-maroon-bright" />
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-maroon-bright/70" />
          </div>
        </div>
      </div>
 
      {/* ONLY THIS PART SCROLLS */}
      <div
        key={resetKey}
        className="min-h-0 flex-1 overflow-y-auto pt-4 short:pt-2"
        style={{ paddingBottom: bottomInset + 28 }}
      >
        {items.length === 0 ? (
          <p className="mt-10 text-center text-sm text-cream/50">
            No dishes match that search.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="menu-rise"
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              >
                <MenuItemCard item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
 
