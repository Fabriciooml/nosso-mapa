import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PlaceItem } from './PlaceItem'
import type { Place } from '../types'

const PLACE: Place = {
  id: 1,
  name: 'Cantinho do Avillez',
  alias: null,
  description: null,
  google_place_id: null,
  lat: 38.71,
  lng: -9.14,
  status: 'to_go',
  avg_rating: 4.5,
  categories: [{ id: 1, name: 'Restaurante' }],
  created_at: '2026-01-01T00:00:00',
}

describe('PlaceItem', () => {
  it('renders place name', () => {
    render(<PlaceItem place={PLACE} distanceLabel="0.5 km" onClick={vi.fn()} />)
    expect(screen.getByText('Cantinho do Avillez')).toBeInTheDocument()
  })

  it('renders category name', () => {
    render(<PlaceItem place={PLACE} distanceLabel="0.5 km" onClick={vi.fn()} />)
    expect(screen.getByText('Restaurante')).toBeInTheDocument()
  })

  it('renders distance label', () => {
    render(<PlaceItem place={PLACE} distanceLabel="1.2 km" onClick={vi.fn()} />)
    expect(screen.getByText('1.2 km')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<PlaceItem place={PLACE} distanceLabel="0 km" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies selected style when selected=true', () => {
    const { container } = render(
      <PlaceItem place={PLACE} distanceLabel="0 km" onClick={vi.fn()} selected />,
    )
    const button = container.querySelector('button')
    expect(button?.className).toMatch(/selected/)
  })
})
