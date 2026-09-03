import {
  CACHE_PRESETS,
  applyCacheHeaders,
  getCacheHeaders,
  getNoCacheHeaders,
} from './cdn'

describe('CACHE_PRESETS', () => {
  it('should have HUB_PAGE preset with correct values', () => {
    expect(CACHE_PRESETS.HUB_PAGE).toEqual({
      maxAge: 10,
      cdnMaxAge: 60,
      vercelMaxAge: 3600,
    })
  })

  it('should have RSS preset with correct values', () => {
    expect(CACHE_PRESETS.RSS).toEqual({
      maxAge: 10,
      cdnMaxAge: 60,
      vercelMaxAge: 3600,
    })
  })

  it('should have URL preset with correct values', () => {
    expect(CACHE_PRESETS.URL).toEqual({
      maxAge: 10,
      cdnMaxAge: 60,
      vercelMaxAge: 600,
    })
  })

  it('should have STATIC preset with correct values', () => {
    expect(CACHE_PRESETS.STATIC).toEqual({
      maxAge: 86400,
      cdnMaxAge: 86400,
      vercelMaxAge: 86400,
    })
  })

  it('should have WIDGET_FRAME preset with short freshness and generous SWR', () => {
    expect(CACHE_PRESETS.WIDGET_FRAME).toEqual({
      maxAge: 30,
      swr: 300,
      cdnMaxAge: 60,
      cdnSwr: 3600,
      vercelMaxAge: 60,
      vercelSwr: 86400,
    })
  })
})

