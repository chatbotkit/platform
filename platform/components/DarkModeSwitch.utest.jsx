/* eslint-disable @typescript-eslint/no-require-imports */
import DarkModeSwitch from './DarkModeSwitch'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/hooks/useTheme')

describe('DarkModeSwitch', () => {
  let mockUseTheme

  beforeEach(() => {
    jest.clearAllMocks()

    const useTheme = require('@/hooks/useTheme').default

    mockUseTheme = {
      theme: 'light',
      setTheme: jest.fn(),
      forcedTheme: null,
    }

    useTheme.mockReturnValue(mockUseTheme)

    delete window.followTheWhiteRabbit
  })

  describe('basic functionality', () => {
    it('should render with light theme', () => {
      render(<DarkModeSwitch />)

      const toggle = screen.getByRole('switch')

      expect(toggle).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByText('Dark Mode')).toBeInTheDocument()
    })

    it('should render with dark theme', () => {
      mockUseTheme.theme = 'dark'

      render(<DarkModeSwitch />)

      const toggle = screen.getByRole('switch')

      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })

    it('should have accessible aria-label for light mode', () => {
      render(<DarkModeSwitch />)

      const toggle = screen.getByLabelText('Switch to dark mode')

      expect(toggle).toBeInTheDocument()
    })

    it('should have accessible aria-label for dark mode', () => {
      mockUseTheme.theme = 'dark'

      render(<DarkModeSwitch />)

      const toggle = screen.getByLabelText('Switch to light mode')

      expect(toggle).toBeInTheDocument()
    })
  })

  describe('theme switching', () => {
    it('should switch to dark mode when toggled on', () => {
      render(<DarkModeSwitch />)

      const toggle = screen.getByRole('switch')

      fireEvent.click(toggle)

      expect(mockUseTheme.setTheme).toHaveBeenCalledWith('dark')
    })

    it('should switch to light mode when toggled off', () => {
      mockUseTheme.theme = 'dark'

      render(<DarkModeSwitch />)

      const toggle = screen.getByRole('switch')

      fireEvent.click(toggle)

      expect(mockUseTheme.setTheme).toHaveBeenCalledWith('light')
    })
  })

  describe('forced theme behavior', () => {
    it('should be disabled when theme is forced', () => {
      mockUseTheme.forcedTheme = 'dark'

      render(<DarkModeSwitch />)

      const toggle = screen.getByRole('switch')

      expect(toggle).toBeDisabled()
    })

    it('should not switch theme when disabled due to forced theme', () => {
      mockUseTheme.forcedTheme = 'dark'

      render(<DarkModeSwitch />)

      const toggle = screen.getByRole('switch')

      fireEvent.click(toggle)

      expect(mockUseTheme.setTheme).not.toHaveBeenCalled()
    })
  })

  describe('easter egg functionality', () => {
    it('should add followTheWhiteRabbit function in dark mode', () => {
      mockUseTheme.theme = 'dark'

      render(<DarkModeSwitch />)

      expect(typeof window.followTheWhiteRabbit).toBe('function')
    })

    it('should not add followTheWhiteRabbit function in light mode', () => {
      mockUseTheme.theme = 'light'

      render(<DarkModeSwitch />)

      expect(window.followTheWhiteRabbit).toBeUndefined()
    })

    it('should add follow-the-white-rabbit class when function is called', () => {
      mockUseTheme.theme = 'dark'

      render(<DarkModeSwitch />)

      window.followTheWhiteRabbit()

      expect(
        document.documentElement.classList.contains('follow-the-white-rabbit')
      ).toBe(true)
    })

    it('should clean up followTheWhiteRabbit on unmount', () => {
      mockUseTheme.theme = 'dark'

      const { unmount } = render(<DarkModeSwitch />)

      expect(window.followTheWhiteRabbit).toBeDefined()

      unmount()

      expect(window.followTheWhiteRabbit).toBeUndefined()
    })

    it('should clean up followTheWhiteRabbit when switching to light mode', () => {
      mockUseTheme.theme = 'dark'

      const { rerender } = render(<DarkModeSwitch />)

      expect(window.followTheWhiteRabbit).toBeDefined()

      mockUseTheme.theme = 'light'
      rerender(<DarkModeSwitch />)

      expect(window.followTheWhiteRabbit).toBeUndefined()
    })
  })
})

describe('DarkModeSwitch.Mini', () => {
  let mockUseTheme

  beforeEach(() => {
    jest.clearAllMocks()

    const useTheme = require('@/hooks/useTheme').default

    mockUseTheme = {
      theme: 'light',
      setTheme: jest.fn(),
      forcedTheme: null,
    }

    useTheme.mockReturnValue(mockUseTheme)
  })

  describe('basic functionality', () => {
    it('should render as a button', () => {
      render(<DarkModeSwitch.Mini />)

      const button = screen.getByRole('button')

      expect(button).toBeInTheDocument()
    })

    it('should have accessible aria-label for light mode', () => {
      render(<DarkModeSwitch.Mini />)

      const button = screen.getByLabelText('Switch to dark mode')

      expect(button).toBeInTheDocument()
    })

    it('should have accessible aria-label for dark mode', () => {
      mockUseTheme.theme = 'dark'

      render(<DarkModeSwitch.Mini />)

      const button = screen.getByLabelText('Switch to light mode')

      expect(button).toBeInTheDocument()
    })
  })

  describe('theme switching', () => {
    it('should switch to dark mode when clicked in light mode', () => {
      render(<DarkModeSwitch.Mini />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(mockUseTheme.setTheme).toHaveBeenCalledWith('dark')
    })

    it('should switch to light mode when clicked in dark mode', () => {
      mockUseTheme.theme = 'dark'

      render(<DarkModeSwitch.Mini />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(mockUseTheme.setTheme).toHaveBeenCalledWith('light')
    })
  })

  describe('forced theme behavior', () => {
    it('should be disabled when theme is forced', () => {
      mockUseTheme.forcedTheme = 'dark'

      render(<DarkModeSwitch.Mini />)

      const button = screen.getByRole('button')

      expect(button).toBeDisabled()
    })

    it('should not switch theme when disabled due to forced theme', () => {
      mockUseTheme.forcedTheme = 'dark'

      render(<DarkModeSwitch.Mini />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(mockUseTheme.setTheme).not.toHaveBeenCalled()
    })
  })

  describe('custom props', () => {
    it('should pass through additional props to button', () => {
      render(<DarkModeSwitch.Mini data-testid="custom-button" />)

      const button = screen.getByTestId('custom-button')

      expect(button).toBeInTheDocument()
    })

    it('should merge custom className with default classes', () => {
      render(<DarkModeSwitch.Mini className="custom-class" />)

      const button = screen.getByRole('button')

      expect(button.className).toContain('custom-class')
      expect(button.className).toContain('p-2')
    })
  })
})
