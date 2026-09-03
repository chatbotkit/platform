import FOC from './FOC'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/NestedAccordion', () => {
  return function MockNestedAccordion({ title, defaultIcon, className }) {
    return (
      <div
        data-testid="nested-accordion"
        data-title={title}
        data-default-icon={defaultIcon}
        className={className}
      >
        {title}
      </div>
    )
  }
})

describe('FOC', () => {
  const mockItems = [
    { title: 'Item 1', href: '/item1' },
    { title: 'Item 2', href: '/item2' },
    { title: 'Item 3', href: '/item3' },
  ]

  describe('basic rendering', () => {
    it('should render navigation element', () => {
      render(<FOC items={mockItems} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toBeInTheDocument()
    })

    it('should render all items', () => {
      render(<FOC items={mockItems} />)

      const accordions = screen.getAllByTestId('nested-accordion')

      expect(accordions).toHaveLength(3)
    })

    it('should pass correct titles to NestedAccordion', () => {
      render(<FOC items={mockItems} />)

      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Item 3')).toBeInTheDocument()
    })

    it('should apply base CSS classes', () => {
      const { container } = render(<FOC items={mockItems} />)

      const nav = container.querySelector('.foc')

      expect(nav).toHaveClass('foc')
      expect(nav).toHaveClass('max-w-[14rem]')
      expect(nav).toHaveClass('rounded-xl')
    })

    it('should apply custom className', () => {
      const { container } = render(
        <FOC items={mockItems} className="custom-class" />
      )

      const nav = container.querySelector('.foc')

      expect(nav).toHaveClass('custom-class')
    })
  })

  describe('defaultIcon prop', () => {
    it('should pass defaultIcon to NestedAccordion', () => {
      render(<FOC items={mockItems} defaultIcon="test-icon" />)

      const accordions = screen.getAllByTestId('nested-accordion')

      accordions.forEach((accordion) => {
        expect(accordion).toHaveAttribute('data-default-icon', 'test-icon')
      })
    })

    it('should not pass defaultIcon if not provided', () => {
      render(<FOC items={mockItems} />)

      const accordions = screen.getAllByTestId('nested-accordion')

      accordions.forEach((accordion) => {
        expect(accordion).not.toHaveAttribute('data-default-icon')
      })
    })
  })

  describe('autoPosition prop', () => {
    it('should apply fixed positioning when autoPosition is true', () => {
      const { container } = render(
        <FOC items={mockItems} autoPosition={true} />
      )

      const nav = container.querySelector('.foc')

      expect(nav).toHaveClass('fixed')
      expect(nav).toHaveClass('left-20')
    })

    it('should apply left positioning when autoPosition is "left"', () => {
      const { container } = render(
        <FOC items={mockItems} autoPosition="left" />
      )

      const nav = container.querySelector('.foc')

      expect(nav).toHaveClass('left-20')
    })

    it('should apply right positioning when autoPosition is "right"', () => {
      const { container } = render(
        <FOC items={mockItems} autoPosition="right" />
      )

      const nav = container.querySelector('.foc')

      expect(nav).toHaveClass('right-20')
    })

    it('should hide on non-xl screens when autoPosition is set', () => {
      const { container } = render(
        <FOC items={mockItems} autoPosition={true} />
      )

      const nav = container.querySelector('.foc')

      expect(nav).toHaveClass('hidden')
      expect(nav).toHaveClass('xl:block')
    })

    it('should not apply positioning classes when autoPosition is false', () => {
      const { container } = render(
        <FOC items={mockItems} autoPosition={false} />
      )

      const nav = container.querySelector('.foc')

      expect(nav).not.toHaveClass('fixed')
      expect(nav).not.toHaveClass('left-20')
    })
  })

  describe('top prop', () => {
    it('should apply default top value of 76px when autoPosition is set', () => {
      const { container } = render(
        <FOC items={mockItems} autoPosition={true} />
      )

      const nav = container.querySelector('.foc')

      expect(nav).toHaveStyle({ top: '76px' })
    })

    it('should apply custom top value when provided', () => {
      const { container } = render(
        <FOC items={mockItems} autoPosition={true} top={100} />
      )

      const nav = container.querySelector('.foc')

      expect(nav).toHaveStyle({ top: '100px' })
    })

    it('should not apply top style when autoPosition is not set', () => {
      const { container } = render(<FOC items={mockItems} top={100} />)

      const nav = container.querySelector('.foc')

      expect(nav).not.toHaveStyle({ top: '100px' })
    })
  })

  describe('children prop', () => {
    it('should render children after items', () => {
      render(
        <FOC items={mockItems}>
          <div data-testid="custom-child">Custom Content</div>
        </FOC>
      )

      expect(screen.getByTestId('custom-child')).toBeInTheDocument()
      expect(screen.getByText('Custom Content')).toBeInTheDocument()
    })

    it('should render without children', () => {
      render(<FOC items={mockItems} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toBeInTheDocument()
    })
  })

  describe('items prop', () => {
    it('should handle empty items array', () => {
      render(<FOC items={[]} />)

      const nav = screen.getByRole('navigation')

      expect(nav).toBeInTheDocument()
      expect(screen.queryAllByTestId('nested-accordion')).toHaveLength(0)
    })

    it('should handle single item', () => {
      render(<FOC items={[{ title: 'Single Item' }]} />)

      expect(screen.getByText('Single Item')).toBeInTheDocument()
    })

    it('should pass all item props to NestedAccordion', () => {
      const itemsWithProps = [
        { title: 'Item 1', href: '/item1', icon: 'icon1' },
      ]

      render(<FOC items={itemsWithProps} />)

      const accordion = screen.getByTestId('nested-accordion')

      expect(accordion).toHaveAttribute('data-title', 'Item 1')
    })

    it('should apply space-y-2 class to NestedAccordion', () => {
      render(<FOC items={mockItems} />)

      const accordions = screen.getAllByTestId('nested-accordion')

      accordions.forEach((accordion) => {
        expect(accordion).toHaveClass('space-y-2')
      })
    })
  })

  describe('edge cases', () => {
    it('should handle autoPosition with custom className', () => {
      const { container } = render(
        <FOC
          items={mockItems}
          autoPosition={true}
          className="custom-positioning"
        />
      )

      const nav = container.querySelector('.foc')

      expect(nav).toHaveClass('custom-positioning')
      expect(nav).toHaveClass('fixed')
    })

    it('should handle top=0', () => {
      const { container } = render(
        <FOC items={mockItems} autoPosition={true} top={0} />
      )

      const nav = container.querySelector('.foc')

      expect(nav).toHaveStyle({ top: '0px' })
    })

    it('should maintain item order', () => {
      render(<FOC items={mockItems} />)

      const accordions = screen.getAllByTestId('nested-accordion')

      expect(accordions[0]).toHaveAttribute('data-title', 'Item 1')
      expect(accordions[1]).toHaveAttribute('data-title', 'Item 2')
      expect(accordions[2]).toHaveAttribute('data-title', 'Item 3')
    })
  })
})
