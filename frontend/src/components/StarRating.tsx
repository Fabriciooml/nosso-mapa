import styles from './StarRating.module.css'

interface DisplayProps {
  mode: 'display'
  value: number | null
}

interface InputProps {
  mode: 'input'
  value: number
  onChange: (rating: number) => void
}

type Props = DisplayProps | InputProps

export function StarRating(props: Props) {
  if (props.mode === 'display') {
    return <DisplayStars value={props.value} />
  }
  return <InputStars value={props.value} onChange={props.onChange} />
}

function DisplayStars({ value }: { value: number | null }) {
  if (value === null) {
    return <span className={styles.noRating}>–</span>
  }
  return (
    <span className={styles.display} aria-label={`${value} estrelas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} fill={getFill(star, value)} />
      ))}
    </span>
  )
}

function InputStars({ value, onChange }: { value: number; onChange: (r: number) => void }) {
  return (
    <span className={styles.input} role="group" aria-label="Avaliação">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={styles.starWrapper}>
          <button
            type="button"
            className={styles.halfBtn}
            aria-label={`${star - 0.5} estrelas`}
            onClick={() => onChange(star - 0.5)}
          />
          <button
            type="button"
            className={styles.halfBtn}
            aria-label={`${star} estrelas`}
            onClick={() => onChange(star)}
          />
          <StarIcon fill={getFill(star, value)} />
        </span>
      ))}
    </span>
  )
}

function StarIcon({ fill }: { fill: 'full' | 'half' | 'empty' }) {
  return (
    <svg
      className={styles.star}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {fill === 'half' && (
        <defs>
          <linearGradient id="half">
            <stop offset="50%" stopColor="var(--amber)" />
            <stop offset="50%" stopColor="var(--text-muted)" />
          </linearGradient>
        </defs>
      )}
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={fill === 'full' ? 'var(--amber)' : fill === 'half' ? 'url(#half)' : 'var(--text-muted)'}
      />
    </svg>
  )
}

function getFill(star: number, value: number): 'full' | 'half' | 'empty' {
  if (value >= star) return 'full'
  if (value >= star - 0.5) return 'half'
  return 'empty'
}
