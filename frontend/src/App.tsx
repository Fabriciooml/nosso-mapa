import { useState, useCallback } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { useIdentity } from './hooks/useIdentity'
import { usePlaces } from './hooks/usePlaces'
import { useCategories } from './hooks/useCategories'
import { useGeolocation } from './hooks/useGeolocation'
import { IdentityModal } from './components/IdentityModal'
import { MapView } from './components/MapView'
import { ListPanel } from './components/ListPanel'
import { BottomSheet } from './components/BottomSheet'
import { PlaceDetail } from './components/PlaceDetail'
import { AddPlaceModal } from './components/AddPlaceModal'
import type { PlaceStatus, MapBounds } from './types'
import styles from './App.module.css'

const DEFAULT_CENTER = { lat: -19.9186, lng: -43.9388 } // Praça Sete de Setembro, BH

export default function App() {
  const { name, setName, clearName } = useIdentity()
  const { data: places = [] } = usePlaces()
  const { data: categories = [] } = useCategories()
  const userPosition = useGeolocation()

  const [centerLat, setCenterLat] = useState(DEFAULT_CENTER.lat)
  const [centerLng, setCenterLng] = useState(DEFAULT_CENTER.lng)
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [onScreenOnly, setOnScreenOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [statusFilter, setStatusFilter] = useState<PlaceStatus[]>([])
  const [categoryFilter, setCategoryFilter] = useState<number[]>([])

  const handleCameraChanged = useCallback((lat: number, lng: number, bounds: MapBounds) => {
    setCenterLat(lat)
    setCenterLng(lng)
    setMapBounds(bounds)
  }, [])

  function toggleStatus(s: PlaceStatus) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    )
  }

  function toggleCategory(id: number) {
    setCategoryFilter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const selectedPlace = places.find((p) => p.id === selectedId) ?? null
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

  return (
    <APIProvider apiKey={apiKey}>
      <div className={styles.app}>
        {/* Desktop layout */}
        <div className={styles.desktop}>
          {selectedPlace ? (
            <PlaceDetail place={selectedPlace} onClose={() => setSelectedId(null)} />
          ) : (
            <ListPanel
              places={places}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAddPlace={() => setShowAdd(true)}
              centerLat={centerLat}
              centerLng={centerLng}
              statusFilter={statusFilter}
              onStatusToggle={toggleStatus}
              categoryFilter={categoryFilter}
              onCategoryToggle={toggleCategory}
              categories={categories}
              onScreenOnly={onScreenOnly}
              mapBounds={mapBounds}
              onScreenOnlyToggle={() => setOnScreenOnly((v) => !v)}
            />
          )}
          <div className={styles.mapArea}>
            <MapView
              places={places}
              selectedId={selectedId}
              onMarkerClick={setSelectedId}
              onCameraChanged={handleCameraChanged}
              defaultCenter={DEFAULT_CENTER}
              userPosition={userPosition}
            />
          </div>
        </div>

        {/* Mobile layout */}
        <div className={styles.mobile}>
          <MapView
            places={places}
            selectedId={selectedId}
            onMarkerClick={setSelectedId}
            onCameraChanged={handleCameraChanged}
            defaultCenter={DEFAULT_CENTER}
            userPosition={userPosition}
          />
          {selectedPlace ? (
            <div className={styles.mobileDetail}>
              <PlaceDetail place={selectedPlace} onClose={() => setSelectedId(null)} />
            </div>
          ) : (
            <BottomSheet
              places={places}
              selectedId={selectedId}
              onSelect={setSelectedId}
              centerLat={centerLat}
              centerLng={centerLng}
              statusFilter={statusFilter}
              onStatusToggle={toggleStatus}
              categoryFilter={categoryFilter}
              onCategoryToggle={toggleCategory}
              categories={categories}
            />
          )}
          <button
            className={styles.fab}
            onClick={() => setShowAdd(true)}
            aria-label="Adicionar lugar"
          >
            +
          </button>
        </div>

        {/* Name chip (top-right, desktop) */}
        {name && (
          <button className={styles.nameChip} onClick={clearName}>
            {name}
          </button>
        )}

        {/* Modals */}
        {!name && <IdentityModal onConfirm={setName} />}
        {showAdd && <AddPlaceModal onClose={() => setShowAdd(false)} />}
      </div>
    </APIProvider>
  )
}
