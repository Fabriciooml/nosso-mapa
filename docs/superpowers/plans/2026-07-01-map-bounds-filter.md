# Map Bounds Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Na tela" toggle chip to the filter bar that, when active, limits the place list to only places currently visible in the map viewport.

**Architecture:** `MapView.onCameraChanged` is extended to pass map bounds alongside center. `App.tsx` stores `mapBounds` and `onScreenOnly` state and passes them down to `ListPanel` and `BottomSheet`. Both list components apply a bounds filter (via `isInBounds` utility) when the toggle is active. `FilterBar` renders the toggle chip using optional props so it degrades gracefully when not wired.

**Tech Stack:** React 18, TypeScript, `@vis.gl/react-google-maps` (camera event bounds), Vitest + React Testing Library, CSS Modules

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `frontend/src/utils/bounds.ts` | `isInBounds` pure function |
| Create | `frontend/src/utils/bounds.test.ts` | Unit tests for `isInBounds` |
| Modify | `frontend/src/types.ts` | Add `MapBounds` interface |
| Modify | `frontend/src/components/MapView.tsx` | Extend `onCameraChanged` to pass bounds |
| Modify | `frontend/src/App.tsx` | Add `mapBounds`, `onScreenOnly` state; wire props |
| Modify | `frontend/src/components/FilterBar.tsx` | Add "Na tela" toggle chip |
| Modify | `frontend/src/components/FilterBar.test.tsx` | Test toggle chip |
| Modify | `frontend/src/components/ListPanel.tsx` | Apply bounds filter, empty state |
| Modify | `frontend/src/components/ListPanel.module.css` | `.emptyArea` style |
| Modify | `frontend/src/components/ListPanel.test.tsx` | Test bounds filtering |
| Modify | `frontend/src/components/BottomSheet.tsx` | Apply bounds filter, empty state |
| Modify | `frontend/src/components/BottomSheet.module.css` | `.emptyArea` style |
| Modify | `frontend/src/components/BottomSheet.test.tsx` | Test bounds filtering |

---

## Task 1: `isInBounds` utility

**Files:**
- Create: `frontend/src/utils/bounds.ts`
- Create: `frontend/src/utils/bounds.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/bounds.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isInBounds } from './bounds'
import type { MapBounds } from '../types'

const BOUNDS: MapBounds = { north: 10, south: 0, east: 10, west: 0 }

describe('isInBounds', () => {
  it('returns true for place inside bounds', () => {
    expect(isInBounds({ lat: 5, lng: 5 }, BOUNDS)).toBe(true)
  })

  it('returns true for place on north edge (inclusive)', () => {
    expect(isInBounds({ lat: 10, lng: 5 }, BOUNDS)).toBe(true)
  })

  it('returns true for place on south edge (inclusive)', () => {
    expect(isInBounds({ lat: 0, lng: 5 }, BOUNDS)).toBe(true)
  })

  it('returns true for place on east edge (inclusive)', () => {
    expect(isInBounds({ lat: 5, lng: 10 }, BOUNDS)).toBe(true)
  })

  it('returns true for place on west edge (inclusive)', () => {
    expect(isInBounds({ lat: 5, lng: 0 }, BOUNDS)).toBe(true)
  })

  it('returns false for place north of bounds', () => {
    expect(isInBounds({ lat: 11, lng: 5 }, BOUNDS)).toBe(false)
  })

  it('returns false for place south of bounds', () => {
    expect(isInBounds({ lat: -1, lng: 5 }, BOUNDS)).toBe(false)
  })

  it('returns false for place east of bounds', () => {
    expect(isInBounds({ lat: 5, lng: 11 }, BOUNDS)).toBe(false)
  })

  it('returns false for place west of bounds', () => {
    expect(isInBounds({ lat: 5, lng: -1 }, BOUNDS)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A3 "isInBounds"
```

Expected: FAIL — module not found

- [ ] **Step 3: Add `MapBounds` to types and implement `isInBounds`**

In `frontend/src/types.ts`, append before the last line:

```ts
export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}
```

