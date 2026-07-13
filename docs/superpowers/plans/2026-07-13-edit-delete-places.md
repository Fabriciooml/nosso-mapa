# Edit/Delete Places + Alias + Description Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add edit/delete for places, plus `alias` (optional display name) and `description` (markdown) fields, with soft-delete and `google_place_id`-based deduplication on add.

**Architecture:** Backend adds three nullable columns to `places` (alias, description, deleted_at), two new endpoints (PUT/DELETE), and dedup logic on POST. Frontend adds `EditPlaceModal`, hooks, and updates `PlaceDetail` and `AddPlaceModal`.

**Tech Stack:** FastAPI + SQLite (backend), React + Vitest + react-markdown + remark-gfm (frontend).

---

## File Map

**Create:**
- `frontend/src/components/EditPlaceModal.tsx`
- `frontend/src/components/EditPlaceModal.module.css`
- `frontend/src/components/EditPlaceModal.test.tsx`

**Modify:**
- `backend/app/database.py` — add 3 columns + migration
- `backend/app/models.py` — update `PlaceOut`, add `PlaceUpdate`
- `backend/app/routers/places.py` — update `_fetch_place`, `list_places`, `create_place`; add PUT + DELETE endpoints
- `backend/tests/test_places.py` — new tests for all new behavior
- `frontend/src/types.ts` — add `alias`, `description` to `Place`; add `PlaceUpdate`
- `frontend/src/api.ts` — fix `request` for 204, add `update`/`delete`
- `frontend/src/api.test.ts` — add tests for new methods; update Place fixtures
- `frontend/src/hooks/usePlaces.ts` — add `useUpdatePlace`, `useDeletePlace`
- `frontend/src/components/PlaceDetail.tsx` — alias display, description, edit/delete buttons
- `frontend/src/components/PlaceDetail.module.css` — add description, actionRow, editBtn, deleteBtn styles
- `frontend/src/components/PlaceDetail.test.tsx` — update PLACE fixture, add alias/description/buttons tests
- `frontend/src/components/AddPlaceModal.tsx` — 409 error display
- `frontend/src/components/AddPlaceModal.module.css` — add `.error` style
- `frontend/src/components/AddPlaceModal.test.tsx` — restructure mock, add 409 test

---

## Task 1: DB schema migration

**Files:**
- Modify: `backend/app/database.py`

- [ ] **Step 1: Update `database.py` — add columns to CREATE TABLE and migration ALTERs**

Replace the `places` table DDL and add migration block after `executescript`:

```python
import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", "/app/data/nosso_mapa.db")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS categories (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS places (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            google_place_id TEXT,
            lat             REAL NOT NULL,
            lng             REAL NOT NULL,
            status          TEXT NOT NULL DEFAULT 'to_go',
            alias           TEXT,
            description     TEXT,
            deleted_at      DATETIME,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS place_categories (
            place_id    INTEGER NOT NULL REFERENCES places(id),
            category_id INTEGER NOT NULL REFERENCES categories(id),
            PRIMARY KEY (place_id, category_id)
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            place_id   INTEGER NOT NULL REFERENCES places(id),
            reviewer   TEXT NOT NULL,
            rating     REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        INSERT OR IGNORE INTO categories (name) VALUES
            ('Restaurante'), ('Café'), ('Museu'), ('Cinema'), ('Lanche');
    """)
    # Migrate existing DBs — silently skip if columns already exist
    for ddl in [
        "ALTER TABLE places ADD COLUMN alias TEXT",
        "ALTER TABLE places ADD COLUMN description TEXT",
        "ALTER TABLE places ADD COLUMN deleted_at DATETIME",
    ]:
        try:
            conn.execute(ddl)
        except Exception:
            pass
    conn.commit()
    conn.close()
```

- [ ] **Step 2: Verify existing backend tests still pass**

```bash
cd backend && pytest tests/ -v
```

Expected: all existing tests PASS (schema change is additive).

- [ ] **Step 3: Commit**

```bash
git add backend/app/database.py
git commit -m "feat(db): add alias, description, deleted_at columns to places"
```

---

## Task 2: Backend models + _fetch_place + list filter

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/routers/places.py`
- Test: `backend/tests/test_places.py`

- [ ] **Step 1: Write failing tests — add to `backend/tests/test_places.py`**

Append after the existing tests:

```python
# --- alias and description fields ---

def test_place_response_has_alias_null(client):
    body = client.post("/api/places", json=PLACE_PAYLOAD).json()
    assert "alias" in body
    assert body["alias"] is None


def test_place_response_has_description_null(client):
    body = client.post("/api/places", json=PLACE_PAYLOAD).json()
    assert "description" in body
    assert body["description"] is None
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd backend && pytest tests/test_places.py::test_place_response_has_alias_null tests/test_places.py::test_place_response_has_description_null -v
```

Expected: both FAIL — `alias` and `description` not in response (PlaceOut doesn't have them yet, endpoint returns 500 or missing keys).

- [ ] **Step 3: Update `backend/app/models.py` — add fields to PlaceOut, add PlaceUpdate**

```python
from pydantic import BaseModel, field_validator
from typing import Optional


class CategoryOut(BaseModel):
    id: int
    name: str


class CategoryCreate(BaseModel):
    name: str


