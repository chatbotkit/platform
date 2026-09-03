import ResponsiveIframe from './ResponsiveIframe'

import '@testing-library/jest-dom'
import { fireEvent, render, waitFor } from '@testing-library/react'

describe('ResponsiveIframe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render iframe element', () => {
      const { container } = render(<ResponsiveIframe srcDoc="<p>Test</p>" />)

      expect(container.querySelector('iframe')).toBeInTheDocument()
    })

    it('should set srcDoc attribute', () => {
      const srcDoc = '<html><body><p>Test Content</p></body></html>'
      const { container } = render(<ResponsiveIframe srcDoc={srcDoc} />)
      const iframe = container.querySelector('iframe')

      expect(iframe).toHaveAttribute('srcDoc', srcDoc)
    })

    it('should forward additional props to iframe', () => {
      const { container } = render(
        <ResponsiveIframe
          srcDoc="<p>Test</p>"
          title="Test iframe"
          className="custom-class"
        />
      )
      const iframe = container.querySelector('iframe')

      expect(iframe).toHaveAttribute('title', 'Test iframe')
      expect(iframe).toHaveClass('custom-class')
    })
  })

  describe('resize functionality', () => {
    it('should adjust iframe height based on content', async () => {
      const { container } = render(<ResponsiveIframe srcDoc="<p>Test</p>" />)
      const iframe = container.querySelector('iframe')

      // Mock contentWindow with scrollHeight
      Object.defineProperty(iframe, 'contentWindow', {
        writable: true,
        value: {
          document: {
            documentElement: {
              scrollHeight: 500,
            },
          },
        },
      })

      // Trigger load event
      fireEvent.load(iframe)

      await waitFor(() => {
        expect(iframe.style.height).toBe('500px')
      })
    })

    it('should handle resize when srcDoc changes', async () => {
      const { container, rerender } = render(
        <ResponsiveIframe srcDoc="<p>Short</p>" />
      )
      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentWindow', {
        writable: true,
        value: {
          document: {
            documentElement: {
              scrollHeight: 200,
            },
          },
        },
      })

      fireEvent.load(iframe)

      await waitFor(() => {
        expect(iframe.style.height).toBe('200px')
      })

      // Change srcDoc
      Object.defineProperty(iframe, 'contentWindow', {
        writable: true,
        value: {
          document: {
            documentElement: {
              scrollHeight: 600,
            },
          },
        },
      })

      rerender(<ResponsiveIframe srcDoc="<p>Much longer content</p>" />)

      await waitFor(() => {
        expect(iframe.style.height).toBe('600px')
      })
    })

    it('should handle window resize events', async () => {
      const { container } = render(<ResponsiveIframe srcDoc="<p>Test</p>" />)
      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentWindow', {
        writable: true,
        value: {
          document: {
            documentElement: {
              scrollHeight: 400,
            },
          },
        },
      })

      // Trigger window resize
      fireEvent.resize(window)

      await waitFor(() => {
        expect(iframe.style.height).toBe('400px')
      })
    })
  })

  describe('error handling', () => {
    it('should not throw when contentWindow is null', () => {
      const { container } = render(<ResponsiveIframe srcDoc="<p>Test</p>" />)
      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentWindow', {
        writable: true,
        value: null,
      })

      expect(() => {
        fireEvent.load(iframe)
      }).not.toThrow()
    })

    it('should not throw when document is undefined', () => {
      const { container } = render(<ResponsiveIframe srcDoc="<p>Test</p>" />)
      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentWindow', {
        writable: true,
        value: {},
      })

      expect(() => {
        fireEvent.load(iframe)
      }).not.toThrow()
    })

    it('should not throw when documentElement is undefined', () => {
      const { container } = render(<ResponsiveIframe srcDoc="<p>Test</p>" />)
      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentWindow', {
        writable: true,
        value: {
          document: {},
        },
      })

      expect(() => {
        fireEvent.load(iframe)
      }).not.toThrow()
    })

    it('should not throw when scrollHeight is undefined', () => {
      const { container } = render(<ResponsiveIframe srcDoc="<p>Test</p>" />)
      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentWindow', {
        writable: true,
        value: {
          document: {
            documentElement: {},
          },
        },
      })

      expect(() => {
        fireEvent.load(iframe)
      }).not.toThrow()
    })

    it('should not set height when scrollHeight is falsy', () => {
      const { container } = render(<ResponsiveIframe srcDoc="<p>Test</p>" />)
      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentWindow', {
        writable: true,
        value: {
          document: {
            documentElement: {
              scrollHeight: 0,
            },
          },
        },
      })

      const initialHeight = iframe.style.height

      fireEvent.load(iframe)

      expect(iframe.style.height).toBe(initialHeight)
    })
  })

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { container, unmount } = render(
        <ResponsiveIframe srcDoc="<p>Test</p>" />
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

    it('should remove event listeners when srcDoc changes', () => {
      const { container, rerender } = render(
        <ResponsiveIframe srcDoc="<p>First</p>" />
      )
      const iframe = container.querySelector('iframe')

      const removeEventListenerSpy = jest.spyOn(iframe, 'removeEventListener')
      const windowRemoveEventListenerSpy = jest.spyOn(
        window,
        'removeEventListener'
      )

      rerender(<ResponsiveIframe srcDoc="<p>Second</p>" />)

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'load',
        expect.any(Function)
      )
      expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty srcDoc', () => {
      const { container } = render(<ResponsiveIframe srcDoc="" />)

      expect(container.querySelector('iframe')).toBeInTheDocument()
    })

    it('should handle complex HTML in srcDoc', () => {
      const complexHtml = `
        <html>
          <head><style>body { margin: 0; }</style></head>
          <body>
            <div>
              <h1>Title</h1>
              <p>Paragraph</p>
            </div>
          </body>
        </html>
      `
      const { container } = render(<ResponsiveIframe srcDoc={complexHtml} />)
      const iframe = container.querySelector('iframe')

      expect(iframe).toHaveAttribute('srcDoc', complexHtml)
    })

    it('should handle multiple rapid resize events', async () => {
      const { container } = render(<ResponsiveIframe srcDoc="<p>Test</p>" />)
      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentWindow', {
        writable: true,
        value: {
          document: {
            documentElement: {
              scrollHeight: 300,
            },
          },
        },
      })

      // Trigger multiple resize events rapidly
      fireEvent.resize(window)
      fireEvent.resize(window)
      fireEvent.resize(window)

      await waitFor(() => {
        expect(iframe.style.height).toBe('300px')
      })
    })
  })
})
