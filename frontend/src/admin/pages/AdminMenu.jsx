import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Image as ImageIcon,
  Percent,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  Utensils,
  X,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import {
  adminFetchCategories,
  adminFetchMenuItems,
  adminCreateMenuItem,
  adminUpdateMenuItem,
  adminDeleteMenuItem,
} from '../../services/api'

const BLANK_ITEM = {
  id: '',
  categoryId: '',
  name: '',
  price: '',
  image: '',
  discountPercent: 0,
  isBest: false,
  available: true,
}

export default function AdminMenu() {
  const { password } = useAdminAuth()

  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState(BLANK_ITEM)
  const [saving, setSaving] = useState(null)

  async function refresh() {
    const [cats, menuItems] = await Promise.all([
      adminFetchCategories(password),
      adminFetchMenuItems(password),
    ])

    setCategories(cats)
    setItems(menuItems)

    if (!newItem.categoryId && cats.length) {
      setNewItem((prev) => ({
        ...prev,
        categoryId: cats[0].id,
      }))
    }
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

  function handleFieldChange(id, field, value) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, [field]: value }
          : item
      )
    )
  }

  async function handleSave(item) {
    setError('')
    setSaving(item.id)

    try {
      const updated = await adminUpdateMenuItem(
        password,
        item.id,
        {
          categoryId: item.categoryId,
          name: item.name,
          price: Number(item.price),
          image: item.image,
          available: item.available,
          discountPercent: Number(item.discountPercent) || 0,
          isBest: item.isBest,
        }
      )

      setItems((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? updated
            : current
        )
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(id) {
    const item = items.find((current) => current.id === id)

    if (!item) return

    const confirmed = window.confirm(
      `Delete "${item.name}" from the menu?`
    )

    if (!confirmed) return

    try {
      await adminDeleteMenuItem(password, id)

      setItems((prev) =>
        prev.filter((item) => item.id !== id)
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdd(event) {
    event.preventDefault()
    setError('')

    try {
      const created = await adminCreateMenuItem(
        password,
        {
          ...newItem,
          price: Number(newItem.price),
          discountPercent:
            Number(newItem.discountPercent) || 0,
        }
      )

      setItems((prev) => [...prev, created])

      setNewItem({
        ...BLANK_ITEM,
        categoryId: categories[0]?.id || '',
      })

      setShowAdd(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesCategory =
        activeCategory === 'all' ||
        item.categoryId === activeCategory

      return matchesSearch && matchesCategory
    })
  }, [items, search, activeCategory])

  const availableCount = items.filter(
    (item) => item.available
  ).length

  const bestCount = items.filter(
    (item) => item.isBest
  ).length

  return (
    <div className="space-y-7">

      {/* Header */}
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-maroon-bright">
            <Utensils size={13} />
            Restaurant menu
          </div>

          <h1 className="font-display text-3xl font-semibold tracking-tight text-cream">
            Menu
          </h1>

          <p className="mt-1 max-w-xl text-sm text-cream/40">
            Manage dishes, prices, discounts and availability.
            Changes appear on the customer menu after saving.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((value) => !value)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-maroon px-5 text-sm font-semibold text-cream transition hover:bg-maroon-bright"
        >
          {showAdd ? (
            <>
              <X size={17} />
              Close
            </>
          ) : (
            <>
              <Plus size={17} />
              Add dish
            </>
          )}
        </button>

      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">

        <MenuStat
          label="Total dishes"
          value={items.length}
        />

        <MenuStat
          label="Available"
          value={availableCount}
          accent
        />

        <MenuStat
          label="Best dishes"
          value={bestCount}
        />

      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">
            {error}
          </p>

          <button
            type="button"
            onClick={() => setError('')}
            className="text-xs text-red-300/60 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add item */}
      {showAdd && (
        <AddItemPanel
          categories={categories}
          newItem={newItem}
          setNewItem={setNewItem}
          onSubmit={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Filters */}
      <div className="sticky top-2 z-20 rounded-2xl border border-line bg-panel/90 p-2 shadow-xl shadow-black/20 backdrop-blur-xl">

        <div className="flex flex-col gap-2 md:flex-row">

          {/* Search */}
          <div className="relative flex-1">

            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream/25"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search dishes..."
              className="h-10 w-full rounded-xl border border-line bg-panel-light pl-10 pr-4 text-sm text-cream outline-none placeholder:text-cream/25 focus:border-maroon-bright/50"
            />

          </div>

          {/* Categories */}
          <div className="flex gap-1 overflow-x-auto">

            <CategoryButton
              active={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
            >
              All
            </CategoryButton>

            {categories.map((category) => (
              <CategoryButton
                key={category.id}
                active={activeCategory === category.id}
                onClick={() =>
                  setActiveCategory(category.id)
                }
              >
                {category.name}
              </CategoryButton>
            ))}

          </div>

        </div>
      </div>

      {/* Menu */}
      {categories.map((category) => {

        const categoryItems = filteredItems.filter(
          (item) => item.categoryId === category.id
        )

        if (!categoryItems.length) return null

        return (
          <section key={category.id}>

            <div className="mb-3 flex items-center justify-between">

              <div>
                <h2 className="font-display text-xl font-semibold text-cream">
                  {category.name}
                </h2>

                <p className="mt-0.5 text-xs text-cream/30">
                  {categoryItems.length}{' '}
                  {categoryItems.length === 1
                    ? 'dish'
                    : 'dishes'}
                </p>
              </div>

              <div className="h-px flex-1 bg-line ml-5" />

            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {categoryItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  categories={categories}
                  saving={saving === item.id}
                  onChange={handleFieldChange}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              ))}
            </div>

          </section>
        )
      })}

      {filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-panel/50 px-6 py-16 text-center">

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
            <Search
              size={22}
              className="text-cream/20"
            />
          </div>

          <p className="mt-4 text-sm font-medium text-cream/50">
            No dishes found
          </p>

          <p className="mt-1 text-xs text-cream/25">
            Try another search or category.
          </p>

        </div>
      )}

    </div>
  )
}


/* -------------------------------------------------------------------------- */
/* MENU ITEM CARD                                                             */
/* -------------------------------------------------------------------------- */

function MenuItemCard({
  item,
  categories,
  saving,
  onChange,
  onSave,
  onDelete,
}) {
  const hasDiscount =
    Number(item.discountPercent) > 0

  const discountedPrice = hasDiscount
    ? Number(item.price) *
      (1 - Number(item.discountPercent) / 100)
    : Number(item.price)

  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border bg-panel transition duration-300 ${
        item.available
          ? 'border-line hover:border-white/15'
          : 'border-line/70 opacity-60'
      }`}
    >

      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-panel-light">

        {item.image ? (
          <img
            src={item.image}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon
              size={30}
              className="text-cream/10"
            />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

        {/* Availability */}
        <div className="absolute left-3 top-3">

          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold backdrop-blur-md ${
              item.available
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                : 'border-white/10 bg-black/40 text-white/40'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                item.available
                  ? 'bg-emerald-400'
                  : 'bg-white/30'
              }`}
            />

            {item.available
              ? 'Available'
              : 'Unavailable'}
          </span>

        </div>

        {/* Best / discount */}
        <div className="absolute right-3 top-3 flex gap-2">

          {item.isBest && (
            <span className="flex items-center gap-1 rounded-full border border-yellow-400/20 bg-black/40 px-2.5 py-1.5 text-[10px] font-semibold text-yellow-300 backdrop-blur-md">
              <Star
                size={11}
                fill="currentColor"
              />
              Best
            </span>
          )}

          {hasDiscount && (
            <span className="rounded-full border border-red-400/20 bg-red-500/20 px-2.5 py-1.5 text-[10px] font-semibold text-red-300 backdrop-blur-md">
              -{item.discountPercent}%
            </span>
          )}

        </div>

        {/* Name over image */}
        <div className="absolute bottom-3 left-4 right-4">

          <p className="font-display text-xl font-semibold text-white">
            {item.name}
          </p>

          <div className="mt-1 flex items-center gap-2">

            <span className="text-sm font-semibold text-white">
              {formatMoney(discountedPrice)}
            </span>

            {hasDiscount && (
              <span className="text-xs text-white/40 line-through">
                {formatMoney(item.price)}
              </span>
            )}

          </div>

        </div>

      </div>

      {/* Controls */}
      <div className="p-4">

        <div className="grid grid-cols-2 gap-3">

          <Field label="Name">
            <input
              value={item.name}
              onChange={(event) =>
                onChange(
                  item.id,
                  'name',
                  event.target.value
                )
              }
              className="field-input"
            />
          </Field>

          <Field label="Category">
            <select
              value={item.categoryId}
              onChange={(event) =>
                onChange(
                  item.id,
                  'categoryId',
                  event.target.value
                )
              }
              className="field-input"
            >
              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">

          <Field label="Price">
            <div className="relative">
              <input
                type="number"
                value={item.price}
                onChange={(event) =>
                  onChange(
                    item.id,
                    'price',
                    event.target.value
                  )
                }
                className="field-input pr-12"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-cream/25">
                DA
              </span>
            </div>
          </Field>

          <Field label="Discount">
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={item.discountPercent}
                onChange={(event) =>
                  onChange(
                    item.id,
                    'discountPercent',
                    event.target.value
                  )
                }
                className="field-input pr-9"
              />

              <Percent
                size={12}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/25"
              />
            </div>
          </Field>

        </div>

        <Field
          label="Image path"
          className="mt-3"
        >
          <input
            value={item.image}
            onChange={(event) =>
              onChange(
                item.id,
                'image',
                event.target.value
              )
            }
            placeholder="/images/menu/..."
            className="field-input"
          />
        </Field>

        {/* Toggles */}
        <div className="mt-4 flex flex-wrap gap-2">

          <Toggle
            checked={item.available}
            onChange={(value) =>
              onChange(
                item.id,
                'available',
                value
              )
            }
          >
            Available
          </Toggle>

          <Toggle
            checked={item.isBest}
            onChange={(value) =>
              onChange(
                item.id,
                'isBest',
                value
              )
            }
          >
            <Star
              size={12}
              fill={item.isBest ? 'currentColor' : 'none'}
            />
            Best dish
          </Toggle>

        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">

          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs text-cream/30 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 size={14} />
            Delete
          </button>

          <button
            type="button"
            onClick={() => onSave(item)}
            disabled={saving}
            className="flex h-9 items-center gap-2 rounded-xl bg-maroon px-4 text-xs font-semibold text-cream transition hover:bg-maroon-bright disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving
              </>
            ) : (
              <>
                <Save size={14} />
                Save changes
              </>
            )}
          </button>

        </div>

      </div>

    </article>
  )
}