class PlaceCreate(BaseModel):
    name: str
    google_place_id: Optional[str] = None
    lat: float
    lng: float
    category_ids: list[int]


class PlaceStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("to_go", "gone", "repeat"):
            raise ValueError("status must be to_go, gone, or repeat")
        return v


class PlaceUpdate(BaseModel):
    alias: Optional[str] = None
    description: Optional[str] = None
    category_ids: list[int]


class ReviewCreate(BaseModel):
    reviewer: str
    rating: float

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: float) -> float:
        if not (1.0 <= v <= 5.0) or round(v % 0.5, 10) != 0:
            raise ValueError("rating must be 1.0–5.0 in 0.5 steps")
        return v


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
```

- [ ] **Step 4: Update `_fetch_place` in `backend/app/routers/places.py` — add alias/description to SELECT, filter deleted**

Replace the `_fetch_place` function:

```python
def _fetch_place(conn, place_id: int) -> dict:
    row = conn.execute(
        """SELECT p.id, p.name, p.google_place_id, p.lat, p.lng,
                  p.status, p.created_at, p.alias, p.description,
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
    return {**dict(row), "categories": [dict(c) for c in cats]}
```

- [ ] **Step 5: Update `list_places` query to filter soft-deleted**

Replace the query inside `list_places`:

```python
@router.get("", response_model=list[PlaceOut])
def list_places():
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT p.id FROM places p
               WHERE p.deleted_at IS NULL
               ORDER BY p.created_at DESC"""
        ).fetchall()
        return [_fetch_place(conn, r["id"]) for r in rows]
    finally:
        conn.close()
```

- [ ] **Step 6: Run all backend tests — verify they PASS**

```bash
cd backend && pytest tests/ -v
```

Expected: all tests PASS including the two new alias/description tests.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models.py backend/app/routers/places.py backend/tests/test_places.py
git commit -m "feat(backend): add alias/description to PlaceOut, filter deleted from list"
```

---

## Task 3: Backend DELETE /api/places/{id}

**Files:**
- Modify: `backend/app/routers/places.py`
- Test: `backend/tests/test_places.py`

- [ ] **Step 1: Write failing tests — append to `backend/tests/test_places.py`**

```python
# --- soft delete ---

def test_delete_place_returns_204(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.delete(f"/api/places/{place_id}")
    assert response.status_code == 204


def test_delete_nonexistent_place_returns_404(client):
    response = client.delete("/api/places/9999")
    assert response.status_code == 404


def test_delete_already_deleted_place_returns_404(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    response = client.delete(f"/api/places/{place_id}")
    assert response.status_code == 404


def test_deleted_place_excluded_from_list(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    places = client.get("/api/places").json()
    assert places == []


def test_deleted_place_status_update_returns_404(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    response = client.patch(f"/api/places/{place_id}/status", json={"status": "gone"})
    assert response.status_code == 404
```

- [ ] **Step 2: Run — verify all 5 FAIL**

```bash
cd backend && pytest tests/test_places.py::test_delete_place_returns_204 tests/test_places.py::test_delete_nonexistent_place_returns_404 tests/test_places.py::test_delete_already_deleted_place_returns_404 tests/test_places.py::test_deleted_place_excluded_from_list tests/test_places.py::test_deleted_place_status_update_returns_404 -v
```

