/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/prisma/zod', () => ({
  PortalConfig: {},
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: {
    object: jest.fn().mockReturnThis(),
    string: jest.fn().mockReturnThis(),
    number: jest.fn().mockReturnThis(),
    boolean: jest.fn().mockReturnThis(),
    zodSchema: jest.fn().mockReturnThis(),
    allow: jest.fn().mockReturnThis(),
    valid: jest.fn().mockReturnThis(),
    min: jest.fn().mockReturnThis(),
    max: jest.fn().mockReturnThis(),
    required: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    describe: jest.fn(() => ({ keys: {} })),
  },
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/schemas/alias', () => ({}))
jest.mock('@/schemas/name', () => ({}))
jest.mock('@/schemas/description', () => ({}))
jest.mock('@/schemas/blueprintId', () => jest.fn(() => ({})))
jest.mock('@/schemas/slug', () => ({}))
jest.mock('@/schemas/meta', () => ({}))

describe('/api/v1/portal/create', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should create portal with minimal required fields', async () => {
      const mockPortal = { id: 'portal_abc123' }

      prisma.portal.create.mockResolvedValue(mockPortal)

      const body = {
        name: 'Test Portal',
      }

      const result = await handler(null, mockSession, body)

      expect(prisma.portal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user_123',
          name: 'Test Portal',
        }),
        select: {
          id: true,
        },
      })

      expect(result).toEqual({ status: 200, body: { id: 'portal_abc123' } })
    })

    it('should create portal with all optional fields', async () => {
      const mockPortal = { id: 'portal_full123' }

      prisma.portal.create.mockResolvedValue(mockPortal)

      const config = {
        apps: { chat: {} },
        users: { '*@company.com': {} },
        layout: { header: true },
      }

      const body = {
        alias: 'my-alias',
        name: 'Full Portal',
        description: 'A full portal',
        blueprintId: 'blueprint_xyz',
        slug: 'my-portal',
        config,
        meta: { custom: 'value' },
      }

      const result = await handler(null, mockSession, body)

      expect(prisma.portal.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          alias: 'my-alias',
          name: 'Full Portal',
          description: 'A full portal',
          blueprintId: 'blueprint_xyz',
          slug: 'my-portal',
          config,
          meta: { custom: 'value' },
        },
        select: {
          id: true,
        },
      })

      expect(result).toEqual({ status: 200, body: { id: 'portal_full123' } })
    })

    it('should set userId from session user id', async () => {
      const mockPortal = { id: 'portal_abc' }

      prisma.portal.create.mockResolvedValue(mockPortal)

      const differentSession = { user: { id: 'user_different_456' } }

      await handler(null, differentSession, { name: 'Portal' })

      expect(prisma.portal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user_different_456',
          }),
        })
      )
    })

    it('should extract id from blueprintId object when given as object', async () => {
      const mockPortal = { id: 'portal_abc' }

      prisma.portal.create.mockResolvedValue(mockPortal)

      const body = {
        name: 'Portal',
        blueprintId: { id: 'blueprint_nested_id' },
      }

      await handler(null, mockSession, body)

      expect(prisma.portal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'blueprint_nested_id',
          }),
        })
      )
    })

    it('should return only the id of the created portal', async () => {
      prisma.portal.create.mockResolvedValue({ id: 'portal_only_id' })

      const result = await handler(null, mockSession, { name: 'Portal' })

      expect(result.body).toEqual({ id: 'portal_only_id' })
      expect(result.body).not.toHaveProperty('name')
      expect(result.body).not.toHaveProperty('userId')
    })
  })

  describe('database interactions', () => {
    it('should select only id from prisma', async () => {
      prisma.portal.create.mockResolvedValue({ id: 'portal_xyz' })

      await handler(null, mockSession, { name: 'Portal' })

      expect(prisma.portal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true },
        })
      )
    })

    it('should propagate database errors', async () => {
      prisma.portal.create.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        handler(null, mockSession, { name: 'Portal' })
      ).rejects.toThrow('Database connection failed')
    })
  })
})
