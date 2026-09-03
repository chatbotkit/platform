import ForwardLink from './ForwardLink'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Link', () => {
  return function MockLink({ children, className, ...props }) {
    return (
      <a className={className} {...props}>
        {children}
      </a>
    )
  }
})

describe('ForwardLink', () => {
  describe('rendering', () => {
    it('should render children text', () => {
      render(<ForwardLink href="/test">Click me</ForwardLink>)

      expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    it('should render with forward arrow', () => {
      const { container } = render(
        <ForwardLink href="/test">Navigate</ForwardLink>
      )

      expect(container.textContent).toContain('→')
    })

    it('should apply default group and relative classes', () => {
      const { container } = render(<ForwardLink href="/test">Link</ForwardLink>)

      const link = container.querySelector('a')

      expect(link).toHaveClass('relative')
      expect(link).toHaveClass('group')
    })

    it('should apply custom className', () => {
      const { container } = render(
        <ForwardLink href="/test" className="custom-class">
          Link
        </ForwardLink>
      )

      const link = container.querySelector('a')

      expect(link).toHaveClass('custom-class')
      expect(link).toHaveClass('relative')
      expect(link).toHaveClass('group')
    })

    it('should forward props to Link component', () => {
      const { container } = render(
        <ForwardLink href="/test" data-testid="forward-link">
          Link
        </ForwardLink>
      )

      const link = container.querySelector('a')

      expect(link).toHaveAttribute('href', '/test')
      expect(link).toHaveAttribute('data-testid', 'forward-link')
    })

    it('should wrap children in span with margin', () => {
      const { container } = render(
        <ForwardLink href="/test">Link Text</ForwardLink>
      )

      const childSpan = container.querySelector('span.mr-6')

      expect(childSpan).toBeInTheDocument()
      expect(childSpan).toHaveTextContent('Link Text')
    })

    it('should render arrow in positioned span', () => {
      const { container } = render(<ForwardLink href="/test">Link</ForwardLink>)

      const arrowSpan = container.querySelector(
        'span.absolute.right-5.group-hover\\:translate-x-1.transition-all'
      )

      expect(arrowSpan).toBeInTheDocument()
      expect(arrowSpan).toHaveTextContent('→')
    })
  })

  describe('edge cases', () => {
    it('should handle empty children', () => {
      const { container } = render(<ForwardLink href="/test" />)

      const link = container.querySelector('a')

      expect(link).toBeInTheDocument()
    })

    it('should handle multiple children', () => {
      render(
        <ForwardLink href="/test">
          <span>Part 1</span>
          <span>Part 2</span>
        </ForwardLink>
      )

      expect(screen.getByText('Part 1')).toBeInTheDocument()
      expect(screen.getByText('Part 2')).toBeInTheDocument()
    })

    it('should handle no href prop', () => {
      const { container } = render(<ForwardLink>No Link</ForwardLink>)

      const link = container.querySelector('a')

      expect(link).toBeInTheDocument()
    })
  })
})
