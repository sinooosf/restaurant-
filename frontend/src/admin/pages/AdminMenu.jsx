import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChefHat,
  ChevronRight,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  Star,
  Tag,
  ToggleRight,
  Trash2,
  Utensils,
} from 'lucide-react'
import { useAdminAuth } from '../AdminAuthContext'
import {
  adminCreateCategory,
  adminCreateMenuItem,
  adminDeleteCategory,
  adminDeleteMenuItem,
  adminFetchCategories,
  adminFetchMenuItems,
  adminUpdateMenuItem,
} from '../../services/api'
import {
  Card,
  CardTitle,
  Dropdown,
  ErrorBanner,
  Field,
  GhostButton,
  GoodFoodCard,
  Modal,
  PageTop,
  PrimaryButton,
  Spinner,
  StatCard,
} from '../components/ui'
import { money } from '../components/format'
import FadeImage from '../../components/ui/FadeImage'

// Each category gets its own color badge (cycled).
const BADGES = [
  'bg-[#6b0f16] text-[#ffb3b8]',
  'bg-[#8a4b0f] text-[#ffd9a8]',
  'bg-[#3b2a8a] text-[#cfc5ff]',
  'bg-[#0f5a3a] text-[#a8f0cd]',
  'bg-[#0b3f8f] text-[#b7d3ff]',
  'bg-[#0f5a63] text-[#a8eef5]',
]

const EMPTY_ITEM = {
  categoryId: '',
  name: '',
  price: '',
  image: '',
  discountPercent: 0,
  isBest: false,
  available: true,
}

const finalPrice = (item) =>
  Math.round(item.price * (1 - (Number(item.discountPercent) || 0) / 100))

