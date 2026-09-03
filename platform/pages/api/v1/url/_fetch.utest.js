/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { html2text } from '@chatbotkit-dev/file-html/parse'

import { CACHE_PRESETS, getCacheHeaders } from '@/lib/cdn'
import { normalizeText } from '@/lib/string'

import handler, { fetchPage } from './fetch'

jest.mock('@chatbotkit-dev/file-html/parse', () => ({
  html2text: jest.fn(),
}))

jest.mock('@/lib/cdn', () => ({
  CACHE_PRESETS: { URL: 'url-cache' },
  getCacheHeaders: jest.fn(() => ({ 'Cache-Control': 'max-age=60' })),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/egress.fetch', () => jest.fn())

// @note the timeout wrapper is passed through so the handler's calls land on
// the egress fetch mock directly
jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/fetch'),
  withTimeout: jest.fn((fn) => fn),
}))

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

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

jest.mock('@/lib/string', () => ({
  normalizeText: jest.fn((value) => value),
}))

const mockFetchWithTimeout = require('@/lib/egress.fetch')

describe('/api/v1/url/fetch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetchPage should return empty text for non-ok response', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
    })

    const result = await fetchPage('https://example.com')

    expect(result).toBe('')
    expect(html2text).not.toHaveBeenCalled()
  })

  it('fetchPage should convert HTML to text for ok response', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<h1>Hello</h1>'),
    })
    html2text.mockReturnValue('Hello')

    const result = await fetchPage('https://example.com')

    expect(html2text).toHaveBeenCalledWith('<h1>Hello</h1>', {
      url: 'https://example.com',
    })
    expect(result).toBe('Hello')
  })

  it('handler should trim URL, normalize text, and return cache headers', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<p> test </p>'),
    })
    html2text.mockReturnValue(' test ')
    normalizeText.mockReturnValue('test')

    const result = await handler({}, {}, { url: ' https://example.com ' })

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: '*/*',
          'User-Agent': expect.any(String),
        }),
      })
    )
    expect(getCacheHeaders).toHaveBeenCalledWith(CACHE_PRESETS.URL)
    expect(normalizeText).toHaveBeenCalledWith(' test ')
    expect(result).toEqual({
      status: 200,
      body: { text: 'test' },
      headers: { 'Cache-Control': 'max-age=60' },
    })
  })

  it('refuses a private-IP literal URL before any connection is attempted', async () => {
    let captured

    mockFetchWithTimeout.mockImplementation((...args) =>
      jest
        .requireActual('@/lib/egress.fetch')
        .default(...args)
        .catch((e) => {
          captured = e

          throw e
        })
    )

    await expect(
      handler({}, {}, { url: 'http://127.0.0.1/admin' })
    ).rejects.toThrow()

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'http://127.0.0.1/admin',
      expect.any(Object)
    )
    expect(String(captured?.cause?.message)).toMatch(
      /egress to 127\.0\.0\.1 is not allowed: not a public address/
    )
    expect(html2text).not.toHaveBeenCalled()
  })
})
