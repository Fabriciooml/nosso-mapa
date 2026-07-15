import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { AddPlaceModal } from './AddPlaceModal'

const { MockAutocomplete, getLastInstance } = vi.hoisted(() => {
  let lastInstance: MockAutocompleteType | undefined

  class MockAutocompleteType {
    fields: string[]
    place: Record<string, unknown> = {}
    private listeners: Record<string, () => void> = {}

    constructor(_el: HTMLInputElement, opts: { fields: string[] }) {
      this.fields = opts.fields
      lastInstance = this
    }

    addListener(event: string, cb: () => void) {
      this.listeners[event] = cb
    }

    getPlace() {
      return this.place
    }

    trigger(event: string) {
      this.listeners[event]?.()
    }
  }

  return {
    MockAutocomplete: MockAutocompleteType,
    getLastInstance: () => lastInstance,
  }
})

vi.mock('@vis.gl/react-google-maps', () => ({
  useMapsLibrary: () => ({ Autocomplete: MockAutocomplete }),
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

  it('requests extended place fields from Autocomplete', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(getLastInstance()?.fields).toEqual([
      'place_id', 'name', 'geometry', 'website', 'opening_hours', 'price_level', 'types',
    ])
  })

  it('auto-checks matching category chip when a place is selected', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    const instance = getLastInstance()!
    instance.place = {
      place_id: 'abc',
      name: 'Café Central',
      geometry: { location: { lat: () => 1, lng: () => 2 } },
      website: 'https://cafecentral.pt',
      opening_hours: { weekday_text: ['segunda: 09:00–18:00'] },
      price_level: 1,
      types: ['cafe'],
    }
    act(() => {
      instance.trigger('place_changed')
    })
    const chip = screen.getByText('Café').closest('button')!
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('includes website, opening_hours, price_level in the save payload', async () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    const instance = getLastInstance()!
    instance.place = {
      place_id: 'abc',
      name: 'Café Central',
      geometry: { location: { lat: () => 1, lng: () => 2 } },
      website: 'https://cafecentral.pt',
      opening_hours: { weekday_text: ['segunda: 09:00–18:00'] },
      price_level: 1,
      types: ['cafe'],
    }
    act(() => {
      instance.trigger('place_changed')
    })
    await userEvent.click(screen.getByText('Salvar'))
    expect(createPlaceMock.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        website: 'https://cafecentral.pt',
        opening_hours: ['segunda: 09:00–18:00'],
        price_level: 1,
      }),
      expect.any(Object),
    )
  })
})
