import { getBestItems, getUnavailableItems } from '../../data/menu'
import { fetchChatbotFaqs } from '../../services/api'

// Questions added from the admin dashboard. Empty until loadChatbotFaqs()
// runs (see App.jsx) — if the backend is offline, this just stays empty
// and the chatbot still works fine with only its built-in answers below.
export let CUSTOM_FAQS = []

export async function loadChatbotFaqs() {
  try {
    const faqs = await fetchChatbotFaqs()
    if (Array.isArray(faqs)) CUSTOM_FAQS = faqs
  } catch (err) {
    console.warn('Could not load chatbot FAQs from the backend.', err)
  }
}

// This is intentionally NOT a real AI — it's simple keyword matching over a
// short, fixed set of restaurant questions, exactly like the "limited IA
// for questions" label in the design. Swap this file's insides later for a
// real backend/LLM call without touching ChatbotPanel.jsx.
export const QUICK_QUESTIONS = [
  "What's your name?",
  'What are the best dishes?',
  "What's available today?",
  'What time do you close?',
]

export function getBotResponse(rawText) {
  const text = rawText.toLowerCase()

  if (text.includes('name')) {
    return { text: "I'm Sinoo, this restaurant's chat assistant! \u{1F44B}" }
  }

  if (text.includes('help')) {
    return {
      text: 'I can show you today\u2019s best dishes, tell you what\u2019s available, or answer a quick question about the menu.',
    }
  }

  if (text.includes('how are you')) {
    return {
      text: 'I\u2019m just a simple chatbot, but I\u2019m doing well! Thanks for asking. \u{1F60A}',
    }
  }

  if (text.includes('fuck')) {
    return {
      text: 'Please be respectful. I\u2019m just a simple chatbot',
    }
  }

  if (text.includes('bad')) {
    return {
      text: 'I\u2019m sorry to hear that. Is there anything I can do to help? \u{1F614}',
    }
  }

  if (text.includes('expensive') || text.includes('price')) {
    return {
      text: 'Our prices are quite reasonable for the quality of food we offer!',
    }
  }

  if (text.includes('expensive')){
    return {
      text: 'I understand that price can be a concern. If you want, I can help you find some of our more affordable options on the menu.',
    }
  }

  if (text.includes('dislike') || text.includes('hate')) {
    return { text: "I'm sorry to hear that. Is there anything I can do to help? \u{1F614}" }
  }

  if (text.includes('I love you') || text.includes('love you')) {
    return {
      text: 'I love you too! \u{1F60A}',
    }
  }

  if (text.includes('thank')) {
    return {
      text: "You're welcome! I'm here to help. \u{1F60A}",
    }
  }

  if (text.includes('good') || text.includes('great') || text.includes('awesome')) {
    return {
      text: 'I\u2019m glad you think so! \u{1F60A}',
    }
  }

  if (text.includes('rude') || text.includes('mean')) {
    return {
      text: "I'm sorry if I came across that way. I'm just a simple chatbot trying to help. \u{1F614}",
    }
  }


  if (text.includes('best') || text.includes('recommend')) {
    const best = getBestItems()
    if (best.length === 0) {
      return { text: "Nothing is marked as a favorite right now — check out the full menu!" }
    }
    return {
      text: "Here are today's favorites:",
      richContent: { type: 'items', items: best },
    }
  }

  if (text.includes('available') || text.includes('unavailable') || text.includes('out of')) {
    const unavailable = getUnavailableItems()
    if (unavailable.length === 0) {
      return { text: 'Everything on the menu is available right now!' }
    }
    const names = unavailable.map((item) => item.name).join(', ')
    return { text: `Everything is available except: ${names}.` }
  }

  if (text.includes('time') || text.includes('close') || text.includes('open') || text.includes('hour')) {
    return { text: "We're open every day from 11:00 AM to 11:00 PM." }
  }

  // Anything the admin has added from the dashboard gets checked last, so
  // it never overrides the built-in answers above.
  const customMatch = CUSTOM_FAQS.find((faq) => text.includes(faq.keyword.toLowerCase()))
  if (customMatch) {
    return { text: customMatch.answer }
  }

  return {
    text: "I'm a simple assistant for now \u2014 try one of the quick questions below!",
  }
}
