import React from 'react'

import { isDbString } from '@/lib/db.string'

import useControllableInput from '@/hooks/useControllableInput'

import NameInput from './NameInput'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/lib/db.string', () => ({
  isDbString: jest.fn(),
}))

jest.mock('@/hooks/useControllableInput', () => ({
  __esModule: true,
  default: jest.fn(),
}))

describe('NameInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useControllableInput.mockImplementation(
      ({ defaultValue, value, setValue, onChange }) => {
        const [internalValue, setInternalValue] = React.useState(
          value !== undefined ? value : defaultValue
        )

        const handleChange = (e) => {
          const newValue = e.target.value

          setInternalValue(newValue)
          setValue?.(newValue)
          onChange?.(e)
        }

        return [internalValue, handleChange]
      }
    )

    isDbString.mockReturnValue(true)
  })

  describe('basic functionality', () => {
    it('should render an input element', () => {
      render(<NameInput />)

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should render with default value', () => {
      render(<NameInput defaultValue="Test Name" />)

      expect(screen.getByRole('textbox')).toHaveValue('Test Name')
    })

    it('should pass through additional props', () => {
      render(
        <NameInput
          placeholder="Enter name"
          className="custom-class"
          data-testid="name-input"
        />
      )

      const input = screen.getByTestId('name-input')

      expect(input).toHaveAttribute('placeholder', 'Enter name')
      expect(input).toHaveClass('custom-class')
    })
  })

  describe('controlled mode', () => {
    it('should work as controlled input', () => {
      const setValue = jest.fn()

      useControllableInput.mockReturnValue(['Controlled', jest.fn()])

      render(<NameInput value="Controlled" setValue={setValue} />)

      expect(screen.getByRole('textbox')).toHaveValue('Controlled')
    })

    it('should call setValue when value changes', () => {
      const setValue = jest.fn()
      let mockOnChange

      useControllableInput.mockImplementation(({ setValue, onChange }) => {
        mockOnChange = (e) => {
          setValue?.(e.target.value)
          onChange?.(e)
        }

        return ['', mockOnChange]
      })

      render(<NameInput value="" setValue={setValue} />)

      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'New Name' } })

      expect(setValue).toHaveBeenCalledWith('New Name')
    })

    it('should call onChange callback', () => {
      const onChange = jest.fn()
      let mockOnChange

      useControllableInput.mockImplementation(({ onChange: onChangeProp }) => {
        mockOnChange = (e) => {
          onChangeProp?.(e)
        }

        return ['', mockOnChange]
      })

      render(<NameInput onChange={onChange} />)

      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'New Name' } })

      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('uncontrolled mode', () => {
    it('should work as uncontrolled input', () => {
      render(<NameInput defaultValue="Initial" />)

      const input = screen.getByRole('textbox')

      expect(input).toHaveValue('Initial')
    })

    it('should update value in uncontrolled mode', () => {
      let mockValue = 'Initial'
      let mockOnChange

      useControllableInput.mockImplementation(() => {
        mockOnChange = (e) => {
          mockValue = e.target.value
        }

        return [mockValue, mockOnChange]
      })

      const { rerender } = render(<NameInput defaultValue="Initial" />)

      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'Updated' } })

      rerender(<NameInput defaultValue="Initial" />)

      expect(mockValue).toBe('Updated')
    })
  })

  describe('validation', () => {
    it('should clear custom validity when value is empty', () => {
      let mockValue = ''
      let mockOnChange

      useControllableInput.mockImplementation(() => {
        mockOnChange = (e) => {
          mockValue = e.target.value
        }

        return [mockValue, mockOnChange]
      })

      render(<NameInput defaultValue="" />)

      const input = screen.getByRole('textbox')

      expect(input.validationMessage).toBe('')
    })

    it('should clear custom validity when value is valid db string', () => {
      isDbString.mockReturnValue(true)

      let mockValue = 'Valid Name'
      let mockOnChange

      useControllableInput.mockImplementation(() => {
        mockOnChange = (e) => {
          mockValue = e.target.value
        }

        return [mockValue, mockOnChange]
      })

      render(<NameInput defaultValue="Valid Name" />)

      const input = screen.getByRole('textbox')

      expect(input.validationMessage).toBe('')
    })

    it('should set custom validity when value exceeds db string limit', () => {
      isDbString.mockReturnValue(false)

      let mockValue = 'x'.repeat(200)
      let mockOnChange

      useControllableInput.mockImplementation(() => {
        mockOnChange = (e) => {
          mockValue = e.target.value
        }

        return [mockValue, mockOnChange]
      })

      render(<NameInput defaultValue={'x'.repeat(200)} />)

      const input = screen.getByRole('textbox')

      expect(input.validationMessage).toBe('The name is too long.')
    })

    it('should update validation when value changes', () => {
      let mockValue = 'Valid'
      let mockOnChange

      useControllableInput.mockImplementation(() => {
        mockOnChange = (e) => {
          mockValue = e.target.value
        }

        return [mockValue, mockOnChange]
      })

      isDbString.mockReturnValue(true)

      const { rerender } = render(<NameInput defaultValue="Valid" />)

      const input = screen.getByRole('textbox')

      expect(input.validationMessage).toBe('')

      isDbString.mockReturnValue(false)
      mockValue = 'x'.repeat(200)

      rerender(<NameInput defaultValue="Valid" />)

      expect(input.validationMessage).toBe('The name is too long.')
    })
  })

  describe('edge cases', () => {
    it('should handle null value gracefully', () => {
      useControllableInput.mockReturnValue([null, jest.fn()])

      render(<NameInput />)

      const input = screen.getByRole('textbox')

      expect(input).toHaveValue('')
    })

    it('should handle undefined value gracefully', () => {
      useControllableInput.mockReturnValue([undefined, jest.fn()])

      render(<NameInput />)

      const input = screen.getByRole('textbox')

      expect(input).toHaveValue('')
    })

    it('should not error when ref is not available', () => {
      let mockValue = 'test'
      let mockOnChange

      useControllableInput.mockImplementation(() => {
        mockOnChange = (e) => {
          mockValue = e.target.value
        }

        return [mockValue, mockOnChange]
      })

      const { unmount } = render(<NameInput defaultValue="test" />)

      expect(() => {
        unmount()
      }).not.toThrow()
    })

    it('should call isDbString with current value', () => {
      let mockValue = 'Test Value'

      useControllableInput.mockReturnValue([mockValue, jest.fn()])

      render(<NameInput defaultValue="Test Value" />)

      expect(isDbString).toHaveBeenCalledWith('Test Value')
    })
  })

  describe('useControllableInput integration', () => {
    it('should pass correct props to useControllableInput', () => {
      const setValue = jest.fn()
      const onChange = jest.fn()

      useControllableInput.mockReturnValue(['value', jest.fn()])

      render(
        <NameInput
          defaultValue="default"
          value="controlled"
          setValue={setValue}
          onChange={onChange}
        />
      )

      expect(useControllableInput).toHaveBeenCalledWith({
        defaultValue: 'default',
        value: 'controlled',
        setValue,
        onChange,
      })
    })

    it('should use empty string as default when no defaultValue provided', () => {
      useControllableInput.mockReturnValue(['', jest.fn()])

      render(<NameInput />)

      expect(useControllableInput).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultValue: '',
        })
      )
    })
  })
})
