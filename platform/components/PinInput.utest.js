/* eslint-disable @typescript-eslint/no-require-imports */
import PinInput from './PinInput'

import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('react-pin-field', () => ({
  __esModule: true,
  default: ({ className, handler, length, onComplete, autoFocus }) => (
    <div
      data-testid="pin-field"
      data-class={className}
      data-length={length}
      data-autofocus={autoFocus}
      onClick={() => onComplete?.('123456')}
    />
  ),
  usePinField: jest.fn(),
}))

jest.mock('@/hooks/useControlledState')

describe('PinInput', () => {
  let mockHandler
  let mockUseControlledState

  beforeEach(() => {
    jest.clearAllMocks()

    mockHandler = {
      value: '',
      setValue: jest.fn(),
    }

    const { usePinField } = require('react-pin-field')

    usePinField.mockReturnValue(mockHandler)

    mockUseControlledState = jest.fn((defaultValue, value, setValue) => [
      value ?? defaultValue ?? '',
      setValue ?? jest.fn(),
    ])

    const useControlledState = require('@/hooks/useControlledState').default

    useControlledState.mockImplementation(mockUseControlledState)
  })

  describe('basic functionality', () => {
    it('should render pin input container', () => {
      render(<PinInput length={6} />)

      expect(screen.getByTestId('pin-field')).toBeTruthy()
    })

    it('should render hidden input with name', () => {
      render(<PinInput name="pin-code" length={6} />)

      const hiddenInput = document.querySelector('input[type="hidden"]')

      expect(hiddenInput).toBeTruthy()
      expect(hiddenInput.getAttribute('name')).toBe('pin-code')
    })

    it('should pass length to PinField', () => {
      render(<PinInput length={4} />)

      const pinField = screen.getByTestId('pin-field')

      expect(pinField.getAttribute('data-length')).toBe('4')
    })

    it('should pass autoFocus to PinField', () => {
      render(<PinInput length={6} autoFocus />)

      const pinField = screen.getByTestId('pin-field')

      expect(pinField.getAttribute('data-autofocus')).toBe('true')
    })
  })

  describe('controlled state', () => {
    it('should use useControlledState hook', () => {
      const setValue = jest.fn()

      render(
        <PinInput
          defaultValue="123"
          value="456"
          setValue={setValue}
          length={6}
        />
      )

      expect(mockUseControlledState).toHaveBeenCalledWith(
        '123',
        '456',
        setValue
      )
    })

    it('should work as controlled component', () => {
      const setValue = jest.fn()

      mockUseControlledState.mockReturnValue(['456', setValue])

      render(<PinInput value="456" setValue={setValue} length={6} />)

      const hiddenInput = document.querySelector('input[type="hidden"]')

      expect(hiddenInput.value).toBe('456')
    })

    it('should work as uncontrolled component', () => {
      const setValue = jest.fn()

      mockUseControlledState.mockReturnValue(['789', setValue])

      render(<PinInput defaultValue="789" length={6} />)

      const hiddenInput = document.querySelector('input[type="hidden"]')

      expect(hiddenInput.value).toBe('789')
    })
  })

  describe('handler synchronization', () => {
    it('should sync handler value when controlled value changes', () => {
      mockUseControlledState.mockReturnValue(['123', jest.fn()])
      mockHandler.value = '456'

      const { rerender } = render(<PinInput value="123" length={6} />)

      expect(mockHandler.setValue).toHaveBeenCalledWith('123')

      mockUseControlledState.mockReturnValue(['789', jest.fn()])
      mockHandler.value = '456'

      rerender(<PinInput value="789" length={6} />)
    })

    it('should not update handler if values match', () => {
      mockUseControlledState.mockReturnValue(['123', jest.fn()])
      mockHandler.value = '123'

      render(<PinInput value="123" length={6} />)

      expect(mockHandler.setValue).not.toHaveBeenCalled()
    })

    it('should handle null value by setting empty string', () => {
      mockUseControlledState.mockReturnValue([null, jest.fn()])
      mockHandler.value = '123'

      render(<PinInput value={null} length={6} />)

      expect(mockHandler.setValue).toHaveBeenCalledWith('')
    })

    it('should handle undefined value by setting empty string', () => {
      mockUseControlledState.mockReturnValue([undefined, jest.fn()])
      mockHandler.value = '123'

      render(<PinInput value={undefined} length={6} />)

      expect(mockHandler.setValue).toHaveBeenCalledWith('')
    })
  })

  describe('user input handling', () => {
    it('should update controlled value when handler changes', () => {
      const setValue = jest.fn()

      mockUseControlledState.mockReturnValue(['', setValue])

      const { rerender } = render(<PinInput setValue={setValue} length={6} />)

      mockHandler.value = '123456'

      rerender(<PinInput setValue={setValue} length={6} />)

      expect(setValue).toHaveBeenCalledWith('123456')
    })

    it('should not update if handler value matches current value', () => {
      const setValue = jest.fn()

      mockUseControlledState.mockReturnValue(['123', setValue])
      mockHandler.value = '123'

      render(<PinInput setValue={setValue} length={6} />)

      expect(setValue).not.toHaveBeenCalled()
    })
  })

  describe('className and styling', () => {
    it('should apply custom className to container', () => {
      render(<PinInput className="custom-class" length={6} />)

      const container = document.querySelector('.pin-input')

      expect(container.className).toContain('custom-class')
    })

    it('should apply containerClassName to pin field container', () => {
      render(<PinInput containerClassName="container-class" length={6} />)

      const container = screen
        .getByTestId('pin-field')
        .closest('div[class="container-class"]')

      expect(container).toBeTruthy()
    })

    it('should apply pinClassName to PinField', () => {
      render(<PinInput pinClassName="pin-class" length={6} />)

      const pinField = screen.getByTestId('pin-field')

      expect(pinField.getAttribute('data-class')).toBe('pin-class')
    })
  })

  describe('onComplete callback', () => {
    it('should pass onComplete to PinField', () => {
      const onComplete = jest.fn()

      render(<PinInput length={6} onComplete={onComplete} />)

      const pinField = screen.getByTestId('pin-field')

      fireEvent.click(pinField)

      expect(onComplete).toHaveBeenCalledWith('123456')
    })
  })

  describe('children rendering', () => {
    it('should render children', () => {
      render(
        <PinInput length={6}>
          <div data-testid="child">Help text</div>
        </PinInput>
      )

      expect(screen.getByTestId('child')).toBeTruthy()
      expect(screen.getByTestId('child').textContent).toBe('Help text')
    })
  })

  describe('edge cases', () => {
    it('should handle empty value', () => {
      mockUseControlledState.mockReturnValue(['', jest.fn()])

      render(<PinInput value="" length={6} />)

      const hiddenInput = document.querySelector('input[type="hidden"]')

      expect(hiddenInput.value).toBe('')
    })

    it('should handle null value in hidden input', () => {
      mockUseControlledState.mockReturnValue([null, jest.fn()])

      render(<PinInput value={null} length={6} />)

      const hiddenInput = document.querySelector('input[type="hidden"]')

      expect(hiddenInput.value).toBe('')
    })

    it('should handle undefined value in hidden input', () => {
      mockUseControlledState.mockReturnValue([undefined, jest.fn()])

      render(<PinInput value={undefined} length={6} />)

      const hiddenInput = document.querySelector('input[type="hidden"]')

      expect(hiddenInput.value).toBe('')
    })

    it('should pass additional props to container', () => {
      render(
        <PinInput
          length={6}
          data-testid="pin-container"
          aria-label="PIN input"
        />
      )

      const container = screen.getByTestId('pin-container')

      expect(container.getAttribute('aria-label')).toBe('PIN input')
    })

    it('should handle different pin lengths', () => {
      const { rerender } = render(<PinInput length={4} />)

      expect(screen.getByTestId('pin-field').getAttribute('data-length')).toBe(
        '4'
      )

      rerender(<PinInput length={8} />)

      expect(screen.getByTestId('pin-field').getAttribute('data-length')).toBe(
        '8'
      )
    })
  })
})
