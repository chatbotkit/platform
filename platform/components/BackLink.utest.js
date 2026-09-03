import BackLink from './BackLink'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Link', () => {
  return function Link({ children, ...props }) {
    return <a {...props}>{children}</a>
  }
})

describe('BackLink', () => {
  describe('basic functionality', () => {
    it('should render with children', () => {
      render(<BackLink href="/previous">Go Back</BackLink>)
      expect(screen.getByRole('link')).toHaveTextContent('Go Back')
    })

    it('should render with arrow icon', () => {
      render(<BackLink href="/previous">Back</BackLink>)

      const link = screen.getByRole('link')

      expect(link.textContent).toContain('←')
    })

    it('should render as a link element', () => {
      render(<BackLink href="/previous">Back</BackLink>)
      expect(screen.getByRole('link')).toBeInTheDocument()
    })
  })

  describe('prop spreading', () => {
    it('should spread href to Link component', () => {
      render(<BackLink href="/dashboard">Back</BackLink>)
      expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard')
    })

    it('should spread additional props to Link', () => {
      render(
        <BackLink href="/back" data-testid="back-link">
          Back
        </BackLink>
      )

      expect(screen.getByTestId('back-link')).toBeInTheDocument()
    })

    it('should accept aria attributes', () => {
      render(
        <BackLink href="/previous" aria-label="Go to previous page">
          Back
        </BackLink>
      )

      expect(screen.getByRole('link')).toHaveAttribute(
        'aria-label',
        'Go to previous page'
      )
    })

    it('should accept data attributes', () => {
      render(
        <BackLink href="/previous" data-tracking="back-navigation">
          Back
        </BackLink>
      )

      expect(screen.getByRole('link')).toHaveAttribute(
        'data-tracking',
        'back-navigation'
      )
    })

    it('should accept target attribute', () => {
      render(
        <BackLink href="/previous" target="_blank">
          Back
        </BackLink>
      )

      expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
    })

    it('should accept rel attribute', () => {
      render(
        <BackLink href="/external" rel="noopener noreferrer">
          Back
        </BackLink>
      )

      expect(screen.getByRole('link')).toHaveAttribute(
        'rel',
        'noopener noreferrer'
      )
    })
  })

  describe('className handling', () => {
    it('should apply default classes', () => {
      render(<BackLink href="/back">Back</BackLink>)

      const link = screen.getByRole('link')

      expect(link).toHaveClass('back-link')
      expect(link).toHaveClass('relative')
      expect(link).toHaveClass('group')
    })

    it('should merge custom className with defaults', () => {
      render(
        <BackLink href="/back" className="custom-class">
          Back
        </BackLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveClass('back-link')
      expect(link).toHaveClass('custom-class')
    })

    it('should apply small variant classes', () => {
      render(
        <BackLink href="/back" className="small">
          Back
        </BackLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveClass('small')
    })

    it('should apply tiny variant classes', () => {
      render(
        <BackLink href="/back" className="tiny">
          Back
        </BackLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveClass('tiny')
    })

    it('should handle multiple class names', () => {
      render(
        <BackLink href="/back" className="class1 class2 class3">
          Back
        </BackLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveClass('back-link')
      expect(link).toHaveClass('class1')
      expect(link).toHaveClass('class2')
      expect(link).toHaveClass('class3')
    })
  })

  describe('children rendering', () => {
    it('should render string children', () => {
      render(<BackLink href="/back">Simple Text</BackLink>)
      expect(screen.getByRole('link')).toHaveTextContent('Simple Text')
    })

    it('should render JSX children', () => {
      render(
        <BackLink href="/back">
          <span>Nested</span> Content
        </BackLink>
      )

      expect(screen.getByText('Nested')).toBeInTheDocument()
      expect(screen.getByRole('link')).toHaveTextContent('Nested Content')
    })

    it('should render multiple children', () => {
      render(
        <BackLink href="/back">
          <span>Part 1</span>
          <span>Part 2</span>
        </BackLink>
      )

      expect(screen.getByText('Part 1')).toBeInTheDocument()
      expect(screen.getByText('Part 2')).toBeInTheDocument()
    })

    it('should render null children', () => {
      render(<BackLink href="/back">{null}</BackLink>)

      const link = screen.getByRole('link')

      expect(link).toBeInTheDocument()
    })

    it('should handle empty children', () => {
      render(<BackLink href="/back">{''}</BackLink>)

      const link = screen.getByRole('link')

      expect(link).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should be keyboard accessible', () => {
      render(<BackLink href="/back">Back</BackLink>)

      const link = screen.getByRole('link')

      link.focus()

      expect(link).toHaveFocus()
    })

    it('should have proper link role', () => {
      render(<BackLink href="/back">Back</BackLink>)
      expect(screen.getByRole('link')).toBeInTheDocument()
    })

    it('should support custom aria-label', () => {
      render(
        <BackLink href="/back" aria-label="Return to dashboard">
          Back
        </BackLink>
      )

      expect(screen.getByRole('link')).toHaveAttribute(
        'aria-label',
        'Return to dashboard'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle undefined children', () => {
      render(<BackLink href="/back">{undefined}</BackLink>)

      const link = screen.getByRole('link')

      expect(link).toBeInTheDocument()
    })

    it('should handle false children', () => {
      render(<BackLink href="/back">{false}</BackLink>)

      const link = screen.getByRole('link')

      expect(link).toBeInTheDocument()
    })

    it('should handle complex href patterns', () => {
      render(<BackLink href="/path/with/multiple/segments">Back</BackLink>)

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/path/with/multiple/segments'
      )
    })

    it('should handle query parameters in href', () => {
      render(<BackLink href="/back?id=123&tab=info">Back</BackLink>)

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/back?id=123&tab=info'
      )
    })

    it('should handle hash in href', () => {
      render(<BackLink href="/back#section">Back</BackLink>)

      expect(screen.getByRole('link')).toHaveAttribute('href', '/back#section')
    })
  })
})
