# Google Places enrichment — website, opening hours, price level, category helper

## Why

App already pulls `place_id`, `name`, `geometry` from Google Autocomplete when adding a place. Google Places offers much more per place — this adds the fields useful for this app: `website`, `opening_hours`, `price_level` (shown in PlaceDetail), and `types` (used only as a one-time category-chip suggestion helper, not stored).

Existing places in the DB were added before this feature and lack this data — a backend-only backfill script fills the gap.

## Data model

Add 3 nullable columns to `places` (migrated via the existing `ALTER TABLE ... try/except OperationalError` pattern in `backend/app/database.py`):

- `website TEXT`
- `opening_hours TEXT` — JSON-encoded array of 7 weekday strings (Google's `opening_hours.weekday_text`, already localized)
- `price_level INTEGER` — 0–4 (Google's scale: 0 = free, 4 = very expensive)

`PlaceCreate`, `PlaceOut`, `PlaceUpdate` (backend/app/models.py) gain matching optional fields:
- `PlaceCreate.website: Optional[str] = None`
- `PlaceCreate.opening_hours: Optional[list[str]] = None` (JSON-encoded to TEXT on insert)
- `PlaceCreate.price_level: Optional[int] = None`
- `PlaceOut` mirrors these (opening_hours parsed back from TEXT to `list[str] | None` on read)

Frontend `Place` / `PlaceCreate` types (frontend/src/types.ts) get the same three optional fields.

## New-place flow (client-side fetch, no backend Google call)

`AddPlaceModal.tsx`: extend Autocomplete `fields` from `['place_id', 'name', 'geometry']` to `['place_id', 'name', 'geometry', 'website', 'opening_hours', 'price_level', 'types']`.

On `place_changed`:
- `website`, `price_level` copied straight into `SelectedPlace`
- `opening_hours?.weekday_text` copied into `SelectedPlace` as `string[] | undefined`
- these three fields flow through unchanged into the existing `createPlace.mutate` call

`types` is **not** persisted — used only in-memory to auto-check category chips:
- hardcoded map: `restaurant`/`food` → "Restaurante", `cafe` → "Café", `museum` → "Museu", `movie_theater` → "Cinema", `meal_takeaway`/`bakery` → "Lanche"
- on place select, match returned `types` against the map, then match resulting names against the already-loaded `categories` list (from `useCategories`) by name
- matching category ids get added to `selectedCatIds` (auto-checked chips)
- no new category is ever auto-created; user can still toggle any chip manually before save

## Language

`App.tsx`'s `<APIProvider>` gets `language="pt-BR"` added, so `opening_hours.weekday_text` (and other Autocomplete text) comes back in Portuguese, consistent with the rest of the UI. The backfill script requests `language=pt-BR` from the Google Places Details API for the same reason.

## Display — PlaceDetail.tsx

New section rendered only when at least one of the three fields is present on `place` (older un-backfilled places show nothing extra):
- **website** → external link (`target="_blank" rel="noopener noreferrer"`)
- **price_level** → rendered as `$` repeated `price_level` times, or "Grátis" when `price_level === 0`
- **opening_hours** → each weekday string rendered as one list item

## Backfill script (backend-only, no API endpoint)

New file `backend/app/scripts/backfill_google_places.py`, run manually (e.g. `docker compose exec backend python -m app.scripts.backfill_google_places`). Not exposed as an HTTP endpoint — deliberately a manual, operator-run script since it spends Google API quota.

- new env var `GOOGLE_PLACES_API_KEY` — a **separate**, server-side/IP-restricted key from the frontend's referrer-restricted `VITE_GOOGLE_MAPS_API_KEY`
- selects candidate rows: `google_place_id IS NOT NULL AND deleted_at IS NULL AND website IS NULL AND opening_hours IS NULL AND price_level IS NULL`
  - this makes the script safe to re-run any time — already-filled places are skipped, so running it after adding new places (added without google fields, e.g. manually via SQL, or from before this feature shipped) only fills the gaps
- for each candidate, calls the Google Place Details API via `httpx` with `fields=website,opening_hours,price_level&language=pt-BR`, updates the row
- prints a summary at the end: counts of updated / places with no `google_place_id` (skipped entirely, separate from the "already filled" skip) / errors

## Testing

- `AddPlaceModal.test.tsx` — assert new `fields` array passed to Autocomplete constructor; assert chip auto-check behavior for a mocked place with `types: ['restaurant', ...]`
- `PlaceDetail.test.tsx` — assert new section renders/hides correctly based on presence of the three fields; assert price_level → `$` rendering; assert website link attributes
- `test_places.py` — round-trip create/read of the three new fields (including `opening_hours` JSON encode/decode)
- new `backend/tests/test_backfill.py` — mock `httpx` calls, assert candidate selection query, assert already-filled/no-place-id rows are skipped, assert row update on success
