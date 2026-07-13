import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { PlaceDetail } from './PlaceDetail'
import type { Place } from '../types'

const deleteMutate = vi.fn()

vi.mock('../hooks/usePlaces', () => ({
  useUpdateStatus: () => ({ mutate: vi.fn() }),
  useAddReview: () => ({ mutate: vi.fn() }),
  useDeletePlace: () => ({ mutate: deleteMutate }),
  useUpdatePlace: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../hooks/useIdentity', () => ({
  useIdentity: () => ({ name: 'Fab' }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: [] }),
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
  categories: [{ id: 1, name: 'Café' }],
  created_at: '2026-01-01T00:00:00',
  alias: null,
  description: null,
}

beforeEach(() => vi.clearAllMocks())

describe('PlaceDetail', () => {
  it('renders place name when no alias', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Pastéis de Belém')).toBeInTheDocument()
  })

  it('renders alias instead of name when alias set', () => {
    const placeWithAlias = { ...PLACE, alias: 'Pastéis Famosos' }
    render(<PlaceDetail place={placeWithAlias} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Pastéis Famosos')
  })

  it('renders description when set', () => {
    const placeWithDesc = { ...PLACE, description: 'Lugar incrível' }
    render(<PlaceDetail place={placeWithDesc} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Lugar incrível')).toBeInTheDocument()
  })

  it('does not render description section when null', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByTestId('description')).not.toBeInTheDocument()
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

  it('renders Editar and Excluir buttons', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Excluir')).toBeInTheDocument()
  })

  it('opens EditPlaceModal when Editar clicked', async () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByText('Editar'))
    expect(screen.getByText('Editar lugar')).toBeInTheDocument()
  })

  it('calls deletePlace and onClose when Excluir confirmed', async () => {
    const onClose = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteMutate.mockImplementationOnce((_id: number, { onSuccess }: { onSuccess: () => void }) => onSuccess())
    render(<PlaceDetail place={PLACE} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByText('Excluir'))
    expect(confirmSpy).toHaveBeenCalledWith('Excluir lugar?')
    expect(deleteMutate).toHaveBeenCalledWith(PLACE.id, expect.any(Object))
    expect(onClose).toHaveBeenCalledOnce()
    confirmSpy.mockRestore()
  })

  it('does not call deletePlace when Excluir cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByText('Excluir'))
    expect(deleteMutate).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
