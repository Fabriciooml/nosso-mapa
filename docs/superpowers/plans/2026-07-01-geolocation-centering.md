# Geolocation Centering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On app open, pan the map to the user's GPS position with a pulsing blue dot; fall back silently to Praça Sete de Setembro, BH if permission is denied or times out.

**Architecture:** A `useGeolocation` hook fires `getCurrentPosition()` once on mount. `App.tsx` calls the hook and passes `userPosition` to both `MapView` instances. Inside `MapView`, a `GeolocationLayer` child component uses `useMap()` to pan once on first position arrival and renders the blue dot marker.

**Tech Stack:** React 18, `@vis.gl/react-google-maps` (`useMap`, `AdvancedMarker`), `navigator.geolocation`, CSS Modules keyframe animation, Vitest + React Testing Library

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `frontend/src/hooks/useGeolocation.ts` | Calls `getCurrentPosition()`, returns position or null |
| Create | `frontend/src/hooks/useGeolocation.test.ts` | Unit tests for the hook |
| Modify | `frontend/src/components/MapView.tsx` | Add `GeolocationLayer` inner component + `userPosition` prop |
| Modify | `frontend/src/components/MapView.module.css` | Pulsing blue dot CSS |
| Modify | `frontend/src/App.tsx` | Change default center, call hook, pass position down |

---

## Task 1: `useGeolocation` hook

**Files:**
- Create: `frontend/src/hooks/useGeolocation.ts`
- Create: `frontend/src/hooks/useGeolocation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/hooks/useGeolocation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A3 "useGeolocation"
```

Expected: FAIL — module not found / function not defined

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/useGeolocation.ts`:

```ts
import { useState, useEffect } from 'react'

type Position = { lat: number; lng: number }

export function useGeolocation(): Position | null {
  const [position, setPosition] = useState<Position | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (import.meta.env.DEV) console.warn('Geolocation error:', err.message)
      },
      { timeout: 5000, maximumAge: 60_000 },
    )
  }, [])

  return position
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A3 "useGeolocation"
```

Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useGeolocation.ts frontend/src/hooks/useGeolocation.test.ts
git commit -m "feat: add useGeolocation hook"
```

---

## Task 2: Blue dot CSS + `GeolocationLayer` in MapView

**Files:**
- Modify: `frontend/src/components/MapView.module.css`
- Modify: `frontend/src/components/MapView.tsx`

> Note: `GeolocationLayer` uses `useMap()` which requires a live Google Maps context — it cannot be unit tested in Vitest. Manual verification is the test for this task.

- [ ] **Step 1: Add blue dot CSS**

Append to `frontend/src/components/MapView.module.css`:

```css
.userDot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #4a9eff;
  border: 2px solid white;
  box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.25);
  position: relative;
}

.userDot::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid #4a9eff;
  animation: geolocPulse 1.8s ease-out infinite;
}

@keyframes geolocPulse {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(2.5); opacity: 0;   }
}
```

- [ ] **Step 2: Add `GeolocationLayer` and `userPosition` prop to `MapView`**

Replace the entire `frontend/src/components/MapView.tsx` with:

```tsx
import { useCallback, useEffect, useRef } from 'react'
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import type { Place } from '../types'
import styles from './MapView.module.css'

const STATUS_COLORS: Record<string, string> = {
  to_go: '#4a9eff',
  gone: '#3d4a5c',
  repeat: '#ff6b9d',
}

type Position = { lat: number; lng: number }

function GeolocationLayer({ position }: { position: Position | null }) {
  const map = useMap()
  const hasPanned = useRef(false)

  useEffect(() => {
    if (!map || !position || hasPanned.current) return
    map.panTo(position)
    hasPanned.current = true
  }, [map, position])

  if (!position) return null

  return (
    <AdvancedMarker position={position} zIndex={1000}>
      <div className={styles.userDot} />
    </AdvancedMarker>
  )
}

interface Props {
  places: Place[]
  selectedId: number | null
  onMarkerClick: (id: number) => void
  onCameraChanged: (lat: number, lng: number) => void
  defaultCenter: { lat: number; lng: number }
  userPosition: Position | null
}

export function MapView({
  places,
  selectedId,
  onMarkerClick,
  onCameraChanged,
  defaultCenter,
  userPosition,
}: Props) {
  const handleCameraChange = useCallback(
    (ev: { detail: { center: { lat: number; lng: number } } }) => {
      onCameraChanged(ev.detail.center.lat, ev.detail.center.lng)
    },
    [onCameraChanged],
  )

  return (
    <div className={styles.container}>
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={14}
        mapId="nosso-mapa"
        onCameraChanged={handleCameraChange}
        disableDefaultUI
        gestureHandling="greedy"
      >
        <GeolocationLayer position={userPosition} />
        {places.map((place) => (
          <AdvancedMarker
            key={place.id}
            position={{ lat: place.lat, lng: place.lng }}
            onClick={() => onMarkerClick(place.id)}
          >
            <span
              className={`${styles.dot} ${selectedId === place.id ? styles.dotSelected : ''}`}
              style={{ background: STATUS_COLORS[place.status] }}
            />
          </AdvancedMarker>
        ))}
      </Map>
    </div>
  )
}
```

