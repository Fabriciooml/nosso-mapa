import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { AddPlaceModal } from './AddPlaceModal'

vi.mock('@vis.gl/react-google-maps', () => ({
  useMapsLibrary: () => null,
}))

const createPlaceMock = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
}

vi.mock('../hooks/usePlaces', () => ({
  useCreatePlace: () => createPlaceMock,
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: [{ id: 1, name: 'Café' }, { id: 2, name: 'Museu' }] }),
  useCreateCategory: () => ({ mutate: vi.fn() }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  createPlaceMock.isError = false
  createPlaceMock.error = null
})

describe('AddPlaceModal', () => {
  it('renders modal title', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Adicionar lugar')).toBeInTheDocument()
  })

  it('renders existing category chips', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Café')).toBeInTheDocument()
    expect(screen.getByText('Museu')).toBeInTheDocument()
  })

  it('save button disabled when no place selected', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Salvar')).toBeDisabled()
  })

  it('calls onClose when Cancelar clicked', async () => {
    const onClose = vi.fn()
    render(<AddPlaceModal onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<AddPlaceModal onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('category chip toggles aria-pressed', async () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    const chip = screen.getByText('Café').closest('button')!
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('+ button disabled when new category input is empty', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('+')).toBeDisabled()
  })

  it('shows error message when place already in list (409)', () => {
    createPlaceMock.isError = true
    createPlaceMock.error = new Error('409 Conflict')
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Lugar já está na lista')).toBeInTheDocument()
  })

  it('does not show error when no error', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByText('Lugar já está na lista')).not.toBeInTheDocument()
  })
})
