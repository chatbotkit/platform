// Import mocked modules

import {
  RESPONSE_ACTIVITY_TYPE,
  makeRequestActivityMessage,
  makeResponseActivityMessage,
} from '@/lib/activity'
import {
  UPLOAD_ATTACHMENT_FUNCTION_NAME,
  getConversationAttachmentData,
  getConversationAttachmentDownloadURL,
  getConversationAttachmentUploadActivityMessageDetails,
  getConversationAttachmentUploadInformation,
  getConversationStorageBucketInfo,
  listConversationAttachments,
  makeConversationAttachmentUploadActivityMessages,
  uploadConversationAttachment,
  uploadConversationAttachmentFromURL,
} from '@/lib/conversation.attachment'
import cuid from '@/lib/cuid'
import debug, { createSpan } from '@/lib/debug'
import fetch, { getFetchError } from '@/lib/fetch'
import { joinName } from '@/lib/file.helpers'
import { nameToType, reconcileTypeAndExt } from '@/lib/mime2'
import { throwLimitsReached } from '@/lib/response'
import { getTempShortURL } from '@/lib/short'
import {
  getObject,
  getObjectDownloadUrl,
  listObjects,
  putObject,
} from '@/lib/storage'
import { tryExtname } from '@/lib/url'

jest.mock('@chatbotkit-dev/buffer', () => ({
}))

jest.mock('@/lib/storage', () => ({
  getObject: jest.fn(),
  getObjectDownloadUrl: jest.fn(),
  listObjects: jest.fn(),
  putObject: jest.fn(),
}))

jest.mock('@/lib/cuid', () => jest.fn())

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(),
  createSpan: jest.fn(() => ({
    finish: jest.fn(),
  })),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  getFetchError: jest.fn(),
}))

jest.mock('@/lib/file.helpers', () => ({
  joinName: jest.fn(),
}))

jest.mock('@/lib/mime2', () => ({
  nameToType: jest.fn(),
  reconcileTypeAndExt: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwLimitsReached: jest.fn(),
}))

jest.mock('@/lib/short', () => ({
  getTempShortURL: jest.fn(),
}))

jest.mock('@/lib/url', () => ({
  tryExtname: jest.fn(),
}))

describe('conversation.attachment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('UPLOAD_ATTACHMENT_FUNCTION_NAME', () => {
    it('should export the correct function name constant', () => {
      expect(UPLOAD_ATTACHMENT_FUNCTION_NAME).toBe('uploadAttachment')
    })
  })

  describe('getConversationStorageBucketInfo', () => {
  it('names the conversation store and the prefix, not a location', () => {
    // @note this feeds the sandbox mount request. It used to return a bucket
    // name read from the platform's own environment; the container is now the
    // storage module's to decide.
    expect(getConversationStorageBucketInfo('conv-123')).toEqual({
      scope: 'conversation',
      prefix: 'conv-123',
    })
  })
})

