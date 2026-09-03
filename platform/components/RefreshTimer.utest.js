/**
 * @jest-environment jsdom
 */
import { useCallback, useState } from 'react'

import RefreshTimer from './RefreshTimer'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

// Mock DynamicIcon
jest.mock('@/components/DynamicIcon', () => {
  return function MockDynamicIcon({ icon, className }) {
    return <span data-testid="icon" data-icon={icon} className={className} />
  }
})

describe('RefreshTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('rendering', () => {
    it('should render countdown when interval is set', () => {
      render(<RefreshTimer interval={30} onRefresh={jest.fn()} />)

      expect(screen.getByText('30s')).toBeInTheDocument()
    })

    it('should not render when interval is 0', () => {
      const { container } = render(
        <RefreshTimer interval={0} onRefresh={jest.fn()} />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should not render when interval is negative', () => {
      const { container } = render(
        <RefreshTimer interval={-1} onRefresh={jest.fn()} />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('countdown behavior', () => {
    it('should decrement countdown every second', () => {
      render(<RefreshTimer interval={30} onRefresh={jest.fn()} />)

      expect(screen.getByText('30s')).toBeInTheDocument()

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(screen.getByText('29s')).toBeInTheDocument()

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(screen.getByText('28s')).toBeInTheDocument()
    })

    it('should call onRefresh when countdown reaches 0', () => {
      const onRefresh = jest.fn()

      render(<RefreshTimer interval={3} onRefresh={onRefresh} />)

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should reset countdown after reaching 0', () => {
      const onRefresh = jest.fn()

      render(<RefreshTimer interval={3} onRefresh={onRefresh} />)

      act(() => {
        jest.advanceTimersByTime(3000)
      })

      // Should have reset to interval
      expect(screen.getByText('3s')).toBeInTheDocument()
    })

    it('should not call onRefresh inside a state updater to avoid setState-in-render warnings', () => {
      // @note this test verifies the fix for "Cannot update a component while
      // rendering a different component" - onRefresh must be called from a
      // useEffect, not from inside setCountdown's updater function

      const renderCounts = { parent: 0 }

      function Parent() {
        const [refreshCount, setRefreshCount] = useState(0)

        renderCounts.parent++

        // @note if onRefresh is called inside a state updater (during render),
        // React will warn about updating Parent while rendering RefreshTimer
        const onRefresh = useCallback(() => {
          setRefreshCount((c) => c + 1)
        }, [])

        return (
          <div>
            <span data-testid="refresh-count">{refreshCount}</span>
            <RefreshTimer interval={2} onRefresh={onRefresh} />
          </div>
        )
      }

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      render(<Parent />)

      act(() => {
        jest.advanceTimersByTime(2000)
      })

      expect(screen.getByTestId('refresh-count')).toHaveTextContent('1')

      // Verify no React warnings about setState during render
      const setStateWarnings = consoleSpy.mock.calls.filter((args) =>
        args.some(
          (arg) =>
            typeof arg === 'string' && arg.includes('Cannot update a component')
        )
      )

      expect(setStateWarnings).toHaveLength(0)

      consoleSpy.mockRestore()
    })

    it('should reset countdown when interval prop changes', () => {
      const { rerender } = render(
        <RefreshTimer interval={30} onRefresh={jest.fn()} />
      )

      act(() => {
        jest.advanceTimersByTime(5000)
      })

      expect(screen.getByText('25s')).toBeInTheDocument()

      rerender(<RefreshTimer interval={60} onRefresh={jest.fn()} />)

      expect(screen.getByText('60s')).toBeInTheDocument()
    })
  })

  describe('hover behavior (CSS-based)', () => {
    it('should render both countdown and refresh icon for CSS toggle', () => {
      render(<RefreshTimer interval={30} onRefresh={jest.fn()} />)

      // Both elements should be in DOM, CSS handles visibility
      expect(screen.getByText('30s')).toBeInTheDocument()

      const icon = screen.getByTestId('icon')

      expect(icon).toHaveAttribute(
        'data-icon',
        '@lucide/rotate-cw#filter=#d97706'
      )
    })
  })

  describe('click behavior', () => {
    it('should call onRefresh when clicked', () => {
      const onRefresh = jest.fn()

      render(<RefreshTimer interval={30} onRefresh={onRefresh} />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(onRefresh).toHaveBeenCalledTimes(1)
    })

    it('should reset countdown when clicked', () => {
      render(<RefreshTimer interval={30} onRefresh={jest.fn()} />)

      act(() => {
        jest.advanceTimersByTime(10000)
      })

      expect(screen.getByText('20s')).toBeInTheDocument()

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(screen.getByText('30s')).toBeInTheDocument()
    })

    it('should not call onRefresh when loading', () => {
      const onRefresh = jest.fn()

      render(<RefreshTimer interval={30} onRefresh={onRefresh} loading />)

      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(onRefresh).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('should show loading spinner when loading', () => {
      render(<RefreshTimer interval={30} onRefresh={jest.fn()} loading />)

      const icon = screen.getByTestId('icon')

      expect(icon).toHaveAttribute(
        'data-icon',
        '@lucide/loader-circle#filter=#d97706'
      )
    })

    it('should disable button when loading', () => {
      render(<RefreshTimer interval={30} onRefresh={jest.fn()} loading />)

      const button = screen.getByRole('button')

      expect(button).toBeDisabled()
    })
  })

  describe('accessibility', () => {
    it('should have appropriate title showing countdown', () => {
      render(<RefreshTimer interval={30} onRefresh={jest.fn()} />)

      const button = screen.getByRole('button')

      expect(button).toHaveAttribute('title', 'Refreshing in 30 seconds')
    })
  })

  describe('styling', () => {
    it('should apply custom className', () => {
      render(
        <RefreshTimer
          interval={30}
          onRefresh={jest.fn()}
          className="custom-class"
        />
      )

      const button = screen.getByRole('button')

      expect(button).toHaveClass('custom-class')
    })
  })
})
