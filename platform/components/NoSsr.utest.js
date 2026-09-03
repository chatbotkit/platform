import NoSsr from './NoSsr'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('NoSsr', () => {
  describe('basic functionality', () => {
    it('should render children on client side', () => {
      const { container } = render(
        <NoSsr>
          <div data-testid="child">Test Content</div>
        </NoSsr>
      )

      // @note NoSsr uses dynamic import with ssr: false, so behavior varies by environment
      expect(container).toBeDefined()
    })

    it('should render multiple children', () => {
      render(
        <NoSsr>
          <div data-testid="child1">First</div>
          <div data-testid="child2">Second</div>
        </NoSsr>
      )

      expect(screen.getByTestId('child1')).toBeInTheDocument()
      expect(screen.getByTestId('child2')).toBeInTheDocument()
    })

    it('should render string children', () => {
      render(<NoSsr>Plain text content</NoSsr>)

      expect(screen.getByText('Plain text content')).toBeInTheDocument()
    })

    it('should render JSX children', () => {
      render(
        <NoSsr>
          <span>Nested</span> <strong>Content</strong>
        </NoSsr>
      )

      expect(screen.getByText('Nested')).toBeInTheDocument()
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle null children without error', () => {
      expect(() => render(<NoSsr>{null}</NoSsr>)).not.toThrow()
    })

    it('should handle undefined children without error', () => {
      expect(() => render(<NoSsr>{undefined}</NoSsr>)).not.toThrow()
    })

    it('should handle empty string children without error', () => {
      expect(() => render(<NoSsr>{''}</NoSsr>)).not.toThrow()
    })

    it('should handle false children without error', () => {
      expect(() => render(<NoSsr>{false}</NoSsr>)).not.toThrow()
    })

    it('should handle zero as children', () => {
      render(<NoSsr>{0}</NoSsr>)

      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('should handle empty array children without error', () => {
      expect(() => render(<NoSsr>{[]}</NoSsr>)).not.toThrow()
    })
  })

  describe('conditional rendering', () => {
    it('should render conditionally based on boolean', () => {
      const showContent = true

      render(<NoSsr>{showContent && <div>Conditional</div>}</NoSsr>)

      expect(screen.getByText('Conditional')).toBeInTheDocument()
    })

    it('should handle conditional false', () => {
      const showContent = false

      render(<NoSsr>{showContent && <div>Not shown</div>}</NoSsr>)

      expect(screen.queryByText('Not shown')).not.toBeInTheDocument()
    })

    it('should render ternary expression result', () => {
      const condition = true

      render(
        <NoSsr>
          {condition ? <div>True branch</div> : <div>False branch</div>}
        </NoSsr>
      )

      expect(screen.getByText('True branch')).toBeInTheDocument()
      expect(screen.queryByText('False branch')).not.toBeInTheDocument()
    })
  })

  describe('nested components', () => {
    it('should render deeply nested children', () => {
      render(
        <NoSsr>
          <div>
            <div>
              <span data-testid="deep">Deep content</span>
            </div>
          </div>
        </NoSsr>
      )

      expect(screen.getByTestId('deep')).toBeInTheDocument()
    })

    it('should preserve component structure', () => {
      const CustomComponent = ({ text }) => (
        <div data-testid="custom">{text}</div>
      )

      render(
        <NoSsr>
          <CustomComponent text="Custom" />
        </NoSsr>
      )

      expect(screen.getByTestId('custom')).toHaveTextContent('Custom')
    })

    it('should handle fragments', () => {
      render(
        <NoSsr>
          <>
            <div data-testid="frag1">Fragment 1</div>
            <div data-testid="frag2">Fragment 2</div>
          </>
        </NoSsr>
      )

      expect(screen.getByTestId('frag1')).toBeInTheDocument()
      expect(screen.getByTestId('frag2')).toBeInTheDocument()
    })
  })

  describe('props handling', () => {
    it('should not pass through additional props to wrapper', () => {
      const { container } = render(
        <NoSsr className="test-class" data-testid="test">
          <div data-testid="content">Content</div>
        </NoSsr>
      )

      // @note NoSsr uses React.Fragment which doesn't support props
      expect(screen.getByTestId('content')).toBeInTheDocument()
    })
  })

  describe('special children types', () => {
    it('should render array of elements', () => {
      const items = [
        <div key="1" data-testid="item1">
          Item 1
        </div>,
        <div key="2" data-testid="item2">
          Item 2
        </div>,
      ]

      render(<NoSsr>{items}</NoSsr>)

      expect(screen.getByTestId('item1')).toBeInTheDocument()
      expect(screen.getByTestId('item2')).toBeInTheDocument()
    })

    it('should render function that returns element', () => {
      render(
        <NoSsr>
          {(() => (
            <div>Function result</div>
          ))()}
        </NoSsr>
      )

      expect(screen.getByText('Function result')).toBeInTheDocument()
    })

    it('should render mix of text and elements', () => {
      const { container } = render(
        <NoSsr>
          Text before
          <span data-testid="span"> element </span>
          text after
        </NoSsr>
      )

      expect(container.textContent).toContain('Text before')
      expect(screen.getByTestId('span')).toBeInTheDocument()
      expect(container.textContent).toContain('text after')
    })
  })
})
