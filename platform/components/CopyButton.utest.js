import toast from '@/lib/toast'

import CopyButton, { copyTextToClipboard } from './CopyButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/lib/toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

describe('copyTextToClipboard', () => {
  let writeTextMock

  beforeEach(() => {
    jest.clearAllMocks()

    writeTextMock = jest.fn()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })
  })

  describe('basic functionality', () => {
    it('should copy string text to clipboard', async () => {
      writeTextMock.mockResolvedValue()

      await copyTextToClipboard('test text', 'Copied!')

      expect(writeTextMock).toHaveBeenCalledWith('test text')
      expect(toast.success).toHaveBeenCalledWith('Copied!')
    })

    it('should copy function result to clipboard', async () => {
      writeTextMock.mockResolvedValue()

      const textFunction = jest.fn(() => 'dynamic text')

      await copyTextToClipboard(textFunction, 'Copied!')

      expect(textFunction).toHaveBeenCalled()
      expect(writeTextMock).toHaveBeenCalledWith('dynamic text')
      expect(toast.success).toHaveBeenCalledWith('Copied!')
    })

    it('should copy without showing message when message not provided', async () => {
      writeTextMock.mockResolvedValue()

      await copyTextToClipboard('test text')

      expect(writeTextMock).toHaveBeenCalledWith('test text')
      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      writeTextMock.mockResolvedValue()

      await copyTextToClipboard('', 'Copied!')

      expect(writeTextMock).toHaveBeenCalledWith('')
      expect(toast.success).toHaveBeenCalledWith('Copied!')
    })

    it('should handle function returning empty string', async () => {
      writeTextMock.mockResolvedValue()

      await copyTextToClipboard(() => '', 'Copied!')

      expect(writeTextMock).toHaveBeenCalledWith('')
    })
  })

  describe('error handling', () => {
    it('should show error toast when clipboard write fails', async () => {
      writeTextMock.mockRejectedValue(new Error('Permission denied'))

      await copyTextToClipboard('test text', 'Copied!')

      expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard')
      expect(toast.success).not.toHaveBeenCalled()
    })

    it('should handle error gracefully when function throws during evaluation', async () => {
      const throwingFunction = () => {
        throw new Error('Function error')
      }

      // The function is wrapped in try-catch, so it handles the error
      await copyTextToClipboard(throwingFunction, 'Copied!')

      // @note the error is caught and shows clipboard error
      expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard')
    })
  })
})

describe('CopyButton', () => {
  let writeTextMock

  beforeEach(() => {
    jest.clearAllMocks()

    writeTextMock = jest.fn().mockResolvedValue()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })
  })

  describe('basic functionality', () => {
    it('should render button with default props', () => {
      render(<CopyButton text="copy me" />)

      const button = screen.getByRole('button')

      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('type', 'button')
    })

    it('should copy text on click', () => {
      render(<CopyButton text="copy me" />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(writeTextMock).toHaveBeenCalledWith('copy me')
    })

    it('should copy function result on click', () => {
      const textFunction = jest.fn(() => 'dynamic text')

      render(<CopyButton text={textFunction} />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(textFunction).toHaveBeenCalled()
      expect(writeTextMock).toHaveBeenCalledWith('dynamic text')
    })

    it('should show custom message on successful copy', async () => {
      render(<CopyButton text="copy me" message="Custom message" />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      // Wait for async clipboard operation
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(toast.success).toHaveBeenCalledWith('Custom message')
    })

    it('should copy text when default message used', () => {
      render(<CopyButton text="copy me" />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      // @note default message is passed to copyTextToClipboard
      expect(writeTextMock).toHaveBeenCalledWith('copy me')
    })
  })

  describe('event handling', () => {
    it('should call onClick handler if provided', () => {
      const handleClick = jest.fn()

      render(<CopyButton text="copy me" onClick={handleClick} />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(handleClick).toHaveBeenCalled()
      expect(handleClick.mock.calls[0][0]).toBeInstanceOf(Object)
    })

    it('should prevent default behavior', () => {
      const handleClick = jest.fn()

      render(<CopyButton text="copy me" onClick={handleClick} />)

      const button = screen.getByRole('button')
      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

      fireEvent(button, event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should stop propagation', () => {
      const handleClick = jest.fn()

      render(<CopyButton text="copy me" onClick={handleClick} />)

      const button = screen.getByRole('button')
      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      const stopPropagationSpy = jest.spyOn(event, 'stopPropagation')

      fireEvent(button, event)

      expect(stopPropagationSpy).toHaveBeenCalled()
    })
  })

  describe('props spreading', () => {
    it('should spread additional props to button', () => {
      render(
        <CopyButton
          text="copy me"
          className="custom-class"
          data-testid="copy-btn"
        />
      )

      const button = screen.getByRole('button')

      expect(button).toHaveClass('custom-class')
      expect(button).toHaveAttribute('data-testid', 'copy-btn')
    })

    it('should handle disabled prop', () => {
      render(<CopyButton text="copy me" disabled />)

      const button = screen.getByRole('button')

      expect(button).toBeDisabled()
    })
  })
})
