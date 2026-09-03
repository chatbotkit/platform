import { withCache, withGeneration, withRevalidation } from './static'

jest.mock('@/lib/env', () => ({
  isProduction: true,
}))

describe('static.js utilities', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('withRevalidation', () => {
    it('should add revalidation to result with props in production', async () => {
      const mockFn = jest.fn().mockResolvedValue({
        props: { data: 'test' },
      })

      const wrapped = withRevalidation(mockFn)
      const context = { query: {} }
      const result = await wrapped(context)

      expect(result).toEqual({
        props: { data: 'test' },
        revalidate: 3600, // ONE_HOUR_IN_SECONDS
      })
      expect(mockFn).toHaveBeenCalledWith(context)
    })

    it('should not add revalidation when preview query is true', async () => {
      const mockFn = jest.fn().mockResolvedValue({
        props: { data: 'test' },
      })

      const wrapped = withRevalidation(mockFn)
      const context = { query: { preview: 'true' } }
      const result = await wrapped(context)

      expect(result).toEqual({
        props: { data: 'test' },
        revalidate: false,
      })
    })

    it('should not add revalidation when SKIP_STATIC_REVALIDATION is set', async () => {
      process.env.SKIP_STATIC_REVALIDATION = 'true'

      const mockFn = jest.fn().mockResolvedValue({
        props: { data: 'test' },
      })

      const wrapped = withRevalidation(mockFn)
      const context = { query: {} }
      const result = await wrapped(context)

      expect(result).toEqual({
        props: { data: 'test' },
        revalidate: false,
      })
    })

    it('should return result as-is when no props in result', async () => {
      const mockFn = jest.fn().mockResolvedValue({
        notFound: true,
      })

      const wrapped = withRevalidation(mockFn)
      const context = { query: {} }
      const result = await wrapped(context)

      expect(result).toEqual({
        notFound: true,
      })
    })

    it('should return result as-is when result is null', async () => {
      const mockFn = jest.fn().mockResolvedValue(null)

      const wrapped = withRevalidation(mockFn)
      const context = { query: {} }
      const result = await wrapped(context)

      expect(result).toBeNull()
    })

    it('should handle redirect results', async () => {
      const mockFn = jest.fn().mockResolvedValue({
        redirect: {
          destination: '/other',
          permanent: false,
        },
      })

      const wrapped = withRevalidation(mockFn)
      const context = { query: {} }
      const result = await wrapped(context)

      expect(result).toEqual({
        redirect: {
          destination: '/other',
          permanent: false,
        },
      })
    })
  })

  describe('withGeneration', () => {
    it('should return empty paths with blocking fallback when SKIP_STATIC_GENERATION is set', async () => {
      process.env.SKIP_STATIC_GENERATION = 'true'

      const mockFn = jest.fn().mockResolvedValue({
        paths: [{ params: { id: '1' } }],
      })

      const wrapped = withGeneration(mockFn)
      const result = await wrapped()

      expect(result).toEqual({
        paths: [],
        fallback: 'blocking',
      })
      expect(mockFn).not.toHaveBeenCalled()
    })

    it('should call function and add blocking fallback when generation is not skipped', async () => {
      delete process.env.SKIP_STATIC_GENERATION

      const mockFn = jest.fn().mockResolvedValue({
        paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
      })

      const wrapped = withGeneration(mockFn)
      const result = await wrapped()

      expect(result).toEqual({
        paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
        fallback: 'blocking',
      })
      expect(mockFn).toHaveBeenCalled()
    })

    it('should override existing fallback value', async () => {
      delete process.env.SKIP_STATIC_GENERATION

      const mockFn = jest.fn().mockResolvedValue({
        paths: [{ params: { id: '1' } }],
        fallback: true,
      })

      const wrapped = withGeneration(mockFn)
      const result = await wrapped()

      expect(result.fallback).toBe('blocking')
    })

    it('should handle empty paths array', async () => {
      delete process.env.SKIP_STATIC_GENERATION

      const mockFn = jest.fn().mockResolvedValue({
        paths: [],
      })

      const wrapped = withGeneration(mockFn)
      const result = await wrapped()

      expect(result).toEqual({
        paths: [],
        fallback: 'blocking',
      })
    })
  })

  describe('withCache', () => {
    it('should set cache headers in production when result has props', async () => {
      const mockContext = {
        res: {
          getHeader: jest.fn(),
          setHeader: jest.fn(),
        },
      }

      const mockFn = jest.fn().mockResolvedValue({
        props: { data: 'test' },
      })

      const wrapped = withCache(mockFn)
      const result = await wrapped(mockContext)

      expect(result).toEqual({ props: { data: 'test' } })
      expect(mockContext.res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=10'
      )
      expect(mockContext.res.setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        'public, max-age=60'
      )
      expect(mockContext.res.setHeader).not.toHaveBeenCalledWith(
        'Vercel-CDN-Cache-Control',
        expect.anything()
      )
      expect(mockContext.res.setHeader).toHaveBeenCalledWith('Vary', 'host')
    })

    it('should use custom timing options', async () => {
      const mockContext = {
        res: {
          getHeader: jest.fn(),
          setHeader: jest.fn(),
        },
      }

      const mockFn = jest.fn().mockResolvedValue({
        props: { data: 'test' },
      })

      const wrapped = withCache(mockFn, {
        timing: [30, 120, 7200],
      })
      const result = await wrapped(mockContext)

      expect(result).toEqual({ props: { data: 'test' } })
      expect(mockContext.res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=30'
      )
      expect(mockContext.res.setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        'public, max-age=120'
      )
      expect(mockContext.res.setHeader).not.toHaveBeenCalledWith(
        'Vercel-CDN-Cache-Control',
        expect.anything()
      )
    })

    it('should append host-aware vary values to existing Vary header', async () => {
      const mockContext = {
        res: {
          getHeader: jest.fn().mockReturnValue('Accept'),
          setHeader: jest.fn(),
        },
      }

      const mockFn = jest.fn().mockResolvedValue({
        props: { data: 'test' },
      })

      const wrapped = withCache(mockFn)

      await wrapped(mockContext)

      expect(mockContext.res.setHeader).toHaveBeenCalledWith(
        'Vary',
        'Accept, host'
      )
    })

    it('should not set cache headers when result has no props', async () => {
      const mockContext = {
        res: {
          getHeader: jest.fn(),
          setHeader: jest.fn(),
        },
      }

      const mockFn = jest.fn().mockResolvedValue({
        notFound: true,
      })

      const wrapped = withCache(mockFn)

      await wrapped(mockContext)

      expect(mockContext.res.setHeader).not.toHaveBeenCalled()
    })

    it('should not set cache headers when result is null', async () => {
      const mockContext = {
        res: {
          getHeader: jest.fn(),
          setHeader: jest.fn(),
        },
      }

      const mockFn = jest.fn().mockResolvedValue(null)

      const wrapped = withCache(mockFn)

      await wrapped(mockContext)

      expect(mockContext.res.setHeader).not.toHaveBeenCalled()
    })

    it('should pass through additional arguments to wrapped function', async () => {
      const mockContext = {
        res: {
          getHeader: jest.fn(),
          setHeader: jest.fn(),
        },
      }

      const mockFn = jest.fn().mockResolvedValue({
        props: { data: 'test' },
      })

      const wrapped = withCache(mockFn)

      await wrapped(mockContext, 'arg1', 'arg2')

      expect(mockFn).toHaveBeenCalledWith(mockContext, 'arg1', 'arg2')
    })

    it('should handle partial timing options', async () => {
      const mockContext = {
        res: {
          getHeader: jest.fn(),
          setHeader: jest.fn(),
        },
      }

      const mockFn = jest.fn().mockResolvedValue({
        props: { data: 'test' },
      })

      const wrapped = withCache(mockFn, {
        timing: [20],
      })
      const result = await wrapped(mockContext)

      expect(result).toEqual({ props: { data: 'test' } })
      expect(mockContext.res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=20'
      )
      expect(mockContext.res.setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        'public, max-age=20'
      )
    })

    it('should handle empty options object', async () => {
      const mockContext = {
        res: {
          getHeader: jest.fn(),
          setHeader: jest.fn(),
        },
      }

      const mockFn = jest.fn().mockResolvedValue({
        props: { data: 'test' },
      })

      const wrapped = withCache(mockFn, {})
      const result = await wrapped(mockContext)

      expect(result).toEqual({ props: { data: 'test' } })
      // Should use default timing values
      expect(mockContext.res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=10'
      )
    })
  })
})
