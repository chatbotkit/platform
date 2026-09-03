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
  withStreamCursor: (fn) => (req, _stream, session) =>
    fn(null, req, _stream, session),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: (req, param) => req.query[param],
}))

jest.mock('@/lib/filter', () => ({
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
  getMetaQueryFilter: jest.fn(() => []),
  getFieldQueryFilter: jest.fn(() => []),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: () => {
    throw new Error('Not found')
  },
  throwNotAuthorized: () => {
    throw new Error('Not authorized')
  },
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

describe('/api/v1/task/[taskId]/execution/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)

    const {
      getCursorConstraints,
      getTakeConstraints,
      getMetaQueryFilter,
      getFieldQueryFilter,
    } = require('@/lib/filter')

    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    getMetaQueryFilter.mockReturnValue([])
    getFieldQueryFilter.mockReturnValue([])
  })

  describe('basic functionality', () => {
    it('should list executions for the task', async () => {
      const mockTask = {
        id: 'task_123',
        userId: 'user_123',
      }

      const mockExecutions = [
        {
          id: 'exec_1',
          name: 'Execution 1',
          description: '',
          taskId: 'task_123',
          conversationId: 'conv_1',
          status: 'idle',
          outcome: 'success',
          summary: 'Task completed successfully',
          completedAt: new Date('2024-01-01T10:00:00Z'),
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'exec_2',
          name: 'Execution 2',
          description: '',
          taskId: 'task_123',
          conversationId: 'conv_2',
          status: 'idle',
          outcome: 'failure',
          summary: 'Task failed',
          completedAt: new Date('2024-01-02T10:00:00Z'),
          meta: {},
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      prisma.task.findUniqueByIdentifier.mockResolvedValue(mockTask)
      prisma.taskExecution.findMany.mockResolvedValue(mockExecutions)

      const req = { query: { taskId: 'task_123' } }
      const result = await handler(req, null, mockSession)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('exec_1')
      expect(result.items[1].id).toBe('exec_2')
    })

    it('should return an empty list when no executions exist', async () => {
      prisma.task.findUniqueByIdentifier.mockResolvedValue({
        id: 'task_123',
        userId: 'user_123',
      })
      prisma.taskExecution.findMany.mockResolvedValue([])

      const req = { query: { taskId: 'task_123' } }
      const result = await handler(req, null, mockSession)

      expect(result.items).toHaveLength(0)
    })

    it('should look up the task by identifier', async () => {
      prisma.task.findUniqueByIdentifier.mockResolvedValue({
        id: 'task_123',
        userId: 'user_123',
      })
      prisma.taskExecution.findMany.mockResolvedValue([])

      const req = { query: { taskId: 'task_123' } }

      await handler(req, null, mockSession)

      expect(prisma.task.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'task_123',
        { select: { id: true, userId: true } }
      )
    })
  })

  describe('authorization - multi-tenant isolation', () => {
    it('should throw not found when task does not exist', async () => {
      prisma.task.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { taskId: 'nonexistent' } }

      await expect(handler(req, null, mockSession)).rejects.toThrow('Not found')
      expect(prisma.taskExecution.findMany).not.toHaveBeenCalled()
    })

    it('should throw not authorized when task belongs to a different user', async () => {
      // @note this is the critical multi-tenant isolation check - users must only
      // see executions for their own tasks
      prisma.task.findUniqueByIdentifier.mockResolvedValue({
        id: 'task_123',
        userId: 'different_user',
      })

      const req = { query: { taskId: 'task_123' } }

      await expect(handler(req, null, mockSession)).rejects.toThrow(
        'Not authorized'
      )
      expect(prisma.taskExecution.findMany).not.toHaveBeenCalled()
    })
  })

  describe('database query - defense-in-depth filtering', () => {
    it('should filter executions by both taskId and userId', async () => {
      // @note both taskId AND userId are required in the WHERE clause to prevent
      // cross-user data leaks even if the ownership check above is somehow bypassed
      prisma.task.findUniqueByIdentifier.mockResolvedValue({
        id: 'task_123',
        userId: 'user_123',
      })
      prisma.taskExecution.findMany.mockResolvedValue([])

      const req = { query: { taskId: 'task_123' } }

      await handler(req, null, mockSession)

      const findManyCall = prisma.taskExecution.findMany.mock.calls[0][0]

      expect(findManyCall.where.AND).toEqual(
        expect.arrayContaining([{ taskId: 'task_123' }, { userId: 'user_123' }])
      )
    })
  })

  describe('response shape', () => {
    it('should include execution status, outcome, summary and conversationId', async () => {
      prisma.task.findUniqueByIdentifier.mockResolvedValue({
        id: 'task_123',
        userId: 'user_123',
      })

      const execution = {
        id: 'exec_1',
        name: '',
        description: '',
        taskId: 'task_123',
        conversationId: 'conv_1',
        status: 'idle',
        outcome: 'success',
        summary: 'Processed all items',
        completedAt: new Date('2024-01-01T12:00:00Z'),
        meta: { retries: 0 },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      }

      prisma.taskExecution.findMany.mockResolvedValue([execution])

      const req = { query: { taskId: 'task_123' } }
      const result = await handler(req, null, mockSession)

      expect(result.items[0]).toMatchObject({
        id: 'exec_1',
        status: 'idle',
        outcome: 'success',
        summary: 'Processed all items',
        conversationId: 'conv_1',
        taskId: 'task_123',
      })
    })

    it('should select only the documented fields from the database', async () => {
      prisma.task.findUniqueByIdentifier.mockResolvedValue({
        id: 'task_123',
        userId: 'user_123',
      })
      prisma.taskExecution.findMany.mockResolvedValue([])

      const req = { query: { taskId: 'task_123' } }

      await handler(req, null, mockSession)

      const findManyCall = prisma.taskExecution.findMany.mock.calls[0][0]

      expect(findManyCall.select).toMatchObject({
        id: true,
        name: true,
        description: true,
        taskId: true,
        conversationId: true,
        status: true,
        outcome: true,
        summary: true,
        completedAt: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      })
    })
  })
})
