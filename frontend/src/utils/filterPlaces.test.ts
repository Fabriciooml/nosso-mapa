import { describe, it, expect } from 'vitest'
import { filterPlaces } from './filterPlaces'
import type { Place, PlaceStatus, MapBounds } from '../types'

function place(overrides: Partial<Place>): Place {
  return {
    id: 1,
    name: 'Lugar',
    alias: null,
    description: null,
    google_place_id: null,
    lat: 0,
    lng: 0,
    status: 'to_go',
    avg_rating: null,
    categories: [],
    created_at: '',
    ...overrides,
  }
}

const PLACES: Place[] = [
  place({
    id: 1,
    name: 'Cantinho do Avillez',
    alias: 'Avillez',
    status: 'to_go',
    categories: [{ id: 1, name: 'Restaurante' }],
    lat: 0,
    lng: 0,
  }),
  place({
    id: 2,
    name: 'Museu de Artes',
    alias: null,
    status: 'gone',
    categories: [{ id: 2, name: 'Cultura' }],
    lat: 10,
    lng: 10,
  }),
]

const baseOpts = {
  statusFilter: [] as PlaceStatus[],
  categoryFilter: [] as number[],
  query: '',
  onScreenOnly: false,
  mapBounds: null as MapBounds | null,
}

describe('filterPlaces', () => {
  it('returns all places with default (empty) options', () => {
    expect(filterPlaces(PLACES, baseOpts)).toHaveLength(2)
  })

  it('filters by status', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, statusFilter: ['to_go'] })
    expect(result.map((p) => p.id)).toEqual([1])
  })

  it('filters by category', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, categoryFilter: [2] })
    expect(result.map((p) => p.id)).toEqual([2])
  })

  it('filters by bounds when onScreenOnly is true', () => {
    const bounds: MapBounds = { north: 2, south: -2, east: 2, west: -2 }
    const result = filterPlaces(PLACES, { ...baseOpts, onScreenOnly: true, mapBounds: bounds })
    expect(result.map((p) => p.id)).toEqual([1])
  })

  it('ignores bounds when onScreenOnly is false', () => {
    const bounds: MapBounds = { north: 2, south: -2, east: 2, west: -2 }
    const result = filterPlaces(PLACES, { ...baseOpts, onScreenOnly: false, mapBounds: bounds })
    expect(result).toHaveLength(2)
  })

  it('matches query against name', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, query: 'Museu' })
    expect(result.map((p) => p.id)).toEqual([2])
  })

  it('matches query against alias', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, query: 'Avillez' })
    expect(result.map((p) => p.id)).toEqual([1])
  })

  it('matches query case-insensitively', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, query: 'CANTINHO' })
    expect(result.map((p) => p.id)).toEqual([1])
  })

  it('matches query accent-insensitively', () => {
    const withAccent = [place({ id: 3, name: 'Café da Praça' })]
    const result = filterPlaces(withAccent, { ...baseOpts, query: 'cafe da praca' })
    expect(result).toHaveLength(1)
  })

  it('returns empty array when query matches nothing', () => {
    expect(filterPlaces(PLACES, { ...baseOpts, query: 'zzz' })).toHaveLength(0)
  })

  it('combines query with an active status filter (AND semantics)', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, query: 'Museu', statusFilter: ['to_go'] })
    expect(result).toHaveLength(0)
  })
})