Expected: all FAIL with 405 Method Not Allowed (endpoint doesn't exist).

- [ ] **Step 3: Add DELETE endpoint to `backend/app/routers/places.py`**

Add after the `update_status` endpoint:

```python
@router.delete("/{place_id}", status_code=204)
def delete_place(place_id: int):
    conn = get_db()
    try:
        _fetch_place(conn, place_id)  # raises 404 if not found or already deleted
        conn.execute(
            "UPDATE places SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
            (place_id,),
        )
        conn.commit()
    finally:
        conn.close()
```

- [ ] **Step 4: Run — verify all 5 PASS**

```bash
cd backend && pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/places.py backend/tests/test_places.py
git commit -m "feat(backend): soft-delete endpoint DELETE /api/places/{id}"
```

---

## Task 4: Backend PUT /api/places/{id}

**Files:**
- Modify: `backend/app/routers/places.py`
- Test: `backend/tests/test_places.py`

- [ ] **Step 1: Write failing tests — append to `backend/tests/test_places.py`**

```python
# --- edit place ---

def test_update_place_alias(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.put(f"/api/places/{place_id}", json={
        "alias": "Itália Meu Amor", "description": None, "category_ids": []
    })
    assert response.status_code == 200
    assert response.json()["alias"] == "Itália Meu Amor"


def test_update_place_description(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.put(f"/api/places/{place_id}", json={
        "alias": None, "description": "# Bom lugar\nÓtima comida.", "category_ids": []
    })
    assert response.status_code == 200
    assert response.json()["description"] == "# Bom lugar\nÓtima comida."


def test_update_place_replaces_categories(client):
    cat_id = _cat_id(client, "Café")
    place_id = client.post("/api/places", json={**PLACE_PAYLOAD, "category_ids": [cat_id]}).json()["id"]
    cat2_id = _cat_id(client, "Museu")
    response = client.put(f"/api/places/{place_id}", json={
        "alias": None, "description": None, "category_ids": [cat2_id]
    })
    assert response.status_code == 200
    names = [c["name"] for c in response.json()["categories"]]
    assert names == ["Museu"]


def test_update_place_clears_categories(client):
    cat_id = _cat_id(client, "Café")
    place_id = client.post("/api/places", json={**PLACE_PAYLOAD, "category_ids": [cat_id]}).json()["id"]
    response = client.put(f"/api/places/{place_id}", json={
        "alias": None, "description": None, "category_ids": []
    })
    assert response.status_code == 200
    assert response.json()["categories"] == []


def test_update_deleted_place_returns_404(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    response = client.put(f"/api/places/{place_id}", json={
        "alias": "test", "description": None, "category_ids": []
    })
    assert response.status_code == 404


def test_update_nonexistent_place_returns_404(client):
    response = client.put("/api/places/9999", json={
        "alias": "test", "description": None, "category_ids": []
    })
    assert response.status_code == 404
```

- [ ] **Step 2: Run — verify all 6 FAIL**

```bash
cd backend && pytest tests/test_places.py::test_update_place_alias tests/test_places.py::test_update_place_description tests/test_places.py::test_update_place_replaces_categories tests/test_places.py::test_update_place_clears_categories tests/test_places.py::test_update_deleted_place_returns_404 tests/test_places.py::test_update_nonexistent_place_returns_404 -v
```

Expected: all FAIL with 405.

- [ ] **Step 3: Add PUT endpoint + import PlaceUpdate in `backend/app/routers/places.py`**

Update the import line at the top:

```python
from ..models import PlaceCreate, PlaceOut, PlaceStatusUpdate, PlaceUpdate, ReviewCreate
```

Add after the `delete_place` endpoint:

```python
@router.put("/{place_id}", response_model=PlaceOut)
def update_place(place_id: int, body: PlaceUpdate):
    conn = get_db()
    try:
        _fetch_place(conn, place_id)  # raises 404 if not found or deleted
        conn.execute(
            "UPDATE places SET alias = ?, description = ? WHERE id = ?",
            (body.alias, body.description, place_id),
        )
        conn.execute(
            "DELETE FROM place_categories WHERE place_id = ?",
            (place_id,),
        )
        for cat_id in body.category_ids:
            conn.execute(
                "INSERT INTO place_categories (place_id, category_id) VALUES (?, ?)",
                (place_id, cat_id),
            )
        conn.commit()
        return _fetch_place(conn, place_id)
    finally:
        conn.close()
```

- [ ] **Step 4: Run — verify all tests PASS**

```bash
cd backend && pytest tests/ -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/places.py backend/app/models.py backend/tests/test_places.py
git commit -m "feat(backend): edit endpoint PUT /api/places/{id} with alias, description, categories"
```

---

## Task 5: Backend POST /api/places deduplication

**Files:**
- Modify: `backend/app/routers/places.py`
- Test: `backend/tests/test_places.py`

- [ ] **Step 1: Write failing tests — append to `backend/tests/test_places.py`**

```python
# --- deduplication on create ---

def test_create_duplicate_active_returns_409(client):
    client.post("/api/places", json=PLACE_PAYLOAD)
    response = client.post("/api/places", json=PLACE_PAYLOAD)
    assert response.status_code == 409


def test_create_restores_soft_deleted_place(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    response = client.post("/api/places", json=PLACE_PAYLOAD)
    assert response.status_code == 200
    assert response.json()["id"] == place_id


def test_create_restore_updates_name_and_coords(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    new_payload = {**PLACE_PAYLOAD, "name": "Restaurante Novo Nome", "lat": 38.72, "lng": -9.14}
    response = client.post("/api/places", json=new_payload)
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Restaurante Novo Nome"
    assert body["lat"] == 38.72


def test_create_restore_appears_in_list(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.delete(f"/api/places/{place_id}")
    client.post("/api/places", json=PLACE_PAYLOAD)
    places = client.get("/api/places").json()
    assert len(places) == 1


def test_create_no_google_place_id_no_dedup(client):
    payload = {**PLACE_PAYLOAD, "google_place_id": None}
    client.post("/api/places", json=payload)
    response = client.post("/api/places", json=payload)
    assert response.status_code == 201
```

- [ ] **Step 2: Run — verify all 5 FAIL**

```bash
cd backend && pytest tests/test_places.py::test_create_duplicate_active_returns_409 tests/test_places.py::test_create_restores_soft_deleted_place tests/test_places.py::test_create_restore_updates_name_and_coords tests/test_places.py::test_create_restore_appears_in_list tests/test_places.py::test_create_no_google_place_id_no_dedup -v
```

Expected: 409 test returns 201 (no dedup yet); restore tests return 201 without restoring.

- [ ] **Step 3: Update `create_place` in `backend/app/routers/places.py` with dedup logic**

Add `Response` to the FastAPI import and update `create_place`:

```python
from fastapi import APIRouter, HTTPException, Response
```

Replace the `create_place` function:

```python
@router.post("", response_model=PlaceOut, status_code=201)
def create_place(body: PlaceCreate, response: Response):
    conn = get_db()
    try:
        for cat_id in body.category_ids:
            if not conn.execute(
                "SELECT id FROM categories WHERE id = ?", (cat_id,)
            ).fetchone():
                raise HTTPException(422, f"Category {cat_id} not found")

        if body.google_place_id:
            active = conn.execute(
                "SELECT id FROM places WHERE google_place_id = ? AND deleted_at IS NULL",
                (body.google_place_id,),
            ).fetchone()
            if active:
                raise HTTPException(409, "Lugar já está na lista")

            deleted = conn.execute(
                "SELECT id FROM places WHERE google_place_id = ? AND deleted_at IS NOT NULL",
                (body.google_place_id,),
            ).fetchone()
            if deleted:
                place_id = deleted["id"]
                conn.execute(
                    "UPDATE places SET deleted_at = NULL, name = ?, lat = ?, lng = ? WHERE id = ?",
                    (body.name, body.lat, body.lng, place_id),
                )
                conn.execute("DELETE FROM place_categories WHERE place_id = ?", (place_id,))
                for cat_id in body.category_ids:
                    conn.execute(
                        "INSERT INTO place_categories (place_id, category_id) VALUES (?, ?)",
                        (place_id, cat_id),
                    )
                conn.commit()
                response.status_code = 200
                return _fetch_place(conn, place_id)

        cur = conn.execute(
            "INSERT INTO places (name, google_place_id, lat, lng) VALUES (?, ?, ?, ?)",
            (body.name, body.google_place_id, body.lat, body.lng),
        )
        place_id = cur.lastrowid
        for cat_id in body.category_ids:
            conn.execute(
                "INSERT INTO place_categories (place_id, category_id) VALUES (?, ?)",
                (place_id, cat_id),
            )
        conn.commit()
        return _fetch_place(conn, place_id)
    finally:
        conn.close()
```

- [ ] **Step 4: Run — verify all tests PASS**

```bash
cd backend && pytest tests/ -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/places.py backend/tests/test_places.py
git commit -m "feat(backend): dedup on POST — 409 for active, restore for soft-deleted"
```

---

## Task 6: Frontend types + api

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/api.test.ts`
- Modify: `frontend/src/components/PlaceDetail.test.tsx` — update PLACE fixture

- [ ] **Step 1: Write failing tests — add to `frontend/src/api.test.ts`**

Add a `mockNoContent` helper and new test cases. Add after existing `beforeEach`:

```typescript
function mockNoContent() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 204,
  })
}
```

Append inside `describe('api.places', ...)` block:

```typescript
  it('update calls PUT /api/places/:id with body', async () => {
    const place = { id: 1, name: 'X', lat: 0, lng: 0, status: 'to_go', avg_rating: null,
      categories: [], created_at: '', google_place_id: null, alias: 'Xpto', description: null }
    mockOk(place)
    await api.places.update(1, { alias: 'Xpto', description: null, category_ids: [] })
    expect(mockFetch).toHaveBeenCalledWith('/api/places/1', expect.objectContaining({ method: 'PUT' }))
  })

  it('delete calls DELETE /api/places/:id and returns undefined', async () => {
    mockNoContent()
    const result = await api.places.delete(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/places/1', expect.objectContaining({ method: 'DELETE' }))
    expect(result).toBeUndefined()
  })

  it('request handles 204 without calling json()', async () => {
    const jsonSpy = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: jsonSpy })
    await api.places.delete(1)
    expect(jsonSpy).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run — verify new tests FAIL**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|✓|✗|×)"
