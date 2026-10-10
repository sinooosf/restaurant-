import { describe, it, expect } from 'vitest'
import { getBotResponse } from '../components/chatbot/chatbotResponses'

describe('getBotResponse', () => {
  it('answers the name question', () => {
    expect(getBotResponse("What's your name?").text).toMatch(/sinoo/i)
  })

  it('returns a list of best dishes with rich content', () => {
    const response = getBotResponse('What are the best dishes?')
    expect(response.richContent.type).toBe('items')
    expect(response.richContent.items.length).toBeGreaterThan(0)
    expect(response.richContent.items.every((item) => item.isBest)).toBe(true)
  })

  it('lists unavailable items when asked about availability', () => {
    const response = getBotResponse("what's available today")
    expect(response.text).toMatch(/Arugula & Prosciutto/)
  })

  it('answers the opening hours question', () => {
    expect(getBotResponse('What time do you close?').text).toMatch(/11:00/)
  })

  it('falls back gracefully for anything else', () => {
    expect(getBotResponse('do you deliver to the moon').text).toMatch(/simple assistant/i)
  })
})
