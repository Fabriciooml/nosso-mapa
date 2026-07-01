import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useGeolocation } from './useGeolocation'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useGeolocation', () => {
  it('returns null initially (before position resolves)', () => {
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: vi.fn() }, // never calls success/error
    })
    const { result } = renderHook(() => useGeolocation())
    expect(result.current).toBeNull()
  })

  it('returns position on success', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({ coords: { latitude: -19.9186, longitude: -43.9388 } } as GeolocationPosition),
        ),
      },
    })
    const { result } = renderHook(() => useGeolocation())
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toEqual({ lat: -19.9186, lng: -43.9388 })
  })

  it('returns null on error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn(
          (_: PositionCallback, error: PositionErrorCallback) =>
            error({ message: 'Permission denied' } as GeolocationPositionError),
        ),
      },
    })
    const { result } = renderHook(() => useGeolocation())
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current).toBeNull()
    warnSpy.mockRestore()
  })

  it('calls getCurrentPosition with correct options', () => {
    const mock = vi.fn()
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: mock } })
    renderHook(() => useGeolocation())
    expect(mock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { timeout: 5000, maximumAge: 60_000 },
    )
  })

  it('returns null when geolocation API is unavailable', () => {
    vi.stubGlobal('navigator', {})
    const { result } = renderHook(() => useGeolocation())
    expect(result.current).toBeNull()
  })
})
