import { useState, useEffect } from 'react'

type Position = { lat: number; lng: number }

export function useGeolocation(): Position | null {
  const [position, setPosition] = useState<Position | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (import.meta.env.DEV) console.warn('Geolocation error:', err.message)
      },
      { timeout: 5000, maximumAge: 60_000 },
    )
  }, [])

  return position
}
