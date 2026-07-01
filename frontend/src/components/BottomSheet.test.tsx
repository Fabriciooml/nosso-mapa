import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'
import type { Place } from '../types'

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
})
