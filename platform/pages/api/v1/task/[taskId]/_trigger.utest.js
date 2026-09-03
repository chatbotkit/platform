/**
 * @jest-environment node
 */
import prismaMock from '@/prisma/client'

import { canUseTask } from '@/lib/task.access'

import { executeTask } from '@/pages/api/v1/task/[taskId]/workflow'

import handler from './trigger'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      task: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/task.access', () => ({
  canUseTask: jest.fn(),
}))

jest.mock('@/pages/api/v1/task/[taskId]/workflow', () => ({
  executeTask: jest.fn(),
}))

const prisma = prismaMock

describe('/api/v1/task/[taskId]/trigger', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should trigger a task and return its id', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      canUseTask.mockReturnValue(true)
      executeTask.mockResolvedValue(undefined)

      const req = { query: { taskId: 'task_abc123' } }

      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'task_abc123' })
    })

    it('should call executeTask with the task id', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      canUseTask.mockReturnValue(true)
      executeTask.mockResolvedValue(undefined)

      const req = { query: { taskId: 'task_abc123' } }

      await handler(req, mockSession, {})

      expect(executeTask).toHaveBeenCalledWith('task_abc123')
      expect(executeTask).toHaveBeenCalledTimes(1)
    })
  })

  describe('authorization', () => {
    it('should return 404 when task does not exist', async () => {
      prisma.task.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { taskId: 'task_nonexistent' } }

      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(404)
      expect(executeTask).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the task', async () => {
      const mockTask = {
        id: 'task_other',
        userId: 'user_other',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      canUseTask.mockReturnValue(false)

      const req = { query: { taskId: 'task_other' } }

      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(403)
      expect(executeTask).not.toHaveBeenCalled()
    })

    it('should call canUseTask with correct arguments', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      canUseTask.mockReturnValue(true)
      executeTask.mockResolvedValue(undefined)

      const req = { query: { taskId: 'task_abc123' } }

      await handler(req, mockSession, {})

      expect(canUseTask).toHaveBeenCalledWith(mockSession.user.id, mockTask)
    })
  })

  describe('task lookup', () => {
    it('should look up task by identifier from URL param', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      canUseTask.mockReturnValue(true)
      executeTask.mockResolvedValue(undefined)

      const req = { query: { taskId: 'task_abc123' } }

      await handler(req, mockSession, {})

      expect(prisma.task.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'task_abc123'
      )
    })
  })

  describe('error handling', () => {
    it('should propagate errors from executeTask', async () => {
      const mockTask = {
        id: 'task_abc123',
        userId: 'user_123',
      }

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      canUseTask.mockReturnValue(true)
      executeTask.mockRejectedValue(new Error('Queue unavailable'))

      const req = { query: { taskId: 'task_abc123' } }

      await expect(handler(req, mockSession, {})).rejects.toThrow(
        'Queue unavailable'
      )
    })

    it('should propagate database errors', async () => {
      prisma.task.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      const req = { query: { taskId: 'task_abc123' } }

      await expect(handler(req, mockSession, {})).rejects.toThrow(
        'Database error'
      )
    })
  })
})
