# Map Pins Respect Filters + Search — Design

## Problem

Map pins (`MapView`) currently render every place regardless of active status filter, category filter, or search query. Only the list/bottom-sheet respects those filters (via `filterPlaces`, added in the search-bar feature). Users expect the map to match what they've filtered/searched for.

## Goal

Map pins show only places matching the active `statusFilter`, `categoryFilter`, and `searchQuery` — same matching rules as the list. The `onScreenOnly` toggle stays list-only and does not affect which pins render (it would be circular: it already means "restrict list to what's inside current map bounds").

If a place is selected (detail panel open) and a filter/search change would exclude it, its pin stays visible and the detail panel stays open — selection overrides filtering.

## Architecture

`App.tsx` already computes the filtered list for `ListPanel`/`BottomSheet` via the existing `filterPlaces()` util (from `frontend/src/utils/filterPlaces.ts`). Reuse it for the map:

```ts
const filteredPlaces = filterPlaces(places, {
  statusFilter,
  categoryFilter,
  query: searchQuery,
  onScreenOnly: false,
  mapBounds: null,
})
const markerPlaces = visiblePlaces(filteredPlaces, selectedPlace)
```

`onScreenOnly: false` / `mapBounds: null` are passed so the bounds-filter branch inside `filterPlaces` is a no-op — the map always shows filter/search matches regardless of current viewport.

`markerPlaces` replaces `places` in both `<MapView>` call sites (desktop `.mapArea` and mobile layout). `MapView.tsx` itself is unchanged — it still just renders whatever `Place[]` it's given.

## New util: `frontend/src/utils/visiblePlaces.ts`

```ts
import type { Place } from '../types'

export function visiblePlaces(filtered: Place[], selected: Place | null): Place[] {
  if (!selected || filtered.some((p) => p.id === selected.id)) return filtered
  return [...filtered, selected]
}
```

Pure function: given the already-filtered list and the currently selected place (or `null`), returns the filtered list unchanged if there's no selection or the selection is already present, otherwise appends the selection so its pin never disappears out from under an open detail panel.

## Testing

- `frontend/src/utils/visiblePlaces.test.ts`:
  - no selection (`null`) → returns `filtered` unchanged
  - selected place already present in `filtered` → returns `filtered` unchanged (no duplicate)
  - selected place absent from `filtered` → returned list is `filtered` plus the selected place appended
  - empty `filtered` array + a selection → returns `[selected]`
- `filterPlaces` behavior (status/category/query matching) is already fully covered by existing tests from the search-bar feature — no new tests needed there.
- Manual smoke test: toggle a status/category filter and type a search query with the map visible, confirm non-matching pins disappear and matching ones remain; select a pin, then change filters to exclude it, confirm the pin and detail panel stay put.

## Out of scope

- No change to the `onScreenOnly` toggle or its meaning.
- No map-specific empty state (e.g., no "no pins" overlay).
- No animation/clustering on pin add/remove.
- No change to `MapView.tsx`'s props or rendering logic.
