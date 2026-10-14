import { describe, it, expect, vi } from 'vitest'

vi.mock('../services/api', () => ({
  adminFetchOverview: vi.fn(async () => ({
    current: { orders: 5, revenue: 2000, avg: 400 },
    popular: { name: 'Margherita', orders: 3 },
    topItems: [{ name: 'Margherita', orders: 3, quantity: 4 }],
    hourly: { current: [] },
  })),
  adminFetchOrders: vi.fn(async () => ({ orders: [], counts: {} })),
  adminFetchTables: vi.fn(async () => []),
  adminFetchMenuItems: vi.fn(async () => [{ id: 'pizza-1', name: 'Margherita', price: 450, available: true, discountPercent: 0 }]),
  adminFetchCategories: vi.fn(async () => []),
  adminFetchOrder: vi.fn(),
}))

import { answer, quickPrompts } from '../admin/assistant'

// What each quick prompt must answer with, per language.
const EXPECT = {
  orders: { en: 'no active orders', fr: 'Aucune commande active', ar: 'لا توجد طلبات نشطة' },
  popular: { en: 'most popular item', fr: 'plus populaire', ar: 'الأكثر طلبًا' },
  tables: { en: 'You have', fr: 'Vous avez', ar: 'لديك' },
  help: { en: 'I answer questions', fr: 'Je réponds', ar: 'أجيب' },
  sales: { en: 'Today you made', fr: 'vous avez encaissé', ar: 'اليوم حققت' },
  longest: { en: 'Nothing is waiting', fr: 'Rien n’attend', ar: 'لا شيء ينتظر' },
  home: { en: 'To Home:', fr: 'À emporter :', ar: 'للمنزل:' },
  hidden: { en: 'menu items are available', fr: 'plats du menu', ar: 'جميع أصناف' },
}

describe('staff assistant understands every language', () => {
  for (const lang of ['en', 'fr', 'ar']) {
    for (const [id, prompt] of Object.entries(quickPrompts(lang))) {
      it(`${lang}: "${prompt}"`, async () => {
        const reply = await answer(prompt, 'pw', lang)
        expect(reply.text).toContain(EXPECT[id][lang])
      })
    }
  }

  it('answers an Arabic question while the dashboard is in French (and replies in French)', async () => {
    const reply = await answer('كم ربحنا اليوم؟', 'pw', 'fr')
    expect(reply.text).toContain('encaissé')
  })

  it('does not treat "hier" (yesterday) as a greeting', async () => {
    const reply = await answer('Combien de commandes hier ?', 'pw', 'fr')
    expect(reply.text).toContain('Hier')
  })
})
