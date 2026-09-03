import ItemsDisplay from './ItemsDisplay'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/Link', () => {
  return function Link({ children, ...props }) {
    return <a {...props}>{children}</a>
  }
})

const mockOpenPopup = jest.fn()

jest.mock('@/hooks/usePopup', () => {
  return function usePopup() {
    return {
      popup: null,
      openPopup: mockOpenPopup,
      closePopup: jest.fn(),
    }
  }
})

describe('ItemsDisplay', () => {
  const mockItems = [
    {
      name: 'Item 1',
      description: 'Description 1',
      link: '/item-1',
      target: '_self',
    },
    {
      name: 'Item 2',
      description: 'Description 2',
      link: '/item-2',
      target: '_blank',
    },
    {
      name: 'Item 3',
      description: 'Description 3',
    },
  ]

  describe('basic functionality', () => {
    it('should render all items', () => {
      render(<ItemsDisplay items={mockItems} />)

      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Item 3')).toBeInTheDocument()
    })

    it('should render item descriptions', () => {
      render(<ItemsDisplay items={mockItems} />)

      expect(screen.getByText('Description 1')).toBeInTheDocument()
      expect(screen.getByText('Description 2')).toBeInTheDocument()
      expect(screen.getByText('Description 3')).toBeInTheDocument()
    })

    it('should render items as links when link provided', () => {
      render(<ItemsDisplay items={mockItems} />)

      const item1 = screen.getByText('Item 1').closest('a')
      const item2 = screen.getByText('Item 2').closest('a')

      expect(item1).toHaveAttribute('href', '/item-1')
      expect(item1).toHaveAttribute('target', '_self')
      expect(item2).toHaveAttribute('href', '/item-2')
      expect(item2).toHaveAttribute('target', '_blank')
    })

    it('should render items as divs when no link provided', () => {
      render(<ItemsDisplay items={mockItems} />)

      const item3 = screen.getByText('Item 3').closest('div')

      expect(item3).toHaveClass('cursor-default')
    })
  })

  describe('column configuration', () => {
    it('should use 3 columns by default', () => {
      const { container } = render(<ItemsDisplay items={mockItems} />)

      const grid = container.firstChild

      expect(grid).toHaveClass('md:grid-cols-3')
      expect(grid).not.toHaveClass('md:grid-cols-4')
    })

    it('should use 3 columns when cols=3', () => {
      const { container } = render(<ItemsDisplay items={mockItems} cols={3} />)

      const grid = container.firstChild

      expect(grid).toHaveClass('md:grid-cols-3')
    })

    it('should use 4 columns when cols=4', () => {
      const { container } = render(<ItemsDisplay items={mockItems} cols={4} />)

      const grid = container.firstChild

      expect(grid).toHaveClass('md:grid-cols-4')
      expect(grid).not.toHaveClass('md:grid-cols-3')
    })
  })

  describe('custom styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <ItemsDisplay items={mockItems} className="custom-class" />
      )

      const grid = container.firstChild

      expect(grid).toHaveClass('custom-class')
    })

    it('should merge custom className with default classes', () => {
      const { container } = render(
        <ItemsDisplay items={mockItems} className="custom-class" />
      )

      const grid = container.firstChild

      expect(grid).toHaveClass('custom-class')
      expect(grid).toHaveClass('mx-auto')
      expect(grid).toHaveClass('max-w-5xl')
    })

    it('should pass through additional props', () => {
      const { container } = render(
        <ItemsDisplay items={mockItems} data-testid="custom-grid" />
      )

      expect(
        container.querySelector('[data-testid="custom-grid"]')
      ).toBeInTheDocument()
    })
  })

  describe('icon and logo rendering', () => {
    it('should render Logo component when provided', () => {
      const MockLogo = ({ className }) => (
        <div className={className} data-testid="mock-logo">
          Logo
        </div>
      )

      const itemsWithLogo = [
        {
          name: 'Item with Logo',
          description: 'Has logo',
          logo: MockLogo,
        },
      ]

      render(<ItemsDisplay items={itemsWithLogo} />)

      expect(screen.getByTestId('mock-logo')).toBeInTheDocument()
      expect(screen.getByText('Logo')).toBeInTheDocument()
    })

    it('should render Icon component when provided', () => {
      const MockIcon = ({ className }) => (
        <div className={className} data-testid="mock-icon">
          Icon
        </div>
      )

      const itemsWithIcon = [
        {
          name: 'Item with Icon',
          description: 'Has icon',
          icon: MockIcon,
        },
      ]

      render(<ItemsDisplay items={itemsWithIcon} />)

      expect(screen.getByTestId('mock-icon')).toBeInTheDocument()
      expect(screen.getByText('Icon')).toBeInTheDocument()
    })

    it('should not render logo or icon when not provided', () => {
      render(<ItemsDisplay items={mockItems} />)

      expect(screen.queryByTestId('mock-logo')).not.toBeInTheDocument()
      expect(screen.queryByTestId('mock-icon')).not.toBeInTheDocument()
    })
  })

  describe('children', () => {
    it('should render children alongside items', () => {
      render(
        <ItemsDisplay items={mockItems}>
          <div data-testid="child-content">Additional Content</div>
        </ItemsDisplay>
      )

      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByTestId('child-content')).toBeInTheDocument()
      expect(screen.getByText('Additional Content')).toBeInTheDocument()
    })

    it('should render without children', () => {
      render(<ItemsDisplay items={mockItems} />)

      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle empty items array', () => {
      const { container } = render(<ItemsDisplay items={[]} />)

      const grid = container.firstChild

      expect(grid).toBeInTheDocument()
      expect(grid.children.length).toBe(0)
    })

    it('should handle single item', () => {
      const singleItem = [mockItems[0]]

      render(<ItemsDisplay items={singleItem} />)

      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.queryByText('Item 2')).not.toBeInTheDocument()
    })

    it('should handle items without target', () => {
      const itemsNoTarget = [
        {
          name: 'No Target',
          description: 'Test',
          link: '/test',
        },
      ]

      render(<ItemsDisplay items={itemsNoTarget} />)

      const link = screen.getByText('No Target').closest('a')

      expect(link).toHaveAttribute('href', '/test')
    })

    it('should handle items with missing description', () => {
      const itemsNoDesc = [
        {
          name: 'No Description',
          link: '/test',
        },
      ]

      render(<ItemsDisplay items={itemsNoDesc} />)

      expect(screen.getByText('No Description')).toBeInTheDocument()
    })
  })

  describe('popup target', () => {
    beforeEach(() => {
      mockOpenPopup.mockClear()
    })

    it('should render as button when target is _popup', () => {
      const popupItems = [
        {
          name: 'Popup Item',
          description: 'Opens in popup',
          link: 'https://example.com/embed',
          target: '_popup',
        },
      ]

      render(<ItemsDisplay items={popupItems} />)

      const button = screen.getByText('Popup Item').closest('button')

      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('type', 'button')
    })

    it('should call openPopup when clicking _popup item', () => {
      const popupItems = [
        {
          name: 'Popup Item',
          description: 'Opens in popup',
          link: 'https://example.com/embed',
          target: '_popup',
        },
      ]

      render(<ItemsDisplay items={popupItems} />)

      const button = screen.getByText('Popup Item').closest('button')

      fireEvent.click(button)

      expect(mockOpenPopup).toHaveBeenCalledTimes(1)
    })
  })
})
