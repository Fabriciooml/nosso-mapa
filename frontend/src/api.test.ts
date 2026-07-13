import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from './api'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function mockError(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
  })
}

function mockNoContent() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 204,
  })
}

beforeEach(() => {
  mockFetch.mockClear()
})

describe('api.places', () => {
  it('list calls GET /api/places', async () => {
    mockOk([])
    await api.places.list()
    expect(mockFetch).toHaveBeenCalledWith('/api/places', expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }))
  })

  it('create calls POST /api/places with body', async () => {
    const place = { id: 1, name: 'X', lat: 0, lng: 0, status: 'to_go', avg_rating: null, categories: [], created_at: '', google_place_id: null }
    mockOk(place)
    const payload = { name: 'X', google_place_id: null, lat: 0, lng: 0, category_ids: [] }
    const result = await api.places.create(payload)
    expect(mockFetch).toHaveBeenCalledWith('/api/places', expect.objectContaining({ method: 'POST' }))
    expect(result.name).toBe('X')
  })

  it('updateStatus calls PATCH /api/places/:id/status', async () => {
    mockOk({ id: 1, name: 'X', google_place_id: null, lat: 0, lng: 0, status: 'gone', avg_rating: null, categories: [], created_at: '' })
    await api.places.updateStatus(1, 'gone')
    expect(mockFetch).toHaveBeenCalledWith('/api/places/1/status', expect.objectContaining({ method: 'PATCH' }))
  })

  it('addReview calls POST /api/places/:id/reviews', async () => {
    mockOk({ id: 1, name: 'X', google_place_id: null, lat: 0, lng: 0, status: 'to_go', avg_rating: 4.5, categories: [], created_at: '' })
    await api.places.addReview(1, { reviewer: 'Fab', rating: 4.5 })
    expect(mockFetch).toHaveBeenCalledWith('/api/places/1/reviews', expect.objectContaining({ method: 'POST' }))
  })

  it('throws on non-ok response', async () => {
    mockError(404)
    await expect(api.places.list()).rejects.toThrow('404')
  })

  it('update calls PUT /api/places/:id with body', async () => {
    const place = { id: 1, name: 'X', lat: 0, lng: 0, status: 'to_go', avg_rating: null,
      categories: [], created_at: '', google_place_id: null, alias: 'Xpto', description: null }
    mockOk(place)
    await api.places.update(1, { alias: 'Xpto', description: null, category_ids: [] })
    expect(mockFetch).toHaveBeenCalledWith('/api/places/1', expect.objectContaining({ method: 'PUT' }))
  })

  it('delete calls DELETE /api/places/:id and returns undefined', async () => {
    mockNoContent()
    const result = await api.places.delete(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/places/1', expect.objectContaining({ method: 'DELETE' }))
    expect(result).toBeUndefined()
  })

  it('request handles 204 without calling json()', async () => {
    const jsonSpy = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: jsonSpy })
    await api.places.delete(1)
    expect(jsonSpy).not.toHaveBeenCalled()
  })
})

describe('api.categories', () => {
  it('list calls GET /api/categories', async () => {
    mockOk([])
    await api.categories.list()
    expect(mockFetch).toHaveBeenCalledWith('/api/categories', expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }))
  })

  it('create calls POST /api/categories with name', async () => {
    mockOk({ id: 1, name: 'Café' })
    await api.categories.create('Café')
    const call = mockFetch.mock.calls[0]
    expect(call[1].method).toBe('POST')
    expect(JSON.parse(call[1].body)).toEqual({ name: 'Café' })
  })
})
