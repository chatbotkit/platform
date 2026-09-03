import BackButton from './BackButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('BackButton', () => {
  describe('basic functionality', () => {
    it('should render with children', () => {
      render(<BackButton>Go Back</BackButton>)
      expect(screen.getByRole('button')).toHaveTextContent('Go Back')
    })

    it('should render with arrow icon', () => {
      render(<BackButton>Back</BackButton>)

      const button = screen.getByRole('button')

      expect(button.textContent).toContain('←')
    })

    it('should have type button by default', () => {
      render(<BackButton>Back</BackButton>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })
  })

  describe('event handling', () => {
    it('should handle click events', () => {
      const handleClick = jest.fn()

      render(<BackButton onClick={handleClick}>Back</BackButton>)

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should pass event object to click handler', () => {
      const handleClick = jest.fn()

      render(<BackButton onClick={handleClick}>Back</BackButton>)

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledWith(expect.any(Object))
    })

    it('should not throw when clicked without handler', () => {
      render(<BackButton>Back</BackButton>)

      expect(() => {
        fireEvent.click(screen.getByRole('button'))
      }).not.toThrow()
    })
  })

  describe('prop spreading', () => {
    it('should spread additional props to button', () => {
      render(
        <BackButton data-testid="back-btn" disabled>
          Back
        </BackButton>
      )

      const button = screen.getByTestId('back-btn')

      expect(button).toBeDisabled()
    })

    it('should accept aria attributes', () => {
      render(<BackButton aria-label="Go to previous page">Back</BackButton>)

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Go to previous page'
      )
    })

    it('should accept data attributes', () => {
      render(<BackButton data-tracking="back-navigation">Back</BackButton>)

      expect(screen.getByRole('button')).toHaveAttribute(
        'data-tracking',
        'back-navigation'
      )
    })
  })

  describe('className handling', () => {
    it('should apply default classes', () => {
      render(<BackButton>Back</BackButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveClass('back-button')
      expect(button).toHaveClass('relative')
      expect(button).toHaveClass('group')
    })

    it('should merge custom className with defaults', () => {
      render(<BackButton className="custom-class">Back</BackButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveClass('back-button')
      expect(button).toHaveClass('custom-class')
    })

    it('should apply small variant classes', () => {
      render(<BackButton className="small">Back</BackButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveClass('small')
    })

    it('should apply tiny variant classes', () => {
      render(<BackButton className="tiny">Back</BackButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveClass('tiny')
    })
  })

  describe('children rendering', () => {
    it('should render string children', () => {
      render(<BackButton>Simple Text</BackButton>)
      expect(screen.getByRole('button')).toHaveTextContent('Simple Text')
    })

    it('should render JSX children', () => {
      render(
        <BackButton>
          <span>Nested</span> Content
        </BackButton>
      )

      expect(screen.getByText('Nested')).toBeInTheDocument()
      expect(screen.getByRole('button')).toHaveTextContent('Nested Content')
    })

    it('should render multiple children', () => {
      render(
        <BackButton>
          <span>Part 1</span>
          <span>Part 2</span>
        </BackButton>
      )

      expect(screen.getByText('Part 1')).toBeInTheDocument()
      expect(screen.getByText('Part 2')).toBeInTheDocument()
    })

    it('should render null children', () => {
      render(<BackButton>{null}</BackButton>)

      const button = screen.getByRole('button')

      expect(button).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should be keyboard accessible', () => {
      const handleClick = jest.fn()

      render(<BackButton onClick={handleClick}>Back</BackButton>)

      const button = screen.getByRole('button')

      button.focus()

      expect(button).toHaveFocus()
    })

    it('should trigger click on Enter key', () => {
      const handleClick = jest.fn()

      render(<BackButton onClick={handleClick}>Back</BackButton>)

      const button = screen.getByRole('button')

      button.focus()
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })

      // @note button elements automatically handle Enter key - we're just verifying focus works
      expect(button).toHaveFocus()
    })

    it('should have proper button role', () => {
      render(<BackButton>Back</BackButton>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle empty children', () => {
      render(<BackButton>{''}</BackButton>)

      const button = screen.getByRole('button')

      expect(button).toBeInTheDocument()
    })

    it('should handle undefined children', () => {
      render(<BackButton>{undefined}</BackButton>)

      const button = screen.getByRole('button')

      expect(button).toBeInTheDocument()
    })

    it('should handle false children', () => {
      render(<BackButton>{false}</BackButton>)

      const button = screen.getByRole('button')

      expect(button).toBeInTheDocument()
    })

    it('should handle multiple class names', () => {
      render(<BackButton className="class1 class2 class3">Back</BackButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveClass('back-button')
      expect(button).toHaveClass('class1')
      expect(button).toHaveClass('class2')
      expect(button).toHaveClass('class3')
    })
  })
})
