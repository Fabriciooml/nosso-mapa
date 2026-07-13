import { useState } from 'react'
import type { Place } from '../types'
import { useUpdatePlace } from '../hooks/usePlaces'
import { useCategories } from '../hooks/useCategories'
import styles from './EditPlaceModal.module.css'

interface Props {
  place: Place
  onClose: () => void
}

export function EditPlaceModal({ place, onClose }: Props) {
  const [alias, setAlias] = useState(place.alias ?? '')
  const [description, setDescription] = useState(place.description ?? '')
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>(
    place.categories.map((c) => c.id),
  )
  const { data: categories = [] } = useCategories()
  const updatePlace = useUpdatePlace()

  function toggleCategory(id: number) {
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function handleSave() {
    updatePlace.mutate(
      {
        id: place.id,
        body: {
          alias: alias.trim() || null,
          description: description.trim() || null,
          category_ids: selectedCatIds,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Editar lugar</h2>
          <button className={styles.close} onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Local</label>
          <p className={styles.lockedName}>{place.name}</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Apelido</label>
          <input
            className={styles.input}
            type="text"
            placeholder={place.name}
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-description">Descrição (markdown)</label>
          <textarea
            id="edit-description"
            className={styles.textarea}
            rows={4}
            placeholder="Escreva uma descrição..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Categorias</label>
          <div className={styles.chips}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.chip} ${selectedCatIds.includes(cat.id) ? styles.chipActive : ''}`}
                onClick={() => toggleCategory(cat.id)}
                aria-pressed={selectedCatIds.includes(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={updatePlace.isPending}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
