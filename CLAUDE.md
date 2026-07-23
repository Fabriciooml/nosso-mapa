# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Nosso Mapa" — private map app for a small group of trusted users (Portuguese UI). Tracks places to visit (`to_go`), visited (`gone`), and want-to-repeat (`repeat`). No auth — a localStorage name picker identifies the reviewer. Homelab deployment via Docker Compose behind Portainer.

## Commands

**Frontend** (`frontend/`):
- `npm run dev` — Vite dev server on port 1996, proxies `/api` → `http://localhost:2000`
- `npm run build` — `tsc` typecheck + Vite build
- `npm test` — Vitest (`--passWithNoTests`)
- Single test file: `npx vitest run src/components/PlaceItem.test.tsx`
- Single test case: `npx vitest run -t "test name"`

**Backend** (`backend/`), from within `backend/` with the venv active:
- `pytest tests/ -v` — unit tests (spins up a fresh SQLite DB per test via `tests/conftest.py`'s `db_path`/`client` fixtures, which monkeypatch `DB_PATH` and re-run `init_db()`)
- `pytest tests/test_places.py::test_delete_place_returns_204 -v` — single test
- No lint/format tooling configured for the backend.

**Integration tests** (`tests/test_integration.py`, root-level): require the full Docker stack running (`docker compose up -d`), hit the app through both the nginx proxy (port 1996) and the backend directly (port 2000). Run with `cd tests && pytest test_integration.py -v`.

**Full stack**: `docker compose up -d` — frontend (nginx, :1996) depends on backend (:2000) healthcheck; SQLite DB lives on a named volume mounted at `/app/data` in the backend container.

## Architecture

**Backend** — FastAPI + raw `sqlite3` (no ORM). Structure:
- `app/database.py` — `get_db()` opens a fresh connection per request; `init_db()` creates tables idempotently and runs additive `ALTER TABLE` migrations wrapped in `try/except sqlite3.OperationalError` (there is no migration framework — new columns are added this way, always nullable/backward-compatible).
- `app/models.py` — Pydantic request/response schemas, including validators (e.g. `PlaceStatusUpdate.status` must be `to_go`/`gone`/`repeat`; `ReviewCreate.rating` must be 1.0–5.0 in 0.5 steps).
- `app/routers/{places,categories,admin}.py` — one router per resource, each opens/closes its own `conn` per handler (`try/finally: conn.close()`).
- Places are soft-deleted (`deleted_at` column); `_fetch_place()` in `places.py` is the canonical single-place read (joins categories, averages reviews) and filters `deleted_at IS NULL`.
- Creating a place with a `google_place_id` that matches a soft-deleted place *revives* it (updates in place, returns 200) instead of erroring — dedup logic lives in `create_place()`.
- `app/scripts/backfill_google_places.py` — one-off enrichment script (website/hours/price level from Google Places API), invoked via `POST /api/admin/backfill-google-places` (requires `GOOGLE_PLACES_API_KEY` env var).

**Frontend** — React + Vite + TanStack Query, no router (single-page). Structure:
- `src/api.ts` — thin `fetch` wrapper (`request<T>`), one object (`api.places.*`, `api.categories.*`) mapping directly to backend endpoints.
- `src/hooks/` — one `useQuery`/`useMutation` hook per operation (e.g. `usePlaces`, `useCreatePlace`, `useUpdateStatus`), each mutation invalidates the `['places']` query key on success. `useIdentity` manages the localStorage name picker, `useGeolocation` wraps browser geolocation.
- `src/App.tsx` is the composition root: holds all UI state (selected place, filters, map bounds/center, search query) and renders two parallel layouts — `.desktop` (list panel + map side-by-side) and `.mobile` (map-first with a drag-up `BottomSheet`) — toggled via CSS, not JS, so both trees mount simultaneously.
- `src/utils/filterPlaces.ts` + `visiblePlaces.ts` — pure filtering functions composed in `App.tsx` to derive what's shown in the list vs. as map markers (map markers currently always show all filtered places; `onScreenOnly`/`mapBounds` narrowing is wired but passed as inert values to `filterPlaces` from `App.tsx`).
- CSS Modules per component (`Component.module.css`), no global utility CSS framework.
- Google Maps via `@vis.gl/react-google-maps`'s `<APIProvider>`, keyed by `VITE_GOOGLE_MAPS_API_KEY`.

## Design conventions

- Theme "Carta Negra": deep navy dark background, amber `#f0b429` accent. Fonts: Fraunces (wordmark), IBM Plex Sans (UI).
- Status colors: `to_go` (A ir) = blue `#4a9eff`, `repeat` (Repetir) = rose `#ff6b9d`, `gone` (Fomos) = slate `#3d4a5c`.
- App display name and default map center are configurable at Docker build time via `VITE_APP_NAME`, `VITE_DEFAULT_CENTER_LAT`, `VITE_DEFAULT_CENTER_LNG` (see `frontend/src/config.ts`); unset values fall back to "Nosso Mapa" / Belo Horizonte.
- Categories are a seeded, extensible DB table (`Restaurante`, `Café`, `Museu`, `Cinema`, `Lanche`); users can add custom ones on the fly when creating a place. A place has 1–N categories via `place_categories`.
- Reviews are 0.5-step ratings, 1.0–5.0; only the average is surfaced in the UI, reviewer identity comes from the localStorage name.
- All user-facing strings are Portuguese, including API error messages returned to the frontend (e.g. `"Lugar já está na lista"`).

## Docs

Feature work follows a spec-then-plan pattern under `docs/superpowers/`: `specs/YYYY-MM-DD-<feature>-design.md` (design rationale) paired with `plans/YYYY-MM-DD-<feature>.md` (implementation plan). Check these before assuming intent behind non-obvious existing behavior.
