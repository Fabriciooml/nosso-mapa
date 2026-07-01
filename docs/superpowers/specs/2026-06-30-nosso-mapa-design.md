# Nosso Mapa — Design Spec

**Date:** 2026-06-30  
**Status:** Approved

---

## Overview

Private interactive map app for 2 users (a couple) to track places they want to visit, have visited, and want to repeat. Portuguese UI.

---

## Users & Identity

- No authentication system.
- On first load, modal asks "Quem é você?" — user types their name, stored in `localStorage`.
- Name shown in top-right corner; clickable to change.
- Reviews record the reviewer's name from `localStorage`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) |
| Backend | Python — FastAPI + Uvicorn |
| Database | SQLite (file on Docker volume) |
| Map | Google Maps API |
| Deployment | Docker Compose stack in Portainer (homelab Proxmox) |

**Ports:** Frontend `1996`, Backend `2000`.

**Docker Compose services:**
- `frontend` — nginx:alpine serving React build
- `backend` — python:slim running FastAPI + uvicorn, SQLite volume mounted

---

## Data Model

### `categories`
Seeded: `Restaurante`, `Café`, `Museu`, `Cinema`, `Lanche`.  
Appended when a new custom category is created during place addition.

```
id        INTEGER PRIMARY KEY
name      TEXT UNIQUE NOT NULL
```

### `places`
```
id               INTEGER PRIMARY KEY
name             TEXT NOT NULL
google_place_id  TEXT
lat              REAL NOT NULL
lng              REAL NOT NULL
status           TEXT DEFAULT 'to_go'   -- 'to_go' | 'gone' | 'repeat'
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

### `place_categories` (join table)
```
place_id     INTEGER REFERENCES places(id)
category_id  INTEGER REFERENCES categories(id)
PRIMARY KEY (place_id, category_id)
```

### `reviews`
```
id          INTEGER PRIMARY KEY
place_id    INTEGER REFERENCES places(id)
reviewer    TEXT NOT NULL          -- localStorage name
rating      REAL NOT NULL          -- 0.5 increments, 1.0–5.0
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

Average rating is computed on read (`AVG(rating)`), not stored.  
Rating validation: `1.0 ≤ rating ≤ 5.0` and `rating % 0.5 == 0`.

---

## API Endpoints

```
GET    /api/places                → list all places (with avg_rating, categories, status)
POST   /api/places                → add place { name, google_place_id, lat, lng, category_ids[] }
PATCH  /api/places/{id}/status    → update status { status: 'to_go'|'gone'|'repeat' }
POST   /api/places/{id}/reviews   → submit review { reviewer, rating }

GET    /api/categories            → list all categories
POST   /api/categories            → create category { name }
```

No delete endpoints — places are permanent history.

---

## Layout

### Desktop (≥768px)
- **Left panel (310px):** Place list sorted by distance from current map center.
  - App wordmark top-left, user name chip top-right.
  - Search input + category/status filter chips.
  - Each row: colored dot (status), place name, categories, distance, avg rating.
  - "Adicionar lugar" button at panel bottom.
- **Right:** Full-screen Google Map.
  - Colored dots per status; clicking dot highlights list row + opens info card on map.
  - Legend (top-right corner).
  - User location pulse dot (blue).

### Mobile (<768px)
- Full-screen Google Map.
- Filter bar floats at top (pill shape, backdrop blur).
- Amber FAB (bottom-right) opens Add Place modal.
- Drag-up bottom sheet shows same sorted place list.
- Tapping map dot or sheet row opens place detail bottom sheet (expanded).

---

## Place Addition Flow

1. User clicks "Adicionar lugar" (desktop) or FAB (mobile).
2. Modal opens with Google Places autocomplete input.
3. User searches and selects a place → name, `google_place_id`, `lat`, `lng` auto-populated.
4. Multi-select category picker: predefined list + free-type to create new category.
5. Save → `POST /api/places` → marker appears on map.

---

## Place Detail

Clicking a map marker or list row shows:
- Name (Fraunces font), categories, avg rating (stars).
- Status toggle buttons: `📍 A ir` / `✓ Fomos` / `❤ Repetir`.
- "Avaliar" button → half-star rating input (1.0–5.0, 0.5 steps) → `POST /api/places/{id}/reviews`.

---

## Map Markers

Colored dots (not teardrop pins):

| Status | Color |
|---|---|
| A ir (to go) | Blue `#4a9eff` |
| Repetir (gone, want repeat) | Rose `#ff6b9d` |
| Fomos (gone) | Slate `#3d4a5c` |

Default status on creation: `to_go`.  
List sorted by Euclidean distance from map viewport center (re-sorted on map pan/zoom).

---

## Design System — "Carta Negra"

**Aesthetic:** Dark cartography meets intimate travel journal. Warm amber accent, deep navy base.

### Typography
- **Display / Wordmark:** Fraunces (serif, optical, weight 300–400)
- **UI:** IBM Plex Sans (sans, weight 300–600)

### Color Palette

| Token | Value | Use |
|---|---|---|
| `--bg-deep` | `#060b18` | Deepest background |
| `--bg-panel` | `#0b1120` | List panel, modals |
| `--bg-surface` | `#111827` | Cards, inputs |
| `--bg-hover` | `#151f30` | Hover states |
| `--bg-selected` | `#0d1f3c` | Active list row |
| `--border` | `#1a2640` | Panel borders |
| `--text-primary` | `#e8edf5` | Main text |
| `--text-muted` | `#4a5a72` | Secondary text |
| `--amber` | `#f0b429` | Primary accent (FAB, wordmark, chips) |
| `--blue` | `#4a9eff` | "A ir" dot + user location |
| `--rose` | `#ff6b9d` | "Repetir" dot |
| `--slate` | `#3d4a5c` | "Fomos" dot |

### Motion
- Place list items: staggered `fadeUp` animation on load (50ms delay per item).
- User location dot: CSS `locPulse` animation (box-shadow expand/contract, 2.5s).
- Map info card: `cardIn` scale+fade on appear.
- FAB: scale on hover.

---

## Docker Compose Structure

```yaml
services:
  frontend:
    build: ./frontend
    ports: ["1996:80"]

  backend:
    build: ./backend
    ports: ["2000:8000"]
    volumes:
      - db-data:/app/data

volumes:
  db-data:
```

Frontend `nginx.conf` proxies `/api/*` to `backend:8000`.

---

## Out of Scope

- Authentication / user accounts
- Push notifications
- Offline / PWA mode
- Place deletion
- Social sharing
- Multiple maps / lists