```

Expected: the 3 new api.test.ts tests FAIL (`api.places.update is not a function`, `api.places.delete is not a function`).

- [ ] **Step 3: Update `frontend/src/types.ts`**

```typescript
export type PlaceStatus = 'to_go' | 'gone' | 'repeat'

export interface Category {
  id: number
  name: string
}

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
}

export interface PlaceCreate {
  name: string
  google_place_id: string | null
  lat: number
  lng: number
  category_ids: number[]
}

export interface PlaceUpdate {
  alias: string | null
  description: string | null
  category_ids: number[]
}

export interface ReviewCreate {
  reviewer: string
  rating: number
}

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}
```

- [ ] **Step 4: Update `frontend/src/api.ts` — fix request for 204, add update/delete**

```typescript
import type { Category, Place, PlaceCreate, PlaceStatus, PlaceUpdate, ReviewCreate } from './types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  places: {
    list: () => request<Place[]>('/places'),
    create: (body: PlaceCreate) =>
      request<Place>('/places', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: PlaceUpdate) =>
      request<Place>(`/places/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) =>
      request<void>(`/places/${id}`, { method: 'DELETE' }),
    updateStatus: (id: number, status: PlaceStatus) =>
      request<Place>(`/places/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    addReview: (id: number, body: ReviewCreate) =>
      request<Place>(`/places/${id}/reviews`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  categories: {
    list: () => request<Category[]>('/categories'),
    create: (name: string) =>
      request<Category>('/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
  },
}
```

- [ ] **Step 5: Update PLACE fixture in `frontend/src/components/PlaceDetail.test.tsx` — add alias/description**

Find the `const PLACE: Place = {` block and add the two new fields:

```typescript
const PLACE: Place = {
  id: 1,
  name: 'Pastéis de Belém',
  google_place_id: null,
  lat: 38.697,
  lng: -9.203,
  status: 'to_go',
  avg_rating: 4.5,
  categories: [{ id: 1, name: 'Café' }],
  created_at: '2026-01-01T00:00:00',
  alias: null,
  description: null,
}
```

- [ ] **Step 6: Run — verify all tests PASS**

```bash
cd frontend && npm test
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts frontend/src/api.test.ts frontend/src/components/PlaceDetail.test.tsx
git commit -m "feat(frontend): add alias/description to Place type, update/delete api methods, fix 204 handling"
```

---

## Task 7: Frontend hooks

**Files:**
- Modify: `frontend/src/hooks/usePlaces.ts`

- [ ] **Step 1: Add `useUpdatePlace` and `useDeletePlace` to `frontend/src/hooks/usePlaces.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { PlaceCreate, PlaceStatus, PlaceUpdate, ReviewCreate } from '../types'

const PLACES_KEY = ['places'] as const

export function usePlaces() {
  return useQuery({
    queryKey: PLACES_KEY,
    queryFn: api.places.list,
  })
}

export function useCreatePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PlaceCreate) => api.places.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLACES_KEY }),
  })
}

