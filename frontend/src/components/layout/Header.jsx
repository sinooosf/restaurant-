import { Search, ShoppingCart } from 'lucide-react'
// Files in /public are served from the site root — referenced by URL, never imported.
const Logo = '/logo.png'
const Bot = '/bot.png'
import { useCart } from '../../context/CartContext'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Header({
  searchTerm,
  onSearchChange,
  onOpenSearch,
  onOpenCart,
  onOpenChatbot,
  searchDisabled = false,
}) {
  const { totalCount } = useCart()
  const { t } = useLanguage()

  return (
    <header className="sticky top-0 z-[60] bg-ink/95 px-4 pb-3 pt-4 tiny:pb-1.5 tiny:pt-2 backdrop-blur">
      <div className="relative flex items-center gap-2.5 rounded-full bg-mist-800/50 px-4 py-2.5 ps-20 backdrop-blur">

        {/* Logo */}
        <div className="absolute start-0 top-10 z-10 -translate-y-1/2">
          <img
            src={Logo}
            alt={t('header.logo')}
            className="h-20 w-auto object-contain"
          />
        </div>

        {/* Search */}
        <div
          className={`flex flex-1 items-center gap-2 rounded-full border border-line bg-panel px-4 py-2.5 transition-opacity ${
            searchDisabled ? 'opacity-50' : ''
          }`}
        >
  <Search size={16} className="shrink-0 text-cream/50" />

  <input
    type="text"
    value={searchTerm}
    onFocus={searchDisabled ? undefined : onOpenSearch}
    onClick={searchDisabled ? undefined : onOpenSearch}
    onChange={(event) => onSearchChange(event.target.value)}
    disabled={searchDisabled}
    placeholder={searchDisabled ? t('header.searchOff') : t('header.search')}
    className="w-full bg-transparent text-sm text-cream placeholder:text-cream/40 focus:outline-none"
  />
        </div>

        {/* Cart */}
        <button
          type="button"
          onClick={onOpenCart}
          aria-label={t('header.openOrder')}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-cream transition hover:bg-panel-light"
        >
          <ShoppingCart size={19} />

          {totalCount > 0 && (
            <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-maroon-bright px-1 text-[11px] font-semibold text-cream">
              {totalCount}
            </span>
          )}
        </button>

        {/* Chatbot */}
        <button
          type="button"
          onClick={onOpenChatbot}
          aria-label={t('header.openChat')}
          className="shrink-0 transition hover:opacity-90"
        >
          <img
            src={Bot}
            alt={t('header.chatbot')}
            className="h-11 w-11 rounded-full border border-line bg-panel object-cover"
          />
        </button>
      </div>
    </header>
  )
}