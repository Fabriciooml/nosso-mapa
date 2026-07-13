import { useState, useRef, useEffect } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import type { Category } from '../types'
import { useCreatePlace } from '../hooks/usePlaces'
import { useCategories, useCreateCategory } from '../hooks/useCategories'
import styles from './AddPlaceModal.module.css'

interface SelectedPlace {
  name: string
  google_place_id: string | null
  lat: number
  lng: number
}

interface Props {
  onClose: () => void
}

export function AddPlaceModal({ onClose }: Props) {
  const placesLib = useMapsLibrary('places')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([])
  const [newCatName, setNewCatName] = useState('')

  const { data: categories = [] } = useCategories()
  const createPlace = useCreatePlace()
  const createCategory = useCreateCategory()

  const is409 =
    createPlace.isError &&
    createPlace.error instanceof Error &&
    createPlace.error.message.startsWith('409')

  useEffect(() => {
    if (!placesLib || !inputRef.current) return
    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['place_id', 'name', 'geometry'],
    })
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry?.location) return
      setSelectedPlace({
        name: place.name ?? '',
        google_place_id: place.place_id ?? null,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      })
    })
  }, [placesLib])

  function toggleCategory(id: number) {
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function handleAddCategory() {
    const name = newCatName.trim()
    if (!name) return
    createCategory.mutate(name, {
      onSuccess: (cat: Category) => {
        setSelectedCatIds((prev) => [...prev, cat.id])
        setNewCatName('')
      },
    })
  }

  function handleSave() {
    if (!selectedPlace) return
    createPlace.mutate(
      { ...selectedPlace, category_ids: selectedCatIds },
      { onSuccess: onClose },
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Adicionar lugar</h2>
          <button className={styles.close} onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Local</label>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Pesquisar lugar..."
          />
          {selectedPlace && (
            <p className={styles.selected}>{selectedPlace.name}</p>
          )}
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
          <div className={styles.addCat}>
            <input
              className={styles.input}
              type="text"
              placeholder="Nova categoria..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <button
              type="button"
              className={styles.addCatBtn}
              onClick={handleAddCategory}
              disabled={!newCatName.trim()}
            >
              +
            </button>
          </div>
        </div>

        {is409 && (
          <p className={styles.error}>Lugar já está na lista</p>
        )}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!selectedPlace || createPlace.isPending}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
