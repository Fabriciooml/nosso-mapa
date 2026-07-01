import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { IdentityModal } from './IdentityModal'

describe('IdentityModal', () => {
  it('renders the prompt text', () => {
    render(<IdentityModal onConfirm={vi.fn()} />)
    expect(screen.getByText('Quem é você?')).toBeInTheDocument()
  })

  it('submit button disabled when input empty', () => {
    render(<IdentityModal onConfirm={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('calls onConfirm with trimmed name on submit', async () => {
    const onConfirm = vi.fn()
    render(<IdentityModal onConfirm={onConfirm} />)
    await userEvent.type(screen.getByPlaceholderText('Seu nome'), '  Fab  ')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(onConfirm).toHaveBeenCalledWith('Fab')
  })

  it('does not call onConfirm when name is only whitespace', async () => {
    const onConfirm = vi.fn()
    render(<IdentityModal onConfirm={onConfirm} />)
    await userEvent.type(screen.getByPlaceholderText('Seu nome'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
