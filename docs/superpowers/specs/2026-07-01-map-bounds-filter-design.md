# Map Bounds Filter Design

## Goal

Add a toggle that switches the place list between showing all places and showing only places currently visible in the map viewport.

## Architecture

State lives in `App.tsx`. `MapView` exposes bounds via an extended `onCameraChanged` callback. `ListPanel` and `BottomSheet` receive `onScreenOnly` + `mapBounds` and apply a bounds filter in their filtering pipeline. `FilterBar` renders the toggle chip.

### State added to `App.tsx`

```ts
const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
const [onScreenOnly, setOnScreenOnly] = useState(false)
```

`mapBounds` starts `null` until the first camera event fires. Toggle defaults to `false` (show all).

### `MapBounds` type — added to `types.ts`

```ts
export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}
```

---

## Component Interfaces

### `MapView` — extended `onCameraChanged`

```ts
interface Props {
  // ... existing props ...
  onCameraChanged: (lat: number, lng: number, bounds: MapBounds) => void
}
```

Handler extracts `ev.detail.bounds` (provided by `@vis.gl/react-google-maps`) alongside `ev.detail.center`. App stores both.

### `FilterBar` — new props

```ts
interface Props {
  // ... existing props ...
  onScreenOnly: boolean
  onScreenOnlyToggle: () => void
  boundsReady: boolean  // false until first camera event; disables toggle
}
```

Renders a "Na tela" chip above the existing filter groups. Styled identically to existing chips. `aria-pressed` reflects active state. Disabled (and visually muted) when `boundsReady` is false.

### `ListPanel` and `BottomSheet` — new props

```ts
interface Props {
  // ... existing props ...
  onScreenOnly: boolean
  mapBounds: MapBounds | null
  onScreenOnlyToggle: () => void
}
```

Both components forward `onScreenOnly`, `onScreenOnlyToggle`, and `boundsReady` down to `FilterBar`, and apply bounds filtering in their own filtering pipeline.

---

## Filtering Pipeline

Applied in order inside `ListPanel` and `BottomSheet`:

1. Status filter (existing)
2. Category filter (existing)
3. Bounds filter (new — only when `onScreenOnly && mapBounds !== null`)
4. Sort by distance from center (existing)

---

## `isInBounds` Utility

Pure function, lives in `utils/bounds.ts`. Imports `MapBounds` from `../types`:

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

Takes any object with `lat`/`lng` (not `Place` specifically) so tests don't need to construct full `Place` objects.

---

## Empty State

When `onScreenOnly` is true and the filtered list is empty, both `ListPanel` and `BottomSheet` render:

```
Nenhum lugar nesta área
```

as a centered muted text instead of an empty list.

---

## Error & Edge Cases

| Scenario | Behavior |
|----------|----------|
| `mapBounds` null (before first camera event) | Toggle disabled; list shows all places |
| User pans map | Bounds update reactively; list re-filters live |
| All places off-screen | Empty state message shown |
| `onScreenOnly` false | Bounds ignored; all places shown (subject to status/category filters) |
| Antimeridian crossing (lng wrap-around) | Out of scope — BH is nowhere near ±180° |

---

## Testing

### `utils/bounds.test.ts`
- Place inside bounds → `true`
- Place on north/south/east/west edge → `true` (inclusive)
- Place outside → `false` for each direction
- Place outside on multiple axes → `false`

### `FilterBar.test.tsx`
- "Na tela" chip renders
- `aria-pressed` reflects `onScreenOnly`
- Clicking calls `onScreenOnlyToggle`
- Chip disabled when `boundsReady=false`

### `ListPanel.test.tsx`
- When `onScreenOnly=false`: bounds ignored, all status/category-filtered places shown
- When `onScreenOnly=true` and `mapBounds` set: only in-bounds places shown
- When `onScreenOnly=true` and no places in bounds: empty state message shown

### `BottomSheet.test.tsx`
- Same three cases as `ListPanel`

---

## Files Changed

| Action | Path | What changes |
|--------|------|-------------|
| Modify | `frontend/src/types.ts` | Add `MapBounds` interface |
| Create | `frontend/src/utils/bounds.ts` | `isInBounds` function |
| Create | `frontend/src/utils/bounds.test.ts` | Unit tests for `isInBounds` |
| Modify | `frontend/src/components/MapView.tsx` | Extend `onCameraChanged` to pass bounds |
| Modify | `frontend/src/App.tsx` | Add `mapBounds`, `onScreenOnly` state; wire props |
| Modify | `frontend/src/components/FilterBar.tsx` | Add toggle chip + new props |
| Modify | `frontend/src/components/FilterBar.test.tsx` | Test toggle |
| Modify | `frontend/src/components/ListPanel.tsx` | Bounds filter + empty state |
| Modify | `frontend/src/components/ListPanel.test.tsx` | Test bounds filtering |
| Modify | `frontend/src/components/BottomSheet.tsx` | Bounds filter + empty state |
| Modify | `frontend/src/components/BottomSheet.test.tsx` | Test bounds filtering |
