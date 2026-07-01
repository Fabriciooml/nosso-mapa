import { useCallback } from 'react'
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps'
import type { Place } from '../types'
import styles from './MapView.module.css'

const STATUS_COLORS: Record<string, string> = {
  to_go: '#4a9eff',
  gone: '#3d4a5c',
  repeat: '#ff6b9d',
}

interface Props {
  places: Place[]
  selectedId: number | null
  onMarkerClick: (id: number) => void
  onCameraChanged: (lat: number, lng: number) => void
  defaultCenter: { lat: number; lng: number }
}

export function MapView({
  places,
  selectedId,
  onMarkerClick,
  onCameraChanged,
  defaultCenter,
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
