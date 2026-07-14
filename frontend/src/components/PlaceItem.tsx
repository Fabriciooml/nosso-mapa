import type { KeyboardEvent } from 'react'
import type { Category, Place } from '../types'
import { StarRating } from './StarRating'
import { ExpandableChipRow } from './ExpandableChipRow'
import styles from './PlaceItem.module.css'

const STATUS_COLORS: Record<string, string> = {
  to_go: 'var(--blue)',
  gone: 'var(--slate)',
  repeat: 'var(--rose)',
}

interface Props {
  place: Place
  distanceLabel: string
  onClick: () => void
  selected?: boolean
}

export function PlaceItem({ place, distanceLabel, onClick, selected }: Props) {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={`${styles.item} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <span
        className={styles.dot}
        style={{ background: STATUS_COLORS[place.status] }}
        aria-hidden="true"
      />
      <span className={styles.content}>
        <span className={styles.name}>{place.name}</span>
        <ExpandableChipRow
          items={place.categories}
          visibleCount={2}
          keyFn={(cat: Category) => cat.id}
          renderItem={(cat: Category) => <span className={styles.pill}>{cat.name}</span>}
        />
      </span>
      <span className={styles.right}>
        <StarRating mode="display" value={place.avg_rating} />
        <span className={styles.distance}>{distanceLabel}</span>
      </span>
    </div>
  )
}
