import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { loadMenuData, MENU_ITEMS, CATEGORIES } from '../data/menu'
import FadeImage from '../components/ui/FadeImage'

// ---- the API layer: a non-JSON "200" must never be mistaken for data -------
describe('api request hardening', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  it('throws (instead of returning empty data) when a 200 answer is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>proxy error</html>', { status: 200, headers: { 'content-type': 'text/html' } })))
    const { fetchMenu } = await import('../services/api')
    await expect(fetchMenu()).rejects.toThrow(/unexpected answer/i)
  })

  it('keeps the HTTP status on errors so callers can tell "no" from "unreachable"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"nope"}', { status: 404 })))
    const { fetchTable } = await import('../services/api')
    await expect(fetchTable('x')).rejects.toMatchObject({ status: 404, message: 'nope' })
  })

  it('tells the dashboard to log out when the staff password is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"Incorrect password."}', { status: 401 })))
    const seen = vi.fn()
    window.addEventListener('mtc-admin-unauthorized', seen)
    const { adminFetchOrders } = await import('../services/api')
    await expect(adminFetchOrders('old-password')).rejects.toThrow()
    expect(seen).toHaveBeenCalledTimes(1)
    window.removeEventListener('mtc-admin-unauthorized', seen)
  })
})

// ---- the menu loader keeps the built-in menu when the server sends junk ----
describe('menu loader', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('ignores malformed rows instead of crashing or blanking the menu', async () => {
    const before = CATEGORIES.length
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ categories: [null, 5, { id: 'ok', name: 'Fine' }], items: [null, { id: 1 }, { id: 'a', categoryId: 'ok', name: 'A', price: 10 }] }), { status: 200 })))
    await loadMenuData()
    expect(CATEGORIES.map((c) => c.id)).toEqual(['ok'])
    expect(MENU_ITEMS.map((i) => i.id)).toEqual(['a'])
    expect(before).toBeGreaterThan(0)
  })

  it('survives an answer without categories/items', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await expect(loadMenuData()).resolves.toBeUndefined()
  })
})

// ---- the image wrapper must not collapse (the "missing pictures" bug) ------
describe('FadeImage', () => {
  it('does not add "relative" when the caller positions it absolutely', () => {
    const { container } = render(<FadeImage src="/x.png" className="absolute inset-0" />)
    const wrapper = container.firstChild
    expect(wrapper.className).toContain('absolute')
    expect(wrapper.className).not.toMatch(/(^|\s)relative(\s|$)/)
  })

  it('adds "relative" when the caller gave no position', () => {
    const { container } = render(<FadeImage src="/x.png" className="h-10 w-10" />)
    expect(container.firstChild.className).toMatch(/(^|\s)relative(\s|$)/)
  })
})
