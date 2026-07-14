# Expandable Category Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Category lists in `PlaceItem`, `PlaceDetail`, and `FilterBar` truncate to a fixed count and show a `+N` chip that expands to reveal all categories (tap again to collapse).

**Architecture:** One shared generic component, `ExpandableChipRow<T>`, owns the truncate/expand/toggle logic and is agnostic to what each chip renders. Each of the three call sites supplies its own `renderItem` (static pill for `PlaceItem`/`PlaceDetail`, the existing interactive filter button for `FilterBar`) and its own `visibleCount`.

**Tech Stack:** React + TypeScript, Vite, Vitest + Testing Library, CSS Modules.

---

## File Structure

- Create `frontend/src/components/ExpandableChipRow.tsx` — generic truncate/expand/toggle component.
- Create `frontend/src/components/ExpandableChipRow.module.css` — layout for the chip row + toggle chip.
- Create `frontend/src/components/ExpandableChipRow.test.tsx` — tests for the shared component in isolation.
- Modify `frontend/src/components/PlaceItem.tsx` — outer row becomes `div[role=button]` (to allow a nested toggle `<button>`), category line uses `ExpandableChipRow`.
- Modify `frontend/src/components/PlaceItem.module.css` — replace `.meta` with a `.pill` chip style.
- Modify `frontend/src/components/PlaceItem.test.tsx` — update markup-dependent assertions, add truncation/expand cases.
- Modify `frontend/src/components/PlaceDetail.tsx` — category `<p>` becomes `ExpandableChipRow` wrapped with `key={place.id}` to reset on place switch.
- Modify `frontend/src/components/PlaceDetail.module.css` — replace text-line `.categories` styling with a `.pill` chip style.
- Modify `frontend/src/components/PlaceDetail.test.tsx` — add truncation/expand + reset-on-place-switch cases.
- Modify `frontend/src/components/FilterBar.tsx` — categories group wrapped in `ExpandableChipRow`, reusing the existing filter toggle button as `renderItem`.
- Modify `frontend/src/components/FilterBar.test.tsx` — add truncation/expand cases.

---

### Task 1: `ExpandableChipRow` shared component

**Files:**
- Create: `frontend/src/components/ExpandableChipRow.tsx`
- Create: `frontend/src/components/ExpandableChipRow.module.css`
- Test: `frontend/src/components/ExpandableChipRow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/ExpandableChipRow.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ExpandableChipRow } from './ExpandableChipRow'

interface Item {
  id: number
  name: string
}

const ITEMS: Item[] = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
  { id: 4, name: 'D' },
]

function renderRow(items: Item[], visibleCount: number) {
  return render(
    <ExpandableChipRow
      items={items}
      visibleCount={visibleCount}
      keyFn={(item) => item.id}
      renderItem={(item) => <span>{item.name}</span>}
    />,
  )
}

describe('ExpandableChipRow', () => {
  it('renders all items with no toggle when items fit within visibleCount', () => {
    renderRow(ITEMS.slice(0, 2), 2)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('truncates to visibleCount and shows +N toggle when items overflow', () => {
    renderRow(ITEMS, 2)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.queryByText('C')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('expands to show all items when toggle clicked', async () => {
    renderRow(ITEMS, 2)
    await userEvent.click(screen.getByText('+2'))
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
    expect(screen.getByText('−')).toBeInTheDocument()
  })

  it('collapses back when toggle clicked again', async () => {
    renderRow(ITEMS, 2)
    await userEvent.click(screen.getByText('+2'))
    await userEvent.click(screen.getByText('−'))
    expect(screen.queryByText('C')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('toggle click does not bubble to a parent click handler', async () => {
    const onParentClick = vi.fn()
    render(
      <div onClick={onParentClick}>
        <ExpandableChipRow
          items={ITEMS}
          visibleCount={2}
          keyFn={(item) => item.id}
          renderItem={(item) => <span>{item.name}</span>}
        />
      </div>,
    )
    await userEvent.click(screen.getByText('+2'))
    expect(onParentClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/ExpandableChipRow.test.tsx`
