import { useEffect, useRef, useState } from 'react'
import { getItemsForCategory } from '../../data/menu'
import FadeImage from '../ui/FadeImage'

// All animations live here so you don't need to touch index.css.
// (Your index.css already shortens animations for people who
// prefer reduced motion, so this stays accessible.)
const STYLES = `
@keyframes cat-rise {
  from { opacity: 0; transform: translateY(16px) scale(0.94); }
  to   { opacity: 1; transform: none; }
}
@keyframes cat-float {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50%      { transform: translateY(-5px) rotate(3deg); }
}
@keyframes cat-spin {
  to { transform: rotate(360deg); }
}
@keyframes cat-glow {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50%      { opacity: 1;    transform: scale(1.25); }
}
@keyframes cat-shine {
  0%, 55%  { transform: translateX(-140%) skewX(-20deg); }
  100%     { transform: translateX(300%) skewX(-20deg); }
}
.cat-rise  { animation: cat-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
.cat-float { animation: cat-float 3.2s ease-in-out infinite; }
.cat-spin  { animation: cat-spin 9s linear infinite; }
.cat-glow  { animation: cat-glow 2.4s ease-in-out infinite; }
.cat-shine { animation: cat-shine 3.6s ease-in-out infinite; }
`

export default function CategoryList({
  categories,
  activeCategoryId,
  onSelect,
}) {
  const scrollRef = useRef(null)
  const itemRefs = useRef({})
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollIndicators = () => {
    const el = scrollRef.current
    if (!el) return

    setCanScrollLeft(el.scrollLeft > 5)
    setCanScrollRight(
      el.scrollLeft + el.clientWidth < el.scrollWidth - 5
    )
  }

  useEffect(() => {
    updateScrollIndicators()

    const el = scrollRef.current
    if (!el) return

    el.addEventListener('scroll', updateScrollIndicators)
    window.addEventListener('resize', updateScrollIndicators)

    return () => {
      el.removeEventListener('scroll', updateScrollIndicators)
      window.removeEventListener('resize', updateScrollIndicators)
    }
  }, [categories])

  // Keep the selected category centered in the row.
  useEffect(() => {
    const container = scrollRef.current
    const node = itemRefs.current[activeCategoryId]
    if (!container || !node) return

    const target =
      node.offsetLeft - container.clientWidth / 2 + node.clientWidth / 2

    container.scrollTo({ left: target, behavior: 'smooth' })
  }, [activeCategoryId])

  return (
    <section className="px-4 pt-4 short:pt-1">
      <style>{STYLES}</style>

      {/* Section heading */}
      <div className="mb-2 text-center short:hidden">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-maroon-bright">
          Browse
        </p>

        <h2 className="font-display text-2xl leading-none text-cream">
          Categories
        </h2>

        <div className="mx-auto mt-2 h-[3px] w-12 rounded-full bg-gradient-to-r from-transparent via-maroon-bright to-transparent" />
      </div>

      {/* Categories wrapper */}
      <div className="relative -mx-4">
        {/* Left fade */}
        <div
          className={`pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-10 bg-gradient-to-r from-ink via-ink/70 to-transparent transition-opacity duration-300 ${
            canScrollLeft ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Right fade */}
        <div
          className={`pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-10 bg-gradient-to-l from-ink via-ink/70 to-transparent transition-opacity duration-300 ${
            canScrollRight ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Scrollable categories */}
        <div
          ref={scrollRef}
          className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-4 pt-3 short:gap-2 short:pb-2 short:pt-2"
        >
          {categories.map((category, index) => {
            const isActive = category.id === activeCategoryId
            const count = getItemsForCategory(category.id).length

            return (
              <button
                key={category.id}
                ref={(node) => {
                  itemRefs.current[category.id] = node
                }}
                type="button"
                onClick={() => onSelect(category.id)}
                aria-pressed={isActive}
                style={{ animationDelay: `${index * 70}ms` }}
                className={`cat-rise group relative h-[122px] w-[98px] short:h-[92px] short:w-[80px] shrink-0 overflow-hidden rounded-3xl border transition-all duration-500 active:scale-95 ${
                  isActive
                    ? 'scale-105 border-maroon-bright bg-gradient-to-b from-maroon-bright via-maroon to-maroon-soft shadow-[0_0_28px_rgba(179,24,28,0.6)]'
                    : 'border-line bg-panel hover:-translate-y-1 hover:border-maroon-bright/60 hover:shadow-[0_0_18px_rgba(179,24,28,0.3)]'
                }`}
              >
                {/* Light sweep across the active card */}
                {isActive && (
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-transparent via-white/25 to-transparent cat-shine" />
                )}

                {/* Pulsing glow behind the image */}
                <div
                  className={`pointer-events-none absolute left-1/2 top-[34px] h-16 w-16 short:top-[26px] short:h-11 short:w-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-maroon-bright blur-xl transition-opacity duration-500 ${
                    isActive
                      ? 'cat-glow opacity-100'
                      : 'opacity-0 group-hover:opacity-60'
                  }`}
                />

                {/* Image + spinning ring */}
                <div className="relative z-10 mx-auto mt-2.5 h-[62px] w-[62px] short:mt-2 short:h-[42px] short:w-[42px]">
                  {isActive && (
                    <div className="cat-spin absolute -inset-[5px] rounded-full border-2 border-dashed border-cream/70" />
                  )}

                  <div
                    className={`h-full w-full overflow-hidden rounded-full border-2 bg-panel transition-all duration-500 ${
                      isActive
                        ? 'cat-float border-cream/80'
                        : 'border-line brightness-75 group-hover:scale-110 group-hover:brightness-100'
                    }`}
                  >
                    <FadeImage
                      src={category.image}
                      alt={category.name}
                      className="h-full w-full"
                    />
                  </div>
                </div>

                {/* Name + count */}
                <div className="relative z-10 mt-2 px-2 text-center short:mt-1.5">
                  <p
                    className={`truncate font-display text-[15px] short:text-[13px] uppercase leading-tight tracking-wide transition-colors ${
                      isActive
                        ? 'text-cream'
                        : 'text-cream/70 group-hover:text-cream'
                    }`}
                  >
                    {category.name}
                  </p>

                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-[2px] text-[9px] short:hidden font-semibold transition-colors ${
                      isActive
                        ? 'bg-ink/40 text-cream'
                        : 'bg-white/5 text-cream/40'
                    }`}
                  >
                    {count} {count === 1 ? 'dish' : 'dishes'}
                  </span>
                </div>

                {/* Bottom indicator bar */}
                <div
                  className={`absolute bottom-0 left-1/2 h-[3px] -translate-x-1/2 rounded-full bg-cream transition-all duration-500 ${
                    isActive ? 'w-10 opacity-100' : 'w-0 opacity-0'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}