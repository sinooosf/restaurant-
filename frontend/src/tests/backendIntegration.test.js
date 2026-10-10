import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({
  fetchMenu: vi.fn(),
  fetchTables: vi.fn(),
  fetchChatbotFaqs: vi.fn(),
}))

describe('loadMenuData', () => {
  it('keeps the built-in menu if the backend request fails', async () => {
    const api = await import('../services/api')
    api.fetchMenu.mockRejectedValueOnce(new Error('network down'))

    const { loadMenuData, MENU_ITEMS, CATEGORIES } = await import('../data/menu')
    const before = MENU_ITEMS.length

    await loadMenuData()

    expect(MENU_ITEMS.length).toBe(before)
    expect(CATEGORIES.length).toBeGreaterThan(0)
  })

  it('replaces the built-in menu once the backend responds', async () => {
    const api = await import('../services/api')
    const fakeItems = [{ id: 'test-1', categoryId: 'pizza', name: 'Test Pizza', price: 100, image: '/x.jpg', available: true, discountPercent: 0, isBest: false }]
    const fakeCategories = [{ id: 'pizza', name: 'Pizza', image: '/x.png', description: 'Test' }]
    api.fetchMenu.mockResolvedValueOnce({ categories: fakeCategories, items: fakeItems })

    const menuModule = await import('../data/menu')
    await menuModule.loadMenuData()

    expect(menuModule.MENU_ITEMS).toEqual(fakeItems)
  })
})

describe('chatbot custom FAQs', () => {
  it('answers with a dashboard-added FAQ when the keyword matches', async () => {
    const chatbot = await import('../components/chatbot/chatbotResponses')
    chatbot.CUSTOM_FAQS.push({ id: 99, keyword: 'delivery', answer: 'Yes, we deliver within 5km.' })

    const response = chatbot.getBotResponse('do you offer delivery?')
    expect(response.text).toBe('Yes, we deliver within 5km.')
  })

  it('still falls back normally when nothing matches', async () => {
    const chatbot = await import('../components/chatbot/chatbotResponses')
    const response = chatbot.getBotResponse('asdkjaskdj')
    expect(response.text).toMatch(/simple assistant/i)
  })
})
