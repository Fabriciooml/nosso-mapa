// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useIdentity } from './useIdentity'

beforeEach(() => {
  localStorage.clear()
})

describe('useIdentity', () => {
  it('returns null when no name stored', () => {
    const { result } = renderHook(() => useIdentity())
    expect(result.current.name).toBeNull()
  })

  it('setName persists to localStorage and updates state', () => {
    const { result } = renderHook(() => useIdentity())
    act(() => {
      result.current.setName('Fab')
    })
    expect(result.current.name).toBe('Fab')
    expect(localStorage.getItem('nosso_mapa_identity')).toBe('Fab')
  })

  it('initializes from localStorage on mount', () => {
    localStorage.setItem('nosso_mapa_identity', 'Ana')
    const { result } = renderHook(() => useIdentity())
    expect(result.current.name).toBe('Ana')
  })

  it('clearName removes from localStorage and resets state', () => {
    localStorage.setItem('nosso_mapa_identity', 'Fab')
    const { result } = renderHook(() => useIdentity())
    act(() => {
      result.current.clearName()
    })
    expect(result.current.name).toBeNull()
    expect(localStorage.getItem('nosso_mapa_identity')).toBeNull()
  })
})
