/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    ability: {
      findUniqueByIdentifier: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('DELETE /api/v1/ability/[abilityId]/delete', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful deletion', () => {
    it('should delete ability when user is owner', async () => {
      const mockAbility = {
        id: 'ability-123',
        userId: 'user-123',
      }

      prisma.ability.findUniqueByIdentifier.mockResolvedValue(mockAbility)
      prisma.ability.delete.mockResolvedValue(mockAbility)

      const req = {
        query: { abilityId: 'ability-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'ability-123' })
      expect(prisma.ability.delete).toHaveBeenCalledWith({
        where: { id: 'ability-123' },
      })
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockAbility = {
        id: 'ability-456',
        userId: 'user-123',
      }

      prisma.ability.findUniqueByIdentifier.mockResolvedValue(mockAbility)
      prisma.ability.delete.mockResolvedValue(mockAbility)

      const req = {
        query: { abilityId: 'test-ability-id' },
      }

      await handler(req, mockSession)

      expect(prisma.ability.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'test-ability-id',
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )
    })
  })

  describe('error handling', () => {
    it('should return 404 when ability not found', async () => {
      prisma.ability.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { abilityId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.ability.delete).not.toHaveBeenCalled()
    })

    it('should return 401 when user is not owner', async () => {
      const mockAbility = {
        id: 'ability-123',
        userId: 'different-user',
      }

      prisma.ability.findUniqueByIdentifier.mockResolvedValue(mockAbility)

      const req = {
        query: { abilityId: 'ability-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(401)
      expect(prisma.ability.delete).not.toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      prisma.ability.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      const req = {
        query: { abilityId: 'ability-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })
  })

  describe('edge cases', () => {
    it('should handle null ability', async () => {
      prisma.ability.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { abilityId: 'ability-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should handle ability with null userId', async () => {
      const mockAbility = {
        id: 'ability-123',
        userId: null,
      }

      prisma.ability.findUniqueByIdentifier.mockResolvedValue(mockAbility)

      const req = {
        query: { abilityId: 'ability-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(401)
      expect(prisma.ability.delete).not.toHaveBeenCalled()
    })
  })
})
