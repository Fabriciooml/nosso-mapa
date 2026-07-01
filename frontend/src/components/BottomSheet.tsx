import { useState } from 'react'
import type { Place, PlaceStatus, Category, MapBounds } from '../types'
import { PlaceItem } from './PlaceItem'
import { FilterBar } from './FilterBar'
import { sortPlacesByDistance, distanceDeg, formatDistance } from '../utils/distance'
import { isInBounds } from '../utils/bounds'
import styles from './BottomSheet.module.css'

interface Props {
  places: Place[]
  selectedId: number | null
  onSelect: (id: number) => void
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
}

export function BottomSheet({
  places,
  selectedId,
  onSelect,
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
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const statusCatFiltered = places.filter((p) => {
    const statusOk = statusFilter.length === 0 || statusFilter.includes(p.status)
    const catOk =
      categoryFilter.length === 0 ||
      p.categories.some((c) => categoryFilter.includes(c.id))
    return statusOk && catOk
  })

  const boundsFiltered =
    onScreenOnly && mapBounds
      ? statusCatFiltered.filter((p) => isInBounds(p, mapBounds))
      : statusCatFiltered

  const sorted = sortPlacesByDistance(boundsFiltered, centerLat, centerLng)

  return (
    <div className={`${styles.sheet} ${expanded ? styles.expanded : ''}`}>
      <button
        className={styles.handle}
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? 'Recolher lista' : 'Expandir lista'}
      >
        <span className={styles.pill} />
      </button>
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
        {sorted.length === 0 && onScreenOnly ? (
          <p className={styles.emptyArea}>Nenhum lugar nesta área</p>
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
    </div>
  )
}
