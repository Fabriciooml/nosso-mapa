import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { StarRating } from './StarRating'

describe('StarRating display mode', () => {
  it('renders dash when value is null', () => {
    render(<StarRating mode="display" value={null} />)
    expect(screen.getByText('–')).toBeInTheDocument()
  })

  it('renders accessible label with value', () => {
    render(<StarRating mode="display" value={3.5} />)
    expect(screen.getByLabelText('3.5 estrelas')).toBeInTheDocument()
  })
})

describe('StarRating input mode', () => {
  it('renders 10 buttons (2 halves per star × 5 stars)', () => {
    render(<StarRating mode="input" value={0} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(10)
  })

  it('calls onChange with 0.5 when first half of star 1 clicked', async () => {
    const onChange = vi.fn()
    render(<StarRating mode="input" value={0} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('0.5 estrelas'))
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('calls onChange with 3 when full star 3 clicked', async () => {
    const onChange = vi.fn()
    render(<StarRating mode="input" value={0} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('3 estrelas'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('calls onChange with 4.5 when half of star 5 clicked', async () => {
    const onChange = vi.fn()
    render(<StarRating mode="input" value={0} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('4.5 estrelas'))
    expect(onChange).toHaveBeenCalledWith(4.5)
  })
})
