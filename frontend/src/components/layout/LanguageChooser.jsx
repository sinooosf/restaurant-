import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { LANGUAGES, directionOf, translate } from '../../i18n/translate'

// "Choose your language" — shown right after the intro, before the menu.
// Three hexagon flags (English, French, and Arabic shown with the Saudi Arabia flag). Tapping one previews the
// screen's own text in that language; "Continue" applies it for the whole
// ordering session (Arabic also flips the layout right-to-left).
// The grid itself stays left-to-right on purpose so the hexagons do not jump
// around while the customer is choosing.

const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

function UnionJack() {
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <clipPath id="flag-uk-s"><path d="M0,0 v30 h60 v-30 z" /></clipPath>
      <clipPath id="flag-uk-t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      <g clipPath="url(#flag-uk-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#flag-uk-t)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  )
}

function FrenchFlag() {
  return (
    <svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <rect width="1" height="2" fill="#0055A4" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#EF4135" />
    </svg>
  )
}

// The flag of Saudi Arabia, from the picture supplied by the restaurant
// (public/flags/sa.jpg, already cropped to fit inside the hexagon).
function SaudiFlag() {
  return (
    <img
      src="/flags/sa.jpg"
      alt="Saudi Arabia"
      draggable="false"
      className="h-full w-full object-cover"
    />
  )
}

const FLAGS = { en: UnionJack, fr: FrenchFlag, ar: SaudiFlag }

export default function LanguageChooser({ onContinue }) {
  const [selected, setSelected] = useState('en')
  const textDir = directionOf(selected)
  const tr = (key) => translate(selected, key)

  return (
    <div
      dir="ltr"
      className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-ink px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-16 text-cream"
    >
      <div className="text-center" dir={textDir}>
        <h1 className="font-display text-3xl leading-tight">{tr('lang.title')}</h1>
        <p className="mx-auto mt-2 max-w-[17rem] text-sm text-cream/55">{tr('lang.subtitle')}</p>
        <div className="mx-auto mt-4 h-[3px] w-12 rounded-full bg-gradient-to-r from-transparent via-maroon-bright to-transparent" />
      </div>

      <div className="flex max-w-[20rem] flex-wrap items-start justify-center gap-x-10 gap-y-6" role="radiogroup">
        {LANGUAGES.map((language, index) => {
          const Flag = FLAGS[language.code]
          const active = selected === language.code

          return (
            <motion.button
              key={language.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(language.code)}
              initial={{ opacity: 0, y: 18, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, delay: 0.08 * index, ease: [0.22, 1, 0.36, 1] }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2.5"
            >
              <span
                className={`relative block h-[116px] w-[100px] transition-transform duration-300 ${
                  active ? 'scale-110 drop-shadow-[0_0_18px_rgba(179,24,28,0.75)]' : 'opacity-80'
                }`}
              >
                {/* hexagon border (shows only when selected) */}
                <span
                  className={`absolute inset-0 transition-colors duration-300 ${
                    active ? 'bg-maroon-bright' : 'bg-line'
                  }`}
                  style={{ clipPath: HEX }}
                />
                <span className="absolute inset-[3px] overflow-hidden bg-panel" style={{ clipPath: HEX }}>
                  <Flag />
                </span>

                {active && (
                  <span className="absolute -right-0.5 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-cream text-maroon shadow">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </span>

              <span className={`text-sm font-medium ${active ? 'text-cream' : 'text-cream/60'}`}>
                {language.name}
              </span>
            </motion.button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => onContinue(selected)}
        dir={textDir}
        className="w-full rounded-full bg-gradient-to-r from-maroon to-maroon-bright py-4 font-display text-lg tracking-wide text-cream shadow-[0_10px_30px_rgba(179,24,28,0.4)] transition active:scale-[0.98]"
      >
        {tr('lang.continue')}
      </button>
    </div>
  )
}
