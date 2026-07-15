import type { Place } from '../types'

export function visiblePlaces(filtered: Place[], selected: Place | null): Place[] {
  if (!selected || filtered.some((p) => p.id === selected.id)) return filtered
  return [...filtered, selected]
}
