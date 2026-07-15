# Map Pins Respect Filters + Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map pins (`MapView`) show only places matching the active status/category filters and search query, same as the list — while a selected place's pin always stays visible even if filters would otherwise exclude it.

**Architecture:** Reuse the existing `filterPlaces()` util (already used by `ListPanel`/`BottomSheet`) in `App.tsx` to compute a filtered list for the map, passing `onScreenOnly: false, mapBounds: null` so bounds don't apply. A new small pure util, `visiblePlaces()`, merges the currently-selected place back in if the filter excluded it. `App.tsx` passes the result to both `<MapView>` call sites instead of the raw `places` array. `MapView.tsx` itself needs no changes.

**Tech Stack:** React + TypeScript, Vitest + Testing Library.

---

### Task 1: `visiblePlaces` util

**Files:**
- Create: `frontend/src/utils/visiblePlaces.ts`
- Test: `frontend/src/utils/visiblePlaces.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/utils/visiblePlaces.test.ts
import { describe, it, expect } from 'vitest'
import { visiblePlaces } from './visiblePlaces'
import type { Place } from '../types'

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

describe('visiblePlaces', () => {
  it('returns filtered unchanged when there is no selection', () => {
    const filtered = [place({ id: 1 }), place({ id: 2 })]
    expect(visiblePlaces(filtered, null)).toEqual(filtered)
  })

  it('returns filtered unchanged when the selected place is already present', () => {
    const filtered = [place({ id: 1 }), place({ id: 2 })]
    expect(visiblePlaces(filtered, filtered[0])).toEqual(filtered)
  })

  it('appends the selected place when it was filtered out', () => {
    const filtered = [place({ id: 1 })]
    const selected = place({ id: 2 })
    expect(visiblePlaces(filtered, selected)).toEqual([filtered[0], selected])
  })

  it('returns just the selection when filtered is empty', () => {
    const selected = place({ id: 5 })
    expect(visiblePlaces([], selected)).toEqual([selected])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/utils/visiblePlaces.test.ts`
Expected: FAIL — `Cannot find module './visiblePlaces'`

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/utils/visiblePlaces.ts
import type { Place } from '../types'

export function visiblePlaces(filtered: Place[], selected: Place | null): Place[] {
  if (!selected || filtered.some((p) => p.id === selected.id)) return filtered
  return [...filtered, selected]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/utils/visiblePlaces.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/visiblePlaces.ts frontend/src/utils/visiblePlaces.test.ts
git commit -m "feat(frontend): add visiblePlaces util to keep selected pin visible through filters"
```

---

### Task 2: Wire filtered + selection-aware places into `MapView`

**Files:**
- Modify: `frontend/src/App.tsx`

**Context:** `App.tsx` currently passes the raw `places` array (from `usePlaces()`, unfiltered) to both `<MapView>` call sites (desktop, at line ~83-90, and mobile, at line ~96-103). `ListPanel`/`BottomSheet` already receive `statusFilter`, `categoryFilter`, `searchQuery` as props and filter internally via `filterPlaces()` — that logic is not visible in `App.tsx` and does not need to change. This task only changes what `App.tsx` computes and passes to `MapView`.

- [ ] **Step 1: Add imports**

In `frontend/src/App.tsx`, add these two imports near the existing imports (after the `styles` import on line 14 is fine, or grouped with other util-style imports — exact position doesn't matter, just keep it with the other imports):

```ts
import { filterPlaces } from './utils/filterPlaces'
import { visiblePlaces } from './utils/visiblePlaces'
```

- [ ] **Step 2: Compute `markerPlaces` after `selectedPlace`**

Find this existing line in `App.tsx`:

```ts
  const selectedPlace = places.find((p) => p.id === selectedId) ?? null
```

Add immediately after it:

```ts
  const filteredForMap = filterPlaces(places, {
    statusFilter,
    categoryFilter,
    query: searchQuery,
    onScreenOnly: false,
    mapBounds: null,
  })
  const markerPlaces = visiblePlaces(filteredForMap, selectedPlace)
```

- [ ] **Step 3: Use `markerPlaces` in both `<MapView>` call sites**

Desktop layout — change:

```tsx
            <MapView
              places={places}
              selectedId={selectedId}
              onMarkerClick={setSelectedId}
              onCameraChanged={handleCameraChanged}
              defaultCenter={DEFAULT_CENTER}
              userPosition={userPosition}
            />
```

to:

```tsx
            <MapView
              places={markerPlaces}
              selectedId={selectedId}
              onMarkerClick={setSelectedId}
              onCameraChanged={handleCameraChanged}
              defaultCenter={DEFAULT_CENTER}
              userPosition={userPosition}
            />
```

Mobile layout — change the second (mobile) `<MapView>` block the same way:

```tsx
          <MapView
            places={places}
            selectedId={selectedId}
            onMarkerClick={setSelectedId}
            onCameraChanged={handleCameraChanged}
            defaultCenter={DEFAULT_CENTER}
            userPosition={userPosition}
          />
```

to:

```tsx
          <MapView
            places={markerPlaces}
            selectedId={selectedId}
            onMarkerClick={setSelectedId}
            onCameraChanged={handleCameraChanged}
            defaultCenter={DEFAULT_CENTER}
            userPosition={userPosition}
          />
```

Do **not** change the `places={places}` props passed to `ListPanel` or `BottomSheet` — those components already do their own filtering internally via `filterPlaces()` and expect the raw list plus the filter props.

- [ ] **Step 4: Run the full frontend test suite and typecheck**

Run: `cd frontend && npx vitest run`
Expected: All tests pass (no test asserts on `MapView`'s `places` prop content, so none should break; this just confirms no regression).

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): filter map pins by status/category/search, keep selected pin visible"
```

---

### Task 3: Manual verification

No new automated test covers the App-level wiring (per design spec — `AdvancedMarker` is mocked to `null` in `App.test.tsx`, so pin-count assertions aren't practical there; `filterPlaces` itself is already fully unit-tested). Verify manually:

- [ ] **Step 1: Start backend**

```bash
DB_PATH=/tmp/claude-1000/-home-fab-codes-map-fabi-fe/d3c37f51-3a32-44fa-8d25-59bf016ac28a/scratchpad/map-pins-filter.db PYTHONPATH=backend python3 -m uvicorn app.main:app --app-dir backend --port 2000
```

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Verify in browser**

Open the app. Confirm:
- Toggling a status filter chip removes non-matching pins from the map (not just the list).
- Toggling a category filter chip removes non-matching pins from the map.
- Typing in the search bar removes non-matching pins from the map, accent/case-insensitively.
- Clearing all filters/search restores all pins.
- Click a pin to select it (detail panel opens), then apply a filter/search that would exclude that place — its pin and the open detail panel both remain, only other non-matching pins disappear.
- Combining a category filter and a search query narrows pins by both (AND).

- [ ] **Step 4: Stop dev servers**

Stop both processes (backend uvicorn, `npm run dev`) once verified.
