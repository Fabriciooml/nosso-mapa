# Nosso Mapa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private couples map app (2 users) to track, tag and review places — dark-themed, responsive, Google Maps–powered, deployed via Docker Compose on a homelab Portainer.

**Architecture:** React (Vite) SPA served by nginx on port 1996, proxying `/api/*` to a FastAPI + SQLite backend on port 2000. Both containers managed by a single Docker Compose stack. No auth — user identity stored in localStorage.

**Tech Stack:** Python 3.11 + FastAPI + sqlite3 | React 18 + TypeScript + Vite + TanStack Query + @vis.gl/react-google-maps | Docker Compose + nginx:alpine

---

## Prerequisites (gather before starting)

- [ ] **Google Maps API key** — enable Maps JavaScript API + Places API in Google Cloud Console. Store as `VITE_GOOGLE_MAPS_KEY` in `frontend/.env.local` (gitignored).
- [ ] **Python 3.11+** installed locally for backend dev/test.
- [ ] **Node 20+** installed locally for frontend dev/test.
- [ ] **Docker + Docker Compose** available for final integration test.
- [ ] **pytest** installable via pip — backend tests use it.
- [ ] **Portainer** stack ready to receive `docker-compose.yml` — no extra setup needed.

---

## File Map

```
nosso-mapa/                         ← repo root = /home/fab/codes/map_fabi_fe
├── .gitignore
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py                 ← FastAPI app + lifespan
│       ├── database.py             ← sqlite3 connection, init_db, get_db
│       ├── models.py               ← Pydantic v2 request/response schemas
│       └── routers/
│           ├── __init__.py
│           ├── categories.py       ← GET/POST /api/categories
│           └── places.py           ← GET/POST /api/places, PATCH status, POST reviews
│   └── tests/
│       ├── conftest.py             ← test DB fixture + TestClient
│       ├── test_categories.py
│       └── test_places.py
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 ← layout + state wiring
│       ├── types.ts                ← TypeScript interfaces
│       ├── api.ts                  ← fetch wrappers
│       ├── hooks/
│       │   ├── useIdentity.ts      ← localStorage name
│       │   ├── usePlaces.ts        ← TanStack Query: places CRUD
│       │   └── useCategories.ts    ← TanStack Query: categories CRUD
│       ├── components/
│       │   ├── IdentityModal.tsx
│       │   ├── MapView.tsx         ← Google Map + markers + info card
│       │   ├── FilterBar.tsx       ← status + category chip filters
│       │   ├── ListPanel.tsx       ← desktop left panel
│       │   ├── PlaceItem.tsx       ← single row in list
│       │   ├── BottomSheet.tsx     ← mobile drag-up overlay
│       │   ├── PlaceDetail.tsx     ← status toggle + star rating trigger
│       │   ├── StarRating.tsx      ← half-star interactive input
│       │   └── AddPlaceModal.tsx   ← Google Places autocomplete + categories
│       └── styles/
│           └── index.css           ← CSS variables, global, fonts
└── docs/
    └── superpowers/
        ├── specs/2026-06-30-nosso-mapa-design.md
        └── plans/2026-06-30-nosso-mapa.md  ← this file
```

---

## Task 1: Root scaffold

**Files:**
- Create: `.gitignore`
- Create: `docker-compose.yml` (skeleton — finalized in Task 18)

- [ ] **Step 1: Create .gitignore**

```
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
.env

# Node
node_modules/
dist/

# Local env
frontend/.env.local
*.db

# Superpowers
.superpowers/
```

- [ ] **Step 2: Create docker-compose.yml skeleton**

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "1996:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "2000:8000"
    volumes:
      - db-data:/app/data
    environment:
      - DB_PATH=/app/data/nosso_mapa.db

volumes:
  db-data:
```

- [ ] **Step 3: Skip git for now**

No repo yet — project needs a name first. Skip all `git` steps throughout this plan until the repo is initialized. Resume from the first commit step once `git init` has been run with the chosen project name.

---

## Task 2: Backend scaffold + database

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/Dockerfile`
- Create: `backend/app/__init__.py` (empty)
- Create: `backend/app/database.py`
- Create: `backend/app/main.py`
- Create: `backend/app/routers/__init__.py` (empty)
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
pytest==8.3.3
httpx==0.27.2
```

- [ ] **Step 2: Create backend/Dockerfile**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
RUN mkdir -p /app/data
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Write failing test for DB init**

Create `backend/tests/conftest.py`:

```python
import pytest
import os
from fastapi.testclient import TestClient


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test.db")