export function useUpdatePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PlaceUpdate }) =>
      api.places.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLACES_KEY }),
  })
}

export function useDeletePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.places.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLACES_KEY }),
  })
}

export function useUpdateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: PlaceStatus }) =>
      api.places.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLACES_KEY }),
  })
}

export function useAddReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ReviewCreate }) =>
      api.places.addReview(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLACES_KEY }),
  })
}
```

- [ ] **Step 2: Run — verify tests still PASS**

```bash
cd frontend && npm test
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/usePlaces.ts
git commit -m "feat(frontend): add useUpdatePlace and useDeletePlace hooks"
```

---

## Task 8: Install react-markdown + EditPlaceModal

**Files:**
- Create: `frontend/src/components/EditPlaceModal.tsx`
- Create: `frontend/src/components/EditPlaceModal.module.css`
- Create: `frontend/src/components/EditPlaceModal.test.tsx`

- [ ] **Step 1: Install dependencies**

```bash
cd frontend && npm install react-markdown remark-gfm
```

Expected: packages added to `node_modules` and `package.json`.

- [ ] **Step 2: Write failing tests — create `frontend/src/components/EditPlaceModal.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { EditPlaceModal } from './EditPlaceModal'
import type { Place } from '../types'

vi.mock('../hooks/usePlaces', () => ({
  useUpdatePlace: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: [{ id: 1, name: 'Café' }, { id: 2, name: 'Museu' }] }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const PLACE: Place = {
  id: 1,
  name: 'Pastéis de Belém',
  google_place_id: 'ChIJabc',
  lat: 38.697,
  lng: -9.203,
  status: 'to_go',
  avg_rating: null,
  categories: [{ id: 1, name: 'Café' }],
  created_at: '2026-01-01T00:00:00',
  alias: 'Pastéis',
  description: '# Bom lugar',
}

beforeEach(() => vi.clearAllMocks())

describe('EditPlaceModal', () => {
  it('renders modal title', () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Editar lugar')).toBeInTheDocument()
  })

  it('shows locked place name', () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Pastéis de Belém')).toBeInTheDocument()
  })

  it('pre-fills alias input', () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    const input = screen.getByPlaceholderText('Pastéis de Belém') as HTMLInputElement
    expect(input.value).toBe('Pastéis')
  })

  it('pre-fills description textarea', () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    const textarea = screen.getByRole('textbox', { name: /descrição/i }) as HTMLTextAreaElement
    expect(textarea.value).toBe('# Bom lugar')
  })

  it('pre-selects category chips', () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    const caféChip = screen.getByText('Café').closest('button')!
    expect(caféChip).toHaveAttribute('aria-pressed', 'true')
    const museuChip = screen.getByText('Museu').closest('button')!
    expect(museuChip).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onClose when Cancelar clicked', async () => {
    const onClose = vi.fn()
    render(<EditPlaceModal place={PLACE} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<EditPlaceModal place={PLACE} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('category chip toggles aria-pressed', async () => {
    render(<EditPlaceModal place={PLACE} onClose={vi.fn()} />, { wrapper })
    const museuChip = screen.getByText('Museu').closest('button')!
    await userEvent.click(museuChip)
    expect(museuChip).toHaveAttribute('aria-pressed', 'true')
  })
})
```

- [ ] **Step 3: Run — verify tests FAIL**

```bash
cd frontend && npm test
```

Expected: EditPlaceModal tests FAIL with "Cannot find module './EditPlaceModal'".

- [ ] **Step 4: Create `frontend/src/components/EditPlaceModal.tsx`**

```typescript
import { useState } from 'react'
import type { Place } from '../types'
import { useUpdatePlace } from '../hooks/usePlaces'
import { useCategories } from '../hooks/useCategories'
import styles from './EditPlaceModal.module.css'

interface Props {
  place: Place
  onClose: () => void
}

