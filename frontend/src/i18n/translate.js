// ---------------------------------------------------------------------------
// The translation engine (no React in here, so plain .js files such as the
// chatbot logic can use it too).
//
//   translate('fr', 'cart.title')                      -> "Votre commande"
//   translate('en', 'common.items', { count: 3 })      -> "3 items"
//   translate('ar', 'greeting', { name: 'Sara' })      -> replaces {name}
//
// Plurals: when `count` is passed, "key_one", "key_two", "key_few",
// "key_many", "key_other" are tried (Intl.PluralRules decides which one
// fits the language), then "key_other", then plain "key".
// A missing translation falls back to English, then to the key itself, so
// a forgotten string never breaks a page.
// ---------------------------------------------------------------------------
import { DICTIONARIES } from './locales'

export const LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr', locale: 'en-US' },
  { code: 'fr', name: 'Français', dir: 'ltr', locale: 'fr-FR' },
  // "-u-nu-latn" keeps normal digits (0-9) in Arabic, like the prices on the menu.
  { code: 'ar', name: 'العربية', dir: 'rtl', locale: 'ar-u-nu-latn' },
]

export const DEFAULT_LANGUAGE = 'en'

export const isSupported = (code) => LANGUAGES.some((language) => language.code === code)

export const languageInfo = (code) =>
  LANGUAGES.find((language) => language.code === code) || LANGUAGES[0]

export const directionOf = (code) => languageInfo(code).dir
export const localeOf = (code) => languageInfo(code).locale

function find(code, key, count) {
  const dict = DICTIONARIES[code]
  if (!dict) return undefined

  if (typeof count === 'number') {
    let category = 'other'
    try {
      category = new Intl.PluralRules(code).select(count)
    } catch {
      // unknown locale: use "other"
    }
    return dict[`${key}_${category}`] ?? dict[`${key}_other`] ?? dict[key]
  }

  return dict[key]
}

export function translate(code, key, params) {
  let text = find(code, key, params?.count)
  if (text === undefined && code !== DEFAULT_LANGUAGE) {
    text = find(DEFAULT_LANGUAGE, key, params?.count)
  }
  if (text === undefined) return key

  if (params) {
    text = text.replace(/\{(\w+)\}/g, (whole, name) =>
      params[name] === undefined ? whole : String(params[name])
    )
  }
  return text
}

// 450 -> "450 DH" / "450 د.م"  (1200 -> "1,200 DH", "1 200 DH" in French)
export function formatMoney(code, value) {
  const amount = Math.round(Number(value) || 0).toLocaleString(localeOf(code))
  return `${amount} ${translate(code, 'common.currency')}`
}

// "14:32" style time for the chosen language.
export function formatTime(code, date) {
  if (!date) return ''
  return new Date(date).toLocaleTimeString(localeOf(code), {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// What to call a table on screen: "Table 4" / "Table 4" / "طاولة 4" / "To Home".
export function tableLabelFor(code, tableId) {
  return String(tableId) === 'home'
    ? translate(code, 'common.toHome')
    : translate(code, 'common.table', { id: tableId })
}
