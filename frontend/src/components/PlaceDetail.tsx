import { useState } from 'react'
import type { Place, PlaceStatus, Category } from '../types'
import { StarRating } from './StarRating'
import { useUpdateStatus, useAddReview, useDeletePlace } from '../hooks/usePlaces'
import { useIdentity } from '../hooks/useIdentity'
import { EditPlaceModal } from './EditPlaceModal'
import { ExpandableChipRow } from './ExpandableChipRow'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './PlaceDetail.module.css'

interface Props {
  place: Place
  onClose: () => void
}

const STATUS_LABELS: Record<PlaceStatus, string> = {
  to_go: '📍 A ir',
  gone: '✓ Fomos',
  repeat: '❤ Repetir',
}

export function PlaceDetail({ place, onClose }: Props) {
  const { name: reviewer } = useIdentity()
  const updateStatus = useUpdateStatus()
  const addReview = useAddReview()
  const deletePlace = useDeletePlace()
  const [showReview, setShowReview] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [rating, setRating] = useState(3.0)

  function handleStatusChange(status: PlaceStatus) {
    updateStatus.mutate({ id: place.id, status })
  }

  function handleReviewSubmit() {
    if (!reviewer) return
    addReview.mutate(
      { id: place.id, body: { reviewer, rating } },
      { onSuccess: () => setShowReview(false) },
    )
  }

  function handleDelete() {
    if (!window.confirm('Excluir lugar?')) return
    deletePlace.mutate(place.id, { onSuccess: onClose })
  }

  return (
    <div className={styles.panel}>
      <button className={styles.close} onClick={onClose} aria-label="Fechar">✕</button>
      <h2 className={styles.name}>{place.alias ?? place.name}</h2>
      <div className={styles.categories}>
        <ExpandableChipRow
          key={place.id}
          items={place.categories}
          visibleCount={3}
          keyFn={(cat: Category) => cat.id}
          renderItem={(cat: Category) => <span className={styles.pill}>{cat.name}</span>}
        />
      </div>

      {place.description && (
        <div className={styles.description} data-testid="description">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{place.description}</ReactMarkdown>
        </div>
      )}

      <div className={styles.rating}>
        <StarRating mode="display" value={place.avg_rating} />
        {place.avg_rating !== null && (
          <span className={styles.ratingValue}>{place.avg_rating.toFixed(1)}</span>
        )}
      </div>

      <div className={styles.statusRow}>
        {(['to_go', 'gone', 'repeat'] as PlaceStatus[]).map((s) => (
          <button
            key={s}
            className={`${styles.statusBtn} ${place.status === s ? styles.statusActive : ''}`}
            onClick={() => handleStatusChange(s)}
            aria-pressed={place.status === s}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {!showReview ? (
        <button className={styles.reviewBtn} onClick={() => setShowReview(true)}>
          Avaliar
        </button>
      ) : (
        <div className={styles.reviewForm}>
          <StarRating mode="input" value={rating} onChange={setRating} />
          <div className={styles.reviewActions}>
            <button className={styles.cancelBtn} onClick={() => setShowReview(false)}>
              Cancelar
            </button>
            <button className={styles.submitBtn} onClick={handleReviewSubmit}>
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className={styles.actionRow}>
        <button className={styles.editBtn} onClick={() => setShowEdit(true)}>
          Editar
        </button>
        <button className={styles.deleteBtn} onClick={handleDelete}>
          Excluir
        </button>
      </div>

      {showEdit && (
        <EditPlaceModal place={place} onClose={() => setShowEdit(false)} />
      )}
    </div>
  )
}
