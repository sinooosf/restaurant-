import { useEffect, useRef, useState } from 'react'

const INTRO_DURATION_MS = 3000

// Plays /intro.mp4 for up to 3 seconds before handing off to the app.
// There's no real video in this project yet (drop one at
// `public/intro.mp4` any time — same file name, this component picks it
// up automatically), so until then the animated logo underneath acts as
// the intro on its own. The 3-second timer always fires regardless of
// whether the video file exists, is shorter, or is longer.
export default function IntroSplash({ onFinish }) {
  const [videoFailed, setVideoFailed] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    timeoutRef.current = setTimeout(onFinish, INTRO_DURATION_MS)
    return () => clearTimeout(timeoutRef.current)
  }, [onFinish])

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-ink">
      {!videoFailed && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/intro.mp4"
          autoPlay
          muted
          playsInline
          onEnded={onFinish}
          onError={() => setVideoFailed(true)}
        />
      )}
    </div>
  )
}
