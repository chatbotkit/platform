/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './export'

import { createMocks } from 'node-mocks-http'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@prisma/client', () => ({
  // Mock any enums if needed
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => async (req) => {
    const mockStream = {
      acceptFormat: 'json',
      hasResult: false,
      push: jest.fn(),
      error: jest.fn(),
      result: jest.fn(),
      nop: jest.fn(),
    }

    // Call the handler with cursor undefined
    const result = await fn(undefined, req, mockStream, {
      user: { id: 'test-user-id' },
    })

    // Return response in expected format
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  },
}))

jest.mock('@/lib/filter', () => ({
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({ take: 100 })),
  getMetaQueryFilter: jest.fn(() => []),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('pages/api/v1/rating/export', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should export ratings for authenticated user', async () => {
      const mockRatings = [
        {
          id: 'rating-1',
          name: 'Rating 1',
          description: 'First rating',
          contactId: 'contact-1',
          botId: 'bot-1',
          conversationId: 'conv-1',
          messageId: 'msg-1',
          value: 5,
          reason: 'Great experience',
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'rating-2',
          name: 'Rating 2',
          description: 'Second rating',
          contactId: 'contact-2',
          botId: 'bot-2',
          conversationId: 'conv-2',
          messageId: 'msg-2',
          value: 1,
          reason: 'Poor experience',
          meta: { severity: 'high' },
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      prisma.rating.findMany.mockResolvedValue(mockRatings)

      const { req, res } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req, res)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.items).toHaveLength(2)
      expect(body.items[0].id).toBe('rating-1')
      expect(body.items[1].id).toBe('rating-2')
    })

    it('should filter ratings by user id', async () => {
      prisma.rating.findMany.mockResolvedValue([])

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      await handler(req)

      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                userId: 'test-user-id',
              }),
            ]),
          }),
        })
      )
    })

    it('should select all required rating fields', async () => {
      prisma.rating.findMany.mockResolvedValue([])

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      await handler(req)

      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            contactId: true,
            botId: true,
            conversationId: true,
            messageId: true,
            value: true,
            reason: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )
    })
  })

  describe('pagination', () => {
    it('should apply cursor constraints', async () => {
      const getCursorConstraints = require('@/lib/filter').getCursorConstraints

      getCursorConstraints.mockReturnValue({
        cursor: { id: 'cursor-id' },
        skip: 1,
      })

      prisma.rating.findMany.mockResolvedValue([])

      const { req } = createMocks({
        method: 'GET',
        query: { cursor: 'cursor-id' },
      })

      await handler(req)

      expect(getCursorConstraints).toHaveBeenCalled()
    })

    it('should apply take constraints', async () => {
      const getTakeConstraints = require('@/lib/filter').getTakeConstraints

      getTakeConstraints.mockReturnValue({ take: 50 })

      prisma.rating.findMany.mockResolvedValue([])

      const { req } = createMocks({
        method: 'GET',
        query: { take: '50' },
      })

      await handler(req)

      expect(getTakeConstraints).toHaveBeenCalled()
      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      )
    })
  })

  describe('filtering', () => {
    it('should apply metadata filters', async () => {
      const getMetaQueryFilter = require('@/lib/filter').getMetaQueryFilter

      getMetaQueryFilter.mockReturnValue([
        {
          meta: {
            path: ['severity'],
            equals: 'high',
          },
        },
      ])

      prisma.rating.findMany.mockResolvedValue([])

      const { req } = createMocks({
        method: 'GET',
        query: {
          'meta[severity]': 'high',
        },
      })

      await handler(req)

      expect(getMetaQueryFilter).toHaveBeenCalled()
      expect(prisma.rating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                meta: {
                  path: ['severity'],
                  equals: 'high',
                },
              }),
            ]),
          }),
        })
      )
    })
  })

  describe('response handling', () => {
    it('should return empty items array when no ratings', async () => {
      prisma.rating.findMany.mockResolvedValue([])

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req)
      const body = await response.json()

      expect(body.items).toEqual([])
    })

    it('should include all rating fields in response', async () => {
      const mockRating = {
        id: 'rating-1',
        name: 'Test Rating',
        description: 'Test description',
        contactId: 'contact-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        value: 4,
        reason: 'Good service',
        meta: { category: 'feedback' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.rating.findMany.mockResolvedValue([mockRating])

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req)
      const body = await response.json()

      expect(body.items[0]).toMatchObject({
        id: 'rating-1',
        name: 'Test Rating',
        description: 'Test description',
        contactId: 'contact-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        value: 4,
        reason: 'Good service',
        meta: { category: 'feedback' },
      })
    })

    it('should handle ratings with null optional fields', async () => {
      const mockRating = {
        id: 'rating-1',
        name: '',
        description: '',
        contactId: null,
        botId: 'bot-1',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        value: 3,
        reason: null,
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.rating.findMany.mockResolvedValue([mockRating])

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req)
      const body = await response.json()

      expect(body.items[0]).toMatchObject({
        id: 'rating-1',
        contactId: null,
        reason: null,
        meta: null,
      })
    })
  })

  describe('edge cases', () => {
    it('should handle large number of ratings', async () => {
      const mockRatings = Array.from({ length: 1000 }, (_, i) => ({
        id: `rating-${i}`,
        name: `Rating ${i}`,
        description: `Description ${i}`,
        contactId: `contact-${i}`,
        botId: `bot-${i}`,
        conversationId: `conv-${i}`,
        messageId: `msg-${i}`,
        value: (i % 5) + 1,
        reason: `Reason ${i}`,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      prisma.rating.findMany.mockResolvedValue(mockRatings)

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req)
      const body = await response.json()

      expect(body.items).toHaveLength(1000)
    })

    it('should handle ratings with complex metadata', async () => {
      const mockRating = {
        id: 'rating-1',
        name: 'Complex Rating',
        description: 'Rating with complex meta',
        contactId: 'contact-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        value: 5,
        reason: 'Excellent',
        meta: {
          tags: ['important', 'reviewed'],
          nested: {
            field: 'value',
            array: [1, 2, 3],
          },
          timestamp: '2024-01-01T00:00:00Z',
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.rating.findMany.mockResolvedValue([mockRating])

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req)
      const body = await response.json()

      expect(body.items[0].meta).toEqual({
        tags: ['important', 'reviewed'],
        nested: {
          field: 'value',
          array: [1, 2, 3],
        },
        timestamp: '2024-01-01T00:00:00Z',
      })
    })

    it('should handle database errors gracefully', async () => {
      prisma.rating.findMany.mockRejectedValue(
        new Error('Database connection failed')
      )

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      await expect(handler(req)).rejects.toThrow('Database connection failed')
    })
  })

  describe('rating value ranges', () => {
    it('should handle minimum rating value', async () => {
      const mockRating = {
        id: 'rating-1',
        name: 'Min Rating',
        description: 'Minimum value',
        contactId: 'contact-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        value: 1,
        reason: 'Poor',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.rating.findMany.mockResolvedValue([mockRating])

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req)
      const body = await response.json()

      expect(body.items[0].value).toBe(1)
    })

    it('should handle maximum rating value', async () => {
      const mockRating = {
        id: 'rating-1',
        name: 'Max Rating',
        description: 'Maximum value',
        contactId: 'contact-1',
        botId: 'bot-1',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        value: 5,
        reason: 'Excellent',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.rating.findMany.mockResolvedValue([mockRating])

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req)
      const body = await response.json()

      expect(body.items[0].value).toBe(5)
    })
  })

  describe('resource linking', () => {
    it('should export ratings with all resource links', async () => {
      const mockRating = {
        id: 'rating-1',
        name: 'Linked Rating',
        description: 'Rating with all links',
        contactId: 'contact-123',
        botId: 'bot-456',
        conversationId: 'conv-789',
        messageId: 'msg-012',
        value: 4,
        reason: 'Good',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.rating.findMany.mockResolvedValue([mockRating])

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req)
      const body = await response.json()

      expect(body.items[0]).toMatchObject({
        contactId: 'contact-123',
        botId: 'bot-456',
        conversationId: 'conv-789',
        messageId: 'msg-012',
      })
    })

    it('should handle ratings with partial resource links', async () => {
      const mockRating = {
        id: 'rating-1',
        name: 'Partial Links',
        description: 'Rating with some links',
        contactId: null,
        botId: 'bot-456',
        conversationId: null,
        messageId: 'msg-012',
        value: 3,
        reason: 'OK',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.rating.findMany.mockResolvedValue([mockRating])

      const { req } = createMocks({
        method: 'GET',
        query: {},
      })

      const response = await handler(req)
      const body = await response.json()

      expect(body.items[0]).toMatchObject({
        contactId: null,
        botId: 'bot-456',
        conversationId: null,
        messageId: 'msg-012',
      })
    })
  })
})
