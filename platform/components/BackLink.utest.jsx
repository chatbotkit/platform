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
      render(<BackLink href="/home">Go Back</BackLink>)
      expect(screen.getByText('Go Back')).toBeInTheDocument()
    })

    it('should render the left arrow', () => {
      render(<BackLink href="/home">Go Back</BackLink>)

      const arrow = screen.getByText('←')

      expect(arrow).toBeInTheDocument()
      expect(arrow).toHaveClass('back-link-arrow')
    })

    it('should apply href prop', () => {
      render(<BackLink href="/previous">Back</BackLink>)

      const link = screen.getByRole('link')

      expect(link).toHaveAttribute('href', '/previous')
    })

    it('should render as a custom component', () => {
      render(
        <BackLink as="button" type="button">
          Back
        </BackLink>
      )

      const button = screen.getByRole('button')

      expect(button).toHaveClass('back-link')
      expect(button).toHaveAttribute('type', 'button')
    })
  })

  describe('styling and classes', () => {
    it('should apply base classes', () => {
      render(<BackLink href="/home">Back</BackLink>)

      const link = screen.getByRole('link')

      expect(link).toHaveClass('back-link')
      expect(link).toHaveClass('relative')
      expect(link).toHaveClass('group')
    })

    it('should apply custom className', () => {
      render(
        <BackLink href="/home" className="custom-class">
          Back
        </BackLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveClass('custom-class')
      expect(link).toHaveClass('back-link')
    })

    it('should apply small modifier class', () => {
      render(
        <BackLink href="/home" className="small">
          Back
        </BackLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveClass('small')
    })

    it('should apply tiny modifier class', () => {
      render(
        <BackLink href="/home" className="tiny">
          Back
        </BackLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveClass('tiny')
    })
  })

  describe('children rendering', () => {
    it('should render text children', () => {
      render(<BackLink href="/home">Go to Previous Page</BackLink>)
      expect(screen.getByText('Go to Previous Page')).toBeInTheDocument()
    })

    it('should render children inside span with ml-6 class', () => {
      render(<BackLink href="/home">Back</BackLink>)

      const childrenSpan = screen.getByText('Back')

      expect(childrenSpan).toHaveClass('back-link-children')
      expect(childrenSpan).toHaveClass('ml-6')
    })

    it('should render complex children', () => {
      render(
        <BackLink href="/home">
          <span>Go</span> <strong>Back</strong>
        </BackLink>
      )
      expect(screen.getByText('Go')).toBeInTheDocument()
      expect(screen.getByText('Back')).toBeInTheDocument()
    })
  })

  describe('additional props', () => {
    it('should pass through additional props', () => {
      render(
        <BackLink
          href="/home"
          data-testid="back-link"
          aria-label="Navigate back"
        >
          Back
        </BackLink>
      )

      const link = screen.getByTestId('back-link')

      expect(link).toHaveAttribute('aria-label', 'Navigate back')
    })

    it('should handle target prop', () => {
      render(
        <BackLink href="/external" target="_blank">
          External
        </BackLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveAttribute('target', '_blank')
    })
  })

  describe('edge cases', () => {
    it('should handle empty children', () => {
      render(<BackLink href="/home"></BackLink>)

      const link = screen.getByRole('link')

      expect(link).toBeInTheDocument()
    })

    it('should handle undefined className', () => {
      render(<BackLink href="/home">Back</BackLink>)

      const link = screen.getByRole('link')

      expect(link).toHaveClass('back-link')
    })

    it('should handle multiple className modifiers', () => {
      render(
        <BackLink href="/home" className="small custom-style">
          Back
        </BackLink>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveClass('small')
      expect(link).toHaveClass('custom-style')
    })
  })
})
