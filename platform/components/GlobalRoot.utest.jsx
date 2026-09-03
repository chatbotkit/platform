import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'

import GlobalRoot, { GlobalRootPortal, useGlobalRootDiv } from './GlobalRoot'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'

jest.mock('@/hooks/useDOMQuerySelector', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/components/Portal', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="portal">{children}</div>,
}))

describe('GlobalRoot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GlobalRoot component', () => {
    it('should render div with global-root id', () => {
      const { container } = render(<GlobalRoot />)

      const globalRoot = container.querySelector('#global-root')

      expect(globalRoot).toBeInTheDocument()
      expect(globalRoot.tagName).toBe('DIV')
    })

    it('should have Portal property', () => {
      expect(GlobalRoot.Portal).toBeDefined()
      expect(GlobalRoot.Portal).toBe(GlobalRootPortal)
    })
  })

  describe('GlobalRootPortal component', () => {
    it('should render children in Portal', () => {
      render(
        <GlobalRootPortal>
          <div>Portal content</div>
        </GlobalRootPortal>
      )

      const portal = screen.getByTestId('portal')

      expect(portal).toHaveTextContent('Portal content')
    })

    it('should pass query selector to Portal', () => {
      render(
        <GlobalRootPortal>
          <span>Test</span>
        </GlobalRootPortal>
      )

      expect(screen.getByTestId('portal')).toBeInTheDocument()
    })
  })

  describe('useGlobalRootDiv hook', () => {
    it('should call useDOMQuerySelector with correct parameters', () => {
      const mockElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([mockElement])

      renderHook(() => useGlobalRootDiv())

      expect(useDOMQuerySelector).toHaveBeenCalledWith('#global-root', {
        waitForElements: true,
      })
    })

    it('should return global root element', () => {
      const mockElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([mockElement])

      const { result } = renderHook(() => useGlobalRootDiv())

      expect(result.current).toBe(mockElement)
    })

    it('should return undefined when element not found', () => {
      useDOMQuerySelector.mockReturnValue([undefined])

      const { result } = renderHook(() => useGlobalRootDiv())

      expect(result.current).toBeUndefined()
    })
  })
})
