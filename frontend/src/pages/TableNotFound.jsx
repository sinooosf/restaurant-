import { Link } from 'react-router-dom'
import { VALID_TABLE_IDS } from '../data/tables'

export default function TableNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-cream">
      <p className="font-display text-2xl">Table not found</p>
      <p className="max-w-xs text-sm text-cream/60">
        This link doesn't match one of the restaurant's tables. Ask a staff member,
        or try one of the demo tables below.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {VALID_TABLE_IDS.map((id) => (
          <Link
            key={id}
            to={`/table/${id}`}
            className="rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-cream"
          >
            Table {id}
          </Link>
        ))}
      </div>
    </div>
  )
}
