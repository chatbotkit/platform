import BackButton from './BackButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('BackButton', () => {
  describe('basic functionality', () => {
    it('should render with children', () => {
      render(<BackButton>Go Back</BackButton>)
      expect(screen.getByRole('button')).toHaveTextContent('Go Back')
    })

    it('should render with default type button', () => {
      render(<BackButton>Back</BackButton>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })

    it('should render as a custom component', () => {
      render(
        <BackButton as="a" href="/previous">
          Back
        </BackButton>
      )

      const link = screen.getByRole('link')

      expect(link).toHaveClass('back-button')
      expect(link).toHaveAttribute('href', '/previous')
      expect(link).not.toHaveAttribute('type')
    })

    it('should render arrow character', () => {
      render(<BackButton>Back</BackButton>)

      const button = screen.getByRole('button')

      expect(button.textContent).toContain('←')
    })
  })

  describe('props handling', () => {
    it('should apply custom className', () => {
      render(<BackButton className="custom-class">Back</BackButton>)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })

    it('should preserve default classes with custom className', () => {
      render(<BackButton className="custom-class">Back</BackButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveClass('back-button')
      expect(button).toHaveClass('custom-class')
    })

    it('should forward additional props', () => {
      render(
        <BackButton data-testid="test-button" aria-label="Navigate back">
          Back
        </BackButton>
      )

      const button = screen.getByRole('button')

      expect(button).toHaveAttribute('data-testid', 'test-button')
      expect(button).toHaveAttribute('aria-label', 'Navigate back')
    })

    it('should handle disabled prop', () => {
      render(<BackButton disabled>Back</BackButton>)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('event handling', () => {
    it('should handle click events', () => {
      const handleClick = jest.fn()

      render(<BackButton onClick={handleClick}>Back</BackButton>)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not trigger click when disabled', () => {
      const handleClick = jest.fn()

      render(
        <BackButton disabled onClick={handleClick}>
          Back
        </BackButton>
      )
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('structure and styling', () => {
    it('should have proper structure with arrow and children', () => {
      const { container } = render(<BackButton>Back</BackButton>)
      const arrow = container.querySelector('.back-button-arrow')
      const children = container.querySelector('.back-button-children')

      expect(arrow).toBeInTheDocument()
      expect(children).toBeInTheDocument()
      expect(children).toHaveTextContent('Back')
    })

    it('should apply group class for hover effects', () => {
      render(<BackButton>Back</BackButton>)
      expect(screen.getByRole('button')).toHaveClass('group')
    })
  })

  describe('edge cases', () => {
    it('should render without children', () => {
      render(<BackButton />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle empty string as children', () => {
      render(<BackButton>{''}</BackButton>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle complex children', () => {
      render(
        <BackButton>
          <span>Go</span> <strong>Back</strong>
        </BackButton>
      )

      const button = screen.getByRole('button')

      expect(button).toHaveTextContent('Go Back')
    })
  })
})
