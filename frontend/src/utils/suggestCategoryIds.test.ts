import { describe, it, expect } from 'vitest'
import { suggestCategoryIds } from './suggestCategoryIds'

const CATEGORIES = [
  { id: 1, name: 'Café' },
  { id: 2, name: 'Museu' },
  { id: 3, name: 'Restaurante' },
]

describe('suggestCategoryIds', () => {
  it('matches restaurant type to Restaurante category', () => {
    expect(suggestCategoryIds(['restaurant', 'point_of_interest'], CATEGORIES)).toEqual([3])
  })

  it('matches cafe type to Café category', () => {
    expect(suggestCategoryIds(['cafe'], CATEGORIES)).toEqual([1])
  })

  it('returns empty array when types is undefined', () => {
    expect(suggestCategoryIds(undefined, CATEGORIES)).toEqual([])
  })

  it('returns empty array when no types match', () => {
    expect(suggestCategoryIds(['point_of_interest', 'establishment'], CATEGORIES)).toEqual([])
  })

  it('ignores a matched type when its category does not exist in the list', () => {
    expect(suggestCategoryIds(['movie_theater'], CATEGORIES)).toEqual([])
  })

  it('dedupes when multiple types map to the same category', () => {
    const cats = [...CATEGORIES, { id: 4, name: 'Lanche' }]
    expect(suggestCategoryIds(['meal_takeaway', 'bakery'], cats)).toEqual([4])
  })
})
