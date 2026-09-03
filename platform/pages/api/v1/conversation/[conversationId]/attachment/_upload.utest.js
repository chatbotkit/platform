/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './upload'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      conversation: {
        findUnique: jest.fn(),
      },
      message: {
        createMany: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  methodNotAllowed: () => ({ status: 405 }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
  limitsReached: () => ({ status: 429 }),
  badRequest: () => ({ status: 400 }),
  ok: (data) => ({ status: 200, ...data }),
  respondFromError: (e) => ({ status: 500, error: e }),
}))

jest.mock('@/lib/header', () => ({
  getContentTypeHeader: jest.fn(),
}))

jest.mock('@/lib/user.limits', () => ({
  getMaxFileSize: jest.fn(),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  schemaErrorToError: jest.fn((e) => e),
}))

jest.mock('@/lib/conversation.attachment', () => ({
  uploadConversationAttachment: jest.fn(),
  uploadConversationAttachmentFromURL: jest.fn(),
  getConversationAttachmentUploadInformation: jest.fn(),
  getConversationAttachmentDownloadURL: jest.fn(),
  makeConversationAttachmentUploadActivityMessages: jest.fn(),
}))

jest.mock('@/lib/storage', () => ({
  getObjectUploadUrl: jest.fn(),
}))

jest.mock('@/lib/dataurl.parse', () => ({
  parseDataURL: jest.fn(),
}))

jest.mock('@/lib/file.helpers', () => ({
  extname: jest.fn((name) => (name.includes('.') ? name.split('.').pop() : '')),
}))

jest.mock('@/lib/mime', () => ({
  typeToFileName: jest.fn((type) => `file.${type.split('/')[1] || 'bin'}`),
}))

