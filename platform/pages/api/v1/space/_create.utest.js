/**
 * @jest-environment node
 */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

describe('POST /api/v1/space/create', () => {
  const mockSession = {
    user: {
      id: 'user_test123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should create a space with minimal required fields', async () => {
      const mockSpace = {
        id: 'space_abc123',
      }

      prisma.space.create.mockResolvedValue(mockSpace)

      const body = {
        name: 'Test Space',
        description: 'A test space',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('space_abc123')
      expect(prisma.space.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_test123',
          name: 'Test Space',
          description: 'A test space',
          alias: undefined,
          blueprintId: undefined,
          contactId: undefined,
          meta: undefined,
        },
        select: {
          id: true,
        },
      })
    })

    it('should create a space with all optional fields', async () => {
      const mockSpace = {
        id: 'space_full123',
      }

      prisma.space.create.mockResolvedValue(mockSpace)

      const body = {
        name: 'Full Space',
        description: 'A space with all fields',
        alias: 'full-space',
        blueprintId: { id: 'blueprint_xyz789' },
        contactId: { id: 'contact_abc456' },
        meta: {
          department: 'support',
          priority: 'high',
        },
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('space_full123')
      expect(prisma.space.create).toHaveBeenCalledWith({
        data: {
          userId: 'user_test123',
          name: 'Full Space',
          description: 'A space with all fields',
          alias: 'full-space',
          blueprintId: 'blueprint_xyz789',
          contactId: 'contact_abc456',
          meta: {
            department: 'support',
            priority: 'high',
          },
        },
        select: {
          id: true,
        },
      })
    })

    it('should associate space with blueprint', async () => {
      const mockSpace = {
        id: 'space_bp123',
      }

      prisma.space.create.mockResolvedValue(mockSpace)

      const body = {
        name: 'Blueprint Space',
        description: 'Space with blueprint',
        blueprintId: { id: 'blueprint_123' },
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'blueprint_123',
          }),
        })
      )
    })

    it('should associate space with contact', async () => {
      const mockSpace = {
        id: 'space_ct456',
      }

      prisma.space.create.mockResolvedValue(mockSpace)

      const body = {
        name: 'Contact Space',
        description: 'Space with contact',
        contactId: { id: 'contact_456' },
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contactId: 'contact_456',
          }),
        })
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty name', async () => {
      const mockSpace = {
        id: 'space_empty123',
      }

      prisma.space.create.mockResolvedValue(mockSpace)

      const body = {
        name: '',
        description: 'Space with empty name',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '',
          }),
        })
      )
    })

    it('should handle null blueprintId gracefully', async () => {
      const mockSpace = {
        id: 'space_nobp123',
      }

      prisma.space.create.mockResolvedValue(mockSpace)

      const body = {
        name: 'Test Space',
        description: 'Space without blueprint',
        blueprintId: null,
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: null,
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle database errors', async () => {
      prisma.space.create.mockRejectedValue(new Error('Database error'))

      const body = {
        name: 'Test Space',
        description: 'This will fail',
      }

      await expect(handler({}, mockSession, body)).rejects.toThrow(
        'Database error'
      )
    })
  })

  describe('schema validation', () => {
    it('should validate bodySchema structure', () => {
      expect(bodySchema).toBeDefined()
      expect(bodySchema.describe).toBeDefined()
    })

    it('should define required name and description fields', () => {
      const schema = bodySchema.describe()

      expect(schema.keys.name).toBeDefined()
      expect(schema.keys.description).toBeDefined()
    })

    it('should define optional configuration fields', () => {
      const schema = bodySchema.describe()

      expect(schema.keys.alias).toBeDefined()
      expect(schema.keys.blueprintId).toBeDefined()
      expect(schema.keys.contactId).toBeDefined()
      expect(schema.keys.meta).toBeDefined()
    })
  })

  describe('response format', () => {
    it('should return only id in response', async () => {
      const mockSpace = {
        id: 'space_resp123',
      }

      prisma.space.create.mockResolvedValue(mockSpace)

      const body = {
        name: 'Test Space',
        description: 'Response test',
      }

      const result = await handler({}, mockSession, body)

      expect(result.status).toBe(200)
      expect(Object.keys(result.body)).toEqual(['id'])
      expect(result.body.id).toBe('space_resp123')
    })
  })
})
