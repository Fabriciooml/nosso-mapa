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

  it('shows +N chip and expands to show all categories when more than 3', async () => {
    const placeWithManyCategories = {
      ...PLACE,
      categories: [
        { id: 1, name: 'Café' },
        { id: 2, name: 'Restaurante' },
        { id: 3, name: 'Museu' },
        { id: 4, name: 'Cinema' },
      ],
    }
    render(<PlaceDetail place={placeWithManyCategories} onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByText('Cinema')).not.toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    await userEvent.click(screen.getByText('+1'))
    expect(screen.getByText('Cinema')).toBeInTheDocument()
  })

  it('resets expanded categories when switching to a different place', async () => {
    const placeWithManyCategories = {
      ...PLACE,
      categories: [
        { id: 1, name: 'Café' },
        { id: 2, name: 'Restaurante' },
        { id: 3, name: 'Museu' },
        { id: 4, name: 'Cinema' },
      ],
    }
    const { rerender } = render(
      <PlaceDetail place={placeWithManyCategories} onClose={vi.fn()} />,
      { wrapper },
    )
    await userEvent.click(screen.getByText('+1'))
    expect(screen.getByText('Cinema')).toBeInTheDocument()

    const otherPlace = { ...placeWithManyCategories, id: 2, name: 'Outro lugar' }
    rerender(<PlaceDetail place={otherPlace} onClose={vi.fn()} />)
    expect(screen.queryByText('Cinema')).not.toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('does not render google info section when fields are absent', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByTestId('google-info')).not.toBeInTheDocument()
  })

  it('renders website link when set', () => {
    const place = { ...PLACE, website: 'https://example.com' }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    const link = screen.getByText('🔗 Website')
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders price level as $ symbols', () => {
    const place = { ...PLACE, price_level: 3 }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('$$$')).toBeInTheDocument()
  })

  it('clamps out-of-range price_level instead of crashing', () => {
    const place = { ...PLACE, price_level: 99 }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('$$$$')).toBeInTheDocument()
  })

  it('does not render a clickable link for javascript: URL scheme', () => {
    const place = { ...PLACE, website: 'javascript:alert(1)' }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByText('🔗 Website')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('does not render google info wrapper for unsafe website with no other fields', () => {
    const place = { ...PLACE, website: 'javascript:alert(1)' }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByTestId('google-info')).not.toBeInTheDocument()
  })

  it('clamps negative price_level instead of crashing', () => {
    const place = { ...PLACE, price_level: -3 }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('$')).toBeInTheDocument()
  })

  it('renders Grátis when price_level is 0', () => {
    const place = { ...PLACE, price_level: 0 }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Grátis')).toBeInTheDocument()
  })

  it('renders opening hours as a list', () => {
    const place = {
      ...PLACE,
      opening_hours: ['segunda: 09:00–18:00', 'terça: 09:00–18:00'],
    }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('segunda: 09:00–18:00')).toBeInTheDocument()
    expect(screen.getByText('terça: 09:00–18:00')).toBeInTheDocument()
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
