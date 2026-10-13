import { Component, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, RotateCcw, Send, User } from 'lucide-react'
// Files in /public are referenced by URL, never imported.
const ChatbotAvatar = '/bot.png'
import { useCart } from '../../context/CartContext'
import FadeImage from '../ui/FadeImage'
import { getFinalPrice } from '../../data/menu'
import { QUICK_QUESTIONS, getBotResponse } from './chatbotResponses'

const GREETING = {
  id: 'greeting',
  from: 'bot',
  text: "Hi! I'm Sinoo 👋 Ask me anything about the menu.",
}

// If anything inside the chat ever throws, only the chat is dropped (and the
// panel simply closes) — the menu and the customer's cart keep working
// instead of the whole page going blank.
export class ChatbotBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('The chatbot crashed:', error)
    this.props.onCrash?.()
  }

  componentDidUpdate(previous) {
    // Let the customer try again the next time they open it.
    if (this.state.failed && this.props.open && !previous.open) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function ChatbotPanel({
  open,
  onClose,
  onNavigateToCategory,
}) {
  const [messages, setMessages] = useState([GREETING])
  const [draft, setDraft] = useState('')
  const { addItem } = useCart()
  const scrollRef = useRef(null)
  const timers = useRef(new Set())

  // Cancel any reply that is still "typing" when the panel unmounts, so a
  // late timer can never update a component that is already gone.
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((id) => clearTimeout(id))
      pending.clear()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const box = scrollRef.current
    if (!box) return

    box.scrollTo({ top: box.scrollHeight, behavior: 'auto' })
  }, [messages, open])

  function pushExchange(userText) {
    const userMessage = {
      id: `u-${Date.now()}`,
      from: 'user',
      text: userText,
    }

    const loadingMessage = {
      id: `loading-${Date.now()}`,
      from: 'bot',
      loading: true,
    }

    setMessages((prev) => [
      ...prev,
      userMessage,
      loadingMessage,
    ])

    const timerId = setTimeout(() => {
      timers.current.delete(timerId)

      let response
      try {
        response = getBotResponse(userText)
      } catch (error) {
        console.error('Chatbot could not answer:', error)
        response = { text: 'Sorry, I had trouble with that. Please try another question.' }
      }

      const botMessage = {
        id: `b-${Date.now()}`,
        from: 'bot',
        ...response,
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === loadingMessage.id
            ? botMessage
            : message
        )
      )
    }, 700)

    timers.current.add(timerId)
  }

  function handleQuickQuestion(question) {
    pushExchange(question)
  }

  function handleSubmit(event) {
    event.preventDefault()

    const trimmed = draft.trim()

    if (!trimmed) return

    pushExchange(trimmed)
    setDraft('')
  }

  function handleClear() {
    setMessages([GREETING])
  }

  return (
    <AnimatePresence>
      {open && (
    <motion.div
      key="chatbot"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 z-[80] flex flex-col overflow-hidden bg-[#080303] will-change-[transform,opacity]"
    >

      {/* BACKGROUND — one static gradient. (It used to be three huge blurred
          circles; blur filters that size on a layer that is also animating
          are what made phones lag and crash when the chat opened/closed.) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(180,20,35,0.32),transparent_42%),radial-gradient(circle_at_0%_55%,rgba(100,10,20,0.26),transparent_46%),radial-gradient(circle_at_90%_100%,rgba(130,15,25,0.2),transparent_44%),linear-gradient(145deg,#120304_0%,#080303_45%,#140305_100%)]" />

      {/* HEADER */}
      <header className="relative z-10 flex items-center gap-3 border-b border-white/10 bg-black/20 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">

        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="flex h-9 w-9 items-center justify-center rounded-full text-cream/80 transition hover:bg-white/10 hover:text-cream"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-red-500/20" />

          <img
            src={ChatbotAvatar}
            alt="Chatbot Avatar"
            className="relative h-14 w-14 object-contain"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display text-base tracking-wide text-cream">
            CHAT BOT
          </p>

          <p className="truncate text-[11px] text-cream/50">
            A simple assistant for quick questions
          </p>
        </div>

        <button
          type="button"
          onClick={handleClear}
          aria-label="Start a new chat"
          title="Start a new chat"
          className="group flex h-9 w-9 items-center justify-center rounded-full text-cream/60 transition hover:bg-white/10 hover:text-cream"
        >
          <RotateCcw
            size={19}
            className="transition-transform duration-500 group-active:-rotate-[360deg]"
          />
        </button>
      </header>

      {/* MESSAGES */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 space-y-4 overflow-y-auto px-4 py-5"
      >
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            onAdd={addItem}
            onView={onNavigateToCategory}
          />
        ))}
      </div>

      {/* QUICK QUESTIONS */}
      <div className="relative z-10 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {QUICK_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => handleQuickQuestion(question)}
            className="shrink-0 rounded-full border border-red-300/20 bg-red-950/30 px-3.5 py-2 text-xs font-medium text-cream/80 transition hover:border-red-400/40 hover:bg-red-800/30 hover:text-cream"
          >
            {question}
          </button>
        ))}
      </div>

      {/* INPUT */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex items-center gap-2 border-t border-white/5 bg-black/20 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about the menu..."
          className="min-w-0 flex-1 rounded-full border border-red-300/10 bg-white/10 px-4 py-3 text-sm text-cream placeholder:text-cream/35 transition focus:border-red-400/30 focus:bg-white/15 focus:outline-none"
        />

        <button
          type="submit"
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-700 text-cream shadow-[0_0_20px_rgba(180,20,35,0.3)] transition hover:bg-red-600 active:scale-95"
        >
          <Send size={17} />
        </button>
      </form>
    </motion.div>
      )}
    </AnimatePresence>
  )
}

