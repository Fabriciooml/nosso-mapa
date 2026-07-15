# Google Places Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show website, opening hours, and price level on PlaceDetail; use Google's place `types` to auto-suggest category chips when adding a place; provide a backend-only script to backfill these fields onto existing places.

**Architecture:** New places fetch these fields client-side through the existing Google Autocomplete widget (no backend Google call on create). Existing places get backfilled by a standalone backend script that calls the Google Place Details API server-side with its own API key. All three fields are nullable columns on `places`, round-tripped through the existing REST API unchanged.

**Tech Stack:** FastAPI + sqlite3 (backend), React + `@vis.gl/react-google-maps` + TanStack Query (frontend), `httpx` for the backfill script, pytest / vitest for tests.

**Spec:** `docs/superpowers/specs/2026-07-15-google-places-enrichment-design.md`

---

## File Structure

- Modify `backend/app/database.py` — add 3 nullable columns via existing migration pattern
- Modify `backend/app/models.py` — add `website` / `opening_hours` / `price_level` to `PlaceCreate` and `PlaceOut`
- Modify `backend/app/routers/places.py` — persist and read back the 3 new fields (create + restore-on-recreate paths)
- Modify `backend/tests/test_places.py` — round-trip tests for the 3 new fields
- Create `backend/app/scripts/__init__.py` — empty, makes `scripts` importable
- Create `backend/app/scripts/backfill_google_places.py` — standalone backfill script
- Create `backend/tests/test_backfill.py` — tests for the backfill script
- Modify `docker-compose.yml` — pass through `GOOGLE_PLACES_API_KEY` to backend
- Modify `.env` — add empty `GOOGLE_PLACES_API_KEY=` line (gitignored, local-only)
- Modify `frontend/src/types.ts` — add 3 optional fields to `Place` and `PlaceCreate`
- Create `frontend/src/utils/suggestCategoryIds.ts` — pure function mapping Google `types` → existing category ids
- Create `frontend/src/utils/suggestCategoryIds.test.ts` — tests for the above
- Modify `frontend/src/components/AddPlaceModal.tsx` — extend Autocomplete fields, wire new fields + category auto-check
- Modify `frontend/src/components/AddPlaceModal.test.tsx` — replace the `useMapsLibrary` mock with one that lets tests trigger `place_changed`
- Modify `frontend/src/App.tsx` — set `language="pt-BR"` on `APIProvider`
- Modify `frontend/src/components/PlaceDetail.tsx` — render website / price level / opening hours
- Modify `frontend/src/components/PlaceDetail.module.css` — styles for the new section
- Modify `frontend/src/components/PlaceDetail.test.tsx` — tests for the new section

---

### Task 1: Backend — store and return website, opening_hours, price_level

**Files:**
- Modify: `backend/app/database.py:52-62`
- Modify: `backend/app/models.py:14-19,51-63`
- Modify: `backend/app/routers/places.py`
- Test: `backend/tests/test_places.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_places.py` (near the other create-place tests, after `test_create_place_with_categories`):

```python
def test_create_place_with_google_fields(client):
    payload = {
        **PLACE_PAYLOAD,
        "website": "https://example.com",
        "opening_hours": ["segunda-feira: 09:00–18:00", "terça-feira: 09:00–18:00"],
        "price_level": 2,
    }
    body = client.post("/api/places", json=payload).json()
    assert body["website"] == "https://example.com"
    assert body["opening_hours"] == ["segunda-feira: 09:00–18:00", "terça-feira: 09:00–18:00"]
    assert body["price_level"] == 2


def test_create_place_google_fields_default_null(client):
    body = client.post("/api/places", json=PLACE_PAYLOAD).json()
    assert body["website"] is None
    assert body["opening_hours"] is None
    assert body["price_level"] is None
```

Add near the deduplication/restore tests, after `test_create_restore_updates_name_and_coords`:

