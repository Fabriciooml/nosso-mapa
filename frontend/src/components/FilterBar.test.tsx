import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FilterBar } from './FilterBar'

const CATEGORIES = [
  { id: 1, name: 'Café' },
  { id: 2, name: 'Museu' },
]

const defaultProps = {
  statusFilter: [] as import('../types').PlaceStatus[],
  onStatusToggle: vi.fn(),
  categoryFilter: [] as number[],
  onCategoryToggle: vi.fn(),
  categories: CATEGORIES,
}

describe('FilterBar', () => {
  it('renders all 3 status chips', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('A ir')).toBeInTheDocument()
    expect(screen.getByText('Fomos')).toBeInTheDocument()
    expect(screen.getByText('Repetir')).toBeInTheDocument()
  })

  it('renders category chips', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('Café')).toBeInTheDocument()
    expect(screen.getByText('Museu')).toBeInTheDocument()
  })

  it('calls onStatusToggle with correct status when chip clicked', async () => {
    const onStatusToggle = vi.fn()
    render(<FilterBar {...defaultProps} onStatusToggle={onStatusToggle} />)
    await userEvent.click(screen.getByText('A ir'))
    expect(onStatusToggle).toHaveBeenCalledWith('to_go')
  })

  it('calls onCategoryToggle with correct id when category clicked', async () => {
    const onCategoryToggle = vi.fn()
    render(<FilterBar {...defaultProps} onCategoryToggle={onCategoryToggle} />)
    await userEvent.click(screen.getByText('Café'))
    expect(onCategoryToggle).toHaveBeenCalledWith(1)
  })

  it('active status chip has aria-pressed=true', () => {
    render(<FilterBar {...defaultProps} statusFilter={['to_go']} />)
    expect(screen.getByText('A ir').closest('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('inactive chip has aria-pressed=false', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByText('A ir').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('hides category section when categories array is empty', () => {
    render(<FilterBar {...defaultProps} categories={[]} />)
    expect(screen.queryByText('Café')).not.toBeInTheDocument()
  })
})
