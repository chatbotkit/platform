/**
 * @jest-environment node
 */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

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
  getFieldQueryFilter: jest.fn(() => []),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/space/list', () => {
  const mockSession = {
    user: {
      id: 'user_test123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should list spaces for authenticated user', async () => {
      const mockSpaces = [
        {
          id: 'space_1',
          name: 'Space One',
          description: 'First space',
          blueprintId: null,
          contactId: null,
          meta: null,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
        {
          id: 'space_2',
          alias: 'space-two',
          name: 'Space Two',
          description: 'Second space',
          blueprintId: 'blueprint_123',
          contactId: 'contact_456',
          meta: { key: 'value' },
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02'),
        },
      ]

      prisma.space.findMany.mockResolvedValue(mockSpaces)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('space_1')
      expect(result.items[1].id).toBe('space_2')
      expect(prisma.space.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user_test123' }]),
          }),
        })
      )
    })

    it('should return empty array when no spaces exist', async () => {
      prisma.space.findMany.mockResolvedValue([])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual([])
    })

    it('should include all space fields in response', async () => {
      const mockSpace = {
        id: 'space_full',
        alias: 'space-full',
        name: 'Full Space',
        description: 'Complete data',
        blueprintId: 'blueprint_abc',
        contactId: 'contact_xyz',
        meta: { department: 'sales' },
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-16'),
      }

      prisma.space.findMany.mockResolvedValue([mockSpace])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items[0]).toMatchObject({
        id: 'space_full',
        alias: 'space-full',
        name: 'Full Space',
        description: 'Complete data',
        blueprintId: 'blueprint_abc',
        contactId: 'contact_xyz',
        meta: { department: 'sales' },
      })
      expect(result.items[0].createdAt).toBeDefined()
      expect(result.items[0].updatedAt).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle spaces with null fields', async () => {
      const mockSpace = {
        id: 'space_nulls',
        name: 'Minimal Space',
        description: '',
        blueprintId: null,
        contactId: null,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.space.findMany.mockResolvedValue([mockSpace])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items[0].blueprintId).toBeNull()
      expect(result.items[0].contactId).toBeNull()
      expect(result.items[0].meta).toBeNull()
    })

    it('should handle spaces with complex meta', async () => {
      const mockSpace = {
        id: 'space_meta',
        name: 'Meta Space',
        description: 'Space with complex metadata',
        blueprintId: null,
        contactId: null,
        meta: {
          department: 'sales',
          tags: ['important', 'urgent'],
          nested: { key: 'value' },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.space.findMany.mockResolvedValue([mockSpace])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items[0].meta).toEqual({
        department: 'sales',
        tags: ['important', 'urgent'],
        nested: { key: 'value' },
      })
    })
  })

  describe('error handling', () => {
    it('should handle database errors', async () => {
      prisma.space.findMany.mockRejectedValue(new Error('Database error'))

      await expect(handler(null, {}, null, mockSession)).rejects.toThrow(
        'Database error'
      )
    })
  })

  describe('response format', () => {
    it('should return items array', async () => {
      prisma.space.findMany.mockResolvedValue([])

      const result = await handler(null, {}, null, mockSession)

      expect(result).toHaveProperty('items')
      expect(Array.isArray(result.items)).toBe(true)
    })
  })
})
