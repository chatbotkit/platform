/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    task: {
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

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

describe('/api/v1/task/[taskId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockReq = {
    query: {
      taskId: 'task_abc123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should fetch task with all expected fields', async () => {
      const mockTask = {
        id: 'task_abc123',
        name: 'My Task',
        description: 'A scheduled task',
        userId: 'user_123',
        contactId: 'contact_456',
        botId: 'bot_789',
        schedule: 'daily',
        timezone: 'America/New_York',
        status: 'idle',
        outcome: 'success',
        maxIterations: 10,
        maxTime: 60000,
        meta: { key: 'value' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)

      const result = await handler(mockReq, mockSession)

      expect(prisma.task.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'task_abc123',
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            userId: true,
            blueprintId: true,
            contactId: true,
            botId: true,
            schedule: true,
            timezone: true,
            status: true,
            outcome: true,
            maxIterations: true,
            maxTime: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )

      expect(result.status).toBe(200)
      expect(result.body).not.toHaveProperty('userId')
      expect(result.body).toHaveProperty('timezone', 'America/New_York')
    })

    it('should strip userId from the response', async () => {
      const mockTask = {
        id: 'task_abc123',
        name: 'My Task',
        description: '',
        userId: 'user_123',
        contactId: null,
        botId: null,
        schedule: 'never',
        status: 'idle',
        outcome: 'pending',
        maxIterations: null,
        maxTime: null,
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
      // userId should be deleted from the returned body
      expect(result.body.userId).toBeUndefined()
      expect(result.body.id).toBe('task_abc123')
    })
  })

  describe('authorization', () => {
    it('should return 404 when task is not found', async () => {
      prisma.task.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user does not own the task', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'other_user_999',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
    })

    it('should allow access when userId matches session user', async () => {
      const mockTask = {
        id: 'task_abc123',
        name: 'Task',
        description: '',
        userId: 'user_123',
        contactId: null,
        botId: null,
        schedule: 'daily',
        status: 'idle',
        outcome: 'pending',
        maxIterations: null,
        maxTime: null,
        meta: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prisma.task.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB connection failed')
      )

      await expect(handler(mockReq, mockSession)).rejects.toThrow(
        'DB connection failed'
      )
    })
  })
})
