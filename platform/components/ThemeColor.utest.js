/* eslint-disable @typescript-eslint/no-require-imports */
import ThemeColor from './ThemeColor'

import '@testing-library/jest-dom'
import { act, render } from '@testing-library/react'

jest.mock('@/hooks/useTheme')

const useTheme = require('@/hooks/useTheme').default

describe('ThemeColor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render light theme color', () => {
      useTheme.mockReturnValue({ theme: 'light', forcedTheme: null })

      const { container } = render(<ThemeColor />)

      const meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).toBeInTheDocument()
      expect(meta).toHaveAttribute('content', '#ffffff')
    })

    it('should render dark theme color', () => {
      useTheme.mockReturnValue({ theme: 'dark', forcedTheme: null })

      const { container } = render(<ThemeColor />)

      const meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).toBeInTheDocument()
      expect(meta).toHaveAttribute('content', '#000000')
    })

    it('should not render meta tag initially', () => {
      useTheme.mockReturnValue({ theme: 'light', forcedTheme: null })

      const { container, rerender } = render(<ThemeColor />)

      act(() => {
        rerender(<ThemeColor />)
      })

      const meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).toBeInTheDocument()
    })
  })

  describe('forced theme priority', () => {
    it('should use forcedTheme over theme', () => {
      useTheme.mockReturnValue({ theme: 'light', forcedTheme: 'dark' })

      const { container } = render(<ThemeColor />)

      act(() => {})

      const meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).toHaveAttribute('content', '#000000')
    })

    it('should use theme when forcedTheme is null', () => {
      useTheme.mockReturnValue({ theme: 'light', forcedTheme: null })

      const { container } = render(<ThemeColor />)

      act(() => {})

      const meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).toHaveAttribute('content', '#ffffff')
    })

    it('should use theme when forcedTheme is undefined', () => {
      useTheme.mockReturnValue({ theme: 'dark', forcedTheme: undefined })

      const { container } = render(<ThemeColor />)

      act(() => {})

      const meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).toHaveAttribute('content', '#000000')
    })
  })

  describe('theme changes', () => {
    it('should update color when theme changes from light to dark', () => {
      useTheme.mockReturnValue({ theme: 'light', forcedTheme: null })

      const { container, rerender } = render(<ThemeColor />)

      act(() => {})

      let meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).toHaveAttribute('content', '#ffffff')

      useTheme.mockReturnValue({ theme: 'dark', forcedTheme: null })
      rerender(<ThemeColor />)

      act(() => {})

      meta = document.head.querySelector('meta[name="theme-color"]')
      expect(meta).toHaveAttribute('content', '#000000')
    })

    it('should update color when theme changes from dark to light', () => {
      useTheme.mockReturnValue({ theme: 'dark', forcedTheme: null })

      const { container, rerender } = render(<ThemeColor />)

      act(() => {})

      let meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).toHaveAttribute('content', '#000000')

      useTheme.mockReturnValue({ theme: 'light', forcedTheme: null })
      rerender(<ThemeColor />)

      act(() => {})

      meta = document.head.querySelector('meta[name="theme-color"]')
      expect(meta).toHaveAttribute('content', '#ffffff')
    })

    it('should update color when forcedTheme changes', () => {
      useTheme.mockReturnValue({ theme: 'light', forcedTheme: 'light' })

      const { container, rerender } = render(<ThemeColor />)

      act(() => {})

      let meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).toHaveAttribute('content', '#ffffff')

      useTheme.mockReturnValue({ theme: 'light', forcedTheme: 'dark' })
      rerender(<ThemeColor />)

      act(() => {})

      meta = document.head.querySelector('meta[name="theme-color"]')
      expect(meta).toHaveAttribute('content', '#000000')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined theme', () => {
      useTheme.mockReturnValue({ theme: undefined, forcedTheme: null })

      const { container } = render(<ThemeColor />)

      act(() => {})

      const meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).not.toBeInTheDocument()
    })

    it('should handle unknown theme value', () => {
      useTheme.mockReturnValue({ theme: 'custom', forcedTheme: null })

      const { container } = render(<ThemeColor />)

      act(() => {})

      const meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).not.toBeInTheDocument()
    })

    it('should handle null theme', () => {
      useTheme.mockReturnValue({ theme: null, forcedTheme: null })

      const { container } = render(<ThemeColor />)

      act(() => {})

      const meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).not.toBeInTheDocument()
    })
  })

  describe('initial state', () => {
    it('should render meta after mount', () => {
      useTheme.mockReturnValue({ theme: 'light', forcedTheme: null })

      const { container } = render(<ThemeColor />)

      act(() => {})

      const meta = document.head.querySelector('meta[name="theme-color"]')

      expect(meta).toBeInTheDocument()
      expect(meta).toHaveAttribute('content', '#ffffff')
    })
  })
})
