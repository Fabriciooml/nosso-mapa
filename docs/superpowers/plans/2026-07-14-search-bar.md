# Search Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live-filtering search bar (by name/alias, accent-insensitive) above `FilterBar` in both `ListPanel` and `BottomSheet`.

**Architecture:** Extract the existing duplicated status/category/bounds filter logic out of `ListPanel`/`BottomSheet` into a shared `filterPlaces()` util, add query matching to it, add a small controlled `SearchBar` component, and lift `searchQuery` state to `App.tsx` alongside the existing filter state.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, CSS Modules.

---

### Task 1: `normalize` util

**Files:**
- Create: `frontend/src/utils/search.ts`
- Test: `frontend/src/utils/search.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/utils/search.test.ts`
Expected: FAIL with "Failed to resolve import './search'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```ts
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/utils/search.test.ts`
Expected: PASS (5/5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/search.ts frontend/src/utils/search.test.ts
git commit -m "feat(frontend): add normalize util for accent-insensitive matching"
```

---

### Task 2: `filterPlaces` util

This extracts the status/category/bounds filter logic currently duplicated inline in
`ListPanel.tsx` and `BottomSheet.tsx`, and adds query matching against `name`/`alias`.

**Files:**
- Create: `frontend/src/utils/filterPlaces.ts`
- Test: `frontend/src/utils/filterPlaces.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { filterPlaces } from './filterPlaces'
import type { Place, PlaceStatus, MapBounds } from '../types'

function place(overrides: Partial<Place>): Place {
  return {
    id: 1,
    name: 'Lugar',
    alias: null,
    description: null,
    google_place_id: null,
    lat: 0,
    lng: 0,
    status: 'to_go',
    avg_rating: null,
    categories: [],
    created_at: '',
    ...overrides,
  }
}

const PLACES: Place[] = [
  place({
    id: 1,
    name: 'Cantinho do Avillez',
    alias: 'Avillez',
    status: 'to_go',
    categories: [{ id: 1, name: 'Restaurante' }],
    lat: 0,
    lng: 0,
  }),
  place({
    id: 2,
    name: 'Museu de Artes',
    alias: null,
    status: 'gone',
    categories: [{ id: 2, name: 'Cultura' }],
    lat: 10,
    lng: 10,
  }),
]

const baseOpts = {
  statusFilter: [] as PlaceStatus[],
  categoryFilter: [] as number[],
  query: '',
  onScreenOnly: false,
  mapBounds: null as MapBounds | null,
}

describe('filterPlaces', () => {
  it('returns all places with default (empty) options', () => {
    expect(filterPlaces(PLACES, baseOpts)).toHaveLength(2)
  })

  it('filters by status', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, statusFilter: ['to_go'] })
    expect(result.map((p) => p.id)).toEqual([1])
  })

  it('filters by category', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, categoryFilter: [2] })
    expect(result.map((p) => p.id)).toEqual([2])
  })

  it('filters by bounds when onScreenOnly is true', () => {
    const bounds: MapBounds = { north: 2, south: -2, east: 2, west: -2 }
    const result = filterPlaces(PLACES, { ...baseOpts, onScreenOnly: true, mapBounds: bounds })
    expect(result.map((p) => p.id)).toEqual([1])
  })

  it('ignores bounds when onScreenOnly is false', () => {
    const bounds: MapBounds = { north: 2, south: -2, east: 2, west: -2 }
    const result = filterPlaces(PLACES, { ...baseOpts, onScreenOnly: false, mapBounds: bounds })
    expect(result).toHaveLength(2)
  })

  it('matches query against name', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, query: 'Museu' })
    expect(result.map((p) => p.id)).toEqual([2])
  })

  it('matches query against alias', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, query: 'Avillez' })
    expect(result.map((p) => p.id)).toEqual([1])
  })

  it('matches query case-insensitively', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, query: 'CANTINHO' })
    expect(result.map((p) => p.id)).toEqual([1])
  })

  it('matches query accent-insensitively', () => {
    const withAccent = [place({ id: 3, name: 'Café da Praça' })]
    const result = filterPlaces(withAccent, { ...baseOpts, query: 'cafe da praca' })
    expect(result).toHaveLength(1)
  })

  it('returns empty array when query matches nothing', () => {
    expect(filterPlaces(PLACES, { ...baseOpts, query: 'zzz' })).toHaveLength(0)
  })

  it('combines query with an active status filter (AND semantics)', () => {
    const result = filterPlaces(PLACES, { ...baseOpts, query: 'Museu', statusFilter: ['to_go'] })
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/utils/filterPlaces.test.ts`
Expected: FAIL with "Failed to resolve import './filterPlaces'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Place, PlaceStatus, MapBounds } from '../types'
import { isInBounds } from './bounds'
import { normalize } from './search'

