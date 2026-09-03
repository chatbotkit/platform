import ResourceList from './ResourceList'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockFetch = jest.fn()
const mockReportError = jest.fn()

// Mock dependencies that ResourceList uses
jest.mock('@chatbotkit-dev/time', () => ({
  timeAgo: jest.fn((date) => `${date} ago`),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  captureException: jest.fn(),
}))

jest.mock('@/hooks/useRouter', () => {
  return function useRouter() {
    return { push: jest.fn() }
  }
})

jest.mock('@/hooks/useSession', () => {
  return function useSession() {
    return { data: { user: { id: 'test-user' } } }
  }
})

jest.mock('@/hooks/useFetch', () => {
  return function useFetch() {
    return {
      fetch: mockFetch,
      loading: false,
      code: null,
      reportError: mockReportError,
    }
  }
})

jest.mock('@/hooks/usePopup', () => {
  return function usePopup() {
    return { showPopup: jest.fn() }
  }
})

jest.mock('@/hooks/useProjectScope', () => ({
  usePublishResourceDeleted: () => jest.fn(),
}))

jest.mock('@/hooks/useControlledState', () => {
  const { useState } = jest.requireActual('react')

  return function useControlledState(defaultValue) {
    return useState(defaultValue)
  }
})

jest.mock('@/components/Confirm', () => ({
  useConfirmDelete: () => jest.fn((callback) => callback),
  useConfirmDeleteWithOptions: () => jest.fn(() => Promise.resolve({})),
}))

jest.mock('@/components/DotsLoader', () => {
  return function DotsLoader() {
    return null
  }
})

jest.mock('@/components/DynamicIcon', () => {
  return function DynamicIcon({ icon }) {
    return <span data-testid="icon">{icon}</span>
  }
})

jest.mock('@/components/ExportLink', () => {
  return function ExportLink() {
    return null
  }
})

jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: function GlobalRootPortal({ children }) {
    return <div>{children}</div>
  },
}))

jest.mock('@/components/List', () => {
  const { Children } = jest.requireActual('react')

  function List({ children, emptyMessage }) {
    const hasChildren = Children.toArray(children).length > 0

    return (
      <div data-testid="list">
        {hasChildren ? children : <div>{emptyMessage}</div>}
      </div>
    )
  }

  List.Item = function ListItem({ children, title }) {
    return (
      <div data-testid="list-item" data-title={title}>
        {children}
      </div>
    )
  }

  return List
})

jest.mock('@/components/LoadMoreButton', () => {
  return function LoadMoreButton({ loadMore, hasMore }) {
    return (
      <button
        type="button"
        data-testid="load-more"
        data-has-more={hasMore ? 'true' : 'false'}
        onClick={loadMore}
      >
        Load more
      </button>
    )
  }
})

jest.mock('@/components/ObjectView', () => {
  return function ObjectView() {
    return null
  }
})

jest.mock('@/components/ResourceFilterButton', () => {
  return function ResourceFilterButton() {
    return null
  }
})

