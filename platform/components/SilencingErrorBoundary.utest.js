import SilencingErrorBoundary from './SilencingErrorBoundary'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('next/head', () => {
  return function Head({ children }) {
    return <>{children}</>
  }
})

jest.mock('next/image', () => {
  return function Image({ src, alt, ...props }) {
    return <img src={src} alt={alt} {...props} />
  }
})

jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    events: { on: jest.fn(), off: jest.fn() },
  })),
}))

describe('SilencingErrorBoundary', () => {
  // Suppress console.error for expected errors
  // eslint-disable-next-line no-console
  const originalError = console.error

  beforeAll(() => {
    // eslint-disable-next-line no-console
    console.error = jest.fn()
  })

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.error = originalError
  })

  describe('basic functionality', () => {
    it('should render children without errors', () => {
      render(
        <SilencingErrorBoundary>
          <div>Test content</div>
        </SilencingErrorBoundary>
      )

      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('should render multiple children', () => {
      render(
        <SilencingErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
        </SilencingErrorBoundary>
      )

      expect(screen.getByText('First child')).toBeInTheDocument()
      expect(screen.getByText('Second child')).toBeInTheDocument()
    })

    it('should render nested components', () => {
      const NestedComponent = () => <span>Nested content</span>

      render(
        <SilencingErrorBoundary>
          <div>
            <NestedComponent />
          </div>
        </SilencingErrorBoundary>
      )

      expect(screen.getByText('Nested content')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('should catch and silence errors from children', () => {
      const ThrowError = () => {
        throw new Error('Test error')
      }

      // This should not throw
      render(
        <SilencingErrorBoundary>
          <ThrowError />
        </SilencingErrorBoundary>
      )

      // Component should handle the error silently
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalled()
    })

    it('should render null when child throws', () => {
      const ThrowError = () => {
        throw new Error('Component error')
      }

      const { container } = render(
        <SilencingErrorBoundary>
          <ThrowError />
        </SilencingErrorBoundary>
      )

      // When error boundary catches an error, it stops rendering
      expect(container.firstChild).toBeNull()
    })

    it('should not affect parent components', () => {
      const ThrowError = () => {
        throw new Error('Child error')
      }

      render(
        <div>
          <div>Before boundary</div>
          <SilencingErrorBoundary>
            <ThrowError />
          </SilencingErrorBoundary>
          <div>After boundary</div>
        </div>
      )

      expect(screen.getByText('Before boundary')).toBeInTheDocument()
      expect(screen.getByText('After boundary')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle null children', () => {
      render(<SilencingErrorBoundary>{null}</SilencingErrorBoundary>)

      // Should not throw
      expect(true).toBe(true)
    })

    it('should handle undefined children', () => {
      render(<SilencingErrorBoundary>{undefined}</SilencingErrorBoundary>)

      // Should not throw
      expect(true).toBe(true)
    })

    it('should handle empty children', () => {
      render(<SilencingErrorBoundary></SilencingErrorBoundary>)

      // Should not throw
      expect(true).toBe(true)
    })

    it('should handle string children', () => {
      render(<SilencingErrorBoundary>Plain text</SilencingErrorBoundary>)

      expect(screen.getByText('Plain text')).toBeInTheDocument()
    })

    it('should handle number children', () => {
      render(<SilencingErrorBoundary>{42}</SilencingErrorBoundary>)

      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('should handle boolean children', () => {
      render(
        <SilencingErrorBoundary>
          {true}
          {false}
        </SilencingErrorBoundary>
      )

      // Booleans render as nothing in React
      expect(true).toBe(true)
    })
  })

  describe('component lifecycle', () => {
    it('should not throw when componentDidCatch is called', () => {
      const ThrowError = () => {
        throw new Error('Lifecycle error')
      }

      // Should not throw - error is silenced
      expect(() => {
        render(
          <SilencingErrorBoundary>
            <ThrowError />
          </SilencingErrorBoundary>
        )
      }).not.toThrow()
    })

    it('should continue rendering after catching error', () => {
      const ThrowError = () => {
        throw new Error('First error')
      }

      const { rerender } = render(
        <SilencingErrorBoundary>
          <ThrowError />
        </SilencingErrorBoundary>
      )

      // Should be able to rerender with valid children
      rerender(
        <SilencingErrorBoundary>
          <div>Valid content</div>
        </SilencingErrorBoundary>
      )

      expect(screen.getByText('Valid content')).toBeInTheDocument()
    })
  })
})