interface FilterOptions {
  statusFilter: PlaceStatus[]
  categoryFilter: number[]
  query: string
  onScreenOnly: boolean
  mapBounds: MapBounds | null
}

export function filterPlaces(places: Place[], opts: FilterOptions): Place[] {
  const q = normalize(opts.query.trim())

  return places.filter((p) => {
    const statusOk = opts.statusFilter.length === 0 || opts.statusFilter.includes(p.status)
    const catOk =
      opts.categoryFilter.length === 0 ||
      p.categories.some((c) => opts.categoryFilter.includes(c.id))
    const queryOk =
      q === '' ||
      normalize(p.name).includes(q) ||
      (p.alias !== null && normalize(p.alias).includes(q))
    const boundsOk = !opts.onScreenOnly || !opts.mapBounds || isInBounds(p, opts.mapBounds)
    return statusOk && catOk && queryOk && boundsOk
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/utils/filterPlaces.test.ts`
Expected: PASS (11/11 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/filterPlaces.ts frontend/src/utils/filterPlaces.test.ts
git commit -m "feat(frontend): add filterPlaces util with status/category/bounds/query filtering"
```

---

### Task 3: `SearchBar` component

**Files:**
- Create: `frontend/src/components/SearchBar.tsx`
- Create: `frontend/src/components/SearchBar.module.css`
- Test: `frontend/src/components/SearchBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/SearchBar.test.tsx`
Expected: FAIL with "Failed to resolve import './SearchBar'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

`frontend/src/components/SearchBar.tsx`:

```tsx
import { useRef } from 'react'
import styles from './SearchBar.module.css'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClear() {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder="Buscar lugar..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value !== '' && (
        <button
          type="button"
          className={styles.clear}
          onClick={handleClear}
          aria-label="Limpar busca"
        >
          ×
        </button>
      )}
    </div>
  )
}
```

`frontend/src/components/SearchBar.module.css`:

```css
.wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.625rem 2rem 0.625rem 0.875rem;
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 0.9375rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.input:focus {
  border-color: var(--amber);
}

.clear {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.125rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.25rem;
}

.clear:hover {
  color: var(--text-primary);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/SearchBar.test.tsx`
Expected: PASS (4/4 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SearchBar.tsx frontend/src/components/SearchBar.module.css frontend/src/components/SearchBar.test.tsx
git commit -m "feat(frontend): add SearchBar component"
```

---

### Task 4: Wire search into `App`, `ListPanel`, `BottomSheet`

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/ListPanel.tsx`
- Modify: `frontend/src/components/ListPanel.module.css`
- Modify: `frontend/src/components/BottomSheet.tsx`
- Modify: `frontend/src/components/BottomSheet.module.css`
- Test: `frontend/src/components/ListPanel.test.tsx`
- Test: `frontend/src/components/BottomSheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `frontend/src/components/ListPanel.test.tsx`, add `useState` to the React import, add
`searchQuery: '', onSearchChange: vi.fn()` to `defaultProps`, and add these two `it` blocks
inside the `describe('ListPanel', ...)` block:

```tsx
import { useState } from 'react'
```
(add alongside the existing imports at the top of the file)

```tsx
  it('filters places by search query', async () => {
    function Wrapper() {
      const [query, setQuery] = useState('')
      return <ListPanel {...defaultProps} searchQuery={query} onSearchChange={setQuery} />
    }
    render(<Wrapper />)
    await userEvent.type(screen.getByPlaceholderText('Buscar lugar...'), 'Perto')
    expect(screen.getByText('Lugar Perto')).toBeInTheDocument()
    expect(screen.queryByText('Lugar Longe')).not.toBeInTheDocument()
  })

  it('shows "Nenhum lugar encontrado" when search matches nothing', async () => {
    function Wrapper() {
      const [query, setQuery] = useState('')
      return <ListPanel {...defaultProps} searchQuery={query} onSearchChange={setQuery} />
    }
    render(<Wrapper />)
    await userEvent.type(screen.getByPlaceholderText('Buscar lugar...'), 'zzz')
    expect(screen.getByText('Nenhum lugar encontrado')).toBeInTheDocument()
  })
```

In `frontend/src/components/BottomSheet.test.tsx`, add `useState` to the React import
(`import { useState } from 'react'`), add `searchQuery: '', onSearchChange: vi.fn()` to
`defaultProps`, and add these two `it` blocks inside `describe('BottomSheet', ...)`:

```tsx
  it('filters places by search query', async () => {
    function Wrapper() {
      const [query, setQuery] = useState('')
      return <BottomSheet {...defaultProps} searchQuery={query} onSearchChange={setQuery} />
    }
    render(<Wrapper />)
    await userEvent.type(screen.getByPlaceholderText('Buscar lugar...'), 'zzz')
    expect(screen.queryByText('Café Central')).not.toBeInTheDocument()
  })

  it('shows "Nenhum lugar encontrado" when search matches nothing', async () => {
    function Wrapper() {
      const [query, setQuery] = useState('')
      return <BottomSheet {...defaultProps} searchQuery={query} onSearchChange={setQuery} />
    }
    render(<Wrapper />)
    await userEvent.type(screen.getByPlaceholderText('Buscar lugar...'), 'zzz')
    expect(screen.getByText('Nenhum lugar encontrado')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/ListPanel.test.tsx src/components/BottomSheet.test.tsx`
Expected: FAIL — TypeScript error (`searchQuery`/`onSearchChange` don't exist on `Props`) and/or
`getByPlaceholderText` finds no match (no `SearchBar` rendered yet)

- [ ] **Step 3: Update `ListPanel.tsx`**

Replace the full file contents:

```tsx
import type { Place, PlaceStatus, Category, MapBounds } from '../types'
import { PlaceItem } from './PlaceItem'
import { FilterBar } from './FilterBar'
import { SearchBar } from './SearchBar'
import { filterPlaces } from '../utils/filterPlaces'
import { sortPlacesByDistance, distanceDeg, formatDistance } from '../utils/distance'
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
  searchQuery: string
  onSearchChange: (value: string) => void
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
  searchQuery,
  onSearchChange,
}: Props) {
  const filtered = filterPlaces(places, {
    statusFilter,
    categoryFilter,
    query: searchQuery,
    onScreenOnly,
    mapBounds,
  })

  const sorted = sortPlacesByDistance(filtered, centerLat, centerLng)

  const emptyMessage =
    sorted.length > 0
      ? null
      : searchQuery.trim() !== ''
        ? 'Nenhum lugar encontrado'
        : onScreenOnly
          ? 'Nenhum lugar nesta área'
          : null

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.wordmark}>Nosso Mapa</span>
      </div>
      <div className={styles.search}>
        <SearchBar value={searchQuery} onChange={onSearchChange} />
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
        {emptyMessage ? (
          <p className={styles.emptyArea}>{emptyMessage}</p>
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

Add to `frontend/src/components/ListPanel.module.css` (after the `.header` block):

```css
.search {
  padding: 0.5rem 0.75rem 0;
}
```

- [ ] **Step 4: Update `BottomSheet.tsx`**

Replace the full file contents:

```tsx
import { useState } from 'react'
import type { Place, PlaceStatus, Category, MapBounds } from '../types'
import { PlaceItem } from './PlaceItem'
import { FilterBar } from './FilterBar'
import { SearchBar } from './SearchBar'
import { filterPlaces } from '../utils/filterPlaces'
import { sortPlacesByDistance, distanceDeg, formatDistance } from '../utils/distance'
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
  searchQuery: string
  onSearchChange: (value: string) => void
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
  searchQuery,
  onSearchChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const filtered = filterPlaces(places, {
    statusFilter,
    categoryFilter,
    query: searchQuery,
    onScreenOnly,
    mapBounds,
  })

  const sorted = sortPlacesByDistance(filtered, centerLat, centerLng)

  const emptyMessage =
    sorted.length > 0
      ? null
      : searchQuery.trim() !== ''
        ? 'Nenhum lugar encontrado'
        : onScreenOnly
          ? 'Nenhum lugar nesta área'
          : null

  return (
    <div className={`${styles.sheet} ${expanded ? styles.expanded : ''}`}>
      <button
        className={styles.handle}
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? 'Recolher lista' : 'Expandir lista'}
      >
        <span className={styles.pill} />
      </button>
      <div className={styles.search}>
        <SearchBar value={searchQuery} onChange={onSearchChange} />
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
        {emptyMessage ? (
          <p className={styles.emptyArea}>{emptyMessage}</p>
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

Add to `frontend/src/components/BottomSheet.module.css` (after the `.pill` block):

```css
.search {
  padding: 0.5rem 0.75rem 0;
  flex-shrink: 0;
}
```

- [ ] **Step 5: Update `App.tsx`**

Add search state (in `frontend/src/App.tsx`, alongside the other `useState` filter declarations,
after `const [categoryFilter, setCategoryFilter] = useState<number[]>([])`):

```tsx
  const [searchQuery, setSearchQuery] = useState('')
```

Pass the new props to both `ListPanel` and `BottomSheet`. For `ListPanel` (inside the desktop
layout block), add after `onScreenOnlyToggle={() => setOnScreenOnly((v) => !v)}`:

```tsx
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
```

For `BottomSheet` (inside the mobile layout block), add after its own
`onScreenOnlyToggle={() => setOnScreenOnly((v) => !v)}`:

```tsx
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/ListPanel.test.tsx src/components/BottomSheet.test.tsx`
Expected: PASS (9/9 in ListPanel.test.tsx, 6/6 in BottomSheet.test.tsx)

- [ ] **Step 7: Run full test suite and typecheck**

Run: `cd frontend && npx vitest run`
Expected: All test files pass

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/ListPanel.tsx frontend/src/components/ListPanel.module.css frontend/src/components/ListPanel.test.tsx frontend/src/components/BottomSheet.tsx frontend/src/components/BottomSheet.module.css frontend/src/components/BottomSheet.test.tsx
git commit -m "feat(frontend): wire search bar into ListPanel, BottomSheet, App"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: All test files pass, no failures

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual smoke test (if browser tooling is unavailable, state so explicitly rather than skipping silently)**

Start the backend (from repo root):

```bash
DB_PATH=/tmp/search-bar-verify.db PYTHONPATH=backend python3 -m uvicorn app.main:app --app-dir backend --port 2000
```

Start the frontend dev server in another terminal:

```bash
cd frontend && npm run dev
```

Open the app, type into the new search box, and confirm:
- The list narrows to places whose name or alias matches (case/accent-insensitive)
- Clearing the input (× button or backspace) restores the full list
- Combining a search term with an active status/category filter narrows further (AND)
- Searching for something with no matches shows "Nenhum lugar encontrado"

- [ ] **Step 4: Final commit if any fixes were needed during verification**

```bash
git add -A
git commit -m "fix(frontend): address issues found during search bar verification"
```

(Skip this step if no fixes were needed.)
