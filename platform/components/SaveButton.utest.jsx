/* eslint-disable @typescript-eslint/no-require-imports */
import SaveButton from './SaveButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/lib/save', () => ({
  saveData: jest.fn(),
}))

jest.mock('@/lib/toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const { saveData } = require('@/lib/save')
const toast = require('@/lib/toast').default

describe('SaveButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render button element', () => {
      render(<SaveButton data="test data" name="test.txt" />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should call saveData with correct parameters on click', () => {
      render(<SaveButton data="test data" name="test.txt" type="text/plain" />)

      fireEvent.click(screen.getByRole('button'))

      expect(saveData).toHaveBeenCalledWith('test data', {
        name: 'test.txt',
        type: 'text/plain',
      })
    })

    it('should show default success message after save', () => {
      render(<SaveButton data="test data" name="test.txt" />)

      fireEvent.click(screen.getByRole('button'))

      expect(toast.success).toHaveBeenCalledWith('File saved')
    })

    it('should show custom success message when provided', () => {
      render(
        <SaveButton
          data="test data"
          name="test.txt"
          message="Custom success message"
        />
      )

      fireEvent.click(screen.getByRole('button'))

      expect(toast.success).toHaveBeenCalledWith('Custom success message')
    })

    it('should not show success message when message is empty string', () => {
      render(<SaveButton data="test data" name="test.txt" message="" />)

      fireEvent.click(screen.getByRole('button'))

      expect(toast.success).not.toHaveBeenCalled()
    })

    it('should not show success message when message is null', () => {
      render(<SaveButton data="test data" name="test.txt" message={null} />)

      fireEvent.click(screen.getByRole('button'))

      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should show error toast when saveData throws', () => {
      saveData.mockImplementationOnce(() => {
        throw new Error('Save failed')
      })

      render(<SaveButton data="test data" name="test.txt" />)

      fireEvent.click(screen.getByRole('button'))

      expect(toast.error).toHaveBeenCalledWith('Failed to save file')
    })

    it('should still call onClick handler after error', () => {
      const handleClick = jest.fn()

      saveData.mockImplementationOnce(() => {
        throw new Error('Save failed')
      })

      render(
        <SaveButton data="test data" name="test.txt" onClick={handleClick} />
      )

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalled()
    })
  })

  describe('event handling', () => {
    it('should prevent default event behavior', () => {
      const handleClick = jest.fn()

      render(
        <SaveButton data="test data" name="test.txt" onClick={handleClick} />
      )

      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

      fireEvent(screen.getByRole('button'), event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should stop event propagation', () => {
      const handleClick = jest.fn()

      render(
        <SaveButton data="test data" name="test.txt" onClick={handleClick} />
      )

      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      const stopPropagationSpy = jest.spyOn(event, 'stopPropagation')

      fireEvent(screen.getByRole('button'), event)

      expect(stopPropagationSpy).toHaveBeenCalled()
    })

    it('should call custom onClick handler after save', () => {
      const handleClick = jest.fn()

      render(
        <SaveButton data="test data" name="test.txt" onClick={handleClick} />
      )

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalled()
      expect(handleClick).toHaveBeenCalledWith(expect.any(Object))
    })

    it('should work without onClick handler', () => {
      render(<SaveButton data="test data" name="test.txt" />)

      expect(() => {
        fireEvent.click(screen.getByRole('button'))
      }).not.toThrow()
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to button', () => {
      render(
        <SaveButton
          data="test data"
          name="test.txt"
          className="custom-class"
          disabled
        />
      )

      const button = screen.getByRole('button')

      expect(button).toHaveClass('custom-class')
      expect(button).toBeDisabled()
    })

    it('should always render button with type="button"', () => {
      render(<SaveButton data="test data" name="test.txt" />)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })

    it('should forward aria attributes', () => {
      render(
        <SaveButton data="test data" name="test.txt" aria-label="Save file" />
      )
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Save file'
      )
    })

    it('should render children content', () => {
      render(
        <SaveButton data="test data" name="test.txt">
          Save Now
        </SaveButton>
      )
      expect(screen.getByText('Save Now')).toBeInTheDocument()
    })
  })

  describe('different data types', () => {
    it('should handle string data', () => {
      render(<SaveButton data="simple string" name="file.txt" />)

      fireEvent.click(screen.getByRole('button'))

      expect(saveData).toHaveBeenCalledWith('simple string', expect.any(Object))
    })

    it('should handle object data', () => {
      const data = { key: 'value' }

      render(<SaveButton data={data} name="data.json" />)

      fireEvent.click(screen.getByRole('button'))

      expect(saveData).toHaveBeenCalledWith(data, expect.any(Object))
    })

    it('should handle array data', () => {
      const data = [1, 2, 3]

      render(<SaveButton data={data} name="array.json" />)

      fireEvent.click(screen.getByRole('button'))

      expect(saveData).toHaveBeenCalledWith(data, expect.any(Object))
    })
  })
})
