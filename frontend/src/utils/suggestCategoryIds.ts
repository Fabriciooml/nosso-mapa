import type { Category } from '../types'

const GOOGLE_TYPE_TO_CATEGORY_NAME: Record<string, string> = {
  restaurant: 'Restaurante',
  food: 'Restaurante',
  cafe: 'Café',
  museum: 'Museu',
  movie_theater: 'Cinema',
  meal_takeaway: 'Lanche',
  bakery: 'Lanche',
}

export function suggestCategoryIds(
  types: string[] | undefined,
  categories: Category[],
): number[] {
  if (!types) return []
  const suggestedNames = new Set(
    types.map((t) => GOOGLE_TYPE_TO_CATEGORY_NAME[t]).filter((n): n is string => !!n),
  )
  return categories.filter((c) => suggestedNames.has(c.name)).map((c) => c.id)
}
