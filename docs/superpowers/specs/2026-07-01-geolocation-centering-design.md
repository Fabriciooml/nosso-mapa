# Geolocation Centering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On app open, center the map on the user's current GPS position with a pulsing blue dot; fall back silently to Praça Sete de Setembro (BH) if permission is denied or times out.

**Architecture:** A `useGeolocation` hook fires `getCurrentPosition()` once on mount and returns the resolved position or `null`. `App.tsx` passes the position down to both `MapView` instances. Inside `MapView`, a `GeolocationLayer` child component uses `useMap()` to pan on first position arrival and renders the blue dot marker.

**Tech Stack:** React 18, `@vis.gl/react-google-maps` (`useMap`, `AdvancedMarker`), `navigator.geolocation`, CSS keyframe animation, Vitest

---

## Files

| Action | Path |
|--------|------|
| Create | `frontend/src/hooks/useGeolocation.ts` |
| Create | `frontend/src/hooks/useGeolocation.test.ts` |
| Modify | `frontend/src/App.tsx` |
| Modify | `frontend/src/components/MapView.tsx` |
| Modify | `frontend/src/components/MapView.module.css` |

---

## Design Decisions

### Default center
`{ lat: -19.9186, lng: -43.9388 }` — Praça Sete de Setembro, Belo Horizonte. Replaces the previous Lisbon hardcode.

### Geolocation options
```ts
{ timeout: 5000, maximumAge: 60_000 }
```
`maximumAge: 60000` accepts a cached browser position up to 1 minute old — gives instant response on page reload without re-requesting GPS hardware.

### Error handling
All errors (permission denied, timeout, unavailable) leave `userPosition` as `null`. No toast, no error UI — the map simply stays on BH. Logging to `console.warn` only in development.

### Pan behavior
`GeolocationLayer` pans exactly once using a `useEffect` that checks `if (!hasPanned.current && userPosition)`. This prevents fighting with user-initiated camera moves after the initial pan.

### Blue dot
- 14×14px solid blue circle (`#4a9eff` — matches existing `to_go` status color)
- `::after` pseudo-element: expanding ring, `@keyframes` scale `1 → 2.5` + opacity `0.6 → 0`, duration 1.8s infinite
- Rendered as `AdvancedMarker` so it floats above place markers

---

## Component Interfaces

### `useGeolocation`
```ts
// frontend/src/hooks/useGeolocation.ts
export function useGeolocation(): { lat: number; lng: number } | null
```
- Fires once on mount via `useEffect`
- On success: `setPosition({ lat: coords.latitude, lng: coords.longitude })`
- On error: `console.warn` in dev, position stays `null`

### `MapView` updated props
```ts
interface Props {
  places: Place[]
  selectedId: number | null
  onMarkerClick: (id: number) => void
  onCameraChanged: (lat: number, lng: number) => void
  defaultCenter: { lat: number; lng: number }
  userPosition: { lat: number; lng: number } | null  // NEW
}
```

### `GeolocationLayer` (internal to MapView)
```tsx
// No exported interface — internal component only
function GeolocationLayer({ position }: { position: { lat: number; lng: number } | null })
```
- Uses `useMap()` — must be rendered inside `<Map>`
- `useEffect`: pans once when position first becomes non-null
- Returns `null` when position is null (no marker rendered)

---

## Error & Edge Cases

| Scenario | Behavior |
|----------|----------|
| Permission denied | `userPosition = null`, map stays on BH |
| Timeout (>5s) | `userPosition = null`, map stays on BH |
| Geolocation API unavailable (HTTP or old browser) | `userPosition = null`, map stays on BH |
| User pans after position arrives | Pan only fires once; user's camera moves are unaffected |
| Position cached by browser | `maximumAge: 60000` allows reuse → instant pan on reload |

---

## Testing

### `useGeolocation.test.ts`
- Mock `navigator.geolocation.getCurrentPosition`
- Verify: success path returns `{ lat, lng }`
- Verify: error path returns `null`
- Verify: called with correct options (`timeout: 5000, maximumAge: 60000`)

### `MapView` (existing test file)
- No changes required — `userPosition` prop is optional/nullable; existing tests pass `null` implicitly

### Manual verification
1. Grant location permission → map pans to your GPS position, blue dot visible
2. Deny permission → map stays on BH, no error shown, no dot
3. Reload after granting → cached position used, pan is instant
