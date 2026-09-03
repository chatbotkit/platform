/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    ability: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('GET /api/v1/ability/[abilityId]/fetch', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful fetch', () => {
    it('should fetch ability when user is owner', async () => {
      const mockAbility = {
        id: 'ability-123',
        name: 'Test Ability',
        description: 'Test Description',
        userId: 'user-123',
        blueprintId: null,
        skillsetId: null,
        linkedFileId: null,
        linkedSecretId: null,
        linkedBotId: null,
        linkedSpaceId: null,
        instruction: 'Test instruction',
        meta: { key: 'value' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.ability.findUniqueByIdentifier.mockResolvedValue(mockAbility)

      const req = {
        query: { abilityId: 'ability-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toHaveProperty('id', 'ability-123')
      expect(result.body).toHaveProperty('name', 'Test Ability')
      expect(result.body).not.toHaveProperty('userId')
    })

    it('should call findUniqueByIdentifier with correct select fields', async () => {
      const mockAbility = {
        id: 'ability-789',
        name: 'Test',
        description: 'Test',
        userId: 'user-123',
        blueprintId: null,
        skillsetId: null,
        linkedFileId: null,
        linkedSecretId: null,
        linkedBotId: null,
        linkedSpaceId: null,
        instruction: '',
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.ability.findUniqueByIdentifier.mockResolvedValue(mockAbility)

      const req = {
        query: { abilityId: 'ability-789' },
      }

      await handler(req, mockSession)

      expect(prisma.ability.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'ability-789',
        {
          select: {
            id: true,
            alias: true,
            name: true,
            description: true,
            userId: true,
            blueprintId: true,
            skillsetId: true,
            linkedFileId: true,
            linkedSecretId: true,
            linkedBotId: true,
            linkedSpaceId: true,
            instruction: true,
            state: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
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
    })

    it('should return 401 when user is not owner', async () => {
      const mockAbility = {
        id: 'ability-123',
        name: 'Test',
        description: 'Test',
        userId: 'different-user',
        blueprintId: null,
        skillsetId: null,
        linkedFileId: null,
        linkedSecretId: null,
        linkedBotId: null,
        linkedSpaceId: null,
        instruction: '',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.ability.findUniqueByIdentifier.mockResolvedValue(mockAbility)

      const req = {
        query: { abilityId: 'ability-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(401)
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

  describe('field nullability', () => {
    it('should handle ability with all optional fields null', async () => {
      const mockAbility = {
        id: 'ability-123',
        name: 'Minimal Ability',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        skillsetId: null,
        linkedFileId: null,
        linkedSecretId: null,
        linkedBotId: null,
        linkedSpaceId: null,
        instruction: '',
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.ability.findUniqueByIdentifier.mockResolvedValue(mockAbility)

      const req = {
        query: { abilityId: 'ability-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.blueprintId).toBeNull()
      expect(result.body.meta).toBeNull()
    })

    it('should handle ability with all optional fields populated', async () => {
      const mockAbility = {
        id: 'ability-123',
        name: 'Full Ability',
        description: 'Complete ability',
        userId: 'user-123',
        blueprintId: 'blueprint-1',
        skillsetId: 'skillset-1',
        linkedFileId: 'file-1',
        linkedSecretId: 'secret-1',
        linkedBotId: 'bot-1',
        linkedSpaceId: 'space-1',
        instruction: 'Full instruction',
        meta: { advanced: true, tags: ['test'] },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.ability.findUniqueByIdentifier.mockResolvedValue(mockAbility)

      const req = {
        query: { abilityId: 'ability-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.blueprintId).toBe('blueprint-1')
      expect(result.body.meta).toEqual({ advanced: true, tags: ['test'] })
    })
  })
})
