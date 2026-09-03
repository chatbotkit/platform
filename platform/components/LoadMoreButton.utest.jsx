import LoadMoreButton from './LoadMoreButton'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

// Mock Children component
jest.mock('@/components/Children', () => {
  return function Children({ children, ...props }) {
    return typeof children === 'function' ? children(props) : children
  }
})

describe('LoadMoreButton', () => {
  let mockLoadMore

  beforeEach(() => {
    mockLoadMore = jest.fn().mockResolvedValue(undefined)
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render button when hasMore is true', () => {
      render(<LoadMoreButton hasMore={true} loadMore={mockLoadMore} />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should not render when hasMore is false', () => {
      render(<LoadMoreButton hasMore={false} loadMore={mockLoadMore} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should render default text "Load more"', () => {
      render(<LoadMoreButton hasMore={true} loadMore={mockLoadMore} />)
      expect(screen.getByRole('button')).toHaveTextContent('Load more')
    })

    it('should render custom children', () => {
      render(
        <LoadMoreButton hasMore={true} loadMore={mockLoadMore}>
          Custom Load Text
        </LoadMoreButton>
      )
      expect(screen.getByRole('button')).toHaveTextContent('Custom Load Text')
    })

    it('should apply custom className', () => {
      render(
        <LoadMoreButton
          hasMore={true}
          loadMore={mockLoadMore}
          className="custom-class"
        />
      )
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })

    it('should forward additional props to button', () => {
      render(
        <LoadMoreButton
          hasMore={true}
          loadMore={mockLoadMore}
          data-testid="load-btn"
          aria-label="Load more items"
        />
      )

      const button = screen.getByRole('button')

      expect(button).toHaveAttribute('data-testid', 'load-btn')
      expect(button).toHaveAttribute('aria-label', 'Load more items')
    })
  })

  describe('click behavior', () => {
    it('should call loadMore when clicked', async () => {
      render(<LoadMoreButton hasMore={true} loadMore={mockLoadMore} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button'))
      })

      expect(mockLoadMore).toHaveBeenCalledTimes(1)
    })

    it('should call onClick handler after loadMore', async () => {
      const mockOnClick = jest.fn()

      render(
        <LoadMoreButton
          hasMore={true}
          loadMore={mockLoadMore}
          onClick={mockOnClick}
        />
      )

      await act(async () => {
        fireEvent.click(screen.getByRole('button'))
      })

      expect(mockLoadMore).toHaveBeenCalledTimes(1)
      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })

    it('should prevent default and stop propagation on click', async () => {
      render(<LoadMoreButton hasMore={true} loadMore={mockLoadMore} />)

      const button = screen.getByRole('button')
      const event = new MouseEvent('click', { bubbles: true })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')
      const stopPropagationSpy = jest.spyOn(event, 'stopPropagation')

      await act(async () => {
        fireEvent(button, event)
      })

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(stopPropagationSpy).toHaveBeenCalled()
    })

    it('should not call loadMore when hasMore is false', async () => {
      const { rerender } = render(
        <LoadMoreButton hasMore={true} loadMore={mockLoadMore} />
      )

      rerender(<LoadMoreButton hasMore={false} loadMore={mockLoadMore} />)

      // Button should not be rendered
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(mockLoadMore).not.toHaveBeenCalled()
    })

    it('should prevent concurrent loadMore calls', async () => {
      let resolveLoadMore
      let loadMorePromise
      const slowLoadMore = jest.fn(
        () =>
          new Promise((resolve) => {
            loadMorePromise = resolve
            resolveLoadMore = resolve
          })
      )

      render(<LoadMoreButton hasMore={true} loadMore={slowLoadMore} />)

      const button = screen.getByRole('button')

      // First click
      act(() => {
        fireEvent.click(button)
      })

      // Second click while first is still loading
      act(() => {
        fireEvent.click(button)
      })

      // Third click
      act(() => {
        fireEvent.click(button)
      })

      // Should only call once
      expect(slowLoadMore).toHaveBeenCalledTimes(1)

      // Resolve the promise
      await act(async () => {
        if (loadMorePromise) {
          loadMorePromise()
        }

        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // Now it should allow another call
      await act(async () => {
        fireEvent.click(button)
      })

      expect(slowLoadMore).toHaveBeenCalledTimes(2)

      // Cleanup - resolve any pending promise
      if (loadMorePromise) {
        await act(async () => {
          loadMorePromise()
          await new Promise((resolve) => setTimeout(resolve, 0))
        })
      }
    })
  })

  describe('loading state', () => {
    it('should show loading text while loading', async () => {
      let resolveLoadMore
      const slowLoadMore = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveLoadMore = resolve
          })
      )

      render(<LoadMoreButton hasMore={true} loadMore={slowLoadMore} />)

      const button = screen.getByRole('button')

      expect(button).toHaveTextContent('Load more')

      act(() => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(button).toHaveTextContent('Loading...')
      })

      await act(async () => {
        resolveLoadMore()
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(button).toHaveTextContent('Load more')
      })
    })

    it('should apply loadingClassName when loading', async () => {
      let resolveLoadMore
      const slowLoadMore = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveLoadMore = resolve
          })
      )

      render(
        <LoadMoreButton
          hasMore={true}
          loadMore={slowLoadMore}
          className="btn"
          loadingClassName="btn-loading"
        />
      )

      const button = screen.getByRole('button')

      expect(button).toHaveClass('btn')
      expect(button).not.toHaveClass('btn-loading')

      act(() => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(button).toHaveClass('btn', 'btn-loading')
      })

      await act(async () => {
        resolveLoadMore()
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(button).toHaveClass('btn')
        expect(button).not.toHaveClass('btn-loading')
      })
    })

    it('should disable button while loading', async () => {
      let resolveLoadMore
      const slowLoadMore = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveLoadMore = resolve
          })
      )

      render(<LoadMoreButton hasMore={true} loadMore={slowLoadMore} />)

      const button = screen.getByRole('button')

      expect(button).not.toBeDisabled()

      act(() => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(button).toBeDisabled()
      })

      await act(async () => {
        resolveLoadMore()
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(button).not.toBeDisabled()
      })
    })

    it('should set aria-busy while loading', async () => {
      let resolveLoadMore
      const slowLoadMore = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveLoadMore = resolve
          })
      )

      render(<LoadMoreButton hasMore={true} loadMore={slowLoadMore} />)

      const button = screen.getByRole('button')

      expect(button).not.toHaveAttribute('aria-busy')

      act(() => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-busy', 'true')
      })

      await act(async () => {
        resolveLoadMore()
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(button).not.toHaveAttribute('aria-busy')
      })
    })

    it('should show custom loading children', async () => {
      let resolveLoadMore
      const slowLoadMore = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveLoadMore = resolve
          })
      )

      render(
        <LoadMoreButton hasMore={true} loadMore={slowLoadMore}>
          {({ isLoading }) => (isLoading ? 'Please wait...' : 'Click me')}
        </LoadMoreButton>
      )

      const button = screen.getByRole('button')

      expect(button).toHaveTextContent('Click me')

      act(() => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(button).toHaveTextContent('Please wait...')
      })

      await act(async () => {
        resolveLoadMore()
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(button).toHaveTextContent('Click me')
      })
    })
  })

  describe('disabled prop', () => {
    it('should disable button when disabled prop is true', () => {
      render(<LoadMoreButton hasMore={true} loadMore={mockLoadMore} disabled />)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should pass disabled prop to children function', () => {
      render(
        <LoadMoreButton hasMore={true} loadMore={mockLoadMore} disabled>
          {({ disabled }) => (disabled ? 'Disabled' : 'Enabled')}
        </LoadMoreButton>
      )
      expect(screen.getByRole('button')).toHaveTextContent('Disabled')
    })

    it('should remain disabled when loading', async () => {
      let resolveLoadMore
      const slowLoadMore = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveLoadMore = resolve
          })
      )

      render(<LoadMoreButton hasMore={true} loadMore={slowLoadMore} disabled />)

      const button = screen.getByRole('button')

      expect(button).toBeDisabled()

      act(() => {
        fireEvent.click(button)
      })

      // Should still be disabled
      expect(button).toBeDisabled()

      await act(async () => {
        if (resolveLoadMore) {
          resolveLoadMore()
        }

        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(button).toBeDisabled()
    })
  })

  describe('autoLoad functionality', () => {
    beforeEach(() => {
      // Mock requestAnimationFrame
      global.requestAnimationFrame = jest.fn((cb) => {
        setTimeout(cb, 0)

        return 1
      })
      global.cancelAnimationFrame = jest.fn()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should not autoload when autoLoad is false', () => {
      render(
        <LoadMoreButton
          hasMore={true}
          loadMore={mockLoadMore}
          autoLoad={false}
        />
      )

      expect(mockLoadMore).not.toHaveBeenCalled()
    })

    it('should set up scroll listener when autoLoad is true', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

      render(<LoadMoreButton hasMore={true} loadMore={mockLoadMore} autoLoad />)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
        { passive: true }
      )
    })

    it('should not autoload when hasMore is false', () => {
      render(
        <LoadMoreButton hasMore={false} loadMore={mockLoadMore} autoLoad />
      )

      expect(mockLoadMore).not.toHaveBeenCalled()
    })

    it('should cleanup scroll listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = render(
        <LoadMoreButton hasMore={true} loadMore={mockLoadMore} autoLoad />
      )

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function)
      )
    })

    it('should cleanup scroll listener when autoLoad changes to false', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { rerender } = render(
        <LoadMoreButton hasMore={true} loadMore={mockLoadMore} autoLoad />
      )

      rerender(
        <LoadMoreButton
          hasMore={true}
          loadMore={mockLoadMore}
          autoLoad={false}
        />
      )

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function)
      )
    })
  })

  describe('edge cases', () => {
    it('should handle loadMore function changing', async () => {
      const loadMore1 = jest.fn().mockResolvedValue(undefined)
      const loadMore2 = jest.fn().mockResolvedValue(undefined)

      const { rerender } = render(
        <LoadMoreButton hasMore={true} loadMore={loadMore1} />
      )

      await act(async () => {
        fireEvent.click(screen.getByRole('button'))
      })

      expect(loadMore1).toHaveBeenCalledTimes(1)

      rerender(<LoadMoreButton hasMore={true} loadMore={loadMore2} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button'))
      })

      expect(loadMore2).toHaveBeenCalledTimes(1)
    })

    it('should handle button type attribute', () => {
      render(<LoadMoreButton hasMore={true} loadMore={mockLoadMore} />)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })
  })
})
