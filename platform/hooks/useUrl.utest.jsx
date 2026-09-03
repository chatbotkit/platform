/* eslint-disable @typescript-eslint/no-require-imports */
import useUrl from './useUrl'

import { renderHook } from '@testing-library/react'

jest.mock('@/lib/url', () => ({
  url: jest.fn((thisUrl, baseUrl, options) => {
    if (baseUrl) {
      return `${baseUrl}${thisUrl}`
    }

    return thisUrl
  }),
}))

jest.mock('@/hooks/useRouter', () => {
  return jest.fn(() => ({
    asPath: '/test-path',
  }))
})

describe('useUrl', () => {
  const { url } = require('@/lib/url')
  const useRouter = require('@/hooks/useRouter')

  beforeEach(() => {
    jest.clearAllMocks()
    url.mockImplementation((thisUrl, baseUrl, options) => {
      if (baseUrl) {
        return `${baseUrl}${thisUrl}`
      }

      return thisUrl
    })
    useRouter.mockImplementation(() => ({
      asPath: '/test-path',
    }))
  })

  describe('basic functionality', () => {
    it('should use router.asPath when thisUrl is not provided', () => {
      const { result } = renderHook(() => useUrl())

      expect(url).toHaveBeenCalledWith('/test-path', undefined, {})
      expect(result.current).toBe('/test-path')
    })

    it('should use provided thisUrl when given', () => {
      const { result } = renderHook(() => useUrl(undefined, '/custom-path'))

      expect(url).toHaveBeenCalledWith('/custom-path', undefined, {})
      expect(result.current).toBe('/custom-path')
    })

    it('should use baseUrl when provided', () => {
      url.mockReturnValue('https://example.com/test-path')

      const { result } = renderHook(() =>
        useUrl('https://example.com', '/test-path')
      )

      expect(url).toHaveBeenCalledWith('/test-path', 'https://example.com', {})
      expect(result.current).toBe('https://example.com/test-path')
    })

    it('should pass options to url function', () => {
      const options = { absolute: true }

      renderHook(() => useUrl(undefined, '/test', options))

      expect(url).toHaveBeenCalledWith('/test', undefined, options)
    })
  })

  describe('index path handling', () => {
    it('should remove /index from end of path', () => {
      url.mockReturnValue('/path/index')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('/path/')
    })

    it('should not affect /index in middle of path', () => {
      url.mockReturnValue('/index/path')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('/index/path')
    })

    it('should handle multiple /index occurrences', () => {
      url.mockReturnValue('/path/index/index')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('/path/index/')
    })
  })

  describe('landing path handling', () => {
    it('should remove /landing from beginning of path', () => {
      url.mockReturnValue('/landing/page')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('//page')
    })

    it('should not affect /landing in middle of path', () => {
      url.mockReturnValue('/path/landing/page')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('/path/landing/page')
    })

    it('should handle /landing as root path', () => {
      url.mockReturnValue('/landing')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('/')
    })

    it('should handle /landing with trailing slash', () => {
      url.mockReturnValue('/landing/')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('//')
    })
  })

  describe('combined transformations', () => {
    it('should handle both /landing and /index removal', () => {
      url.mockReturnValue('/landing/path/index')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('//path/')
    })

    it('should handle /landing/index specifically', () => {
      url.mockReturnValue('/landing/index')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('//')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string thisUrl', () => {
      url.mockReturnValue('')

      const { result } = renderHook(() => useUrl(undefined, ''))

      expect(result.current).toBe('')
    })

    it('should handle root path', () => {
      url.mockReturnValue('/')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('/')
    })

    it('should handle path with query string', () => {
      url.mockReturnValue('/path?query=value')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('/path?query=value')
    })

    it('should handle path with hash', () => {
      url.mockReturnValue('/path#section')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('/path#section')
    })

    it('should handle absolute URLs', () => {
      url.mockReturnValue('https://example.com/path')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('https://example.com/path')
    })

    it('should handle undefined baseUrl', () => {
      const { result } = renderHook(() => useUrl(undefined, '/path'))

      expect(url).toHaveBeenCalledWith('/path', undefined, {})
      expect(result.current).toBe('/path')
    })

    it('should handle null baseUrl', () => {
      const { result } = renderHook(() => useUrl(null, '/path'))

      expect(url).toHaveBeenCalledWith('/path', null, {})
      expect(result.current).toBe('/path')
    })

    it('should handle empty options object', () => {
      const { result } = renderHook(() => useUrl(undefined, '/path', {}))

      expect(url).toHaveBeenCalledWith('/path', undefined, {})
      expect(result.current).toBe('/path')
    })
  })

  describe('router integration', () => {
    it('should use different asPath from router', () => {
      useRouter.mockReturnValue({
        asPath: '/different-path',
      })

      renderHook(() => useUrl())

      expect(url).toHaveBeenCalledWith('/different-path', undefined, {})
    })

    it('should handle router asPath with query params', () => {
      useRouter.mockReturnValue({
        asPath: '/path?param=value',
      })

      url.mockReturnValue('/path?param=value')

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBe('/path?param=value')
    })

    it('should prioritize thisUrl over router asPath', () => {
      useRouter.mockReturnValue({
        asPath: '/router-path',
      })

      renderHook(() => useUrl(undefined, '/custom-path'))

      expect(url).toHaveBeenCalledWith('/custom-path', undefined, {})
    })
  })

  describe('rerender behavior', () => {
    it('should update when router asPath changes', () => {
      const { rerender } = renderHook(() => useUrl())

      useRouter.mockReturnValue({
        asPath: '/new-path',
      })

      rerender()

      expect(url).toHaveBeenCalledWith('/new-path', undefined, {})
    })

    it('should update when thisUrl prop changes', () => {
      const { rerender } = renderHook(
        ({ thisUrl }) => useUrl(undefined, thisUrl),
        { initialProps: { thisUrl: '/path1' } }
      )

      rerender({ thisUrl: '/path2' })

      expect(url).toHaveBeenCalledWith('/path2', undefined, {})
    })
  })
})
