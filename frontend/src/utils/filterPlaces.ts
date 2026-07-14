import type { Place, PlaceStatus, MapBounds } from '../types'
import { isInBounds } from './bounds'
import { normalize } from './search'

interface FilterOptions {
  statusFilter: PlaceStatus[]
  categoryFilter: number[]
  query: string
  onScreenOnly: boolean
  mapBounds: MapBounds | null
}

export function filterPlaces(places: Place[], opts: FilterOptions): Place[] {
  const q = normalize(opts.query.trim())

  return places.filter((p) => {
    const statusOk = opts.statusFilter.length === 0 || opts.statusFilter.includes(p.status)
    const catOk =
      opts.categoryFilter.length === 0 ||
      p.categories.some((c) => opts.categoryFilter.includes(c.id))
    const queryOk =
      q === '' ||
      normalize(p.name).includes(q) ||
      (p.alias !== null && normalize(p.alias).includes(q))
    const boundsOk = !opts.onScreenOnly || !opts.mapBounds || isInBounds(p, opts.mapBounds)
    return statusOk && catOk && queryOk && boundsOk
  })
}
