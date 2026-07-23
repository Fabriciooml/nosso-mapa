# Nosso Mapa

Private map app for tracking places to visit, places we've been, and places worth repeating. No auth — a localStorage name picker identifies the reviewer.

![meme](docs/assets/pernalonga_comunista.webp)

## Stack

- **Frontend**: React + Vite + TanStack Query, Google Maps via `@vis.gl/react-google-maps`
- **Backend**: FastAPI + raw `sqlite3`
- **Deploy**: Docker Compose (frontend nginx `:1996` → backend `:2000`)

## Dev

```bash
cd frontend && npm run dev   # :1996, proxies /api -> :2000
```

Backend runs via Docker (see below) or directly with `uvicorn` from `backend/` with venv active.

## Deploy

Homelab deployment via Docker Compose behind Portainer.

```bash
docker compose up -d
```

- Frontend (nginx) serves on `:1996`, depends on backend healthcheck.
- Backend (FastAPI) serves on `:2000`.
- SQLite DB persists on a named volume mounted at `/app/data` in the backend container.

Configurable at build time via env vars: `VITE_APP_NAME`, `VITE_DEFAULT_CENTER_LAT`, `VITE_DEFAULT_CENTER_LNG`, `VITE_GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACES_API_KEY`.

See [CLAUDE.md](CLAUDE.md) for full dev commands, architecture, and conventions.