jest.mock('@/lib/upload', () => ({
  getUploadFile: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  normalizeText: jest.fn((s) => s),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

const {
  uploadConversationAttachment,
  uploadConversationAttachmentFromURL,
  getConversationAttachmentUploadInformation,
  getConversationAttachmentDownloadURL,
  makeConversationAttachmentUploadActivityMessages,
} = require('@/lib/conversation.attachment')

const { getObjectUploadUrl } = require('@/lib/storage')
const { parseDataURL } = require('@/lib/dataurl.parse')
const { getContentTypeHeader } = require('@/lib/header')
const { getMaxFileSize } = require('@/lib/user.limits')
const { parseRequestJson } = require('@/lib/request')
const { getUploadFile } = require('@/lib/upload')

describe('POST /api/v1/conversation/{conversationId}/attachment/upload', () => {
  const mockSession = { user: { id: 'user-123' } }

  const mockConversation = {
    id: 'conv-abc',
    userId: 'user-123',
  }

  const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB

  beforeEach(() => {
    jest.clearAllMocks()
    getMaxFileSize.mockResolvedValue(MAX_FILE_SIZE)
    getConversationAttachmentDownloadURL.mockResolvedValue(
      'https://storage.example.com/download/file.pdf'
    )
    makeConversationAttachmentUploadActivityMessages.mockReturnValue({
      request: { role: 'activity', text: 'Upload requested' },
      response: { role: 'activity', text: 'Upload completed' },
    })
    prisma.message.createMany.mockResolvedValue({ count: 2 })
  })

  describe('HTTP method enforcement', () => {
    it('should return 405 for GET requests', async () => {
      const req = {
        method: 'GET',
        query: { conversationId: 'conv-abc' },
      }

      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await handler(req, mockSession)

      expect(result.status).toBe(405)
    })

    it('should return 405 for DELETE requests', async () => {
      const req = {
        method: 'DELETE',
        query: { conversationId: 'conv-abc' },
      }

      prisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await handler(req, mockSession)

      expect(result.status).toBe(405)
    })
  })

  describe('authorization', () => {
    it('should return 404 when the conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const req = {
        method: 'POST',
        query: { conversationId: 'missing-conv' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when the conversation belongs to a different user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-abc',
        userId: 'other-user-999',
      })

      const req = {
        method: 'POST',
        query: { conversationId: 'conv-abc' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })
  })

  describe('JSON body - HTTP URL upload', () => {
    it('should upload from a URL and return attachment id without uploadRequest', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('application/json')
      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/doc.pdf',
      })
      uploadConversationAttachmentFromURL.mockResolvedValue({
        attachmentId: 'att-url-1',
        name: 'doc.pdf',
      })

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }
      const result = await handler(req, mockSession)

      expect(uploadConversationAttachmentFromURL).toHaveBeenCalledWith(
        'conv-abc',
        'https://example.com/doc.pdf',
        {},
        { maxSize: MAX_FILE_SIZE }
      )
      expect(result.status).toBe(200)
      expect(result.id).toBe('att-url-1')
      expect(result.uploadRequest).toBeUndefined()
    })
  })

  describe('JSON body - data URL upload', () => {
    it('should parse a data URL and upload its binary content', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('application/json')
      parseRequestJson.mockResolvedValue({ file: 'data:image/png;base64,abc=' })
      parseDataURL.mockReturnValue({
        data: Buffer.from('fake-image-data').toString('base64'),
        type: 'image/png',
      })
      uploadConversationAttachment.mockResolvedValue({
        attachmentId: 'att-data-1',
        name: 'file.png',
      })

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }
      const result = await handler(req, mockSession)

      expect(parseDataURL).toHaveBeenCalledWith('data:image/png;base64,abc=')
      expect(uploadConversationAttachment).toHaveBeenCalled()
      expect(result.status).toBe(200)
      expect(result.id).toBe('att-data-1')
    })

    it('should return 429 when the data URL file exceeds the size limit', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('application/json')

      // Create a data URL for a file larger than MAX_FILE_SIZE
      const oversizedData = Buffer.alloc(MAX_FILE_SIZE + 1).toString('base64')

      parseRequestJson.mockResolvedValue({
        file: `data:image/png;base64,${oversizedData}`,
      })
      parseDataURL.mockReturnValue({
        data: oversizedData,
        type: 'image/png',
      })

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(429)
      expect(uploadConversationAttachment).not.toHaveBeenCalled()
    })
  })

  describe('JSON body - file object (direct-to-storage)', () => {
    it('should return 429 when the declared file size exceeds the limit', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('application/json')
      parseRequestJson.mockResolvedValue({
        file: { type: 'video/mp4', size: MAX_FILE_SIZE + 1, name: 'video.mp4' },
      })

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(429)
      expect(getObjectUploadUrl).not.toHaveBeenCalled()
    })

    it('should return pre-signed upload credentials for a file within the limit', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('application/json')
      parseRequestJson.mockResolvedValue({
        file: { type: 'application/pdf', size: 1024, name: 'document.pdf' },
      })
      getConversationAttachmentUploadInformation.mockReturnValue({
        attachmentId: 'att-direct-1',
        name: 'document.pdf',
        scope: 'conversation',
        key: 'uploads/document.pdf',
      })
      getObjectUploadUrl.mockResolvedValue('https://s3.example.com/presigned')

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.id).toBe('att-direct-1')
      expect(result.uploadRequest).toBeDefined()
      expect(result.uploadRequest.method).toBe('PUT')
      expect(result.uploadRequest.url).toBe('https://s3.example.com/presigned')
    })

    it('should include Content-Length and Content-Type headers in the upload request', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('application/json')
      parseRequestJson.mockResolvedValue({
        file: { type: 'application/pdf', size: 2048, name: null },
      })
      getConversationAttachmentUploadInformation.mockReturnValue({
        attachmentId: 'att-direct-2',
        name: 'upload.pdf',
        scope: 'conversation',
        key: 'uploads/upload.pdf',
      })
      getObjectUploadUrl.mockResolvedValue('https://s3.example.com/presigned')

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }
      const result = await handler(req, mockSession)

      expect(result.uploadRequest.headers['Content-Length']).toBe('2048')
      expect(result.uploadRequest.headers['Content-Type']).toBe(
        'application/pdf'
      )
    })

    it('should fall back to a filename-derived content type when file.type is empty', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('application/json')
      parseRequestJson.mockResolvedValue({
        file: { type: '', size: 2048, name: 'document.pdf' },
      })
      getConversationAttachmentUploadInformation.mockReturnValue({
        attachmentId: 'att-direct-3',
        name: 'document.pdf',
        scope: 'conversation',
        key: 'uploads/document.pdf',
      })
      getObjectUploadUrl.mockResolvedValue('https://s3.example.com/presigned')

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(getObjectUploadUrl).toHaveBeenCalledWith(
        'conversation',
        'uploads/document.pdf',
        expect.objectContaining({
          size: 2048,
          type: 'application/pdf',
          name: 'document.pdf',
        })
      )
      expect(result.uploadRequest.headers['Content-Type']).toBe(
        'application/pdf'
      )
    })
  })

  describe('multipart form upload', () => {
    it('should upload a multipart file and return attachment id', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('multipart/form-data')

      const fakeData = new Uint8Array([1, 2, 3])

      getUploadFile.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(fakeData.buffer),
        size: 3,
        type: 'text/plain',
        name: 'notes.txt',
      })
      uploadConversationAttachment.mockResolvedValue({
        attachmentId: 'att-mp-1',
        name: 'notes.txt',
      })

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }
      const result = await handler(req, mockSession)

      expect(getUploadFile).toHaveBeenCalledWith(req)
      expect(result.status).toBe(200)
      expect(result.id).toBe('att-mp-1')
    })

    it('should return 429 when the multipart file is too large', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('multipart/form-data')

      const oversizedBuffer = new ArrayBuffer(MAX_FILE_SIZE + 1)

      getUploadFile.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(oversizedBuffer),
        size: MAX_FILE_SIZE + 1,
        type: 'text/plain',
        name: 'big.txt',
      })

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(429)
      expect(uploadConversationAttachment).not.toHaveBeenCalled()
    })
  })

  describe('raw binary upload', () => {
    it('should upload raw binary data and return attachment id', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('image/jpeg')

      const fakeBuffer = new ArrayBuffer(100)

      const req = {
        method: 'POST',
        query: { conversationId: 'conv-abc' },
        arrayBuffer: jest.fn().mockResolvedValue(fakeBuffer),
      }

      uploadConversationAttachment.mockResolvedValue({
        attachmentId: 'att-raw-1',
        name: 'image.jpeg',
      })

      const result = await handler(req, mockSession)

      expect(uploadConversationAttachment).toHaveBeenCalledWith(
        'conv-abc',
        expect.any(Uint8Array),
        'image/jpeg',
        expect.anything(),
        { maxSize: MAX_FILE_SIZE }
      )
      expect(result.status).toBe(200)
      expect(result.id).toBe('att-raw-1')
    })

    it('should return 429 when the raw binary stream exceeds the size limit', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('image/jpeg')

      const oversizedBuffer = new ArrayBuffer(MAX_FILE_SIZE + 1)

      const req = {
        method: 'POST',
        query: { conversationId: 'conv-abc' },
        arrayBuffer: jest.fn().mockResolvedValue(oversizedBuffer),
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(429)
      expect(uploadConversationAttachment).not.toHaveBeenCalled()
    })
  })

  describe('activity message tracking', () => {
    it('should create two activity messages in the conversation on a successful upload', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('application/json')
      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/doc.pdf',
      })
      uploadConversationAttachmentFromURL.mockResolvedValue({
        attachmentId: 'att-msg-1',
        name: 'doc.pdf',
      })

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }

      await handler(req, mockSession)

      expect(prisma.message.createMany).toHaveBeenCalledTimes(1)

      const { data } = prisma.message.createMany.mock.calls[0][0]

      expect(data).toHaveLength(2)
      expect(data[0].conversationId).toBe('conv-abc')
      expect(data[1].conversationId).toBe('conv-abc')
    })

    it('should always include a downloadRequest in the response', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      getContentTypeHeader.mockReturnValue('application/json')
      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/doc.pdf',
      })
      uploadConversationAttachmentFromURL.mockResolvedValue({
        attachmentId: 'att-dl-1',
        name: 'doc.pdf',
      })
      getConversationAttachmentDownloadURL.mockResolvedValue(
        'https://cdn.example.com/doc.pdf'
      )

      const req = { method: 'POST', query: { conversationId: 'conv-abc' } }
      const result = await handler(req, mockSession)

      expect(result.downloadRequest).toBeDefined()
      expect(result.downloadRequest.method).toBe('GET')
      expect(result.downloadRequest.url).toBe('https://cdn.example.com/doc.pdf')
    })
  })
})