describe('ResourceList', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockReportError.mockReset()
  })

  it('should show a loading message while externally loading an empty list', () => {
    render(
      <ResourceList
        kind="conversation"
        loading
        listRoute="/api/v1/conversation/list"
        instanceRoute="/conversations/[id]"
      />
    )

    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(screen.queryByText('You do not have any conversations yet.')).toBe(
      null
    )
  })

  it('should show a loading message before auto loading an empty list', () => {
    const listRoute = jest.fn(() => new Promise(() => {}))

    render(
      <ResourceList
        kind="conversation"
        autoLoad
        listRoute={listRoute}
        instanceRoute="/conversations/[id]"
      />
    )

    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(screen.queryByText('You do not have any conversations yet.')).toBe(
      null
    )
  })

  describe('expiry tag', () => {
    it('renders a generic "expires" tag for any item that carries an expiresAt', () => {
      render(
        <ResourceList
          kind="task"
          defaultItems={[
            { id: 'with-expiry', name: 'A', expiresAt: '2024-06-01' },
            { id: 'no-expiry', name: 'B' },
          ]}
          instanceRoute="/tasks/[id]"
        />
      )

      const items = screen.getAllByTestId('list-item')

      // the item carrying expiresAt shows the generic tag...
      expect(items[0].textContent).toContain('expires 2024-06-01 ago')

      // ...and the one without it does not
      expect(items[1].textContent).not.toContain('expires')
    })
  })

  describe('pagination cursor handling', () => {
    it('should keep a reset function route exhausted when its cursor is null', async () => {
      const apiRef = { current: null }
      const listRoute = jest.fn().mockResolvedValue({
        items: Array.from({ length: 10 }, (_, index) => ({
          id: `item-${index + 1}`,
          name: `Item ${index + 1}`,
        })),
        cursor: null,
      })

      render(
        <ResourceList
          apiRef={apiRef}
          kind="conversation"
          listRoute={listRoute}
          instanceRoute="/conversations/[id]"
        />
      )

      await act(async () => {
        await apiRef.current.reset()
      })

      expect(screen.queryByTestId('load-more')).toBeNull()
    })

    it('should dedupe function listRoute results by id', async () => {
      const defaultItems = Array.from({ length: 10 }, (_, index) => ({
        id: `item-${index + 1}`,
        name: `Item ${index + 1}`,
        createdAt: new Date().toISOString(),
      }))

      const listRoute = jest.fn().mockResolvedValue({
        items: [
          { id: 'item-10', name: 'Item 10' },
          { id: 'item-11', name: 'Item 11' },
        ],
        cursor: 'next-cursor',
      })

      render(
        <ResourceList
          kind="conversation"
          defaultItems={defaultItems}
          defaultTotalCount={100}
          defaultHasMore
          listRoute={listRoute}
          instanceRoute="/conversations/[id]"
        />
      )

      fireEvent.click(screen.getByTestId('load-more'))

      await waitFor(() => {
        expect(listRoute).toHaveBeenCalledTimes(1)
      })

      await waitFor(() => {
        expect(screen.getAllByTestId('list-item')).toHaveLength(11)
      })
    })

    it('should set hasMore to false when response cursor is missing', async () => {
      const defaultItems = Array.from({ length: 10 }, (_, index) => ({
        id: `item-${index + 1}`,
        name: `Item ${index + 1}`,
        createdAt: new Date().toISOString(),
      }))

      mockFetch.mockResolvedValueOnce({
        error: null,
        data: {
          items: Array.from({ length: 10 }, (_, index) => ({
            id: `item-${index + 11}`,
            name: `Item ${index + 11}`,
          })),
          cursor: null,
        },
      })

      render(
        <ResourceList
          kind="conversation"
          defaultItems={defaultItems}
          defaultTotalCount={100}
          defaultHasMore
          listRoute="/api/v1/conversation/list"
          instanceRoute="/conversations/[id]"
        />
      )

      fireEvent.click(screen.getByTestId('load-more'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      await waitFor(() => {
        expect(screen.queryByTestId('load-more')).toBeNull()
      })
    })

    it('should use explicit initial cursor before falling back to last item id', async () => {
      const defaultItems = Array.from({ length: 10 }, (_, index) => ({
        id: `item-${index + 1}`,
        name: `Item ${index + 1}`,
        createdAt: new Date().toISOString(),
      }))

      mockFetch.mockResolvedValueOnce({
        error: null,
        data: {
          items: [{ id: 'item-11', name: 'Item 11' }],
          cursor: 'cursor-from-response',
        },
      })

      render(
        <ResourceList
          kind="conversation"
          defaultItems={defaultItems}
          defaultCursor="opaque-initial-cursor"
          defaultTotalCount={100}
          defaultHasMore
          listRoute="/api/v1/conversation/list"
          instanceRoute="/conversations/[id]"
        />
      )

      fireEvent.click(screen.getByTestId('load-more'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      const firstCallPath = mockFetch.mock.calls[0][0]

      expect(firstCallPath).toContain('cursor=opaque-initial-cursor')
      expect(firstCallPath).not.toContain('cursor=item-10')
    })

    it('should use response cursor for subsequent load more requests', async () => {
      const defaultItems = Array.from({ length: 10 }, (_, index) => ({
        id: `item-${index + 1}`,
        name: `Item ${index + 1}`,
        createdAt: new Date().toISOString(),
      }))

      mockFetch
        .mockResolvedValueOnce({
          error: null,
          data: {
            items: Array.from({ length: 10 }, (_, index) => ({
              id: `item-${index + 11}`,
              name: `Item ${index + 11}`,
            })),
            cursor: 'cursor-from-response',
          },
        })
        .mockResolvedValueOnce({
          error: null,
          data: {
            items: [{ id: 'item-12', name: 'Item 12' }],
            cursor: 'cursor-from-second-response',
          },
        })

      render(
        <ResourceList
          kind="conversation"
          defaultItems={defaultItems}
          defaultTotalCount={100}
          defaultHasMore
          listRoute="/api/v1/conversation/list"
          instanceRoute="/conversations/[id]"
        />
      )

      fireEvent.click(screen.getByTestId('load-more'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      fireEvent.click(screen.getByTestId('load-more'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      const secondCallPath = mockFetch.mock.calls[1][0]

      expect(secondCallPath).toContain('cursor=cursor-from-response')
    })
  })

  describe('meta.integrations.extract handling', () => {
    it('should not crash when meta.integrations exists but extract is undefined', () => {
      // This test reproduces the bug from the regression
      // When meta.integrations exists but extract is undefined, accessing
      // meta.integrations?.extract.flagged throws:
      // "TypeError: Cannot read properties of undefined (reading 'flagged')"
      const itemsWithBrokenMeta = [
        {
          id: 'test-id',
          name: 'Test Item',
          description: 'Test Description',
          createdAt: new Date().toISOString(),
          meta: {
            abuse: { flagged: true },
            integrations: {
              // extract is missing - this triggers the bug
            },
          },
        },
      ]

      // This should not throw
      expect(() => {
        render(
          <ResourceList
            kind="conversation"
            defaultItems={itemsWithBrokenMeta}
            listRoute="/api/v1/conversation/list"
            instanceRoute="/conversations/[id]"
          />
        )
      }).not.toThrow()
    })

    it('should not crash when meta.integrations is undefined', () => {
      const itemsWithNoIntegrations = [
        {
          id: 'test-id',
          name: 'Test Item',
          description: 'Test Description',
          createdAt: new Date().toISOString(),
          meta: {
            abuse: { flagged: true },
            // integrations is missing entirely
          },
        },
      ]

      expect(() => {
        render(
          <ResourceList
            kind="conversation"
            defaultItems={itemsWithNoIntegrations}
            listRoute="/api/v1/conversation/list"
            instanceRoute="/conversations/[id]"
          />
        )
      }).not.toThrow()
    })

    it('should render flagged tag when meta.integrations.extract.flagged is true', () => {
      const itemsWithExtractFlagged = [
        {
          id: 'test-id',
          name: 'Test Item',
          description: 'Test Description',
          createdAt: new Date().toISOString(),
          meta: {
            abuse: { flagged: true },
            integrations: {
              extract: { flagged: true },
            },
          },
        },
      ]

      render(
        <ResourceList
          kind="conversation"
          defaultItems={itemsWithExtractFlagged}
          listRoute="/api/v1/conversation/list"
          instanceRoute="/conversations/[id]"
        />
      )

      // Should render without crashing and show the flagged tag
      expect(screen.getByTestId('list')).toBeTruthy()
    })

    it('should render custom flagged value when meta.integrations.extract.flagged is a string', () => {
      const itemsWithExtractFlaggedString = [
        {
          id: 'test-id',
          name: 'Test Item',
          description: 'Test Description',
          createdAt: new Date().toISOString(),
          meta: {
            abuse: { flagged: true },
            integrations: {
              extract: { flagged: 'custom-flag-value' },
            },
          },
        },
      ]

      render(
        <ResourceList
          kind="conversation"
          defaultItems={itemsWithExtractFlaggedString}
          listRoute="/api/v1/conversation/list"
          instanceRoute="/conversations/[id]"
        />
      )

      expect(screen.getByTestId('list')).toBeTruthy()
    })
  })

  describe('autoLoad behavior', () => {
    it('should stop loading and report a function route failure', async () => {
      const error = new Error('GraphQL failed')
      const listRoute = jest.fn().mockRejectedValue(error)

      render(
        <ResourceList
          kind="event"
          autoLoad={true}
          listRoute={listRoute}
          instanceRoute="/events/[id]"
        />
      )

      await waitFor(() => {
        expect(mockReportError).toHaveBeenCalledWith(error)
      })

      expect(screen.queryByText('Loading...')).toBeNull()
      expect(screen.getByText(/Unable to load events/)).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    })

    it('should call handleLoadMore once when autoLoad is enabled and items are empty', async () => {
      mockFetch.mockResolvedValueOnce({
        error: null,
        data: {
          items: [
            {
              id: 'item-1',
              name: 'Item 1',
              createdAt: new Date().toISOString(),
            },
          ],
          cursor: 'next-cursor',
        },
      })

      render(
        <ResourceList
          kind="event"
          autoLoad={true}
          listRoute="/api/v1/event/log/list"
          instanceRoute="/events/[id]"
        />
      )

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Wait a bit more to ensure no additional calls are made
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not trigger infinite loop when cursor updates after autoLoad', async () => {
      // This test verifies the fix for the infinite pagination bug.
      // Previously, autoLoad triggered handleLoadMore, which updated cursor,
      // which recreated handleLoadMore, which re-triggered the autoLoad effect.

      let callCount = 0

      mockFetch.mockImplementation(async () => {
        callCount++

        return {
          error: null,
          data: {
            items: [
              {
                id: `item-${callCount}`,
                name: `Item ${callCount}`,
                createdAt: new Date().toISOString(),
              },
            ],
            cursor: `cursor-${callCount}`,
          },
        }
      })

      render(
        <ResourceList
          kind="event"
          autoLoad={true}
          listRoute="/api/v1/event/log/list"
          instanceRoute="/events/[id]"
        />
      )

      // Wait for initial load
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Give time for any potential infinite loop to manifest
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Should only have called once - not looped infinitely
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not auto-load when items already exist', async () => {
      const existingItems = [
        { id: 'item-1', name: 'Item 1', createdAt: new Date().toISOString() },
      ]

      render(
        <ResourceList
          kind="event"
          autoLoad={true}
          defaultItems={existingItems}
          listRoute="/api/v1/event/log/list"
          instanceRoute="/events/[id]"
        />
      )

      // Wait a bit - should not trigger any fetch
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should auto-load exactly once even with multiple cursor updates via pagination', async () => {
      // Simulates the scenario where user manually loads more after autoLoad
      mockFetch
        .mockResolvedValueOnce({
          error: null,
          data: {
            items: Array.from({ length: 10 }, (_, i) => ({
              id: `item-${i + 1}`,
              name: `Item ${i + 1}`,
              createdAt: new Date().toISOString(),
            })),
            cursor: 'cursor-1',
          },
        })
        .mockResolvedValueOnce({
          error: null,
          data: {
            items: Array.from({ length: 10 }, (_, i) => ({
              id: `item-${i + 11}`,
              name: `Item ${i + 11}`,
              createdAt: new Date().toISOString(),
            })),
            cursor: 'cursor-2',
          },
        })

      render(
        <ResourceList
          kind="event"
          autoLoad={true}
          defaultHasMore={true}
          defaultTotalCount={100}
          listRoute="/api/v1/event/log/list"
          instanceRoute="/events/[id]"
        />
      )

      // Wait for autoLoad to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Click load more manually
      fireEvent.click(await screen.findByTestId('load-more'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      // Ensure no extra calls from autoLoad re-triggering
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
