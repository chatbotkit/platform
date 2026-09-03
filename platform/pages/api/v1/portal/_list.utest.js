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
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/filter', () => ({
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getMetaQueryFilter: jest.fn(() => []),
  getTakeConstraints: jest.fn(() => ({ take: 10 })),
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

describe('/api/v1/portal/list', () => {
  const mockSession = {
    user: {
      id: 'user-123',
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
    it('should list portals for authenticated user', async () => {
      const mockPortals = [
        {
          id: 'portal-1',
          name: 'Test Portal',
          description: 'Test description',
          blueprintId: 'blueprint-1',
          slug: 'test-portal',
          config: { theme: 'dark' },
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'portal-2',
          name: 'Another Portal',
          description: 'Another description',
          blueprintId: null,
          slug: 'another-portal',
          config: {},
          meta: { key: 'value' },
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
        },
      ]

      prisma.portal.findMany.mockResolvedValue(mockPortals)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('portal-1')
      expect(result.items[1].id).toBe('portal-2')
      expect(prisma.portal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user-123' }]),
          }),
        })
      )
    })

    it('should return empty array when no portals exist', async () => {
      prisma.portal.findMany.mockResolvedValue([])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual([])
    })

    it('should include all portal fields in response', async () => {
      const mockPortal = {
        id: 'portal-full',
        alias: 'full-portal',
        name: 'Full Portal',
        description: 'Complete data',
        blueprintId: 'blueprint-abc',
        slug: 'full-portal',
        config: { customDomain: 'example.com' },
        meta: { owner: 'admin' },
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-02'),
      }

      prisma.portal.findMany.mockResolvedValue([mockPortal])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items[0]).toHaveProperty('id')
      expect(result.items[0]).toHaveProperty('alias')
      expect(result.items[0]).toHaveProperty('name')
      expect(result.items[0]).toHaveProperty('description')
      expect(result.items[0]).toHaveProperty('blueprintId')
      expect(result.items[0]).toHaveProperty('slug')
      expect(result.items[0]).toHaveProperty('config')
      expect(result.items[0]).toHaveProperty('meta')
      expect(result.items[0]).toHaveProperty('createdAt')
      expect(result.items[0]).toHaveProperty('updatedAt')
    })
  })

  describe('filtering', () => {
    it('should apply filters from helper functions', async () => {
      getBlueprintIdQueryFilter.mockReturnValue([
        { blueprintId: 'blueprint-1' },
      ])
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['key'], equals: 'value' } },
      ])

      prisma.portal.findMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      expect(prisma.portal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { userId: 'user-123' },
              { blueprintId: 'blueprint-1' },
              { meta: { path: ['key'], equals: 'value' } },
            ]),
          },
        })
      )
    })
  })

  describe('pagination', () => {
    it('should apply cursor and take constraints', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'cursor-123' },
        skip: 1,
      })
      getTakeConstraints.mockReturnValue({ take: 25 })

      prisma.portal.findMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      expect(prisma.portal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-123' },
          skip: 1,
          take: 25,
        })
      )
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed')

      prisma.portal.findMany.mockRejectedValue(dbError)

      await expect(handler(null, {}, null, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })

  describe('data transformation', () => {
    it('should call makeJsonSafe on results', async () => {
      const { makeJsonSafe } = require('@/lib/struct')
      const mockPortals = [{ id: 'portal-1', name: 'Test' }]

      prisma.portal.findMany.mockResolvedValue(mockPortals)
      makeJsonSafe.mockReturnValue(mockPortals)

      await handler(null, {}, null, mockSession)

      expect(makeJsonSafe).toHaveBeenCalledWith(mockPortals)
    })
  })
})
