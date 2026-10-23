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

  it('gives (fake) contact details when asked for the manager, number, info or contact', () => {
    for (const question of [
      'what is the manager phone number',
      'give me the num',
      'I need info',
      'how can I contact you',
      "what's the manager's name",
      'your email?',
    ]) {
      expect(getBotResponse(question).text, question).toMatch(/\+213 555/)
    }
    expect(getBotResponse('numéro du gérant ?', 'fr').text).toMatch(/\+213 555/)
    expect(getBotResponse('رقم المدير', 'ar').text).toMatch(/555/)
  })

  it('points to the Call waiter button when asked for a waiter', () => {
    expect(getBotResponse('I need a waiter').text).toMatch(/call waiter/i)
    expect(getBotResponse('un serveur svp', 'fr').text).toMatch(/serveur/i)
  })

  it('does not steal the old questions', () => {
    expect(getBotResponse("What's your name?").text).toMatch(/sinoo/i)
    expect(getBotResponse('What time do you close?').text).toMatch(/11:00/)
    expect(getBotResponse('What are the best dishes?').richContent).toBeTruthy()
  })
})
