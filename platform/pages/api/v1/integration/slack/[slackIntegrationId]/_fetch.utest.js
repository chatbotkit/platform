/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from '@/pages/api/v1/integration/slack/[slackIntegrationId]/fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

describe('GET /api/v1/integration/slack/[slackIntegrationId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should fetch slack integration successfully', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        name: 'Test Slack',
        description: 'Test description',
        userId: 'user-123',
        blueprintId: 'blueprint-456',
        botId: 'bot-789',
        signingSecret: 'signing-secret-abc',
        botToken: 'xoxb-bot-token-secret',
        userToken: 'xoxp-user-token-secret',
        contactCollection: true,
        sessionDuration: 3600000,
        references: true,
        ratings: true,
        visibleMessages: 10,
        autoRespond: '@all',
        meta: { key: 'value' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('id', 'slack-123')
      expect(data).toHaveProperty('name', 'Test Slack')
      expect(data).toHaveProperty('signingSecret', '********')
      expect(data).toHaveProperty('botToken', '********')
      expect(data).toHaveProperty('userToken', '********')
      expect(data).toHaveProperty('contactCollection', true)
      expect(data).toHaveProperty('references', true)
      expect(data).toHaveProperty('ratings', true)
      expect(data).toHaveProperty('visibleMessages', 10)
      expect(data).not.toHaveProperty('userId')
    })

    it('should return null tokens when not configured', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        name: 'Test Slack',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        signingSecret: null,
        botToken: null,
        userToken: null,
        contactCollection: false,
        sessionDuration: 3600000,
        references: false,
        ratings: false,
        visibleMessages: 0,
        autoRespond: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      const data = await result.json()

      expect(data).toHaveProperty('signingSecret', null)
      expect(data).toHaveProperty('botToken', null)
      expect(data).toHaveProperty('userToken', null)
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockSlackIntegration = {
        id: 'slack-456',
        name: 'Test',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        signingSecret: 'secret',
        botToken: 'token',
        userToken: 'utoken',
        contactCollection: false,
        sessionDuration: 3600000,
        references: false,
        ratings: false,
        visibleMessages: 5,
        autoRespond: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-456' },
      }

      await handler(req, mockSession)

      expect(
        prisma.slackIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'slack-456', {
        select: {
          id: true,
          alias: true,
          name: true,
          description: true,
          userId: true,
          blueprintId: true,
          botId: true,
          signingSecret: true,
          botToken: true,
          userToken: true,
          contactCollection: true,
          sessionDuration: true,
          references: true,
          ratings: true,
          visibleMessages: true,
          autoRespond: true,
          allowFrom: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    })
  })

  describe('error handling', () => {
    it('should return 404 when slack integration not found', async () => {
      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { slackIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user does not own the slack integration', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        name: 'Test',
        description: '',
        userId: 'other-user-456',
        blueprintId: null,
        botId: 'bot-789',
        signingSecret: 'secret',
        botToken: 'token',
        userToken: null,
        contactCollection: false,
        sessionDuration: 3600000,
        references: false,
        ratings: false,
        visibleMessages: 0,
        autoRespond: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should handle database query errors', async () => {
      prisma.slackIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })
  })

  describe('edge cases', () => {
    it('should handle slack integration with all optional fields null', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        name: '',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: null,
        signingSecret: null,
        botToken: null,
        userToken: null,
        contactCollection: false,
        sessionDuration: null,
        references: false,
        ratings: false,
        visibleMessages: 0,
        autoRespond: null,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('id')
      expect(data).not.toHaveProperty('userId')
    })

    it('should handle slack integration with special characters in ID', async () => {
      const mockSlackIntegration = {
        id: 'slack-abc_123-xyz',
        name: 'Test',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        signingSecret: 'secret',
        botToken: 'token',
        userToken: null,
        contactCollection: true,
        sessionDuration: 3600000,
        references: true,
        ratings: true,
        visibleMessages: 5,
        autoRespond: '@agent handle all',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-abc_123-xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('id', 'slack-abc_123-xyz')
    })

    it('should handle partial token configuration', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        name: 'Test',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        signingSecret: 'secret-abc',
        botToken: 'bot-token-xyz',
        userToken: null,
        contactCollection: false,
        sessionDuration: 3600000,
        references: false,
        ratings: false,
        visibleMessages: 0,
        autoRespond: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      const data = await result.json()

      expect(data.signingSecret).toBe('********')
      expect(data.botToken).toBe('********')
      expect(data.userToken).toBeNull()
    })
  })

  describe('data sanitization', () => {
    it('should mask all credential fields when present', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        name: 'Test',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        signingSecret: 'very-secret-signing-key-12345',
        botToken: 'xoxb-very-secret-bot-token-67890',
        userToken: 'xoxp-very-secret-user-token-abcde',
        contactCollection: false,
        sessionDuration: 3600000,
        references: false,
        ratings: false,
        visibleMessages: 0,
        autoRespond: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      const data = await result.json()

      expect(data.signingSecret).toBe('********')
      expect(data.signingSecret).not.toBe('very-secret-signing-key-12345')
      expect(data.botToken).toBe('********')
      expect(data.botToken).not.toBe('xoxb-very-secret-bot-token-67890')
      expect(data.userToken).toBe('********')
      expect(data.userToken).not.toBe('xoxp-very-secret-user-token-abcde')
    })

    it('should remove userId from response', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        name: 'Test',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        signingSecret: 'secret',
        botToken: 'token',
        userToken: null,
        contactCollection: false,
        sessionDuration: 3600000,
        references: false,
        ratings: false,
        visibleMessages: 0,
        autoRespond: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      const data = await result.json()

      expect(data).not.toHaveProperty('userId')
    })
  })

  describe('feature flags', () => {
    it('should correctly return all feature flag states', async () => {
      const mockSlackIntegration = {
        id: 'slack-123',
        name: 'Test',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        botId: 'bot-789',
        signingSecret: 'secret',
        botToken: 'token',
        userToken: null,
        contactCollection: true,
        sessionDuration: 3600000,
        references: true,
        ratings: true,
        visibleMessages: 8,
        autoRespond: '@agent custom instructions',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockSlackIntegration
      )

      const req = {
        query: { slackIntegrationId: 'slack-123' },
      }

      const result = await handler(req, mockSession)

      const data = await result.json()

      expect(data.contactCollection).toBe(true)
      expect(data.references).toBe(true)
      expect(data.ratings).toBe(true)
      expect(data.visibleMessages).toBe(8)
      expect(data.autoRespond).toBe('@agent custom instructions')
    })
  })
})
