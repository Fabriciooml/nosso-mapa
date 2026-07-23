# Configurable app name & default map center — design

## Why

Nosso Mapa was built assuming exactly 2 users (a couple). That assumption doesn't hold structurally anywhere in the code — reviewer identity is already an open-ended localStorage name, not limited to 2 people — but the product is still hardcoded to one name ("Nosso Mapa") and one default map location (Praça Sete de Setembro, BH), both chosen for the original deployment. To let the same codebase serve other deployments (different name, different city) without a code change, both become Docker-configurable at build time, following the existing pattern used for `VITE_GOOGLE_MAPS_API_KEY`.

Out of scope for this pass: UI language/locale (all strings are hardcoded Portuguese — a much larger i18n effort, its own future spec if ever needed), DB filename, and the `nosso_mapa_identity` localStorage key (both internal-only, not user-facing).

## Config timing

Build-time, matching `VITE_GOOGLE_MAPS_API_KEY`: values are baked into the static bundle via Vite's `import.meta.env` at `npm run build` / `docker build`. Renaming an existing deployment requires a rebuild (`docker compose build`), not just an env var change + restart. This was a deliberate choice over runtime config (which would need an nginx entrypoint script to inject values into already-built static files) — simplicity over zero-rebuild convenience, consistent with how the API key already works.

## Where defaults live

Single source of truth: `frontend/src/config.ts` (new file). It reads `import.meta.env.VITE_*` and falls back to today's hardcoded values if unset/blank:

```ts
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Nosso Mapa'
export const DEFAULT_CENTER = {
  lat: Number(import.meta.env.VITE_DEFAULT_CENTER_LAT) || -19.9186,
  lng: Number(import.meta.env.VITE_DEFAULT_CENTER_LNG) || -43.9388,
}
```

`Number('')` and `Number(undefined)` are both falsy (`0`/`NaN`), so an unset var falls through to the default via `||` — this works identically whether the app runs through Docker or via `npm run dev` locally, since `config.ts` is the only place a default is declared. `docker-compose.yml` passes the three vars through **raw**, with no default baked into the compose file itself (`${VITE_APP_NAME:-}`) — avoids having the same default value duplicated in two places that could drift out of sync.

## Components touched

- **`frontend/src/config.ts`** (new) — exports `APP_NAME`, `DEFAULT_CENTER` as above.
- **`frontend/src/main.tsx`** — sets `document.title = APP_NAME` on load.
- **`frontend/index.html`** — `<title>` keeps a static generic fallback (for the brief pre-JS-execution flash); real title is set dynamically by `main.tsx`.
- **`frontend/src/App.tsx`** — imports `DEFAULT_CENTER` from `config.ts` instead of its local hardcoded const.
- **`frontend/src/components/ListPanel.tsx`** — wordmark renders `{APP_NAME}` instead of the literal string `"Nosso Mapa"`.
- **`frontend/Dockerfile`** — adds `ARG`/`ENV` pairs for `VITE_APP_NAME`, `VITE_DEFAULT_CENTER_LAT`, `VITE_DEFAULT_CENTER_LNG`, mirroring the existing `VITE_GOOGLE_MAPS_API_KEY` lines.
- **`docker-compose.yml`** — adds the three vars to the frontend service's `build.args`, passed through raw (no default in this file).

## Data flow

`docker-compose.yml` (env or `.env` file) → build arg → Dockerfile `ARG`/`ENV` → Vite's `import.meta.env.VITE_*` at build time → `config.ts` (applies fallback if blank/unset) → consumed by `main.tsx` (title) and `ListPanel.tsx`/`App.tsx` (wordmark, map center).

## Error handling

No runtime errors possible — all inputs are build-time strings/numbers with a `||` fallback covering every falsy case (unset, empty string, non-numeric string coercing to `NaN`). No validation needed since a malformed value simply falls back to the default rather than crashing.

## Testing

Existing tests keep passing unchanged: `ListPanel.test.tsx`'s `getByText('Nosso Mapa')` still matches because the default value in `config.ts` is unchanged. New coverage: a small `config.test.ts` (or inline in existing test files) verifying the fallback behavior — e.g. mocking `import.meta.env` to confirm `APP_NAME`/`DEFAULT_CENTER` fall back correctly when env vars are unset, and pick up the override when set.
