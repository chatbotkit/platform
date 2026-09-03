/* eslint-disable @typescript-eslint/no-require-imports */
import { CACHE_PRESETS, getCacheHeaders } from '@/lib/cdn'
import unfurl from '@/lib/unfurl.fetch'

import handler, { FETCH_TIMEOUT, bodySchema, unfurlPage } from './unfurl'

jest.mock('@/lib/cdn', () => ({
  CACHE_PRESETS: { URL: 'url-cache' },
  getCacheHeaders: jest.fn(() => ({ 'Cache-Control': 'max-age=60' })),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/fetch', () => {
  const mockFetchWithTimeout = jest.fn()
  const mockFetchWithNextCache = jest.fn(() => mockFetchWithTimeout)

  return {
    __esModule: true,
    default: jest.fn(),
    withTimeout: jest.fn(() => mockFetchWithTimeout),
    withBodyTimeout: jest.fn(() => mockFetchWithTimeout),
    withNextCache: mockFetchWithNextCache,
    __mockFetchWithTimeout: mockFetchWithTimeout,
    __mockFetchWithNextCache: mockFetchWithNextCache,
  }
})

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data, headers) => ({ status: 200, body: data, headers }),
}))

jest.mock('@/lib/unfurl.fetch', () => jest.fn())

const {
  __mockFetchWithTimeout: mockFetchWithTimeout,
  __mockFetchWithNextCache: mockFetchWithNextCache,
} = require('@/lib/fetch')

describe('/api/v1/url/unfurl', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses expected fetch timeout constant', () => {
    expect(FETCH_TIMEOUT).toBe(10000)
  })

  it('returns empty data when fetch is not ok', async () => {
    mockFetchWithTimeout.mockResolvedValue({ ok: false })

    const result = await unfurlPage('https://example.com')

    expect(result).toEqual({ data: {} })
    expect(unfurl).not.toHaveBeenCalled()
  })

  it('returns html and unfurled data when fetch succeeds', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<html>Hello</html>'),
    })
    unfurl.mockResolvedValue({ title: 'Hello' })

    const result = await unfurlPage('https://example.com')

    expect(unfurl).toHaveBeenCalledWith({
      url: 'https://example.com',
      html: '<html>Hello</html>',
    })
    expect(result).toEqual({
      html: '<html>Hello</html>',
      data: { title: 'Hello' },
    })
  })

  it('handler trims url and returns cache headers with unfurl payload', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<meta property="og:title" />'),
    })
    unfurl.mockResolvedValue({ title: 'OG Title' })

    const result = await handler({}, {}, { url: ' https://example.com/post ' })

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'https://example.com/post',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: '*/*',
          'User-Agent': expect.any(String),
        }),
      })
    )
    expect(getCacheHeaders).toHaveBeenCalledWith(CACHE_PRESETS.URL)
    expect(result).toEqual({
      status: 200,
      body: { data: { title: 'OG Title' } },
      headers: { 'Cache-Control': 'max-age=60' },
    })
  })

  it('handler returns empty data when unfurlPage throws', async () => {
    mockFetchWithTimeout.mockRejectedValue(new Error('network failed'))

    const result = await handler({}, {}, { url: 'https://example.com' })

    expect(result).toEqual({
      status: 200,
      body: { data: {} },
      headers: { 'Cache-Control': 'max-age=60' },
    })
  })

  it('validates body schema', () => {
    expect(
      bodySchema.validate({ url: 'https://example.com' }).error
    ).toBeUndefined()
    expect(bodySchema.validate({ url: 'not-a-url' }).error).toBeDefined()
    expect(bodySchema.validate({}).error).toBeDefined()
  })
})