function ChatBubble({ message, onAdd, onView }) {
  const isUser = message.from === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-end gap-2 ${
        isUser ? 'flex-row-reverse' : ''
      }`}
    >
      {/* AVATAR */}
      {isUser ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-300/20 bg-red-950/60 text-cream shadow-lg">
          <User size={15} />
        </span>
      ) : (
        <div className="relative shrink-0">
          <img
            src={ChatbotAvatar}
            alt="Chatbot Avatar"
            className="relative h-8 w-8"
          />
        </div>
      )}

      {/* MESSAGE */}
      <div
        className={`max-w-[75%] rounded-2xl border px-3.5 py-2.5 text-sm text-cream shadow-lg ${
          isUser
            ? 'rounded-br-sm border-red-400/20 bg-red-700/80'
            : 'rounded-bl-sm border-white/10 bg-black/30'
        }`}
      >

        {/* LOADING */}
        {message.loading ? (
          <div className="flex items-center gap-1.5 py-1">

            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cream/70 [animation-delay:-0.3s]" />

            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cream/70 [animation-delay:-0.15s]" />

            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cream/70" />

          </div>
        ) : (
          <>
            <p>{message.text}</p>

            {/* RICH CONTENT */}
            {message.richContent?.type === 'items' && (
              <div className="mt-2.5 space-y-2">
                {message.richContent.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-xl border border-black/5 bg-cream/95 p-1.5 text-ink"
                  >
                    <FadeImage
                      src={item.image}
                      alt={item.name}
                      className="h-10 w-10 shrink-0 rounded-lg"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">
                        {item.name}
                      </p>

                      <p className="text-[11px] text-ink/60">
                        {getFinalPrice(item)} DH
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onView?.(item.categoryId)
                      }
                      className="rounded-full border border-ink/20 px-2 py-1 text-[11px] font-medium transition hover:bg-ink/5"
                    >
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() => onAdd(item.id)}
                      className="rounded-full bg-red-700 px-2.5 py-1 text-[11px] font-medium text-cream transition hover:bg-red-600"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