Expected: FAIL — `Cannot find module './ExpandableChipRow'` (file doesn't exist yet).

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/components/ExpandableChipRow.tsx
import { Fragment, useState, type MouseEvent, type ReactNode } from 'react'
import styles from './ExpandableChipRow.module.css'

interface Props<T> {
  items: T[]
  visibleCount: number
  keyFn: (item: T) => string | number
  renderItem: (item: T) => ReactNode
}

export function ExpandableChipRow<T>({ items, visibleCount, keyFn, renderItem }: Props<T>) {
  const [expanded, setExpanded] = useState(false)
  const hasOverflow = items.length > visibleCount
  const visibleItems = expanded || !hasOverflow ? items : items.slice(0, visibleCount)

  function handleToggle(event: MouseEvent) {
    event.stopPropagation()
    setExpanded((prev) => !prev)
  }

  return (
    <div className={styles.row}>
      {visibleItems.map((item) => (
        <Fragment key={keyFn(item)}>{renderItem(item)}</Fragment>
      ))}
      {hasOverflow && (
        <button
          type="button"
          className={styles.toggle}
          onClick={handleToggle}
          aria-label={expanded ? 'Mostrar menos categorias' : 'Mostrar mais categorias'}
        >
          {expanded ? '−' : `+${items.length - visibleCount}`}
        </button>
      )}
    </div>
  )
}
```

```css
/* frontend/src/components/ExpandableChipRow.module.css */
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}

