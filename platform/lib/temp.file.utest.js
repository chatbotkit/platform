import fetch, { getFetchError } from '@/lib/fetch'
import { getTempShortURL } from '@/lib/short'
import { getObjectDownloadUrl, putObject } from '@/lib/storage'

import {
  getTempFileDownloadURL,
  getTempFileTempDownloadURL,
  getTempFileUploadInformation,
  uploadTempBlob,
  uploadTempFile,
  uploadTempFileFromURL,
} from './temp.file'

jest.mock('@/lib/storage', () => ({
  putObject: jest.fn(),
  getObjectDownloadUrl: jest.fn(),
}))

jest.mock('@/lib/cuid', () => jest.fn(() => 'test-cuid-12345'))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  getFetchError: jest.fn(),
}))

jest.mock('@/lib/short', () => ({
  getTempShortURL: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwLimitsReached: jest.fn((message) => {
    throw new Error(message)
  }),
}))

describe('getTempFileUploadInformation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return file information with all required fields', () => {
      const result = getTempFileUploadInformation('temp-123', '.txt')

      expect(result).toHaveProperty('tempId', 'temp-123')
      expect(result).toHaveProperty('fileId')
      expect(result).toHaveProperty('fileName')
      expect(result).toHaveProperty('ext', '.txt')
      expect(result).toHaveProperty('type')
      expect(result).toHaveProperty('scope')
      expect(result).toHaveProperty('key')
    })

    it('should generate correct file name with extension', () => {
      const result = getTempFileUploadInformation('temp-123', '.pdf')

      expect(result.fileName).toBe('test-cuid-12345.pdf')
      expect(result.ext).toBe('.pdf')
    })

    it('should infer MIME type from extension', () => {
      const result = getTempFileUploadInformation('temp-123', '.json')

      expect(result.type).toBe('application/json')
    })

    it('should generate correct S3 key path', () => {
      const result = getTempFileUploadInformation('temp-123', '.txt')

      expect(result.key).toBe('temp-123/test-cuid-12345.txt')
    })
  })

  describe('edge cases', () => {
    it('should handle null extension', () => {
      const result = getTempFileUploadInformation('temp-123', null)

      expect(result.ext).toBeNull()
      expect(result.type).toBeNull()
      expect(result.fileName).toBe('test-cuid-12345')
    })

    it('should handle undefined extension', () => {
      const result = getTempFileUploadInformation('temp-123', undefined)

      expect(result.ext).toBeNull()
      expect(result.type).toBeNull()
    })

    it('should handle extension without dot', () => {
      const result = getTempFileUploadInformation('temp-123', 'txt')

      // @note mime library accepts extension without dot and still returns a type
      expect(result.type).toBe('text/plain')
    })

    it('should handle unknown extension', () => {
      const result = getTempFileUploadInformation('temp-123', '.xyz123')

      expect(result.type).toBeNull()
      expect(result.fileName).toBe('test-cuid-12345.xyz123')
    })
  })

  describe('store selection', () => {
    it('should name the temp store rather than a location', () => {
      const result = getTempFileUploadInformation('temp-123', '.txt')

      expect(result.scope).toBe('temp')
    })
  })
})

