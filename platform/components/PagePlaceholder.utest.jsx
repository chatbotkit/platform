import PagePlaceholder, {
  DashboardPlaceholder,
  LargeSectionPlaceholder,
  SidebarPlaceholder,
  SmallTextPlaceholder,
  usePlaceholderColorClass,
} from './PagePlaceholder'

import '@testing-library/jest-dom'
import { render, renderHook } from '@testing-library/react'

describe('PagePlaceholder', () => {
  it('returns light color classes from hook', () => {
    const { result } = renderHook(() => usePlaceholderColorClass(false))

    expect(result.current).toEqual({
      colorClass01: 'bg-gray-100',
      colorClass02: 'bg-gray-300',
    })
  })

  it('returns dark color classes from hook', () => {
    const { result } = renderHook(() => usePlaceholderColorClass(true))

    expect(result.current).toEqual({
      colorClass01: 'bg-gray-800',
      colorClass02: 'bg-gray-700',
    })
  })

  it('renders large section placeholder with dark classes', () => {
    const { container } = render(<LargeSectionPlaceholder isDark />)

    expect(container.firstChild).toHaveClass('bg-gray-800')
    expect(container.querySelectorAll('.bg-gray-700')).toHaveLength(3)
  })

  it('renders small text placeholder with light classes', () => {
    const { container } = render(<SmallTextPlaceholder isDark={false} />)

    expect(container.firstChild).toHaveClass('bg-gray-100')
    expect(container.querySelectorAll('.bg-gray-300')).toHaveLength(8)
  })

  it('renders sidebar placeholder sections', () => {
    const { container } = render(<SidebarPlaceholder isDark />)

    expect(container.firstChild).toHaveClass('bg-gray-800')
    expect(container.querySelectorAll('.bg-gray-700')).toHaveLength(3)
  })

  it('renders dashboard layout placeholders', () => {
    const { container } = render(<DashboardPlaceholder isDark={false} />)

    expect(container.querySelector('aside')).toBeInTheDocument()
    expect(container.querySelector('main')).toBeInTheDocument()
    expect(container.querySelectorAll('.bg-gray-100').length).toBeGreaterThan(0)
  })

  it('renders default page placeholder and forwards props', () => {
    const { container } = render(
      <PagePlaceholder isDark data-testid="page-placeholder" />
    )

    expect(
      container.querySelector('[data-testid="page-placeholder"]')
    ).toBeInTheDocument()
    expect(container.querySelectorAll('.bg-gray-800').length).toBeGreaterThan(0)
  })
})
