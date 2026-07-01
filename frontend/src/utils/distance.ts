export function distanceDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dlat = lat1 - lat2
  const dlng = lng1 - lng2
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

export function sortPlacesByDistance<T extends { lat: number; lng: number }>(
  places: T[],
  centerLat: number,
  centerLng: number,
): T[] {
  return [...places].sort(
    (a, b) =>
      distanceDeg(a.lat, a.lng, centerLat, centerLng) -
      distanceDeg(b.lat, b.lng, centerLat, centerLng),
  )
}

export function formatDistance(deg: number): string {
  const km = deg * 111
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}
