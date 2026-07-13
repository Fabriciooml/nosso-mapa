import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { EditPlaceModal } from './EditPlaceModal'
import type { Place } from '../types'

vi.mock('../hooks/usePlaces', () => ({
  useUpdatePlace: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: [{ id: 1, name: 'Café' }, { id: 2, name: 'Museu' }] }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const PLACE: Place = {
  id: 1,
  name: 'Pastéis de Belém',
  google_place_id: 'ChIJabc',
  lat: 38.697,
  lng: -9.203,
  status: 'to_go',
  avg_rating: null,
  categories: [{ id: 1, name: 'Café' }],
  created_at: '2026-01-01T00:00:00',
  alias: 'Pastéis',
  description: '# Bom lugar',
}

beforeEach(() => vi.clearAllMocks())

describe('EditPlaceModal', () => {
  it('renders modal title', () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Editar lugar')).toBeInTheDocument()
  })

  it('shows locked place name', () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Pastéis de Belém')).toBeInTheDocument()
  })

  it('pre-fills alias input', () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    const input = screen.getByPlaceholderText('Pastéis de Belém') as HTMLInputElement
    expect(input.value).toBe('Pastéis')
  })

  it('pre-fills description textarea', () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    const textarea = screen.getByRole('textbox', { name: /descrição/i }) as HTMLTextAreaElement
    expect(textarea.value).toBe('# Bom lugar')
  })

  it('pre-selects category chips', () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    const caféChip = screen.getByText('Café').closest('button')!
    expect(caféChip).toHaveAttribute('aria-pressed', 'true')
    const museuChip = screen.getByText('Museu').closest('button')!
    expect(museuChip).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onClose when Cancelar clicked', async () => {
    const onClose = vi.fn()
    render(<EditPlaceModal place={PLACE} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<EditPlaceModal place={PLACE} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('category chip toggles aria-pressed', async () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    const museuChip = screen.getByText('Museu').closest('button')!
    await userEvent.click(museuChip)
    expect(museuChip).toHaveAttribute('aria-pressed', 'true')
  })
})
