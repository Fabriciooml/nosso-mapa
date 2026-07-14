import type { PlaceStatus, Category } from '../types'
import { ExpandableChipRow } from './ExpandableChipRow'
import styles from './FilterBar.module.css'

interface Props {
  statusFilter: PlaceStatus[]
  onStatusToggle: (status: PlaceStatus) => void
  categoryFilter: number[]
  onCategoryToggle: (id: number) => void
  categories: Category[]
  onScreenOnly?: boolean
  onScreenOnlyToggle?: () => void
  boundsReady?: boolean
}

const STATUS_LABELS: Record<PlaceStatus, string> = {
  to_go: 'A ir',
  gone: 'Fomos',
  repeat: 'Repetir',
}

const STATUS_COLORS: Record<PlaceStatus, string> = {
  to_go: 'var(--blue)',
  gone: 'var(--slate)',
  repeat: 'var(--rose)',
}

export function FilterBar({
  statusFilter,
  onStatusToggle,
  categoryFilter,
  onCategoryToggle,
  categories,
  onScreenOnly = false,
  onScreenOnlyToggle,
  boundsReady = false,
}: Props) {
  return (
    <div className={styles.bar}>
      {onScreenOnlyToggle && (
        <div className={styles.group}>
          <button
            className={`${styles.chip} ${onScreenOnly ? styles.active : ''}`}
            onClick={onScreenOnlyToggle}
            aria-pressed={onScreenOnly}
            disabled={!boundsReady}
          >
            Na tela
          </button>
        </div>
      )}
      <div className={styles.group}>
        {(['to_go', 'gone', 'repeat'] as PlaceStatus[]).map((s) => {
          const active = statusFilter.includes(s)
          return (
            <button
              key={s}
              className={`${styles.chip} ${active ? styles.active : ''}`}
              style={active ? { borderColor: STATUS_COLORS[s], color: STATUS_COLORS[s] } : undefined}
              onClick={() => onStatusToggle(s)}
              aria-pressed={active}
            >
              {STATUS_LABELS[s]}
            </button>
          )
        })}
      </div>
      {categories.length > 0 && (
        <div className={styles.group}>
          <ExpandableChipRow
            items={categories}
            visibleCount={3}
            keyFn={(cat) => cat.id}
            renderItem={(cat) => {
              const active = categoryFilter.includes(cat.id)
              return (
                <button
                  className={`${styles.chip} ${active ? styles.catActive : ''}`}
                  onClick={() => onCategoryToggle(cat.id)}
                  aria-pressed={active}
                >
                  {cat.name}
                </button>
              )
            }}
          />
        </div>
      )}
    </div>
  )
}
