# Edit/Delete Places + Alias + Description Design

**Date:** 2026-07-13  
**Status:** Approved

## Summary

Add the ability to edit and soft-delete places from the map. Editing allows changing alias, description, and categories. Alias is an optional display name (defaults to place name). Description is optional markdown text. Delete is soft (recoverable). Adding a place that already exists deduplicates via `google_place_id`.

---

## Data Layer

Three new nullable columns on the `places` table:

```sql
ALTER TABLE places ADD COLUMN alias       TEXT;
ALTER TABLE places ADD COLUMN description TEXT;
ALTER TABLE places ADD COLUMN deleted_at  DATETIME;
```

- `alias` — optional display name. Display logic: show `alias` when set, fall back to `name`.
- `description` — optional markdown text, no character limit.
- `deleted_at` — nullable datetime. Soft delete = set to `CURRENT_TIMESTAMP`. All queries filter `WHERE deleted_at IS NULL`.

**Migration strategy:** `init_db()` runs `ALTER TABLE ... ADD COLUMN` wrapped in `try/except` to catch SQLite's `"duplicate column name"` error. This means:
- Fresh install: columns created via `CREATE TABLE`.
- Existing install: `ALTER TABLE` adds columns, silently skips on subsequent deploys.
- Existing data is never touched. New columns default to `NULL` on existing rows.
- Named Docker volume survives container recreation — no data loss on Portainer redeploy.

---

## API Layer

### New endpoints

**`PUT /api/places/{id}`** — edit place metadata  
Request body: `{ alias: str | None, description: str | None, category_ids: list[int] }`  
Logic: update `alias` and `description` columns, replace `place_categories` (delete all for place → insert new set), return `PlaceOut`.  
Returns 404 if place not found or soft-deleted.

**`DELETE /api/places/{id}`** — soft delete  
Logic: set `deleted_at = CURRENT_TIMESTAMP` on the row.  
Returns 204 No Content.

### Modified endpoints

**`POST /api/places`** — deduplication logic added before insert:
1. If `google_place_id` matches an **active** place → 409 `"Lugar já está na lista"`.
2. If `google_place_id` matches a **soft-deleted** place → restore: clear `deleted_at`, update `name`/`lat`/`lng` from the new request, return the restored place with 200.
3. No match → normal insert, return 201.

**`GET /api/places`** — filter `WHERE p.deleted_at IS NULL`.

**`_fetch_place`** helper — add `alias` and `description` to SELECT and returned dict.

### Updated models

`PlaceOut` gains: `alias: Optional[str]`, `description: Optional[str]`.

New Pydantic model `PlaceUpdate`: `alias: Optional[str]`, `description: Optional[str]`, `category_ids: list[int]`.

### Frontend `types.ts`

Add to `Place` interface: `alias: string | null`, `description: string | null`.

New interface:
```ts
export interface PlaceUpdate {
  alias: string | null
  description: string | null
  category_ids: number[]
}
```

### Frontend `api.ts`

```ts
update: (id: number, body: PlaceUpdate) =>
  request<Place>(`/places/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
delete: (id: number) =>
  request<void>(`/places/${id}`, { method: 'DELETE' }),
```

Note: `request<void>` for DELETE must skip `res.json()` since 204 has no body. The `request` helper needs a guard: if `res.status === 204` return `undefined` before calling `.json()`.

---

## Frontend Components

### `PlaceDetail.tsx` changes

- **Header name:** render `place.alias ?? place.name`.
- **Description:** below categories, render `<ReactMarkdown remarkPlugins={[remarkGfm]}>{place.description}</ReactMarkdown>`. Skip render entirely if `description` is null.
- **Footer buttons:** add "Editar" (opens `EditPlaceModal`) and "Excluir".
- **Delete flow:** "Excluir" → `window.confirm('Excluir lugar?')` → `deletePlace` mutation → call `onClose` on success.

### `EditPlaceModal.tsx` (new component)

Mirrors `AddPlaceModal` structure and CSS patterns.

Fields:
- **Locked place name** — non-editable display of `place.name` (the canonical Google name).
- **"Apelido"** — text input, placeholder = `place.name`, controlled value = `place.alias ?? ''`. Saved as `null` when empty.
- **"Descrição"** — multiline `<textarea>`, hint text indicates markdown is supported.
- **"Categorias"** — same chip toggle UI as `AddPlaceModal`, pre-selected from `place.categories`.

Footer: Cancelar / Salvar → `PUT /api/places/{id}` via `useUpdatePlace`.

### `AddPlaceModal.tsx` changes

- On 409 response → show inline error message "Lugar já está na lista".
- On restored place (200 from `POST /api/places`) → backend handles transparently; frontend receives a place and closes normally — no special handling needed.

### New hooks (in `usePlaces.ts`)

`useUpdatePlace` — `useMutation` wrapping `api.places.update`, invalidates `['places']` on success.  
`useDeletePlace` — `useMutation` wrapping `api.places.delete`, invalidates `['places']` on success.

### Dependencies

```
npm install react-markdown remark-gfm
```

---

## Out of scope

- Undo delete (no undelete UI — restore happens only via re-adding the same Google Place).
- Editing place name or coordinates (locked to Google Places data).
- Rich text editor (plain textarea with markdown rendering only).
- Description preview while editing.
