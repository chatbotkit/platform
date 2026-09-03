/* eslint-disable @typescript-eslint/no-require-imports */
import Progress from './Progress'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('next-nprogress-bar', () => ({
  AppProgressBar: ({ color, height, delay, options }) => (
    <div
      data-testid="app-progress-bar"
      data-color={color}
      data-height={height}
      data-delay={delay}
      data-show-spinner={options.showSpinner}
    />
  ),
  PagesProgressBar: ({ color, height, delay, options }) => (
    <div
      data-testid="pages-progress-bar"
      data-color={color}
      data-height={height}
      data-delay={delay}
      data-show-spinner={options.showSpinner}
    />
  ),
}))

jest.mock('@/hooks/useIsAppRouter', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/hooks/useTheme', () => ({
  __esModule: true,
  default: jest.fn(),
}))

describe('Progress', () => {
  const LIGHT_PROGRESS_COLOR = '#6366f1'
  const DARK_PROGRESS_COLOR = '#818cf8'

  let useIsAppRouter
  let useTheme

  beforeEach(() => {
    jest.clearAllMocks()
    useIsAppRouter = require('@/hooks/useIsAppRouter').default
    useTheme = require('@/hooks/useTheme').default
  })

  describe('router detection', () => {
    it('should render AppProgressBar when using app router', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'light', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      expect(getByTestId('app-progress-bar')).toBeInTheDocument()
    })

    it('should render PagesProgressBar when using pages router', () => {
      useIsAppRouter.mockReturnValue(false)
      useTheme.mockReturnValue({ theme: 'light', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      expect(getByTestId('pages-progress-bar')).toBeInTheDocument()
    })
  })

  describe('theme-based colors', () => {
    it('should use light indigo color for dark theme', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'dark', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', DARK_PROGRESS_COLOR)
    })

    it('should use indigo color for light theme', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'light', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', LIGHT_PROGRESS_COLOR)
    })

    it('should use default indigo color for unknown theme', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'unknown', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', LIGHT_PROGRESS_COLOR)
    })

    it('should prioritize forceTheme over theme', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'light', forceTheme: 'dark' })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', DARK_PROGRESS_COLOR)
    })

    it('should use theme when forceTheme is null', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'dark', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', DARK_PROGRESS_COLOR)
    })
  })

  describe('progress bar configuration', () => {
    it('should set correct height', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'light', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-height', '2px')
    })

    it('should set delay to 200', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'light', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-delay', '200')
    })

    it('should disable spinner', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'light', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-show-spinner', 'false')
    })
  })

  describe('pages router configuration', () => {
    it('should configure PagesProgressBar correctly', () => {
      useIsAppRouter.mockReturnValue(false)
      useTheme.mockReturnValue({ theme: 'light', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('pages-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', LIGHT_PROGRESS_COLOR)
      expect(progressBar).toHaveAttribute('data-height', '2px')
      expect(progressBar).toHaveAttribute('data-delay', '200')
      expect(progressBar).toHaveAttribute('data-show-spinner', 'false')
    })

    it('should apply dark theme color to PagesProgressBar', () => {
      useIsAppRouter.mockReturnValue(false)
      useTheme.mockReturnValue({ theme: 'dark', forceTheme: null })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('pages-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', DARK_PROGRESS_COLOR)
    })
  })

  describe('edge cases', () => {
    it('should handle undefined theme values gracefully', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: undefined, forceTheme: null })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', LIGHT_PROGRESS_COLOR)
    })

    it('should handle both theme and forceTheme as undefined', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: undefined, forceTheme: undefined })

      const { getByTestId } = render(<Progress />)

      const progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', LIGHT_PROGRESS_COLOR)
    })
  })

  describe('theme changes', () => {
    it('should update color when theme changes from light to dark', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'light', forceTheme: null })

      const { getByTestId, rerender } = render(<Progress />)

      let progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', LIGHT_PROGRESS_COLOR)

      useTheme.mockReturnValue({ theme: 'dark', forceTheme: null })
      rerender(<Progress />)

      progressBar = getByTestId('app-progress-bar')
      expect(progressBar).toHaveAttribute('data-color', DARK_PROGRESS_COLOR)
    })

    it('should update color when forceTheme is applied', () => {
      useIsAppRouter.mockReturnValue(true)
      useTheme.mockReturnValue({ theme: 'light', forceTheme: null })

      const { getByTestId, rerender } = render(<Progress />)

      let progressBar = getByTestId('app-progress-bar')

      expect(progressBar).toHaveAttribute('data-color', LIGHT_PROGRESS_COLOR)

      useTheme.mockReturnValue({ theme: 'light', forceTheme: 'dark' })
      rerender(<Progress />)

      progressBar = getByTestId('app-progress-bar')
      expect(progressBar).toHaveAttribute('data-color', DARK_PROGRESS_COLOR)
    })
  })
})
