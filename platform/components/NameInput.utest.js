/* eslint-disable @typescript-eslint/no-require-imports */
import NameInput from './NameInput'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// Mock dependencies
jest.mock('@/lib/db.string', () => ({
  isDbString: jest.fn(),
}))

jest.mock('@/hooks/useControllableInput', () => {
  return jest.fn((opts) => [opts.value || opts.defaultValue, opts.onChange])
})

describe('NameInput', () => {
  let mockIsDbString

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsDbString = require('@/lib/db.string').isDbString
    mockIsDbString.mockReturnValue(true)

    // Default mock implementation
    const useControllableInput = require('@/hooks/useControllableInput')

    useControllableInput.mockImplementation((opts) => [
      opts.value !== undefined ? opts.value : opts.defaultValue || '',
      opts.onChange || jest.fn(),
    ])
  })

  describe('basic functionality', () => {
    it('should render as an input element', () => {
      render(<NameInput />)

      const input = screen.getByRole('textbox')

      expect(input).toBeInTheDocument()
      expect(input.tagName).toBe('INPUT')
    })

    it('should render with default value', () => {
      render(<NameInput defaultValue="Test Name" />)

      const input = screen.getByRole('textbox')

      expect(input).toHaveValue('Test Name')
    })

    it('should pass through additional props', () => {
      render(
        <NameInput
          placeholder="Enter name"
          className="custom-class"
          data-testid="name-input"
        />
      )

      const input = screen.getByRole('textbox')

      expect(input).toHaveAttribute('placeholder', 'Enter name')
      expect(input).toHaveClass('custom-class')
      expect(input).toHaveAttribute('data-testid', 'name-input')
    })
  })

  describe('controlled mode', () => {
    it('should work as a controlled input', () => {
      const setValue = jest.fn()
      const { rerender } = render(
        <NameInput value="Initial" setValue={setValue} />
      )
      const input = screen.getByRole('textbox')

      expect(input).toHaveValue('Initial')

      rerender(<NameInput value="Updated" setValue={setValue} />)
      expect(input).toHaveValue('Updated')
    })

    it('should call setValue when controlled', () => {
      const setValue = jest.fn()
      const useControllableInput = require('@/hooks/useControllableInput')

      useControllableInput.mockImplementation((opts) => {
        return [opts.value, (e) => opts.setValue(e.target.value)]
      })

      render(<NameInput value="Test" setValue={setValue} />)

      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'New Value' } })
      expect(setValue).toHaveBeenCalledWith('New Value')
    })
  })

  describe('uncontrolled mode', () => {
    it('should work as an uncontrolled input', () => {
      render(<NameInput defaultValue="" />)

      const input = screen.getByRole('textbox')

      expect(input).toHaveValue('')
    })

    it('should update value in uncontrolled mode', () => {
      const useControllableInput = require('@/hooks/useControllableInput')
      let internalValue = 'Initial'

      useControllableInput.mockImplementation((opts) => {
        return [
          internalValue,
          (e) => {
            internalValue = e.target.value
          },
        ]
      })

      const { rerender } = render(<NameInput defaultValue="Initial" />)
      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'Changed' } })
      rerender(<NameInput defaultValue="Initial" />)
    })
  })

  describe('validation', () => {
    it('should clear validation error when value is empty', async () => {
      const useControllableInput = require('@/hooks/useControllableInput')
      let value = ''

      useControllableInput.mockImplementation((opts) => [
        value,
        (e) => {
          value = e.target.value
        },
      ])

      render(<NameInput defaultValue="" />)

      const input = screen.getByRole('textbox')

      await waitFor(() => {
        expect(input.validationMessage).toBe('')
      })
    })

    it('should clear validation error when value is valid', async () => {
      mockIsDbString.mockReturnValue(true)

      const useControllableInput = require('@/hooks/useControllableInput')
      let value = 'Valid Name'

      useControllableInput.mockImplementation(() => [value, jest.fn()])

      render(<NameInput defaultValue="Valid Name" />)

      const input = screen.getByRole('textbox')

      await waitFor(() => {
        expect(input.validationMessage).toBe('')
      })
    })

    it('should set validation error when value is too long', async () => {
      mockIsDbString.mockReturnValue(false)

      const useControllableInput = require('@/hooks/useControllableInput')
      let value = 'A'.repeat(300)

      useControllableInput.mockImplementation(() => [value, jest.fn()])

      render(<NameInput defaultValue={value} />)

      const input = screen.getByRole('textbox')

      await waitFor(() => {
        expect(input.validationMessage).toBe('The name is too long.')
      })
    })

    it('should validate on value change', async () => {
      const useControllableInput = require('@/hooks/useControllableInput')
      let value = 'Short'

      useControllableInput.mockImplementation(() => [value, jest.fn()])

      const { rerender } = render(<NameInput defaultValue="Short" />)
      const input = screen.getByRole('textbox')

      mockIsDbString.mockReturnValue(true)
      await waitFor(() => {
        expect(input.validationMessage).toBe('')
      })

      // Change to invalid value
      value = 'A'.repeat(300)
      mockIsDbString.mockReturnValue(false)
      rerender(<NameInput defaultValue={value} />)

      await waitFor(() => {
        expect(input.validationMessage).toBe('The name is too long.')
      })
    })
  })

  describe('edge cases', () => {
    it('should handle undefined defaultValue', () => {
      render(<NameInput />)

      const input = screen.getByRole('textbox')

      expect(input).toHaveValue('')
    })

    it('should handle null value gracefully', () => {
      const useControllableInput = require('@/hooks/useControllableInput')

      useControllableInput.mockImplementation(() => [null, jest.fn()])

      render(<NameInput value={null} />)

      const input = screen.getByRole('textbox')

      expect(input).toHaveValue('')
    })

    it('should handle special characters in name', async () => {
      mockIsDbString.mockReturnValue(true)

      const useControllableInput = require('@/hooks/useControllableInput')
      const value = 'Name with @#$ special chars'

      useControllableInput.mockImplementation(() => [value, jest.fn()])

      render(<NameInput defaultValue={value} />)

      const input = screen.getByRole('textbox')

      await waitFor(() => {
        expect(input.validationMessage).toBe('')
      })
    })

    it('should handle unicode characters', async () => {
      mockIsDbString.mockReturnValue(true)

      const useControllableInput = require('@/hooks/useControllableInput')
      const value = '名前 नाम 名字'

      useControllableInput.mockImplementation(() => [value, jest.fn()])

      render(<NameInput defaultValue={value} />)

      const input = screen.getByRole('textbox')

      await waitFor(() => {
        expect(input.validationMessage).toBe('')
      })
    })

    it('should handle empty string after having a value', async () => {
      const useControllableInput = require('@/hooks/useControllableInput')
      let value = 'Initial Value'

      useControllableInput.mockImplementation(() => [value, jest.fn()])

      const { rerender } = render(<NameInput defaultValue={value} />)
      const input = screen.getByRole('textbox')

      mockIsDbString.mockReturnValue(true)
      await waitFor(() => {
        expect(input.validationMessage).toBe('')
      })

      value = ''
      rerender(<NameInput defaultValue={value} />)

      await waitFor(() => {
        expect(input.validationMessage).toBe('')
      })
    })
  })

  describe('accessibility', () => {
    it('should be focusable', () => {
      render(<NameInput />)

      const input = screen.getByRole('textbox')

      input.focus()
      expect(input).toHaveFocus()
    })

    it('should support aria-label', () => {
      render(<NameInput aria-label="Name field" />)
      expect(screen.getByLabelText('Name field')).toBeInTheDocument()
    })

    it('should support aria-describedby', () => {
      render(<NameInput aria-describedby="name-help" />)

      const input = screen.getByRole('textbox')

      expect(input).toHaveAttribute('aria-describedby', 'name-help')
    })

    it('should support required attribute', () => {
      render(<NameInput required />)

      const input = screen.getByRole('textbox')

      expect(input).toBeRequired()
    })

    it('should support disabled attribute', () => {
      render(<NameInput disabled />)

      const input = screen.getByRole('textbox')

      expect(input).toBeDisabled()
    })
  })
})