describe('getCacheHeaders', () => {
  it('should omit Vercel cache headers outside Vercel', () => {
    expect(getCacheHeaders()).not.toHaveProperty('Vercel-CDN-Cache-Control')
  })

  it('should return default cache headers with 24 hour max-age', () => {
    const headers = getCacheHeaders()

    expect(headers).toEqual({
      'Cache-Control': 'public, max-age=86400',
      'CDN-Cache-Control': 'public, max-age=86400',
    })
  })

  it('should use custom maxAge for all caches', () => {
    const headers = getCacheHeaders({ maxAge: 3600 })

    expect(headers).toEqual({
      'Cache-Control': 'public, max-age=3600',
      'CDN-Cache-Control': 'public, max-age=3600',
    })
  })

  it('should allow different maxAge for browser vs CDN', () => {
    const headers = getCacheHeaders({ maxAge: 3600, cdnMaxAge: 86400 })

    expect(headers).toEqual({
      'Cache-Control': 'public, max-age=3600',
      'CDN-Cache-Control': 'public, max-age=86400',
    })
  })

  it('should ignore Vercel cache settings outside Vercel', () => {
    const headers = getCacheHeaders({
      maxAge: 3600,
      cdnMaxAge: 7200,
      vercelMaxAge: 86400,
    })

    expect(headers).toEqual({
      'Cache-Control': 'public, max-age=3600',
      'CDN-Cache-Control': 'public, max-age=7200',
    })
  })

  it('should support private cache visibility', () => {
    const headers = getCacheHeaders({ visibility: 'private' })

    expect(headers).toEqual({
      'Cache-Control': 'private, max-age=86400',
      'CDN-Cache-Control': 'private, max-age=86400',
    })
  })

  it('should support private cache with custom maxAge', () => {
    const headers = getCacheHeaders({ maxAge: 600, visibility: 'private' })

    expect(headers).toEqual({
      'Cache-Control': 'private, max-age=600',
      'CDN-Cache-Control': 'private, max-age=600',
    })
  })

  it('should handle zero maxAge', () => {
    const headers = getCacheHeaders({ maxAge: 0 })

    expect(headers).toEqual({
      'Cache-Control': 'public, max-age=0',
      'CDN-Cache-Control': 'public, max-age=0',
    })
  })

  it('should handle large maxAge values', () => {
    const headers = getCacheHeaders({ maxAge: 31536000 }) // 1 year

    expect(headers).toEqual({
      'Cache-Control': 'public, max-age=31536000',
      'CDN-Cache-Control': 'public, max-age=31536000',
    })
  })

  it('should support stale-while-revalidate for browser and CDN', () => {
    const headers = getCacheHeaders({
      maxAge: 300,
      swr: 3600,
      cdnMaxAge: 3600,
      cdnSwr: 86400,
      vercelMaxAge: 86400,
      vercelSwr: 604800,
    })

    expect(headers).toEqual({
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'CDN-Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    })
  })

  it('should support immutable cache headers', () => {
    const headers = getCacheHeaders({
      ...CACHE_PRESETS.IMMUTABLE,
      immutable: true,
    })

    expect(headers).toEqual({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'CDN-Cache-Control': 'public, max-age=31536000, immutable',
    })
  })
})

describe('getNoCacheHeaders', () => {
  it('should return headers that prevent caching', () => {
    const headers = getNoCacheHeaders()

    expect(headers).toEqual({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'CDN-Cache-Control': 'no-store',
    })
  })

  it('should always return the same headers', () => {
    const headers1 = getNoCacheHeaders()
    const headers2 = getNoCacheHeaders()

    expect(headers1).toEqual(headers2)
  })
})

describe('applyCacheHeaders', () => {
  let mockRes

  beforeEach(() => {
    mockRes = {
      setHeader: jest.fn(),
    }
  })

  it('should apply default cache headers to response', () => {
    applyCacheHeaders(mockRes)

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=86400'
    )
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'CDN-Cache-Control',
      'public, max-age=86400'
    )
    expect(mockRes.setHeader).toHaveBeenCalledTimes(2)
  })

  it('should apply custom cache headers to response', () => {
    applyCacheHeaders(mockRes, { maxAge: 3600 })

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=3600'
    )
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'CDN-Cache-Control',
      'public, max-age=3600'
    )
  })

  it('should apply RSS preset cache headers', () => {
    applyCacheHeaders(mockRes, CACHE_PRESETS.RSS)

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=10'
    )
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'CDN-Cache-Control',
      'public, max-age=60'
    )
  })

  it('should apply different maxAge for different caches', () => {
    applyCacheHeaders(mockRes, { maxAge: 10, cdnMaxAge: 60, vercelMaxAge: 600 })

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=10'
    )
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'CDN-Cache-Control',
      'public, max-age=60'
    )
  })

  it('should apply WIDGET_FRAME preset with stale-while-revalidate', () => {
    applyCacheHeaders(mockRes, CACHE_PRESETS.WIDGET_FRAME)

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=30, stale-while-revalidate=300'
    )
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'CDN-Cache-Control',
      'public, max-age=60, stale-while-revalidate=3600'
    )
  })
})

describe('Vercel cache headers', () => {
  const originalVercelUrl = process.env.VERCEL_URL

  afterEach(() => {
    if (originalVercelUrl === undefined) {
      delete process.env.VERCEL_URL
    } else {
      process.env.VERCEL_URL = originalVercelUrl
    }

    jest.resetModules()
  })

  it('should add Vercel cache headers when the CDN helper detects Vercel', async () => {
    process.env.VERCEL_URL = 'example.vercel.app'
    jest.resetModules()

    const {
      applyCacheHeaders: applyVercelCacheHeaders,
      getCacheHeaders: getVercelCacheHeaders,
      getNoCacheHeaders: getVercelNoCacheHeaders,
    } = await import('./cdn')

    expect(
      getVercelCacheHeaders({
        maxAge: 10,
        cdnMaxAge: 60,
        vercelMaxAge: 3600,
        vercelSwr: 86400,
      })
    ).toEqual({
      'Cache-Control': 'public, max-age=10',
      'CDN-Cache-Control': 'public, max-age=60',
      'Vercel-CDN-Cache-Control':
        'public, max-age=3600, stale-while-revalidate=86400',
    })

    expect(getVercelNoCacheHeaders()).toEqual({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    })

    const response = { setHeader: jest.fn() }

    applyVercelCacheHeaders(response, { maxAge: 10 })

    expect(response.setHeader).toHaveBeenCalledWith(
      'Vercel-CDN-Cache-Control',
      'public, max-age=10'
    )
  })
})
