import type { Place } from '../types'
import { StarRating } from './StarRating'
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
  return (
    <button
      className={`${styles.item} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      type="button"
    >
      <span
        className={styles.dot}
        style={{ background: STATUS_COLORS[place.status] }}
        aria-hidden="true"
      />
      <span className={styles.content}>
        <span className={styles.name}>{place.name}</span>
        <span className={styles.meta}>
          {place.categories.map((c) => c.name).join(' · ')}
        </span>
      </span>
      <span className={styles.right}>
        <StarRating mode="display" value={place.avg_rating} />
        <span className={styles.distance}>{distanceLabel}</span>
      </span>
    </button>
  )
}
