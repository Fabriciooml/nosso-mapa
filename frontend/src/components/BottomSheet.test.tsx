import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'
import type { Place, MapBounds } from '../types'

const PLACE: Place = {
  id: 1,
  name: 'Café Central',
  google_place_id: null,
  lat: 0,
  lng: 0,
  status: 'to_go',
  avg_rating: null,
  categories: [],
  created_at: '',
}

const defaultProps = {
  places: [PLACE],
  selectedId: null,
  onSelect: vi.fn(),
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
}

describe('BottomSheet', () => {
  it('renders place item', () => {
    render(<BottomSheet {...defaultProps} />)
    expect(screen.getByText('Café Central')).toBeInTheDocument()
  })

  it('toggle handle changes aria-label', async () => {
    render(<BottomSheet {...defaultProps} />)
    const handle = screen.getByRole('button', { name: 'Expandir lista' })
    await userEvent.click(handle)
    expect(screen.getByRole('button', { name: 'Recolher lista' })).toBeInTheDocument()
  })

  it('calls onSelect when place clicked', async () => {
    const onSelect = vi.fn()
    render(<BottomSheet {...defaultProps} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Café Central'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('shows place when onScreenOnly=true and place is in bounds', () => {
    // PLACE is at lat:0, lng:0 — inside bounds [-1,1] x [-1,1]
    const bounds: MapBounds = { north: 1, south: -1, east: 1, west: -1 }
    render(<BottomSheet {...defaultProps} onScreenOnly={true} mapBounds={bounds} />)
    expect(screen.getByText('Café Central')).toBeInTheDocument()
  })

  it('shows empty state when onScreenOnly=true and place is outside bounds', () => {
    // PLACE is at lat:0, lng:0 — outside bounds [5,10] x [5,10]
    const bounds: MapBounds = { north: 10, south: 5, east: 10, west: 5 }
    render(<BottomSheet {...defaultProps} onScreenOnly={true} mapBounds={bounds} />)
    expect(screen.getByText('Nenhum lugar nesta área')).toBeInTheDocument()
    expect(screen.queryByText('Café Central')).not.toBeInTheDocument()
  })
})
