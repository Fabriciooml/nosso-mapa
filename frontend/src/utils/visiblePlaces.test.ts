import { describe, it, expect } from 'vitest'
import { visiblePlaces } from './visiblePlaces'
import type { Place } from '../types'

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

describe('visiblePlaces', () => {
  it('returns filtered unchanged when there is no selection', () => {
    const filtered = [place({ id: 1 }), place({ id: 2 })]
    expect(visiblePlaces(filtered, null)).toEqual(filtered)
  })

  it('returns filtered unchanged when the selected place is already present', () => {
    const filtered = [place({ id: 1 }), place({ id: 2 })]
    expect(visiblePlaces(filtered, filtered[0])).toEqual(filtered)
  })

  it('appends the selected place when it was filtered out', () => {
    const filtered = [place({ id: 1 })]
    const selected = place({ id: 2 })
    expect(visiblePlaces(filtered, selected)).toEqual([filtered[0], selected])
  })

  it('returns just the selection when filtered is empty', () => {
    const selected = place({ id: 5 })
    expect(visiblePlaces([], selected)).toEqual([selected])
  })
})
