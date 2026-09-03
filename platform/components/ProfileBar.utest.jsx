import ProfileBar from './ProfileBar'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock(
  '@/components/ProfileDropdown',
  () =>
    function ProfileDropdown({ children, ...props }) {
      return (
        <div data-testid="profile-dropdown" {...props}>
          {children}
        </div>
      )
    }
)

describe('ProfileBar', () => {
  describe('basic functionality', () => {
    it('should render without errors', () => {
      render(<ProfileBar />)
      expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument()
    })

    it('should render ProfileDropdown component', () => {
      render(<ProfileBar />)
      expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument()
    })

    it('should forward props to ProfileDropdown', () => {
      render(<ProfileBar user={{ name: 'Test User' }} />)

      const dropdown = screen.getByTestId('profile-dropdown')

      expect(dropdown).toHaveAttribute('user')
    })

    it('should render dropdownChildren inside ProfileDropdown', () => {
      render(<ProfileBar dropdownChildren={<div>Dropdown Content</div>} />)
      expect(screen.getByText('Dropdown Content')).toBeInTheDocument()
    })

    it('should render children content', () => {
      render(
        <ProfileBar>
          <button type="button">Action Button</button>
        </ProfileBar>
      )
      expect(screen.getByText('Action Button')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('should apply default classes', () => {
      const { container } = render(<ProfileBar />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('fixed')
      expect(wrapper).toHaveClass('z-40')
      expect(wrapper).toHaveClass('top-0')
      expect(wrapper).toHaveClass('right-0')
    })

    it('should apply custom className', () => {
      const { container } = render(<ProfileBar className="custom-class" />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('custom-class')
    })

    it('should merge custom className with default classes', () => {
      const { container } = render(<ProfileBar className="extra-class" />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('extra-class')
      expect(wrapper).toHaveClass('fixed')
      expect(wrapper).toHaveClass('z-40')
    })

    it('should have responsive width classes', () => {
      const { container } = render(<ProfileBar />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('w-full')
      expect(wrapper).toHaveClass('sm:w-auto')
    })

    it('should have responsive background classes', () => {
      const { container } = render(<ProfileBar />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('bg-white')
      expect(wrapper).toHaveClass('dark:bg-black')
      expect(wrapper).toHaveClass('sm:bg-transparent')
      expect(wrapper).toHaveClass('dark:sm:bg-transparent')
    })

    it('should have border classes', () => {
      const { container } = render(<ProfileBar />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('border-b')
      expect(wrapper).toHaveClass('border-gray-200')
      expect(wrapper).toHaveClass('dark:border-gray-800')
      expect(wrapper).toHaveClass('sm:border-0')
    })

    it('should have flexbox layout classes', () => {
      const { container } = render(<ProfileBar />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('flex')
      expect(wrapper).toHaveClass('flex-row')
      expect(wrapper).toHaveClass('gap-2')
      expect(wrapper).toHaveClass('justify-end')
      expect(wrapper).toHaveClass('items-center')
    })

    it('should have padding classes', () => {
      const { container } = render(<ProfileBar />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('p-4')
    })
  })

  describe('stretch', () => {
    it('should span from the left edge with an opaque background', () => {
      const { container } = render(<ProfileBar stretch={true} />)
      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('left-0')
      expect(wrapper).toHaveClass('auto-bg-white')
      expect(wrapper).toHaveClass('border-b')
    })

    it('should not constrain its width when stretched', () => {
      const { container } = render(<ProfileBar stretch={true} />)
      const wrapper = container.firstChild

      expect(wrapper).not.toHaveClass('w-full')
      expect(wrapper).not.toHaveClass('sm:w-auto')
      expect(wrapper).not.toHaveClass('sm:bg-transparent')
    })

    it('should not stretch by default', () => {
      const { container } = render(<ProfileBar />)
      const wrapper = container.firstChild

      expect(wrapper).not.toHaveClass('left-0')
      expect(wrapper).toHaveClass('sm:w-auto')
    })

    it('should not forward stretch to ProfileDropdown', () => {
      render(<ProfileBar stretch={true} />)

      expect(screen.getByTestId('profile-dropdown')).not.toHaveAttribute(
        'stretch'
      )
    })
  })

  describe('leading', () => {
    it('should render leading content', () => {
      render(<ProfileBar leading={<div>Breadcrumbs</div>} />)
      expect(screen.getByText('Breadcrumbs')).toBeInTheDocument()
    })

    it('should render leading content before children', () => {
      const { container } = render(
        <ProfileBar leading={<span data-testid="leading">Leading</span>}>
          <span data-testid="child">Child</span>
        </ProfileBar>
      )

      const wrapper = container.firstChild
      const children = Array.from(wrapper.children)

      const leadingIndex = children.findIndex((child) =>
        child.contains(screen.getByTestId('leading'))
      )

      const childIndex = children.indexOf(screen.getByTestId('child'))

      expect(leadingIndex).toBe(0)
      expect(leadingIndex).toBeLessThan(childIndex)
    })

    it('should push the remaining content to the end of the bar', () => {
      const { container } = render(<ProfileBar leading={<div>Leading</div>} />)
      const wrapper = container.firstChild

      expect(wrapper.firstChild).toHaveClass('mr-auto')
    })

    it('should not render a leading slot without leading content', () => {
      const { container } = render(<ProfileBar />)
      const wrapper = container.firstChild

      expect(wrapper.children).toHaveLength(1)
      expect(wrapper.firstChild).toBe(screen.getByTestId('profile-dropdown'))
    })

    it('should not forward leading to ProfileDropdown', () => {
      render(<ProfileBar leading={<div>Leading</div>} />)

      expect(screen.getByTestId('profile-dropdown')).not.toHaveAttribute(
        'leading'
      )
    })
  })

  describe('children rendering', () => {
    it('should render multiple children in correct order', () => {
      const { container } = render(
        <ProfileBar>
          <button type="button">First</button>
          <button type="button">Second</button>
        </ProfileBar>
      )

      const buttons = container.querySelectorAll('button')

      expect(buttons).toHaveLength(2)
      expect(buttons[0]).toHaveTextContent('First')
      expect(buttons[1]).toHaveTextContent('Second')
    })

    it('should render children before ProfileDropdown', () => {
      const { container } = render(
        <ProfileBar>
          <span data-testid="child">Child</span>
        </ProfileBar>
      )

      const wrapper = container.firstChild
      const child = screen.getByTestId('child')
      const dropdown = screen.getByTestId('profile-dropdown')

      // Check order in DOM
      const childIndex = Array.from(wrapper.children).indexOf(child)
      const dropdownIndex = Array.from(wrapper.children).indexOf(dropdown)

      expect(childIndex).toBeLessThan(dropdownIndex)
    })

    it('should work without children', () => {
      render(<ProfileBar />)
      expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument()
    })
  })

  describe('dropdown children', () => {
    it('should pass dropdownChildren to ProfileDropdown', () => {
      render(
        <ProfileBar
          dropdownChildren={<div data-testid="dropdown-item">Settings</div>}
        />
      )
      expect(screen.getByTestId('dropdown-item')).toBeInTheDocument()
    })

    it('should handle multiple dropdownChildren elements', () => {
      render(
        <ProfileBar
          dropdownChildren={
            <>
              <div>Item 1</div>
              <div>Item 2</div>
            </>
          }
        />
      )
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
    })

    it('should work without dropdownChildren', () => {
      render(<ProfileBar />)

      const dropdown = screen.getByTestId('profile-dropdown')

      expect(dropdown).toBeEmptyDOMElement()
    })
  })

  describe('edge cases', () => {
    it('should handle null children', () => {
      render(<ProfileBar>{null}</ProfileBar>)
      expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument()
    })

    it('should handle undefined children', () => {
      render(<ProfileBar>{undefined}</ProfileBar>)
      expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument()
    })

    it('should handle false children', () => {
      render(<ProfileBar>{false}</ProfileBar>)
      expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument()
    })

    it('should handle conditional children rendering', () => {
      const showButton = true

      render(
        <ProfileBar>
          {showButton && <button type="button">Conditional</button>}
        </ProfileBar>
      )
      expect(screen.getByText('Conditional')).toBeInTheDocument()
    })

    it('should handle complex nested children', () => {
      render(
        <ProfileBar>
          <div>
            <span>
              <button type="button">Nested Button</button>
            </span>
          </div>
        </ProfileBar>
      )
      expect(screen.getByText('Nested Button')).toBeInTheDocument()
    })
  })

  describe('props forwarding', () => {
    it('should forward props to ProfileDropdown', () => {
      render(<ProfileBar data-custom="value" user={{ name: 'Test' }} />)

      const dropdown = screen.getByTestId('profile-dropdown')

      expect(dropdown).toHaveAttribute('data-custom', 'value')
      expect(dropdown).toHaveAttribute('user')
    })

    it('should forward style prop to ProfileDropdown', () => {
      render(<ProfileBar style={{ backgroundColor: 'red' }} />)

      const dropdown = screen.getByTestId('profile-dropdown')

      // Style should be forwarded to ProfileDropdown
      expect(dropdown).toHaveStyle({ backgroundColor: 'red' })
    })

    it('should not override fixed positioning with props', () => {
      const { container } = render(<ProfileBar className="relative" />)
      const wrapper = container.firstChild

      // Both classes should be present, fixed comes first
      expect(wrapper).toHaveClass('fixed')
      expect(wrapper).toHaveClass('relative')
    })
  })
})
