import { Fragment, useState, type MouseEvent, type ReactNode } from 'react'
import styles from './ExpandableChipRow.module.css'

interface Props<T> {
  items: T[]
  visibleCount: number
  keyFn: (item: T) => string | number
  renderItem: (item: T) => ReactNode
}

export function ExpandableChipRow<T>({ items, visibleCount, keyFn, renderItem }: Props<T>) {
  const [expanded, setExpanded] = useState(false)
  const hasOverflow = items.length > visibleCount
  const visibleItems = expanded || !hasOverflow ? items : items.slice(0, visibleCount)

  function handleToggle(event: MouseEvent) {
    event.stopPropagation()
    setExpanded((prev) => !prev)
  }

  return (
    <div className={styles.row}>
      {visibleItems.map((item) => (
        <Fragment key={keyFn(item)}>{renderItem(item)}</Fragment>
      ))}
      {hasOverflow && (
        <button
          type="button"
          className={styles.toggle}
          onClick={handleToggle}
          aria-label={expanded ? 'Mostrar menos categorias' : 'Mostrar mais categorias'}
        >
          {expanded ? '−' : `+${items.length - visibleCount}`}
        </button>
      )}
    </div>
  )
}
