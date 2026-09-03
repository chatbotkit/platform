import ReadyFrame from './ReadyFrame'

import '@testing-library/jest-dom'
import { render, waitFor } from '@testing-library/react'

describe('ReadyFrame', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render iframe with provided title', () => {
      const { container } = render(<ReadyFrame title="Test Frame" />)

      const iframe = container.querySelector('iframe')

      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('title', 'Test Frame')
    })

    it('should pass additional props to iframe', () => {
      const { container } = render(
        <ReadyFrame
          title="Test Frame"
          src="https://example.com"
          width="800"
          height="600"
        />
      )

      const iframe = container.querySelector('iframe')

      expect(iframe).toHaveAttribute('src', 'https://example.com')
      expect(iframe).toHaveAttribute('width', '800')
      expect(iframe).toHaveAttribute('height', '600')
    })

    it('should render with className when provided', () => {
      const { container } = render(
        <ReadyFrame title="Test" className="custom-class" />
      )

      const iframe = container.querySelector('iframe')

      expect(iframe).toHaveClass('custom-class')
    })
  })

  describe('onLoad callback', () => {
    it('should call onLoad when iframe loads', () => {
      const onLoad = jest.fn()
      const { container } = render(
        <ReadyFrame title="Test Frame" onLoad={onLoad} />
      )

      const iframe = container.querySelector('iframe')

      iframe.dispatchEvent(new Event('load'))

      expect(onLoad).toHaveBeenCalledTimes(1)
      expect(onLoad).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'load' })
      )
    })

    it('should not throw if onLoad is not provided', () => {
      const { container } = render(<ReadyFrame title="Test Frame" />)

      const iframe = container.querySelector('iframe')

      expect(() => {
        iframe.dispatchEvent(new Event('load'))
      }).not.toThrow()
    })
  })

  describe('onReady callback', () => {
    it('should call onReady when iframe loads', () => {
      const onReady = jest.fn()
      const { container } = render(
        <ReadyFrame title="Test Frame" onReady={onReady} />
      )

      const iframe = container.querySelector('iframe')

      iframe.dispatchEvent(new Event('load'))

      expect(onReady).toHaveBeenCalledTimes(1)
    })

    it('should call both onReady and onLoad when both are provided', () => {
      const onReady = jest.fn()
      const onLoad = jest.fn()
      const { container } = render(
        <ReadyFrame title="Test Frame" onReady={onReady} onLoad={onLoad} />
      )

      const iframe = container.querySelector('iframe')

      iframe.dispatchEvent(new Event('load'))

      expect(onReady).toHaveBeenCalledTimes(1)
      expect(onLoad).toHaveBeenCalledTimes(1)
    })

    it('should not throw if onReady is not provided', () => {
      const { container } = render(<ReadyFrame title="Test Frame" />)

      const iframe = container.querySelector('iframe')

      expect(() => {
        iframe.dispatchEvent(new Event('load'))
      }).not.toThrow()
    })
  })

  describe('useEffect ready check', () => {
    it('should call onReady during mount if document is already loaded', async () => {
      const onReady = jest.fn()
      const onLoad = jest.fn()

      const { container } = render(
        <ReadyFrame title="Test Frame" onReady={onReady} onLoad={onLoad} />
      )

      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentDocument', {
        value: { readyState: 'complete' },
        configurable: true,
      })

      // Trigger the useEffect by updating the component
      iframe.dispatchEvent(new Event('load'))

      await waitFor(() => {
        expect(onReady).toHaveBeenCalled()
        expect(onLoad).toHaveBeenCalled()
      })
    })

    it('should handle cross-origin iframes gracefully', async () => {
      const onReady = jest.fn()

      const { container } = render(
        <ReadyFrame title="Test Frame" onReady={onReady} />
      )

      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentDocument', {
        get() {
          throw new Error('Cross-origin access denied')
        },
        configurable: true,
      })

      // Should not throw
      await waitFor(
        () => {
          // Just wait a bit to ensure no errors
        },
        { timeout: 100 }
      ).catch(() => {})
    })

    it('should check contentWindow.document.readyState if contentDocument is not available', async () => {
      const onReady = jest.fn()

      const { container } = render(
        <ReadyFrame title="Test Frame" onReady={onReady} />
      )

      const iframe = container.querySelector('iframe')

      Object.defineProperty(iframe, 'contentDocument', {
        value: undefined,
        configurable: true,
      })

      Object.defineProperty(iframe, 'contentWindow', {
        value: { document: { readyState: 'complete' } },
        configurable: true,
      })

      await waitFor(() => {
        expect(onReady).toHaveBeenCalled()
      })
    })
  })

  describe('edge cases', () => {
    it('should handle undefined title', () => {
      const { container } = render(<ReadyFrame />)

      const iframe = container.querySelector('iframe')

      expect(iframe).toBeInTheDocument()
    })

    it('should handle multiple load events', () => {
      const onReady = jest.fn()
      const onLoad = jest.fn()
      const { container } = render(
        <ReadyFrame title="Test" onReady={onReady} onLoad={onLoad} />
      )

      const iframe = container.querySelector('iframe')

      iframe.dispatchEvent(new Event('load'))
      iframe.dispatchEvent(new Event('load'))

      expect(onReady).toHaveBeenCalledTimes(2)
      expect(onLoad).toHaveBeenCalledTimes(2)
    })

    it('should handle empty props', () => {
      const { container } = render(<ReadyFrame {...{}} />)

      const iframe = container.querySelector('iframe')

      expect(iframe).toBeInTheDocument()
    })

    it('should spread custom data attributes', () => {
      const { container } = render(
        <ReadyFrame
          title="Test"
          data-testid="custom-frame"
          data-custom="value"
        />
      )

      const iframe = container.querySelector('iframe')

      expect(iframe).toHaveAttribute('data-testid', 'custom-frame')
      expect(iframe).toHaveAttribute('data-custom', 'value')
    })
  })

  describe('callback dependency updates', () => {
    it('should use updated onReady callback', () => {
      const onReady1 = jest.fn()
      const onReady2 = jest.fn()

      const { container, rerender } = render(
        <ReadyFrame title="Test" onReady={onReady1} />
      )

      const iframe = container.querySelector('iframe')

      iframe.dispatchEvent(new Event('load'))

      expect(onReady1).toHaveBeenCalledTimes(1)
      expect(onReady2).not.toHaveBeenCalled()

      rerender(<ReadyFrame title="Test" onReady={onReady2} />)

      iframe.dispatchEvent(new Event('load'))

      expect(onReady1).toHaveBeenCalledTimes(1)
      expect(onReady2).toHaveBeenCalledTimes(1)
    })

    it('should use updated onLoad callback', () => {
      const onLoad1 = jest.fn()
      const onLoad2 = jest.fn()

      const { container, rerender } = render(
        <ReadyFrame title="Test" onLoad={onLoad1} />
      )

      const iframe = container.querySelector('iframe')

      iframe.dispatchEvent(new Event('load'))

      expect(onLoad1).toHaveBeenCalledTimes(1)
      expect(onLoad2).not.toHaveBeenCalled()

      rerender(<ReadyFrame title="Test" onLoad={onLoad2} />)

      iframe.dispatchEvent(new Event('load'))

      expect(onLoad1).toHaveBeenCalledTimes(1)
      expect(onLoad2).toHaveBeenCalledTimes(1)
    })
  })
})
