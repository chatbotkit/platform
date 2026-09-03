/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

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

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/filter', () => ({
  getMetaQueryFilter: jest.fn(() => []),
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getMetaQueryFilter,
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('/api/v1/integration/discord/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  describe('basic functionality', () => {
    it('should list all Discord integrations for user', async () => {
      const mockIntegrations = [
        {
          id: 'dis_1',
          name: 'Support Bot',
          description: 'Customer support bot',
          blueprintId: 'bp_123',
          botId: 'bot_456',
          appId: '1234567890',
          handle: 'support',
          contactCollection: true,
          sessionDuration: 3600000,
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'dis_2',
          name: 'Sales Bot',
          description: 'Sales assistant',
          blueprintId: null,
          botId: 'bot_789',
          appId: '9876543210',
          handle: 'sales',
          contactCollection: false,
          sessionDuration: null,
          meta: { environment: 'production' },
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      prisma.discordIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual(mockIntegrations)
      expect(prisma.discordIntegration.findMany).toHaveBeenCalledWith({
        where: {
          AND: [{ userId: 'user_123' }],
        },
        select: {
          id: true,
          alias: true,
          name: true,
          description: true,
          blueprintId: true,
          botId: true,
          appId: true,
          handle: true,
          contactCollection: true,
          sessionDuration: true,
          allowFrom: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    })

    it('should return empty array when no integrations exist', async () => {
      prisma.discordIntegration.findMany.mockResolvedValue([])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual([])
      expect(prisma.discordIntegration.findMany).toHaveBeenCalled()
    })
  })

  describe('filtering', () => {
    it('should filter by blueprintId', async () => {
      const mockIntegrations = [
        {
          id: 'dis_1',
          name: 'Blueprint Bot',
          description: 'Bot with blueprint',
          blueprintId: 'bp_123',
          botId: 'bot_456',
          appId: '1234567890',
          handle: 'bot1',
          contactCollection: false,
          sessionDuration: null,
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_123' }])

      prisma.discordIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual(mockIntegrations)
      expect(prisma.discordIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ userId: 'user_123' }, { blueprintId: 'bp_123' }],
          },
        })
      )
    })

    it('should filter by meta', async () => {
      const mockIntegrations = [
        {
          id: 'dis_1',
          name: 'Production Bot',
          description: 'Production environment',
          blueprintId: null,
          botId: 'bot_123',
          appId: '1234567890',
          handle: 'prod',
          contactCollection: false,
          sessionDuration: null,
          meta: { environment: 'production' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      getMetaQueryFilter.mockReturnValue([{ 'meta.environment': 'production' }])

      prisma.discordIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual(mockIntegrations)
      expect(prisma.discordIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ userId: 'user_123' }, { 'meta.environment': 'production' }],
          },
        })
      )
    })

    it('should filter by both blueprintId and meta', async () => {
      const mockIntegrations = [
        {
          id: 'dis_1',
          name: 'Filtered Bot',
          description: 'Filtered by multiple criteria',
          blueprintId: 'bp_123',
          botId: 'bot_456',
          appId: '1234567890',
          handle: 'filtered',
          contactCollection: true,
          sessionDuration: 3600000,
          meta: { tag: 'test' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_123' }])
      getMetaQueryFilter.mockReturnValue([{ 'meta.tag': 'test' }])

      prisma.discordIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual(mockIntegrations)
      expect(prisma.discordIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_123' },
              { 'meta.tag': 'test' },
              { blueprintId: 'bp_123' },
            ],
          },
        })
      )
    })
  })

  describe('pagination', () => {
    it('should apply cursor constraints', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'dis_123' },
        skip: 1,
      })

      prisma.discordIntegration.findMany.mockResolvedValue([])

      await handler('dis_123', {}, null, mockSession)

      expect(prisma.discordIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'dis_123' },
          skip: 1,
        })
      )
    })

    it('should apply take constraints', async () => {
      getTakeConstraints.mockReturnValue({ take: 10 })

      prisma.discordIntegration.findMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      expect(prisma.discordIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      )
    })

    it('should apply both cursor and take constraints', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'dis_100' },
        skip: 1,
      })
      getTakeConstraints.mockReturnValue({ take: 20 })

      prisma.discordIntegration.findMany.mockResolvedValue([])

      await handler('dis_100', {}, null, mockSession)

      expect(prisma.discordIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'dis_100' },
          skip: 1,
          take: 20,
        })
      )
    })
  })

  describe('security', () => {
    it('should not expose botToken in response', async () => {
      const mockIntegrations = [
        {
          id: 'dis_1',
          name: 'Secure Bot',
          description: 'Should not leak credentials',
          blueprintId: null,
          botId: 'bot_123',
          appId: '1234567890',
          handle: 'secure',
          contactCollection: false,
          sessionDuration: null,
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      prisma.discordIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items[0]).not.toHaveProperty('botToken')
      expect(prisma.discordIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.not.objectContaining({
            botToken: true,
          }),
        })
      )
    })

    it('should not expose publicKey in response', async () => {
      const mockIntegrations = [
        {
          id: 'dis_1',
          name: 'Secure Bot',
          description: 'Should not leak credentials',
          blueprintId: null,
          botId: 'bot_123',
          appId: '1234567890',
          handle: 'secure',
          contactCollection: false,
          sessionDuration: null,
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      prisma.discordIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items[0]).not.toHaveProperty('publicKey')
      expect(prisma.discordIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.not.objectContaining({
            publicKey: true,
          }),
        })
      )
    })

    it('should only return integrations for authenticated user', async () => {
      prisma.discordIntegration.findMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      expect(prisma.discordIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user_123' }]),
          }),
        })
      )
    })
  })

  describe('edge cases', () => {
    it('should handle null values in integration fields', async () => {
      const mockIntegrations = [
        {
          id: 'dis_1',
          name: 'Minimal Bot',
          description: 'With null fields',
          blueprintId: null,
          botId: 'bot_123',
          appId: null,
          handle: null,
          contactCollection: false,
          sessionDuration: null,
          meta: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      prisma.discordIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual(mockIntegrations)
    })

    it('should handle empty meta object', async () => {
      const mockIntegrations = [
        {
          id: 'dis_1',
          name: 'Empty Meta Bot',
          description: 'With empty meta',
          blueprintId: null,
          botId: 'bot_123',
          appId: '1234567890',
          handle: 'bot1',
          contactCollection: false,
          sessionDuration: null,
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      prisma.discordIntegration.findMany.mockResolvedValue(mockIntegrations)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items[0].meta).toEqual({})
    })
  })
})
