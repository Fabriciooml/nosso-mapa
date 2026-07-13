import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { PlaceDetail } from './PlaceDetail'
import type { Place } from '../types'

vi.mock('../hooks/usePlaces', () => ({
  useUpdateStatus: () => ({ mutate: vi.fn() }),
  useAddReview: () => ({ mutate: vi.fn() }),
}))

vi.mock('../hooks/useIdentity', () => ({
  useIdentity: () => ({ name: 'Fab' }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const PLACE: Place = {
  id: 1,
  name: 'Pastéis de Belém',
  google_place_id: null,
  lat: 38.697,
  lng: -9.203,
  status: 'to_go',
  avg_rating: 4.5,
  alias: null,
  description: null,
  categories: [{ id: 1, name: 'Café' }],
  created_at: '2026-01-01T00:00:00',
}

describe('PlaceDetail', () => {
  it('renders place name', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Pastéis de Belém')).toBeInTheDocument()
  })

  it('renders category', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Café')).toBeInTheDocument()
  })

  it('renders all 3 status buttons', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('📍 A ir')).toBeInTheDocument()
    expect(screen.getByText('✓ Fomos')).toBeInTheDocument()
    expect(screen.getByText('❤ Repetir')).toBeInTheDocument()
  })

  it('shows review form when Avaliar clicked', async () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByText('Avaliar'))
    expect(screen.getByText('Salvar')).toBeInTheDocument()
  })

  it('hides review form when Cancelar clicked', async () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByText('Avaliar'))
    await userEvent.click(screen.getByText('Cancelar'))
    expect(screen.queryByText('Salvar')).not.toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<PlaceDetail place={PLACE} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
