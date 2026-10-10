import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Plus,
  QrCode,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import {
  adminFetchTables,
  adminCreateTable,
  adminDeleteTable,
} from '../../services/api'

export default function AdminTables() {
  const { password } = useAdminAuth()

  const [tables, setTables] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const [newId, setNewId] = useState('')
  const [newLabel, setNewLabel] = useState('')

  async function refresh() {
    try {
      setError('')
      const data = await adminFetchTables(password)
      setTables(data)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
  }, [password])

  async function handleAdd(event) {
    event.preventDefault()

    if (!newId.trim()) return

    try {
      setError('')

      const created = await adminCreateTable(password, {
        id: newId.trim(),
        label: newLabel.trim() || `Table ${newId.trim()}`,
      })

      setTables((prev) => [...prev, created])

      setNewId('')
      setNewLabel('')
      setShowAdd(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(`Remove table ${id}?`)) return

    try {
      setDeletingId(id)
      setError('')

      await adminDeleteTable(password, id)

      setTables((prev) => prev.filter((table) => table.id !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCopy(table) {
    const url = `${window.location.origin}/table/${table.id}`

    try {
      await navigator.clipboard.writeText(url)

      setCopiedId(table.id)

      setTimeout(() => {
        setCopiedId(null)
      }, 1800)
    } catch {
      setError('Could not copy the table link.')
    }
  }

  const filteredTables = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return tables

    return tables.filter(
      (table) =>
        String(table.id).toLowerCase().includes(query) ||
        table.label.toLowerCase().includes(query)
    )
  }, [tables, search])

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-maroon-bright">
            <QrCode size={14} />
            QR ordering
          </div>

          <h1 className="font-display text-3xl text-cream">
            Tables
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-cream/45">
            Manage restaurant tables and their unique ordering links.
            Each table can have its own QR code.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((prev) => !prev)}
          className="flex items-center justify-center gap-2 rounded-xl bg-maroon px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-maroon-bright"
        >
          {showAdd ? <X size={17} /> : <Plus size={17} />}
          {showAdd ? 'Close' : 'Add table'}
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon={<QrCode size={18} />}
          label="Total tables"
          value={tables.length}
        />

        <StatCard
          icon={<Check size={18} />}
          label="Active links"
          value={tables.length}
        />

        <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3 lg:col-span-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <QrCode size={17} />
          </div>

          <div>
            <p className="text-xs text-cream/40">Ordering system</p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-400">
              Ready
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

      {/* Add table */}
      {showAdd && (
        <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-panel">
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-maroon/15 text-maroon-bright">
                <Plus size={18} />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-cream">
                  Add restaurant table
                </h2>

                <p className="mt-0.5 text-xs text-cream/40">
                  Create a unique ordering link for a table.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleAdd} className="p-5">
            <div className="grid gap-4 lg:grid-cols-[220px_260px_1fr_auto] lg:items-end">
              <Field label="Table ID">
                <input
                  required
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="6"
                  className="input"
                />
              </Field>

              <Field label="Display label">
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Table 6"
                  className="input"
                />
              </Field>

              <div className="hidden lg:block">
                <p className="mb-1.5 text-xs font-medium text-cream/50">
                  Generated link
                </p>

                <div className="rounded-xl border border-line bg-panel-light px-3 py-2.5 text-sm text-cream/35">
                  /table/{newId || '6'}
                </div>
              </div>

              <button
                type="submit"
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-maroon px-5 text-sm font-semibold text-cream transition hover:bg-maroon-bright"
              >
                <Plus size={16} />
                Add table
              </button>
            </div>

            <p className="mt-3 text-xs text-cream/30">
              The table ID becomes part of the customer ordering URL.
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
            placeholder="Search table number or label..."
            className="w-full rounded-xl border border-line bg-panel py-2.5 pl-10 pr-4 text-sm text-cream outline-none transition placeholder:text-cream/25 focus:border-maroon-bright/60"
          />
        </div>
      </div>

      {/* Tables */}
      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-cream">
              Restaurant tables
            </h2>

            <p className="mt-0.5 text-xs text-cream/35">
              {filteredTables.length} of {tables.length} tables
            </p>
          </div>
        </div>

        {filteredTables.length === 0 ? (
          <EmptyState
            hasSearch={Boolean(search)}
            onAdd={() => {
              setSearch('')
              setShowAdd(true)
            }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                copied={copiedId === table.id}
                deleting={deletingId === table.id}
                onCopy={handleCopy}
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
/* Components                         */
/* ---------------------------------- */

function StatCard({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-maroon/10 text-maroon-bright">
        {icon}
      </div>

      <div>
        <p className="text-xs text-cream/40">{label}</p>
        <p className="mt-0.5 text-lg font-semibold text-cream">
          {value}
        </p>
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

function TableCard({
  table,
  copied,
  deleting,
  onCopy,
  onDelete,
}) {
  const link = `/table/${table.id}`

  return (
    <div className="group overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-cream/10">
      {/* Top */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon/10 text-maroon-bright">
            <span className="font-display text-lg">
              {table.id}
            </span>
          </div>

          <div>
            <h3 className="font-semibold text-cream">
              {table.label}
            </h3>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-emerald-400">
                Active
              </span>
            </div>
          </div>
        </div>

        <span className="rounded-lg border border-line bg-panel-light px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-cream/30">
          Table
        </span>
      </div>

      {/* Link */}
      <div className="border-t border-line px-4 py-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-cream/25">
          Ordering link
        </p>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 rounded-xl border border-line bg-panel-light px-3 py-2">
            <p className="truncate font-mono text-xs text-cream/45">
              {link}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onCopy(table)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-cream/40 transition hover:bg-panel-light hover:text-cream"
            title="Copy link"
          >
            {copied ? (
              <Check size={15} className="text-emerald-400" />
            ) : (
              <Copy size={15} />
            )}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-line bg-black/10 px-4 py-3">
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-cream/60 transition hover:bg-panel-light hover:text-cream"
        >
          <ExternalLink size={13} />
          Open
        </a>

        <button
          type="button"
          disabled={deleting}
          onClick={() => onDelete(table.id)}
          className="flex h-8 w-9 items-center justify-center rounded-xl border border-line text-cream/30 transition hover:border-red-500/20 hover:bg-red-500/5 hover:text-red-400 disabled:opacity-50"
          aria-label={`Delete ${table.label}`}
        >
          {deleting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cream/20 border-t-red-400" />
          ) : (
            <Trash2 size={14} />
          )}
        </button>
      </div>
    </div>
  )
}

function EmptyState({ hasSearch, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/50 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-maroon/10 text-maroon-bright">
        <QrCode size={25} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-cream">
        {hasSearch ? 'No tables found' : 'No tables yet'}
      </h3>

      <p className="mt-1 max-w-sm text-xs leading-5 text-cream/35">
        {hasSearch
          ? 'Try another table number or label.'
          : 'Add your restaurant tables to create unique ordering links and QR codes.'}
      </p>

      {!hasSearch && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 flex items-center gap-2 rounded-xl bg-maroon px-4 py-2.5 text-xs font-semibold text-cream transition hover:bg-maroon-bright"
        >
          <Plus size={14} />
          Add first table
        </button>
      )}
    </div>
  )
}