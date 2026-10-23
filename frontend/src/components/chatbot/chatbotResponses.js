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
//
// It understands questions typed in English, French or Arabic (whatever the
// customer chose) and always answers in the CHOSEN language.
import { translate } from '../../i18n/translate'
import { itemName } from '../../i18n/menuText'

export const quickQuestions = (lang = 'en') =>
  ['name', 'best', 'available', 'hours'].map((id) => translate(lang, `chat.quick.${id}`))

// English list kept for backwards compatibility.
export const QUICK_QUESTIONS = quickQuestions('en')

// Lowercase, drop accents (é -> e) and Arabic marks, and unify the Arabic
// letter variants so "أفضل" and "افضل" match the same keyword.
function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[’]/g, "'")
}

// Each rule: words (any language) -> the answer. The order matters: the
// first rule that matches wins (same order as the original English bot).
const RULES = [
  // "Where is the waiter?" -> tell them about the button.
  { id: 'waiter', words: ['waiter', 'waitress', 'serveur', 'serveuse', 'garcon', 'نادل', 'جرسون', 'ويتر', 'نادلة'] },
  // The manager's / restaurant's phone, e-mail, address... (placeholder data
  // lives in i18n/locales/chatbot.js — replace it with the real details).
  {
    id: 'contact',
    words: [
      'contact', 'manager', 'gerant', 'responsable', 'directeur', 'phone', 'telephone', 'whatsapp',
      'email', 'e-mail', 'address', 'adresse', 'info', 'joindre', 'appeler', 'your number', 'votre numero', 'ton numero',
      'رقم', 'هاتف', 'تلفون', 'مدير', 'مسؤول', 'اتصال', 'اتصل', 'تواصل', 'عنوان', 'معلومات', 'واتساب', 'بريد', 'ايميل',
    ],
    pattern: /\b(num|nbr|numero)\b/,
  },
  { id: 'name', words: ['name', 'appelle', 'ton nom', 'votre nom', 'qui es-tu', 'اسم', 'من انت'] },
  { id: 'help', words: ['help', 'aide', 'aider', 'مساعد', 'ساعد'] },
  { id: 'how', words: ['how are you', 'ca va', 'comment vas', 'comment allez', 'كيف حالك', 'كيفك', 'كيف الحال'] },
  { id: 'respect', words: ['fuck'] },
  { id: 'sorry', words: ['bad', 'mauvais', 'سيء', 'سيئ', 'وحش'] },
  { id: 'price', words: ['expensive', 'price', 'trop cher', 'prix', 'tarif', 'سعر', 'اسعار', 'غالي', 'ثمن'] },
  { id: 'sorry', words: ['dislike', 'hate', 'deteste', "j'aime pas", 'اكره', 'لا احب'] },
  { id: 'love', words: ['love you', 'je t\'aime', 'je vous aime', 'احبك'] },
  { id: 'thanks', words: ['thank', 'merci', 'شكرا', 'شكر', 'ممنون', 'مشكور'] },
  { id: 'glad', words: ['good', 'great', 'awesome', 'super', 'genial', 'excellent', 'parfait', 'جيد', 'ممتاز', 'رائع'] },
  { id: 'rude', words: ['rude', 'mean', 'impoli', 'méchant', 'mechant', 'وقح', 'سخيف'] },
  { id: 'best', words: ['best', 'recommend', 'meilleur', 'conseill', 'recommand', 'favori', 'افضل', 'انصح', 'اقتراح', 'توصي'] },
  { id: 'available', words: ['available', 'unavailable', 'out of', 'disponible', 'rupture', 'متوفر', 'متاح', 'نفد', 'نفذ'] },
  { id: 'hours', words: ['time', 'close', 'open', 'hour', 'heure', 'ferm', 'ouvert', 'ouvre', 'horaire', 'وقت', 'اوقات', 'ساعات', 'ساعه', 'مفتوح', 'تفتح', 'تغلق', 'تقفل', 'اغلاق', 'دوام', 'مواعيد'] },
].map((rule) => ({ ...rule, words: rule.words.map(normalize) }))

export function getBotResponse(rawText, lang = 'en') {
  const text = normalize(rawText)
  const say = (key, params) => translate(lang, key, params)

  const rule = RULES.find(
    (candidate) => candidate.words.some((word) => text.includes(word)) || candidate.pattern?.test(text)
  )

  switch (rule?.id) {
    case 'waiter': return { text: say('chat.r.waiter') }
    case 'contact': return { text: say('chat.r.contact') }
    case 'name': return { text: say('chat.r.name') }
    case 'help': return { text: say('chat.r.help') }
    case 'how': return { text: say('chat.r.how') }
    case 'respect': return { text: say('chat.r.respect') }
    case 'sorry': return { text: say('chat.r.sorry') }
    case 'price': return { text: say('chat.r.price') }
    case 'love': return { text: say('chat.r.love') }
    case 'thanks': return { text: say('chat.r.thanks') }
    case 'glad': return { text: say('chat.r.glad') }
    case 'rude': return { text: say('chat.r.rude') }

    case 'best': {
      const best = getBestItems()
      if (best.length === 0) return { text: say('chat.r.noBest') }
      return { text: say('chat.r.best'), richContent: { type: 'items', items: best } }
    }

    case 'available': {
      const unavailable = getUnavailableItems()
      if (unavailable.length === 0) return { text: say('chat.r.allAvailable') }
      const names = unavailable.map((item) => itemName(item, lang)).join(say('chat.listSeparator'))
      return { text: say('chat.r.unavailable', { names }) }
    }

    case 'hours': return { text: say('chat.r.hours') }
    default: break
  }

  // Anything the admin has added from the dashboard gets checked last, so
  // it never overrides the built-in answers above. (These are typed by the
  // admin in one language, so they are shown exactly as written.)
  const customMatch = CUSTOM_FAQS.find((faq) => text.includes(normalize(faq.keyword)))
  if (customMatch) {
    return { text: customMatch.answer }
  }

  return { text: say('chat.r.fallback') }
}