@pytest.fixture
def client(db_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", db_path)
    import app.database as db_module
    monkeypatch.setattr(db_module, "DB_PATH", db_path)
    db_module.init_db()
    from app.main import app
    with TestClient(app) as c:
        yield c
```

Create `backend/tests/test_categories.py` with one sentinel test:

```python
def test_db_has_seeded_categories(client):
    response = client.get("/api/categories")
    assert response.status_code == 200
    names = [c["name"] for c in response.json()]
    assert "Restaurante" in names
    assert "Café" in names
    assert "Museu" in names
    assert "Cinema" in names
    assert "Lanche" in names
```

- [ ] **Step 4: Run — expect import errors (nothing exists yet)**

```bash
cd backend && python -m pytest tests/test_categories.py -v
```

Expected: `ImportError` or `ModuleNotFoundError`.

- [ ] **Step 5: Create database.py**

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
    conn.commit()
    conn.close()
```

- [ ] **Step 6: Create models.py**

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
    categories: list[CategoryOut]
    created_at: str
```

- [ ] **Step 7: Create main.py**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from .database import init_db
from .routers import categories, places


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(categories.router)
app.include_router(places.router)
```

- [ ] **Step 8: Create empty routers**

`backend/app/routers/__init__.py` — empty file.

`backend/app/routers/categories.py` — stub:

```python
from fastapi import APIRouter
router = APIRouter(prefix="/api/categories", tags=["categories"])
```

`backend/app/routers/places.py` — stub:

```python
from fastapi import APIRouter
router = APIRouter(prefix="/api/places", tags=["places"])
```

- [ ] **Step 9: Run tests — expect 404 (no routes yet, but imports work)**

```bash
cd backend && python -m pytest tests/test_categories.py::test_db_has_seeded_categories -v
```

Expected: FAIL — `assert 200 == 404` (route doesn't exist yet, but no import errors).

- [ ] **Step 10: Commit skeleton**

```bash
git add backend/
git commit -m "chore: backend scaffold, database schema, pydantic models"
```

---

## Task 3: Categories API

**Files:**
- Modify: `backend/app/routers/categories.py`
- Modify: `backend/tests/test_categories.py`

- [ ] **Step 1: Write all failing tests**

Replace `backend/tests/test_categories.py`:

```python
def test_db_has_seeded_categories(client):
    response = client.get("/api/categories")
    assert response.status_code == 200
    names = [c["name"] for c in response.json()]
    for expected in ["Restaurante", "Café", "Museu", "Cinema", "Lanche"]:
        assert expected in names


def test_list_categories_returns_id_and_name(client):
    response = client.get("/api/categories")
    cat = response.json()[0]
    assert "id" in cat
    assert "name" in cat


def test_create_category(client):
    response = client.post("/api/categories", json={"name": "Praia"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Praia"
    assert isinstance(body["id"], int)


def test_create_category_duplicate_returns_existing(client):
    client.post("/api/categories", json={"name": "Único"})
    response = client.post("/api/categories", json={"name": "Único"})
    assert response.status_code == 201
    # second call returns the existing one, not an error
    assert response.json()["name"] == "Único"


def test_create_category_appears_in_list(client):
    client.post("/api/categories", json={"name": "Teatro"})
    names = [c["name"] for c in client.get("/api/categories").json()]
    assert "Teatro" in names
```

- [ ] **Step 2: Run — all fail (no routes)**

```bash
cd backend && python -m pytest tests/test_categories.py -v
```

Expected: 5 FAIL.

- [ ] **Step 3: Implement categories router**

Replace `backend/app/routers/categories.py`:

```python
from fastapi import APIRouter
from ..database import get_db
from ..models import CategoryOut, CategoryCreate

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryOut])
def list_categories():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, name FROM categories ORDER BY name"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryCreate):
    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT id, name FROM categories WHERE name = ?", (body.name,)
        ).fetchone()
        if existing:
            return dict(existing)
        cur = conn.execute(
            "INSERT INTO categories (name) VALUES (?)", (body.name,)
        )
        conn.commit()
        return {"id": cur.lastrowid, "name": body.name}
    finally:
        conn.close()
```

- [ ] **Step 4: Run — all pass**

```bash
cd backend && python -m pytest tests/test_categories.py -v
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/categories.py backend/tests/test_categories.py
git commit -m "feat(backend): categories API with seeded data"
```

---

## Task 4: Places API — list & create

**Files:**
- Modify: `backend/app/routers/places.py`
- Create: `backend/tests/test_places.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_places.py`:

```python
import pytest


PLACE_PAYLOAD = {
    "name": "Restaurante Italia",
    "google_place_id": "ChIJabc123",
    "lat": 38.7169,
    "lng": -9.1395,
    "category_ids": [],
}


def _cat_id(client, name: str) -> int:
    return client.post("/api/categories", json={"name": name}).json()["id"]


def test_list_places_empty(client):
    response = client.get("/api/places")
    assert response.status_code == 200
    assert response.json() == []


def test_create_place_returns_201(client):
    response = client.post("/api/places", json=PLACE_PAYLOAD)
    assert response.status_code == 201


def test_create_place_fields(client):
    body = client.post("/api/places", json=PLACE_PAYLOAD).json()
    assert body["name"] == "Restaurante Italia"
    assert body["lat"] == 38.7169
    assert body["lng"] == -9.1395
    assert body["status"] == "to_go"
    assert body["avg_rating"] is None
    assert body["categories"] == []
    assert "id" in body
    assert "created_at" in body


def test_create_place_with_categories(client):
    cat_id = _cat_id(client, "Café")
    payload = {**PLACE_PAYLOAD, "category_ids": [cat_id]}
    body = client.post("/api/places", json=payload).json()
    assert len(body["categories"]) == 1
    assert body["categories"][0]["name"] == "Café"


def test_create_place_appears_in_list(client):
    client.post("/api/places", json=PLACE_PAYLOAD)
    places = client.get("/api/places").json()
    assert len(places) == 1
    assert places[0]["name"] == "Restaurante Italia"


def test_create_place_invalid_category_id_raises_422(client):
    payload = {**PLACE_PAYLOAD, "category_ids": [999]}
    response = client.post("/api/places", json=payload)
    assert response.status_code in (422, 400)
```

- [ ] **Step 2: Run — all fail**

```bash
cd backend && python -m pytest tests/test_places.py -v
```

Expected: all FAIL (routes return 405/404).

- [ ] **Step 3: Implement list + create**

Replace `backend/app/routers/places.py`:

```python
from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..models import PlaceCreate, PlaceOut, PlaceStatusUpdate, ReviewCreate

router = APIRouter(prefix="/api/places", tags=["places"])


def _fetch_place(conn, place_id: int) -> dict:
    row = conn.execute(
        """SELECT p.id, p.name, p.google_place_id, p.lat, p.lng,
                  p.status, p.created_at, AVG(r.rating) AS avg_rating
           FROM places p
           LEFT JOIN reviews r ON r.place_id = p.id
           WHERE p.id = ?
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


@router.get("/", response_model=list[PlaceOut])
def list_places():
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT p.id FROM places p ORDER BY p.created_at DESC"""
        ).fetchall()
        return [_fetch_place(conn, r["id"]) for r in rows]
    finally:
        conn.close()


@router.post("/", response_model=PlaceOut, status_code=201)
def create_place(body: PlaceCreate):
    conn = get_db()
    try:
        # Validate category ids exist
        for cat_id in body.category_ids:
            if not conn.execute(
                "SELECT id FROM categories WHERE id = ?", (cat_id,)
            ).fetchone():
                raise HTTPException(422, f"Category {cat_id} not found")

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

- [ ] **Step 4: Run — all pass**

```bash
cd backend && python -m pytest tests/test_places.py -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/places.py backend/tests/test_places.py
git commit -m "feat(backend): places list and create API"
```

---

## Task 5: Places API — status update & reviews

**Files:**
- Modify: `backend/app/routers/places.py`
- Modify: `backend/tests/test_places.py`

- [ ] **Step 1: Append failing tests to test_places.py**

```python
def test_update_status(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.patch(f"/api/places/{place_id}/status", json={"status": "gone"})
    assert response.status_code == 200
    assert response.json()["status"] == "gone"


def test_update_status_invalid_value(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.patch(f"/api/places/{place_id}/status", json={"status": "nope"})
    assert response.status_code == 422


def test_update_status_nonexistent_place(client):
    response = client.patch("/api/places/999/status", json={"status": "gone"})
    assert response.status_code == 404


def test_create_review(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.post(
        f"/api/places/{place_id}/reviews",
        json={"reviewer": "Fab", "rating": 4.5},
    )
    assert response.status_code == 201
    assert response.json()["avg_rating"] == 4.5


def test_review_rating_appears_in_place_avg(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    client.post(f"/api/places/{place_id}/reviews", json={"reviewer": "Fab", "rating": 4.0})
    client.post(f"/api/places/{place_id}/reviews", json={"reviewer": "Ami", "rating": 5.0})
    place = client.get("/api/places").json()[0]
    assert place["avg_rating"] == 4.5


def test_review_invalid_rating_rejected(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.post(
        f"/api/places/{place_id}/reviews",
        json={"reviewer": "Fab", "rating": 4.3},  # not a 0.5 step
    )
    assert response.status_code == 422


def test_review_out_of_range_rejected(client):
    place_id = client.post("/api/places", json=PLACE_PAYLOAD).json()["id"]
    response = client.post(
        f"/api/places/{place_id}/reviews",
        json={"reviewer": "Fab", "rating": 6.0},
    )
    assert response.status_code == 422


def test_review_nonexistent_place(client):
    response = client.post(
        "/api/places/999/reviews", json={"reviewer": "Fab", "rating": 3.0}
    )
    assert response.status_code == 404
```

- [ ] **Step 2: Run — new tests fail**

```bash
cd backend && python -m pytest tests/test_places.py -v
```

Expected: 7 new FAIL, 6 old PASS.

- [ ] **Step 3: Add status + review routes to places.py**

Append to `backend/app/routers/places.py` (after `create_place`):

```python
@router.patch("/{place_id}/status", response_model=PlaceOut)
def update_status(place_id: int, body: PlaceStatusUpdate):
    conn = get_db()
    try:
        if not conn.execute(
            "SELECT id FROM places WHERE id = ?", (place_id,)
        ).fetchone():
            raise HTTPException(404, "Place not found")
        conn.execute(
            "UPDATE places SET status = ? WHERE id = ?", (body.status, place_id)
        )
        conn.commit()
        return _fetch_place(conn, place_id)
    finally:
        conn.close()


@router.post("/{place_id}/reviews", status_code=201)
def create_review(place_id: int, body: ReviewCreate):
    conn = get_db()
    try:
        if not conn.execute(
            "SELECT id FROM places WHERE id = ?", (place_id,)
        ).fetchone():
            raise HTTPException(404, "Place not found")
        conn.execute(
            "INSERT INTO reviews (place_id, reviewer, rating) VALUES (?, ?, ?)",
            (place_id, body.reviewer, body.rating),
        )
        conn.commit()
        avg = conn.execute(
            "SELECT AVG(rating) AS avg FROM reviews WHERE place_id = ?", (place_id,)
        ).fetchone()["avg"]
        return {"avg_rating": avg}
    finally:
        conn.close()
```

- [ ] **Step 4: Run — all 13 pass**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: 13 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/places.py backend/tests/test_places.py
git commit -m "feat(backend): status update and reviews API"
```

---

## Task 6: Frontend scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx` (shell)
- Create: `frontend/src/styles/index.css`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "nosso-mapa",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.56.2",
    "@vis.gl/react-google-maps": "^1.3.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.9",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.3",
    "vite": "^5.4.7",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd frontend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:2000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 5: Create src/test-setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Create index.html**

```html
<!doctype html>
<html lang="pt">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nosso Mapa</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create src/styles/index.css**

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;1,300;1,400&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

:root {
  --bg-deep:      #060b18;
  --bg-panel:     #0b1120;
  --bg-surface:   #111827;
  --bg-hover:     #151f30;
  --bg-selected:  #0d1f3c;
  --border:       #1a2640;
  --border-sub:   #111827;
  --text-primary: #e8edf5;
  --text-muted:   #4a5a72;
  --text-dim:     #2a3a52;
  --amber:        #f0b429;
  --amber-dim:    #8a6315;
  --amber-glow:   rgba(240, 180, 41, 0.12);
  --blue:         #4a9eff;
  --blue-dim:     #1a3a6a;
  --blue-glow:    rgba(74, 158, 255, 0.15);
  --rose:         #ff6b9d;
  --rose-dim:     #5a1f35;
  --slate:        #3d4a5c;
  --radius:       10px;
  --font-display: 'Fraunces', serif;
  --font-ui:      'IBM Plex Sans', sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body {
  font-family: var(--font-ui);
  background: var(--bg-deep);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}
button { font-family: var(--font-ui); }
input  { font-family: var(--font-ui); }
```

- [ ] **Step 8: Create src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { APIProvider } from '@vis.gl/react-google-maps'
import App from './App'
import './styles/index.css'

const queryClient = new QueryClient()
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <APIProvider apiKey={MAPS_KEY}>
        <App />
      </APIProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
```

- [ ] **Step 9: Create src/App.tsx shell**

```tsx
export default function App() {
  return <div style={{ height: '100%', background: 'var(--bg-deep)' }}>Loading...</div>
}
```

- [ ] **Step 10: Create frontend/.env.local**

```
VITE_GOOGLE_MAPS_KEY=YOUR_KEY_HERE
```

Replace `YOUR_KEY_HERE` with actual key.

- [ ] **Step 11: Verify dev server starts**

```bash
cd frontend && npm run dev
```

Expected: Vite server at `http://localhost:5173`, page shows "Loading...".

- [ ] **Step 12: Commit**

```bash
git add frontend/
git commit -m "chore(frontend): scaffold, CSS variables, fonts, Vite config"
```

---

## Task 7: Types + API client

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/api.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchPlaces, createPlace, updatePlaceStatus,
  submitReview, fetchCategories, createCategory,
} from './api'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

function ok(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
}
function fail() {
  return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response)
}

describe('fetchPlaces', () => {
  it('calls GET /api/places and returns json', async () => {
    mockFetch.mockReturnValue(ok([{ id: 1, name: 'Test' }]))
    const result = await fetchPlaces()
    expect(mockFetch).toHaveBeenCalledWith('/api/places')
    expect(result[0].name).toBe('Test')
  })
  it('throws on error', async () => {
    mockFetch.mockReturnValue(fail())
    await expect(fetchPlaces()).rejects.toThrow()
  })
})

describe('createPlace', () => {
  it('calls POST /api/places with json body', async () => {
    const payload = { name: 'P', google_place_id: null, lat: 1, lng: 2, category_ids: [] }
    mockFetch.mockReturnValue(ok({ id: 1, ...payload }))
    await createPlace(payload)
    expect(mockFetch).toHaveBeenCalledWith('/api/places', expect.objectContaining({ method: 'POST' }))
  })
})

describe('updatePlaceStatus', () => {
  it('calls PATCH /api/places/1/status', async () => {
    mockFetch.mockReturnValue(ok({ id: 1, status: 'gone' }))
    await updatePlaceStatus(1, 'gone')
    expect(mockFetch).toHaveBeenCalledWith('/api/places/1/status', expect.objectContaining({ method: 'PATCH' }))
  })
})

describe('submitReview', () => {
  it('calls POST /api/places/1/reviews', async () => {
    mockFetch.mockReturnValue(ok({ avg_rating: 4.5 }))
    await submitReview(1, { reviewer: 'Fab', rating: 4.5 })
    expect(mockFetch).toHaveBeenCalledWith('/api/places/1/reviews', expect.objectContaining({ method: 'POST' }))
  })
})

describe('fetchCategories', () => {
  it('calls GET /api/categories', async () => {
    mockFetch.mockReturnValue(ok([{ id: 1, name: 'Café' }]))
    const cats = await fetchCategories()
    expect(cats[0].name).toBe('Café')
  })
})

describe('createCategory', () => {
  it('calls POST /api/categories', async () => {
    mockFetch.mockReturnValue(ok({ id: 6, name: 'Praia' }))
    const cat = await createCategory('Praia')
    expect(cat.name).toBe('Praia')
  })
})
```

- [ ] **Step 2: Run — all fail (no api.ts yet)**

```bash
cd frontend && npm test
```

Expected: import errors / all fail.

- [ ] **Step 3: Create src/types.ts**

```typescript
export interface Category {
  id: number
  name: string
}

export type PlaceStatus = 'to_go' | 'gone' | 'repeat'

export interface Place {
  id: number
  name: string
  google_place_id: string | null
  lat: number
  lng: number
  status: PlaceStatus
  avg_rating: number | null
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

export interface ReviewCreate {
  reviewer: string
  rating: number
}
```

- [ ] **Step 4: Create src/api.ts**

```typescript
import type { Category, Place, PlaceCreate, PlaceStatus, ReviewCreate } from './types'

const BASE = '/api'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`Request failed: ${url}`)
  return res.json() as Promise<T>
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const fetchPlaces = (): Promise<Place[]> =>
  request(`${BASE}/places`)

export const createPlace = (data: PlaceCreate): Promise<Place> =>
  request(`${BASE}/places`, json('POST', data))

export const updatePlaceStatus = (id: number, status: PlaceStatus): Promise<Place> =>
  request(`${BASE}/places/${id}/status`, json('PATCH', { status }))

export const submitReview = (placeId: number, data: ReviewCreate): Promise<{ avg_rating: number }> =>
  request(`${BASE}/places/${placeId}/reviews`, json('POST', data))

export const fetchCategories = (): Promise<Category[]> =>
  request(`${BASE}/categories`)

export const createCategory = (name: string): Promise<Category> =>
  request(`${BASE}/categories`, json('POST', { name }))
```

- [ ] **Step 5: Run — all pass**

```bash
cd frontend && npm test
```

Expected: 8 PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts frontend/src/api.test.ts
git commit -m "feat(frontend): types and API client with tests"
```

---

## Task 8: Identity system

**Files:**
- Create: `frontend/src/hooks/useIdentity.ts`
- Create: `frontend/src/components/IdentityModal.tsx`
- Create: `frontend/src/hooks/useIdentity.test.ts`
- Create: `frontend/src/components/IdentityModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/hooks/useIdentity.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIdentity } from './useIdentity'

beforeEach(() => localStorage.clear())

describe('useIdentity', () => {
  it('returns null name when localStorage empty', () => {
    const { result } = renderHook(() => useIdentity())
    expect(result.current.name).toBeNull()
  })

  it('returns stored name when present', () => {
    localStorage.setItem('nm_user', 'Fab')
    const { result } = renderHook(() => useIdentity())
    expect(result.current.name).toBe('Fab')
  })

  it('setName stores to localStorage and updates state', () => {
    const { result } = renderHook(() => useIdentity())
    act(() => result.current.setName('Ami'))
    expect(result.current.name).toBe('Ami')
    expect(localStorage.getItem('nm_user')).toBe('Ami')
  })
})
```

Create `frontend/src/components/IdentityModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IdentityModal from './IdentityModal'

describe('IdentityModal', () => {
  it('renders the prompt', () => {
    render(<IdentityModal onSave={vi.fn()} />)
    expect(screen.getByText(/quem é você/i)).toBeInTheDocument()
  })

  it('submit calls onSave with trimmed name', () => {
    const onSave = vi.fn()
    render(<IdentityModal onSave={onSave} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Fab  ' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))
    expect(onSave).toHaveBeenCalledWith('Fab')
  })

  it('does not submit empty name', () => {
    const onSave = vi.fn()
    render(<IdentityModal onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))
    expect(onSave).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — all fail**

```bash
cd frontend && npm test
```

Expected: new tests fail.

- [ ] **Step 3: Create src/hooks/useIdentity.ts**

```typescript
import { useState } from 'react'

const KEY = 'nm_user'

export function useIdentity() {
  const [name, setNameState] = useState<string | null>(
    () => localStorage.getItem(KEY)
  )

  function setName(value: string) {
    localStorage.setItem(KEY, value)
    setNameState(value)
  }

  return { name, setName }
}
```

- [ ] **Step 4: Create src/components/IdentityModal.tsx**

```tsx
import { useState } from 'react'

interface Props {
  onSave: (name: string) => void
}

export default function IdentityModal({ onSave }: Props) {
  const [value, setValue] = useState('')

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSave(trimmed)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(6,11,24,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '32px 28px', minWidth: 320, textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300,
          marginBottom: 8, color: 'var(--text-primary)',
        }}>
          Quem é você?
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
          Seu nome será associado às suas avaliações.
        </p>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Seu nome..."
          autoFocus
          style={{
            width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '9px 12px', fontSize: 14,
            color: 'var(--text-primary)', outline: 'none', marginBottom: 16,
          }}
        />
        <button
          onClick={handleSubmit}
          aria-label="Entrar"
          style={{
            width: '100%', background: 'var(--amber)', color: 'var(--bg-deep)',
            border: 'none', borderRadius: 8, padding: '10px', fontSize: 13,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          Entrar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run — all pass**

```bash
cd frontend && npm test
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useIdentity.ts frontend/src/hooks/useIdentity.test.ts \
        frontend/src/components/IdentityModal.tsx frontend/src/components/IdentityModal.test.tsx
git commit -m "feat(frontend): identity system with localStorage"
```

---

## Task 9: TanStack Query hooks

**Files:**
- Create: `frontend/src/hooks/usePlaces.ts`
- Create: `frontend/src/hooks/useCategories.ts`

These hooks wrap TanStack Query — no separate tests needed as they compose tested `api.ts` functions. Verify via integration in Task 17.

- [ ] **Step 1: Create src/hooks/usePlaces.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPlaces, createPlace, updatePlaceStatus, submitReview } from '../api'
import type { PlaceCreate, PlaceStatus, ReviewCreate } from '../types'

export function usePlaces() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['places'] })

  const query = useQuery({ queryKey: ['places'], queryFn: fetchPlaces })

  const add = useMutation({ mutationFn: createPlace, onSuccess: invalidate })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: PlaceStatus }) =>
      updatePlaceStatus(id, status),
    onSuccess: invalidate,
  })

  const review = useMutation({
    mutationFn: ({ placeId, data }: { placeId: number; data: ReviewCreate }) =>
      submitReview(placeId, data),
    onSuccess: invalidate,
  })

  return { query, add, setStatus, review }
}
```

- [ ] **Step 2: Create src/hooks/useCategories.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCategories, createCategory } from '../api'

export function useCategories() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
  const add = useMutation({
    mutationFn: createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
  return { query, add }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/usePlaces.ts frontend/src/hooks/useCategories.ts
git commit -m "feat(frontend): TanStack Query hooks for places and categories"
```

