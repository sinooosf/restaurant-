import { describe, it, expect } from 'vitest'
import { getBotResponse, quickQuestions } from '../components/chatbot/chatbotResponses'
import { translate, LANGUAGES } from '../i18n/translate'
import { DICTIONARIES } from '../i18n/locales'

describe('translations', () => {
  it('every language has every key', () => {
    const base = Object.keys(DICTIONARIES.en)
    for (const code of ['fr', 'ar']) {
      const missing = base.filter((key) => !(key in DICTIONARIES[code]))
      expect(missing, `${code} is missing keys`).toEqual([])
    }
  })

  it('uses the right plural form', () => {
    expect(translate('en', 'common.items', { count: 1 })).toBe('1 item')
    expect(translate('en', 'common.items', { count: 3 })).toBe('3 items')
    expect(translate('ar', 'common.items', { count: 2 })).toBe('صنفان')
    expect(translate('ar', 'common.items', { count: 5 })).toBe('5 أصناف')
  })

  it('only Arabic is right-to-left', () => {
    expect(LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.code)).toEqual(['ar'])
  })
})

describe('chatbot in three languages', () => {
  it.each(['en', 'fr', 'ar'])('answers each quick question in %s with the right rule', (lang) => {
    const [name, best, available, hours] = quickQuestions(lang)
    expect(getBotResponse(name, lang).text).toBe(translate(lang, 'chat.r.name'))
    expect(getBotResponse(best, lang).richContent.type).toBe('items')
    expect(getBotResponse(available, lang).text).toBe(
      getBotResponse(available, lang).text // answered (not the fallback):
    )
    expect(getBotResponse(available, lang).text).not.toBe(translate(lang, 'chat.r.fallback'))
    expect(getBotResponse(hours, lang).text).toBe(translate(lang, 'chat.r.hours'))
  })

  it('understands a French question while Arabic is selected and answers in Arabic', () => {
    expect(getBotResponse('Quels sont les meilleurs plats ?', 'ar').richContent.type).toBe('items')
    expect(getBotResponse('شكرا', 'fr').text).toBe(translate('fr', 'chat.r.thanks'))
  })
})
