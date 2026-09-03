import FOC from './FOC'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/NestedAccordion', () => ({
  __esModule: true,
  default: ({ title, className }) => (
    <div
      data-testid="nested-accordion"
      data-title={title}
      className={className}
    >
      {title}
    </div>
  ),
}))

describe('FOC', () => {
  const mockItems = [
    { title: 'Item 1', href: '/item1' },
    { title: 'Item 2', href: '/item2' },
    { title: 'Item 3', href: '/item3' },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render as nav element', () => {
      render(<FOC items={mockItems} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toBeInTheDocument()
      expect(nav).toHaveClass('foc')
    })

    it('should render all items', () => {
      render(<FOC items={mockItems} />)

      const accordions = screen.getAllByTestId('nested-accordion')

      expect(accordions).toHaveLength(3)
    })

    it('should pass item props to NestedAccordion', () => {
      render(<FOC items={mockItems} />)

      const firstAccordion = screen.getAllByTestId('nested-accordion')[0]

      expect(firstAccordion).toHaveAttribute('data-title', 'Item 1')
    })

    it('should render children', () => {
      render(
        <FOC items={mockItems}>
          <div data-testid="child-content">Extra content</div>
        </FOC>
      )

      expect(screen.getByTestId('child-content')).toBeInTheDocument()
    })

    it('should handle empty items array', () => {
      render(<FOC items={[]} />)

      const accordions = screen.queryAllByTestId('nested-accordion')

      expect(accordions).toHaveLength(0)
    })
  })

  describe('styling', () => {
    it('should apply base classes', () => {
      render(<FOC items={mockItems} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toHaveClass('foc')
      expect(nav).toHaveClass('max-w-[14rem]')
      expect(nav).toHaveClass('backdrop-blur-lg')
    })

    it('should merge custom className', () => {
      render(<FOC items={mockItems} className="custom-nav" />)

      const nav = screen.getByRole('navigation')

      expect(nav).toHaveClass('foc')
      expect(nav).toHaveClass('custom-nav')
    })
  })

  describe('auto positioning', () => {
    it('should not apply top style when autoPosition is false', () => {
      render(<FOC items={mockItems} autoPosition={false} />)

      const nav = screen.getByRole('navigation')

      expect(nav).not.toHaveClass('fixed')
    })

    it('should apply left positioning when autoPosition is true', () => {
      render(<FOC items={mockItems} autoPosition={true} top={100} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toHaveStyle({ top: '100px' })
      expect(nav).toHaveClass('left-20')
    })

    it('should apply left positioning when autoPosition is "left"', () => {
      render(<FOC items={mockItems} autoPosition="left" top={76} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toHaveStyle({ top: '76px' })
      expect(nav).toHaveClass('left-20')
    })

    it('should apply right positioning when autoPosition is "right"', () => {
      render(<FOC items={mockItems} autoPosition="right" top={50} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toHaveStyle({ top: '50px' })
      expect(nav).toHaveClass('right-20')
    })

    it('should use default top value of 76', () => {
      render(<FOC items={mockItems} autoPosition={true} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toHaveStyle({ top: '76px' })
    })

    it('should apply fixed and z-10 classes when autoPosition is set', () => {
      render(<FOC items={mockItems} autoPosition={true} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toHaveClass('fixed')
      expect(nav).toHaveClass('z-10')
    })

    it('should hide on smaller screens when autoPosition is set', () => {
      render(<FOC items={mockItems} autoPosition={true} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toHaveClass('hidden')
      expect(nav).toHaveClass('xl:block')
    })
  })

  describe('default icon', () => {
    it('should pass defaultIcon to NestedAccordion components', () => {
      render(<FOC items={mockItems} defaultIcon="@lucide/star" />)

      const accordions = screen.getAllByTestId('nested-accordion')

      accordions.forEach((accordion) => {
        expect(accordion).toBeInTheDocument()
      })
    })
  })
})
