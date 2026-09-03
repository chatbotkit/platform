/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prismaMock from '@/prisma/client'

import {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'

import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => fn,
}))

jest.mock('@/lib/filter', () => ({
  getMetaQueryFilter: jest.fn(() => []),
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({ take: 25 })),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

const prisma = prismaMock

describe('/api/v1/integration/slack/list', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({
    query: {},
  })

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('retrieves list of slack integrations for the user', async () => {
      const mockIntegrations = [
        {
          id: 'slack-1',
          alias: 'main',
          name: 'Main Slack Bot',
          description: 'Primary bot',
          blueprintId: 'bp-1',
          botId: 'bot-1',
          signingSecret: null,
          botToken: null,
          userToken: null,
          contactCollection: true,
          sessionDuration: 3600000,
          references: true,
          ratings: true,
          visibleMessages: 10,
          autoRespond: null,
          allowFrom: '*',
          meta: {},
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items).toEqual(mockIntegrations)
    })

    it('filters by current user id', async () => {
      prisma.slackIntegration.findMany.mockResolvedValue([])

      await handler(null, makeReq(), null, mockSession)

      expect(prisma.slackIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user-123' }]),
          }),
        })
      )
    })

    it('selects correct fields from database', async () => {
      prisma.slackIntegration.findMany.mockResolvedValue([])

      await handler(null, makeReq(), null, mockSession)

      const callArgs = prisma.slackIntegration.findMany.mock.calls[0][0]

      expect(callArgs.select).toMatchObject({
        id: true,
        alias: true,
        name: true,
        description: true,
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
      })
    })
  })

  describe('credential masking', () => {
    it('masks signingSecret when present', async () => {
      const mockIntegrations = [
        {
          id: 'slack-1',
          alias: 'main',
          name: 'Main Slack Bot',
          description: 'Primary bot',
          blueprintId: null,
          botId: 'bot-1',
          signingSecret: 'secret-xyz',
          botToken: null,
          userToken: null,
          contactCollection: false,
          sessionDuration: null,
          references: false,
          ratings: false,
          visibleMessages: 0,
          autoRespond: null,
          allowFrom: null,
          meta: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items[0].signingSecret).toBe('********')
    })

    it('masks botToken when present', async () => {
      const mockIntegrations = [
        {
          id: 'slack-1',
          alias: 'main',
          name: 'Main Slack Bot',
          description: 'Primary bot',
          blueprintId: null,
          botId: 'bot-1',
          signingSecret: null,
          botToken: 'xoxb-token-abc',
          userToken: null,
          contactCollection: false,
          sessionDuration: null,
          references: false,
          ratings: false,
          visibleMessages: 0,
          autoRespond: null,
          allowFrom: null,
          meta: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items[0].botToken).toBe('********')
    })

    it('masks userToken when present', async () => {
      const mockIntegrations = [
        {
          id: 'slack-1',
          alias: 'main',
          name: 'Main Slack Bot',
          description: 'Primary bot',
          blueprintId: null,
          botId: 'bot-1',
          signingSecret: null,
          botToken: null,
          userToken: 'xoxp-token-xyz',
          contactCollection: false,
          sessionDuration: null,
          references: false,
          ratings: false,
          visibleMessages: 0,
          autoRespond: null,
          allowFrom: null,
          meta: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items[0].userToken).toBe('********')
    })

    it('masks all three tokens when all present', async () => {
      const mockIntegrations = [
        {
          id: 'slack-1',
          alias: 'main',
          name: 'Main Slack Bot',
          description: 'Primary bot',
          blueprintId: null,
          botId: 'bot-1',
          signingSecret: 'secret-123',
          botToken: 'xoxb-token-456',
          userToken: 'xoxp-token-789',
          contactCollection: true,
          sessionDuration: 1800000,
          references: true,
          ratings: true,
          visibleMessages: 5,
          autoRespond: '@all',
          allowFrom: '@user1',
          meta: { team: 'support' },
          createdAt: new Date('2025-01-15'),
          updatedAt: new Date('2025-01-20'),
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items[0].signingSecret).toBe('********')
      expect(result.items[0].botToken).toBe('********')
      expect(result.items[0].userToken).toBe('********')
    })

    it('preserves null tokens without masking', async () => {
      const mockIntegrations = [
        {
          id: 'slack-1',
          alias: 'main',
          name: 'Main Slack Bot',
          description: 'Primary bot',
          blueprintId: null,
          botId: 'bot-1',
          signingSecret: null,
          botToken: null,
          userToken: null,
          contactCollection: false,
          sessionDuration: null,
          references: false,
          ratings: false,
          visibleMessages: 0,
          autoRespond: null,
          allowFrom: null,
          meta: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items[0].signingSecret).toBeNull()
      expect(result.items[0].botToken).toBeNull()
      expect(result.items[0].userToken).toBeNull()
    })
  })

  describe('pagination and filtering', () => {
    it('applies take constraints', async () => {
      prisma.slackIntegration.findMany.mockResolvedValue([])

      await handler(null, makeReq(), null, mockSession)

      expect(getTakeConstraints).toHaveBeenCalledWith(makeReq())
    })

    it('applies cursor constraints', async () => {
      prisma.slackIntegration.findMany.mockResolvedValue([])

      await handler(null, makeReq(), null, mockSession)

      expect(getCursorConstraints).toHaveBeenCalled()
    })

    it('applies meta filter', async () => {
      prisma.slackIntegration.findMany.mockResolvedValue([])

      await handler(null, makeReq(), null, mockSession)

      expect(getMetaQueryFilter).toHaveBeenCalledWith(makeReq())
    })

    it('applies blueprint id filter', async () => {
      prisma.slackIntegration.findMany.mockResolvedValue([])

      await handler(null, makeReq(), null, mockSession)

      expect(getBlueprintIdQueryFilter).toHaveBeenCalledWith(makeReq())
    })
  })

  describe('empty results', () => {
    it('returns empty items array when no integrations found', async () => {
      prisma.slackIntegration.findMany.mockResolvedValue([])

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items).toEqual([])
    })

    it('still applies filters for empty results', async () => {
      prisma.slackIntegration.findMany.mockResolvedValue([])

      await handler(null, makeReq(), null, mockSession)

      expect(prisma.slackIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.any(Array),
          }),
        })
      )
    })
  })

  describe('multiple integrations', () => {
    it('masks credentials for multiple integrations', async () => {
      const mockIntegrations = [
        {
          id: 'slack-1',
          alias: 'main',
          name: 'Main',
          description: 'Main bot',
          blueprintId: null,
          botId: 'bot-1',
          signingSecret: 'secret-1',
          botToken: 'token-1',
          userToken: null,
          contactCollection: false,
          sessionDuration: null,
          references: false,
          ratings: false,
          visibleMessages: 0,
          autoRespond: null,
          allowFrom: null,
          meta: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'slack-2',
          alias: 'backup',
          name: 'Backup',
          description: 'Backup bot',
          blueprintId: null,
          botId: 'bot-2',
          signingSecret: 'secret-2',
          botToken: null,
          userToken: 'token-2',
          contactCollection: false,
          sessionDuration: null,
          references: false,
          ratings: false,
          visibleMessages: 0,
          autoRespond: null,
          allowFrom: null,
          meta: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].signingSecret).toBe('********')
      expect(result.items[0].botToken).toBe('********')
      expect(result.items[1].signingSecret).toBe('********')
      expect(result.items[1].userToken).toBe('********')
    })
  })

  describe('complex field data', () => {
    it('preserves complex meta objects', async () => {
      const complexMeta = {
        version: '2.0',
        features: ['ai', 'search'],
        config: { maxItems: 1000 },
        nested: { deep: { value: 'test' } },
      }

      const mockIntegrations = [
        {
          id: 'slack-1',
          alias: 'main',
          name: 'Main',
          description: 'Main bot',
          blueprintId: null,
          botId: 'bot-1',
          signingSecret: null,
          botToken: null,
          userToken: null,
          contactCollection: false,
          sessionDuration: null,
          references: false,
          ratings: false,
          visibleMessages: 0,
          autoRespond: null,
          allowFrom: null,
          meta: complexMeta,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items[0].meta).toEqual(complexMeta)
    })

    it('preserves multiline allowFrom patterns', async () => {
      const allowFromPatterns = '@user1\n@user2\n#channel1\nC123456789\n*'

      const mockIntegrations = [
        {
          id: 'slack-1',
          alias: 'main',
          name: 'Main',
          description: 'Main bot',
          blueprintId: null,
          botId: 'bot-1',
          signingSecret: null,
          botToken: null,
          userToken: null,
          contactCollection: false,
          sessionDuration: null,
          references: false,
          ratings: false,
          visibleMessages: 0,
          autoRespond: null,
          allowFrom: allowFromPatterns,
          meta: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items[0].allowFrom).toBe(allowFromPatterns)
    })

    it('preserves timestamps in createdAt and updatedAt', async () => {
      const createdAt = new Date('2025-01-01T10:30:00Z')
      const updatedAt = new Date('2025-01-15T14:20:00Z')

      const mockIntegrations = [
        {
          id: 'slack-1',
          alias: 'main',
          name: 'Main',
          description: 'Main bot',
          blueprintId: null,
          botId: 'bot-1',
          signingSecret: null,
          botToken: null,
          userToken: null,
          contactCollection: false,
          sessionDuration: null,
          references: false,
          ratings: false,
          visibleMessages: 0,
          autoRespond: null,
          allowFrom: null,
          meta: null,
          createdAt,
          updatedAt,
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items[0].createdAt).toEqual(createdAt)
      expect(result.items[0].updatedAt).toEqual(updatedAt)
    })
  })

  describe('access control', () => {
    it('only returns integrations for the authenticated user', async () => {
      prisma.slackIntegration.findMany.mockResolvedValue([])

      await handler(null, makeReq(), null, mockSession)

      const callArgs = prisma.slackIntegration.findMany.mock.calls[0][0]

      expect(callArgs.where.AND).toContainEqual({ userId: 'user-123' })
    })

    it('does not allow user to see other users integrations', async () => {
      const otherUserIntegrations = [
        {
          id: 'slack-other',
          userId: 'user-456',
          name: 'Other User Bot',
        },
      ]

      prisma.slackIntegration.findMany.mockResolvedValue(otherUserIntegrations)

      await handler(null, makeReq(), null, mockSession)

      // Should be called with user-123 filter (from mockSession)
      const callArgs = prisma.slackIntegration.findMany.mock.calls[0][0]

      expect(callArgs.where.AND).toContainEqual({ userId: 'user-123' })
    })
  })
})
