import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('falls back to Nosso Mapa / BH defaults when env vars are unset', async () => {
    const { APP_NAME, DEFAULT_CENTER } = await import('./config')
    expect(APP_NAME).toBe('Nosso Mapa')
    expect(DEFAULT_CENTER).toEqual({ lat: -19.9186, lng: -43.9388 })
  })

  it('uses VITE_APP_NAME when set', async () => {
    vi.stubEnv('VITE_APP_NAME', 'Mapa da Família')
    const { APP_NAME } = await import('./config')
    expect(APP_NAME).toBe('Mapa da Família')
  })

  it('uses VITE_DEFAULT_CENTER_LAT/LNG when set', async () => {
    vi.stubEnv('VITE_DEFAULT_CENTER_LAT', '10.5')
    vi.stubEnv('VITE_DEFAULT_CENTER_LNG', '-20.25')
    const { DEFAULT_CENTER } = await import('./config')
    expect(DEFAULT_CENTER).toEqual({ lat: 10.5, lng: -20.25 })
  })

  it('falls back to defaults when env vars are blank strings', async () => {
    vi.stubEnv('VITE_APP_NAME', '')
    vi.stubEnv('VITE_DEFAULT_CENTER_LAT', '')
    vi.stubEnv('VITE_DEFAULT_CENTER_LNG', '')
    const { APP_NAME, DEFAULT_CENTER } = await import('./config')
    expect(APP_NAME).toBe('Nosso Mapa')
    expect(DEFAULT_CENTER).toEqual({ lat: -19.9186, lng: -43.9388 })
  })
})
