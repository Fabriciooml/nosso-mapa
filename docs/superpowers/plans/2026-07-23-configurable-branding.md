# Configurable App Name & Default Map Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app's display name and default map center configurable via Docker build-time env vars, instead of hardcoded to "Nosso Mapa" / Belo Horizonte, so the same codebase serves other deployments.

**Architecture:** A single new module, `frontend/src/config.ts`, reads `import.meta.env.VITE_*` values with `||` fallbacks to today's hardcoded defaults. It's the only place a default is declared. `App.tsx`, `ListPanel.tsx`, and `main.tsx` import from it instead of hardcoding values. The three env vars flow through `docker-compose.yml` (raw passthrough, no default) → `frontend/Dockerfile` (`ARG`/`ENV`) → Vite build.

**Tech Stack:** Vite (`import.meta.env`), Vitest (`vi.stubEnv`, `vi.resetModules`), React, Docker.

---

### Task 1: `config.ts` module

**Files:**
- Create: `frontend/src/config.ts`
- Test: `frontend/src/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/config.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('falls back to Nosso Mapa / BH defaults when env vars are unset', async () => {
    const { APP_NAME, DEFAULT_CENTER } = await import('./config')
    expect(APP_NAME).toBe('Nosso Mapa')
    expect(DEFAULT_CENTER).toEqual({ lat: -19.9186, lng: -43.9388 })
  })

  it('uses VITE_APP_NAME when set', async () => {
    vi.stubEnv('VITE_APP_NAME', 'Mapa da Família')
    const { APP_NAME } = await import('./config')
    expect(APP_NAME).toBe('Mapa da Família')
  })

  it('uses VITE_DEFAULT_CENTER_LAT/LNG when set', async () => {
    vi.stubEnv('VITE_DEFAULT_CENTER_LAT', '10.5')
    vi.stubEnv('VITE_DEFAULT_CENTER_LNG', '-20.25')
    const { DEFAULT_CENTER } = await import('./config')
    expect(DEFAULT_CENTER).toEqual({ lat: 10.5, lng: -20.25 })
  })

  it('falls back to defaults when env vars are blank strings', async () => {
    vi.stubEnv('VITE_APP_NAME', '')
    vi.stubEnv('VITE_DEFAULT_CENTER_LAT', '')
    vi.stubEnv('VITE_DEFAULT_CENTER_LNG', '')
    const { APP_NAME, DEFAULT_CENTER } = await import('./config')
    expect(APP_NAME).toBe('Nosso Mapa')
    expect(DEFAULT_CENTER).toEqual({ lat: -19.9186, lng: -43.9388 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/config.test.ts -v`
