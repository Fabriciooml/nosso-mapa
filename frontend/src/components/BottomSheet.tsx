import { useState } from 'react'
import type { Place, PlaceStatus, Category } from '../types'
import { PlaceItem } from './PlaceItem'
import { FilterBar } from './FilterBar'
import { sortPlacesByDistance, distanceDeg, formatDistance } from '../utils/distance'
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
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const filtered = places.filter((p) => {
    const statusOk = statusFilter.length === 0 || statusFilter.includes(p.status)
    const catOk =
      categoryFilter.length === 0 ||
      p.categories.some((c) => categoryFilter.includes(c.id))
    return statusOk && catOk
  })

  const sorted = sortPlacesByDistance(filtered, centerLat, centerLng)

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
        />
      </div>
      <div className={styles.list}>
        {sorted.map((place) => (
          <PlaceItem
            key={place.id}
            place={place}
            distanceLabel={formatDistance(
              distanceDeg(place.lat, place.lng, centerLat, centerLng),
            )}
            onClick={() => onSelect(place.id)}
            selected={selectedId === place.id}
          />
        ))}
      </div>
    </div>
  )
}