/* -------------------------------------------------------------------------- */
/* ADD ITEM                                                                   */
/* -------------------------------------------------------------------------- */

function AddItemPanel({
  categories,
  newItem,
  setNewItem,
  onSubmit,
  onClose,
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-maroon/30 bg-gradient-to-br from-[#160707] to-panel">

      <div className="border-b border-white/[0.06] p-5 sm:p-6">

        <div className="flex items-start justify-between">

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-maroon-bright">
              New dish
            </p>

            <h2 className="mt-1 font-display text-xl font-semibold text-cream">
              Add to your menu
            </h2>

            <p className="mt-1 text-xs text-cream/30">
              Create a new dish and assign it to a category.
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-maroon/30">
            <Plus
              size={18}
              className="text-maroon-bright"
            />
          </div>

        </div>

      </div>

      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6"
      >

        <Field label="ID">
          <input
            required
            placeholder="pizza-11"
            value={newItem.id}
            onChange={(event) =>
              setNewItem({
                ...newItem,
                id: event.target.value,
              })
            }
            className="field-input"
          />
        </Field>

        <Field label="Dish name">
          <input
            required
            placeholder="Margherita Pizza"
            value={newItem.name}
            onChange={(event) =>
              setNewItem({
                ...newItem,
                name: event.target.value,
              })
            }
            className="field-input"
          />
        </Field>

        <Field label="Category">
          <select
            value={newItem.categoryId}
            onChange={(event) =>
              setNewItem({
                ...newItem,
                categoryId: event.target.value,
              })
            }
            className="field-input"
          >
            {categories.map((category) => (
              <option
                key={category.id}
                value={category.id}
              >
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Price">
          <div className="relative">
            <input
              required
              type="number"
              min="0"
              placeholder="1200"
              value={newItem.price}
              onChange={(event) =>
                setNewItem({
                  ...newItem,
                  price: event.target.value,
                })
              }
              className="field-input pr-12"
            />

            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-cream/25">
              DA
            </span>
          </div>
        </Field>

        <Field label="Discount">
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              value={newItem.discountPercent}
              onChange={(event) =>
                setNewItem({
                  ...newItem,
                  discountPercent:
                    event.target.value,
                })
              }
              className="field-input pr-9"
            />

            <Percent
              size={12}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/25"
            />
          </div>
        </Field>

        <Field label="Image path">
          <input
            required
            placeholder="/images/menu/pizza.jpg"
            value={newItem.image}
            onChange={(event) =>
              setNewItem({
                ...newItem,
                image: event.target.value,
              })
            }
            className="field-input"
          />
        </Field>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">

          <button
            type="submit"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-maroon px-5 text-sm font-semibold text-cream transition hover:bg-maroon-bright"
          >
            <Plus size={17} />
            Add dish
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-line px-5 text-sm text-cream/50 transition hover:bg-panel-light hover:text-cream"
          >
            Cancel
          </button>

        </div>

        <p className="text-xs leading-5 text-cream/25 sm:col-span-2 lg:col-span-3">
          Images must already exist inside your
          frontend/public folder. This dashboard does not
          upload image files.
        </p>

      </form>
    </section>
  )
}


/* -------------------------------------------------------------------------- */
/* SMALL COMPONENTS                                                           */
/* -------------------------------------------------------------------------- */

function MenuStat({
  label,
  value,
  accent = false,
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">

      <p className="text-xs text-cream/35">
        {label}
      </p>

      <p
        className={`mt-1 font-display text-2xl font-semibold ${
          accent
            ? 'text-emerald-400'
            : 'text-cream'
        }`}
      >
        {value}
      </p>

    </div>
  )
}

function CategoryButton({
  active,
  children,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 shrink-0 rounded-xl px-4 text-xs font-medium transition ${
        active
          ? 'bg-maroon text-cream'
          : 'text-cream/40 hover:bg-panel-light hover:text-cream'
      }`}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  children,
  className = '',
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-cream/30">
        {label}
      </span>

      {children}
    </label>
  )
}

function Toggle({
  checked,
  onChange,
  children,
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition ${
        checked
          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
          : 'border-line bg-panel-light text-cream/30'
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full ${
          checked
            ? 'bg-emerald-400 text-black'
            : 'bg-white/10'
        }`}
      >
        {checked && <Check size={10} strokeWidth={3} />}
      </span>

      {children}
    </button>
  )
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('fr-DZ')} DA`
}