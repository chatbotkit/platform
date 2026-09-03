/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './attach'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    widgetIntegration: {
      findUniqueByIdentifier: jest.fn(),
    },
    file: {
      findUniqueByIdentifier: jest.fn(),
    },
    widgetIntegrationFileAttachment: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  WidgetIntegrationFileAttachmentType: {
    PRIVACY_POLICY: 'PRIVACY_POLICY',
    TERMS_OF_SERVICE: 'TERMS_OF_SERVICE',
    INSTRUCTIONS: 'INSTRUCTIONS',
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: {
    object: jest.fn(() => ({})),
    string: jest.fn(() => ({
      valid: jest.fn(() => ({
        required: jest.fn(() => ({})),
      })),
    })),
  },
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('/api/v1/integration/widget/[widgetIntegrationId]/file/[fileId]/attach', () => {
  const mockSession = {
    user: {
      id: 'user123',
    },
  }

  const mockReq = (widgetIntegrationId, fileId) => ({
    query: { widgetIntegrationId, fileId },
  })

  const mockBody = (type) => ({ type })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should attach file to widget integration successfully', async () => {
      const mockWidget = {
        id: 'widget123',
        userId: 'user123',
      }

      const mockFile = {
        id: 'file123',
        userId: 'user123',
      }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )
      prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)
      prisma.widgetIntegrationFileAttachment.findUnique.mockResolvedValue(null)
      prisma.widgetIntegrationFileAttachment.create.mockResolvedValue({
        widgetIntegrationId: 'widget123',
        type: 'PRIVACY_POLICY',
        fileId: 'file123',
      })

      const req = mockReq('widget123', 'file123')
      const body = mockBody('PRIVACY_POLICY')
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        id: 'file123',
        type: 'PRIVACY_POLICY',
        widgetIntegrationId: 'widget123',
      })
      expect(
        prisma.widgetIntegrationFileAttachment.create
      ).toHaveBeenCalledWith({
        data: {
          widgetIntegrationId: 'widget123',
          type: 'PRIVACY_POLICY',
          fileId: 'file123',
        },
      })
    })

    it('should replace existing attachment of same type', async () => {
      const mockWidget = {
        id: 'widget123',
        userId: 'user123',
      }

      const mockFile = {
        id: 'file456',
        userId: 'user123',
      }

      const existingAttachment = {
        widgetIntegrationId: 'widget123',
        type: 'PRIVACY_POLICY',
        fileId: 'file123',
      }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )
      prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)
      prisma.widgetIntegrationFileAttachment.findUnique.mockResolvedValue(
        existingAttachment
      )
      prisma.widgetIntegrationFileAttachment.delete.mockResolvedValue(
        existingAttachment
      )
      prisma.widgetIntegrationFileAttachment.create.mockResolvedValue({
        widgetIntegrationId: 'widget123',
        type: 'PRIVACY_POLICY',
        fileId: 'file456',
      })

      const req = mockReq('widget123', 'file456')
      const body = mockBody('PRIVACY_POLICY')
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(
        prisma.widgetIntegrationFileAttachment.delete
      ).toHaveBeenCalledWith({
        where: {
          widgetIntegrationId_type: {
            widgetIntegrationId: 'widget123',
            type: 'PRIVACY_POLICY',
          },
        },
      })
      expect(
        prisma.widgetIntegrationFileAttachment.create
      ).toHaveBeenCalledWith({
        data: {
          widgetIntegrationId: 'widget123',
          type: 'PRIVACY_POLICY',
          fileId: 'file456',
        },
      })
    })

    it('should support all attachment types', async () => {
      const mockWidget = { id: 'widget123', userId: 'user123' }
      const mockFile = { id: 'file123', userId: 'user123' }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )
      prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)
      prisma.widgetIntegrationFileAttachment.findUnique.mockResolvedValue(null)

      const types = ['PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'INSTRUCTIONS']

      for (const type of types) {
        jest.clearAllMocks()

        prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
          mockWidget
        )
        prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)
        prisma.widgetIntegrationFileAttachment.findUnique.mockResolvedValue(
          null
        )
        prisma.widgetIntegrationFileAttachment.create.mockResolvedValue({
          widgetIntegrationId: 'widget123',
          type,
          fileId: 'file123',
        })

        const req = mockReq('widget123', 'file123')
        const body = mockBody(type)
        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)
        expect(result.body.type).toBe(type)
      }
    })
  })

  describe('error handling', () => {
    it('should return 404 when widget integration not found', async () => {
      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = mockReq('nonexistent', 'file123')
      const body = mockBody('PRIVACY_POLICY')
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(
        prisma.widgetIntegrationFileAttachment.create
      ).not.toHaveBeenCalled()
    })

    it('should return 403 when widget integration user does not match', async () => {
      const mockWidget = {
        id: 'widget123',
        userId: 'otherUser',
      }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )

      const req = mockReq('widget123', 'file123')
      const body = mockBody('PRIVACY_POLICY')
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
      expect(prisma.file.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('should return 404 when file not found', async () => {
      const mockWidget = {
        id: 'widget123',
        userId: 'user123',
      }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )
      prisma.file.findUniqueByIdentifier.mockResolvedValue(null)

      const req = mockReq('widget123', 'nonexistent')
      const body = mockBody('PRIVACY_POLICY')
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(
        prisma.widgetIntegrationFileAttachment.create
      ).not.toHaveBeenCalled()
    })

    it('should return 403 when file user does not match', async () => {
      const mockWidget = {
        id: 'widget123',
        userId: 'user123',
      }

      const mockFile = {
        id: 'file123',
        userId: 'otherUser',
      }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )
      prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)

      const req = mockReq('widget123', 'file123')
      const body = mockBody('PRIVACY_POLICY')
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
      expect(
        prisma.widgetIntegrationFileAttachment.create
      ).not.toHaveBeenCalled()
    })

    it('should handle database errors during create', async () => {
      const mockWidget = { id: 'widget123', userId: 'user123' }
      const mockFile = { id: 'file123', userId: 'user123' }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )
      prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)
      prisma.widgetIntegrationFileAttachment.findUnique.mockResolvedValue(null)
      prisma.widgetIntegrationFileAttachment.create.mockRejectedValue(
        new Error('Database error')
      )

      const req = mockReq('widget123', 'file123')
      const body = mockBody('PRIVACY_POLICY')

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Database error'
      )
    })

    it('should handle error during existing attachment deletion', async () => {
      const mockWidget = { id: 'widget123', userId: 'user123' }
      const mockFile = { id: 'file123', userId: 'user123' }
      const existingAttachment = {
        widgetIntegrationId: 'widget123',
        type: 'PRIVACY_POLICY',
        fileId: 'file999',
      }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )
      prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)
      prisma.widgetIntegrationFileAttachment.findUnique.mockResolvedValue(
        existingAttachment
      )
      prisma.widgetIntegrationFileAttachment.delete.mockRejectedValue(
        new Error('Delete failed')
      )

      const req = mockReq('widget123', 'file123')
      const body = mockBody('PRIVACY_POLICY')

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Delete failed'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle missing widgetIntegrationId parameter', async () => {
      const req = mockReq(undefined, 'file123')
      const body = mockBody('PRIVACY_POLICY')

      await expect(handler(req, mockSession, body)).rejects.toThrow()
    })

    it('should handle missing fileId parameter', async () => {
      const req = mockReq('widget123', undefined)
      const body = mockBody('PRIVACY_POLICY')

      await expect(handler(req, mockSession, body)).rejects.toThrow()
    })

    it('should handle special characters in IDs', async () => {
      const mockWidget = {
        id: 'widget-special_123',
        userId: 'user123',
      }

      const mockFile = {
        id: 'file-special_456',
        userId: 'user123',
      }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )
      prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)
      prisma.widgetIntegrationFileAttachment.findUnique.mockResolvedValue(null)
      prisma.widgetIntegrationFileAttachment.create.mockResolvedValue({
        widgetIntegrationId: 'widget-special_123',
        type: 'PRIVACY_POLICY',
        fileId: 'file-special_456',
      })

      const req = mockReq('widget-special_123', 'file-special_456')
      const body = mockBody('PRIVACY_POLICY')
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.widgetIntegrationId).toBe('widget-special_123')
      expect(result.body.id).toBe('file-special_456')
    })
  })

  describe('authorization', () => {
    it('should only allow owner to attach files', async () => {
      const mockWidget = {
        id: 'widget123',
        userId: 'differentUser',
      }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )

      const req = mockReq('widget123', 'file123')
      const body = mockBody('PRIVACY_POLICY')
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
    })

    it('should successfully attach when both widget and file belong to user', async () => {
      const mockWidget = {
        id: 'widget123',
        userId: 'user123',
      }

      const mockFile = {
        id: 'file123',
        userId: 'user123',
      }

      prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockWidget
      )
      prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)
      prisma.widgetIntegrationFileAttachment.findUnique.mockResolvedValue(null)
      prisma.widgetIntegrationFileAttachment.create.mockResolvedValue({
        widgetIntegrationId: 'widget123',
        type: 'PRIVACY_POLICY',
        fileId: 'file123',
      })

      const req = mockReq('widget123', 'file123')
      const body = mockBody('PRIVACY_POLICY')
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(
        prisma.widgetIntegrationFileAttachment.create
      ).toHaveBeenCalledTimes(1)
    })
  })
})
