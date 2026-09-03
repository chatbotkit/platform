import ReloadingPageErrorBoundary from '@/components/ReloadingPageErrorBoundary'

import { render } from '@testing-library/react'

// mock captureError to prevent actual error logging

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
}))

// mock sessionStorage

const mockSessionStorage = {
  store: {},
  getItem: jest.fn((key) => mockSessionStorage.store[key] || null),
  setItem: jest.fn((key, value) => {
    mockSessionStorage.store[key] = value
  }),
  removeItem: jest.fn((key) => {
    delete mockSessionStorage.store[key]
  }),
  clear: jest.fn(() => {
    mockSessionStorage.store = {}
  }),
}

jest.mock('@/lib/browserstorage', () => ({
  getSessionStorage: () => mockSessionStorage,
}))

describe('ReloadingPageErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionStorage.clear()
  })

  describe('safeErrors', () => {
    it('should include NotFoundError as a default safe error', () => {
      // @note this tests the regression fix
      // NotFoundError happens when browser extensions modify DOM nodes
      // that React is trying to reconcile

      const ThrowingComponent = () => {
        const error = new Error('The node to be removed is not a child')

        error.name = 'NotFoundError'

        throw error
      }

      // suppress console.error for this test

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const { container } = render(
        <ReloadingPageErrorBoundary>
          <ThrowingComponent />
        </ReloadingPageErrorBoundary>
      )

      // should render null without triggering reload logic

      expect(container.innerHTML).toBe('')

      // should not have set reload counter in sessionStorage

      expect(mockSessionStorage.setItem).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should allow custom safeErrors to be added', () => {
      const ThrowingComponent = () => {
        const error = new Error('Custom error')

        error.name = 'CustomSafeError'

        throw error
      }

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const { container } = render(
        <ReloadingPageErrorBoundary safeErrors={['CustomSafeError']}>
          <ThrowingComponent />
        </ReloadingPageErrorBoundary>
      )

      expect(container.innerHTML).toBe('')
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should combine default and custom safeErrors', () => {
      // both NotFoundError (default) and CustomError (custom) should be safe

      const ThrowNotFound = () => {
        const error = new Error('Node not found')

        error.name = 'NotFoundError'

        throw error
      }

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const { container } = render(
        <ReloadingPageErrorBoundary safeErrors={['CustomError']}>
          <ThrowNotFound />
        </ReloadingPageErrorBoundary>
      )

      expect(container.innerHTML).toBe('')
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('rendering', () => {
    it('should render children when no error occurs', () => {
      const { getByText } = render(
        <ReloadingPageErrorBoundary>
          <div>Hello World</div>
        </ReloadingPageErrorBoundary>
      )

      expect(getByText('Hello World')).toBeTruthy()
    })

    it('should render null when an error occurs', () => {
      const ThrowingComponent = () => {
        throw new Error('Test error')
      }

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const { container } = render(
        <ReloadingPageErrorBoundary>
          <ThrowingComponent />
        </ReloadingPageErrorBoundary>
      )

      expect(container.innerHTML).toBe('')

      consoleSpy.mockRestore()
    })
  })
})
