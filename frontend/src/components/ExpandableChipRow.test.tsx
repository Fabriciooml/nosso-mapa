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

  it('uses custom expandLabel/collapseLabel when provided', async () => {
    render(
      <ExpandableChipRow
        items={ITEMS}
        visibleCount={2}
        keyFn={(item) => item.id}
        renderItem={(item) => <span>{item.name}</span>}
        expandLabel="Show more items"
        collapseLabel="Show less items"
      />,
    )
    const toggle = screen.getByRole('button', { name: 'Show more items' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Show less items' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
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