export function EditPlaceModal({ place, onClose }: Props) {
  const [alias, setAlias] = useState(place.alias ?? '')
  const [description, setDescription] = useState(place.description ?? '')
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>(
    place.categories.map((c) => c.id),
  )
  const { data: categories = [] } = useCategories()
  const updatePlace = useUpdatePlace()

  function toggleCategory(id: number) {
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function handleSave() {
    updatePlace.mutate(
      {
        id: place.id,
        body: {
          alias: alias.trim() || null,
          description: description.trim() || null,
          category_ids: selectedCatIds,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Editar lugar</h2>
          <button className={styles.close} onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Local</label>
          <p className={styles.lockedName}>{place.name}</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Apelido</label>
          <input
            className={styles.input}
            type="text"
            placeholder={place.name}
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-description">Descrição (markdown)</label>
          <textarea
            id="edit-description"
            className={styles.textarea}
            rows={4}
            placeholder="Escreva uma descrição..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Categorias</label>
          <div className={styles.chips}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.chip} ${selectedCatIds.includes(cat.id) ? styles.chipActive : ''}`}
                onClick={() => toggleCategory(cat.id)}
                aria-pressed={selectedCatIds.includes(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={updatePlace.isPending}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `frontend/src/components/EditPlaceModal.module.css`**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(6, 11, 24, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.modal {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: min(480px, 95vw);
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-family: var(--font-ui);
}

.lockedName {
  font-size: 0.9375rem;
  color: var(--text-muted);
  font-family: var(--font-ui);
  padding: 0;
  margin: 0;
}

.input {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
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

.textarea {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 0.9375rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 100px;
}

.textarea:focus {
  border-color: var(--amber);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.chip {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 0.8125rem;
  cursor: pointer;
}

.chipActive {
  border-color: var(--amber);
  color: var(--amber);
  background: var(--bg-selected);
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.cancelBtn {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: var(--text-muted);
  font-family: var(--font-ui);
  cursor: pointer;
}

.saveBtn {
  background: var(--amber);
  color: var(--bg-deep);
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1.25rem;
  font-family: var(--font-ui);
  font-weight: 600;
  cursor: pointer;
}

.saveBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 6: Run — verify all tests PASS**

```bash
cd frontend && npm test
```

Expected: all PASS including the 8 new EditPlaceModal tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/EditPlaceModal.tsx frontend/src/components/EditPlaceModal.module.css frontend/src/components/EditPlaceModal.test.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add EditPlaceModal component with alias, description, categories"
```

---

## Task 9: PlaceDetail — alias, description, edit/delete

**Files:**
- Modify: `frontend/src/components/PlaceDetail.tsx`
- Modify: `frontend/src/components/PlaceDetail.module.css`
- Modify: `frontend/src/components/PlaceDetail.test.tsx`

- [ ] **Step 1: Write failing tests — update `frontend/src/components/PlaceDetail.test.tsx`**

Replace the entire file with the updated version (adds useDeletePlace mock, useCategories mock, alias/description tests, edit/delete button tests):

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { PlaceDetail } from './PlaceDetail'
import type { Place } from '../types'

const deleteMutate = vi.fn()

vi.mock('../hooks/usePlaces', () => ({
  useUpdateStatus: () => ({ mutate: vi.fn() }),
  useAddReview: () => ({ mutate: vi.fn() }),
  useDeletePlace: () => ({ mutate: deleteMutate }),
  useUpdatePlace: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../hooks/useIdentity', () => ({
  useIdentity: () => ({ name: 'Fab' }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: [] }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const PLACE: Place = {
  id: 1,
  name: 'Pastéis de Belém',
  google_place_id: null,
  lat: 38.697,
  lng: -9.203,
  status: 'to_go',
  avg_rating: 4.5,
  categories: [{ id: 1, name: 'Café' }],
  created_at: '2026-01-01T00:00:00',
  alias: null,
  description: null,
}

beforeEach(() => vi.clearAllMocks())

describe('PlaceDetail', () => {
  it('renders place name when no alias', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Pastéis de Belém')).toBeInTheDocument()
  })

  it('renders alias instead of name when alias set', () => {
    const placeWithAlias = { ...PLACE, alias: 'Pastéis Famosos' }
    render(<PlaceDetail place={placeWithAlias} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Pastéis Famosos')
  })

  it('renders description when set', () => {
    const placeWithDesc = { ...PLACE, description: 'Lugar incrível' }
    render(<PlaceDetail place={placeWithDesc} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Lugar incrível')).toBeInTheDocument()
  })

  it('does not render description section when null', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByTestId('description')).not.toBeInTheDocument()
  })

  it('renders category', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Café')).toBeInTheDocument()
  })

  it('renders all 3 status buttons', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('📍 A ir')).toBeInTheDocument()
    expect(screen.getByText('✓ Fomos')).toBeInTheDocument()
    expect(screen.getByText('❤ Repetir')).toBeInTheDocument()
  })

  it('shows review form when Avaliar clicked', async () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByText('Avaliar'))
    expect(screen.getByText('Salvar')).toBeInTheDocument()
  })

  it('hides review form when Cancelar clicked', async () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByText('Avaliar'))
    await userEvent.click(screen.getByText('Cancelar'))
    expect(screen.queryByText('Salvar')).not.toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<PlaceDetail place={PLACE} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders Editar and Excluir buttons', () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Excluir')).toBeInTheDocument()
  })

  it('opens EditPlaceModal when Editar clicked', async () => {
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByText('Editar'))
    expect(screen.getByText('Editar lugar')).toBeInTheDocument()
  })

  it('calls deletePlace and onClose when Excluir confirmed', async () => {
    const onClose = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteMutate.mockImplementationOnce((_id: number, { onSuccess }: { onSuccess: () => void }) => onSuccess())
    render(<PlaceDetail place={PLACE} onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByText('Excluir'))
    expect(confirmSpy).toHaveBeenCalledWith('Excluir lugar?')
    expect(deleteMutate).toHaveBeenCalledWith(PLACE.id, expect.any(Object))
    expect(onClose).toHaveBeenCalledOnce()
    confirmSpy.mockRestore()
  })

  it('does not call deletePlace when Excluir cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<PlaceDetail place={PLACE} onClose={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByText('Excluir'))
    expect(deleteMutate).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run — verify new tests FAIL**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|✗|×|PASS|✓)"
