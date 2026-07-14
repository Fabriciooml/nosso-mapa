import { fireEvent, render, screen } from '@testing-library/react'
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
    const row = container.querySelector('[role="button"]')
    expect(row?.className).toMatch(/selected/)
  })

  it('shows +N chip and hides overflow categories when more than 2', () => {
    const placeWithManyCategories = {
      ...PLACE,
      categories: [
        { id: 1, name: 'Restaurante' },
        { id: 2, name: 'Café' },
        { id: 3, name: 'Museu' },
        { id: 4, name: 'Cinema' },
      ],
    }
    render(<PlaceItem place={placeWithManyCategories} distanceLabel="0 km" onClick={vi.fn()} />)
    expect(screen.getByText('Restaurante')).toBeInTheDocument()
    expect(screen.getByText('Café')).toBeInTheDocument()
    expect(screen.queryByText('Museu')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('expanding categories does not trigger row onClick', async () => {
    const onClick = vi.fn()
    const placeWithManyCategories = {
      ...PLACE,
      categories: [
        { id: 1, name: 'Restaurante' },
        { id: 2, name: 'Café' },
        { id: 3, name: 'Museu' },
      ],
    }
    render(<PlaceItem place={placeWithManyCategories} distanceLabel="0 km" onClick={onClick} />)
    await userEvent.click(screen.getByText('+1'))
    expect(screen.getByText('Museu')).toBeInTheDocument()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('pressing Enter on the +N toggle does not trigger row onClick', () => {
    const onClick = vi.fn()
    const placeWithManyCategories = {
      ...PLACE,
      categories: [
        { id: 1, name: 'Restaurante' },
        { id: 2, name: 'Café' },
        { id: 3, name: 'Museu' },
      ],
    }
    render(<PlaceItem place={placeWithManyCategories} distanceLabel="0 km" onClick={onClick} />)
    fireEvent.keyDown(screen.getByText('+1'), { key: 'Enter' })
    expect(onClick).not.toHaveBeenCalled()
  })
})
