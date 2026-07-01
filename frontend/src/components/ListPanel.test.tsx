import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ListPanel } from './ListPanel'
import type { Place } from '../types'

const PLACES: Place[] = [
  {
    id: 1,
    name: 'Lugar Perto',
    google_place_id: null,
    lat: 1,
    lng: 1,
    status: 'to_go',
    avg_rating: null,
    categories: [],
    created_at: '',
  },
  {
    id: 2,
    name: 'Lugar Longe',
    google_place_id: null,
    lat: 10,
    lng: 10,
    status: 'gone',
    avg_rating: null,
    categories: [],
    created_at: '',
  },
]

const defaultProps = {
  places: PLACES,
  selectedId: null,
  onSelect: vi.fn(),
  onAddPlace: vi.fn(),
  centerLat: 0,
  centerLng: 0,
  statusFilter: [] as import('../types').PlaceStatus[],
  onStatusToggle: vi.fn(),
  categoryFilter: [] as number[],
  onCategoryToggle: vi.fn(),
  categories: [],
}

describe('ListPanel', () => {
  it('renders wordmark', () => {
    render(<ListPanel {...defaultProps} />)
    expect(screen.getByText('Nosso Mapa')).toBeInTheDocument()
  })

  it('renders sorted places (nearest first)', () => {
    render(<ListPanel {...defaultProps} />)
    const items = screen.getAllByRole('button', { name: /Lugar/ })
    // Lugar Perto (distance ~1.41) before Lugar Longe (distance ~14.14)
    expect(items[0]).toHaveTextContent('Lugar Perto')
    expect(items[1]).toHaveTextContent('Lugar Longe')
  })

  it('calls onSelect when place clicked', async () => {
    const onSelect = vi.fn()
    render(<ListPanel {...defaultProps} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Lugar Perto'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('calls onAddPlace when add button clicked', async () => {
    const onAddPlace = vi.fn()
    render(<ListPanel {...defaultProps} onAddPlace={onAddPlace} />)
    await userEvent.click(screen.getByText('+ Adicionar lugar'))
    expect(onAddPlace).toHaveBeenCalledOnce()
  })

  it('filters places by status', () => {
    render(<ListPanel {...defaultProps} statusFilter={['to_go']} />)
    expect(screen.getByText('Lugar Perto')).toBeInTheDocument()
    expect(screen.queryByText('Lugar Longe')).not.toBeInTheDocument()
  })
})
