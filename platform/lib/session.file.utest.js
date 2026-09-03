/* eslint-disable @typescript-eslint/no-require-imports */
import {
  getSessionFileTempDownloadURL,
  getSessionFileUploadInformation,
  uploadSessionFile,
  uploadSessionFileFromURL,
} from './session.file'

jest.mock('@/lib/storage', () => ({
  putObject: jest.fn(),
  getObjectDownloadUrl: jest.fn(),
}))

jest.mock('@/lib/cuid', () => ({
  __esModule: true,
  default: jest.fn(() => 'test-cuid-123'),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
  createSpan: jest.fn(() => ({ finish: jest.fn() })),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  getFetchError: jest.fn(),
}))

jest.mock('@/lib/file.helpers', () => ({
  joinName: jest.fn((id, ext) => (ext ? `${id}.${ext}` : id)),
}))

jest.mock('@/lib/mime2', () => ({
  reconcileTypeAndExt: jest.fn((type, ext) => ({ type, ext })),
}))

jest.mock('@/lib/response', () => ({
  throwLimitsReached: jest.fn((msg) => {
    throw new Error(msg)
  }),
}))

jest.mock('@/lib/short', () => ({
  getTempShortURL: jest.fn(),
}))

jest.mock('@/lib/url', () => ({
  tryExtname: jest.fn(),
}))

