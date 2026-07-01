import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { usePlaces, useCreatePlace, useUpdateStatus, useAddReview } from './usePlaces'
import { api } from '../api'

vi.mock('../api', () => ({
  api: {
    places: {
      list: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      addReview: vi.fn(),
    },
    categories: {
      list: vi.fn(),
      create: vi.fn(),
    },
  },
}))

const mockApi = api as unknown as {
  places: {
    list: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    updateStatus: ReturnType<typeof vi.fn>
    addReview: ReturnType<typeof vi.fn>
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const MOCK_PLACE = {
  id: 1, name: 'X', google_place_id: null, lat: 0, lng: 0,
  status: 'to_go' as const, avg_rating: null, categories: [], created_at: '',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('usePlaces', () => {
  it('fetches and returns places', async () => {
    mockApi.places.list.mockResolvedValue([MOCK_PLACE])
    const { result } = renderHook(() => usePlaces(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([MOCK_PLACE])
  })
})

describe('useCreatePlace', () => {
  it('calls api.places.create with payload', async () => {
    mockApi.places.list.mockResolvedValue([])
    mockApi.places.create.mockResolvedValue(MOCK_PLACE)
    const { result } = renderHook(() => useCreatePlace(), { wrapper })
    const payload = { name: 'X', google_place_id: null, lat: 0, lng: 0, category_ids: [] }
    result.current.mutate(payload)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.places.create).toHaveBeenCalledWith(payload)
  })
})

describe('useUpdateStatus', () => {
  it('calls api.places.updateStatus with id and status', async () => {
    mockApi.places.list.mockResolvedValue([])
    mockApi.places.updateStatus.mockResolvedValue({ ...MOCK_PLACE, status: 'gone' })
    const { result } = renderHook(() => useUpdateStatus(), { wrapper })
    result.current.mutate({ id: 1, status: 'gone' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.places.updateStatus).toHaveBeenCalledWith(1, 'gone')
  })
})

describe('useAddReview', () => {
  it('calls api.places.addReview with id and body', async () => {
    mockApi.places.list.mockResolvedValue([])
    mockApi.places.addReview.mockResolvedValue({ ...MOCK_PLACE, avg_rating: 4.5 })
    const { result } = renderHook(() => useAddReview(), { wrapper })
    result.current.mutate({ id: 1, body: { reviewer: 'Fab', rating: 4.5 } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.places.addReview).toHaveBeenCalledWith(1, { reviewer: 'Fab', rating: 4.5 })
  })
})
