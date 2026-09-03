/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    team: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withUserSession: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

describe('POST /api/v1/team/create', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('bodySchema validation', () => {
    it('should accept valid body with required fields', () => {
      const validBody = {
        name: 'Test Team',
        description: 'A test team',
      }

      const { error } = bodySchema.validate(validBody)

      expect(error).toBeUndefined()
    })

    it('should accept valid body with meta', () => {
      const validBody = {
        name: 'Test Team',
        description: 'A test team',
        meta: { key: 'value' },
      }

      const { error } = bodySchema.validate(validBody)

      expect(error).toBeUndefined()
    })

    it('should accept empty description', () => {
      const validBody = {
        name: 'Test Team',
        description: '',
      }

      const { error } = bodySchema.validate(validBody)

      expect(error).toBeUndefined()
    })

    it('should accept body without name', () => {
      const validBody = {
        description: 'A test team',
      }

      const { error } = bodySchema.validate(validBody)

      expect(error).toBeUndefined()
    })
  })

  describe('successful team creation', () => {
    it('should create team with valid data', async () => {
      const mockTeam = {
        id: 'team-123',
      }

      prisma.team.create.mockResolvedValue(mockTeam)

      const req = {}

      const body = {
        name: 'Test Team',
        description: 'A test team',
      }

      const result = await handler(req, mockSession, body)

      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          name: 'Test Team',
          description: 'A test team',
          meta: undefined,
        },
        select: {
          id: true,
        },
      })

      expect(result).toEqual({ status: 200, body: { id: 'team-123' } })
    })

    it('should create team with meta', async () => {
      const mockTeam = {
        id: 'team-456',
      }

      prisma.team.create.mockResolvedValue(mockTeam)

      const req = {}

      const body = {
        name: 'Team With Meta',
        description: 'Test description',
        meta: { color: 'blue', tags: ['tag1'] },
      }

      const result = await handler(req, mockSession, body)

      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          name: 'Team With Meta',
          description: 'Test description',
          meta: { color: 'blue', tags: ['tag1'] },
        },
        select: {
          id: true,
        },
      })

      expect(result).toEqual({ status: 200, body: { id: 'team-456' } })
    })

    it('should associate team with correct user', async () => {
      const mockTeam = {
        id: 'team-789',
      }

      prisma.team.create.mockResolvedValue(mockTeam)

      const sessionWithDifferentUser = {
        user: {
          id: 'different-user-456',
        },
      }

      const req = {}

      const body = {
        name: 'User Team',
        description: 'Test',
      }

      await handler(req, sessionWithDifferentUser, body)

      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'different-user-456',
          }),
        })
      )
    })

    it('should return only team id', async () => {
      const mockTeam = {
        id: 'team-abc',
      }

      prisma.team.create.mockResolvedValue(mockTeam)

      const req = {}

      const body = {
        name: 'New Team',
        description: 'Description',
      }

      const result = await handler(req, mockSession, body)

      expect(Object.keys(result.body)).toEqual(['id'])
      expect(result.body.id).toBe('team-abc')
    })
  })

  describe('edge cases', () => {
    it('should handle empty description', async () => {
      const mockTeam = {
        id: 'team-empty',
      }

      prisma.team.create.mockResolvedValue(mockTeam)

      const req = {}

      const body = {
        name: 'Team No Description',
        description: '',
      }

      await handler(req, mockSession, body)

      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: '',
          }),
        })
      )
    })

    it('should handle long team names', async () => {
      const mockTeam = {
        id: 'team-long',
      }

      prisma.team.create.mockResolvedValue(mockTeam)

      const longName = 'A'.repeat(200)

      const req = {}

      const body = {
        name: longName,
        description: 'Test',
      }

      await handler(req, mockSession, body)

      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: longName,
          }),
        })
      )
    })

    it('should handle special characters in name', async () => {
      const mockTeam = {
        id: 'team-special',
      }

      prisma.team.create.mockResolvedValue(mockTeam)

      const specialName = 'Team 💻 <script>alert("test")</script>'

      const req = {}

      const body = {
        name: specialName,
        description: 'Test',
      }

      await handler(req, mockSession, body)

      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: specialName,
          }),
        })
      )
    })

    it('should handle null meta', async () => {
      const mockTeam = {
        id: 'team-null-meta',
      }

      prisma.team.create.mockResolvedValue(mockTeam)

      const req = {}

      const body = {
        name: 'Team',
        description: 'Test',
        meta: null,
      }

      await handler(req, mockSession, body)

      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: null,
          }),
        })
      )
    })
  })

  describe('database errors', () => {
    it('should propagate create errors', async () => {
      const error = new Error('Database constraint violation')

      prisma.team.create.mockRejectedValue(error)

      const req = {}

      const body = {
        name: 'Test Team',
        description: 'Test',
      }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Database constraint violation'
      )
    })

    it('should handle unique constraint violations', async () => {
      const error = new Error('Unique constraint failed')

      prisma.team.create.mockRejectedValue(error)

      const req = {}

      const body = {
        name: 'Duplicate Team',
        description: 'Test',
      }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Unique constraint failed'
      )
    })
  })
})
