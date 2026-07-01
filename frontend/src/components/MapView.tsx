import { useCallback, useEffect, useRef } from 'react'
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import type { Place } from '../types'
import type { Position } from '../hooks/useGeolocation'
import styles from './MapView.module.css'

const STATUS_COLORS: Record<string, string> = {
  to_go: '#4a9eff',
  gone: '#3d4a5c',
  repeat: '#ff6b9d',
}

function GeolocationLayer({ position }: { position: Position | null }) {
  const map = useMap()
  const hasPanned = useRef(false)

  useEffect(() => {
    if (!map || !position || hasPanned.current) return
    map.panTo(position)
    hasPanned.current = true
  }, [map, position])

  if (!position) return null

  return (
    <AdvancedMarker position={position} zIndex={1000}>
      <div className={styles.userDot} />
    </AdvancedMarker>
  )
}

interface Props {
  places: Place[]
  selectedId: number | null
  onMarkerClick: (id: number) => void
  onCameraChanged: (lat: number, lng: number) => void
  defaultCenter: { lat: number; lng: number }
  userPosition: Position | null
}

export function MapView({
  places,
  selectedId,
  onMarkerClick,
  onCameraChanged,
  defaultCenter,
  userPosition,
}: Props) {
  const handleCameraChange = useCallback(
    (ev: { detail: { center: { lat: number; lng: number } } }) => {
      onCameraChanged(ev.detail.center.lat, ev.detail.center.lng)
    },
    [onCameraChanged],
  )

  return (
    <div className={styles.container}>
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={14}
        mapId="nosso-mapa"
        onCameraChanged={handleCameraChange}
        disableDefaultUI
        gestureHandling="greedy"
      >
        <GeolocationLayer position={userPosition} />
        {places.map((place) => (
          <AdvancedMarker
            key={place.id}
            position={{ lat: place.lat, lng: place.lng }}
            onClick={() => onMarkerClick(place.id)}
          >
            <span
              className={`${styles.dot} ${selectedId === place.id ? styles.dotSelected : ''}`}
              style={{ background: STATUS_COLORS[place.status] }}
            />
          </AdvancedMarker>
        ))}
      </Map>
    </div>
  )
}