- [ ] **Step 3: Run existing tests — verify nothing broken**

```bash
cd frontend && npm test
```

Expected: all tests PASS (MapView has no unit tests that check props)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MapView.tsx frontend/src/components/MapView.module.css
git commit -m "feat: add GeolocationLayer and userPosition prop to MapView"
```

---

## Task 3: Wire up in `App.tsx` + final verification

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update `App.tsx`**

Replace the entire `frontend/src/App.tsx` with:

```tsx
import { useState, useCallback } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { useIdentity } from './hooks/useIdentity'
import { usePlaces } from './hooks/usePlaces'
import { useCategories } from './hooks/useCategories'
import { useGeolocation } from './hooks/useGeolocation'
import { IdentityModal } from './components/IdentityModal'
import { MapView } from './components/MapView'
import { ListPanel } from './components/ListPanel'
import { BottomSheet } from './components/BottomSheet'
import { PlaceDetail } from './components/PlaceDetail'
import { AddPlaceModal } from './components/AddPlaceModal'
import type { PlaceStatus } from './types'
import styles from './App.module.css'

const DEFAULT_CENTER = { lat: -19.9186, lng: -43.9388 } // Praça Sete de Setembro, BH

export default function App() {
  const { name, setName, clearName } = useIdentity()
  const { data: places = [] } = usePlaces()
  const { data: categories = [] } = useCategories()
  const userPosition = useGeolocation()

  const [centerLat, setCenterLat] = useState(DEFAULT_CENTER.lat)
  const [centerLng, setCenterLng] = useState(DEFAULT_CENTER.lng)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [statusFilter, setStatusFilter] = useState<PlaceStatus[]>([])
  const [categoryFilter, setCategoryFilter] = useState<number[]>([])

  const handleCameraChanged = useCallback((lat: number, lng: number) => {
    setCenterLat(lat)
    setCenterLng(lng)
  }, [])

  function toggleStatus(s: PlaceStatus) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    )
  }

  function toggleCategory(id: number) {
    setCategoryFilter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const selectedPlace = places.find((p) => p.id === selectedId) ?? null
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

  return (
    <APIProvider apiKey={apiKey}>
      <div className={styles.app}>
        {/* Desktop layout */}
        <div className={styles.desktop}>
          {selectedPlace ? (
            <PlaceDetail place={selectedPlace} onClose={() => setSelectedId(null)} />
          ) : (
            <ListPanel
              places={places}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAddPlace={() => setShowAdd(true)}
              centerLat={centerLat}
              centerLng={centerLng}
              statusFilter={statusFilter}
              onStatusToggle={toggleStatus}
              categoryFilter={categoryFilter}
              onCategoryToggle={toggleCategory}
              categories={categories}
            />
          )}
          <div className={styles.mapArea}>
            <MapView
              places={places}
              selectedId={selectedId}
              onMarkerClick={setSelectedId}
              onCameraChanged={handleCameraChanged}
              defaultCenter={DEFAULT_CENTER}
              userPosition={userPosition}
            />
          </div>
        </div>

        {/* Mobile layout */}
        <div className={styles.mobile}>
          <MapView
            places={places}
            selectedId={selectedId}
            onMarkerClick={setSelectedId}
            onCameraChanged={handleCameraChanged}
            defaultCenter={DEFAULT_CENTER}
            userPosition={userPosition}
          />
          {selectedPlace ? (
            <div className={styles.mobileDetail}>
              <PlaceDetail place={selectedPlace} onClose={() => setSelectedId(null)} />
            </div>
          ) : (
            <BottomSheet
              places={places}
              selectedId={selectedId}
              onSelect={setSelectedId}
              centerLat={centerLat}
              centerLng={centerLng}
              statusFilter={statusFilter}
              onStatusToggle={toggleStatus}
              categoryFilter={categoryFilter}
              onCategoryToggle={toggleCategory}
              categories={categories}
            />
          )}
          <button
            className={styles.fab}
            onClick={() => setShowAdd(true)}
            aria-label="Adicionar lugar"
          >
            +
          </button>
        </div>

        {/* Name chip (top-right, desktop) */}
        {name && (
          <button className={styles.nameChip} onClick={clearName}>
            {name}
          </button>
        )}

        {/* Modals */}
        {!name && <IdentityModal onConfirm={setName} />}
        {showAdd && <AddPlaceModal onClose={() => setShowAdd(false)} />}
      </div>
    </APIProvider>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run full test suite**

```bash
cd frontend && npm test
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: center map on user position at startup"
```

---

## Manual Verification Checklist

After all tasks are complete, verify in browser (`docker compose up --build -d` or `npm run dev`):

- [ ] App opens centered on Praça Sete de Setembro, BH
- [ ] Browser prompts for location permission
- [ ] On grant: map pans smoothly to your GPS position
- [ ] Blue pulsing dot appears at your position
- [ ] Dot does not interfere with place markers (z-index higher, but clickable places still work)
- [ ] On deny: map stays on BH, no error shown, no dot
- [ ] Reload after grant: position arrives quickly (cached), dot appears promptly
- [ ] Panning the map after geolocation does not re-pan back to your position
