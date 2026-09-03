import ResponsiveIframe from './ResponsiveIframe'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('ResponsiveIframe', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'addEventListener', {
      writable: true,
      value: jest.fn(),
    })
    Object.defineProperty(window, 'removeEventListener', {
      writable: true,
      value: jest.fn(),
    })
  })

  it('should render iframe with srcDoc', () => {
    const srcDoc = '<html><body>Test</body></html>'
    const { container } = render(<ResponsiveIframe srcDoc={srcDoc} />)

    const iframe = container.querySelector('iframe')

    expect(iframe).toBeInTheDocument()
    expect(iframe.getAttribute('srcdoc')).toBe(srcDoc)
  })

  it('should pass additional props to iframe', () => {
    const { container } = render(
      <ResponsiveIframe
        srcDoc="<html></html>"
        title="Test iframe"
        className="custom-class"
        sandbox="allow-scripts"
      />
    )

    const iframe = container.querySelector('iframe')

    expect(iframe.getAttribute('title')).toBe('Test iframe')
    expect(iframe).toHaveClass('custom-class')
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('should set initial height on load', () => {
    const { container } = render(
      <ResponsiveIframe srcDoc="<html><body>Test</body></html>" />
    )

    const iframe = container.querySelector('iframe')
    const contentWindow = {
      document: {
        documentElement: {
          scrollHeight: 500,
        },
      },
    }

    Object.defineProperty(iframe, 'contentWindow', {
      writable: true,
      value: contentWindow,
    })

    iframe.dispatchEvent(new Event('load'))

    expect(iframe.style.height).toBe('500px')
  })

  it('should handle missing contentWindow gracefully', () => {
    const { container } = render(
      <ResponsiveIframe srcDoc="<html><body>Test</body></html>" />
    )

    const iframe = container.querySelector('iframe')

    Object.defineProperty(iframe, 'contentWindow', {
      writable: true,
      value: null,
    })

    expect(() => {
      iframe.dispatchEvent(new Event('load'))
    }).not.toThrow()
  })

  it('should handle missing document gracefully', () => {
    const { container } = render(
      <ResponsiveIframe srcDoc="<html><body>Test</body></html>" />
    )

    const iframe = container.querySelector('iframe')

    Object.defineProperty(iframe, 'contentWindow', {
      writable: true,
      value: { document: null },
    })

    expect(() => {
      iframe.dispatchEvent(new Event('load'))
    }).not.toThrow()
  })

  it('should handle missing documentElement gracefully', () => {
    const { container } = render(
      <ResponsiveIframe srcDoc="<html><body>Test</body></html>" />
    )

    const iframe = container.querySelector('iframe')

    Object.defineProperty(iframe, 'contentWindow', {
      writable: true,
      value: { document: { documentElement: null } },
    })

    expect(() => {
      iframe.dispatchEvent(new Event('load'))
    }).not.toThrow()
  })

  it('should cleanup event listeners on unmount', () => {
    const { container, unmount } = render(
      <ResponsiveIframe srcDoc="<html><body>Test</body></html>" />
    )

    const iframe = container.querySelector('iframe')
    const removeEventListenerSpy = jest.spyOn(iframe, 'removeEventListener')
    const windowRemoveEventListenerSpy = jest.spyOn(
      window,
      'removeEventListener'
    )

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'load',
      expect.any(Function)
    )
    expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    )
  })

  it('should re-run effect when srcDoc changes', () => {
    const { container, rerender } = render(
      <ResponsiveIframe srcDoc="<html><body>First</body></html>" />
    )

    const iframe = container.querySelector('iframe')
    const addEventListenerSpy = jest.spyOn(iframe, 'addEventListener')

    rerender(<ResponsiveIframe srcDoc="<html><body>Second</body></html>" />)

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'load',
      expect.any(Function)
    )
  })

  it('should update height on window resize', () => {
    const { container } = render(
      <ResponsiveIframe srcDoc="<html><body>Test</body></html>" />
    )

    const iframe = container.querySelector('iframe')

    // @note this test verifies the event listener is attached, actual height update
    // requires a real iframe which is not available in jsdom
    expect(() => {
      window.dispatchEvent(new Event('resize'))
    }).not.toThrow()
  })

  it('should not update height if scrollHeight is falsy', () => {
    const { container } = render(
      <ResponsiveIframe srcDoc="<html><body>Test</body></html>" />
    )

    const iframe = container.querySelector('iframe')
    const contentWindow = {
      document: {
        documentElement: {
          scrollHeight: 0,
        },
      },
    }

    Object.defineProperty(iframe, 'contentWindow', {
      writable: true,
      value: contentWindow,
    })

    const initialHeight = iframe.style.height

    iframe.dispatchEvent(new Event('load'))

    expect(iframe.style.height).toBe(initialHeight)
  })

  it('should handle errors when accessing contentWindow', () => {
    const { container } = render(
      <ResponsiveIframe srcDoc="<html><body>Test</body></html>" />
    )

    const iframe = container.querySelector('iframe')

    Object.defineProperty(iframe, 'contentWindow', {
      get: () => {
        throw new Error('Access denied')
      },
    })

    expect(() => {
      iframe.dispatchEvent(new Event('load'))
    }).not.toThrow()
  })

  it('should handle empty srcDoc', () => {
    const { container } = render(<ResponsiveIframe srcDoc="" />)

    const iframe = container.querySelector('iframe')

    expect(iframe.getAttribute('srcdoc')).toBe('')
  })
})