.toggle {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.0625rem 0.5rem;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 0.75rem;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.toggle:hover {
  border-color: var(--text-muted);
  color: var(--text-primary);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/ExpandableChipRow.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ExpandableChipRow.tsx frontend/src/components/ExpandableChipRow.module.css frontend/src/components/ExpandableChipRow.test.tsx
git commit -m "feat(frontend): add ExpandableChipRow shared component"
```

---

### Task 2: `PlaceItem` — collapse to 2 categories, expand on `+N`

**Files:**
- Modify: `frontend/src/components/PlaceItem.tsx`
- Modify: `frontend/src/components/PlaceItem.module.css`
- Modify: `frontend/src/components/PlaceItem.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `frontend/src/components/PlaceItem.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PlaceItem } from './PlaceItem'
import type { Place } from '../types'

const PLACE: Place = {
  id: 1,
  name: 'Cantinho do Avillez',
  alias: null,
  description: null,
  google_place_id: null,
  lat: 38.71,
  lng: -9.14,
  status: 'to_go',
  avg_rating: 4.5,
  categories: [{ id: 1, name: 'Restaurante' }],
  created_at: '2026-01-01T00:00:00',
}

describe('PlaceItem', () => {
  it('renders place name', () => {
    render(<PlaceItem place={PLACE} distanceLabel="0.5 km" onClick={vi.fn()} />)
    expect(screen.getByText('Cantinho do Avillez')).toBeInTheDocument()
  })

  it('renders category name', () => {
    render(<PlaceItem place={PLACE} distanceLabel="0.5 km" onClick={vi.fn()} />)
    expect(screen.getByText('Restaurante')).toBeInTheDocument()
  })

  it('renders distance label', () => {
    render(<PlaceItem place={PLACE} distanceLabel="1.2 km" onClick={vi.fn()} />)
    expect(screen.getByText('1.2 km')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<PlaceItem place={PLACE} distanceLabel="0 km" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies selected style when selected=true', () => {
    const { container } = render(
      <PlaceItem place={PLACE} distanceLabel="0 km" onClick={vi.fn()} selected />,
    )
    const row = container.querySelector('[role="button"]')
    expect(row?.className).toMatch(/selected/)
  })

  it('shows +N chip and hides overflow categories when more than 2', () => {
    const placeWithManyCategories = {
      ...PLACE,
      categories: [
        { id: 1, name: 'Restaurante' },
        { id: 2, name: 'Café' },
        { id: 3, name: 'Museu' },
        { id: 4, name: 'Cinema' },
      ],
    }
    render(<PlaceItem place={placeWithManyCategories} distanceLabel="0 km" onClick={vi.fn()} />)
    expect(screen.getByText('Restaurante')).toBeInTheDocument()
    expect(screen.getByText('Café')).toBeInTheDocument()
    expect(screen.queryByText('Museu')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('expanding categories does not trigger row onClick', async () => {
    const onClick = vi.fn()
    const placeWithManyCategories = {
      ...PLACE,
      categories: [
        { id: 1, name: 'Restaurante' },
        { id: 2, name: 'Café' },
        { id: 3, name: 'Museu' },
      ],
    }
    render(<PlaceItem place={placeWithManyCategories} distanceLabel="0 km" onClick={onClick} />)
    await userEvent.click(screen.getByText('+1'))
    expect(screen.getByText('Museu')).toBeInTheDocument()
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `cd frontend && npx vitest run src/components/PlaceItem.test.tsx`
Expected: FAIL — "applies selected style" fails (`container.querySelector('[role="button"]')` returns `null` against current `<button>` markup that has no `role` attribute), and the two new tests fail (no `+N` chip rendered yet).

- [ ] **Step 3: Update the component**

Replace the full contents of `frontend/src/components/PlaceItem.tsx`:

```tsx
import type { KeyboardEvent } from 'react'
import type { Category, Place } from '../types'
import { StarRating } from './StarRating'
import { ExpandableChipRow } from './ExpandableChipRow'
import styles from './PlaceItem.module.css'

const STATUS_COLORS: Record<string, string> = {
  to_go: 'var(--blue)',
  gone: 'var(--slate)',
  repeat: 'var(--rose)',
}

interface Props {
  place: Place
  distanceLabel: string
  onClick: () => void
  selected?: boolean
}

export function PlaceItem({ place, distanceLabel, onClick, selected }: Props) {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={`${styles.item} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <span
        className={styles.dot}
        style={{ background: STATUS_COLORS[place.status] }}
        aria-hidden="true"
      />
      <span className={styles.content}>
        <span className={styles.name}>{place.name}</span>
        <ExpandableChipRow
          items={place.categories}
          visibleCount={2}
          keyFn={(cat: Category) => cat.id}
          renderItem={(cat: Category) => <span className={styles.pill}>{cat.name}</span>}
        />
      </span>
      <span className={styles.right}>
        <StarRating mode="display" value={place.avg_rating} />
        <span className={styles.distance}>{distanceLabel}</span>
      </span>
    </div>
  )
}
```

In `frontend/src/components/PlaceItem.module.css`, replace the `.meta` rule:

```css
.meta {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

with:

```css
.pill {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.0625rem 0.5rem;
  white-space: nowrap;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/PlaceItem.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PlaceItem.tsx frontend/src/components/PlaceItem.module.css frontend/src/components/PlaceItem.test.tsx
git commit -m "feat(frontend): PlaceItem categories collapse to 2 with +N expand"
```

---

### Task 3: `PlaceDetail` — collapse to 3 categories, reset on place switch

**Files:**
- Modify: `frontend/src/components/PlaceDetail.tsx`
- Modify: `frontend/src/components/PlaceDetail.module.css`
- Modify: `frontend/src/components/PlaceDetail.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `frontend/src/components/PlaceDetail.test.tsx`, add these two `it` blocks inside the existing `describe('PlaceDetail', ...)` block (after the `'renders category'` test):

```tsx
  it('shows +N chip and expands to show all categories when more than 3', async () => {
    const placeWithManyCategories = {
      ...PLACE,
      categories: [
        { id: 1, name: 'Café' },
        { id: 2, name: 'Restaurante' },
        { id: 3, name: 'Museu' },
        { id: 4, name: 'Cinema' },
      ],
    }
    render(<PlaceDetail place={placeWithManyCategories} onClose={vi.fn()} />, { wrapper })
    expect(screen.queryByText('Cinema')).not.toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    await userEvent.click(screen.getByText('+1'))
    expect(screen.getByText('Cinema')).toBeInTheDocument()
  })

  it('resets expanded categories when switching to a different place', async () => {
    const placeWithManyCategories = {
      ...PLACE,
      categories: [
        { id: 1, name: 'Café' },
        { id: 2, name: 'Restaurante' },
        { id: 3, name: 'Museu' },
        { id: 4, name: 'Cinema' },
      ],
    }
    const { rerender } = render(
      <PlaceDetail place={placeWithManyCategories} onClose={vi.fn()} />,
      { wrapper },
    )
    await userEvent.click(screen.getByText('+1'))
    expect(screen.getByText('Cinema')).toBeInTheDocument()

    const otherPlace = { ...placeWithManyCategories, id: 2, name: 'Outro lugar' }
    rerender(<PlaceDetail place={otherPlace} onClose={vi.fn()} />)
    expect(screen.queryByText('Cinema')).not.toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/PlaceDetail.test.tsx`
Expected: FAIL — no `+N` chip exists yet (categories still render as plain joined text).

- [ ] **Step 3: Update the component**

In `frontend/src/components/PlaceDetail.tsx`, update the import line:

```tsx
import type { Place, PlaceStatus, Category } from '../types'
```

add the import:

```tsx
import { ExpandableChipRow } from './ExpandableChipRow'
```

and replace:

```tsx
      <p className={styles.categories}>
        {place.categories.map((c) => c.name).join(' · ')}
      </p>
```

with:

```tsx
      <div className={styles.categories}>
        <ExpandableChipRow
          key={place.id}
          items={place.categories}
          visibleCount={3}
          keyFn={(cat: Category) => cat.id}
          renderItem={(cat: Category) => <span className={styles.pill}>{cat.name}</span>}
        />
      </div>
```

In `frontend/src/components/PlaceDetail.module.css`, replace the `.categories` rule:

```css
.categories {
  font-size: 0.8125rem;
  color: var(--text-muted);
}
```

with:

```css
.categories {
  display: flex;
}

.pill {
  font-size: 0.8125rem;
  color: var(--text-muted);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.125rem 0.625rem;
  white-space: nowrap;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/PlaceDetail.test.tsx`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PlaceDetail.tsx frontend/src/components/PlaceDetail.module.css frontend/src/components/PlaceDetail.test.tsx
git commit -m "feat(frontend): PlaceDetail categories collapse to 3 with +N expand"
```

---

### Task 4: `FilterBar` — collapse category filter group to 3, expand on `+N`

**Files:**
- Modify: `frontend/src/components/FilterBar.tsx`
- Modify: `frontend/src/components/FilterBar.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `frontend/src/components/FilterBar.test.tsx`, add these two `it` blocks inside the existing `describe('FilterBar', ...)` block (after the `'hides category section when categories array is empty'` test):

```tsx
  it('truncates category chips and expands to show all when more than 3', async () => {
    const manyCategories = [
      { id: 1, name: 'Café' },
      { id: 2, name: 'Museu' },
      { id: 3, name: 'Cinema' },
      { id: 4, name: 'Restaurante' },
    ]
    render(<FilterBar {...defaultProps} categories={manyCategories} />)
    expect(screen.queryByText('Restaurante')).not.toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    await userEvent.click(screen.getByText('+1'))
    expect(screen.getByText('Restaurante')).toBeInTheDocument()
  })

  it('category chip inside the expandable row still calls onCategoryToggle when clicked', async () => {
    const onCategoryToggle = vi.fn()
    const manyCategories = [
      { id: 1, name: 'Café' },
      { id: 2, name: 'Museu' },
      { id: 3, name: 'Cinema' },
      { id: 4, name: 'Restaurante' },
    ]
    render(
      <FilterBar {...defaultProps} categories={manyCategories} onCategoryToggle={onCategoryToggle} />,
    )
    await userEvent.click(screen.getByText('Café'))
    expect(onCategoryToggle).toHaveBeenCalledWith(1)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/FilterBar.test.tsx`
Expected: FAIL — all 4 categories currently render at once, no `+N` chip exists.

- [ ] **Step 3: Update the component**

In `frontend/src/components/FilterBar.tsx`, add the import:

```tsx
import { ExpandableChipRow } from './ExpandableChipRow'
```

and replace the categories block:

```tsx
      {categories.length > 0 && (
        <div className={styles.group}>
          {categories.map((cat) => {
            const active = categoryFilter.includes(cat.id)
            return (
              <button
                key={cat.id}
                className={`${styles.chip} ${active ? styles.catActive : ''}`}
                onClick={() => onCategoryToggle(cat.id)}
                aria-pressed={active}
              >
                {cat.name}
              </button>
            )
          })}
        </div>
      )}
```

with:

```tsx
      {categories.length > 0 && (
        <div className={styles.group}>
          <ExpandableChipRow
            items={categories}
            visibleCount={3}
            keyFn={(cat) => cat.id}
            renderItem={(cat) => {
              const active = categoryFilter.includes(cat.id)
              return (
                <button
                  className={`${styles.chip} ${active ? styles.catActive : ''}`}
                  onClick={() => onCategoryToggle(cat.id)}
                  aria-pressed={active}
                >
                  {cat.name}
                </button>
              )
            }}
          />
        </div>
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/FilterBar.test.tsx`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FilterBar.tsx frontend/src/components/FilterBar.test.tsx
git commit -m "feat(frontend): FilterBar category filters collapse to 3 with +N expand"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend test suite**

Run: `cd frontend && npm test`
Expected: All test files pass, no failures.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Manual check in the browser**

Run: `cd frontend && npm run dev`, open the app, pick (or create) a place with 4+ categories.
Check:
- List row shows 2 categories + `+N` pill; tapping it expands in place without opening the detail panel; tapping `−` collapses it back.
- Opening that place's detail panel shows 3 categories + `+N`; tapping expands/collapses; switching to a different place resets it back to collapsed.
- In the filter bar, the category group shows 3 chips + `+N`; tapping expands/collapses; clicking a category chip (collapsed or expanded) still toggles the filter.

- [ ] **Step 4: Report status**

No commit needed for this task (verification only). If any check fails, return to the relevant task and fix before proceeding.
