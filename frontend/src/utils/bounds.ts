import type { MapBounds } from '../types'

export function isInBounds(
  place: { lat: number; lng: number },
  bounds: MapBounds,
): boolean {
  return (
    place.lat >= bounds.south &&
    place.lat <= bounds.north &&
    place.lng >= bounds.west &&
    place.lng <= bounds.east
  )
}
