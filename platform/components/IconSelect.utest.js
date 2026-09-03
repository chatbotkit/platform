/* eslint-disable @typescript-eslint/no-require-imports */
import IconSelect from './IconSelect'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/Emoji', () => {
  return function Emoji({ children }) {
    return <span data-testid="emoji">{children}</span>
  }
})

jest.mock('@/hooks/useClickOutside', () => {
  return jest.fn()
})

jest.mock('@/hooks/useControllableInput', () => {
  return jest.fn(({ defaultValue, value, setValue, onChange }) => {
    const currentValue = value !== undefined ? value : defaultValue || ''

    return [
      currentValue,
      (e) => {
        const newValue = e.target.value

        onChange?.(e)
        setValue?.(newValue)
      },
      setValue || jest.fn(),
    ]
  })
})

jest.mock('@/hooks/useTheme', () => {
  return jest.fn(() => ({ theme: 'light' }))
})

jest.mock('emoji-picker-react', () => {
  return function EmojiPicker({ onEmojiClick }) {
    return (
      <div data-testid="emoji-picker">
        <button
          type="button"
          onClick={() => onEmojiClick({ emoji: '😀', names: ['grinning'] }, {})}
        >
          Select Emoji
        </button>
      </div>
    )
  }
})

jest.mock('emoji-name-map', () => {
  const map = new Map([
    [':smile:', '😀'],
    [':grinning:', '😀'],
    [':heart:', '❤️'],
  ])

  return {
    __esModule: true,
    default: {
      get: (key) => map.get(key),
    },
  }
})

jest.mock('emoji-unicode-map', () => {
  const map = new Map([
    ['😀', 'grinning'],
    ['❤️', 'heart'],
  ])

  return {
    __esModule: true,
    default: {
      get: (key) => map.get(key),
    },
  }
})

describe('IconSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render icon selector', () => {
      render(<IconSelect defaultValue=":smile:" />)

      expect(screen.getByTestId('emoji')).toBeInTheDocument()
    })

    it('should display selected emoji', () => {
      render(<IconSelect defaultValue=":smile:" />)

      const emoji = screen.getByTestId('emoji')

      expect(emoji.textContent).toBe('😀')
    })

    it('should render hidden input with name', () => {
      const { container } = render(
        <IconSelect name="icon" defaultValue=":smile:" />
      )

      const input = container.querySelector('input[name="icon"]')

      expect(input).toBeInTheDocument()
      expect(input).toHaveClass('hidden')
    })

    it('should show non-breaking space when no value', () => {
      render(<IconSelect defaultValue="" />)

      const emoji = screen.getByTestId('emoji')

      expect(emoji.textContent).toBe('\xa0')
    })
  })

  describe('controlled vs uncontrolled', () => {
    it('should work as uncontrolled component', () => {
      const { container } = render(
        <IconSelect name="icon" defaultValue=":heart:" />
      )

      const input = container.querySelector('input[name="icon"]')

      expect(input).toHaveValue(':heart:')
    })

    it('should work as controlled component', () => {
      const setValue = jest.fn()
      const { container, rerender } = render(
        <IconSelect name="icon" value=":smile:" setValue={setValue} />
      )

      const input = container.querySelector('input[name="icon"]')

      expect(input).toHaveValue(':smile:')

      rerender(<IconSelect name="icon" value=":heart:" setValue={setValue} />)

      expect(input).toHaveValue(':heart:')
    })
  })

  describe('emoji picker interaction', () => {
    it('should hide picker by default', () => {
      render(<IconSelect defaultValue=":smile:" />)

      expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument()
    })

    it('should not open picker when disabled', () => {
      render(<IconSelect defaultValue=":smile:" disabled={true} />)

      const container = screen.getByTestId('emoji').parentElement.parentElement

      fireEvent.click(container)

      expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument()
    })
  })

  describe('emoji name resolution', () => {
    // Note: These tests would require fully simulating EmojiPicker interaction
    // which is complex in a unit test context. Skipping detailed emoji
    // selection tests.
    it('should use emoji-name-map for display', () => {
      render(<IconSelect defaultValue=":smile:" />)

      const emoji = screen.getByTestId('emoji')

      expect(emoji.textContent).toBe('😀')
    })
  })

  describe('click outside', () => {
    it('should register click outside handler', () => {
      const useClickOutside = require('@/hooks/useClickOutside')

      render(<IconSelect defaultValue=":smile:" />)

      expect(useClickOutside).toHaveBeenCalled()

      const closeCallback = useClickOutside.mock.calls[0][1]

      expect(typeof closeCallback).toBe('function')
    })
  })

  describe('theme integration', () => {
    it('should get theme from useTheme hook', () => {
      const useTheme = require('@/hooks/useTheme')

      useTheme.mockReturnValue({ theme: 'dark' })

      render(<IconSelect defaultValue=":smile:" />)

      // Verify useTheme was called
      expect(useTheme).toHaveBeenCalled()
    })
  })

  describe('styling and props', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <IconSelect defaultValue=":smile:" className="custom-class" />
      )

      const iconContainer = container.querySelector('.custom-class')

      expect(iconContainer).toBeInTheDocument()
    })

    it('should pass extra props to icon container', () => {
      const { container } = render(
        <IconSelect
          defaultValue=":smile:"
          data-testid="icon-select"
          aria-label="Select icon"
        />
      )

      const iconContainer = container.querySelector(
        '[data-testid="icon-select"]'
      )

      expect(iconContainer).toBeInTheDocument()
      expect(iconContainer).toHaveAttribute('aria-label', 'Select icon')
    })

    it('should apply cursor pointer style', () => {
      const { container } = render(<IconSelect defaultValue=":smile:" />)

      const iconContainer = container.querySelector('.cursor-pointer')

      expect(iconContainer).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined defaultValue', () => {
      render(<IconSelect />)

      const emoji = screen.getByTestId('emoji')

      expect(emoji.textContent).toBe('\xa0')
    })

    it('should handle null defaultValue', () => {
      render(<IconSelect defaultValue={null} />)

      const emoji = screen.getByTestId('emoji')

      expect(emoji.textContent).toBe('\xa0')
    })

    it('should handle empty string defaultValue', () => {
      render(<IconSelect defaultValue="" />)

      const emoji = screen.getByTestId('emoji')

      expect(emoji.textContent).toBe('\xa0')
    })

    it('should handle invalid emoji name', () => {
      render(<IconSelect defaultValue=":invalid_emoji:" />)

      const emoji = screen.getByTestId('emoji')

      expect(emoji.textContent).toBe('\xa0')
    })
  })
})
