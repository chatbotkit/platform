import GlobalRoot, { GlobalRootPortal, useGlobalRootDiv } from './GlobalRoot'

import { render, screen } from '@testing-library/react'

jest.mock('@/components/Portal', () => {
  return function Portal({ children, query }) {
    return (
      <div data-testid="portal" data-query={query}>
        {children}
      </div>
    )
  }
})

jest.mock('@/hooks/useDOMQuerySelector', () => {
  return jest.fn()
})

describe('GlobalRoot', () => {
  let mockUseDOMQuerySelector

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mockUseDOMQuerySelector = require('@/hooks/useDOMQuerySelector')
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })
  describe('basic rendering', () => {
    it('should render div with id global-root', () => {
      const { container } = render(<GlobalRoot />)

      const globalRoot = container.querySelector('#global-root')

      expect(globalRoot).toBeTruthy()
      expect(globalRoot.tagName).toBe('DIV')
    })

    it('should only render a single element', () => {
      const { container } = render(<GlobalRoot />)

      expect(container.children.length).toBe(1)
    })
  })

  describe('GlobalRootPortal', () => {
    it('should render Portal with correct query', () => {
      render(<GlobalRootPortal>Test content</GlobalRootPortal>)

      const portal = screen.getByTestId('portal')

      expect(portal.getAttribute('data-query')).toBe('#global-root')
    })

    it('should render children inside Portal', () => {
      render(<GlobalRootPortal>Test content</GlobalRootPortal>)

      expect(screen.getByText('Test content')).toBeTruthy()
    })

    it('should handle complex children', () => {
      render(
        <GlobalRootPortal>
          <div>
            <span>Complex</span> content
          </div>
        </GlobalRootPortal>
      )

      expect(screen.getByText('Complex')).toBeTruthy()
      expect(
        screen.getByText((content) => content.includes('content'))
      ).toBeTruthy()
    })

    it('should be accessible via GlobalRoot.Portal', () => {
      expect(GlobalRoot.Portal).toBe(GlobalRootPortal)
    })
  })

  describe('useGlobalRootDiv', () => {
    it('should call useDOMQuerySelector with correct selector', () => {
      mockUseDOMQuerySelector.mockReturnValue([null])

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { renderHook } = require('@testing-library/react')

      renderHook(() => useGlobalRootDiv())

      expect(mockUseDOMQuerySelector).toHaveBeenCalledWith('#global-root', {
        waitForElements: true,
      })
    })

    it('should return the global root element', () => {
      const mockElement = document.createElement('div')

      mockUseDOMQuerySelector.mockReturnValue([mockElement])

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { renderHook } = require('@testing-library/react')
      const { result } = renderHook(() => useGlobalRootDiv())

      expect(result.current).toBe(mockElement)
    })

    it('should return null when element not found', () => {
      mockUseDOMQuerySelector.mockReturnValue([null])

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { renderHook } = require('@testing-library/react')
      const { result } = renderHook(() => useGlobalRootDiv())

      expect(result.current).toBeNull()
    })
  })

  describe('integration', () => {
    it('should work together - GlobalRoot and GlobalRootPortal', () => {
      const { container } = render(
        <>
          <GlobalRoot />
          <GlobalRootPortal>Portal content</GlobalRootPortal>
        </>
      )

      expect(container.querySelector('#global-root')).toBeTruthy()
      expect(screen.getByText('Portal content')).toBeTruthy()
    })
  })

  describe('edge cases', () => {
    it('should not render extra attributes', () => {
      const { container } = render(<GlobalRoot />)

      const globalRoot = container.querySelector('#global-root')

      expect(globalRoot.attributes.length).toBe(1) // only id attribute
    })

    it('should render empty when no children', () => {
      const { container } = render(<GlobalRoot />)

      const globalRoot = container.querySelector('#global-root')

      expect(globalRoot.children.length).toBe(0)
    })
  })
})
