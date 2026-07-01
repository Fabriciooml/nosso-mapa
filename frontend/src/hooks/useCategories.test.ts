import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { useCategories, useCreateCategory } from './useCategories'
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
  categories: {
    list: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCategories', () => {
  it('fetches and returns categories', async () => {
    mockApi.categories.list.mockResolvedValue([{ id: 1, name: 'Café' }])
    const { result } = renderHook(() => useCategories(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 1, name: 'Café' }])
  })
})

describe('useCreateCategory', () => {
  it('calls api.categories.create with name', async () => {
    mockApi.categories.list.mockResolvedValue([])
    mockApi.categories.create.mockResolvedValue({ id: 2, name: 'Museu' })
    const { result } = renderHook(() => useCreateCategory(), { wrapper })
    result.current.mutate('Museu')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.categories.create).toHaveBeenCalledWith('Museu')
  })
})
