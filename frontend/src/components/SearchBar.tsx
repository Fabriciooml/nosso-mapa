import { useRef } from 'react'
import styles from './SearchBar.module.css'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClear() {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder="Buscar lugar..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value !== '' && (
        <button
          type="button"
          className={styles.clear}
          onClick={handleClear}
          aria-label="Limpar busca"
        >
          ×
        </button>
      )}
    </div>
  )
}
