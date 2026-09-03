/**
 * @jest-environment node
 */
import fetch from '@/lib/egress.fetch'

import { getUrlContentType } from './url3'

jest.mock('@/lib/egress.fetch')

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

describe('getUrlContentType', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('HEAD method success', () => {
    it('should return content type from HEAD request', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'Content-Type') {
              return 'application/json'
            }

            return null
          }),
        },
      })

      const result = await getUrlContentType('https://example.com/data.json')

      expect(result).toBe('application/json')
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith('https://example.com/data.json', {
        method: 'HEAD',
      })
    })

    it('should return null when HEAD succeeds but no content type header', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn(() => null),
        },
      })

      const result = await getUrlContentType('https://example.com/file')

      expect(result).toBeNull()
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('should return empty string as null when HEAD succeeds with empty content type', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'Content-Type') {
              return ''
            }

            return null
          }),
        },
      })

      const result = await getUrlContentType('https://example.com/file')

      expect(result).toBeNull()
    })

    it('should handle various content types from HEAD', async () => {
      const testCases = [
        { contentType: 'text/html', expected: 'text/html' },
        { contentType: 'image/png', expected: 'image/png' },
        { contentType: 'application/pdf', expected: 'application/pdf' },
        { contentType: 'video/mp4', expected: 'video/mp4' },
        {
          contentType: 'text/html; charset=utf-8',
          expected: 'text/html; charset=utf-8',
        },
      ]

      for (const { contentType, expected } of testCases) {
        jest.clearAllMocks()

        fetch.mockResolvedValueOnce({
          ok: true,
          headers: {
            get: jest.fn((header) => {
              if (header === 'Content-Type') {
                return contentType
              }

              return null
            }),
          },
        })

        const result = await getUrlContentType('https://example.com/file')

        expect(result).toBe(expected)
      }
    })
  })

  describe('GET method fallback', () => {
    it('should fallback to GET with range when HEAD fails', async () => {
      // First HEAD request fails
      fetch.mockResolvedValueOnce({
        ok: false,
        headers: {
          get: jest.fn(() => null),
        },
      })

      // Second GET request succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'Content-Type') {
              return 'image/jpeg'
            }

            return null
          }),
        },
      })

      const result = await getUrlContentType('https://example.com/image.jpg')

      expect(result).toBe('image/jpeg')
      expect(fetch).toHaveBeenCalledTimes(2)

      // Verify HEAD call
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'https://example.com/image.jpg',
        {
          method: 'HEAD',
        }
      )

      // Verify GET call with range header
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://example.com/image.jpg',
        {
          method: 'GET',
          headers: {
            Range: 'bytes=0-0',
          },
        }
      )
    })

    it('should return null when GET succeeds but no content type header', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: false,
          headers: { get: jest.fn(() => null) },
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: jest.fn(() => null) },
        })

      const result = await getUrlContentType('https://example.com/file')

      expect(result).toBeNull()
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should handle AWS S3 URLs that require range header', async () => {
      // Simulate S3 behavior - HEAD might fail, GET with range succeeds
      fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          headers: { get: jest.fn(() => null) },
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: jest.fn((header) => {
              if (header === 'Content-Type') {
                return 'application/octet-stream'
              }

              return null
            }),
          },
        })

      const result = await getUrlContentType(
        'https://bucket.s3.amazonaws.com/file.bin'
      )

      expect(result).toBe('application/octet-stream')
    })
  })

  describe('both methods fail', () => {
    it('should return null when both HEAD and GET fail', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          headers: { get: jest.fn(() => null) },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          headers: { get: jest.fn(() => null) },
        })

      const result = await getUrlContentType('https://example.com/notfound')

      expect(result).toBeNull()
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('should return null when both methods return server errors', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: { get: jest.fn(() => null) },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: { get: jest.fn(() => null) },
        })

      const result = await getUrlContentType('https://example.com/error')

      expect(result).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle redirects properly', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'Content-Type') {
              return 'text/html'
            }

            return null
          }),
        },
      })

      const result = await getUrlContentType(
        'https://example.com/redirect-to-page'
      )

      expect(result).toBe('text/html')
    })

    it('should handle URLs with query parameters', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'Content-Type') {
              return 'application/json'
            }

            return null
          }),
        },
      })

      const result = await getUrlContentType(
        'https://api.example.com/data?key=value&format=json'
      )

      expect(result).toBe('application/json')
    })

    it('should handle URLs with fragments', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'Content-Type') {
              return 'text/html'
            }

            return null
          }),
        },
      })

      const result = await getUrlContentType('https://example.com/page#section')

      expect(result).toBe('text/html')
    })

    it('should handle content type with multiple parameters', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'Content-Type') {
              return 'text/html; charset=utf-8; boundary=something'
            }

            return null
          }),
        },
      })

      const result = await getUrlContentType('https://example.com/complex')

      expect(result).toBe('text/html; charset=utf-8; boundary=something')
    })
  })

  describe('fetch exception handling', () => {
    it('should propagate fetch errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        getUrlContentType('https://example.com/error')
      ).rejects.toThrow('Network error')
    })

    it('should propagate timeout errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Request timeout'))

      await expect(
        getUrlContentType('https://example.com/slow')
      ).rejects.toThrow('Request timeout')
    })
  })

  describe('egress boundary', () => {
    it('refuses a private-IP literal URL before any connection is attempted', async () => {
      let captured

      fetch.mockImplementation((...args) =>
        jest
          .requireActual('@/lib/egress.fetch')
          .default(...args)
          .catch((e) => {
            captured = e

            throw e
          })
      )

      await expect(getUrlContentType('http://127.0.0.1/')).rejects.toThrow()

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(String(captured?.cause?.message)).toMatch(
        /egress to 127\.0\.0\.1 is not allowed: not a public address/
      )
    })
  })
})
