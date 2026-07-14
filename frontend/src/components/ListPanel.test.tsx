import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ListPanel } from './ListPanel'
import type { Place, MapBounds } from '../types'

const PLACES: Place[] = [
  {
    id: 1,
    name: 'Lugar Perto',
    alias: null,
    description: null,
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
    alias: null,
    description: null,
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
  onScreenOnly: false,
  mapBounds: null as MapBounds | null,
  onScreenOnlyToggle: vi.fn(),
  searchQuery: '',
  onSearchChange: vi.fn(),
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

  it('shows all places when onScreenOnly=false regardless of mapBounds', () => {
    const bounds: MapBounds = { north: 2, south: 0, east: 2, west: 0 }
    // Lugar Longe (lat:10, lng:10) would be outside, but onScreenOnly=false
    render(<ListPanel {...defaultProps} onScreenOnly={false} mapBounds={bounds} />)
    expect(screen.getByText('Lugar Perto')).toBeInTheDocument()
    expect(screen.getByText('Lugar Longe')).toBeInTheDocument()
  })

  it('filters to bounds when onScreenOnly=true', () => {
    // bounds covers lat 0-2, lng 0-2 — Lugar Perto (1,1) in, Lugar Longe (10,10) out
    const bounds: MapBounds = { north: 2, south: 0, east: 2, west: 0 }
    render(<ListPanel {...defaultProps} onScreenOnly={true} mapBounds={bounds} />)
    expect(screen.getByText('Lugar Perto')).toBeInTheDocument()
    expect(screen.queryByText('Lugar Longe')).not.toBeInTheDocument()
  })

  it('shows empty state when onScreenOnly=true and no places in bounds', () => {
    // bounds far from both places
    const bounds: MapBounds = { north: -10, south: -20, east: -10, west: -20 }
    render(<ListPanel {...defaultProps} onScreenOnly={true} mapBounds={bounds} />)
    expect(screen.getByText('Nenhum lugar nesta área')).toBeInTheDocument()
    expect(screen.queryByText('Lugar Perto')).not.toBeInTheDocument()
  })

  it('filters places by search query', async () => {
    function Wrapper() {
      const [query, setQuery] = useState('')
      return <ListPanel {...defaultProps} searchQuery={query} onSearchChange={setQuery} />
    }
    render(<Wrapper />)
    await userEvent.type(screen.getByPlaceholderText('Buscar lugar...'), 'Perto')
    expect(screen.getByText('Lugar Perto')).toBeInTheDocument()
    expect(screen.queryByText('Lugar Longe')).not.toBeInTheDocument()
  })

  it('shows "Nenhum lugar encontrado" when search matches nothing', async () => {
    function Wrapper() {
      const [query, setQuery] = useState('')
      return <ListPanel {...defaultProps} searchQuery={query} onSearchChange={setQuery} />
    }
    render(<Wrapper />)
    await userEvent.type(screen.getByPlaceholderText('Buscar lugar...'), 'zzz')
    expect(screen.getByText('Nenhum lugar encontrado')).toBeInTheDocument()
  })
})
