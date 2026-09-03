import useImageColorPalette from './useImageColorPalette'

import { act, renderHook } from '@testing-library/react'

import { getColor, getPalette } from 'colorthief'

jest.mock('colorthief', () => ({
  getColor: jest.fn(),
  getPalette: jest.fn(),
}))

// @note the hook only reads `.hex()` off the colors the library returns
const color = (r, g, b) => ({
  hex: () =>
    `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`,
})

describe('useImageColorPalette', () => {
  let mockImage
  let mockColorThief
  let originalImage

  beforeEach(() => {
    // Save original Image
    originalImage = global.Image

    // Mock Image constructor
    mockImage = {
      src: '',
      crossOrigin: '',
      onload: null,
      onerror: null,
    }

    global.Image = jest.fn(() => mockImage)

    mockColorThief = { getColor, getPalette }

    jest.clearAllMocks()
  })

  afterEach(() => {
    global.Image = originalImage
  })

  describe('basic functionality', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() =>
        useImageColorPalette('https://example.com/image.jpg')
      )

      expect(result.current.error).toBeNull()
      expect(result.current.color).toBeNull()
      expect(result.current.palette).toBeNull()
      expect(result.current.colorPalette).toBeNull()
    })

    it('should set crossOrigin attribute', () => {
      renderHook(() => useImageColorPalette('https://example.com/image.jpg'))

      expect(mockImage.crossOrigin).toBe('Anonymous')
    })

    it('should set image src', () => {
      renderHook(() => useImageColorPalette('https://example.com/image.jpg'))

      expect(mockImage.src).toBe('https://example.com/image.jpg')
    })

    it('should setup onload and onerror handlers', () => {
      renderHook(() => useImageColorPalette('https://example.com/image.jpg'))

      expect(mockImage.onload).toBeDefined()
      expect(mockImage.onerror).toBeDefined()
    })
  })

  describe('url changes', () => {
    it('should reload when url changes', async () => {
      mockColorThief.getColor.mockReturnValue(color(255, 0, 0))
      mockColorThief.getPalette.mockReturnValue([])

      const { rerender } = renderHook(({ url }) => useImageColorPalette(url), {
        initialProps: { url: 'https://example.com/image1.jpg' },
      })

      expect(mockImage.src).toBe('https://example.com/image1.jpg')

      // Change URL
      rerender({ url: 'https://example.com/image2.jpg' })

      expect(mockImage.src).toBe('https://example.com/image2.jpg')
    })

    it('should handle rapid url changes', () => {
      const { rerender } = renderHook(({ url }) => useImageColorPalette(url), {
        initialProps: { url: 'https://example.com/image1.jpg' },
      })

      rerender({ url: 'https://example.com/image2.jpg' })
      rerender({ url: 'https://example.com/image3.jpg' })

      expect(mockImage.src).toBe('https://example.com/image3.jpg')
    })
  })

  describe('cleanup', () => {
    it('should cleanup onload handler on unmount', () => {
      const { unmount } = renderHook(() =>
        useImageColorPalette('https://example.com/image.jpg')
      )

      expect(mockImage.onload).toBeTruthy()

      unmount()

      expect(mockImage.onload).toBeNull()
    })

    it('should not throw when unmounted before image loads', async () => {
      mockColorThief.getColor.mockReturnValue(color(255, 0, 0))
      mockColorThief.getPalette.mockReturnValue([])

      const { unmount } = renderHook(() =>
        useImageColorPalette('https://example.com/image.jpg')
      )

      const onload = mockImage.onload

      unmount()

      // Should not throw
      await act(async () => {
        if (onload) {
          onload()
        }

        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty url', () => {
      const { result } = renderHook(() => useImageColorPalette(''))

      expect(mockImage.src).toBe('')
      expect(result.current.error).toBeNull()
    })

    it('should handle undefined url', () => {
      const { result } = renderHook(() => useImageColorPalette(undefined))

      expect(result.current.error).toBeNull()
    })

    it('should handle null url', () => {
      const { result } = renderHook(() => useImageColorPalette(null))

      expect(result.current.error).toBeNull()
    })

    it('should handle data URLs', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA'

      renderHook(() => useImageColorPalette(dataUrl))

      expect(mockImage.src).toBe(dataUrl)
    })
  })

  describe('return value structure', () => {
    it('should return all required properties', () => {
      const { result } = renderHook(() =>
        useImageColorPalette('https://example.com/image.jpg')
      )

      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('color')
      expect(result.current).toHaveProperty('palette')
      expect(result.current).toHaveProperty('colorPalette')
    })
  })
})
