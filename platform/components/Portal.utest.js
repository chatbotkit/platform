/* eslint-disable @typescript-eslint/no-require-imports */
import { createPortal } from 'react-dom'

import Portal from './Portal'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: jest.fn((children) => children),
}))

jest.mock('@/hooks/useDOMQuerySelector', () => ({
  __esModule: true,
  default: jest.fn(() => [null]),
}))

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

describe('Portal', () => {
  const useDOMQuerySelector = require('@/hooks/useDOMQuerySelector').default

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render children to target element when found', () => {
      const targetElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([targetElement])

      render(
        <Portal portalKey="test-portal" query="#portal-target">
          <div>Portal content</div>
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(
        <div>Portal content</div>,
        targetElement,
        'test-portal'
      )
    })

    it('should not render when target is not found', () => {
      useDOMQuerySelector.mockReturnValue([null])

      const { container } = render(
        <Portal portalKey="test-portal" query="#portal-target">
          <div>Portal content</div>
        </Portal>
      )

      expect(createPortal).not.toHaveBeenCalled()
      expect(container.firstChild).toBeNull()
    })

    it('should pass correct query to useDOMQuerySelector', () => {
      render(
        <Portal portalKey="test-portal" query="#custom-target">
          <div>Content</div>
        </Portal>
      )

      expect(useDOMQuerySelector).toHaveBeenCalledWith(
        '#custom-target',
        { waitForElements: true },
        ['test-portal']
      )
    })

    it('should use portalKey as dependency', () => {
      render(
        <Portal portalKey="unique-key" query="#target">
          <div>Content</div>
        </Portal>
      )

      expect(useDOMQuerySelector).toHaveBeenCalledWith(
        '#target',
        { waitForElements: true },
        ['unique-key']
      )
    })
  })

  describe('portal key handling', () => {
    it('should pass portalKey to createPortal', () => {
      const targetElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([targetElement])

      render(
        <Portal portalKey="my-portal" query="#target">
          <div>Content</div>
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(
        expect.anything(),
        targetElement,
        'my-portal'
      )
    })

    it('should handle different portal keys', () => {
      const targetElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([targetElement])

      const { rerender } = render(
        <Portal portalKey="key1" query="#target">
          <div>Content</div>
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(
        expect.anything(),
        targetElement,
        'key1'
      )

      rerender(
        <Portal portalKey="key2" query="#target">
          <div>Content</div>
        </Portal>
      )

      expect(useDOMQuerySelector).toHaveBeenCalledWith(
        '#target',
        { waitForElements: true },
        ['key2']
      )
    })
  })

  describe('children rendering', () => {
    it('should render single child', () => {
      const targetElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([targetElement])

      render(
        <Portal portalKey="test" query="#target">
          <span>Single child</span>
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(
        <span>Single child</span>,
        targetElement,
        'test'
      )
    })

    it('should render multiple children', () => {
      const targetElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([targetElement])

      render(
        <Portal portalKey="test" query="#target">
          <div>First</div>
          <div>Second</div>
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(
        expect.anything(),
        targetElement,
        'test'
      )
    })

    it('should render string children', () => {
      const targetElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([targetElement])

      render(
        <Portal portalKey="test" query="#target">
          Plain text content
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(
        'Plain text content',
        targetElement,
        'test'
      )
    })

    it('should handle nested components', () => {
      const targetElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([targetElement])

      const NestedComponent = () => <span>Nested</span>

      render(
        <Portal portalKey="test" query="#target">
          <div>
            <NestedComponent />
          </div>
        </Portal>
      )

      expect(createPortal).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle null children', () => {
      const targetElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([targetElement])

      render(
        <Portal portalKey="test" query="#target">
          {null}
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(null, targetElement, 'test')
    })

    it('should handle undefined children', () => {
      const targetElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([targetElement])

      render(
        <Portal portalKey="test" query="#target">
          {undefined}
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(
        undefined,
        targetElement,
        'test'
      )
    })

    it('should handle empty query selector result', () => {
      useDOMQuerySelector.mockReturnValue([null])

      const { container } = render(
        <Portal portalKey="test" query="#nonexistent">
          <div>Content</div>
        </Portal>
      )

      expect(createPortal).not.toHaveBeenCalled()
      expect(container.firstChild).toBeNull()
    })

    it('should handle undefined target', () => {
      useDOMQuerySelector.mockReturnValue([undefined])

      render(
        <Portal portalKey="test" query="#target">
          <div>Content</div>
        </Portal>
      )

      expect(createPortal).not.toHaveBeenCalled()
    })
  })

  describe('query selector options', () => {
    it('should always wait for elements', () => {
      render(
        <Portal portalKey="test" query=".dynamic-element">
          <div>Content</div>
        </Portal>
      )

      expect(useDOMQuerySelector).toHaveBeenCalledWith(
        '.dynamic-element',
        { waitForElements: true },
        ['test']
      )
    })

    it('should handle complex queries', () => {
      render(
        <Portal portalKey="test" query="body > main > #container > .target">
          <div>Content</div>
        </Portal>
      )

      expect(useDOMQuerySelector).toHaveBeenCalledWith(
        'body > main > #container > .target',
        { waitForElements: true },
        ['test']
      )
    })
  })

  describe('updates and rerenders', () => {
    it('should update when target changes', () => {
      const target1 = document.createElement('div')
      const target2 = document.createElement('div')

      useDOMQuerySelector.mockReturnValueOnce([target1])

      const { rerender } = render(
        <Portal portalKey="test" query="#target">
          <div>Content</div>
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(
        expect.anything(),
        target1,
        'test'
      )

      useDOMQuerySelector.mockReturnValueOnce([target2])

      rerender(
        <Portal portalKey="test" query="#target">
          <div>Updated content</div>
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(
        <div>Updated content</div>,
        target2,
        'test'
      )
    })

    it('should update when children change', () => {
      const targetElement = document.createElement('div')

      useDOMQuerySelector.mockReturnValue([targetElement])

      const { rerender } = render(
        <Portal portalKey="test" query="#target">
          <div>Original</div>
        </Portal>
      )

      rerender(
        <Portal portalKey="test" query="#target">
          <div>Updated</div>
        </Portal>
      )

      expect(createPortal).toHaveBeenCalledWith(
        <div>Updated</div>,
        targetElement,
        'test'
      )
    })
  })
})