Expected: FAIL — `Failed to resolve import "./config"` (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/config.ts
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Nosso Mapa'

export const DEFAULT_CENTER = {
  lat: Number(import.meta.env.VITE_DEFAULT_CENTER_LAT) || -19.9186,
  lng: Number(import.meta.env.VITE_DEFAULT_CENTER_LNG) || -43.9388,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/config.test.ts -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/config.ts frontend/src/config.test.ts
git commit -m "feat(frontend): add config module for app name and default map center"
```

---

### Task 2: Wire `DEFAULT_CENTER` into `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx:18` (remove local const), `frontend/src/App.tsx:1-16` (add import)

- [ ] **Step 1: Replace the hardcoded const with an import**

In `frontend/src/App.tsx`, remove this line:

```ts
const DEFAULT_CENTER = { lat: -19.9186, lng: -43.9388 } // Praça Sete de Setembro, BH
```

Add this import near the top, alongside the other relative imports (after `import { visiblePlaces } from './utils/visiblePlaces'`):

```ts
import { DEFAULT_CENTER } from './config'
```

The rest of `App.tsx` (state initializers `useState(DEFAULT_CENTER.lat)`, `useState(DEFAULT_CENTER.lng)`, and the `defaultCenter={DEFAULT_CENTER}` props passed to `MapView`) needs no changes — same identifier, now imported instead of declared locally.

- [ ] **Step 2: Run existing App tests to verify nothing broke**

Run: `cd frontend && npx vitest run src/App.test.tsx -v`
Expected: PASS (3 tests, unchanged — they don't assert on map center)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "refactor(frontend): source default map center from config module"
```

---

### Task 3: Wire `APP_NAME` into `ListPanel.tsx` wordmark

**Files:**
- Modify: `frontend/src/components/ListPanel.tsx:1-7` (add import), `frontend/src/components/ListPanel.tsx:68` (use variable)

- [ ] **Step 1: Add the import and use it in the wordmark**

In `frontend/src/components/ListPanel.tsx`, add this import after the existing `import styles from './ListPanel.module.css'` line:

```ts
import { APP_NAME } from '../config'
```

Change line 68 from:

```tsx
<span className={styles.wordmark}>Nosso Mapa</span>
```

to:

```tsx
<span className={styles.wordmark}>{APP_NAME}</span>
```

- [ ] **Step 2: Run existing ListPanel tests to verify nothing broke**

Run: `cd frontend && npx vitest run src/components/ListPanel.test.tsx -v`
Expected: PASS (10 tests) — the `'renders wordmark'` test still matches because `APP_NAME` defaults to `'Nosso Mapa'`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ListPanel.tsx
git commit -m "refactor(frontend): source wordmark text from config module"
```

---

### Task 4: Set `document.title` from config, static fallback in `index.html`

**Files:**
- Modify: `frontend/src/main.tsx`, `frontend/index.html:6`

- [ ] **Step 1: Update `index.html`'s static title**

In `frontend/index.html`, change line 6 from:

```html
    <title>Nosso Mapa</title>
```

to:

```html
    <title>Mapa</title>
```

This is only the fallback shown for the brief instant before `main.tsx` runs; it's intentionally generic since it can't read env vars.

- [ ] **Step 2: Set the real title in `main.tsx`**

In `frontend/src/main.tsx`, add the import and a title assignment. Full updated file:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { APP_NAME } from './config'
import './styles/index.css'

document.title = APP_NAME

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 3: Run the full frontend test suite to verify nothing broke**

Run: `cd frontend && npm test`
Expected: PASS (all suites — `main.tsx` isn't under test, and no other test asserts on `document.title`)

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/src/main.tsx
git commit -m "feat(frontend): set document title from config module"
```

---

### Task 5: Thread env vars through `Dockerfile`

**Files:**
- Modify: `frontend/Dockerfile`

- [ ] **Step 1: Add ARG/ENV pairs for the two new vars**

Full updated `frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ARG VITE_APP_NAME
ENV VITE_APP_NAME=$VITE_APP_NAME
ARG VITE_DEFAULT_CENTER_LAT
ENV VITE_DEFAULT_CENTER_LAT=$VITE_DEFAULT_CENTER_LAT
ARG VITE_DEFAULT_CENTER_LNG
ENV VITE_DEFAULT_CENTER_LNG=$VITE_DEFAULT_CENTER_LNG
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 2: Commit**

```bash
git add frontend/Dockerfile
git commit -m "feat(docker): pass app name and default center build args to frontend image"
```

(No automated test for this step — Dockerfile `ARG`/`ENV` plumbing is verified in Task 6's manual build check.)

---

### Task 6: Pass env vars through `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml:1-9`

- [ ] **Step 1: Add the two new build args**

Change the `frontend.build.args` block from:

```yaml
  frontend:
    build:
      context: ./frontend
      args:
        VITE_GOOGLE_MAPS_API_KEY: ${VITE_GOOGLE_MAPS_API_KEY:-}
```

to:

```yaml
  frontend:
    build:
      context: ./frontend
      args:
        VITE_GOOGLE_MAPS_API_KEY: ${VITE_GOOGLE_MAPS_API_KEY:-}
        VITE_APP_NAME: ${VITE_APP_NAME:-}
        VITE_DEFAULT_CENTER_LAT: ${VITE_DEFAULT_CENTER_LAT:-}
        VITE_DEFAULT_CENTER_LNG: ${VITE_DEFAULT_CENTER_LNG:-}
```

No default value inside `${...:-}` — per the design spec, the single default lives in `frontend/src/config.ts`, not duplicated here.

- [ ] **Step 2: Manually verify the full build picks up an override**

Run:
```bash
VITE_APP_NAME="Mapa de Teste" docker compose build frontend
docker compose up -d
curl -s http://localhost:1996/ | grep -o '<title>[^<]*</title>'
```
Expected: `<title>Mapa</title>` (index.html's static fallback — this curl only fetches the raw HTML, not JS-rendered title; confirms the container built without error). Then open `http://localhost:1996` in a browser and check the browser tab title reads "Mapa de Teste", and the sidebar wordmark reads "Mapa de Teste" too.

Run without the env var to confirm the default still works:
```bash
docker compose build frontend
docker compose up -d
```
Expected: browser tab and wordmark both read "Nosso Mapa" (default, unchanged).

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): wire app name and default center env vars through compose"
```

---

### Task 7: Update `CLAUDE.md` design conventions note (optional doc touch)

**Files:**
- Modify: `CLAUDE.md` (Design conventions section)

- [ ] **Step 1: Add a line noting the new env vars**

In `CLAUDE.md`, under the "Design conventions" section, add this bullet after the existing theme/color bullets:

```markdown
- App display name and default map center are configurable at Docker build time via `VITE_APP_NAME`, `VITE_DEFAULT_CENTER_LAT`, `VITE_DEFAULT_CENTER_LNG` (see `frontend/src/config.ts`); unset values fall back to "Nosso Mapa" / Belo Horizonte.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note configurable app name and default map center in CLAUDE.md"
```
