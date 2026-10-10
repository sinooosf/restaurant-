import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MenuItemCard from '../components/menu/MenuItemCard'
import { CartProvider } from '../context/CartContext'
import { MENU_ITEMS } from '../data/menu'

function renderCard(item) {
  return render(
    <CartProvider>
      <MenuItemCard item={item} />
    </CartProvider>,
  )
}

describe('MenuItemCard', () => {
  it('shows the plain price when there is no discount', () => {
    const item = MENU_ITEMS.find((i) => i.id === 'pizza-1') // Margherita, 450 DH
    renderCard(item)
    expect(screen.getByText('450 DH')).toBeInTheDocument()
  })

  it('shows the discounted price and the crossed-out original price', () => {
    const item = MENU_ITEMS.find((i) => i.id === 'pizza-10') // Garden Veggie Deluxe, 550 DH, -50%
    renderCard(item)
    expect(screen.getByText('275 DH')).toBeInTheDocument()
    expect(screen.getByText('550 DH')).toBeInTheDocument()
    expect(screen.getByText('-50%')).toBeInTheDocument()
  })

  it('disables adding an unavailable item', () => {
    const item = MENU_ITEMS.find((i) => i.id === 'pizza-9') // marked unavailable
    renderCard(item)
    expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument()
  })

  it('adding an item switches the card into quantity-stepper mode', async () => {
    const user = userEvent.setup()
    const item = MENU_ITEMS.find((i) => i.id === 'drink-1') // Coca-Cola
    renderCard(item)

    await user.click(screen.getByRole('button', { name: /^add coca-cola$/i }))

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove one coca-cola/i })).toBeInTheDocument()
  })
})