```python
def test_create_restore_updates_google_fields(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    new_payload = {
        **PLACE_PAYLOAD,
        "website": "https://restored.example.com",
        "opening_hours": ["segunda-feira: 09:00–18:00"],
        "price_level": 3,
    }
    response = client.post("/api/places", json=new_payload)
    assert response.status_code == 200
    body = response.json()
    assert body["website"] == "https://restored.example.com"
    assert body["opening_hours"] == ["segunda-feira: 09:00–18:00"]
    assert body["price_level"] == 3
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_places.py -k "google_fields" -v`
Expected: FAIL — `KeyError: 'website'` (field not present in response body)

- [ ] **Step 3: Add the 3 columns to the schema**

In `backend/app/database.py`, extend the migration list (currently lines 52-61):

```python
    # Migrate existing DBs — silently skip if columns already exist
    for ddl in [
        "ALTER TABLE places ADD COLUMN alias TEXT",
        "ALTER TABLE places ADD COLUMN description TEXT",
        "ALTER TABLE places ADD COLUMN deleted_at DATETIME",
        "ALTER TABLE places ADD COLUMN website TEXT",
        "ALTER TABLE places ADD COLUMN opening_hours TEXT",
        "ALTER TABLE places ADD COLUMN price_level INTEGER",
    ]:
```

- [ ] **Step 4: Add the fields to the pydantic models**

In `backend/app/models.py`, update `PlaceCreate`:

```python
class PlaceCreate(BaseModel):
    name: str
    google_place_id: Optional[str] = None
    lat: float
    lng: float
    category_ids: list[int]
    website: Optional[str] = None
    opening_hours: Optional[list[str]] = None
    price_level: Optional[int] = None
```

And `PlaceOut`:

```python
class PlaceOut(BaseModel):
    id: int
    name: str
    google_place_id: Optional[str]
    lat: float
    lng: float
    status: str
    avg_rating: Optional[float]
    alias: Optional[str]
    description: Optional[str]
    categories: list[CategoryOut]
    created_at: str
    website: Optional[str]
    opening_hours: Optional[list[str]]
    price_level: Optional[int]
```

- [ ] **Step 5: Wire the fields through the router**

In `backend/app/routers/places.py`, add `import json` at the top of the file.

Update `_fetch_place` to select and decode the new columns:

```python
def _fetch_place(conn, place_id: int) -> dict:
    row = conn.execute(
        """SELECT p.id, p.name, p.google_place_id, p.lat, p.lng,
                  p.status, p.created_at, p.alias, p.description,
                  p.website, p.opening_hours, p.price_level,
                  AVG(r.rating) AS avg_rating
           FROM places p
           LEFT JOIN reviews r ON r.place_id = p.id
           WHERE p.id = ? AND p.deleted_at IS NULL
           GROUP BY p.id""",
        (place_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "Place not found")
    cats = conn.execute(
        """SELECT c.id, c.name FROM categories c
           JOIN place_categories pc ON pc.category_id = c.id
           WHERE pc.place_id = ?""",
        (place_id,),
    ).fetchall()
    data = {**dict(row), "categories": [dict(c) for c in cats]}
    data["opening_hours"] = json.loads(data["opening_hours"]) if data["opening_hours"] else None
    return data
```

Update the insert in `create_place` (the non-restore branch):

```python
        cur = conn.execute(
            """INSERT INTO places (name, google_place_id, lat, lng, website, opening_hours, price_level)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                body.name,
                body.google_place_id,
                body.lat,
                body.lng,
                body.website,
                json.dumps(body.opening_hours) if body.opening_hours is not None else None,
                body.price_level,
            ),
        )
```

Update the restore branch (soft-deleted place found by `google_place_id`) to refresh the same fields, since fresh data is available from the same Autocomplete call:

