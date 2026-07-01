import type { Category, Place, PlaceCreate, PlaceStatus, ReviewCreate } from './types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export const api = {
  places: {
    list: () => request<Place[]>('/places'),
    create: (body: PlaceCreate) =>
      request<Place>('/places', { method: 'POST', body: JSON.stringify(body) }),
    updateStatus: (id: number, status: PlaceStatus) =>
      request<Place>(`/places/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    addReview: (id: number, body: ReviewCreate) =>
      request<Place>(`/places/${id}/reviews`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  categories: {
    list: () => request<Category[]>('/categories'),
    create: (name: string) =>
      request<Category>('/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
  },
}