describe('session.file', () => {
  const { joinName } = require('@/lib/file.helpers')

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset joinName to default implementation
    joinName.mockImplementation((id, ext) => (ext ? `${id}.${ext}` : id))
  })

  describe('getSessionFileUploadInformation', () => {
    const scope = 'session'

    it('should generate upload info without extension', () => {
      const result = getSessionFileUploadInformation('session-123', null)

      expect(result).toEqual({
        fileId: 'test-cuid-123',
        name: 'test-cuid-123',
        scope,
        key: 'session-123/test-cuid-123',
      })
    })

    it('should generate upload info with extension', () => {
      const { joinName } = require('@/lib/file.helpers')

      joinName.mockReturnValue('test-cuid-123.png')

      const result = getSessionFileUploadInformation('session-123', 'png')

      expect(result).toEqual({
        fileId: 'test-cuid-123',
        name: 'test-cuid-123.png',
        scope,
        key: 'session-123/test-cuid-123.png',
      })
    })

    it('should use session id in key path', () => {
      const result = getSessionFileUploadInformation('different-session', 'jpg')

      expect(result.key).toContain('different-session/')
    })
  })

  describe('uploadSessionFile', () => {
    const { putObject } = require('@/lib/storage')
    const scope = 'session'

    it('should upload string data', async () => {
      putObject.mockResolvedValue(undefined)

      const result = await uploadSessionFile(
        'session-123',
        'test content',
        'text/plain',
        'txt',
        { maxSize: 1000 }
      )

      expect(putObject).toHaveBeenCalledWith(
        scope,
        'session-123/test-cuid-123.txt',
        expect.any(Uint8Array),
        { contentType: 'text/plain' }
      )

      expect(result).toEqual({
        sessionId: 'session-123',
        fileId: 'test-cuid-123',
        name: 'test-cuid-123.txt',
        scope,
        key: 'session-123/test-cuid-123.txt',
      })
    })

    it('should upload binary data', async () => {
      putObject.mockResolvedValue(undefined)

      const binaryData = new Uint8Array([1, 2, 3, 4])

      const result = await uploadSessionFile(
        'session-123',
        binaryData,
        'application/octet-stream',
        'bin',
        { maxSize: 1000 }
      )

      expect(putObject).toHaveBeenCalledWith(
        scope,
        expect.any(String),
        binaryData,
        { contentType: 'application/octet-stream' }
      )

      expect(result.sessionId).toBe('session-123')
    })

    it('should throw when file exceeds max size', async () => {
      const largeData = new Uint8Array(1000)
      const options = { maxSize: 500 }

      await expect(
        uploadSessionFile('session-123', largeData, 'image/png', 'png', options)
      ).rejects.toThrow('File is too large')
    })

    it('should upload when file is within max size', async () => {
      putObject.mockResolvedValue(undefined)

      const smallData = new Uint8Array(100)
      const options = { maxSize: 500 }

      const result = await uploadSessionFile(
        'session-123',
        smallData,
        'image/png',
        'png',
        options
      )

      expect(result.sessionId).toBe('session-123')
    })

    it('should handle upload without content type', async () => {
      putObject.mockResolvedValue(undefined)

      await uploadSessionFile('session-123', 'test', null, 'txt', {
        maxSize: 1000,
      })

      expect(putObject).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Uint8Array),
        { contentType: undefined }
      )
    })
  })

  describe('uploadSessionFileFromURL', () => {
    const fetch = require('@/lib/fetch').default
    const { getFetchError } = require('@/lib/fetch')
    const { putObject } = require('@/lib/storage')
    const { reconcileTypeAndExt } = require('@/lib/mime2')
    const { tryExtname } = require('@/lib/url')

    it('should upload file from URL', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/png'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
      }

      fetch.mockResolvedValue(mockResponse)
      putObject.mockResolvedValue(undefined)
      tryExtname.mockReturnValue('.png')
      reconcileTypeAndExt.mockReturnValue({ type: 'image/png', ext: 'png' })

      const result = await uploadSessionFileFromURL(
        'session-123',
        'https://example.com/image.png',
        undefined,
        { maxSize: 1000 }
      )

      expect(fetch).toHaveBeenCalledWith('https://example.com/image.png', {
        headers: undefined,
      })
      expect(result).toEqual({
        sessionId: 'session-123',
        fileId: 'test-cuid-123',
        name: 'test-cuid-123.png',
        type: 'image/png',
        scope: 'session',
        key: 'session-123/test-cuid-123.png',
      })
    })

    it('should handle fetch errors', async () => {
      const mockResponse = {
        ok: false,
      }

      fetch.mockResolvedValue(mockResponse)
      getFetchError.mockResolvedValue(new Error('Fetch failed'))

      await expect(
        uploadSessionFileFromURL(
          'session-123',
          'https://example.com/missing.png'
        )
      ).rejects.toThrow('Fetch failed')
    })

    it('should use default content type when missing', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
      }

      fetch.mockResolvedValue(mockResponse)
      putObject.mockResolvedValue(undefined)
      tryExtname.mockReturnValue(null)
      reconcileTypeAndExt.mockReturnValue({ type: null, ext: null })

      const result = await uploadSessionFileFromURL(
        'session-123',
        'https://example.com/file',
        undefined,
        { maxSize: 1000 }
      )

      expect(result.type).toBe('application/octet-stream')
    })

    it('should pass custom headers', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/plain'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(50)),
      }

      fetch.mockResolvedValue(mockResponse)
      putObject.mockResolvedValue(undefined)
      reconcileTypeAndExt.mockReturnValue({ type: 'text/plain', ext: 'txt' })

      const customHeaders = { Authorization: 'Bearer token' }

      await uploadSessionFileFromURL(
        'session-123',
        'https://example.com/file.txt',
        customHeaders,
        { maxSize: 1000 }
      )

      expect(fetch).toHaveBeenCalledWith('https://example.com/file.txt', {
        headers: customHeaders,
      })
    })

    it('should respect max size option', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/png'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1000)),
      }

      fetch.mockResolvedValue(mockResponse)
      reconcileTypeAndExt.mockReturnValue({ type: 'image/png', ext: 'png' })

      const options = { maxSize: 500 }

      await expect(
        uploadSessionFileFromURL(
          'session-123',
          'https://example.com/large.png',
          undefined,
          options
        )
      ).rejects.toThrow('File is too large')
    })
  })

  describe('getSessionFileTempDownloadURL', () => {
    const { getObjectDownloadUrl } = require('@/lib/storage')
    const { getTempShortURL } = require('@/lib/short')
    const scope = 'session'

    it('should generate temp download URL', async () => {
      getObjectDownloadUrl.mockResolvedValue(
        'https://s3.amazonaws.com/long-url'
      )
      getTempShortURL.mockResolvedValue('https://short.url/abc123')

      const result = await getSessionFileTempDownloadURL(
        'session-123',
        'file.png'
      )

      expect(getObjectDownloadUrl).toHaveBeenCalledWith(
        scope,
        'session-123/file.png'
      )
      expect(getTempShortURL).toHaveBeenCalledWith(
        'https://s3.amazonaws.com/long-url'
      )
      expect(result).toBe('https://short.url/abc123')
    })

    it('should handle different session ids and file names', async () => {
      getObjectDownloadUrl.mockResolvedValue('https://s3.amazonaws.com/url')
      getTempShortURL.mockResolvedValue('https://short.url/xyz')

      await getSessionFileTempDownloadURL('different-session', 'document.pdf')

      expect(getObjectDownloadUrl).toHaveBeenCalledWith(
        scope,
        'different-session/document.pdf'
      )
    })
  })
})
