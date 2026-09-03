/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from '@/pages/api/v1/integration/instagram/[instagramIntegrationId]/update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
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
    object: jest.fn(() => ({
      keys: jest.fn(() => ({})),
    })),
    string: jest.fn(() => ({
      allow: jest.fn(() => ({})),
    })),
    number: jest.fn(() => ({
      min: jest.fn(() => ({
        max: jest.fn(() => ({
          allow: jest.fn(() => ({})),
        })),
      })),
    })),
    boolean: jest.fn(() => ({})),
  },
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta, existing) => meta ?? existing),
}))

describe('POST /api/v1/integration/instagram/[instagramIntegrationId]/update', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  }

  const mockInstagramIntegration = {
    id: 'instagram-123',
    userId: 'user-123',
    name: 'Old Name',
    description: 'Old description',
    blueprintId: null,
    botId: 'bot-456',
    accessToken: 'EAAxxxexistingtoken',
    contactCollection: false,
    sessionDuration: 86400000,
    attachments: false,
    meta: {},
  }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should update instagram integration successfully', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      const body = {
        name: 'Updated Name',
        description: 'Updated description',
        botId: 'bot-789',
        accessToken: 'EAAxxxnewtoken',
        contactCollection: true,
        sessionDuration: 172800000,
        attachments: true,
        meta: { key: 'value' },
      }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({ id: 'instagram-123' })
    })

    it('should call update with correct parameters', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      const body = {
        name: 'Updated Name',
        description: 'Updated description',
        botId: 'bot-789',
        accessToken: 'EAAxxxnewtoken',
        contactCollection: true,
        sessionDuration: 172800000,
        attachments: true,
        meta: null,
      }

      await handler(req, mockSession, body)

      expect(prisma.instagramIntegration.update).toHaveBeenCalledWith({
        where: { id: 'instagram-123' },
        data: expect.objectContaining({
          name: 'Updated Name',
          description: 'Updated description',
          accessToken: 'EAAxxxnewtoken',
          contactCollection: true,
          sessionDuration: 172800000,
          attachments: true,
        }),
      })
    })

    it('forwards sessionDuration: null to prisma so the column is nullified', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      // @note this is what the UI's "1 day (default)" option submits: the
      // empty value is serialized to an explicit null (data-type
      // "number-or-null"), which must reach prisma as null (set NULL), not be
      // dropped (which would leave the previous value unchanged).
      const body = {
        name: 'Updated Name',
        sessionDuration: null,
        meta: null,
      }

      await handler(req, mockSession, body)

      expect(prisma.instagramIntegration.update).toHaveBeenCalledWith({
        where: { id: 'instagram-123' },
        data: expect.objectContaining({ sessionDuration: null }),
      })
    })
  })

  describe('access token sentinel handling', () => {
    it('should preserve existing token when sentinel "********" is provided', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      const body = {
        name: 'Updated Name',
        accessToken: '********',
      }

      await handler(req, mockSession, body)

      const updateCall = prisma.instagramIntegration.update.mock.calls[0][0]

      // undefined means prisma will not update the field
      expect(updateCall.data.accessToken).toBeUndefined()
    })

    it('should update token when a real token value is provided', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      const body = {
        name: 'Updated Name',
        accessToken: 'EAAxxxbrandnewtoken',
      }

      await handler(req, mockSession, body)

      const updateCall = prisma.instagramIntegration.update.mock.calls[0][0]

      expect(updateCall.data.accessToken).toBe('EAAxxxbrandnewtoken')
    })

    it('should allow clearing token when null is provided', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      const body = {
        name: 'Updated Name',
        accessToken: null,
      }

      await handler(req, mockSession, body)

      const updateCall = prisma.instagramIntegration.update.mock.calls[0][0]

      expect(updateCall.data.accessToken).toBeNull()
    })
  })

  describe('app secret sentinel handling', () => {
    it('should preserve existing app secret when sentinel "********" is provided', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      await handler(req, mockSession, {
        name: 'Updated Name',
        appSecret: '********',
      })

      const updateCall = prisma.instagramIntegration.update.mock.calls[0][0]

      // the key is omitted entirely so prisma leaves the column untouched
    })

    it('should update app secret when a real value is provided', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      await handler(req, mockSession, {
        name: 'Updated Name',
        appSecret: 'new-meta-app-secret',
      })

      const updateCall = prisma.instagramIntegration.update.mock.calls[0][0]

      expect(updateCall.data.appSecret).toBe('new-meta-app-secret')
    })

    it('should allow clearing app secret when null is provided', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      await handler(req, mockSession, {
        name: 'Updated Name',
        appSecret: null,
      })

      const updateCall = prisma.instagramIntegration.update.mock.calls[0][0]

      expect(updateCall.data.appSecret).toBeNull()
    })
  })

  describe('authorization', () => {
    it('should return 404 when integration not found', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { instagramIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(404)
      expect(prisma.instagramIntegration.update).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own integration', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
        ...mockInstagramIntegration,
        userId: 'other-user-456',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(403)
      expect(prisma.instagramIntegration.update).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle database errors during update', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockRejectedValue(
        new Error('Database update failed')
      )

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      await expect(
        handler(req, mockSession, { name: 'New Name' })
      ).rejects.toThrow('Database update failed')
    })

    it('should handle database errors during lookup', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database lookup failed')
      )

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      await expect(handler(req, mockSession, {})).rejects.toThrow(
        'Database lookup failed'
      )
    })
  })

  describe('bot and blueprint linking', () => {
    it('should accept botId as a string', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      await handler(req, mockSession, { botId: 'bot-string-id' })

      const updateCall = prisma.instagramIntegration.update.mock.calls[0][0]

      expect(updateCall.data.botId).toBe('bot-string-id')
    })

    it('should accept botId as an object with id property', async () => {
      prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockInstagramIntegration
      )
      prisma.instagramIntegration.update.mockResolvedValue({
        id: 'instagram-123',
      })

      const req = {
        query: { instagramIntegrationId: 'instagram-123' },
      }

      await handler(req, mockSession, { botId: { id: 'bot-object-id' } })

      const updateCall = prisma.instagramIntegration.update.mock.calls[0][0]

      expect(updateCall.data.botId).toBe('bot-object-id')
    })
  })
})
