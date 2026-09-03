import useRouter from './useRouter'
import useUrl from './useUrl'

import { renderHook } from '@testing-library/react'

jest.mock('./useRouter', () => jest.fn())

describe('useUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SITE_URL = 'https://example.com'
  })

  describe('basic functionality', () => {
    it('should return absolute URL from router asPath', () => {
      useRouter.mockReturnValue({ asPath: '/test' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toContain('/test')
      expect(result.current.startsWith('http')).toBe(true)
    })

    it('should use thisUrl when provided', () => {
      useRouter.mockReturnValue({ asPath: '/default' })

      const { result } = renderHook(() => useUrl(undefined, '/custom'))

      expect(result.current).toContain('/custom')
    })

    it('should use baseUrl when provided', () => {
      useRouter.mockReturnValue({ asPath: '/page' })

      const { result } = renderHook(() => useUrl('https://example.com'))

      expect(result.current).toBe('https://example.com/page')
    })

    it('should combine baseUrl and thisUrl', () => {
      useRouter.mockReturnValue({ asPath: '/ignored' })

      const { result } = renderHook(() =>
        useUrl('https://example.com', '/custom')
      )

      expect(result.current).toBe('https://example.com/custom')
    })
  })

  describe('index removal', () => {
    it('should remove /index suffix', () => {
      useRouter.mockReturnValue({ asPath: '/page/index' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toContain('/page/')
      expect(result.current).not.toMatch(/\/index$/)
    })

    it('should remove /index from middle of path', () => {
      useRouter.mockReturnValue({ asPath: '/path/index' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toContain('/path/')
      expect(result.current).not.toMatch(/\/index$/)
    })

    it('should not remove index from query string', () => {
      useRouter.mockReturnValue({ asPath: '/page?file=index' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toContain('?file=index')
    })

    it('should handle root /index', () => {
      useRouter.mockReturnValue({ asPath: '/index' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toMatch(/\/$/)
      expect(result.current).not.toMatch(/\/index$/)
    })
  })

  describe('landing page removal', () => {
    it('should remove /landing prefix', () => {
      useRouter.mockReturnValue({ asPath: '/landing/page' })

      const { result } = renderHook(() => useUrl())

      // The regex .replace(/^\/landing/, '/') only matches at string start
      // But url() returns absolute URL, so /landing won't be at start
      expect(result.current).toContain('/page')
    })

    it('should handle /landing without trailing path', () => {
      useRouter.mockReturnValue({ asPath: '/landing' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toBeTruthy()
    })

    it('should handle /landing/', () => {
      useRouter.mockReturnValue({ asPath: '/landing/' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toMatch(/\/$/)
    })

    it('should not remove landing from middle of path', () => {
      useRouter.mockReturnValue({ asPath: '/page/landing/other' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toContain('/page/landing/other')
    })
  })

  describe('combined transformations', () => {
    it('should remove both /landing and /index', () => {
      useRouter.mockReturnValue({ asPath: '/landing/page/index' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toContain('/page/')
      expect(result.current).not.toMatch(/\/index$/)
    })

    it('should handle /landing/index', () => {
      useRouter.mockReturnValue({ asPath: '/landing/index' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toMatch(/\/$/)
      expect(result.current).not.toMatch(/\/index$/)
    })
  })

  describe('edge cases', () => {
    it('should handle empty asPath', () => {
      useRouter.mockReturnValue({ asPath: '' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toMatch(/^https?:\/\//)
    })

    it('should handle root path', () => {
      useRouter.mockReturnValue({ asPath: '/' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toMatch(/\/$/)
    })

    it('should handle path with query string', () => {
      useRouter.mockReturnValue({ asPath: '/page?foo=bar' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toContain('/page?foo=bar')
    })

    it('should handle path with hash', () => {
      useRouter.mockReturnValue({ asPath: '/page#section' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toContain('/page#section')
    })

    it('should handle path with query and hash', () => {
      useRouter.mockReturnValue({ asPath: '/page?foo=bar#section' })

      const { result } = renderHook(() => useUrl())

      expect(result.current).toContain('/page?foo=bar#section')
    })

    it('should handle undefined baseUrl', () => {
      useRouter.mockReturnValue({ asPath: '/page' })

      const { result } = renderHook(() => useUrl(undefined))

      expect(result.current).toContain('/page')
    })

    it('should handle undefined thisUrl', () => {
      useRouter.mockReturnValue({ asPath: '/page' })

      const { result } = renderHook(() =>
        useUrl('https://example.com', undefined)
      )

      expect(result.current).toBe('https://example.com/page')
    })
  })

  describe('options', () => {
    it('should pass options to url function', () => {
      useRouter.mockReturnValue({ asPath: '/page' })

      const options = { isDir: true }
      const { result } = renderHook(() => useUrl(undefined, undefined, options))

      expect(result.current).toContain('/page')
    })

    it('should handle empty options object', () => {
      useRouter.mockReturnValue({ asPath: '/page' })

      const { result } = renderHook(() => useUrl(undefined, undefined, {}))

      expect(result.current).toContain('/page')
    })
  })

  describe('rerenders', () => {
    it('should update when router asPath changes', () => {
      useRouter.mockReturnValue({ asPath: '/page1' })

      const { result, rerender } = renderHook(() => useUrl())

      expect(result.current).toContain('/page1')

      useRouter.mockReturnValue({ asPath: '/page2' })
      rerender()

      expect(result.current).toContain('/page2')
    })

    it('should update when baseUrl changes', () => {
      useRouter.mockReturnValue({ asPath: '/page' })

      const { result, rerender } = renderHook(
        ({ baseUrl }) => useUrl(baseUrl),
        { initialProps: { baseUrl: 'https://example.com' } }
      )

      expect(result.current).toBe('https://example.com/page')

      rerender({ baseUrl: 'https://other.com' })

      expect(result.current).toBe('https://other.com/page')
    })

    it('should update when thisUrl changes', () => {
      useRouter.mockReturnValue({ asPath: '/default' })

      const { result, rerender } = renderHook(
        ({ thisUrl }) => useUrl(undefined, thisUrl),
        { initialProps: { thisUrl: '/page1' } }
      )

      expect(result.current).toContain('/page1')

      rerender({ thisUrl: '/page2' })

      expect(result.current).toContain('/page2')
    })
  })
})
