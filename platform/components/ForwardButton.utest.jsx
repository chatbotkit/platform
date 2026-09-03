import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import ForwardButton from './ForwardButton'

describe('ForwardButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render with children', () => {
      render(<ForwardButton>Click me</ForwardButton>)

      expect(screen.getByRole('button')).toHaveTextContent('Click me')
    })

    it('should render as button type', () => {
      render(<ForwardButton>Button</ForwardButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveAttribute('type', 'button')
    })

    it('should render arrow indicator', () => {
      render(<ForwardButton>Next</ForwardButton>)

      const button = screen.getByRole('button')

      expect(button.textContent).toContain('→')
    })
  })

  describe('styling', () => {
    it('should apply base classes', () => {
      render(<ForwardButton>Base</ForwardButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveClass('relative')
      expect(button).toHaveClass('group')
    })

    it('should merge custom className', () => {
      render(<ForwardButton className="custom-class">Custom</ForwardButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveClass('relative')
      expect(button).toHaveClass('group')
      expect(button).toHaveClass('custom-class')
    })

    it('should handle empty className', () => {
      render(<ForwardButton className="">Empty</ForwardButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveClass('relative')
      expect(button).toHaveClass('group')
    })

    it('should handle undefined className', () => {
      render(<ForwardButton>No class</ForwardButton>)

      const button = screen.getByRole('button')

      expect(button).toHaveClass('relative')
      expect(button).toHaveClass('group')
    })
  })

  describe('event handling', () => {
    it('should handle click events', () => {
      const handleClick = jest.fn()

      render(<ForwardButton onClick={handleClick}>Click</ForwardButton>)

      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not trigger click when disabled', () => {
      const handleClick = jest.fn()

      render(
        <ForwardButton onClick={handleClick} disabled>
          Disabled
        </ForwardButton>
      )

      const button = screen.getByRole('button')

      expect(button).toBeDisabled()

      fireEvent.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should handle keyboard events', () => {
      const handleKeyDown = jest.fn()

      render(<ForwardButton onKeyDown={handleKeyDown}>Key</ForwardButton>)

      const button = screen.getByRole('button')

      fireEvent.keyDown(button, { key: 'Enter' })
      expect(handleKeyDown).toHaveBeenCalledTimes(1)
    })
  })

  describe('additional props', () => {
    it('should forward additional props', () => {
      render(
        <ForwardButton
          data-testid="custom-button"
          aria-label="Forward action"
          id="forward-btn"
        >
          Props
        </ForwardButton>
      )

      const button = screen.getByRole('button')

      expect(button).toHaveAttribute('data-testid', 'custom-button')
      expect(button).toHaveAttribute('aria-label', 'Forward action')
      expect(button).toHaveAttribute('id', 'forward-btn')
    })

    it('should handle disabled prop', () => {
      render(<ForwardButton disabled>Disabled</ForwardButton>)

      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('edge cases', () => {
    it('should handle empty children', () => {
      render(<ForwardButton />)

      const button = screen.getByRole('button')

      expect(button).toBeInTheDocument()
    })

    it('should handle null children', () => {
      render(<ForwardButton>{null}</ForwardButton>)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle multiple children', () => {
      render(
        <ForwardButton>
          <span>Part 1</span>
          <span>Part 2</span>
        </ForwardButton>
      )

      const button = screen.getByRole('button')

      expect(button).toHaveTextContent('Part 1')
      expect(button).toHaveTextContent('Part 2')
    })

    it('should handle numeric children', () => {
      render(<ForwardButton>{42}</ForwardButton>)

      expect(screen.getByRole('button')).toHaveTextContent('42')
    })
  })

  describe('accessibility', () => {
    it('should be focusable', () => {
      render(<ForwardButton>Focus</ForwardButton>)

      const button = screen.getByRole('button')

      button.focus()
      expect(button).toHaveFocus()
    })

    it('should support aria-label', () => {
      render(<ForwardButton aria-label="Next step">Next</ForwardButton>)

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Next step'
      )
    })

    it('should not be focusable when disabled', () => {
      render(<ForwardButton disabled>Disabled</ForwardButton>)

      const button = screen.getByRole('button')

      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('disabled')
    })
  })
})
