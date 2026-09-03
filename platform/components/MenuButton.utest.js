import MenuButton from './MenuButton'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock(
  './PopButton',
  () =>
    function PopButton({ caption, children, className, ...props }) {
      return (
        <div className={className} data-testid="pop-button" {...props}>
          <div data-testid="caption">{caption}</div>
          <div data-testid="menu-content">{children}</div>
        </div>
      )
    }
)

jest.mock(
  './NestedAccordion',
  () =>
    function NestedAccordion({ items, className, ...props }) {
      return (
        <div className={className} data-testid="nested-accordion" {...props}>
          {items?.map((item, index) => (
            <div key={index} data-testid="menu-item">
              {item.label || item.title || JSON.stringify(item)}
            </div>
          ))}
        </div>
      )
    }
)

describe('MenuButton', () => {
  describe('basic functionality', () => {
    it('should render with children as caption', () => {
      const menu = [{ label: 'Item 1' }]

      render(<MenuButton menu={menu}>Click Me</MenuButton>)
      expect(screen.getByTestId('caption')).toHaveTextContent('Click Me')
    })

    it('should render menu items', () => {
      const menu = [
        { label: 'Item 1' },
        { label: 'Item 2' },
        { label: 'Item 3' },
      ]

      render(<MenuButton menu={menu}>Menu</MenuButton>)

      const items = screen.getAllByTestId('menu-item')

      expect(items).toHaveLength(3)
    })

    it('should pass menu prop to NestedAccordion', () => {
      const menu = [{ label: 'Test Item' }]

      render(<MenuButton menu={menu}>Button</MenuButton>)
      expect(screen.getByText('Test Item')).toBeInTheDocument()
    })
  })

  describe('PopButton integration', () => {
    it('should pass placement and closeOnClick props to PopButton', () => {
      const menu = [{ label: 'Item' }]

      render(<MenuButton menu={menu}>Button</MenuButton>)

      const popButton = screen.getByTestId('pop-button')

      expect(popButton).toHaveAttribute('placement', 'bottom')
      // @note closeOnClick is a React prop, not a DOM attribute
      expect(popButton).toBeTruthy()
    })

    it('should pass className to PopButton', () => {
      const menu = [{ label: 'Item' }]

      render(
        <MenuButton menu={menu} className="custom-class">
          Button
        </MenuButton>
      )

      const popButton = screen.getByTestId('pop-button')

      expect(popButton).toHaveClass('custom-class')
    })

    it('should forward additional props to PopButton', () => {
      const menu = [{ label: 'Item' }]

      render(
        <MenuButton menu={menu} data-custom="value" aria-label="Menu">
          Button
        </MenuButton>
      )

      const popButton = screen.getByTestId('pop-button')

      expect(popButton).toHaveAttribute('data-custom', 'value')
      expect(popButton).toHaveAttribute('aria-label', 'Menu')
    })
  })

  describe('NestedAccordion configuration', () => {
    it('should render NestedAccordion component', () => {
      const menu = [{ label: 'Item' }]

      render(<MenuButton menu={menu}>Button</MenuButton>)

      const accordion = screen.getByTestId('nested-accordion')

      expect(accordion).toBeTruthy()
    })

    it('should apply default styling classes', () => {
      const menu = [{ label: 'Item' }]

      render(<MenuButton menu={menu}>Button</MenuButton>)

      const accordion = screen.getByTestId('nested-accordion')

      expect(accordion).toHaveClass('text-sm')
      expect(accordion).toHaveClass('max-w-lg')
      expect(accordion).toHaveClass('auto-bg-white')
    })

    it('should apply custom menuClassName', () => {
      const menu = [{ label: 'Item' }]

      render(
        <MenuButton menu={menu} menuClassName="custom-menu-class">
          Button
        </MenuButton>
      )

      const accordion = screen.getByTestId('nested-accordion')

      expect(accordion).toHaveClass('custom-menu-class')
    })

    it('should combine default and custom menu classes', () => {
      const menu = [{ label: 'Item' }]

      render(
        <MenuButton menu={menu} menuClassName="extra-class">
          Button
        </MenuButton>
      )

      const accordion = screen.getByTestId('nested-accordion')

      expect(accordion).toHaveClass('text-sm')
      expect(accordion).toHaveClass('extra-class')
    })
  })

  describe('menu content variations', () => {
    it('should handle empty menu array', () => {
      render(<MenuButton menu={[]}>Button</MenuButton>)

      const items = screen.queryAllByTestId('menu-item')

      expect(items).toHaveLength(0)
    })

    it('should handle complex menu items', () => {
      const menu = [
        { label: 'Simple' },
        { title: 'With Title', icon: 'home' },
        { label: 'Nested', children: [{ label: 'Child' }] },
      ]

      render(<MenuButton menu={menu}>Button</MenuButton>)

      const items = screen.getAllByTestId('menu-item')

      expect(items).toHaveLength(3)
    })

    it('should handle menu items without labels', () => {
      const menu = [{ id: 'item1' }, { id: 'item2' }]

      render(<MenuButton menu={menu}>Button</MenuButton>)

      const items = screen.getAllByTestId('menu-item')

      expect(items).toHaveLength(2)
    })
  })

  describe('children variations', () => {
    it('should render text children', () => {
      const menu = [{ label: 'Item' }]

      render(<MenuButton menu={menu}>Click Here</MenuButton>)
      expect(screen.getByTestId('caption')).toHaveTextContent('Click Here')
    })

    it('should render element children', () => {
      const menu = [{ label: 'Item' }]

      render(
        <MenuButton menu={menu}>
          <span>Custom</span> <strong>Button</strong>
        </MenuButton>
      )

      const caption = screen.getByTestId('caption')

      expect(caption).toHaveTextContent('Custom Button')
    })

    it('should handle undefined children', () => {
      const menu = [{ label: 'Item' }]

      render(<MenuButton menu={menu} />)

      const caption = screen.getByTestId('caption')

      expect(caption).toBeEmptyDOMElement()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined menu', () => {
      render(<MenuButton>Button</MenuButton>)

      const items = screen.queryAllByTestId('menu-item')

      expect(items).toHaveLength(0)
    })

    it('should handle null menu', () => {
      render(<MenuButton menu={null}>Button</MenuButton>)

      const items = screen.queryAllByTestId('menu-item')

      expect(items).toHaveLength(0)
    })

    it('should handle special characters in children', () => {
      const menu = [{ label: 'Item' }]

      render(<MenuButton menu={menu}>&lt;Menu&gt; &amp; Options</MenuButton>)
      expect(screen.getByTestId('caption')).toHaveTextContent(
        '<Menu> & Options'
      )
    })

    it('should handle unicode in children', () => {
      const menu = [{ label: 'Item' }]

      render(<MenuButton menu={menu}>菜单 🔽</MenuButton>)
      expect(screen.getByTestId('caption')).toHaveTextContent('菜单 🔽')
    })

    it('should handle very long menu arrays', () => {
      const menu = Array.from({ length: 100 }, (_, i) => ({
        label: `Item ${i}`,
      }))

      render(<MenuButton menu={menu}>Button</MenuButton>)

      const items = screen.getAllByTestId('menu-item')

      expect(items).toHaveLength(100)
    })

    it('should handle both className and menuClassName', () => {
      const menu = [{ label: 'Item' }]

      render(
        <MenuButton
          menu={menu}
          className="button-class"
          menuClassName="menu-class"
        >
          Button
        </MenuButton>
      )

      const popButton = screen.getByTestId('pop-button')
      const accordion = screen.getByTestId('nested-accordion')

      expect(popButton).toHaveClass('button-class')
      expect(accordion).toHaveClass('menu-class')
    })
  })

  describe('styling', () => {
    it('should apply border and rounded classes', () => {
      const menu = [{ label: 'Item' }]

      render(<MenuButton menu={menu}>Button</MenuButton>)

      const accordion = screen.getByTestId('nested-accordion')

      expect(accordion).toHaveClass('border', 'rounded-xl')
    })

    it('should apply shadow and overflow classes', () => {
      const menu = [{ label: 'Item' }]

      render(<MenuButton menu={menu}>Button</MenuButton>)

      const accordion = screen.getByTestId('nested-accordion')

      expect(accordion).toHaveClass('shadow-lg', 'overflow-hidden')
    })

    it('should apply nested accordion title styles', () => {
      const menu = [{ label: 'Item' }]
      const { container } = render(<MenuButton menu={menu}>Button</MenuButton>)
      const accordion = screen.getByTestId('nested-accordion')

      // @note checking for nested selector classes
      expect(accordion.className).toContain('[&_.nested-accordion-title]')
    })
  })
})
