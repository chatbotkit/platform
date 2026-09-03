
import fetch, { getFetchError } from '@/lib/fetch'
import { reconcileTypeAndExt } from '@/lib/mime2'
import { throwLimitsReached } from '@/lib/response'
import { getTempShortURL } from '@/lib/short'
import { getObject, getObjectDownloadUrl, putObject } from '@/lib/storage'
import { tryExtname } from '@/lib/url'

import {
  UPLOAD_ATTACHMENT_FUNCTION_NAME,
  getNamespaceAttachmentData,
  getNamespaceAttachmentTempDownloadURL,
  getNamespaceAttachmentUploadActivityMessageDetails,
  getNamespaceAttachmentUploadInformation,
  makeNamespaceAttachmentUploadActivityMessages,
  uploadNamespaceAttachment,
  uploadNamespaceAttachmentFromURL,
} from './namespace.attachment'

jest.mock('@/lib/storage', () => ({
  putObject: jest.fn(),
  getObject: jest.fn(),
  getObjectDownloadUrl: jest.fn(),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  getFetchError: jest.fn(),
}))

jest.mock('@/lib/short', () => ({
  getTempShortURL: jest.fn(),
}))

jest.mock('@/lib/cuid', () => ({
  __esModule: true,
  default: jest.fn(() => 'test-cuid-123'),
}))

jest.mock('@/lib/mime2', () => ({
  reconcileTypeAndExt: jest.fn((type, ext) => ({ type, ext })),
}))

jest.mock('@/lib/url', () => ({
  tryExtname: jest.fn(),
}))

jest.mock('@chatbotkit-dev/buffer', () => ({
}))

jest.mock('@/lib/response', () => ({
  throwLimitsReached: jest.fn((message) => {
    throw new Error(message)
  }),
}))

