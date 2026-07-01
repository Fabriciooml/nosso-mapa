import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import App from './App'

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Map: () => <div data-testid="map" />,
  AdvancedMarker: () => null,
  useMapsLibrary: () => null,
}))

vi.mock('./hooks/usePlaces', () => ({
  usePlaces: () => ({ data: [] }),
  useCreatePlace: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStatus: () => ({ mutate: vi.fn() }),
  useAddReview: () => ({ mutate: vi.fn() }),
}))

vi.mock('./hooks/useCategories', () => ({
  useCategories: () => ({ data: [] }),
  useCreateCategory: () => ({ mutate: vi.fn() }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('App', () => {
  it('shows IdentityModal when no name stored', () => {
    localStorage.clear()
    render(<App />, { wrapper })
    expect(screen.getByText('Quem é você?')).toBeInTheDocument()
  })

  it('shows map when name is set', () => {
    localStorage.setItem('nosso_mapa_identity', 'Fab')
    render(<App />, { wrapper })
    expect(screen.getAllByTestId('map').length).toBeGreaterThan(0)
  })

  it('shows name chip when identity set', () => {
    localStorage.setItem('nosso_mapa_identity', 'Fab')
    render(<App />, { wrapper })
    expect(screen.getByText('Fab')).toBeInTheDocument()
  })
})
