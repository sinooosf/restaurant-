import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderExtras } from '../admin/components/ui'

describe('OrderExtras (dashboard)', () => {
  it('shows a delivery order\'s phone, address and note as visible text', () => {
    render(
      <OrderExtras order={{ type: 'delivery', phone: '0555 12 34 56', address: 'Rue 5, Blida', note: 'no onions' }} />,
    )
    expect(screen.getByText('0555 12 34 56')).toBeVisible()
    expect(screen.getByText(/Rue 5, Blida/)).toBeVisible()
    expect(screen.getByText('no onions')).toBeVisible()
  })

  it('shows nothing for an ordinary order without a note', () => {
    const { container } = render(<OrderExtras order={{ type: 'table', phone: '', address: '', note: '' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
