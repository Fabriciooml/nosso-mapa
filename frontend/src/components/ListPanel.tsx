import type { Place, PlaceStatus, Category, MapBounds } from '../types'
import { PlaceItem } from './PlaceItem'
import { FilterBar } from './FilterBar'
import { SearchBar } from './SearchBar'
import { filterPlaces } from '../utils/filterPlaces'
import { sortPlacesByDistance, distanceDeg, formatDistance } from '../utils/distance'
import styles from './ListPanel.module.css'

interface Props {
  places: Place[]
  selectedId: number | null
  onSelect: (id: number) => void
  onAddPlace: () => void
  centerLat: number
  centerLng: number
  statusFilter: PlaceStatus[]
  onStatusToggle: (s: PlaceStatus) => void
  categoryFilter: number[]
  onCategoryToggle: (id: number) => void
  categories: Category[]
  onScreenOnly: boolean
  mapBounds: MapBounds | null
  onScreenOnlyToggle: () => void
  searchQuery: string
  onSearchChange: (value: string) => void
}

export function ListPanel({
  places,
  selectedId,
  onSelect,
  onAddPlace,
  centerLat,
  centerLng,
  statusFilter,
  onStatusToggle,
  categoryFilter,
  onCategoryToggle,
  categories,
  onScreenOnly,
  mapBounds,
  onScreenOnlyToggle,
  searchQuery,
  onSearchChange,
}: Props) {
  const filtered = filterPlaces(places, {
    statusFilter,
    categoryFilter,
    query: searchQuery,
    onScreenOnly,
    mapBounds,
  })

  const sorted = sortPlacesByDistance(filtered, centerLat, centerLng)

  const emptyMessage =
    sorted.length > 0
      ? null
      : searchQuery.trim() !== ''
        ? 'Nenhum lugar encontrado'
        : onScreenOnly
          ? 'Nenhum lugar nesta área'
          : null

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.wordmark}>Nosso Mapa</span>
      </div>
      <div className={styles.search}>
        <SearchBar value={searchQuery} onChange={onSearchChange} />
      </div>
      <div className={styles.filters}>
        <FilterBar
          statusFilter={statusFilter}
          onStatusToggle={onStatusToggle}
          categoryFilter={categoryFilter}
          onCategoryToggle={onCategoryToggle}
          categories={categories}
          onScreenOnly={onScreenOnly}
          onScreenOnlyToggle={onScreenOnlyToggle}
          boundsReady={mapBounds !== null}
        />
      </div>
      <div className={styles.list}>
        {emptyMessage ? (
          <p className={styles.emptyArea}>{emptyMessage}</p>
        ) : (
          sorted.map((place) => (
            <PlaceItem
              key={place.id}
              place={place}
              distanceLabel={formatDistance(
                distanceDeg(place.lat, place.lng, centerLat, centerLng),
              )}
              onClick={() => onSelect(place.id)}
              selected={selectedId === place.id}
            />
          ))
        )}
      </div>
      <button className={styles.addBtn} onClick={onAddPlace}>
        + Adicionar lugar
      </button>
    </aside>
  )
}
