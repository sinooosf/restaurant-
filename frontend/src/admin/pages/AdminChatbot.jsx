import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  Check,
  MessageCircle,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import {
  adminFetchFaqs,
  adminCreateFaq,
  adminUpdateFaq,
  adminDeleteFaq,
} from '../../services/api'

export default function AdminChatbot() {
  const { password } = useAdminAuth()

  const [faqs, setFaqs] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const [newFaq, setNewFaq] = useState({
    keyword: '',
    answer: '',
  })

  async function refresh() {
    try {
      setError('')
      const data = await adminFetchFaqs(password)
      setFaqs(data)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
  }, [password])

  function handleFieldChange(id, field, value) {
    setFaqs((prev) =>
      prev.map((faq) =>
        faq.id === id ? { ...faq, [field]: value } : faq
      )
    )
  }

  async function handleSave(faq) {
    try {
      setSavingId(faq.id)
      setError('')

      await adminUpdateFaq(password, faq.id, {
        keyword: faq.keyword,
        answer: faq.answer,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this chatbot question?')) return

    try {
      setDeletingId(id)
      setError('')

      await adminDeleteFaq(password, id)

      setFaqs((prev) => prev.filter((faq) => faq.id !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleAdd(event) {
    event.preventDefault()

    if (!newFaq.keyword.trim() || !newFaq.answer.trim()) return

    try {
      setError('')

      const created = await adminCreateFaq(password, {
        keyword: newFaq.keyword.trim(),
        answer: newFaq.answer.trim(),
      })

      setFaqs((prev) => [...prev, created])

      setNewFaq({
        keyword: '',
        answer: '',
      })

      setShowAdd(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredFaqs = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return faqs

    return faqs.filter(
      (faq) =>
        faq.keyword.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query)
    )
  }, [faqs, search])

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-maroon-bright">
            <Bot size={14} />
            Restaurant assistant
          </div>

          <h1 className="font-display text-3xl text-cream">
            Chatbot
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-cream/45">
            Manage the questions your restaurant chatbot understands and
            the answers it sends to customers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((prev) => !prev)}
          className="flex items-center justify-center gap-2 rounded-xl bg-maroon px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-maroon-bright"
        >
          {showAdd ? <X size={17} /> : <Plus size={17} />}
          {showAdd ? 'Close' : 'Add question'}
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon={<MessageCircle size={18} />}
          label="Questions"
          value={faqs.length}
        />

        <StatCard
          icon={<Sparkles size={18} />}
          label="Active answers"
          value={faqs.length}
        />

        <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3 lg:col-span-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Check size={17} />
          </div>

          <div>
            <p className="text-xs text-cream/40">Chatbot status</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-400">
              Online
            </p>
          </div>

          <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>

          <button
            type="button"
            onClick={() => setError('')}
            className="text-red-300/60 transition hover:text-red-300"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Add question */}
      {showAdd && (
        <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-panel">
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-maroon/15 text-maroon-bright">
                <Plus size={18} />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-cream">
                  Add chatbot question
                </h2>
                <p className="mt-0.5 text-xs text-cream/40">
                  Create a keyword and the response customers should receive.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleAdd} className="p-5">
            <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto] lg:items-end">
              <Field label="Keyword">
                <input
                  required
                  value={newFaq.keyword}
                  onChange={(e) =>
                    setNewFaq({
                      ...newFaq,
                      keyword: e.target.value,
                    })
                  }
                  placeholder="wifi"
                  className="input"
                />
              </Field>

              <Field label="Chatbot answer">
                <input
                  required
                  value={newFaq.answer}
                  onChange={(e) =>
                    setNewFaq({
                      ...newFaq,
                      answer: e.target.value,
                    })
                  }
                  placeholder="Yes, we have free Wi-Fi."
                  className="input"
                />
              </Field>

              <button
                type="submit"
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-maroon px-5 text-sm font-semibold text-cream transition hover:bg-maroon-bright"
              >
                <Plus size={16} />
                Add question
              </button>
            </div>

            <p className="mt-3 text-xs text-cream/30">
              Matching is not case-sensitive. Keep keywords short and
              specific.
            </p>
          </form>
        </section>
      )}

      {/* Search */}
      <div className="sticky top-0 z-20 mt-6 border-y border-line bg-ink/90 py-3 backdrop-blur-xl">
        <div className="relative">
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cream/30"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or answers..."
            className="w-full rounded-xl border border-line bg-panel py-2.5 pl-10 pr-4 text-sm text-cream outline-none transition placeholder:text-cream/25 focus:border-maroon-bright/60"
          />
        </div>
      </div>

      {/* FAQ list */}
      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-cream">
              Knowledge base
            </h2>
            <p className="mt-0.5 text-xs text-cream/35">
              {filteredFaqs.length} of {faqs.length} questions
            </p>
          </div>
        </div>

        {filteredFaqs.length === 0 ? (
          <EmptyState
            hasSearch={Boolean(search)}
            onAdd={() => {
              setSearch('')
              setShowAdd(true)
            }}
          />
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map((faq) => (
              <FaqCard
                key={faq.id}
                faq={faq}
                saving={savingId === faq.id}
                deleting={deletingId === faq.id}
                onChange={handleFieldChange}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/* ---------------------------------- */
/* Components                          */
/* ---------------------------------- */

function StatCard({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-maroon/10 text-maroon-bright">
        {icon}
      </div>

      <div>
        <p className="text-xs text-cream/40">{label}</p>
        <p className="mt-0.5 text-lg font-semibold text-cream">{value}</p>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-cream/50">
        {label}
      </span>

      {children}
    </label>
  )
}

function FaqCard({
  faq,
  saving,
  deleting,
  onChange,
  onSave,
  onDelete,
}) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-cream/10">
      <div className="grid gap-4 p-4 lg:grid-cols-[210px_1fr_auto] lg:items-start">
        {/* Keyword */}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-cream/30">
              Keyword
            </span>

            <span className="rounded-md bg-maroon/10 px-1.5 py-0.5 text-[10px] font-medium text-maroon-bright">
              trigger
            </span>
          </div>

          <input
            value={faq.keyword}
            onChange={(e) =>
              onChange(faq.id, 'keyword', e.target.value)
            }
            className="w-full rounded-xl border border-line bg-panel-light px-3 py-2.5 text-sm font-medium text-cream outline-none transition placeholder:text-cream/25 focus:border-maroon-bright/60"
          />
        </div>

        {/* Answer */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-cream/30">
              Chatbot response
            </span>

            <span className="text-[10px] text-cream/25">
              {faq.answer.length} characters
            </span>
          </div>

          <textarea
            value={faq.answer}
            onChange={(e) =>
              onChange(faq.id, 'answer', e.target.value)
            }
            rows={2}
            className="w-full resize-none rounded-xl border border-line bg-panel-light px-3 py-2.5 text-sm leading-6 text-cream outline-none transition placeholder:text-cream/25 focus:border-maroon-bright/60"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 lg:pt-6">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(faq)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-maroon px-3 py-2.5 text-xs font-semibold text-cream transition hover:bg-maroon-bright disabled:cursor-not-allowed disabled:opacity-50 lg:flex-none"
          >
            {saving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cream/30 border-t-cream" />
            ) : (
              <Save size={14} />
            )}

            {saving ? 'Saving...' : 'Save'}
          </button>

          <button
            type="button"
            disabled={deleting}
            onClick={() => onDelete(faq.id)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-cream/35 transition hover:border-red-500/20 hover:bg-red-500/5 hover:text-red-400 disabled:opacity-50"
            aria-label="Delete question"
          >
            {deleting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cream/20 border-t-red-400" />
            ) : (
              <Trash2 size={15} />
            )}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="border-t border-line bg-black/10 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-maroon/15 text-maroon-bright">
            <Bot size={12} />
          </div>

          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream/25">
              Customer sees
            </p>

            <p className="truncate text-xs leading-5 text-cream/50">
              {faq.answer || 'No answer configured'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ hasSearch, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/50 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon/10 text-maroon-bright">
        <Bot size={25} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-cream">
        {hasSearch ? 'No questions found' : 'Your chatbot is empty'}
      </h3>

      <p className="mt-1 max-w-sm text-xs leading-5 text-cream/35">
        {hasSearch
          ? 'Try a different keyword or search term.'
          : 'Add common restaurant questions so customers can get instant answers.'}
      </p>

      {!hasSearch && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 flex items-center gap-2 rounded-xl bg-maroon px-4 py-2.5 text-xs font-semibold text-cream transition hover:bg-maroon-bright"
        >
          <Plus size={14} />
          Add first question
        </button>
      )}
    </div>
  )
}