describe('namespace.attachment', () => {
  // @note the platform names a store, not a location. Which container backs
  // the namespace store is the storage module's business and is not observable
  // from here - which is the point of the scope.
  const SCOPE = 'namespace'

  beforeEach(() => {
    jest.clearAllMocks()
    throwLimitsReached.mockImplementation((message) => {
      throw new Error(message)
    })
  })

  describe('UPLOAD_ATTACHMENT_FUNCTION_NAME', () => {
    it('should have correct constant value', () => {
      expect(UPLOAD_ATTACHMENT_FUNCTION_NAME).toBe('uploadAttachment')
    })
  })

  describe('getNamespaceAttachmentUploadInformation', () => {
    it('should return upload information with extension', () => {
      const result = getNamespaceAttachmentUploadInformation(
        'namespace-123',
        '.txt'
      )

      expect(result).toEqual({
        attachmentId: 'test-cuid-123',
        name: 'test-cuid-123.txt',
        scope: SCOPE,
        key: 'namespace-123/test-cuid-123.txt',
      })
    })

    it('should return upload information without extension', () => {
      const result = getNamespaceAttachmentUploadInformation(
        'namespace-123',
        null
      )

      expect(result).toEqual({
        attachmentId: 'test-cuid-123',
        name: 'test-cuid-123',
        scope: SCOPE,
        key: 'namespace-123/test-cuid-123',
      })
    })

    it('should handle undefined extension', () => {
      const result = getNamespaceAttachmentUploadInformation(
        'namespace-123',
        undefined
      )

      expect(result).toEqual({
        attachmentId: 'test-cuid-123',
        name: 'test-cuid-123',
        scope: SCOPE,
        key: 'namespace-123/test-cuid-123',
      })
    })
  })

  describe('uploadNamespaceAttachment', () => {
    beforeEach(() => {
      putObject.mockResolvedValue(undefined)
    })

    it('should upload string data', async () => {
      const result = await uploadNamespaceAttachment(
        'namespace-123',
        'Hello world',
        'text/plain',
        '.txt',
        { maxSize: 1000 }
      )

      expect(result).toEqual({
        namespace: 'namespace-123',
        attachmentId: 'test-cuid-123',
        name: 'test-cuid-123.txt',
        scope: SCOPE,
        key: 'namespace-123/test-cuid-123.txt',
      })

      expect(putObject).toHaveBeenCalledWith(
        SCOPE,
        'namespace-123/test-cuid-123.txt',
        expect.any(Uint8Array),
        { contentType: 'text/plain' }
      )
    })

    it('should upload Uint8Array data', async () => {
      const data = new Uint8Array([1, 2, 3, 4])

      const result = await uploadNamespaceAttachment(
        'namespace-123',
        data,
        'application/octet-stream',
        '.bin',
        { maxSize: 1000 }
      )

      expect(result).toEqual({
        namespace: 'namespace-123',
        attachmentId: 'test-cuid-123',
        name: 'test-cuid-123.bin',
        scope: SCOPE,
        key: 'namespace-123/test-cuid-123.bin',
      })

      expect(putObject).toHaveBeenCalledWith(
        SCOPE,
        'namespace-123/test-cuid-123.bin',
        data,
        { contentType: 'application/octet-stream' }
      )
    })

    it('should throw error if data exceeds maxSize', async () => {
      const data = new Uint8Array(100)

      await expect(
        uploadNamespaceAttachment('namespace-123', data, 'text/plain', '.txt', {
          maxSize: 50,
        })
      ).rejects.toThrow()
    })

    it('should upload without contentType', async () => {
      await uploadNamespaceAttachment('namespace-123', 'Hello', null, '.txt', {
        maxSize: 1000,
      })

      expect(putObject).toHaveBeenCalledWith(
        SCOPE,
        'namespace-123/test-cuid-123.txt',
        expect.any(Uint8Array),
        { contentType: undefined }
      )
    })

    it('should handle no options', async () => {
      const data = new Uint8Array([1, 2, 3])

      await uploadNamespaceAttachment(
        'namespace-123',
        data,
        'text/plain',
        '.txt',
        { maxSize: 1000 }
      )

      expect(putObject).toHaveBeenCalled()
    })
  })

  describe('uploadNamespaceAttachmentFromURL', () => {
    beforeEach(() => {
      putObject.mockResolvedValue(undefined)
      tryExtname.mockReturnValue('.jpg')
    })

    it('should upload attachment from URL', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn(() => 'image/jpeg'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
      }

      fetch.mockResolvedValue(mockResponse)
      reconcileTypeAndExt.mockReturnValue({ type: 'image/jpeg', ext: '.jpg' })

      const result = await uploadNamespaceAttachmentFromURL(
        'namespace-123',
        'https://example.com/image.jpg',
        { Authorization: 'Bearer token' },
        { maxSize: 1000 }
      )

      expect(result).toEqual({
        namespace: 'namespace-123',
        attachmentId: 'test-cuid-123',
        name: 'test-cuid-123.jpg',
        type: 'image/jpeg',
        scope: SCOPE,
        key: 'namespace-123/test-cuid-123.jpg',
      })

      expect(fetch).toHaveBeenCalledWith('https://example.com/image.jpg', {
        headers: { Authorization: 'Bearer token' },
      })
    })

    it('should throw error if fetch fails', async () => {
      const mockResponse = {
        ok: false,
      }

      fetch.mockResolvedValue(mockResponse)
      getFetchError.mockResolvedValue(new Error('Fetch failed'))

      await expect(
        uploadNamespaceAttachmentFromURL(
          'namespace-123',
          'https://example.com/image.jpg'
        )
      ).rejects.toThrow('Fetch failed')
    })

    it('should use default content type if not provided', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn(() => null),
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
      }

      fetch.mockResolvedValue(mockResponse)
      reconcileTypeAndExt.mockReturnValue({ type: null, ext: null })
      putObject.mockResolvedValue(undefined)

      const result = await uploadNamespaceAttachmentFromURL(
        'namespace-123',
        'https://example.com/file',
        null,
        { maxSize: 1000 }
      )

      expect(result.type).toBe('application/octet-stream')
    })

    it('should handle URL without extension', async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn(() => 'text/plain'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
      }

      fetch.mockResolvedValue(mockResponse)
      tryExtname.mockReturnValue(null)
      reconcileTypeAndExt.mockReturnValue({ type: 'text/plain', ext: null })
      putObject.mockResolvedValue(undefined)

      const result = await uploadNamespaceAttachmentFromURL(
        'namespace-123',
        'https://example.com/file',
        null,
        { maxSize: 1000 }
      )

      expect(result).toBeDefined()
    })
  })

  describe('getNamespaceAttachmentData', () => {
    it('should return attachment data', async () => {
      const mockBuffer = new TextEncoder().encode('test data').buffer

      getObject.mockResolvedValue({
        body: { arrayBuffer: jest.fn().mockResolvedValue(mockBuffer) },
        contentType: 'text/plain',
      })

      const result = await getNamespaceAttachmentData(
        'namespace-123',
        'attachment.txt'
      )

      expect(result).toEqual({
        data: expect.any(Uint8Array),
        contentType: 'text/plain',
      })

      expect(getObject).toHaveBeenCalledWith(
        SCOPE,
        'namespace-123/attachment.txt'
      )
    })

    it('should return null if no body', async () => {
      getObject.mockResolvedValue({
        Body: null,
      })

      const result = await getNamespaceAttachmentData(
        'namespace-123',
        'attachment.txt'
      )

      expect(result).toBeNull()
    })

    it('should use default content type if not provided', async () => {
      const mockBuffer = new TextEncoder().encode('test data').buffer

      getObject.mockResolvedValue({
        body: { arrayBuffer: jest.fn().mockResolvedValue(mockBuffer) },
        contentType: null,
      })

      const result = await getNamespaceAttachmentData(
        'namespace-123',
        'attachment.txt'
      )

      expect(result.contentType).toBe('application/octet-stream')
    })
  })

  describe('getNamespaceAttachmentTempDownloadURL', () => {
    beforeEach(() => {
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/temp-url')
      getTempShortURL.mockResolvedValue('https://short.url/abc123')
    })

    it('should return short URL by default', async () => {
      const result = await getNamespaceAttachmentTempDownloadURL(
        'namespace-123',
        'attachment.txt'
      )

      expect(result).toBe('https://short.url/abc123')
      expect(getObjectDownloadUrl).toHaveBeenCalledWith(
        SCOPE,
        'namespace-123/attachment.txt'
      )
      expect(getTempShortURL).toHaveBeenCalledWith(
        'https://s3.example.com/temp-url'
      )
    })

    it('should return short URL when explicitly true', async () => {
      const result = await getNamespaceAttachmentTempDownloadURL(
        'namespace-123',
        'attachment.txt',
        true
      )

      expect(result).toBe('https://short.url/abc123')
      expect(getTempShortURL).toHaveBeenCalled()
    })

    it('should return temp URL when short is false', async () => {
      const result = await getNamespaceAttachmentTempDownloadURL(
        'namespace-123',
        'attachment.txt',
        false
      )

      expect(result).toBe('https://s3.example.com/temp-url')
      expect(getTempShortURL).not.toHaveBeenCalled()
    })
  })

  describe('makeNamespaceAttachmentUploadActivityMessages', () => {
    it('should create request and response messages', () => {
      const result = makeNamespaceAttachmentUploadActivityMessages({
        id: 'attach-123',
        name: 'file.txt',
        type: 'text/plain',
      })

      expect(result.request).toBeDefined()
      expect(result.response).toBeDefined()
      expect(result.response.type).toBe('activity')
      expect(result.response.meta.activity.type).toBe('response')
      expect(result.response.meta.activity.function.result).toEqual({
        id: 'attach-123',
        name: 'file.txt',
        type: 'text/plain',
        url: 'attachment://file.txt',
      })
    })

    it('should handle different file types', () => {
      const result = makeNamespaceAttachmentUploadActivityMessages({
        id: 'attach-456',
        name: 'image.png',
        type: 'image/png',
      })

      expect(result.response.meta.activity.function.result).toEqual({
        id: 'attach-456',
        name: 'image.png',
        type: 'image/png',
        url: 'attachment://image.png',
      })
    })
  })

  describe('getNamespaceAttachmentUploadActivityMessageDetails', () => {
    it('should extract attachment details from response message', () => {
      const message = {
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'uploadAttachment',
              result: {
                id: 'attach-123',
                name: 'file.txt',
                type: 'text/plain',
              },
            },
          },
        },
      }

      const result = getNamespaceAttachmentUploadActivityMessageDetails(message)

      expect(result).toEqual({
        id: 'attach-123',
        name: 'file.txt',
        type: 'text/plain',
      })
    })

    it('should return null for request message', () => {
      const message = {
        meta: {
          activity: {
            type: 'request',
            function: {
              name: 'uploadAttachment',
            },
          },
        },
      }

      const result = getNamespaceAttachmentUploadActivityMessageDetails(message)

      expect(result).toBeNull()
    })

    it('should return null for different function', () => {
      const message = {
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'otherFunction',
              result: {},
            },
          },
        },
      }

      const result = getNamespaceAttachmentUploadActivityMessageDetails(message)

      expect(result).toBeNull()
    })

    it('should return null for missing meta', () => {
      const message = {}

      const result = getNamespaceAttachmentUploadActivityMessageDetails(message)

      expect(result).toBeNull()
    })

    it('should return null for missing activity', () => {
      const message = {
        meta: {},
      }

      const result = getNamespaceAttachmentUploadActivityMessageDetails(message)

      expect(result).toBeNull()
    })

    it('should handle partial result data', () => {
      const message = {
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'uploadAttachment',
              result: {
                id: 'attach-123',
              },
            },
          },
        },
      }

      const result = getNamespaceAttachmentUploadActivityMessageDetails(message)

      expect(result).toEqual({
        id: 'attach-123',
        name: undefined,
        type: undefined,
      })
    })
  })
})
