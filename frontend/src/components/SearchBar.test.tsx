import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('renders current value', () => {
    render(<SearchBar value="Café" onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('Café')).toBeInTheDocument()
  })

  it('calls onChange with new value when typed', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="" onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('Buscar lugar...'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('hides clear button when value is empty', () => {
    render(<SearchBar value="" onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).not.toBeInTheDocument()
  })

  it('shows clear button when value is non-empty and clears on click', async () => {
    const onChange = vi.fn()
    render(<SearchBar value="Café" onChange={onChange} />)
    const clearBtn = screen.getByRole('button', { name: 'Limpar busca' })
    await userEvent.click(clearBtn)
    expect(onChange).toHaveBeenCalledWith('')
  })
})
