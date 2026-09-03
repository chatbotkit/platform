/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withUserSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('POST /api/v1/team/[teamId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should delete team when user is owner', async () => {
      const mockTeam = {
        id: 'team123',
        userId: 'user123',
      }

      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.team.delete.mockResolvedValue(mockTeam)

      const req = {
        query: { teamId: 'team123' },
      }

      const result = await handler(req, mockSession, {})

      expect(result).toEqual({ status: 200, body: { id: 'team123' } })
      expect(prisma.team.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'team123',
        { select: { id: true, userId: true } }
      )
      expect(prisma.team.delete).toHaveBeenCalledWith({
        where: { id: 'team123' },
      })
    })

    it('should return deleted team ID in response', async () => {
      const mockTeam = {
        id: 'team456',
        userId: 'user456',
      }

      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.team.delete.mockResolvedValue(mockTeam)

      const req = {
        query: { teamId: 'team456' },
      }

      const session = { user: { id: 'user456' } }

      const result = await handler(req, session, {})

      expect(result).toEqual({ status: 200, body: { id: 'team456' } })
    })
  })

  describe('authorization', () => {
    it('should return 401 when user is not the team owner', async () => {
      const mockTeam = {
        id: 'team123',
        userId: 'user123',
      }

      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)

      const req = {
        query: { teamId: 'team123' },
      }

      const session = { user: { id: 'user456' } }

      const result = await handler(req, session, {})

      expect(result).toEqual({ status: 401 })
      expect(prisma.team.delete).not.toHaveBeenCalled()
    })

    it('should prevent deletion by non-owner with valid session', async () => {
      const mockTeam = {
        id: 'team789',
        userId: 'owner123',
      }

      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)

      const req = {
        query: { teamId: 'team789' },
      }

      const session = { user: { id: 'attacker456' } }

      const result = await handler(req, session, {})

      expect(result).toEqual({ status: 401 })
      expect(prisma.team.delete).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should return 404 when team does not exist', async () => {
      prisma.team.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { teamId: 'nonexistent' },
      }

      const result = await handler(req, mockSession, {})

      expect(result).toEqual({ status: 404 })
      expect(prisma.team.delete).not.toHaveBeenCalled()
    })

    it('should return 404 when team is undefined', async () => {
      prisma.team.findUniqueByIdentifier.mockResolvedValue(undefined)

      const req = {
        query: { teamId: 'invalid' },
      }

      const result = await handler(req, mockSession, {})

      expect(result).toEqual({ status: 404 })
      expect(prisma.team.delete).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle database errors during lookup', async () => {
      prisma.team.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database connection error')
      )

      const req = {
        query: { teamId: 'team123' },
      }

      await expect(handler(req, mockSession, {})).rejects.toThrow(
        'Database connection error'
      )
    })

    it('should handle database errors during deletion', async () => {
      const mockTeam = {
        id: 'team123',
        userId: 'user123',
      }

      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.team.delete.mockRejectedValue(new Error('Constraint violation'))

      const req = {
        query: { teamId: 'team123' },
      }

      await expect(handler(req, mockSession, {})).rejects.toThrow(
        'Constraint violation'
      )
    })
  })

  describe('bodySchema validation', () => {
    it('should have valid empty object schema', () => {
      const result = bodySchema.validate({})

      expect(result.error).toBeUndefined()
    })

    it('should accept empty body', () => {
      const result = bodySchema.validate({})

      expect(result.value).toEqual({})
    })

    it('should reject additional properties', () => {
      const result = bodySchema.validate({ extra: 'field' })

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('"extra" is not allowed')
    })
  })

  describe('session handling', () => {
    it('should use session user ID for authorization', async () => {
      const mockTeam = {
        id: 'team123',
        userId: 'sessionUser123',
      }

      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.team.delete.mockResolvedValue(mockTeam)

      const req = {
        query: { teamId: 'team123' },
      }

      const session = { user: { id: 'sessionUser123' } }

      const result = await handler(req, session, {})

      expect(result).toEqual({ status: 200, body: { id: 'team123' } })
      expect(prisma.team.findUniqueByIdentifier).toHaveBeenCalledWith(
        session.user,
        'team123',
        expect.any(Object)
      )
    })

    it('should prevent deletion when session user differs from team owner', async () => {
      const mockTeam = {
        id: 'team123',
        userId: 'owner123',
      }

      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)

      const req = {
        query: { teamId: 'team123' },
      }

      const session = { user: { id: 'differentUser456' } }

      const result = await handler(req, session, {})

      expect(result).toEqual({ status: 401 })
      expect(prisma.team.delete).not.toHaveBeenCalled()
    })
  })
})