---

## Task 10: StarRating component

**Files:**
- Create: `frontend/src/components/StarRating.tsx`
- Create: `frontend/src/components/StarRating.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/StarRating.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StarRating from './StarRating'

describe('StarRating', () => {
  it('renders 5 star segments', () => {
    render(<StarRating value={0} onChange={vi.fn()} />)
    // 5 stars × 2 halves = 10 clickable areas
    expect(screen.getAllByRole('button')).toHaveLength(10)
  })

  it('clicking left half of first star fires 0.5', () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button')[0]) // left half of star 1
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('clicking right half of first star fires 1.0', () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button')[1]) // right half of star 1
    expect(onChange).toHaveBeenCalledWith(1.0)
  })

  it('clicking right half of star 4 fires 4.0', () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button')[7]) // star 4 right half
    expect(onChange).toHaveBeenCalledWith(4.0)
  })

  it('clicking right half of star 5 fires 5.0', () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button')[9])
    expect(onChange).toHaveBeenCalledWith(5.0)
  })
})
```

- [ ] **Step 2: Run — fail**

```bash
cd frontend && npm test
```

Expected: StarRating tests fail.

- [ ] **Step 3: Create src/components/StarRating.tsx**

Each star has two `<button>` halves: left = `star - 0.5`, right = `star * 1.0`.

