import { describe, it, expect } from 'vitest'
import { isInBounds } from './bounds'
import type { MapBounds } from '../types'

const BOUNDS: MapBounds = { north: 10, south: 0, east: 10, west: 0 }

describe('isInBounds', () => {
  it('returns true for place inside bounds', () => {
    expect(isInBounds({ lat: 5, lng: 5 }, BOUNDS)).toBe(true)
  })

  it('returns true for place on north edge (inclusive)', () => {
    expect(isInBounds({ lat: 10, lng: 5 }, BOUNDS)).toBe(true)
  })

  it('returns true for place on south edge (inclusive)', () => {
    expect(isInBounds({ lat: 0, lng: 5 }, BOUNDS)).toBe(true)
  })

  it('returns true for place on east edge (inclusive)', () => {
    expect(isInBounds({ lat: 5, lng: 10 }, BOUNDS)).toBe(true)
  })

  it('returns true for place on west edge (inclusive)', () => {
    expect(isInBounds({ lat: 5, lng: 0 }, BOUNDS)).toBe(true)
  })

  it('returns false for place north of bounds', () => {
    expect(isInBounds({ lat: 11, lng: 5 }, BOUNDS)).toBe(false)
  })

  it('returns false for place south of bounds', () => {
    expect(isInBounds({ lat: -1, lng: 5 }, BOUNDS)).toBe(false)
  })

  it('returns false for place east of bounds', () => {
    expect(isInBounds({ lat: 5, lng: 11 }, BOUNDS)).toBe(false)
  })

  it('returns false for place west of bounds', () => {
    expect(isInBounds({ lat: 5, lng: -1 }, BOUNDS)).toBe(false)
  })
})
