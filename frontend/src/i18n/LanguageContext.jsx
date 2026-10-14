// ---------------------------------------------------------------------------
// The current language for the whole app.
//
//   const { t, lang, setLang, isRTL, formatMoney, itemName } = useLanguage()
//
// Two "scopes" use it separately:
//   customer  (the QR menu)  - starts in English, the customer picks a
//                              language on the "Choose language" screen.
//   admin     (the dashboard) - starts in English the first time, then
//                              REMEMBERS the choice in this browser
//                              (localStorage) until it is changed again.
//
// Arabic flips the whole page right-to-left: we set dir="rtl" on <html>
// and the layouts use direction-aware classes (ms-/me-, start-/end-, rtl:).
// ---------------------------------------------------------------------------
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  directionOf,
  formatMoney as formatMoneyIn,
  formatTime as formatTimeIn,
  isSupported,
  localeOf,
  tableLabelFor,
  translate,
} from './translate'
import { categoryDescription, categoryName, itemName } from './menuText'

const STORAGE_KEYS = {
  admin: 'meetthechefs.admin.language',
}

function readStored(scope) {
  const key = STORAGE_KEYS[scope]
  if (!key) return DEFAULT_LANGUAGE
  try {
    const saved = window.localStorage.getItem(key)
    return isSupported(saved) ? saved : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

function buildValue(lang, setLang) {
  const dir = directionOf(lang)
  return {
    lang,
    setLang,
    dir,
    isRTL: dir === 'rtl',
    locale: localeOf(lang),
    languages: LANGUAGES,
    t: (key, params) => translate(lang, key, params),
    formatMoney: (value) => formatMoneyIn(lang, value),
    formatTime: (date) => formatTimeIn(lang, date),
    tableLabel: (tableId) => tableLabelFor(lang, tableId),
    itemName: (item) => itemName(item, lang),
    categoryName: (category) => categoryName(category, lang),
    categoryDescription: (category) => categoryDescription(category, lang),
  }
}

// Without a provider (small unit tests) everything simply works in English.
const LanguageContext = createContext(buildValue(DEFAULT_LANGUAGE, () => {}))

export function LanguageProvider({ scope = 'customer', children }) {
  const [lang, setLangState] = useState(() => readStored(scope))

  const setLang = useCallback(
    (next) => {
      if (!isSupported(next)) return
      setLangState(next)

      const key = STORAGE_KEYS[scope]
      if (key) {
        try {
          window.localStorage.setItem(key, next)
        } catch {
          // storage blocked: the choice still works until the page closes
        }
      }
    },
    [scope]
  )

  // Tell the browser the page language and direction (this is what flips
  // everything to right-to-left for Arabic).
  useLayoutEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = directionOf(lang)

    return () => {
      root.lang = DEFAULT_LANGUAGE
      root.dir = 'ltr'
    }
  }, [lang])

  const value = useMemo(() => buildValue(lang, setLang), [lang, setLang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
