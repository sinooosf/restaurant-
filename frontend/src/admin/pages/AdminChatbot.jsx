import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCheck,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  BadgeDollarSign,
  Timer,
  Home,
  EyeOff,
  Armchair,
  Send,
  Sparkles,
  Zap,
  ChefHat,
  Bot,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import { Card, CardTitle, PageTop } from '../components/ui'
import { QUICK_PROMPTS, answer } from '../assistant'

const AVATAR = '/bot.png'

const nowTime = () =>
  new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const DOTS = {
  preparing: 'bg-orange-500',
  almost: 'bg-blue-500',
  ready: 'bg-violet-500',
  completed: 'bg-zinc-400',
  cancelled: 'bg-red-600',
  occupied: 'bg-[#f0222c]',
  available: 'bg-emerald-500',
  cleaning: 'bg-amber-500',
  neutral: 'bg-white/40',
}

const QUICK_ACTIONS = [
  { icon: ClipboardList, title: 'Check current orders', sub: 'See active and pending orders', prompt: QUICK_PROMPTS.orders },
  { icon: ChefHat, title: 'Popular items', sub: 'View best selling dishes', prompt: QUICK_PROMPTS.popular },
  { icon: Armchair, title: 'Table status', sub: 'Check table occupancy', prompt: QUICK_PROMPTS.tables },
  { icon: BadgeDollarSign, title: 'Sales today', sub: 'Money made vs. yesterday', prompt: 'How much did we make today?' },
  { icon: Timer, title: 'Longest wait', sub: 'Which order is waiting most', prompt: 'Which order has been waiting the longest?' },
  { icon: Home, title: 'To Home orders', sub: 'Orders without a table', prompt: 'Any to home orders?' },
  { icon: EyeOff, title: 'Hidden items', sub: 'Dishes customers cannot see', prompt: 'Which items are hidden?' },
  { icon: CircleHelp, title: 'Help & FAQ', sub: 'Everything I can answer', prompt: QUICK_PROMPTS.help },
]


export default function AdminChatbot() {
  const { password } = useAdminAuth()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([
    { id: 1, from: 'bot', time: nowTime(), text: "Hello! 👋 I'm ChefBot, your restaurant assistant.\nHow can I help you today?" },
  ])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const scroller = useRef(null)
  const nextId = useRef(2)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  async function send(raw) {
    const text = raw.trim()
    if (!text || thinking) return

    setDraft('')
    setMessages((m) => [...m, { id: nextId.current++, from: 'user', text, time: nowTime() }])
    setThinking(true)

    let reply
    try {
      reply = await answer(text, password)
    } catch (err) {
      reply = { text: `Sorry, I couldn't reach the restaurant data (${err.message}).` }
    }

    setMessages((m) => [...m, { id: nextId.current++, from: 'bot', time: nowTime(), ...reply }])
    setThinking(false)
  }

  return (
    <div className="space-y-6 xl:flex xl:h-[calc(100dvh-4rem)] xl:flex-col xl:space-y-0 xl:gap-6">
      <PageTop
        icon={
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d9151f] text-white">
            <Bot size={28} />
          </span>
        }
        title="AI Assistant"
        subtitle="Your smart assistant for a smoother restaurant experience."
      />

      <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_370px]">
        {/* Chat */}
        <Card className="flex h-[70dvh] min-h-[480px] flex-col overflow-hidden xl:h-full xl:min-h-0">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
            <div className="flex items-center gap-4">
              <img src={AVATAR} alt="" className="h-14 w-14 rounded-full bg-white object-contain" />
              <div>
                <p className="text-xl font-semibold text-white">ChefBot</p>
                <p className="flex items-center gap-1.5 text-xs text-white/65">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Online
                </p>
              </div>
            </div>
            <span className="hidden items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2 text-xs text-white/85 sm:flex">
              <Sparkles size={14} className="text-[#f0222c]" /> Always here to help
            </span>
          </div>

          <div ref={scroller} className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
            {messages.map((m) => (
              <Bubble key={m.id} message={m} onNavigate={navigate} />
            ))}

            {thinking && (
              <div className="flex items-end gap-3">
                <img src={AVATAR} alt="" className="h-10 w-10 shrink-0 rounded-full bg-white object-contain" />
                <div className="flex gap-1.5 rounded-2xl bg-[#1a1a1e] px-5 py-4">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-white/50" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(draft)
            }}
            className="flex items-center gap-3 border-t border-white/[0.07] px-5 py-4"
          >
            <div className="relative flex-1">
              <Sparkles size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type your message..."
                className="h-12 w-full rounded-full border border-white/[0.09] bg-[#121215] pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#f0222c]/60"
              />
            </div>
            <button
              type="submit"
              disabled={!draft.trim() || thinking}
              aria-label="Send"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d9151f] text-white shadow-[0_6px_20px_rgba(217,21,31,0.4)] transition hover:bg-[#f0222c] disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </form>
        </Card>

        {/* Side panels */}
        <div className="flex flex-col gap-4 xl:min-h-0">
          <Card className="flex min-h-0 flex-1 flex-col p-5 max-xl:max-h-[420px]">
            <CardTitle icon={<Zap size={24} fill="currentColor" />} title="Quick Actions" />
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
              {QUICK_ACTIONS.map(({ icon: Icon, title, sub, prompt }) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => send(prompt)}
                  className="flex w-full items-center gap-4 rounded-xl bg-white/[0.04] px-4 py-3.5 text-left transition hover:bg-white/[0.08]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5a0b10] text-[#ff4650]">
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">{title}</span>
                    <span className="block text-xs text-white/50">{sub}</span>
                  </span>
                  <ChevronRight size={16} className="text-white/60" />
                </button>
              ))}
            </div>
          </Card>

          <Card className="flex shrink-0 items-center gap-4 p-5">
            <img src={AVATAR} alt="" className="h-16 w-16 shrink-0 rounded-full bg-white object-contain" />
            <div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-white">Chatbot Status</p>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/50">
                ChefBot is ready to assist you with orders, menu, tables and more.
              </p>
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}

function Bubble({ message, onNavigate }) {
  if (message.from === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-[#c4121c] px-5 py-3 text-sm text-white">
          <p>{message.text}</p>
          <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-white/70">
            {message.time} <CheckCheck size={13} />
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-3">
      <img src={AVATAR} alt="" className="h-10 w-10 shrink-0 rounded-full bg-white object-contain" />
      <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-[#1a1a1e] px-5 py-3.5 text-sm text-white/95">
        <p className="whitespace-pre-line leading-relaxed">{message.text}</p>

        {message.bullets?.length > 0 && (
          <ul className="mt-3 space-y-2">
            {message.bullets.map((b, i) => (
              <li key={i} className="flex items-center gap-2.5 text-white/90">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOTS[b.tone] || DOTS.neutral}`} />
                {b.label}
              </li>
            ))}
          </ul>
        )}

        {message.footer && <p className="mt-3 font-semibold text-white">{message.footer}</p>}

        {message.actions?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => onNavigate(a.to)}
                className="rounded-full border border-[#d9151f]/60 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#d9151f]/20"
              >
                {a.label} →
              </button>
            ))}
          </div>
        )}

        <p className="mt-1.5 text-right text-[11px] text-white/40">{message.time}</p>
      </div>
    </div>
  )
}
