/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    task: {
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
  notAuthorized: () => ({ status: 403 }),
}))

describe('/api/v1/task/[taskId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete task and return its id', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.delete.mockResolvedValue(mockTask)

      const req = { query: { taskId: 'task_abc123' } }

      const result = await handler(req, mockSession)

      expect(prisma.task.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'task_abc123',
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )
      expect(prisma.task.delete).toHaveBeenCalledWith({
        where: { id: 'task_abc123' },
      })
      expect(result).toEqual({ status: 200, body: { id: 'task_abc123' } })
    })
  })

  describe('authorization', () => {
    it('should return 404 when task is not found', async () => {
      prisma.task.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { taskId: 'task_nonexistent' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.task.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the task', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'other_user_999',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)

      const req = { query: { taskId: 'task_abc123' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      // Critical: must NOT delete a task owned by another user
      expect(prisma.task.delete).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate database lookup errors', async () => {
      prisma.task.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB connection failed')
      )

      const req = { query: { taskId: 'task_abc123' } }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'DB connection failed'
      )
      expect(prisma.task.delete).not.toHaveBeenCalled()
    })

    it('should propagate database delete errors', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.task.delete.mockRejectedValue(new Error('Delete failed'))

      const req = { query: { taskId: 'task_abc123' } }

      await expect(handler(req, mockSession)).rejects.toThrow('Delete failed')
    })
  })
})
