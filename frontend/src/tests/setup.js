import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement these browser features.
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {}

// The cart and the "last order" are remembered in localStorage per table, so
// every test must start from an empty browser.
import { beforeEach } from 'vitest'
beforeEach(() => {
  localStorage.clear()
})
