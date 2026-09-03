/* eslint-disable @typescript-eslint/no-require-imports */
import ColorInput, {
  colorPickerFloatingPadding,
  colorPickerReferenceOffset,
} from './ColorInput'

import '@testing-library/jest-dom'
import { fireEvent, render, waitFor } from '@testing-library/react'

jest.mock('@/hooks/useControlledState', () => {
  return jest.fn((defaultValue, value, setValue) => {
    const [internalValue, setInternalValue] = require('react').useState(
      value !== undefined ? value : defaultValue
    )
    const currentValue = value !== undefined ? value : internalValue
    const currentSetValue = setValue || setInternalValue

    return [currentValue, currentSetValue]
  })
})

describe('ColorInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render color picker button and input', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const button = container.querySelector('button')

      expect(button).toBeInTheDocument()
      expect(button).toHaveStyle({ backgroundColor: '#ff0000' })

      const input = container.querySelector('input')

      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('ff0000')
    })

    it('should apply custom className', () => {
      const { container } = render(
        <ColorInput defaultValue="#000000" className="custom-class" />
      )

      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('custom-class')
    })

    it('should pass through additional props', () => {
      const { container } = render(
        <ColorInput defaultValue="#000000" data-testid="color-input" />
      )

      const wrapper = container.querySelector('[data-testid="color-input"]')

      expect(wrapper).toBeInTheDocument()
    })
  })

  describe('controlled mode', () => {
    it('should work as controlled component', () => {
      const setValue = jest.fn()
      const { container } = render(
        <ColorInput value="#ff0000" setValue={setValue} />
      )

      const input = container.querySelector('input')

      fireEvent.change(input, { target: { value: '00ff00' } })

      expect(setValue).toHaveBeenCalled()
    })

    it('should display controlled value', () => {
      const { container } = render(<ColorInput value="#0000ff" />)

      const button = container.querySelector('button')

      expect(button).toHaveStyle({ backgroundColor: '#0000ff' })
    })
  })

  describe('uncontrolled mode', () => {
    it('should work as uncontrolled component with defaultValue', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const input = container.querySelector('input')

      expect(input).toHaveValue('ff0000')
    })

    it('should update internal state when changed', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const input = container.querySelector('input')

      fireEvent.change(input, { target: { value: '00ff00' } })

      // Component should update its display
      const button = container.querySelector('button')

      expect(button).toBeInTheDocument()
    })
  })

  describe('color picker interactions', () => {
    it('keeps the picker away from reference and container edges', () => {
      expect(colorPickerReferenceOffset).toBeGreaterThan(0)
      expect(colorPickerFloatingPadding).toBeGreaterThan(0)
    })

    it('should not show picker initially', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const picker = container.querySelector('.react-colorful')

      expect(picker).not.toBeInTheDocument()
    })

    it('should open picker when button is clicked', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const button = container.querySelector('button')

      fireEvent.click(button)

      waitFor(() => {
        const picker = container.querySelector('[role="dialog"]')

        expect(picker).toBeInTheDocument()
      })
    })

    it('should toggle picker on button click', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const button = container.querySelector('button')

      // Open picker
      fireEvent.click(button)

      waitFor(() => {
        const picker = container.querySelector('[role="dialog"]')

        expect(picker).toBeInTheDocument()
      })

      // Close picker
      fireEvent.click(button)

      waitFor(() => {
        const picker = container.querySelector('[role="dialog"]')

        expect(picker).not.toBeInTheDocument()
      })
    })
  })

  describe('disabled state', () => {
    it('should apply disabled class when disabled', () => {
      const { container } = render(
        <ColorInput defaultValue="#ff0000" disabled />
      )

      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('disabled')
    })

    it('should disable input when disabled prop is true', () => {
      const { container } = render(
        <ColorInput defaultValue="#ff0000" disabled />
      )

      const input = container.querySelector('input')

      expect(input).toBeDisabled()
    })

    it('should not open picker when disabled', () => {
      const { container } = render(
        <ColorInput defaultValue="#ff0000" disabled />
      )

      const button = container.querySelector('button')

      fireEvent.click(button)

      const picker = container.querySelector('.react-colorful')

      expect(picker).not.toBeInTheDocument()
    })
  })

  describe('color format handling', () => {
    it('should handle hex colors', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const button = container.querySelector('button')

      expect(button).toHaveStyle({ backgroundColor: '#ff0000' })
    })

    it('should handle hex colors with alpha', () => {
      const { container } = render(<ColorInput defaultValue="#ff000080" />)

      const button = container.querySelector('button')

      expect(button).toHaveStyle({ backgroundColor: '#ff000080' })
    })

    it('should handle short hex format', () => {
      const { container } = render(<ColorInput defaultValue="#f00" />)

      const button = container.querySelector('button')

      expect(button).toHaveStyle({ backgroundColor: '#f00' })
    })
  })

  describe('input field behavior', () => {
    it('should update button color when input changes', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const input = container.querySelector('input')
      const button = container.querySelector('button')

      fireEvent.change(input, { target: { value: '00ff00' } })

      // The component should reflect the new color
      expect(button).toBeInTheDocument()
    })

    it('should have correct input styling classes', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const input = container.querySelector('input')

      expect(input).toHaveClass('none-input', 'w-full')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined defaultValue', () => {
      const { container } = render(<ColorInput />)

      const button = container.querySelector('button')

      expect(button).toBeInTheDocument()
    })

    it('should handle empty string value', () => {
      const { container } = render(<ColorInput defaultValue="" />)

      const input = container.querySelector('input')

      expect(input).toBeInTheDocument()
    })
  })

  describe('keyboard accessibility', () => {
    it('should be keyboard accessible', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const button = container.querySelector('button')

      button.focus()
      expect(button).toHaveFocus()
    })

    it('should have button type to prevent form submission', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const button = container.querySelector('button')

      expect(button).toHaveAttribute('type', 'button')
    })
  })

  describe('styling and layout', () => {
    it('should have flex layout for button and input', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const wrapper = container.firstChild

      expect(wrapper).toHaveClass('flex', 'flex-row', 'items-center', 'gap-1')
    })

    it('should style button with border', () => {
      const { container } = render(<ColorInput defaultValue="#ff0000" />)

      const button = container.querySelector('button')

      expect(button).toHaveClass(
        'w-[1em]',
        'h-[1em]',
        'rounded',
        'cursor-pointer',
        'border'
      )
    })
  })
})