describe('getConversationAttachmentUploadInformation', () => {
    it('should generate upload information with conversation ID and extension', () => {
      const mockAttachmentId = 'mock-attachment-id'
      const mockName = 'mock-attachment-id.txt'

      cuid.mockReturnValue(mockAttachmentId)
      joinName.mockReturnValue(mockName)

      const result = getConversationAttachmentUploadInformation(
        'conv-123',
        'txt'
      )

      expect(cuid).toHaveBeenCalled()
      expect(joinName).toHaveBeenCalledWith(mockAttachmentId, 'txt')
      expect(result).toEqual({
        attachmentId: mockAttachmentId,
        name: mockName,
        scope: 'conversation',
        key: 'conv-123/mock-attachment-id.txt',
      })
    })

    it('should handle null extension', () => {
      const mockAttachmentId = 'mock-attachment-id'
      const mockName = 'mock-attachment-id'

      cuid.mockReturnValue(mockAttachmentId)
      joinName.mockReturnValue(mockName)

      const result = getConversationAttachmentUploadInformation(
        'conv-123',
        null
      )

      expect(joinName).toHaveBeenCalledWith(mockAttachmentId, null)
      expect(result.key).toBe('conv-123/mock-attachment-id')
    })
  })

  describe('listConversationAttachments', () => {
    it('should list attachments from conversation storage', async () => {
      const mockSpan = { finish: jest.fn() }
      const lastModified = new Date('2024-01-01T00:00:00Z')

      createSpan.mockReturnValue(mockSpan)
      nameToType.mockReturnValue('application/pdf')
      listObjects.mockResolvedValue({
        items: [
          {
            key: 'conv-123/att-123.pdf',
            size: 123,
            updatedAt: lastModified,
          },
        ],
        prefixes: [],
        nextToken: 'next-token',
        truncated: false,
      })

      const result = await listConversationAttachments('conv-123', {
        maxKeys: 10,
        continuationToken: 'token-1',
      })

      expect(listObjects).toHaveBeenCalledWith(
        'conversation',
        'conv-123/',
        {
          maxKeys: 10,
          continuationToken: 'token-1',
        }
      )
      expect(result).toEqual({
        items: [
          {
            id: 'att-123',
            name: 'att-123.pdf',
            description: 'att-123.pdf',
            type: 'application/pdf',
            size: 123,
            createdAt: lastModified,
            updatedAt: lastModified,
            meta: {
              contentType: 'application/pdf',
              size: 123,
            },
          },
        ],
        cursor: 'next-token',
      })
      expect(nameToType).toHaveBeenCalledWith('att-123.pdf')
      expect(mockSpan.finish).toHaveBeenCalled()
    })
  })

  describe('uploadConversationAttachment', () => {
    it('should upload string data to S3', async () => {
      const mockAttachmentId = 'mock-attachment-id'
      const mockName = 'mock-attachment-id.txt'
      const mockSpan = { finish: jest.fn() }

      cuid.mockReturnValue(mockAttachmentId)
      joinName.mockReturnValue(mockName)
      createSpan.mockReturnValue(mockSpan)
      putObject.mockResolvedValue({})

      const result = await uploadConversationAttachment(
        'conv-123',
        'test data',
        'text/plain',
        'txt',
        { maxSize: 1000 }
      )

      expect(debug).toHaveBeenCalledWith('uploading conversation attachment', {
        conversationId: 'conv-123',
        type: 'text/plain',
        ext: 'txt',
        options: { maxSize: 1000 },
      })

      expect(putObject).toHaveBeenCalledWith(
        'conversation',
        'conv-123/mock-attachment-id.txt',
        expect.any(Uint8Array),
        { contentType: 'text/plain' }
      )

      expect(result).toEqual({
        conversationId: 'conv-123',
        attachmentId: mockAttachmentId,
        name: mockName,
        scope: 'conversation',
        key: 'conv-123/mock-attachment-id.txt',
      })

      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should upload Uint8Array data to S3', async () => {
      const mockAttachmentId = 'mock-attachment-id'
      const mockName = 'mock-attachment-id.bin'
      const mockSpan = { finish: jest.fn() }
      const binaryData = new Uint8Array([1, 2, 3, 4])

      cuid.mockReturnValue(mockAttachmentId)
      joinName.mockReturnValue(mockName)
      createSpan.mockReturnValue(mockSpan)
      putObject.mockResolvedValue({})

      const result = await uploadConversationAttachment(
        'conv-123',
        binaryData,
        'application/octet-stream',
        'bin',
        { maxSize: 1000 }
      )

      expect(putObject).toHaveBeenCalledWith(
        'conversation',
        'conv-123/mock-attachment-id.bin',
        binaryData,
        { contentType: 'application/octet-stream' }
      )

      expect(result.attachmentId).toBe(mockAttachmentId)
      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should throw limits reached error when data exceeds maxSize', async () => {
      const largeData = new Uint8Array(2000)

      await uploadConversationAttachment(
        'conv-123',
        largeData,
        'application/octet-stream',
        'bin',
        { maxSize: 1000 }
      )

      expect(throwLimitsReached).toHaveBeenCalledWith('Attachment is too large')
    })

    it('should NOT reject a non-empty file when maxSize is omitted (regression: 0-byte default limit silently dropped attachments)', async () => {
      const mockAttachmentId = 'mock-attachment-id'
      const mockName = 'mock-attachment-id.oga'
      const mockSpan = { finish: jest.fn() }
      // @note a "voice note" payload - previously ANY non-empty file threw
      // because a missing maxSize defaulted the limit to 0 (`|| 0`).
      const voiceData = new Uint8Array(4096)

      cuid.mockReturnValue(mockAttachmentId)
      joinName.mockReturnValue(mockName)
      createSpan.mockReturnValue(mockSpan)
      putObject.mockResolvedValue({})

      await uploadConversationAttachment(
        'conv-123',
        voiceData,
        'audio/ogg',
        'oga'
        // @note no options / no maxSize - mirrors how the messaging queues
        // call this; must mean "no limit", not "limit 0".
      )

      expect(throwLimitsReached).not.toHaveBeenCalled()
      expect(putObject).toHaveBeenCalledWith(
        'conversation',
        'conv-123/mock-attachment-id.oga',
        voiceData,
        { contentType: 'audio/ogg' }
      )
    })

    it('should handle undefined type parameter', async () => {
      const mockAttachmentId = 'mock-attachment-id'
      const mockName = 'mock-attachment-id.txt'
      const mockSpan = { finish: jest.fn() }

      cuid.mockReturnValue(mockAttachmentId)
      joinName.mockReturnValue(mockName)
      createSpan.mockReturnValue(mockSpan)
      putObject.mockResolvedValue({})

      await uploadConversationAttachment(
        'conv-123',
        'test data',
        undefined,
        'txt',
        { maxSize: 1000 }
      )

      expect(putObject).toHaveBeenCalledWith(
        'conversation',
        'conv-123/mock-attachment-id.txt',
        expect.any(Uint8Array),
        { contentType: undefined }
      )
    })
  })

  describe('uploadConversationAttachmentFromURL', () => {
    it('should fetch URL and upload to S3', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg'),
        },
      }
      const mockAttachmentId = 'mock-attachment-id'
      const mockName = 'mock-attachment-id.jpg'
      const mockSpan = { finish: jest.fn() }

      fetch.mockResolvedValue(mockResponse)
      createSpan.mockReturnValue(mockSpan)
      tryExtname.mockReturnValue('.jpg')
      reconcileTypeAndExt.mockReturnValue({
        type: 'image/jpeg',
        ext: 'jpg',
      })
      cuid.mockReturnValue(mockAttachmentId)
      joinName.mockReturnValue(mockName)
      putObject.mockResolvedValue({})

      const result = await uploadConversationAttachmentFromURL(
        'conv-123',
        'https://example.com/image.jpg',
        { 'User-Agent': 'test' },
        { maxSize: 1000 }
      )

      expect(fetch).toHaveBeenCalledWith('https://example.com/image.jpg', {
        headers: { 'User-Agent': 'test' },
      })
      expect(tryExtname).toHaveBeenCalledWith('https://example.com/image.jpg')
      expect(reconcileTypeAndExt).toHaveBeenCalledWith('image/jpeg', 'jpg')

      expect(result).toEqual({
        conversationId: 'conv-123',
        attachmentId: mockAttachmentId,
        name: mockName,
        type: 'image/jpeg',
        scope: 'conversation',
        key: 'conv-123/mock-attachment-id.jpg',
      })

      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should handle fetch error response', async () => {
      const mockResponse = {
        ok: false,
      }
      const mockSpan = { finish: jest.fn() }
      const mockError = new Error('Fetch failed')

      fetch.mockResolvedValue(mockResponse)
      getFetchError.mockResolvedValue(mockError)
      createSpan.mockReturnValue(mockSpan)

      await expect(
        uploadConversationAttachmentFromURL(
          'conv-123',
          'https://example.com/image.jpg'
        )
      ).rejects.toThrow('Fetch failed')

      expect(getFetchError).toHaveBeenCalledWith(mockResponse)
      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should default to application/octet-stream when no content type', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      }
      const mockAttachmentId = 'mock-attachment-id'
      const mockName = 'mock-attachment-id'
      const mockSpan = { finish: jest.fn() }

      fetch.mockResolvedValue(mockResponse)
      createSpan.mockReturnValue(mockSpan)
      tryExtname.mockReturnValue(null)
      reconcileTypeAndExt.mockReturnValue({
        type: null,
        ext: null,
      })
      cuid.mockReturnValue(mockAttachmentId)
      joinName.mockReturnValue(mockName)
      putObject.mockResolvedValue({})

      const result = await uploadConversationAttachmentFromURL(
        'conv-123',
        'https://example.com/file'
      )

      expect(result.type).toBe('application/octet-stream')
      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should prefer provided filename and content type hints', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
        headers: {
          get: jest.fn().mockReturnValue('application/octet-stream'),
        },
      }
      const mockAttachmentId = 'mock-attachment-id'
      const mockName = 'mock-attachment-id.txt'
      const mockSpan = { finish: jest.fn() }

      fetch.mockResolvedValue(mockResponse)
      createSpan.mockReturnValue(mockSpan)
      tryExtname.mockReturnValue('.txt')
      reconcileTypeAndExt.mockReturnValue({
        type: 'text/plain',
        ext: 'txt',
      })
      cuid.mockReturnValue(mockAttachmentId)
      joinName.mockReturnValue(mockName)
      putObject.mockResolvedValue({})

      const result = await uploadConversationAttachmentFromURL(
        'conv-123',
        'https://chat.googleapis.com/v1/media/media-resource?alt=media',
        { Authorization: 'Bearer token' },
        {
          maxSize: 1000,
          name: 't.txt',
          type: 'text/plain',
        }
      )

      expect(tryExtname).toHaveBeenCalledWith('t.txt')
      expect(reconcileTypeAndExt).toHaveBeenCalledWith('text/plain', 'txt')
      expect(result).toEqual({
        conversationId: 'conv-123',
        attachmentId: mockAttachmentId,
        name: mockName,
        type: 'text/plain',
        scope: 'conversation',
        key: 'conv-123/mock-attachment-id.txt',
      })
      expect(mockSpan.finish).toHaveBeenCalled()
    })
  })

  describe('getConversationAttachmentData', () => {
    it('should retrieve attachment data from S3', async () => {
      const mockBuffer = new ArrayBuffer(10)
      const arrayBuffer = jest.fn().mockResolvedValue(mockBuffer)
      const mockResponse = {
        body: { arrayBuffer },
        contentType: 'text/plain',
      }
      const mockSpan = { finish: jest.fn() }

      getObject.mockResolvedValue(mockResponse)
      createSpan.mockReturnValue(mockSpan)

      const result = await getConversationAttachmentData(
        'conv-123',
        'attachment.txt'
      )

      expect(debug).toHaveBeenCalledWith('getting attachment data', {
        conversationId: 'conv-123',
        attachmentName: 'attachment.txt',
      })

      expect(getObject).toHaveBeenCalledWith(
        'conversation',
        'conv-123/attachment.txt'
      )

      expect(arrayBuffer).toHaveBeenCalled()

      expect(result).toEqual({
        data: new Uint8Array(mockBuffer),
        contentType: 'text/plain',
      })

      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should return null when no body in response', async () => {
      const mockResponse = {
        body: null,
        contentType: 'text/plain',
      }
      const mockSpan = { finish: jest.fn() }

      getObject.mockResolvedValue(mockResponse)
      createSpan.mockReturnValue(mockSpan)

      const result = await getConversationAttachmentData(
        'conv-123',
        'attachment.txt'
      )

      expect(result).toBeNull()
      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should default to application/octet-stream when no contentType', async () => {
      const mockBuffer = new ArrayBuffer(10)
      const mockResponse = {
        body: { arrayBuffer: jest.fn().mockResolvedValue(mockBuffer) },
        contentType: null,
      }
      const mockSpan = { finish: jest.fn() }

      getObject.mockResolvedValue(mockResponse)
      createSpan.mockReturnValue(mockSpan)

      const result = await getConversationAttachmentData(
        'conv-123',
        'attachment.txt'
      )

      expect(result.contentType).toBe('application/octet-stream')
      expect(mockSpan.finish).toHaveBeenCalled()
    })
  })

  describe('getConversationAttachmentDownloadURL', () => {
    it('should return short URL by default', async () => {
      const mockTempURL = 'https://s3.aws.com/temp-url'
      const mockShortURL = 'https://short.url/abc123'
      const mockSpan = { finish: jest.fn() }

      getObjectDownloadUrl.mockResolvedValue(mockTempURL)
      getTempShortURL.mockResolvedValue(mockShortURL)
      createSpan.mockReturnValue(mockSpan)

      const result = await getConversationAttachmentDownloadURL(
        'conv-123',
        'attachment.txt'
      )

      expect(debug).toHaveBeenCalledWith('getting attachment URL', {
        conversationId: 'conv-123',
        attachmentName: 'attachment.txt',
        short: true,
      })

      expect(getObjectDownloadUrl).toHaveBeenCalledWith(
        'conversation',
        'conv-123/attachment.txt'
      )

      expect(getTempShortURL).toHaveBeenCalledWith(mockTempURL)
      expect(result).toBe(mockShortURL)
      expect(mockSpan.finish).toHaveBeenCalled()
    })

    it('should return temp URL when short is false', async () => {
      const mockTempURL = 'https://s3.aws.com/temp-url'
      const mockSpan = { finish: jest.fn() }

      getObjectDownloadUrl.mockResolvedValue(mockTempURL)
      createSpan.mockReturnValue(mockSpan)

      const result = await getConversationAttachmentDownloadURL(
        'conv-123',
        'attachment.txt',
        false
      )

      expect(debug).toHaveBeenCalledWith('getting attachment URL', {
        conversationId: 'conv-123',
        attachmentName: 'attachment.txt',
        short: false,
      })

      expect(getTempShortURL).not.toHaveBeenCalled()
      expect(result).toBe(mockTempURL)
      expect(mockSpan.finish).toHaveBeenCalled()
    })
  })

  describe('makeConversationAttachmentUploadActivityMessages', () => {
    it('should create request and response activity messages', () => {
      const params = {
        id: 'attachment-123',
        name: 'test-file.txt',
        type: 'text/plain',
      }

      const result = makeConversationAttachmentUploadActivityMessages(params)

      expect(result.request).toEqual(
        makeRequestActivityMessage(UPLOAD_ATTACHMENT_FUNCTION_NAME, {})
      )

      expect(result.response).toEqual(
        makeResponseActivityMessage(
          UPLOAD_ATTACHMENT_FUNCTION_NAME,
          {},
          {
            id: 'attachment-123',
            name: 'test-file.txt',
            type: 'text/plain',
            url: 'attachment://test-file.txt',
          }
        )
      )
    })
  })

  describe('getConversationAttachmentUploadActivityMessageDetails', () => {
    it('should extract attachment details from response activity message', () => {
      const message = {
        meta: {
          activity: {
            type: RESPONSE_ACTIVITY_TYPE,
            function: {
              name: UPLOAD_ATTACHMENT_FUNCTION_NAME,
              result: {
                id: 'attachment-123',
                name: 'test-file.txt',
                type: 'text/plain',
              },
            },
          },
        },
      }

      const result =
        getConversationAttachmentUploadActivityMessageDetails(message)

      expect(result).toEqual({
        id: 'attachment-123',
        name: 'test-file.txt',
        type: 'text/plain',
      })
    })

    it('should return null for non-response activity message', () => {
      const message = {
        meta: {
          activity: {
            type: 'request',
            function: {
              name: UPLOAD_ATTACHMENT_FUNCTION_NAME,
            },
          },
        },
      }

      const result =
        getConversationAttachmentUploadActivityMessageDetails(message)

      expect(result).toBeNull()
    })

    it('should return null for different function name', () => {
      const message = {
        meta: {
          activity: {
            type: RESPONSE_ACTIVITY_TYPE,
            function: {
              name: 'differentFunction',
              result: {
                id: 'attachment-123',
                name: 'test-file.txt',
                type: 'text/plain',
              },
            },
          },
        },
      }

      const result =
        getConversationAttachmentUploadActivityMessageDetails(message)

      expect(result).toBeNull()
    })

    it('should return null when meta is missing', () => {
      const message = {
        meta: null,
      }

      const result =
        getConversationAttachmentUploadActivityMessageDetails(message)

      expect(result).toBeNull()
    })

    it('should return null when activity is missing', () => {
      const message = {
        meta: {},
      }

      const result =
        getConversationAttachmentUploadActivityMessageDetails(message)

      expect(result).toBeNull()
    })

    it('should handle missing function result gracefully', () => {
      const message = {
        meta: {
          activity: {
            type: RESPONSE_ACTIVITY_TYPE,
            function: {
              name: UPLOAD_ATTACHMENT_FUNCTION_NAME,
              result: null,
            },
          },
        },
      }

      const result =
        getConversationAttachmentUploadActivityMessageDetails(message)

      expect(result).toEqual({
        id: undefined,
        name: undefined,
        type: undefined,
      })
    })
  })
})