```tsx
interface Props {
  value: number
  onChange: (rating: number) => void
  readOnly?: boolean
}

export default function StarRating({ value, onChange, readOnly = false }: Props) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(star => {
        const filled = value >= star ? 'full' : value >= star - 0.5 ? 'half' : 'empty'
        return (
          <div key={star} style={{ position: 'relative', width: 24, height: 24 }}>
            {/* star SVG background */}
            <svg viewBox="0 0 24 24" width={24} height={24} style={{ position: 'absolute' }}>
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={
                  filled === 'full' ? 'var(--amber)' :
                  filled === 'half' ? 'url(#half)' :
                  'var(--bg-surface)'
                }
                stroke="var(--amber)"
                strokeWidth={1.5}
              />
              <defs>
                <linearGradient id="half">
                  <stop offset="50%" stopColor="var(--amber)" />
                  <stop offset="50%" stopColor="var(--bg-surface)" />
                </linearGradient>
              </defs>
            </svg>
            {/* left half button */}
            <button
              role="button"
              onClick={() => !readOnly && onChange(star - 0.5)}
              style={{
                position: 'absolute', left: 0, top: 0, width: '50%', height: '100%',
                background: 'transparent', border: 'none', cursor: readOnly ? 'default' : 'pointer',
              }}
            />
            {/* right half button */}
            <button
              role="button"
              onClick={() => !readOnly && onChange(star)}
              style={{
                position: 'absolute', right: 0, top: 0, width: '50%', height: '100%',
                background: 'transparent', border: 'none', cursor: readOnly ? 'default' : 'pointer',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run — all pass**

```bash
cd frontend && npm test
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StarRating.tsx frontend/src/components/StarRating.test.tsx
git commit -m "feat(frontend): half-star rating component"
```

---

## Task 11: FilterBar component

**Files:**
- Create: `frontend/src/components/FilterBar.tsx`
- Create: `frontend/src/components/FilterBar.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FilterBar from './FilterBar'
import type { Category } from '../types'

const cats: Category[] = [
  { id: 1, name: 'Café' },
  { id: 2, name: 'Museu' },
]