describe('uploadTempFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should upload string data as Uint8Array', async () => {
      const result = await uploadTempFile(
        'temp-123',
        'test content',
        'text/plain',
        '.txt',
        { maxSize: 1000 }
      )

      expect(putObject).toHaveBeenCalledWith(
        expect.any(String),
        'temp-123/test-cuid-12345.txt',
        expect.any(Uint8Array),
        { contentType: 'text/plain' }
      )
      expect(result.tempId).toBe('temp-123')
      expect(result.fileId).toBe('test-cuid-12345')
    })

    it('should upload Uint8Array data directly', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5])
      const result = await uploadTempFile(
        'temp-123',
        data,
        'application/octet-stream',
        '.bin',
        { maxSize: 1000 }
      )

      expect(putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        data,
        { contentType: 'application/octet-stream' }
      )
      expect(result.scope).toBe('temp')
      expect(result.key).toContain('temp-123/')
    })

    it('should return upload information', async () => {
      const result = await uploadTempFile(
        'temp-123',
        'test',
        'text/plain',
        '.txt',
        { maxSize: 1000 }
      )

      expect(result).toHaveProperty('tempId', 'temp-123')
      expect(result).toHaveProperty('fileId')
      expect(result).toHaveProperty('fileName')
      expect(result).toHaveProperty('scope')
      expect(result).toHaveProperty('key')
    })
  })

  describe('size validation', () => {
    it('should reject files exceeding maxSize', async () => {
      const largeData = 'x'.repeat(1001)

      await expect(
        uploadTempFile('temp-123', largeData, 'text/plain', '.txt', {
          maxSize: 1000,
        })
      ).rejects.toThrow('File is too large')
    })

    it('should accept files within maxSize', async () => {
      const data = 'x'.repeat(100)

      await expect(
        uploadTempFile('temp-123', data, 'text/plain', '.txt', {
          maxSize: 1000,
        })
      ).resolves.toBeDefined()
    })

    it('should accept files exactly at maxSize', async () => {
      const data = 'x'.repeat(1000)

      await expect(
        uploadTempFile('temp-123', data, 'text/plain', '.txt', {
          maxSize: 1000,
        })
      ).resolves.toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle null type', async () => {
      await uploadTempFile('temp-123', 'test', null, '.txt', { maxSize: 1000 })

      expect(putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Uint8Array),
        { contentType: undefined }
      )
    })

    it('should handle empty string data', async () => {
      const result = await uploadTempFile(
        'temp-123',
        '',
        'text/plain',
        '.txt',
        { maxSize: 1000 }
      )

      expect(result).toBeDefined()
      expect(putObject).toHaveBeenCalled()
    })

    it('should handle missing options', async () => {
      // @note without options, maxSize defaults to 0 and any file is rejected
      await expect(
        uploadTempFile('temp-123', 'test', 'text/plain', '.txt')
      ).rejects.toThrow('File is too large')
    })
  })
})

describe('uploadTempFileFromURL', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should fetch and upload file from URL', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
        headers: {
          get: jest.fn((header) => {
            if (header === 'content-type') {
              return 'image/png'
            }

            return null
          }),
        },
      }

      fetch.mockResolvedValue(mockResponse)

      const result = await uploadTempFileFromURL(
        'temp-123',
        'https://example.com/image.png',
        {},
        { maxSize: 1000 }
      )

      expect(fetch).toHaveBeenCalledWith('https://example.com/image.png', {
        headers: {},
      })
      expect(result.tempId).toBe('temp-123')
      expect(result.fileId).toBeDefined()
    })

    it('should pass custom headers to fetch', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([]).buffer),
        headers: {
          get: jest.fn(() => 'text/plain'),
        },
      }

      fetch.mockResolvedValue(mockResponse)

      const customHeaders = { Authorization: 'Bearer token' }

      await uploadTempFileFromURL(
        'temp-123',
        'https://example.com/file.txt',
        customHeaders,
        { maxSize: 1000 }
      )

      expect(fetch).toHaveBeenCalledWith(expect.any(String), {
        headers: customHeaders,
      })
    })

    it('should infer file type from content-type header', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([]).buffer),
        headers: {
          get: jest.fn(() => 'application/json'),
        },
      }

      fetch.mockResolvedValue(mockResponse)

      await uploadTempFileFromURL(
        'temp-123',
        'https://example.com/data',
        {},
        { maxSize: 1000 }
      )

      expect(putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Uint8Array),
        expect.objectContaining({ contentType: 'application/json' })
      )
    })
  })

  describe('error handling', () => {
    it('should throw error for failed fetch', async () => {
      const mockResponse = { ok: false }
      const mockError = new Error('Fetch failed')

      fetch.mockResolvedValue(mockResponse)
      getFetchError.mockResolvedValue(mockError)

      await expect(
        uploadTempFileFromURL(
          'temp-123',
          'https://example.com/404',
          {},
          { maxSize: 1000 }
        )
      ).rejects.toThrow('Fetch failed')
    })
  })

  describe('edge cases', () => {
    it('should handle missing content-type header', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([]).buffer),
        headers: {
          get: jest.fn(() => null),
        },
      }

      fetch.mockResolvedValue(mockResponse)

      await uploadTempFileFromURL(
        'temp-123',
        'https://example.com/file',
        {},
        { maxSize: 1000 }
      )

      expect(putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Uint8Array),
        expect.objectContaining({ contentType: 'application/octet-stream' })
      )
    })

    it('should extract extension from URL', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([]).buffer),
        headers: {
          get: jest.fn(() => null),
        },
      }

      fetch.mockResolvedValue(mockResponse)

      await uploadTempFileFromURL(
        'temp-123',
        'https://example.com/file.pdf',
        {},
        { maxSize: 1000 }
      )

      expect(putObject).toHaveBeenCalled()
    })
  })
})

