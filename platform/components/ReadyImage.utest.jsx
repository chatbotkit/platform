import { act } from 'react'

import ReadyImage from '@/components/ReadyImage'

import '@testing-library/jest-dom'
import { render, waitFor } from '@testing-library/react'

describe('ReadyImage', () => {
  // @note clear any global cache state before each test

  beforeEach(() => {
    // @note access the cache through a re-import to clear it

    jest.resetModules()
  })

  describe('basic rendering', () => {
    it('should render an img element with correct attributes', () => {
      const { container } = render(
        <ReadyImage src="test.jpg" alt="Test image" />
      )

      const img = container.querySelector('img')

      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'test.jpg')
      expect(img).toHaveAttribute('alt', 'Test image')
    })

    it('should pass through additional props to img element', () => {
      const { container } = render(
        <ReadyImage
          src="test.jpg"
          alt="Test image"
          title="Test title"
          data-testid="test-img"
        />
      )

      const img = container.querySelector('img')

      expect(img).toHaveAttribute('title', 'Test title')
      expect(img).toHaveAttribute('data-testid', 'test-img')
    })
  })

  describe('className handling', () => {
    it('should apply base className', () => {
      const { container } = render(
        <ReadyImage src="test.jpg" alt="Test" className="base-class" />
      )

      const img = container.querySelector('img')

      expect(img).toHaveClass('base-class')
    })

    it('should apply notReadyClassName when image is not loaded', () => {
      const { container } = render(
        <ReadyImage
          src="test.jpg"
          alt="Test"
          className="base-class"
          notReadyClassName="not-ready"
        />
      )

      const img = container.querySelector('img')

      expect(img).toHaveClass('base-class')
      expect(img).toHaveClass('not-ready')
    })

    it('should apply readyClassName when image loads', async () => {
      const { container } = render(
        <ReadyImage
          src="test.jpg"
          alt="Test"
          className="base-class"
          readyClassName="ready"
          notReadyClassName="not-ready"
        />
      )

      const img = container.querySelector('img')

      // @note initially should have notReadyClassName

      expect(img).toHaveClass('not-ready')
      expect(img).not.toHaveClass('ready')

      // @note simulate image load

      act(() => {
        img.dispatchEvent(new Event('load', { bubbles: true }))
      })

      await waitFor(() => {
        expect(img).toHaveClass('ready')
        expect(img).not.toHaveClass('not-ready')
      })
    })
  })

  describe('onReady callback', () => {
    it('should call onReady when image loads', async () => {
      const onReady = jest.fn()

      const { container } = render(
        <ReadyImage src="test.jpg" alt="Test" onReady={onReady} />
      )

      const img = container.querySelector('img')

      // @note simulate image load

      act(() => {
        img.dispatchEvent(new Event('load', { bubbles: true }))
      })

      await waitFor(() => {
        expect(onReady).toHaveBeenCalledTimes(1)
      })
    })

    it('should not call onReady multiple times for same image', async () => {
      const onReady = jest.fn()

      const { container } = render(
        <ReadyImage src="test.jpg" alt="Test" onReady={onReady} />
      )

      const img = container.querySelector('img')

      // @note simulate multiple load events

      act(() => {
        img.dispatchEvent(new Event('load', { bubbles: true }))
        img.dispatchEvent(new Event('load', { bubbles: true }))
        img.dispatchEvent(new Event('load', { bubbles: true }))
      })

      await waitFor(() => {
        expect(onReady).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('onLoad callback', () => {
    it('should call onLoad when image loads', async () => {
      const onLoad = jest.fn()

      const { container } = render(
        <ReadyImage src="test.jpg" alt="Test" onLoad={onLoad} />
      )

      const img = container.querySelector('img')

      // @note simulate image load

      act(() => {
        img.dispatchEvent(new Event('load', { bubbles: true }))
      })

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalledTimes(1)
      })
    })

    it('should not call onLoad multiple times for same image', async () => {
      const onLoad = jest.fn()

      const { container } = render(
        <ReadyImage src="test.jpg" alt="Test" onLoad={onLoad} />
      )

      const img = container.querySelector('img')

      // @note simulate multiple load events

      act(() => {
        img.dispatchEvent(new Event('load', { bubbles: true }))
        img.dispatchEvent(new Event('load', { bubbles: true }))
      })

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('cache behavior', () => {
    it('should start as ready when image is in cache', async () => {
      // @note first render to populate cache

      const { container: container1, unmount } = render(
        <ReadyImage
          src="cached.jpg"
          alt="Test"
          readyClassName="ready"
          notReadyClassName="not-ready"
        />
      )

      const img1 = container1.querySelector('img')

      // @note simulate image load to add to cache

      act(() => {
        img1.dispatchEvent(new Event('load', { bubbles: true }))
      })

      await waitFor(() => {
        expect(img1).toHaveClass('ready')
      })

      unmount()

      // @note second render with same src should use cache

      const { container: container2 } = render(
        <ReadyImage
          src="cached.jpg"
          alt="Test"
          readyClassName="ready"
          notReadyClassName="not-ready"
        />
      )

      const img2 = container2.querySelector('img')

      // @note should have ready class immediately (or very quickly)
      // @note because it's in cache

      await waitFor(() => {
        expect(img2).toHaveClass('ready')
      })
    })
  })

  describe('src changes', () => {
    it('should reset ready state when src changes', async () => {
      const { container, rerender } = render(
        <ReadyImage
          src="image1.jpg"
          alt="Test"
          readyClassName="ready"
          notReadyClassName="not-ready"
        />
      )

      const img = container.querySelector('img')

      // @note load first image

      act(() => {
        img.dispatchEvent(new Event('load', { bubbles: true }))
      })

      await waitFor(() => {
        expect(img).toHaveClass('ready')
      })

      // @note change src

      rerender(
        <ReadyImage
          src="image2.jpg"
          alt="Test"
          readyClassName="ready"
          notReadyClassName="not-ready"
        />
      )

      // @note should reset to not ready

      await waitFor(() => {
        expect(img).toHaveClass('not-ready')
        expect(img).not.toHaveClass('ready')
      })
    })

    it('should call callbacks again when src changes', async () => {
      const onReady = jest.fn()

      const { container, rerender } = render(
        <ReadyImage src="image1.jpg" alt="Test" onReady={onReady} />
      )

      const img = container.querySelector('img')

      // @note load first image

      act(() => {
        img.dispatchEvent(new Event('load', { bubbles: true }))
      })

      await waitFor(() => {
        expect(onReady).toHaveBeenCalledTimes(1)
      })

      // @note change src

      rerender(<ReadyImage src="image2.jpg" alt="Test" onReady={onReady} />)

      // @note load second image

      act(() => {
        img.dispatchEvent(new Event('load', { bubbles: true }))
      })

      await waitFor(() => {
        expect(onReady).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('combined callbacks', () => {
    it('should call both onReady and onLoad when provided', async () => {
      const onReady = jest.fn()
      const onLoad = jest.fn()

      const { container } = render(
        <ReadyImage
          src="test.jpg"
          alt="Test"
          onReady={onReady}
          onLoad={onLoad}
        />
      )

      const img = container.querySelector('img')

      act(() => {
        img.dispatchEvent(new Event('load', { bubbles: true }))
      })

      await waitFor(() => {
        expect(onReady).toHaveBeenCalledTimes(1)
        expect(onLoad).toHaveBeenCalledTimes(1)
      })
    })
  })
})
