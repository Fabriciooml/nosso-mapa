import { describe, it, expect } from 'vitest'
import { normalize } from './search'

describe('normalize', () => {
  it('lowercases input', () => {
    expect(normalize('CAFE')).toBe('cafe')
  })

  it('strips accents', () => {
    expect(normalize('Café')).toBe('cafe')
  })

  it('matches accented and unaccented forms of the same word', () => {
    expect(normalize('café')).toBe(normalize('cafe'))
  })

  it('leaves plain ascii strings unchanged aside from case', () => {
    expect(normalize('Restaurante')).toBe('restaurante')
  })

  it('handles empty string', () => {
    expect(normalize('')).toBe('')
  })
})