describe('getTempFileDownloadURL', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should generate download URL for file', async () => {
      getObjectDownloadUrl.mockResolvedValue(
        'https://s3.amazonaws.com/bucket/temp-123/file.txt'
      )

      const url = await getTempFileDownloadURL('temp-123', 'file.txt')

      expect(getObjectDownloadUrl).toHaveBeenCalledWith(
        expect.any(String),
        'temp-123/file.txt'
      )
      expect(url).toBe('https://s3.amazonaws.com/bucket/temp-123/file.txt')
    })

    it('should construct correct S3 key', async () => {
      getObjectDownloadUrl.mockResolvedValue('https://example.com/url')

      await getTempFileDownloadURL('temp-456', 'document.pdf')

      expect(getObjectDownloadUrl).toHaveBeenCalledWith(
        expect.any(String),
        'temp-456/document.pdf'
      )
    })
  })
})

describe('getTempFileTempDownloadURL', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should generate short URL for file', async () => {
      getObjectDownloadUrl.mockResolvedValue(
        'https://s3.amazonaws.com/long-url'
      )
      getTempShortURL.mockResolvedValue('https://short.url/abc123')

      const url = await getTempFileTempDownloadURL('temp-123', 'file.txt')

      expect(getObjectDownloadUrl).toHaveBeenCalled()
      expect(getTempShortURL).toHaveBeenCalledWith(
        'https://s3.amazonaws.com/long-url'
      )
      expect(url).toBe('https://short.url/abc123')
    })

    it('should create short URL from full S3 URL', async () => {
      const fullUrl =
        'https://s3.amazonaws.com/bucket/temp-123/file.txt?signature=xyz'

      getObjectDownloadUrl.mockResolvedValue(fullUrl)
      getTempShortURL.mockResolvedValue('https://short.url/xyz')

      await getTempFileTempDownloadURL('temp-123', 'file.txt')

      expect(getTempShortURL).toHaveBeenCalledWith(fullUrl)
    })
  })
})

describe('uploadTempBlob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getObjectDownloadUrl.mockResolvedValue(
      'https://s3.amazonaws.com/bucket/file'
    )
  })

  describe('basic functionality', () => {
    it('should upload blob and return URL', async () => {
      const blob = new Blob(['test content'], { type: 'text/plain' })

      const url = await uploadTempBlob(blob, { maxSize: 1000 })

      expect(putObject).toHaveBeenCalled()
      expect(url).toBeInstanceOf(URL)
      expect(url.protocol).toBe('https:')
    })

    it('should use blob MIME type for upload', async () => {
      const blob = new Blob(['{"key":"value"}'], { type: 'application/json' })

      await uploadTempBlob(blob, { maxSize: 1000 })

      expect(putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Uint8Array),
        expect.objectContaining({ contentType: 'application/json' })
      )
    })

    it('should return short URL when short option is true', async () => {
      getTempShortURL.mockResolvedValue('https://short.url/abc')

      const blob = new Blob(['test'], { type: 'text/plain' })

      const url = await uploadTempBlob(blob, { maxSize: 1000, short: true })

      expect(getTempShortURL).toHaveBeenCalled()
      expect(url.toString()).toContain('short.url')
    })

    it('should return full URL when short option is false', async () => {
      const blob = new Blob(['test'], { type: 'text/plain' })

      await uploadTempBlob(blob, { maxSize: 1000, short: false })

      expect(getTempShortURL).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle blob without MIME type', async () => {
      const blob = new Blob(['test'])

      await uploadTempBlob(blob, { maxSize: 1000 })

      expect(putObject).toHaveBeenCalled()
    })

    it('should handle empty blob', async () => {
      const blob = new Blob([])

      const url = await uploadTempBlob(blob, { maxSize: 1000 })

      expect(url).toBeInstanceOf(URL)
    })

    it('should respect maxSize option', async () => {
      const blob = new Blob(['x'.repeat(1001)])

      await expect(uploadTempBlob(blob, { maxSize: 1000 })).rejects.toThrow()
    })
  })
})