```python
            if deleted:
                place_id = deleted["id"]
                conn.execute(
                    """UPDATE places SET deleted_at = NULL, name = ?, lat = ?, lng = ?,
                       website = ?, opening_hours = ?, price_level = ? WHERE id = ?""",
                    (
                        body.name,
                        body.lat,
                        body.lng,
                        body.website,
                        json.dumps(body.opening_hours) if body.opening_hours is not None else None,
                        body.price_level,
                        place_id,
                    ),
                )
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_places.py -v`
Expected: PASS (all tests, including the 3 new ones)

- [ ] **Step 7: Commit**

```bash
git add backend/app/database.py backend/app/models.py backend/app/routers/places.py backend/tests/test_places.py
git commit -m "feat(backend): store website, opening_hours, price_level on places"
```

---

### Task 2: Frontend — add new fields to Place types

**Files:**
- Modify: `frontend/src/types.ts:8-28`

- [ ] **Step 1: Update the types**

In `frontend/src/types.ts`, update `Place` and `PlaceCreate`. Fields are optional (`?`) to avoid touching the ~11 existing test files that construct `Place` literals without them:

```typescript
export interface Place {
  id: number
  name: string
  google_place_id: string | null
  lat: number
  lng: number
  status: PlaceStatus
  avg_rating: number | null
  alias: string | null
  description: string | null
  categories: Category[]
  created_at: string
  website?: string | null
  opening_hours?: string[] | null
  price_level?: number | null
}

export interface PlaceCreate {
  name: string
  google_place_id: string | null
  lat: number
  lng: number
  category_ids: number[]
  website?: string | null
  opening_hours?: string[] | null
  price_level?: number | null
}
```

- [ ] **Step 2: Run the frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (fields are optional, existing literals still satisfy the interface)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat(frontend): add website, opening_hours, price_level to Place types"
```

---

### Task 3: Frontend — pure function to suggest categories from Google types

**Files:**
- Create: `frontend/src/utils/suggestCategoryIds.ts`
- Test: `frontend/src/utils/suggestCategoryIds.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/suggestCategoryIds.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { suggestCategoryIds } from './suggestCategoryIds'

const CATEGORIES = [
  { id: 1, name: 'Café' },
  { id: 2, name: 'Museu' },
  { id: 3, name: 'Restaurante' },
]

