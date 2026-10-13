import { useEffect, useRef, useState } from 'react'

// An image that stays invisible until it is COMPLETELY loaded, then fades in.
// No more pictures that appear 20% ... 50% ... 100% from the top.
// While waiting, a soft pulsing placeholder fills the space.
//
// The wrapper takes the size/shape classes (for example "h-11 w-11 rounded-lg"
// or "absolute inset-0"). The picture always fills the wrapper.
export default function FadeImage({
  src,
  alt = '',
  className = '',
  imgClassName = 'object-cover',
}) {
  const [loaded, setLoaded] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    setLoaded(false)

    const img = ref.current

    // Already in the browser cache (we preload everything): show right away.
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [src])

  // BUG FIX: this wrapper used to ALWAYS add the "relative" class. When a
  // caller passed "absolute inset-0" (the menu cards do), "relative" won the
  // CSS fight, the wrapper collapsed to zero height, and the picture was
  // there but invisible. Only add "relative" when the caller didn't choose
  // a position themselves.
  const positioned = /(^|\s)(absolute|fixed|relative|sticky)(\s|$)/.test(className)

  return (
    <div className={`${positioned ? '' : 'relative'} overflow-hidden ${className}`}>
      {/* Placeholder */}
      <div
        className={`absolute inset-0 bg-white/[0.06] transition-opacity duration-500 ${
          loaded ? 'opacity-0' : 'animate-pulse opacity-100'
        }`}
      />

      <img
        ref={ref}
        src={src}
        alt={alt}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ease-out ${imgClassName} ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
