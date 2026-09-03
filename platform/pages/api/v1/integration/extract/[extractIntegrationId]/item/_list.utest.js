/**
 * @jest-environment node
 */
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
  withStreamCursor: (fn) => (req, _stream, session) =>
    fn(null, req, _stream, session),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: (req, param) => req.query[param],
}))

jest.mock('@/lib/filter', () => ({
  getCursorConstraints: () => ({}),
  getTakeConstraints: () => ({ take: 100 }),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: () => {
    throw new Error('Not found')
  },
  throwNotAuthorized: () => {
    throw new Error('Not authorized')
  },
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

describe('/api/v1/integration/extract/[extractIntegrationId]/item/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should list extract integration items', async () => {
      const mockExtractIntegration = {
        id: 'extract_123',
        userId: 'user_123',
      }

      const mockItems = [
        {
          id: 'item_1',
          extractIntegrationId: 'extract_123',
          conversationId: 'conv_1',
          data: { field: 'value1' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'item_2',
          extractIntegrationId: 'extract_123',
          conversationId: 'conv_2',
          data: { field: 'value2' },
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockExtractIntegration
      )
      prisma.extractIntegrationItem.findMany.mockResolvedValue(mockItems)

      const req = {
        query: {
          extractIntegrationId: 'extract_123',
        },
      }

      const result = await handler(req, null, mockSession)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('item_1')
      expect(result.items[1].id).toBe('item_2')

      expect(
        prisma.extractIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'extract_123', {
        select: {
          id: true,
          userId: true,
        },
      })

      expect(prisma.extractIntegrationItem.findMany).toHaveBeenCalledWith({
        where: {
          extractIntegrationId: 'extract_123',
        },
        take: 100,
        select: {
          id: true,
          extractIntegrationId: true,
          conversationId: true,
          data: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    })

    it('should return empty array when no items found', async () => {
      const mockExtractIntegration = {
        id: 'extract_123',
        userId: 'user_123',
      }

      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockExtractIntegration
      )
      prisma.extractIntegrationItem.findMany.mockResolvedValue([])

      const req = {
        query: {
          extractIntegrationId: 'extract_123',
        },
      }

      const result = await handler(req, null, mockSession)

      expect(result.items).toHaveLength(0)
    })
  })

  describe('error handling', () => {
    it('should throw not found when extract integration does not exist', async () => {
      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: {
          extractIntegrationId: 'extract_123',
        },
      }

      await expect(handler(req, null, mockSession)).rejects.toThrow('Not found')

      expect(prisma.extractIntegrationItem.findMany).not.toHaveBeenCalled()
    })

    it('should throw not authorized when user does not own extract integration', async () => {
      const mockExtractIntegration = {
        id: 'extract_123',
        userId: 'other_user',
      }

      prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockExtractIntegration
      )

      const req = {
        query: {
          extractIntegrationId: 'extract_123',
        },
      }

      await expect(handler(req, null, mockSession)).rejects.toThrow(
        'Not authorized'
      )

      expect(prisma.extractIntegrationItem.findMany).not.toHaveBeenCalled()
    })
  })
})
