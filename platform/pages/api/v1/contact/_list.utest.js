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
  getMetaQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getMetaQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('/api/v1/contact/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    getMetaQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  describe('basic functionality', () => {
    it('should list contacts for authenticated user', async () => {
      const mockContacts = [
        {
          id: 'contact1',
          name: 'John Doe',
          description: 'A contact',
          fingerprint: 'fp1',
          email: 'john@example.com',
          phone: '+1234567890',
          nick: 'johndoe',
          preferences: { theme: 'dark' },
          verifiedAt: new Date('2024-01-01'),
          meta: { source: 'website' },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      prisma.contact.findMany.mockResolvedValue(mockContacts)

      const result = await handler(null, {}, null, mockSession)

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ userId: 'user_123' }],
          },
        })
      )
      expect(result).toEqual({ items: mockContacts })
    })

    it('should return empty array when user has no contacts', async () => {
      prisma.contact.findMany.mockResolvedValue([])

      const result = await handler(null, {}, null, mockSession)

      expect(result).toEqual({ items: [] })
    })

    it('should include all required contact fields', async () => {
      prisma.contact.findMany.mockResolvedValue([])

      await handler(null, {}, null, mockSession)

      const selectFields = prisma.contact.findMany.mock.calls[0][0].select

      expect(selectFields).toMatchObject({
        id: true,
        name: true,
        description: true,
        fingerprint: true,
        email: true,
        phone: true,
        nick: true,
        preferences: true,
        verifiedAt: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      })
    })
  })

  describe('filtering', () => {
    it('should apply meta query filter', async () => {
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['segment'], equals: 'premium' } },
      ])

      prisma.contact.findMany.mockResolvedValue([])

      const req = { query: { 'meta.segment': 'premium' } }

      await handler(null, req, null, mockSession)

      expect(getMetaQueryFilter).toHaveBeenCalledWith(req)
      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { userId: 'user_123' },
              { meta: { path: ['segment'], equals: 'premium' } },
            ],
          },
        })
      )
    })
  })

  describe('pagination', () => {
    it('should apply cursor constraints', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'contact_cursor' },
        skip: 1,
        orderBy: { createdAt: 'desc' },
      })

      prisma.contact.findMany.mockResolvedValue([])

      await handler('contact_cursor', {}, null, mockSession)

      expect(getCursorConstraints).toHaveBeenCalledWith({}, 'contact_cursor')
      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'contact_cursor' },
          skip: 1,
          orderBy: { createdAt: 'desc' },
        })
      )
    })

    it('should apply take constraints', async () => {
      getTakeConstraints.mockReturnValue({ take: 50 })

      prisma.contact.findMany.mockResolvedValue([])

      const req = { query: { take: '50' } }

      await handler(null, req, null, mockSession)

      expect(getTakeConstraints).toHaveBeenCalledWith(req)
      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      )
    })
  })

  describe('user isolation', () => {
    it('should only return contacts for authenticated user', async () => {
      prisma.contact.findMany.mockResolvedValue([])

      const sessionB = { user: { id: 'user_456' } }

      await handler(null, {}, null, sessionB)

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user_456' }]),
          }),
        })
      )
    })
  })

  describe('edge cases', () => {
    it('should handle contacts with null optional fields', async () => {
      const mockContacts = [
        {
          id: 'contact1',
          name: '',
          description: '',
          fingerprint: 'fp1',
          email: 'test@example.com',
          phone: null,
          nick: null,
          preferences: null,
          verifiedAt: null,
          meta: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      prisma.contact.findMany.mockResolvedValue(mockContacts)

      const result = await handler(null, {}, null, mockSession)

      expect(result).toEqual({ items: mockContacts })
    })

    it('should handle multiple contacts', async () => {
      const mockContacts = Array.from({ length: 50 }, (_, i) => ({
        id: `contact${i}`,
        name: `Contact ${i}`,
        description: '',
        fingerprint: `fp${i}`,
        email: `contact${i}@example.com`,
        phone: null,
        nick: null,
        preferences: null,
        verifiedAt: null,
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }))

      prisma.contact.findMany.mockResolvedValue(mockContacts)

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toHaveLength(50)
    })
  })

  describe('error handling', () => {
    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed')

      prisma.contact.findMany.mockRejectedValue(dbError)

      await expect(handler(null, {}, null, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle meta query filter errors', async () => {
      getMetaQueryFilter.mockImplementation(() => {
        throw new Error('Invalid meta query format')
      })

      await expect(
        handler(null, { query: { meta: 'invalid' } }, null, mockSession)
      ).rejects.toThrow('Invalid meta query format')
    })
  })

  describe('data transformation', () => {
    it('should use makeJsonSafe on results', async () => {
      const { makeJsonSafe } = require('@/lib/struct')

      const mockContacts = [
        {
          id: 'contact_1',
          name: 'Test Contact',
          description: '',
          fingerprint: 'fp1',
          email: 'test@example.com',
          phone: null,
          nick: null,
          preferences: null,
          verifiedAt: null,
          meta: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      prisma.contact.findMany.mockResolvedValue(mockContacts)

      await handler(null, {}, null, mockSession)

      expect(makeJsonSafe).toHaveBeenCalledWith(mockContacts)
    })
  })
})