describe('suggestCategoryIds', () => {
  it('matches restaurant type to Restaurante category', () => {
    expect(suggestCategoryIds(['restaurant', 'point_of_interest'], CATEGORIES)).toEqual([3])
  })

  it('matches cafe type to Café category', () => {
    expect(suggestCategoryIds(['cafe'], CATEGORIES)).toEqual([1])
  })

  it('returns empty array when types is undefined', () => {
    expect(suggestCategoryIds(undefined, CATEGORIES)).toEqual([])
  })

  it('returns empty array when no types match', () => {
    expect(suggestCategoryIds(['point_of_interest', 'establishment'], CATEGORIES)).toEqual([])
  })

  it('ignores a matched type when its category does not exist in the list', () => {
    expect(suggestCategoryIds(['movie_theater'], CATEGORIES)).toEqual([])
  })

  it('dedupes when multiple types map to the same category', () => {
    const cats = [...CATEGORIES, { id: 4, name: 'Lanche' }]
    expect(suggestCategoryIds(['meal_takeaway', 'bakery'], cats)).toEqual([4])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/utils/suggestCategoryIds.test.ts`
Expected: FAIL — cannot find module `./suggestCategoryIds`

- [ ] **Step 3: Write the implementation**

Create `frontend/src/utils/suggestCategoryIds.ts`:

```typescript
import type { Category } from '../types'

const GOOGLE_TYPE_TO_CATEGORY_NAME: Record<string, string> = {
  restaurant: 'Restaurante',
  food: 'Restaurante',
  cafe: 'Café',
  museum: 'Museu',
  movie_theater: 'Cinema',
  meal_takeaway: 'Lanche',
  bakery: 'Lanche',
}

export function suggestCategoryIds(
  types: string[] | undefined,
  categories: Category[],
): number[] {
  if (!types) return []
  const suggestedNames = new Set(
    types.map((t) => GOOGLE_TYPE_TO_CATEGORY_NAME[t]).filter((n): n is string => !!n),
  )
  return categories.filter((c) => suggestedNames.has(c.name)).map((c) => c.id)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/utils/suggestCategoryIds.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/suggestCategoryIds.ts frontend/src/utils/suggestCategoryIds.test.ts
git commit -m "feat(frontend): add suggestCategoryIds helper for Google types"
```

---

### Task 4: Frontend — wire new fields + category suggestion into AddPlaceModal

**Files:**
- Modify: `frontend/src/components/AddPlaceModal.tsx`
- Modify: `frontend/src/components/AddPlaceModal.test.tsx`

- [ ] **Step 1: Replace the test file's Autocomplete mock and write the failing tests**

Replace the top of `frontend/src/components/AddPlaceModal.test.tsx` (imports through the `useCategories` mock, currently lines 1-26) with:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { AddPlaceModal } from './AddPlaceModal'

const { MockAutocomplete, getLastInstance } = vi.hoisted(() => {
  let lastInstance: MockAutocompleteType | undefined

  class MockAutocompleteType {
    fields: string[]
    place: Record<string, unknown> = {}
    private listeners: Record<string, () => void> = {}

    constructor(_el: HTMLInputElement, opts: { fields: string[] }) {
      this.fields = opts.fields
      lastInstance = this
    }

    addListener(event: string, cb: () => void) {
      this.listeners[event] = cb
    }

    getPlace() {
      return this.place
    }

    trigger(event: string) {
      this.listeners[event]?.()
    }
  }

  return {
    MockAutocomplete: MockAutocompleteType,
    getLastInstance: () => lastInstance,
  }
})

vi.mock('@vis.gl/react-google-maps', () => ({
  useMapsLibrary: () => ({ Autocomplete: MockAutocomplete }),
}))

const createPlaceMock = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
}

vi.mock('../hooks/usePlaces', () => ({
  useCreatePlace: () => createPlaceMock,
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: [{ id: 1, name: 'Café' }, { id: 2, name: 'Museu' }] }),
  useCreateCategory: () => ({ mutate: vi.fn() }),
}))
```

(The rest of the file — `wrapper`, `beforeEach`, and the existing `describe('AddPlaceModal', ...)` block — stays as-is.)

Add these tests inside the existing `describe('AddPlaceModal', ...)` block:

```typescript
  it('requests extended place fields from Autocomplete', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(getLastInstance()?.fields).toEqual([
      'place_id', 'name', 'geometry', 'website', 'opening_hours', 'price_level', 'types',
    ])
  })

  it('auto-checks matching category chip when a place is selected', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    const instance = getLastInstance()!
    instance.place = {
      place_id: 'abc',
      name: 'Café Central',
      geometry: { location: { lat: () => 1, lng: () => 2 } },
      website: 'https://cafecentral.pt',
      opening_hours: { weekday_text: ['segunda: 09:00–18:00'] },
      price_level: 1,
      types: ['cafe'],
    }
    instance.trigger('place_changed')
    const chip = screen.getByText('Café').closest('button')!
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('includes website, opening_hours, price_level in the save payload', async () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    const instance = getLastInstance()!
    instance.place = {
      place_id: 'abc',
      name: 'Café Central',
      geometry: { location: { lat: () => 1, lng: () => 2 } },
      website: 'https://cafecentral.pt',
      opening_hours: { weekday_text: ['segunda: 09:00–18:00'] },
      price_level: 1,
      types: ['cafe'],
    }
    instance.trigger('place_changed')
    await userEvent.click(screen.getByText('Salvar'))
    expect(createPlaceMock.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        website: 'https://cafecentral.pt',
        opening_hours: ['segunda: 09:00–18:00'],
        price_level: 1,
      }),
      expect.any(Object),
    )
  })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd frontend && npx vitest run src/components/AddPlaceModal.test.tsx`
Expected: the 3 new tests FAIL (fields array doesn't match / chip not auto-checked / payload missing fields); existing tests still PASS

- [ ] **Step 3: Update SelectedPlace and the Autocomplete wiring**

In `frontend/src/components/AddPlaceModal.tsx`, add the import:

```typescript
import { suggestCategoryIds } from '../utils/suggestCategoryIds'
```

Update the `SelectedPlace` interface (currently lines 8-13):

```typescript
interface SelectedPlace {
  name: string
  google_place_id: string | null
  lat: number
  lng: number
  website: string | null
  opening_hours: string[] | null
  price_level: number | null
}
```

Replace the `useEffect` block (currently lines 35-50):

```typescript
  useEffect(() => {
    if (!placesLib || !inputRef.current) return
    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['place_id', 'name', 'geometry', 'website', 'opening_hours', 'price_level', 'types'],
    })
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry?.location) return
      setSelectedPlace({
        name: place.name ?? '',
        google_place_id: place.place_id ?? null,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        website: place.website ?? null,
        opening_hours: place.opening_hours?.weekday_text ?? null,
        price_level: place.price_level ?? null,
      })
      const suggested = suggestCategoryIds(place.types, categories)
      if (suggested.length > 0) {
        setSelectedCatIds((prev) => [...prev, ...suggested.filter((id) => !prev.includes(id))])
      }
    })
  }, [placesLib, categories])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/AddPlaceModal.test.tsx`
Expected: PASS (all tests, old and new)

- [ ] **Step 5: Run the frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AddPlaceModal.tsx frontend/src/components/AddPlaceModal.test.tsx
git commit -m "feat(frontend): fetch website/hours/price_level and suggest categories on place add"
```

---

### Task 5: Frontend — set Portuguese language on the Maps provider

**Files:**
- Modify: `frontend/src/App.tsx:63-66`

- [ ] **Step 1: Add the language prop**

In `frontend/src/App.tsx`, find the `<APIProvider apiKey={apiKey}>` (line 66) and add `language="pt-BR"`:

```tsx
    <APIProvider apiKey={apiKey} language="pt-BR">
```

No dedicated test: `App.test.tsx` mocks `APIProvider` as a passthrough that ignores props (same as the existing untested `apiKey` prop), so there's no test harness to assert against here without adding one purely for this line — consistent with existing coverage of this component.

- [ ] **Step 2: Run the frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): request pt-BR from Google Maps API"
```

---

### Task 6: Frontend — display website, opening_hours, price_level in PlaceDetail

**Files:**
- Modify: `frontend/src/components/PlaceDetail.tsx`
- Modify: `frontend/src/components/PlaceDetail.module.css`
- Modify: `frontend/src/components/PlaceDetail.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/components/PlaceDetail.test.tsx`, inside the `describe('PlaceDetail', ...)` block:

```typescript
  it('does not render google info section when fields are absent', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByTestId('google-info')).not.toBeInTheDocument()
  })

  it('renders website link when set', () => {
    const place = { ...PLACE, website: 'https://example.com' }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    const link = screen.getByText('🔗 Website')
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders price level as $ symbols', () => {
    const place = { ...PLACE, price_level: 3 }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('$$$')).toBeInTheDocument()
  })

  it('renders Grátis when price_level is 0', () => {
    const place = { ...PLACE, price_level: 0 }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Grátis')).toBeInTheDocument()
  })

  it('renders opening hours as a list', () => {
    const place = {
      ...PLACE,
      opening_hours: ['segunda: 09:00–18:00', 'terça: 09:00–18:00'],
    }
    render(<PlaceDetail place={place} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('segunda: 09:00–18:00')).toBeInTheDocument()
    expect(screen.getByText('terça: 09:00–18:00')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/PlaceDetail.test.tsx`
Expected: the 5 new tests FAIL (`google-info` testid / website link / price symbols / hours text not found)

- [ ] **Step 3: Add the display section**

In `frontend/src/components/PlaceDetail.tsx`, add right after the `description` block (currently lines 63-67):

```tsx
      {(place.website || (place.opening_hours && place.opening_hours.length > 0) || place.price_level != null) && (
        <div className={styles.googleInfo} data-testid="google-info">
          {place.website && (
            <a
              className={styles.websiteLink}
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              🔗 Website
            </a>
          )}
          {place.price_level != null && (
            <span className={styles.priceLevel}>
              {place.price_level === 0 ? 'Grátis' : '$'.repeat(place.price_level)}
            </span>
          )}
          {place.opening_hours && place.opening_hours.length > 0 && (
            <ul className={styles.hoursList}>
              {place.opening_hours.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
```

- [ ] **Step 4: Add the CSS**

Append to `frontend/src/components/PlaceDetail.module.css`:

```css
.googleInfo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.websiteLink {
  color: var(--amber);
  align-self: flex-start;
}

.priceLevel {
  color: var(--text-muted);
}

.hoursList {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/PlaceDetail.test.tsx`
Expected: PASS (all tests, old and new)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PlaceDetail.tsx frontend/src/components/PlaceDetail.module.css frontend/src/components/PlaceDetail.test.tsx
git commit -m "feat(frontend): show website, price level, and opening hours in PlaceDetail"
```

---

### Task 7: Backend — Google Places backfill script

**Files:**
- Create: `backend/app/scripts/__init__.py`
- Create: `backend/app/scripts/backfill_google_places.py`
- Test: `backend/tests/test_backfill.py`
- Modify: `docker-compose.yml`
- Modify: `.env`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_backfill.py`:

```python
from unittest.mock import MagicMock, patch

import pytest

from app.scripts import backfill_google_places


def _make_place(client, name="Place", google_place_id="abc123", extra=None):
    payload = {
        "name": name,
        "google_place_id": google_place_id,
        "lat": 1.0,
        "lng": 2.0,
        "category_ids": [],
        **(extra or {}),
    }
    return client.post("/api/places", json=payload).json()["id"]


def _mock_response(status="OK", result=None):
    mock = MagicMock()
    mock.raise_for_status = MagicMock()
    mock.json.return_value = {"status": status, "result": result or {}}
    return mock


def test_backfill_updates_place_missing_google_fields(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    place_id = _make_place(client)

    with patch(
        "app.scripts.backfill_google_places.httpx.get",
        return_value=_mock_response(
            result={
                "website": "https://example.com",
                "opening_hours": {"weekday_text": ["segunda: 09:00–18:00"]},
                "price_level": 2,
            }
        ),
    ) as mock_get:
        backfill_google_places.run()

    mock_get.assert_called_once()
    body = client.get("/api/places").json()[0]
    assert body["id"] == place_id
    assert body["website"] == "https://example.com"
    assert body["opening_hours"] == ["segunda: 09:00–18:00"]
    assert body["price_level"] == 2


def test_backfill_skips_place_with_no_google_place_id(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    _make_place(client, name="No Google Id", google_place_id=None)

    with patch("app.scripts.backfill_google_places.httpx.get") as mock_get:
        backfill_google_places.run()

    mock_get.assert_not_called()


def test_backfill_skips_already_filled_place(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    _make_place(
        client,
        name="Already Filled",
        google_place_id="already-filled-id",
        extra={
            "website": "https://already.com",
            "opening_hours": ["segunda: 09:00–18:00"],
            "price_level": 1,
        },
    )

    with patch("app.scripts.backfill_google_places.httpx.get") as mock_get:
        backfill_google_places.run()

    mock_get.assert_not_called()


def test_backfill_continues_after_a_google_error(client, monkeypatch, capsys):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    _make_place(client, name="Broken", google_place_id="broken-id")

    with patch(
        "app.scripts.backfill_google_places.httpx.get",
        return_value=_mock_response(status="NOT_FOUND"),
    ):
        backfill_google_places.run()

    out = capsys.readouterr().out
    assert "Errors: 1" in out


def test_backfill_exits_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    with pytest.raises(SystemExit):
        backfill_google_places.run()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_backfill.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.scripts'`

- [ ] **Step 3: Write the script**

Create `backend/app/scripts/__init__.py` (empty file).

Create `backend/app/scripts/backfill_google_places.py`:

```python
import json
import os
import sys

import httpx

from ..database import get_db

GOOGLE_PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def fetch_place_details(place_id: str, api_key: str) -> dict:
    response = httpx.get(
        GOOGLE_PLACES_DETAILS_URL,
        params={
            "place_id": place_id,
            "fields": "website,opening_hours,price_level",
            "language": "pt-BR",
            "key": api_key,
        },
        timeout=10.0,
    )
    response.raise_for_status()
    body = response.json()
    if body.get("status") != "OK":
        raise RuntimeError(f"Google API status {body.get('status')}")
    return body["result"]


def run() -> None:
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        print("GOOGLE_PLACES_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT id, google_place_id FROM places
               WHERE deleted_at IS NULL
                 AND google_place_id IS NOT NULL
                 AND website IS NULL
                 AND opening_hours IS NULL
                 AND price_level IS NULL"""
        ).fetchall()

        updated = 0
        errors = 0
        for row in rows:
            try:
                result = fetch_place_details(row["google_place_id"], api_key)
            except Exception as exc:
                print(f"place {row['id']}: error fetching from Google: {exc}", file=sys.stderr)
                errors += 1
                continue

            opening_hours = result.get("opening_hours", {}).get("weekday_text")
            conn.execute(
                "UPDATE places SET website = ?, opening_hours = ?, price_level = ? WHERE id = ?",
                (
                    result.get("website"),
                    json.dumps(opening_hours) if opening_hours else None,
                    result.get("price_level"),
                    row["id"],
                ),
            )
            updated += 1

        conn.commit()

        no_place_id = conn.execute(
            """SELECT COUNT(*) AS n FROM places
               WHERE deleted_at IS NULL AND google_place_id IS NULL"""
        ).fetchone()["n"]

        print(f"Updated: {updated}")
        print(f"Errors: {errors}")
        print(f"Skipped (no google_place_id): {no_place_id}")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_backfill.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full backend test suite**

Run: `cd backend && python -m pytest -v`
Expected: PASS (all tests, including Task 1's)

- [ ] **Step 6: Wire the env var through docker-compose and .env**

In `docker-compose.yml`, add to the `backend` service's `environment` list (currently line 20):

```yaml
    environment:
      - DB_PATH=/app/data/nosso_mapa.db
      - GOOGLE_PLACES_API_KEY=${GOOGLE_PLACES_API_KEY:-}
```

In `.env` (gitignored, local-only — do not commit), add a new line:

```
GOOGLE_PLACES_API_KEY=
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/scripts/__init__.py backend/app/scripts/backfill_google_places.py backend/tests/test_backfill.py docker-compose.yml
git commit -m "feat(backend): add Google Places backfill script"
```

Note: `.env` is gitignored and won't be included in the commit — that's expected, fill in the real key there locally before running the script.

---

## Manual verification (after all tasks)

- [ ] Run full test suites: `cd backend && python -m pytest -v` and `cd frontend && npx vitest run`
- [ ] Run `cd frontend && npx tsc --noEmit`
- [ ] Start the app locally, add a new place via search, confirm chips auto-check and PlaceDetail shows website/hours/price level
- [ ] Set a real `GOOGLE_PLACES_API_KEY` locally, run `docker compose exec backend python -m app.scripts.backfill_google_places` against a place created before this feature, confirm PlaceDetail now shows its data