export default function AdminMenu() {
  const { password } = useAdminAuth()
  const [params, setParams] = useSearchParams()

  const [items, setItems] = useState(null)
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [editing, setEditing] = useState(null) // an item, or EMPTY_ITEM for "add"
  const [addingCategory, setAddingCategory] = useState(false)
  const [savingId, setSavingId] = useState(null)

  const load = useCallback(async () => {
    try {
      const [menu, cats] = await Promise.all([
        adminFetchMenuItems(password),
        adminFetchCategories(password),
      ])
      setItems(menu)
      setCategories(cats)
    } catch (err) {
      setError(err.message)
    }
  }, [password])

  useEffect(() => {
    load()
  }, [load])

  // The assistant's "Add a new menu item" shortcut opens /admin/menu?new=1
  useEffect(() => {
    if (params.get('new') && categories.length) {
      setEditing({ ...EMPTY_ITEM, categoryId: categories[0].id })
      setParams({}, { replace: true })
    }
  }, [params, categories, setParams])

  const badgeFor = useMemo(() => {
    const map = {}
    categories.forEach((c, i) => (map[c.id] = BADGES[i % BADGES.length]))
    return (id) => map[id] || BADGES[0]
  }, [categories])

  const nameOf = (id) => categories.find((c) => c.id === id)?.name || id

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (items || []).filter(
      (item) =>
        (activeCategory === 'all' || item.categoryId === activeCategory) &&
        (!term || item.name.toLowerCase().includes(term))
    )
  }, [items, search, activeCategory])

  async function patchItem(item, changes) {
    setSavingId(item.id)
    try {
      const updated = await adminUpdateMenuItem(password, item.id, {
        categoryId: item.categoryId,
        name: item.name,
        price: Number(item.price),
        image: item.image,
        available: item.available,
        discountPercent: Number(item.discountPercent) || 0,
        isBest: item.isBest,
        ...changes,
      })
      setItems((prev) => prev.map((c) => (c.id === item.id ? updated : c)))
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}" from the menu?`)) return
    try {
      await adminDeleteMenuItem(password, item.id)
      setItems((prev) => prev.filter((c) => c.id !== item.id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleSave(form) {
    setError('')
    try {
      if (form.id) {
        const ok = await patchItem(form, {
          ...form,
          price: Number(form.price),
          discountPercent: Number(form.discountPercent) || 0,
        })
        if (!ok) return
      } else {
        const created = await adminCreateMenuItem(password, {
          ...form,
          price: Number(form.price),
          discountPercent: Number(form.discountPercent) || 0,
        })
        setItems((prev) => [...prev, created])
      }
      setEditing(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddCategory(form) {
    try {
      const created = await adminCreateCategory(password, form)
      setCategories((prev) => [...prev, created])
      setAddingCategory(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteCategory(category) {
    if (!window.confirm(`Delete the "${category.name}" category?`)) return
    try {
      await adminDeleteCategory(password, category.id)
      setCategories((prev) => prev.filter((c) => c.id !== category.id))
      if (activeCategory === category.id) setActiveCategory('all')
    } catch (err) {
      setError(err.message)
    }
  }

  const countIn = (id) => (items || []).filter((i) => i.categoryId === id).length

  return (
    <div className="space-y-6">
      <PageTop
        icon={<Utensils size={34} />}
        title="Menu"
        subtitle="Manage your food and drink items, categories and availability."
      />

      <ErrorBanner message={error} onClose={() => setError('')} />

      {!items ? (
        <div className="flex justify-center py-32">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr]">
            <StatCard icon={<Utensils size={26} />} tone="red" label="Total Items" value={items.length} sub="food & drinks" />
            <StatCard icon={<ToggleRight size={28} />} tone="green" label="Available Items" value={items.filter((i) => i.available).length} sub="in stock" />
            <StatCard icon={<Tag size={26} />} tone="orange" label="Categories" value={categories.length} sub="total" />
            <StatCard icon={<Star size={26} fill="currentColor" />} tone="purple" label="Best Sellers" value={items.filter((i) => i.isBest).length} sub="most ordered" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
            {/* Items */}
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px] flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for items..."
                    className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#121215] pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#f0222c]/60"
                  />
                </div>
                <Dropdown
                  value={activeCategory}
                  onChange={setActiveCategory}
                  options={[{ value: 'all', label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                  icon={<LayoutGrid size={16} className="text-white/70" />}
                  className="w-[190px]"
                  align="left"
                />
                <PrimaryButton
                  className="h-11"
                  onClick={() => setEditing({ ...EMPTY_ITEM, categoryId: categories[0]?.id || '' })}
                >
                  <Plus size={18} /> Add Item
                </PrimaryButton>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[{ id: 'all', name: 'All' }, ...categories].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                      activeCategory === c.id
                        ? 'bg-[#e11d28] text-white'
                        : 'bg-white/[0.06] text-white/75 hover:bg-white/[0.11]'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visible.length === 0 && (
                  <p className="col-span-full py-16 text-center text-white/40">No items found.</p>
                )}

                {visible.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    categoryName={nameOf(item.categoryId)}
                    badge={badgeFor(item.categoryId)}
                    saving={savingId === item.id}
                    onToggle={() => patchItem(item, { available: !item.available })}
                    onEdit={() => setEditing(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </div>
            </Card>

            {/* Right column */}
            <div className="space-y-4">
              <Card className="p-5">
                <CardTitle
                  icon={<List size={22} />}
                  title="Categories"
                  action={
                    <button type="button" onClick={() => setAddingCategory(true)} className="text-xs font-medium text-[#f0222c] hover:text-[#ff5a63]">
                      + Add Category
                    </button>
                  }
                />

                <ul className="mt-3 divide-y divide-white/[0.06]">
                  {categories.map((c) => (
                    <li key={c.id} className="group flex items-center gap-3 py-3">
                      <button
                        type="button"
                        onClick={() => setActiveCategory(c.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <FadeImage src={c.image} className="h-11 w-11 shrink-0 rounded-full bg-white/5" imgClassName="object-contain p-1" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">{c.name}</span>
                          <span className="block text-xs text-white/45">{countIn(c.id)} items</span>
                        </span>
                      </button>
                      {countIn(c.id) === 0 && (
                        <button type="button" onClick={() => handleDeleteCategory(c)} aria-label={`Delete ${c.name}`} className="text-white/30 opacity-0 transition hover:text-red-400 group-hover:opacity-100">
                          <Trash2 size={15} />
                        </button>
                      )}
                      <ChevronRight size={16} className="text-white/50" />
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="flex items-center gap-4 p-5">
                <ChefHat size={38} className="shrink-0 text-[#f0222c]" strokeWidth={1.4} />
                <div>
                  <p className="text-[15px] font-semibold text-white">Keep your menu fresh</p>
                  <p className="mt-1 text-xs text-white/50">Add new items, update prices and keep your customers happy!</p>
                </div>
              </Card>

              <GoodFoodCard className="h-[150px]" />
            </div>
          </div>
        </>
      )}

      {editing && (
        <ItemModal
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
      {addingCategory && (
        <CategoryModal onClose={() => setAddingCategory(false)} onSave={handleAddCategory} />
      )}
    </div>
  )
}

function ItemCard({ item, categoryName, badge, saving, onToggle, onEdit, onDelete }) {
  const discounted = Number(item.discountPercent) > 0

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b0b0d] p-3 transition ${item.available ? '' : 'opacity-60'}`}>
      <div className="relative">
        <FadeImage src={item.image} alt={item.name} className="h-[120px] w-full rounded-xl bg-white/5" />
        {item.isBest && (
          <span className="absolute left-2 top-2 rounded-md bg-[#d9151f] px-2 py-0.5 text-[11px] font-medium text-white">
            Best Seller
          </span>
        )}
        {discounted && (
          <span className="absolute right-2 top-2 rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-black">
            -{item.discountPercent}%
          </span>
        )}
      </div>

      <h3 className="mt-3 truncate text-[15px] font-semibold text-white">{item.name}</h3>
      <span className={`mt-2 inline-block rounded-md px-2.5 py-0.5 text-[11px] font-medium ${badge}`}>{categoryName}</span>

      <p className="mt-2.5 text-[17px] font-bold text-white">
        {money(finalPrice(item))}
        {discounted && <span className="ml-2 text-xs font-normal text-white/40 line-through">{money(item.price)}</span>}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={saving}
          role="switch"
          aria-checked={item.available}
          aria-label={`${item.name} availability`}
          className={`relative h-[22px] w-10 shrink-0 rounded-full transition ${item.available ? 'bg-emerald-500' : 'bg-white/20'}`}
        >
          <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all ${item.available ? 'left-[21px]' : 'left-[3px]'}`} />
        </button>
        <span className="flex-1 text-xs text-white/70">{item.available ? 'Available' : 'Hidden'}</span>
        <button type="button" onClick={onEdit} aria-label={`Edit ${item.name}`} className="text-white/55 transition hover:text-white">
          <Pencil size={16} />
        </button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${item.name}`} className="text-white/55 transition hover:text-red-400">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

function ItemModal({ initial, categories, onClose, onSave }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const editingExisting = Boolean(initial.id)

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <Modal title={editingExisting ? 'Edit item' : 'Add item'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className="input" required value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Price (DH)">
            <input className="input" type="number" min="0" required value={form.price} onChange={(e) => set('price', e.target.value)} />
          </Field>
        </div>

        <Field label="Image path" hint="Example: /images/menu/pizza/pizza1.jpg">
          <input className="input" required value={form.image} onChange={(e) => set('image', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount %">
            <input className="input" type="number" min="0" max="90" value={form.discountPercent} onChange={(e) => set('discountPercent', e.target.value)} />
          </Field>
          <div className="flex flex-col justify-end gap-2 pb-1 text-sm text-white/80">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isBest} onChange={(e) => set('isBest', e.target.checked)} className="accent-[#d9151f]" />
              Best seller
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.available} onChange={(e) => set('available', e.target.checked)} className="accent-[#d9151f]" />
              Available
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}

const CATEGORY_IMAGES = [
  ['/images/categories/pizza.png', 'Pizza'],
  ['/images/categories/sandwich.png', 'Sandwich'],
  ['/images/categories/soup.png', 'Soup'],
  ['/images/categories/drink.png', 'Drink'],
]

function CategoryModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [image, setImage] = useState(CATEGORY_IMAGES[0][0])
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    await onSave({ name, image })
    setSaving(false)
  }

  return (
    <Modal title="Add category" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Desserts" />
        </Field>

        <Field label="Picture">
          <div className="flex gap-2">
            {CATEGORY_IMAGES.map(([src, label]) => (
              <button
                key={src}
                type="button"
                onClick={() => setImage(src)}
                aria-label={label}
                className={`h-14 w-14 rounded-xl border p-1.5 transition ${image === src ? 'border-[#f0222c] bg-[#f0222c]/10' : 'border-white/10 bg-white/[0.03]'}`}
              >
                <img src={src} alt={label} className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add category'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}
