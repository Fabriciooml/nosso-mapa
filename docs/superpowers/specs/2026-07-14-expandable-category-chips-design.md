# Expandable Category Chips

## Problem

Category lists render as one unbroken line (plain "·"-joined text in `PlaceItem` and
`PlaceDetail`, wrapping chip buttons in `FilterBar`). Places/filters with many categories
either overflow with an ellipsis (list row) or push the layout taller (`FilterBar` wraps to
multiple lines). There's no way to see the full set without it always taking full space.

## Goal

Category lists truncate to a fixed count and show a `+N` toggle. Tapping it expands to show
all categories; tapping again collapses back. Applies to three call sites:

- `PlaceItem` — list row category line
- `PlaceDetail` — detail panel category line
- `FilterBar` — category filter chip group (status/on-screen groups untouched)

## Shared component: `ExpandableChipRow<T>`

New file `frontend/src/components/ExpandableChipRow.tsx` (+ `.module.css`).

```ts
interface Props<T> {
  items: T[]
  visibleCount: number
  keyFn: (item: T) => string | number
  renderItem: (item: T) => ReactNode
}
```

Behavior:
- Local `expanded` state, default `false`.
- If `items.length <= visibleCount`: render all items, no toggle chip.
- Collapsed (`expanded === false` and truncation needed): render first `visibleCount` items
  + a toggle chip showing `+N` (`N = items.length - visibleCount`).
- Expanded: render all items + a toggle chip showing `−`.
- Toggle chip is a real `<button>`. Its `onClick` calls `event.stopPropagation()` then flips
  `expanded`.
- `renderItem` is fully owned by the caller — this component only handles slicing and the
  toggle. It does not know or care whether items are interactive (filter buttons) or static
  (display pills).

## Integration

### PlaceItem (`visibleCount = 2`)

`frontend/src/components/PlaceItem.tsx` currently renders the whole row as a `<button>`
(click opens detail). Nesting a real `<button>` (the toggle) inside a `<button>` is invalid
HTML. Change the outer element to:

```tsx
<div role="button" tabIndex={0} onClick={onClick} onKeyDown={handleKeyDown} ...>
```

`handleKeyDown` triggers `onClick` on `Enter`/`Space`, preserving keyboard accessibility.

Category line changes from plain "·"-joined text to `ExpandableChipRow` with `renderItem`
producing a small non-interactive pill `<span>` per category.

### PlaceDetail (`visibleCount = 3`)

The category `<p>` text line becomes an `ExpandableChipRow` with the same non-interactive
pill rendering as `PlaceItem` (visually consistent, but a separate CSS module scope/size
since the detail panel has more room).

`PlaceDetail` does not remount when the user switches between places (`App.tsx` passes a
new `place` prop to the same component instance, no `key`). To avoid a stale expanded state
leaking from one place to the next, the `ExpandableChipRow` instance inside `PlaceDetail` is
given `key={place.id}` — this remounts just that subtree (resetting `expanded`) on place
switch, without remounting the rest of the panel.

### FilterBar (`visibleCount = 3`, categories group only)

Only the categories chip group (`frontend/src/components/FilterBar.tsx:67-83`) is wrapped
in `ExpandableChipRow`. The status and "on-screen" groups are small, fixed-size sets and are
left as-is.

`renderItem` reuses the existing filter toggle `<button>` unchanged (active/inactive style,
`onCategoryToggle` call) — only the surrounding truncation/expand logic is new.

## Styling

All three call sites render pill-shaped chips consistent with `FilterBar`'s existing
`.chip` look: `--bg-surface` background, `--border` border, `999px` border-radius. The
`+N`/`−` toggle chip uses the same pill shape in a muted color (`--text-muted`), visually
distinct from active/selected chips.

- `PlaceItem` pills: small, non-interactive (no hover/active states), matches the row's
  compact `.meta` sizing.
- `PlaceDetail` pills: same non-interactive style, slightly larger to match the panel's
  looser spacing.
- `FilterBar` pills: unchanged (existing interactive `.chip`/`.catActive` styles).

## Testing

- New `ExpandableChipRow.test.tsx`: renders all items with no toggle when under
  `visibleCount`; shows `+N` and truncates when over; expands on toggle click; collapses
  back on second click; toggle click does not bubble to a parent click handler.
- `PlaceItem.test.tsx`: update for the `div[role=button]` markup change; add a case for
  `+N` truncation and expand-without-triggering-onClick.
- `PlaceDetail.test.tsx`: add truncation/expand case; verify expand state resets when
  `place` prop changes (different `place.id`).
- `FilterBar.test.tsx`: add case for category group truncation/expand; verify existing
  toggle/active-state behavior still works within the wrapped group.

## Out of scope

- Dynamic/measured truncation (width-based) — fixed counts only, per user decision.
- Any change to status or on-screen filter groups in `FilterBar`.
- Persisting expanded state across sessions or across list re-renders beyond what's
  described above.
