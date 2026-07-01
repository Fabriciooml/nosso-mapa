import { useState } from 'react'
import styles from './IdentityModal.module.css'

interface Props {
  onConfirm: (name: string) => void
}

export function IdentityModal({ onConfirm }: Props) {
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Quem é você?</h2>
        <form onSubmit={handleSubmit}>
          <input
            className={styles.input}
            type="text"
            placeholder="Seu nome"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <button className={styles.button} type="submit" disabled={!value.trim()}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
