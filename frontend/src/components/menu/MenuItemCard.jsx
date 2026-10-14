import { Ban, Minus, Plus } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { getFinalPrice } from '../../data/menu'
import FadeImage from '../ui/FadeImage'
import { useLanguage } from '../../i18n/LanguageContext'

export default function MenuItemCard({ item }) {
  const { quantities, addItem, removeItem } = useCart()
  const { t, formatMoney, itemName } = useLanguage()
  const name = itemName(item)
  const quantity = quantities[item.id] || 0
  const finalPrice = getFinalPrice(item)
  const hasDiscount = item.discountPercent > 0

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl bg-cream text-ink shadow-lg shadow-black/30">
      <div className="relative aspect-square w-full">
        <FadeImage
          src={item.image}
          alt={name}
          className="absolute inset-0"
        />

        <span className="absolute start-2 top-2 rounded-full bg-maroon px-2.5 py-1 text-[11px] font-bold text-cream shadow">
          {formatMoney(finalPrice)}
        </span>

        {hasDiscount && (
          <span className="absolute start-2 top-9 -rotate-6 rtl:rotate-6 rounded bg-maroon-bright px-1.5 py-0.5 text-[10px] font-bold text-cream shadow">
            -{item.discountPercent}%
          </span>
        )}

        {!item.available && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 text-cream">
            <Ban size={22} />
            <span className="font-display text-xs tracking-wide">{t('item.unavailableBadge')}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <p className="truncate text-sm font-semibold">{name}</p>

        {hasDiscount && (
          <p className="text-xs text-ink/40 line-through">{formatMoney(item.price)}</p>
        )}

        {!item.available ? (
          <div className="mt-auto rounded-full bg-ink/10 py-2 text-center text-xs font-semibold text-ink/40">
            {t('item.unavailable')}
          </div>
        ) : quantity === 0 ? (
          <button
            type="button"
            onClick={() => addItem(item.id)}
            aria-label={t('item.addAria', { name })}
            className="mt-auto flex items-center justify-center gap-1 rounded-full bg-maroon py-2 text-sm font-semibold text-cream transition hover:bg-maroon-bright"
          >
            <Plus size={15} />
            {t('item.add')}
          </button>
        ) : (
          <div className="mt-auto flex items-center justify-between rounded-full bg-ink/10 px-1 py-1">
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label={t('item.removeOne', { name })}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon text-cream transition hover:bg-maroon-bright"
            >
              <Minus size={14} />
            </button>
            <span className="text-sm font-semibold">{quantity}</span>
            <button
              type="button"
              onClick={() => addItem(item.id)}
              aria-label={t('item.addAnother', { name })}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon text-cream transition hover:bg-maroon-bright"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