Create `frontend/src/utils/bounds.ts`:

```ts
import type { MapBounds } from '../types'

export function isInBounds(
  place: { lat: number; lng: number },
  bounds: MapBounds,
): boolean {
  return (
    place.lat >= bounds.south &&
    place.lat <= bounds.north &&
    place.lng >= bounds.west &&
    place.lng <= bounds.east
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A3 "isInBounds"
```

Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/bounds.ts frontend/src/utils/bounds.test.ts frontend/src/types.ts
git commit -m "feat: add MapBounds type and isInBounds utility"
```

---

## Task 2: Extend `MapView.onCameraChanged` to include bounds

**Files:**
- Modify: `frontend/src/components/MapView.tsx`
- Modify: `frontend/src/App.tsx`

> Note: No new tests for MapView — `useMap()` requires a live Google Maps context. TypeScript check validates the contract.

- [ ] **Step 1: Update `MapView.tsx`**

Replace the entire `frontend/src/components/MapView.tsx` with:

```tsx
import { useCallback, useEffect, useRef } from 'react'
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import type { Place, MapBounds } from '../types'
import type { Position } from '../hooks/useGeolocation'
import styles from './MapView.module.css'

const STATUS_COLORS: Record<string, string> = {
  to_go: '#4a9eff',
  gone: '#3d4a5c',
  repeat: '#ff6b9d',
}

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
  onCameraChanged: (lat: number, lng: number, bounds: MapBounds) => void
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
    (ev: { detail: { center: { lat: number; lng: number }; bounds: MapBounds } }) => {
      onCameraChanged(ev.detail.center.lat, ev.detail.center.lng, ev.detail.bounds)
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

- [ ] **Step 2: Update `App.tsx` to store bounds**

Make three changes to `frontend/src/App.tsx`:

1. Add `MapBounds` to the type import line:
```ts
import type { PlaceStatus, MapBounds } from './types'
```

2. Add `mapBounds` state (after the `centerLng` state line):
```ts
const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
```

3. Replace the `handleCameraChanged` callback:
```ts
const handleCameraChanged = useCallback((lat: number, lng: number, bounds: MapBounds) => {
  setCenterLat(lat)
  setCenterLng(lng)
  setMapBounds(bounds)
}, [])
```

> Do NOT add `onScreenOnly`/`mapBounds`/`onScreenOnlyToggle` props to the ListPanel or BottomSheet JSX yet — those components don't have those props in their interfaces until Tasks 4 and 5. TypeScript's excess-property check would fail.

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
cd frontend && npm test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MapView.tsx frontend/src/App.tsx
git commit -m "feat: extend onCameraChanged to pass map bounds"
```

---

## Task 3: `FilterBar` toggle chip

**Files:**
- Modify: `frontend/src/components/FilterBar.tsx`
- Modify: `frontend/src/components/FilterBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/components/FilterBar.test.tsx` (after the existing `describe` block):

```ts
describe('FilterBar — Na tela toggle', () => {
  const toggleProps = {
    ...defaultProps,
    onScreenOnlyToggle: vi.fn(),
    boundsReady: true,
  }

  it('renders Na tela chip when onScreenOnlyToggle provided', () => {
    render(<FilterBar {...toggleProps} />)
    expect(screen.getByText('Na tela')).toBeInTheDocument()
  })

  it('does not render Na tela chip when onScreenOnlyToggle omitted', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.queryByText('Na tela')).not.toBeInTheDocument()
  })

  it('chip has aria-pressed=false when onScreenOnly=false', () => {
    render(<FilterBar {...toggleProps} onScreenOnly={false} />)
    expect(screen.getByText('Na tela').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('chip has aria-pressed=true when onScreenOnly=true', () => {
    render(<FilterBar {...toggleProps} onScreenOnly={true} />)
    expect(screen.getByText('Na tela').closest('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onScreenOnlyToggle when chip clicked', async () => {
    const onScreenOnlyToggle = vi.fn()
    render(<FilterBar {...toggleProps} onScreenOnlyToggle={onScreenOnlyToggle} />)
    await userEvent.click(screen.getByText('Na tela'))
    expect(onScreenOnlyToggle).toHaveBeenCalledOnce()
  })

  it('chip is disabled when boundsReady=false', () => {
    render(<FilterBar {...toggleProps} boundsReady={false} />)
    expect(screen.getByText('Na tela').closest('button')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A3 "Na tela"
```

Expected: FAIL — "Na tela" not in document

- [ ] **Step 3: Update `FilterBar.tsx`**

Replace the entire `frontend/src/components/FilterBar.tsx` with:

```tsx
import type { PlaceStatus, Category } from '../types'
import styles from './FilterBar.module.css'

interface Props {
  statusFilter: PlaceStatus[]
  onStatusToggle: (status: PlaceStatus) => void
  categoryFilter: number[]
  onCategoryToggle: (id: number) => void
  categories: Category[]
  onScreenOnly?: boolean
  onScreenOnlyToggle?: () => void
  boundsReady?: boolean
}

const STATUS_LABELS: Record<PlaceStatus, string> = {
  to_go: 'A ir',
  gone: 'Fomos',
  repeat: 'Repetir',
}

const STATUS_COLORS: Record<PlaceStatus, string> = {
  to_go: 'var(--blue)',
  gone: 'var(--slate)',
  repeat: 'var(--rose)',
}

export function FilterBar({
  statusFilter,
  onStatusToggle,
  categoryFilter,
  onCategoryToggle,
  categories,
  onScreenOnly = false,
  onScreenOnlyToggle,
  boundsReady = false,
}: Props) {
  return (
    <div className={styles.bar}>
      {onScreenOnlyToggle && (
        <div className={styles.group}>
          <button
            className={`${styles.chip} ${onScreenOnly ? styles.active : ''}`}
            onClick={onScreenOnlyToggle}
            aria-pressed={onScreenOnly}
            disabled={!boundsReady}
          >
            Na tela
          </button>
        </div>
      )}
      <div className={styles.group}>
        {(['to_go', 'gone', 'repeat'] as PlaceStatus[]).map((s) => {
          const active = statusFilter.includes(s)
          return (
            <button
              key={s}
              className={`${styles.chip} ${active ? styles.active : ''}`}
              style={active ? { borderColor: STATUS_COLORS[s], color: STATUS_COLORS[s] } : undefined}
              onClick={() => onStatusToggle(s)}
              aria-pressed={active}
            >
              {STATUS_LABELS[s]}
            </button>
          )
        })}
      </div>
      {categories.length > 0 && (
        <div className={styles.group}>
          {categories.map((cat) => {
            const active = categoryFilter.includes(cat.id)
            return (
              <button
                key={cat.id}
                className={`${styles.chip} ${active ? styles.catActive : ''}`}
                onClick={() => onCategoryToggle(cat.id)}
                aria-pressed={active}
              >
                {cat.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A3 "Na tela"
```

Expected: all 6 new tests PASS, existing tests still PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FilterBar.tsx frontend/src/components/FilterBar.test.tsx
git commit -m "feat: add Na tela toggle chip to FilterBar"
```

---

## Task 4: `ListPanel` bounds filter + wire `onScreenOnly` state in `App.tsx`

**Files:**
- Modify: `frontend/src/components/ListPanel.tsx`
- Modify: `frontend/src/components/ListPanel.module.css`
- Modify: `frontend/src/components/ListPanel.test.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/components/ListPanel.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ListPanel } from './ListPanel'
import type { Place, MapBounds } from '../types'

const PLACES: Place[] = [
  {
    id: 1,
    name: 'Lugar Perto',
    google_place_id: null,
    lat: 1,
    lng: 1,
    status: 'to_go',
    avg_rating: null,
    categories: [],
    created_at: '',
  },
  {
    id: 2,
    name: 'Lugar Longe',
    google_place_id: null,
    lat: 10,
    lng: 10,
    status: 'gone',
    avg_rating: null,
    categories: [],
    created_at: '',
  },
]

const defaultProps = {
  places: PLACES,
  selectedId: null,
  onSelect: vi.fn(),
  onAddPlace: vi.fn(),
  centerLat: 0,
  centerLng: 0,
  statusFilter: [] as import('../types').PlaceStatus[],
  onStatusToggle: vi.fn(),
  categoryFilter: [] as number[],
  onCategoryToggle: vi.fn(),
  categories: [],
  onScreenOnly: false,
  mapBounds: null as MapBounds | null,
  onScreenOnlyToggle: vi.fn(),
}

describe('ListPanel', () => {
  it('renders wordmark', () => {
    render(<ListPanel {...defaultProps} />)
    expect(screen.getByText('Nosso Mapa')).toBeInTheDocument()
  })

  it('renders sorted places (nearest first)', () => {
    render(<ListPanel {...defaultProps} />)
    const items = screen.getAllByRole('button', { name: /Lugar/ })
    // Lugar Perto (distance ~1.41) before Lugar Longe (distance ~14.14)
    expect(items[0]).toHaveTextContent('Lugar Perto')
    expect(items[1]).toHaveTextContent('Lugar Longe')
  })

  it('calls onSelect when place clicked', async () => {
    const onSelect = vi.fn()
    render(<ListPanel {...defaultProps} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Lugar Perto'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('calls onAddPlace when add button clicked', async () => {
    const onAddPlace = vi.fn()
    render(<ListPanel {...defaultProps} onAddPlace={onAddPlace} />)
    await userEvent.click(screen.getByText('+ Adicionar lugar'))
    expect(onAddPlace).toHaveBeenCalledOnce()
  })

  it('filters places by status', () => {
    render(<ListPanel {...defaultProps} statusFilter={['to_go']} />)
    expect(screen.getByText('Lugar Perto')).toBeInTheDocument()
    expect(screen.queryByText('Lugar Longe')).not.toBeInTheDocument()
  })

  it('shows all places when onScreenOnly=false regardless of mapBounds', () => {
    const bounds: MapBounds = { north: 2, south: 0, east: 2, west: 0 }
    // Lugar Longe (lat:10, lng:10) would be outside, but onScreenOnly=false
    render(<ListPanel {...defaultProps} onScreenOnly={false} mapBounds={bounds} />)
    expect(screen.getByText('Lugar Perto')).toBeInTheDocument()
    expect(screen.getByText('Lugar Longe')).toBeInTheDocument()
  })

  it('filters to bounds when onScreenOnly=true', () => {
    // bounds covers lat 0-2, lng 0-2 — Lugar Perto (1,1) in, Lugar Longe (10,10) out
    const bounds: MapBounds = { north: 2, south: 0, east: 2, west: 0 }
    render(<ListPanel {...defaultProps} onScreenOnly={true} mapBounds={bounds} />)
    expect(screen.getByText('Lugar Perto')).toBeInTheDocument()
    expect(screen.queryByText('Lugar Longe')).not.toBeInTheDocument()
  })

  it('shows empty state when onScreenOnly=true and no places in bounds', () => {
    // bounds far from both places
    const bounds: MapBounds = { north: -10, south: -20, east: -10, west: -20 }
    render(<ListPanel {...defaultProps} onScreenOnly={true} mapBounds={bounds} />)
    expect(screen.getByText('Nenhum lugar nesta área')).toBeInTheDocument()
    expect(screen.queryByText('Lugar Perto')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A3 "ListPanel"
```

Expected: existing tests PASS, new 3 tests FAIL (missing props)

- [ ] **Step 3: Update `ListPanel.tsx`**

Replace the entire `frontend/src/components/ListPanel.tsx` with:

```tsx
import type { Place, PlaceStatus, Category, MapBounds } from '../types'
import { PlaceItem } from './PlaceItem'
import { FilterBar } from './FilterBar'
import { sortPlacesByDistance, distanceDeg, formatDistance } from '../utils/distance'
import { isInBounds } from '../utils/bounds'
import styles from './ListPanel.module.css'

interface Props {
  places: Place[]
  selectedId: number | null
  onSelect: (id: number) => void
  onAddPlace: () => void
  centerLat: number
  centerLng: number
  statusFilter: PlaceStatus[]
  onStatusToggle: (s: PlaceStatus) => void
  categoryFilter: number[]
  onCategoryToggle: (id: number) => void
  categories: Category[]
  onScreenOnly: boolean
  mapBounds: MapBounds | null
  onScreenOnlyToggle: () => void
}

export function ListPanel({
  places,
  selectedId,
  onSelect,
  onAddPlace,
  centerLat,
  centerLng,
  statusFilter,
  onStatusToggle,
  categoryFilter,
  onCategoryToggle,
  categories,
  onScreenOnly,
  mapBounds,
  onScreenOnlyToggle,
}: Props) {
  const statusCatFiltered = places.filter((p) => {
    const statusOk = statusFilter.length === 0 || statusFilter.includes(p.status)
    const catOk =
      categoryFilter.length === 0 ||
      p.categories.some((c) => categoryFilter.includes(c.id))
    return statusOk && catOk
  })

  const boundsFiltered =
    onScreenOnly && mapBounds
      ? statusCatFiltered.filter((p) => isInBounds(p, mapBounds))
      : statusCatFiltered

  const sorted = sortPlacesByDistance(boundsFiltered, centerLat, centerLng)

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.wordmark}>Nosso Mapa</span>
      </div>
      <div className={styles.filters}>
        <FilterBar
          statusFilter={statusFilter}
          onStatusToggle={onStatusToggle}
          categoryFilter={categoryFilter}
          onCategoryToggle={onCategoryToggle}
          categories={categories}
          onScreenOnly={onScreenOnly}
          onScreenOnlyToggle={onScreenOnlyToggle}
          boundsReady={mapBounds !== null}
        />
      </div>
      <div className={styles.list}>
        {sorted.length === 0 && onScreenOnly ? (
          <p className={styles.emptyArea}>Nenhum lugar nesta área</p>
        ) : (
          sorted.map((place) => (
            <PlaceItem
              key={place.id}
              place={place}
              distanceLabel={formatDistance(
                distanceDeg(place.lat, place.lng, centerLat, centerLng),
              )}
              onClick={() => onSelect(place.id)}
              selected={selectedId === place.id}
            />
          ))
        )}
      </div>
      <button className={styles.addBtn} onClick={onAddPlace}>
        + Adicionar lugar
      </button>
    </aside>
  )
}
```

- [ ] **Step 4: Add `.emptyArea` to `ListPanel.module.css`**

Append to `frontend/src/components/ListPanel.module.css`:

```css
.emptyArea {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 0.875rem;
}
```

- [ ] **Step 5: Wire `onScreenOnly` state in `App.tsx`**

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
import type { PlaceStatus, MapBounds } from './types'
import styles from './App.module.css'

const DEFAULT_CENTER = { lat: -19.9186, lng: -43.9388 } // Praça Sete de Setembro, BH

export default function App() {
  const { name, setName, clearName } = useIdentity()
  const { data: places = [] } = usePlaces()
  const { data: categories = [] } = useCategories()
  const userPosition = useGeolocation()

  const [centerLat, setCenterLat] = useState(DEFAULT_CENTER.lat)
  const [centerLng, setCenterLng] = useState(DEFAULT_CENTER.lng)
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [onScreenOnly, setOnScreenOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [statusFilter, setStatusFilter] = useState<PlaceStatus[]>([])
  const [categoryFilter, setCategoryFilter] = useState<number[]>([])

  const handleCameraChanged = useCallback((lat: number, lng: number, bounds: MapBounds) => {
    setCenterLat(lat)
    setCenterLng(lng)
    setMapBounds(bounds)
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
              onScreenOnly={onScreenOnly}
              mapBounds={mapBounds}
              onScreenOnlyToggle={() => setOnScreenOnly((v) => !v)}
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

> BottomSheet does NOT receive the new props yet — its Props interface doesn't have them until Task 5. TypeScript's excess-property check would fail. Task 5 adds them.

- [ ] **Step 6: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Run full test suite**

```bash
cd frontend && npm test
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ListPanel.tsx frontend/src/components/ListPanel.module.css frontend/src/components/ListPanel.test.tsx frontend/src/App.tsx
git commit -m "feat: add bounds filter to ListPanel and wire onScreenOnly state"
```

---

## Task 5: `BottomSheet` bounds filter

**Files:**
- Modify: `frontend/src/components/BottomSheet.tsx`
- Modify: `frontend/src/components/BottomSheet.module.css`
- Modify: `frontend/src/components/BottomSheet.test.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/components/BottomSheet.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'
import type { Place, MapBounds } from '../types'

const PLACE: Place = {
  id: 1,
  name: 'Café Central',
  google_place_id: null,
  lat: 0,
  lng: 0,
  status: 'to_go',
  avg_rating: null,
  categories: [],
  created_at: '',
}

const defaultProps = {
  places: [PLACE],
  selectedId: null,
  onSelect: vi.fn(),
  centerLat: 0,
  centerLng: 0,
  statusFilter: [] as import('../types').PlaceStatus[],
  onStatusToggle: vi.fn(),
  categoryFilter: [] as number[],
  onCategoryToggle: vi.fn(),
  categories: [],
  onScreenOnly: false,
  mapBounds: null as MapBounds | null,
  onScreenOnlyToggle: vi.fn(),
}

describe('BottomSheet', () => {
  it('renders place item', () => {
    render(<BottomSheet {...defaultProps} />)
    expect(screen.getByText('Café Central')).toBeInTheDocument()
  })

  it('toggle handle changes aria-label', async () => {
    render(<BottomSheet {...defaultProps} />)
    const handle = screen.getByRole('button', { name: 'Expandir lista' })
    await userEvent.click(handle)
    expect(screen.getByRole('button', { name: 'Recolher lista' })).toBeInTheDocument()
  })

  it('calls onSelect when place clicked', async () => {
    const onSelect = vi.fn()
    render(<BottomSheet {...defaultProps} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Café Central'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('shows place when onScreenOnly=true and place is in bounds', () => {
    // PLACE is at lat:0, lng:0 — inside bounds [-1,1] x [-1,1]
    const bounds: MapBounds = { north: 1, south: -1, east: 1, west: -1 }
    render(<BottomSheet {...defaultProps} onScreenOnly={true} mapBounds={bounds} />)
    expect(screen.getByText('Café Central')).toBeInTheDocument()
  })

  it('shows empty state when onScreenOnly=true and place is outside bounds', () => {
    // PLACE is at lat:0, lng:0 — outside bounds [5,10] x [5,10]
    const bounds: MapBounds = { north: 10, south: 5, east: 10, west: 5 }
    render(<BottomSheet {...defaultProps} onScreenOnly={true} mapBounds={bounds} />)
    expect(screen.getByText('Nenhum lugar nesta área')).toBeInTheDocument()
    expect(screen.queryByText('Café Central')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify new tests fail**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -A3 "BottomSheet"
```

Expected: existing 3 tests PASS, new 2 tests FAIL (missing props)

- [ ] **Step 3: Update `BottomSheet.tsx`**

Replace the entire `frontend/src/components/BottomSheet.tsx` with:

```tsx
import { useState } from 'react'
import type { Place, PlaceStatus, Category, MapBounds } from '../types'
import { PlaceItem } from './PlaceItem'
import { FilterBar } from './FilterBar'
import { sortPlacesByDistance, distanceDeg, formatDistance } from '../utils/distance'
import { isInBounds } from '../utils/bounds'
import styles from './BottomSheet.module.css'

interface Props {
  places: Place[]
  selectedId: number | null
  onSelect: (id: number) => void
  centerLat: number
  centerLng: number
  statusFilter: PlaceStatus[]
  onStatusToggle: (s: PlaceStatus) => void
  categoryFilter: number[]
  onCategoryToggle: (id: number) => void
  categories: Category[]
  onScreenOnly: boolean
  mapBounds: MapBounds | null
  onScreenOnlyToggle: () => void
}

export function BottomSheet({
  places,
  selectedId,
  onSelect,
  centerLat,
  centerLng,
  statusFilter,
  onStatusToggle,
  categoryFilter,
  onCategoryToggle,
  categories,
  onScreenOnly,
  mapBounds,
  onScreenOnlyToggle,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const statusCatFiltered = places.filter((p) => {
    const statusOk = statusFilter.length === 0 || statusFilter.includes(p.status)
    const catOk =
      categoryFilter.length === 0 ||
      p.categories.some((c) => categoryFilter.includes(c.id))
    return statusOk && catOk
  })

  const boundsFiltered =
    onScreenOnly && mapBounds
      ? statusCatFiltered.filter((p) => isInBounds(p, mapBounds))
      : statusCatFiltered

  const sorted = sortPlacesByDistance(boundsFiltered, centerLat, centerLng)

  return (
    <div className={`${styles.sheet} ${expanded ? styles.expanded : ''}`}>
      <button
        className={styles.handle}
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? 'Recolher lista' : 'Expandir lista'}
      >
        <span className={styles.pill} />
      </button>
      <div className={styles.filters}>
        <FilterBar
          statusFilter={statusFilter}
          onStatusToggle={onStatusToggle}
          categoryFilter={categoryFilter}
          onCategoryToggle={onCategoryToggle}
          categories={categories}
          onScreenOnly={onScreenOnly}
          onScreenOnlyToggle={onScreenOnlyToggle}
          boundsReady={mapBounds !== null}
        />
      </div>
      <div className={styles.list}>
        {sorted.length === 0 && onScreenOnly ? (
          <p className={styles.emptyArea}>Nenhum lugar nesta área</p>
        ) : (
          sorted.map((place) => (
            <PlaceItem
              key={place.id}
              place={place}
              distanceLabel={formatDistance(
                distanceDeg(place.lat, place.lng, centerLat, centerLng),
              )}
              onClick={() => onSelect(place.id)}
              selected={selectedId === place.id}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add `.emptyArea` to `BottomSheet.module.css`**

Append to `frontend/src/components/BottomSheet.module.css`:

```css
.emptyArea {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 0.875rem;
}
```

- [ ] **Step 5: Update `App.tsx` to pass new props to `BottomSheet`**

In `frontend/src/App.tsx`, find the `<BottomSheet` JSX block and add three props after `categories={categories}`:

```tsx
              onScreenOnly={onScreenOnly}
              mapBounds={mapBounds}
              onScreenOnlyToggle={() => setOnScreenOnly((v) => !v)}
```

The full updated `<BottomSheet` call becomes:

```tsx
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
              onScreenOnly={onScreenOnly}
              mapBounds={mapBounds}
              onScreenOnlyToggle={() => setOnScreenOnly((v) => !v)}
            />
```

- [ ] **Step 6: Run full test suite**

```bash
cd frontend && npm test
```

Expected: all tests PASS

- [ ] **Step 7: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/BottomSheet.tsx frontend/src/components/BottomSheet.module.css frontend/src/components/BottomSheet.test.tsx frontend/src/App.tsx
git commit -m "feat: add bounds filter to BottomSheet"
```

---

## Manual Verification Checklist

After all tasks are complete, verify in browser (`npm run dev` in `frontend/`):

- [ ] "Na tela" chip appears in filter bar (disabled/greyed until map loads)
- [ ] After map loads and fires first camera event, chip becomes clickable
- [ ] Clicking "Na tela" activates it (chip shows active style, `aria-pressed=true`)
- [ ] List updates immediately to show only places within current viewport
- [ ] Panning the map while "Na tela" is active updates the list live
- [ ] Zooming out includes more places; zooming in narrows the list
- [ ] When no places are in view: "Nenhum lugar nesta área" appears
- [ ] Clicking "Na tela" again deactivates it; full list returns
- [ ] Status and category filters still work alongside "Na tela" (they stack)
- [ ] Mobile bottom sheet also has the toggle and behaves identically