describe('FilterBar', () => {
  it('renders status chips', () => {
    render(<FilterBar categories={cats} activeStatuses={[]} activeCategories={[]} onStatusToggle={vi.fn()} onCategoryToggle={vi.fn()} />)
    expect(screen.getByText('A ir')).toBeInTheDocument()
    expect(screen.getByText('Repetir')).toBeInTheDocument()
    expect(screen.getByText('Fomos')).toBeInTheDocument()
  })

  it('renders category chips', () => {
    render(<FilterBar categories={cats} activeStatuses={[]} activeCategories={[]} onStatusToggle={vi.fn()} onCategoryToggle={vi.fn()} />)
    expect(screen.getByText('Café')).toBeInTheDocument()
    expect(screen.getByText('Museu')).toBeInTheDocument()
  })

  it('clicking status chip calls onStatusToggle', () => {
    const onStatusToggle = vi.fn()
    render(<FilterBar categories={cats} activeStatuses={[]} activeCategories={[]} onStatusToggle={onStatusToggle} onCategoryToggle={vi.fn()} />)
    fireEvent.click(screen.getByText('A ir'))
    expect(onStatusToggle).toHaveBeenCalledWith('to_go')
  })

  it('clicking category chip calls onCategoryToggle', () => {
    const onCategoryToggle = vi.fn()
    render(<FilterBar categories={cats} activeStatuses={[]} activeCategories={[]} onStatusToggle={vi.fn()} onCategoryToggle={onCategoryToggle} />)
    fireEvent.click(screen.getByText('Café'))
    expect(onCategoryToggle).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Run — fail**

```bash
cd frontend && npm test
```

- [ ] **Step 3: Create src/components/FilterBar.tsx**

```tsx
import type { Category, PlaceStatus } from '../types'

interface Props {
  categories: Category[]
  activeStatuses: PlaceStatus[]
  activeCategories: number[]
  onStatusToggle: (s: PlaceStatus) => void
  onCategoryToggle: (id: number) => void
}

const STATUS_LABELS: Record<PlaceStatus, string> = {
  to_go: 'A ir',
  repeat: 'Repetir',
  gone: 'Fomos',
}

const STATUS_COLORS: Record<PlaceStatus, string> = {
  to_go: 'var(--blue)',
  repeat: 'var(--rose)',
  gone: 'var(--slate)',
}

function Chip({
  label, active, color, onClick,
}: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 20, padding: '4px 11px', fontSize: 11, fontWeight: 500,
        border: active ? `1px solid ${color}` : '1px solid var(--border)',
        background: active ? `${color}22` : 'var(--bg-surface)',
        color: active ? color : 'var(--text-muted)',
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

export default function FilterBar({ categories, activeStatuses, activeCategories, onStatusToggle, onCategoryToggle }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {(['to_go', 'repeat', 'gone'] as PlaceStatus[]).map(s => (
        <Chip
          key={s}
          label={STATUS_LABELS[s]}
          active={activeStatuses.includes(s)}
          color={STATUS_COLORS[s]}
          onClick={() => onStatusToggle(s)}
        />
      ))}
      <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
      {categories.map(cat => (
        <Chip
          key={cat.id}
          label={cat.name}
          active={activeCategories.includes(cat.id)}
          color="var(--amber)"
          onClick={() => onCategoryToggle(cat.id)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run — all pass**

```bash
cd frontend && npm test
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FilterBar.tsx frontend/src/components/FilterBar.test.tsx
git commit -m "feat(frontend): filter bar with status and category chips"
```

---

## Task 12: PlaceItem component + distance sort

**Files:**
- Create: `frontend/src/components/PlaceItem.tsx`
- Create: `frontend/src/components/PlaceItem.test.tsx`
- Create: `frontend/src/utils/distance.ts`
- Create: `frontend/src/utils/distance.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/utils/distance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { distanceDeg, sortByDistance } from './distance'

describe('distanceDeg', () => {
  it('returns 0 for same point', () => {
    expect(distanceDeg({ lat: 38.7, lng: -9.1 }, { lat: 38.7, lng: -9.1 })).toBe(0)
  })
  it('returns positive for different points', () => {
    expect(distanceDeg({ lat: 38.7, lng: -9.1 }, { lat: 38.8, lng: -9.2 })).toBeGreaterThan(0)
  })
})

describe('sortByDistance', () => {
  it('sorts nearest first', () => {
    const center = { lat: 0, lng: 0 }
    const places = [
      { lat: 10, lng: 10 } as any,
      { lat: 1, lng: 1 } as any,
      { lat: 5, lng: 5 } as any,
    ]
    const sorted = sortByDistance(places, center)
    expect(sorted[0].lat).toBe(1)
    expect(sorted[2].lat).toBe(10)
  })
})
```

Create `frontend/src/components/PlaceItem.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlaceItem from './PlaceItem'
import type { Place } from '../types'

const place: Place = {
  id: 1, name: 'Café Porto', google_place_id: null,
  lat: 38.7, lng: -9.1, status: 'repeat',
  avg_rating: 4.5, categories: [{ id: 1, name: 'Café' }],
  created_at: '2026-01-01',
}

describe('PlaceItem', () => {
  it('renders place name', () => {
    render(<PlaceItem place={place} distance={340} selected={false} onClick={vi.fn()} />)
    expect(screen.getByText('Café Porto')).toBeInTheDocument()
  })

  it('renders category', () => {
    render(<PlaceItem place={place} distance={340} selected={false} onClick={vi.fn()} />)
    expect(screen.getByText('Café')).toBeInTheDocument()
  })

  it('renders distance', () => {
    render(<PlaceItem place={place} distance={340} selected={false} onClick={vi.fn()} />)
    expect(screen.getByText(/340m/)).toBeInTheDocument()
  })

  it('renders avg rating', () => {
    render(<PlaceItem place={place} distance={340} selected={false} onClick={vi.fn()} />)
    expect(screen.getByText(/4\.5/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — fail**

```bash
cd frontend && npm test
```

- [ ] **Step 3: Create src/utils/distance.ts**

```typescript
import type { Place } from '../types'

interface LatLng { lat: number; lng: number }

export function distanceDeg(a: LatLng, b: LatLng): number {
  return Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2))
}

export function sortByDistance(places: Place[], center: LatLng): Place[] {
  return [...places].sort(
    (a, b) => distanceDeg(a, center) - distanceDeg(b, center)
  )
}

export function formatDistance(deg: number): string {
  // rough conversion: 1 degree ≈ 111km
  const meters = Math.round(deg * 111_000)
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`
}
```

- [ ] **Step 4: Create src/components/PlaceItem.tsx**

```tsx
import type { Place, PlaceStatus } from '../types'
import { formatDistance, distanceDeg } from '../utils/distance'

interface Props {
  place: Place
  distance: number   // degrees from map center
  selected: boolean
  onClick: () => void
}

const DOT_COLOR: Record<PlaceStatus, string> = {
  to_go:  'var(--blue)',
  repeat: 'var(--rose)',
  gone:   'var(--slate)',
}

export default function PlaceItem({ place, distance, selected, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 11,
        cursor: 'pointer', borderLeft: `2px solid ${selected ? 'var(--blue)' : 'transparent'}`,
        background: selected ? 'var(--bg-selected)' : 'transparent',
        borderBottom: '1px solid var(--border-sub)',
        transition: 'background 0.12s',
      }}
    >
      <div style={{
        width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
        background: DOT_COLOR[place.status],
        border: '2px solid var(--bg-panel)',
        boxShadow: `0 0 8px ${DOT_COLOR[place.status]}66`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {place.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
          {place.categories.map(c => c.name).join(' · ')}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>
          {formatDistance(distance)}
        </div>
      </div>
      <div style={{ fontSize: 11, color: place.avg_rating ? 'var(--amber)' : 'var(--text-dim)', flexShrink: 0, fontWeight: 500 }}>
        {place.avg_rating ? `★ ${place.avg_rating.toFixed(1)}` : '—'}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run — all pass**

```bash
cd frontend && npm test
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/ frontend/src/components/PlaceItem.tsx frontend/src/components/PlaceItem.test.tsx
git commit -m "feat(frontend): place item, distance sort util"
```

---

## Task 13: PlaceDetail panel (status toggle + review)

**Files:**
- Create: `frontend/src/components/PlaceDetail.tsx`
- Create: `frontend/src/components/PlaceDetail.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlaceDetail from './PlaceDetail'
import type { Place } from '../types'

const place: Place = {
  id: 1, name: 'Restaurante Italia', google_place_id: null,
  lat: 38.7, lng: -9.1, status: 'to_go',
  avg_rating: 4.5, categories: [{ id: 1, name: 'Restaurante' }],
  created_at: '2026-01-01',
}

describe('PlaceDetail', () => {
  it('renders place name', () => {
    render(<PlaceDetail place={place} onStatusChange={vi.fn()} onReview={vi.fn()} />)
    expect(screen.getByText('Restaurante Italia')).toBeInTheDocument()
  })

  it('renders all 3 status buttons', () => {
    render(<PlaceDetail place={place} onStatusChange={vi.fn()} onReview={vi.fn()} />)
    expect(screen.getByRole('button', { name: /a ir/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fomos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /repetir/i })).toBeInTheDocument()
  })

  it('clicking "Fomos" calls onStatusChange with "gone"', () => {
    const onStatusChange = vi.fn()
    render(<PlaceDetail place={place} onStatusChange={onStatusChange} onReview={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /fomos/i }))
    expect(onStatusChange).toHaveBeenCalledWith('gone')
  })

  it('shows avaliar button', () => {
    render(<PlaceDetail place={place} onStatusChange={vi.fn()} onReview={vi.fn()} />)
    expect(screen.getByRole('button', { name: /avaliar/i })).toBeInTheDocument()
  })

  it('clicking avaliar shows star rating', () => {
    render(<PlaceDetail place={place} onStatusChange={vi.fn()} onReview={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /avaliar/i }))
    // StarRating renders 10 buttons (5 stars × 2 halves)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(3)
  })
})
```

- [ ] **Step 2: Run — fail**

```bash
cd frontend && npm test
```

- [ ] **Step 3: Create src/components/PlaceDetail.tsx**

```tsx
import { useState } from 'react'
import type { Place, PlaceStatus } from '../types'
import StarRating from './StarRating'

interface Props {
  place: Place
  onStatusChange: (status: PlaceStatus) => void
  onReview: (rating: number) => void
}

const STATUS: { value: PlaceStatus; label: string; color: string; bg: string }[] = [
  { value: 'to_go',  label: 'A ir',   color: 'var(--blue)', bg: 'var(--blue-dim)' },
  { value: 'gone',   label: 'Fomos',  color: 'var(--text-muted)', bg: 'var(--bg-surface)' },
  { value: 'repeat', label: 'Repetir ❤', color: 'var(--rose)', bg: 'var(--rose-dim)' },
]

export default function PlaceDetail({ place, onStatusChange, onReview }: Props) {
  const [rating, setRating] = useState<number>(0)
  const [showRating, setShowRating] = useState(false)

  function submitRating() {
    if (rating === 0) return
    onReview(rating)
    setShowRating(false)
    setRating(0)
  }

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 3 }}>
        {place.name}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: place.avg_rating ? 4 : 12 }}>
        {place.categories.map(c => c.name).join(' · ')}
      </div>
      {place.avg_rating !== null && (
        <div style={{ fontSize: 14, color: 'var(--amber)', marginBottom: 12 }}>
          ★ {place.avg_rating.toFixed(1)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {STATUS.map(s => (
          <button
            key={s.value}
            aria-label={s.label}
            onClick={() => onStatusChange(s.value)}
            style={{
              borderRadius: 20, padding: '4px 11px', fontSize: 11, fontWeight: 600,
              border: place.status === s.value ? `1px solid ${s.color}` : '1px solid var(--border)',
              background: place.status === s.value ? s.bg : 'transparent',
              color: place.status === s.value ? s.color : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!showRating ? (
        <button
          aria-label="Avaliar"
          onClick={() => setShowRating(true)}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--amber)',
            cursor: 'pointer',
          }}
        >
          ★ Avaliar
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StarRating value={rating} onChange={setRating} />
          <button
            onClick={submitRating}
            disabled={rating === 0}
            style={{
              background: 'var(--amber)', color: 'var(--bg-deep)', border: 'none',
              borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Salvar
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run — all pass**

```bash
cd frontend && npm test
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PlaceDetail.tsx frontend/src/components/PlaceDetail.test.tsx
git commit -m "feat(frontend): place detail with status toggle and star rating"
```

---

## Task 14: AddPlaceModal

**Files:**
- Create: `frontend/src/components/AddPlaceModal.tsx`

No unit tests — Google Places autocomplete (`useMapsLibrary`) requires a real Maps API context. Verify manually in Task 17.

- [ ] **Step 1: Create src/components/AddPlaceModal.tsx**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import type { Category, PlaceCreate } from '../types'

interface Props {
  categories: Category[]
  onSave: (data: PlaceCreate) => void
  onClose: () => void
  onNewCategory: (name: string) => Promise<Category>
}

interface SelectedPlace {
  name: string
  google_place_id: string | null
  lat: number
  lng: number
}

export default function AddPlaceModal({ categories, onSave, onClose, onNewCategory }: Props) {
  const placesLib = useMapsLibrary('places')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<SelectedPlace | null>(null)
  const [chosenCatIds, setChosenCatIds] = useState<number[]>([])
  const [newCatName, setNewCatName] = useState('')

  useEffect(() => {
    if (!placesLib || !inputRef.current) return
    const ac = new placesLib.Autocomplete(inputRef.current, {
      fields: ['place_id', 'geometry', 'name'],
    })
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (place.geometry?.location) {
        setSelected({
          name: place.name ?? '',
          google_place_id: place.place_id ?? null,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        })
      }
    })
    return () => google.maps.event.removeListener(listener)
  }, [placesLib])

  function toggleCat(id: number) {
    setChosenCatIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function addCustomCategory() {
    const name = newCatName.trim()
    if (!name) return
    const cat = await onNewCategory(name)
    setChosenCatIds(prev => [...prev, cat.id])
    setNewCatName('')
  }

  function handleSave() {
    if (!selected) return
    onSave({ ...selected, category_ids: chosenCatIds })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(6,11,24,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '24px 22px', width: 380, maxWidth: '95vw',
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 20, marginBottom: 18, color: 'var(--text-primary)' }}>
          Adicionar lugar
        </h2>

        <label style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
          Buscar lugar
        </label>
        <input
          ref={inputRef}
          placeholder="Nome do lugar..."
          style={{
            width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)',
            outline: 'none', marginBottom: selected ? 8 : 18,
          }}
        />
        {selected && (
          <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 16 }}>
            ✓ {selected.name}
          </div>
        )}

        <label style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
          Categorias
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => toggleCat(cat.id)}
              style={{
                borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500,
                border: chosenCatIds.includes(cat.id) ? '1px solid var(--amber)' : '1px solid var(--border)',
                background: chosenCatIds.includes(cat.id) ? 'var(--amber-glow)' : 'var(--bg-surface)',
                color: chosenCatIds.includes(cat.id) ? 'var(--amber)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomCategory()}
            placeholder="Nova categoria..."
            style={{
              flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <button
            onClick={addCustomCategory}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--amber)', cursor: 'pointer',
            }}
          >
            +
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '9px', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!selected}
            style={{
              flex: 1, background: selected ? 'var(--amber)' : 'var(--bg-surface)',
              border: 'none', borderRadius: 8, padding: '9px', fontSize: 13,
              fontWeight: 600, color: selected ? 'var(--bg-deep)' : 'var(--text-dim)',
              cursor: selected ? 'pointer' : 'default',
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AddPlaceModal.tsx
git commit -m "feat(frontend): add place modal with Google Places autocomplete"
```

---

## Task 15: MapView + ListPanel + BottomSheet

**Files:**
- Create: `frontend/src/components/MapView.tsx`
- Create: `frontend/src/components/ListPanel.tsx`
- Create: `frontend/src/components/BottomSheet.tsx`

These are visual compositions — verify in Task 17 via dev server.

- [ ] **Step 1: Create src/components/MapView.tsx**

```tsx
import { useState, useCallback } from 'react'
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps'
import type { Place, PlaceStatus } from '../types'
import PlaceDetail from './PlaceDetail'

interface Props {
  places: Place[]
  onMapCenterChange: (center: { lat: number; lng: number }) => void
  onStatusChange: (id: number, status: PlaceStatus) => void
  onReview: (placeId: number, rating: number) => void
}

const DOT_COLOR: Record<PlaceStatus, string> = {
  to_go:  '#4a9eff',
  repeat: '#ff6b9d',
  gone:   '#3d4a5c',
}

const MAP_STYLE = [
  { elementType: 'geometry',   stylers: [{ color: '#0a1020' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a5a72' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#06091a' }] },
  { featureType: 'road',       elementType: 'geometry', stylers: [{ color: '#0f1e38' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#152847' }] },
  { featureType: 'water',      elementType: 'geometry', stylers: [{ color: '#060d20' }] },
  { featureType: 'poi',        stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',    stylers: [{ visibility: 'off' }] },
]

export default function MapView({ places, onMapCenterChange, onStatusChange, onReview }: Props) {
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)

  // Get user location on mount
  useState(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserPos({ lat: 38.7169, lng: -9.1395 }) // fallback: Lisbon
    )
  })

  if (!userPos) return <div style={{ height: '100%', background: '#0a1020' }} />

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <Map
        defaultCenter={userPos}
        defaultZoom={14}
        mapId="nosso-mapa"
        styles={MAP_STYLE as any}
        gestureHandling="greedy"
        disableDefaultUI
        onCameraChanged={ev => onMapCenterChange(ev.detail.center)}
        onClick={() => setSelectedPlace(null)}
        style={{ width: '100%', height: '100%' }}
      >
        {/* User location dot */}
        <AdvancedMarker position={userPos}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%', background: '#4a9eff',
            border: '3px solid #060b18',
            boxShadow: '0 0 0 8px rgba(74,158,255,0.12)',
            animation: 'locPulse 2.5s ease-in-out infinite',
          }} />
        </AdvancedMarker>

        {/* Place markers */}
        {places.map(place => (
          <AdvancedMarker
            key={place.id}
            position={{ lat: place.lat, lng: place.lng }}
            onClick={() => setSelectedPlace(place)}
          >
            <div style={{
              width: place === selectedPlace ? 18 : 14,
              height: place === selectedPlace ? 18 : 14,
              borderRadius: '50%',
              background: DOT_COLOR[place.status],
              border: '2.5px solid #060b18',
              boxShadow: `0 0 ${place === selectedPlace ? 12 : 6}px ${DOT_COLOR[place.status]}88`,
              transition: 'all 0.15s',
              cursor: 'pointer',
            }} />
          </AdvancedMarker>
        ))}
      </Map>

      {/* Info card */}
      {selectedPlace && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 12, minWidth: 260, maxWidth: 320,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)', zIndex: 10,
          animation: 'cardIn 0.2s ease',
        }}>
          <PlaceDetail
            place={selectedPlace}
            onStatusChange={status => onStatusChange(selectedPlace.id, status)}
            onReview={rating => onReview(selectedPlace.id, rating)}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create src/components/ListPanel.tsx**

```tsx
import { useState } from 'react'
import type { Place, Category, PlaceStatus } from '../types'
import { sortByDistance, distanceDeg } from '../utils/distance'
import PlaceItem from './PlaceItem'
import FilterBar from './FilterBar'

interface Props {
  places: Place[]
  categories: Category[]
  mapCenter: { lat: number; lng: number }
  selectedId: number | null
  onSelect: (place: Place) => void
  onAdd: () => void
  userName: string
  onUserClick: () => void
}

export default function ListPanel({ places, categories, mapCenter, selectedId, onSelect, onAdd, userName, onUserClick }: Props) {
  const [activeStatuses, setActiveStatuses] = useState<PlaceStatus[]>([])
  const [activeCats, setActiveCats] = useState<number[]>([])

  function toggleStatus(s: PlaceStatus) {
    setActiveStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function toggleCat(id: number) {
    setActiveCats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  let filtered = places
  if (activeStatuses.length) filtered = filtered.filter(p => activeStatuses.includes(p.status))
  if (activeCats.length) filtered = filtered.filter(p => p.categories.some(c => activeCats.includes(c.id)))
  const sorted = sortByDistance(filtered, mapCenter)

  return (
    <div style={{
      width: 310, flexShrink: 0, background: 'var(--bg-panel)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border-sub)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--text-primary)' }}>
            Nosso <em style={{ color: 'var(--amber)', fontStyle: 'italic' }}>Mapa</em>
          </h1>
          <button
            onClick={onUserClick}
            style={{
              background: 'var(--amber-glow)', border: '1px solid var(--amber-dim)',
              color: 'var(--amber)', borderRadius: 20, padding: '3px 10px',
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {userName} ▾
          </button>
        </div>
        <FilterBar
          categories={categories}
          activeStatuses={activeStatuses}
          activeCategories={activeCats}
          onStatusToggle={toggleStatus}
          onCategoryToggle={toggleCat}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.map(place => (
          <PlaceItem
            key={place.id}
            place={place}
            distance={distanceDeg(place, mapCenter)}
            selected={place.id === selectedId}
            onClick={() => onSelect(place)}
          />
        ))}
        {sorted.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            Nenhum lugar encontrado.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border-sub)' }}>
        <button
          onClick={onAdd}
          style={{
            width: '100%', background: 'var(--amber)', color: 'var(--bg-deep)',
            border: 'none', borderRadius: 8, padding: '9px', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
            boxShadow: '0 4px 20px rgba(240,180,41,0.2)',
          }}
        >
          + Adicionar lugar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create src/components/BottomSheet.tsx**

```tsx
import type { Place, Category, PlaceStatus } from '../types'
import { sortByDistance, distanceDeg } from '../utils/distance'
import PlaceItem from './PlaceItem'
import FilterBar from './FilterBar'
import { useState } from 'react'

interface Props {
  places: Place[]
  categories: Category[]
  mapCenter: { lat: number; lng: number }
  selectedId: number | null
  onSelect: (place: Place) => void
}

export default function BottomSheet({ places, categories, mapCenter, selectedId, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [activeStatuses, setActiveStatuses] = useState<PlaceStatus[]>([])
  const [activeCats, setActiveCats] = useState<number[]>([])

  function toggleStatus(s: PlaceStatus) {
    setActiveStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function toggleCat(id: number) {
    setActiveCats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  let filtered = places
  if (activeStatuses.length) filtered = filtered.filter(p => activeStatuses.includes(p.status))
  if (activeCats.length) filtered = filtered.filter(p => p.categories.some(c => activeCats.includes(c.id)))
  const sorted = sortByDistance(filtered, mapCenter)

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'var(--bg-panel)', borderRadius: '20px 20px 0 0',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
      height: expanded ? '65%' : 160,
      transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
      zIndex: 10, display: 'flex', flexDirection: 'column',
    }}>
      {/* Pull handle */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '10px 0 6px', cursor: 'pointer', flexShrink: 0 }}
      >
        <div style={{ width: 32, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto' }} />
      </div>

      {/* Filter bar (visible when expanded) */}
      {expanded && (
        <div style={{ padding: '0 14px 10px', borderBottom: '1px solid var(--border-sub)', flexShrink: 0 }}>
          <FilterBar
            categories={categories}
            activeStatuses={activeStatuses}
            activeCategories={activeCats}
            onStatusToggle={toggleStatus}
            onCategoryToggle={toggleCat}
          />
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '0 14px 6px', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          Perto do centro ↕
        </div>
        {sorted.map(place => (
          <PlaceItem
            key={place.id}
            place={place}
            distance={distanceDeg(place, mapCenter)}
            selected={place.id === selectedId}
            onClick={() => onSelect(place)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MapView.tsx frontend/src/components/ListPanel.tsx frontend/src/components/BottomSheet.tsx
git commit -m "feat(frontend): map view, list panel, mobile bottom sheet"
```

---

## Task 16: App.tsx — responsive layout wiring

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace App.tsx with full wiring**

```tsx
import { useState, useCallback } from 'react'
import { useIdentity } from './hooks/useIdentity'
import { usePlaces } from './hooks/usePlaces'
import { useCategories } from './hooks/useCategories'
import IdentityModal from './components/IdentityModal'
import MapView from './components/MapView'
import ListPanel from './components/ListPanel'
import BottomSheet from './components/BottomSheet'
import AddPlaceModal from './components/AddPlaceModal'
import PlaceDetail from './components/PlaceDetail'
import type { Place, PlaceStatus } from './types'

const DEFAULT_CENTER = { lat: 38.7169, lng: -9.1395 }

export default function App() {
  const { name, setName } = useIdentity()
  const { query: placesQ, add, setStatus, review } = usePlaces()
  const { query: catsQ, add: addCat } = useCategories()

  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showIdentity, setShowIdentity] = useState(false)

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
  const places = placesQ.data ?? []
  const categories = catsQ.data ?? []

  function handleStatusChange(id: number, status: PlaceStatus) {
    setStatus.mutate({ id, status })
    setSelectedPlace(prev => prev?.id === id ? { ...prev, status } : prev)
  }

  function handleReview(placeId: number, rating: number) {
    if (!name) return
    review.mutate({ placeId, data: { reviewer: name, rating } })
  }

  if (!name && !showIdentity) {
    return <IdentityModal onSave={setName} />
  }

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>

      {/* Desktop: list panel left */}
      {isDesktop && (
        <ListPanel
          places={places}
          categories={categories}
          mapCenter={mapCenter}
          selectedId={selectedPlace?.id ?? null}
          onSelect={setSelectedPlace}
          onAdd={() => setShowAdd(true)}
          userName={name ?? ''}
          onUserClick={() => setShowIdentity(true)}
        />
      )}

      {/* Map — always visible */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Mobile: top bar */}
        {!isDesktop && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
            background: 'rgba(11,17,32,0.9)', backdropFilter: 'blur(8px)',
            borderBottom: '1px solid var(--border)',
            padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 300, color: 'var(--text-primary)' }}>
              Nosso <em style={{ color: 'var(--amber)' }}>Mapa</em>
            </span>
            <button
              onClick={() => setShowIdentity(true)}
              style={{ background: 'var(--amber-glow)', border: '1px solid var(--amber-dim)', color: 'var(--amber)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
            >
              {name} ▾
            </button>
          </div>
        )}

        <MapView
          places={places}
          onMapCenterChange={setMapCenter}
          onStatusChange={handleStatusChange}
          onReview={handleReview}
        />

        {/* Mobile: FAB */}
        {!isDesktop && (
          <button
            onClick={() => setShowAdd(true)}
            style={{
              position: 'absolute', bottom: 175, right: 16, zIndex: 6,
              width: 50, height: 50, borderRadius: '50%',
              background: 'var(--amber)', color: 'var(--bg-deep)',
              border: 'none', fontSize: 26, fontWeight: 300, cursor: 'pointer',
              boxShadow: '0 6px 24px rgba(240,180,41,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            +
          </button>
        )}

        {/* Mobile: bottom sheet */}
        {!isDesktop && (
          <BottomSheet
            places={places}
            categories={categories}
            mapCenter={mapCenter}
            selectedId={selectedPlace?.id ?? null}
            onSelect={setSelectedPlace}
          />
        )}

        {/* Mobile: place detail overlay */}
        {!isDesktop && selectedPlace && (
          <div style={{
            position: 'absolute', bottom: 165, left: 12, right: 12, zIndex: 11,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}>
            <PlaceDetail
              place={selectedPlace}
              onStatusChange={status => handleStatusChange(selectedPlace.id, status)}
              onReview={rating => handleReview(selectedPlace.id, rating)}
            />
          </div>
        )}
      </div>

      {/* Add place modal */}
      {showAdd && (
        <AddPlaceModal
          categories={categories}
          onSave={data => add.mutate(data)}
          onClose={() => setShowAdd(false)}
          onNewCategory={async (name) => {
            const result = await addCat.mutateAsync(name)
            return result
          }}
        />
      )}

      {/* Re-identify */}
      {showIdentity && (
        <IdentityModal onSave={newName => { setName(newName); setShowIdentity(false) }} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add CSS animation keyframes to index.css**

Append to `frontend/src/styles/index.css`:

```css
@keyframes locPulse {
  0%, 100% { box-shadow: 0 0 0 6px rgba(74,158,255,0.12); }
  50%       { box-shadow: 0 0 0 12px rgba(74,158,255,0.04); }
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

- [ ] **Step 3: Smoke test in browser**

Start backend first:

```bash
cd backend && pip install -r requirements.txt && uvicorn app.main:app --port 2000 --reload
```

In another terminal:

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Verify:
- [ ] Identity modal appears, name saves to localStorage.
- [ ] Map renders centered on user location.
- [ ] "Adicionar lugar" opens modal, Google Places autocomplete works.
- [ ] Adding a place shows a dot on the map and row in list.
- [ ] Clicking dot opens detail, status toggle + rating work.
- [ ] Resizing to <768px switches to mobile layout (bottom sheet appears, FAB visible).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/styles/index.css
git commit -m "feat(frontend): responsive app layout wiring"
```

---

## Task 17: Run all tests

- [ ] **Step 1: Backend full test suite**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: 13 PASS, 0 FAIL.

- [ ] **Step 2: Frontend full test suite**

```bash
cd frontend && npm test
```

Expected: all PASS.

- [ ] **Step 3: Fix any failures before proceeding**

---

## Task 18: Docker — nginx, Dockerfiles, finalize compose

**Files:**
- Create: `frontend/nginx.conf`
- Finalize: `frontend/Dockerfile`
- Finalize: `docker-compose.yml`

- [ ] **Step 1: Create frontend/nginx.conf**

```nginx
server {
    listen 80;

    location / {
        root   /usr/share/nginx/html;
        index  index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://backend:2000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
```

- [ ] **Step 2: Create frontend/Dockerfile**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Verify docker-compose.yml is complete** (from Task 1 — should already be correct)

The compose file from Task 1 is final. No changes needed.

- [ ] **Step 4: Build and run with Docker Compose**

```bash
docker compose build
docker compose up
```

Expected: `http://localhost:1996` serves the app. `http://localhost:2000/api/categories` returns seeded categories.

- [ ] **Step 5: Verify full flow in Docker**

Open `http://localhost:1996` in browser. Repeat the smoke test checks from Task 16 Step 3.

- [ ] **Step 6: Stop containers and commit**

```bash
docker compose down
git add frontend/nginx.conf frontend/Dockerfile docker-compose.yml
git commit -m "feat: Docker setup — nginx proxy, multi-stage build, compose stack"
```

---

## Task 19: Deploy to Portainer

- [ ] **Step 1: Build production images**

On the homelab or via CI, run:

```bash
docker compose build
```

Or tag and push to a local registry if Portainer pulls from one. If Portainer has direct access to the repo, skip image registry — use stack deploy with `build:` config.

- [ ] **Step 2: Create Portainer stack**

In Portainer → Stacks → Add Stack:
- Name: `nosso-mapa`
- Paste contents of `docker-compose.yml`
- Deploy the stack

- [ ] **Step 3: Verify**

Open `http://<homelab-ip>:1996` — app loads, API calls work (`/api/categories` responds).

- [ ] **Step 4: Add .gitignore entry for .env.local reminder**

Confirm `frontend/.env.local` is in `.gitignore` — the Google Maps key must never be committed.

---

## Done

All tasks complete when:
- [ ] `python -m pytest tests/ -v` → all green
- [ ] `npm test` → all green  
- [ ] App works end-to-end in Docker at `localhost:1996`
- [ ] Deployed and accessible on homelab Portainer