```

Expected: tests for alias, description, Editar, Excluir FAIL because PlaceDetail doesn't have those yet.

- [ ] **Step 3: Update `frontend/src/components/PlaceDetail.tsx`**

```typescript
import { useState } from 'react'
import type { Place, PlaceStatus } from '../types'
import { StarRating } from './StarRating'
import { useUpdateStatus, useAddReview, useDeletePlace } from '../hooks/usePlaces'
import { useIdentity } from '../hooks/useIdentity'
import { EditPlaceModal } from './EditPlaceModal'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './PlaceDetail.module.css'

interface Props {
  place: Place
  onClose: () => void
}

const STATUS_LABELS: Record<PlaceStatus, string> = {
  to_go: '📍 A ir',
  gone: '✓ Fomos',
  repeat: '❤ Repetir',
}

export function PlaceDetail({ place, onClose }: Props) {
  const { name: reviewer } = useIdentity()
  const updateStatus = useUpdateStatus()
  const addReview = useAddReview()
  const deletePlace = useDeletePlace()
  const [showReview, setShowReview] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [rating, setRating] = useState(3.0)

  function handleStatusChange(status: PlaceStatus) {
    updateStatus.mutate({ id: place.id, status })
  }

  function handleReviewSubmit() {
    if (!reviewer) return
    addReview.mutate(
      { id: place.id, body: { reviewer, rating } },
      { onSuccess: () => setShowReview(false) },
    )
  }

  function handleDelete() {
    if (!window.confirm('Excluir lugar?')) return
    deletePlace.mutate(place.id, { onSuccess: onClose })
  }

  return (
    <div className={styles.panel}>
      <button className={styles.close} onClick={onClose} aria-label="Fechar">✕</button>
      <h2 className={styles.name}>{place.alias ?? place.name}</h2>
      <p className={styles.categories}>
        {place.categories.map((c) => c.name).join(' · ')}
      </p>

      {place.description && (
        <div className={styles.description} data-testid="description">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{place.description}</ReactMarkdown>
        </div>
      )}

      <div className={styles.rating}>
        <StarRating mode="display" value={place.avg_rating} />
        {place.avg_rating !== null && (
          <span className={styles.ratingValue}>{place.avg_rating.toFixed(1)}</span>
        )}
      </div>

      <div className={styles.statusRow}>
        {(['to_go', 'gone', 'repeat'] as PlaceStatus[]).map((s) => (
          <button
            key={s}
            className={`${styles.statusBtn} ${place.status === s ? styles.statusActive : ''}`}
            onClick={() => handleStatusChange(s)}
            aria-pressed={place.status === s}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {!showReview ? (
        <button className={styles.reviewBtn} onClick={() => setShowReview(true)}>
          Avaliar
        </button>
      ) : (
        <div className={styles.reviewForm}>
          <StarRating mode="input" value={rating} onChange={setRating} />
          <div className={styles.reviewActions}>
            <button className={styles.cancelBtn} onClick={() => setShowReview(false)}>
              Cancelar
            </button>
            <button className={styles.submitBtn} onClick={handleReviewSubmit}>
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className={styles.actionRow}>
        <button className={styles.editBtn} onClick={() => setShowEdit(true)}>
          Editar
        </button>
        <button className={styles.deleteBtn} onClick={handleDelete}>
          Excluir
        </button>
      </div>

      {showEdit && (
        <EditPlaceModal place={place} onClose={() => setShowEdit(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add new styles to `frontend/src/components/PlaceDetail.module.css`**

Append to the end of the existing file:

```css
.description {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.description p {
  margin: 0 0 0.5rem;
}

.description h1,
.description h2,
.description h3 {
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0.75rem 0 0.25rem;
}

.actionRow {
  display: flex;
  gap: 0.5rem;
}

.editBtn {
  flex: 1;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 0.875rem;
  cursor: pointer;
}

.deleteBtn {
  background: none;
  border: 1px solid #c53030;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  color: #c53030;
  font-family: var(--font-ui);
  font-size: 0.875rem;
  cursor: pointer;
}
```

- [ ] **Step 5: Run — verify all tests PASS**

```bash
cd frontend && npm test
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PlaceDetail.tsx frontend/src/components/PlaceDetail.module.css frontend/src/components/PlaceDetail.test.tsx
git commit -m "feat(frontend): PlaceDetail shows alias, description (markdown), edit/delete buttons"
```

---

## Task 10: AddPlaceModal 409 error handling

**Files:**
- Modify: `frontend/src/components/AddPlaceModal.tsx`
- Modify: `frontend/src/components/AddPlaceModal.module.css`
- Modify: `frontend/src/components/AddPlaceModal.test.tsx`

- [ ] **Step 1: Write failing test — update `frontend/src/components/AddPlaceModal.test.tsx`**

Replace the mock at the top with a version that allows `isError` control, and add a 409 test:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { AddPlaceModal } from './AddPlaceModal'

vi.mock('@vis.gl/react-google-maps', () => ({
  useMapsLibrary: () => null,
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

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  createPlaceMock.isError = false
  createPlaceMock.error = null
})

describe('AddPlaceModal', () => {
  it('renders modal title', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Adicionar lugar')).toBeInTheDocument()
  })

  it('renders existing category chips', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Café')).toBeInTheDocument()
    expect(screen.getByText('Museu')).toBeInTheDocument()
  })

  it('save button disabled when no place selected', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Salvar')).toBeDisabled()
  })

  it('calls onClose when Cancelar clicked', async () => {
    const onClose = vi.fn()
    render(<AddPlaceModal onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<AddPlaceModal onClose={onClose} />, { wrapper })
    await userEvent.click(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('category chip toggles aria-pressed', async () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    const chip = screen.getByText('Café').closest('button')!
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('+ button disabled when new category input is empty', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('+')).toBeDisabled()
  })

  it('shows error message when place already in list (409)', () => {
    createPlaceMock.isError = true
    createPlaceMock.error = new Error('409 Conflict')
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.getByText('Lugar já está na lista')).toBeInTheDocument()
  })

  it('does not show error when no error', () => {
    render(<AddPlaceModal onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByText('Lugar já está na lista')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — verify the 409 test FAILS**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|✗|×|✓)"
```

Expected: `shows error message when place already in list (409)` FAILS — error text not rendered.

- [ ] **Step 3: Update `frontend/src/components/AddPlaceModal.tsx` — add 409 error display**

Add `isError` and `error` usage from `createPlace`. Add the error paragraph to JSX (above the footer). Replace just the `createPlace` usage and footer section:

Full updated file:

```typescript
import { useState, useRef, useEffect } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import type { Category } from '../types'
import { useCreatePlace } from '../hooks/usePlaces'
import { useCategories, useCreateCategory } from '../hooks/useCategories'
import styles from './AddPlaceModal.module.css'

interface SelectedPlace {
  name: string
  google_place_id: string | null
  lat: number
  lng: number
}

interface Props {
  onClose: () => void
}

export function AddPlaceModal({ onClose }: Props) {
  const placesLib = useMapsLibrary('places')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([])
  const [newCatName, setNewCatName] = useState('')

  const { data: categories = [] } = useCategories()
  const createPlace = useCreatePlace()
  const createCategory = useCreateCategory()

  const is409 =
    createPlace.isError &&
    createPlace.error instanceof Error &&
    createPlace.error.message.startsWith('409')

  useEffect(() => {
    if (!placesLib || !inputRef.current) return
    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['place_id', 'name', 'geometry'],
    })
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry?.location) return
      setSelectedPlace({
        name: place.name ?? '',
        google_place_id: place.place_id ?? null,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      })
    })
  }, [placesLib])

  function toggleCategory(id: number) {
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function handleAddCategory() {
    const name = newCatName.trim()
    if (!name) return
    createCategory.mutate(name, {
      onSuccess: (cat: Category) => {
        setSelectedCatIds((prev) => [...prev, cat.id])
        setNewCatName('')
      },
    })
  }

  function handleSave() {
    if (!selectedPlace) return
    createPlace.mutate(
      { ...selectedPlace, category_ids: selectedCatIds },
      { onSuccess: onClose },
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Adicionar lugar</h2>
          <button className={styles.close} onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Local</label>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Pesquisar lugar..."
          />
          {selectedPlace && (
            <p className={styles.selected}>{selectedPlace.name}</p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Categorias</label>
          <div className={styles.chips}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.chip} ${selectedCatIds.includes(cat.id) ? styles.chipActive : ''}`}
                onClick={() => toggleCategory(cat.id)}
                aria-pressed={selectedCatIds.includes(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className={styles.addCat}>
            <input
              className={styles.input}
              type="text"
              placeholder="Nova categoria..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <button
              type="button"
              className={styles.addCatBtn}
              onClick={handleAddCategory}
              disabled={!newCatName.trim()}
            >
              +
            </button>
          </div>
        </div>

        {is409 && (
          <p className={styles.error}>Lugar já está na lista</p>
        )}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!selectedPlace || createPlace.isPending}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add `.error` style to `frontend/src/components/AddPlaceModal.module.css`**

Append to end of file:

```css
.error {
  font-size: 0.8125rem;
  color: #c53030;
  font-family: var(--font-ui);
  margin: 0;
}
```

- [ ] **Step 5: Run — verify all tests PASS**

```bash
cd frontend && npm test
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AddPlaceModal.tsx frontend/src/components/AddPlaceModal.module.css frontend/src/components/AddPlaceModal.test.tsx
git commit -m "feat(frontend): show error in AddPlaceModal when place already in list (409)"
```

---

## Done

All tasks complete. Full feature implemented and tested:

- Backend: soft-delete, edit, and dedup on POST with `google_place_id`
- Frontend: `EditPlaceModal`, alias display in `PlaceDetail`, markdown description, 409 error in `AddPlaceModal`
