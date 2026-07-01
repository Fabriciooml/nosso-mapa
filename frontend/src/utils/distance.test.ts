import { describe, it, expect } from 'vitest'
import { distanceDeg, sortPlacesByDistance } from './distance'

describe('distanceDeg', () => {
  it('returns 0 for same point', () => {
    expect(distanceDeg(10, 20, 10, 20)).toBe(0)
  })

  it('returns correct distance', () => {
    // sqrt((3-0)^2 + (4-0)^2) = 5
    expect(distanceDeg(3, 4, 0, 0)).toBeCloseTo(5)
  })

  it('is symmetric', () => {
    expect(distanceDeg(1, 2, 3, 4)).toBeCloseTo(distanceDeg(3, 4, 1, 2))
  })
})

describe('sortPlacesByDistance', () => {
  const places = [
    { id: 1, lat: 10, lng: 10 },
    { id: 2, lat: 1, lng: 1 },
    { id: 3, lat: 5, lng: 5 },
  ]

  it('sorts nearest first', () => {
    const sorted = sortPlacesByDistance(places, 0, 0)
    expect(sorted.map((p) => p.id)).toEqual([2, 3, 1])
  })

  it('does not mutate input array', () => {
    const original = [...places]
    sortPlacesByDistance(places, 0, 0)
    expect(places).toEqual(original)
  })
})
