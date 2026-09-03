/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'
import { TaskOutcome, TaskStatus } from '@/prisma/types'

import { getNext } from '@/lib/task.schedule'

import handler from './cancel'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    task: {
      findUniqueByIdentifier: jest.fn(),
      updateMany: jest.fn(),
    },
    taskExecution: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  TaskStatus: {
    idle: 'idle',
    running: 'running',
    canceled: 'canceled',
  },
  TaskOutcome: {
    pending: 'pending',
    success: 'success',
    failure: 'failure',
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

jest.mock('@/lib/task.schedule', () => ({
  getNext: jest.fn(),
}))

describe('/api/v1/task/[taskId]/execution/[taskExecutionId]/cancel', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getNext.mockReturnValue(new Date('2027-01-01T00:00:00.000Z'))
  })

  it('should cancel a running task execution and reset the task', async () => {
    const task = {
      id: 'task_abc123',
      userId: 'user_123',
      schedule: 'daily',
    }
    const taskExecution = {
      id: 'exec_123',
      taskId: 'task_abc123',
      userId: 'user_123',
      status: TaskStatus.running,
    }

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    prisma.taskExecution.findUnique.mockResolvedValue(taskExecution)
    prisma.taskExecution.update.mockResolvedValue({
      ...taskExecution,
      status: TaskStatus.canceled,
    })
    prisma.task.updateMany.mockResolvedValue({ count: 1 })

    const result = await handler(
      {
        query: {
          taskId: 'task_abc123',
          taskExecutionId: 'exec_123',
        },
      },
      mockSession
    )

    expect(prisma.taskExecution.update).toHaveBeenCalledWith({
      where: {
        id: 'exec_123',
      },
      data: {
        status: TaskStatus.canceled,
        outcome: TaskOutcome.failure,
        completedAt: expect.any(Date),
        summary: 'Task execution canceled',
      },
    })

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'task_abc123',
        status: TaskStatus.running,
      },
      data: {
        status: TaskStatus.idle,
        outcome: TaskOutcome.failure,
        nextRunAt: new Date('2027-01-01T00:00:00.000Z'),
      },
    })

    expect(result).toEqual({
      status: 200,
      body: {
        id: 'exec_123',
        taskId: 'task_abc123',
      },
    })
  })

  it('should be idempotent for already canceled executions', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_abc123',
      userId: 'user_123',
      schedule: null,
    })
    prisma.taskExecution.findUnique.mockResolvedValue({
      id: 'exec_123',
      taskId: 'task_abc123',
      userId: 'user_123',
      status: TaskStatus.canceled,
    })

    const result = await handler(
      {
        query: {
          taskId: 'task_abc123',
          taskExecutionId: 'exec_123',
        },
      },
      mockSession
    )

    expect(result.status).toBe(200)
    expect(prisma.taskExecution.update).not.toHaveBeenCalled()
    expect(prisma.task.updateMany).not.toHaveBeenCalled()
  })

  it('should return 404 when the execution does not belong to the task', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_abc123',
      userId: 'user_123',
      schedule: null,
    })
    prisma.taskExecution.findUnique.mockResolvedValue({
      id: 'exec_123',
      taskId: 'task_other',
      userId: 'user_123',
      status: TaskStatus.running,
    })

    const result = await handler(
      {
        query: {
          taskId: 'task_abc123',
          taskExecutionId: 'exec_123',
        },
      },
      mockSession
    )

    expect(result.status).toBe(404)
    expect(prisma.taskExecution.update).not.toHaveBeenCalled()
    expect(prisma.task.updateMany).not.toHaveBeenCalled()
  })

  it('should return 403 when task belongs to another user', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_abc123',
      userId: 'other_user',
      schedule: null,
    })

    const result = await handler(
      {
        query: {
          taskId: 'task_abc123',
          taskExecutionId: 'exec_123',
        },
      },
      mockSession
    )

    expect(result.status).toBe(403)
    expect(prisma.taskExecution.findUnique).not.toHaveBeenCalled()
  })

  it('should return 404 when execution belongs to a different user', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_abc123',
      userId: 'user_123',
      schedule: null,
    })
    prisma.taskExecution.findUnique.mockResolvedValue({
      id: 'exec_123',
      taskId: 'task_abc123',
      userId: 'other_user',
      status: TaskStatus.running,
    })

    const result = await handler(
      {
        query: {
          taskId: 'task_abc123',
          taskExecutionId: 'exec_123',
        },
      },
      mockSession
    )

    expect(result.status).toBe(404)
    expect(prisma.taskExecution.update).not.toHaveBeenCalled()
    expect(prisma.task.updateMany).not.toHaveBeenCalled()
  })

  it('should set nextRunAt to null when getNext returns a past date', async () => {
    getNext.mockReturnValue(new Date('2020-01-01T00:00:00.000Z'))

    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_abc123',
      userId: 'user_123',
      schedule: 'daily',
      timezone: null,
    })
    prisma.taskExecution.findUnique.mockResolvedValue({
      id: 'exec_123',
      taskId: 'task_abc123',
      userId: 'user_123',
      status: TaskStatus.running,
    })
    prisma.taskExecution.update.mockResolvedValue({})
    prisma.task.updateMany.mockResolvedValue({ count: 1 })

    await handler(
      {
        query: {
          taskId: 'task_abc123',
          taskExecutionId: 'exec_123',
        },
      },
      mockSession
    )

    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextRunAt: null,
        }),
      })
    )
  })

  it('should pass task timezone to getNext when computing nextRunAt', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_abc123',
      userId: 'user_123',
      schedule: 'daily',
      timezone: 'Europe/Berlin',
    })
    prisma.taskExecution.findUnique.mockResolvedValue({
      id: 'exec_123',
      taskId: 'task_abc123',
      userId: 'user_123',
      status: TaskStatus.running,
    })
    prisma.taskExecution.update.mockResolvedValue({})
    prisma.task.updateMany.mockResolvedValue({ count: 1 })

    await handler(
      {
        query: {
          taskId: 'task_abc123',
          taskExecutionId: 'exec_123',
        },
      },
      mockSession
    )

    expect(getNext).toHaveBeenCalledWith('daily', { timezone: 'Europe/Berlin' })
  })

  it('should return 404 when the task is not found', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      {
        query: {
          taskId: 'task_missing',
          taskExecutionId: 'exec_123',
        },
      },
      mockSession
    )

    expect(result.status).toBe(404)
    expect(prisma.taskExecution.findUnique).not.toHaveBeenCalled()
    expect(prisma.taskExecution.update).not.toHaveBeenCalled()
    expect(prisma.task.updateMany).not.toHaveBeenCalled()
  })

  it('should return 404 when the task execution record does not exist', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_abc123',
      userId: 'user_123',
      schedule: null,
    })
    prisma.taskExecution.findUnique.mockResolvedValue(null)

    const result = await handler(
      {
        query: {
          taskId: 'task_abc123',
          taskExecutionId: 'exec_nonexistent',
        },
      },
      mockSession
    )

    expect(result.status).toBe(404)
    expect(prisma.taskExecution.update).not.toHaveBeenCalled()
    expect(prisma.task.updateMany).not.toHaveBeenCalled()
  })

  it('should cancel and set nextRunAt to null when the task has no schedule', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_abc123',
      userId: 'user_123',
      schedule: null,
      timezone: null,
    })
    prisma.taskExecution.findUnique.mockResolvedValue({
      id: 'exec_123',
      taskId: 'task_abc123',
      userId: 'user_123',
      status: TaskStatus.running,
    })
    prisma.taskExecution.update.mockResolvedValue({})
    prisma.task.updateMany.mockResolvedValue({ count: 1 })

    const result = await handler(
      {
        query: {
          taskId: 'task_abc123',
          taskExecutionId: 'exec_123',
        },
      },
      mockSession
    )

    expect(result.status).toBe(200)
    expect(getNext).not.toHaveBeenCalled()
    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextRunAt: null,
        }),
      })
    )
  })

  it('should set nextRunAt to null when getNext returns null for a never schedule', async () => {
    // 'never' is a valid schedule value that causes getNext to return null
    getNext.mockReturnValue(null)

    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_abc123',
      userId: 'user_123',
      schedule: 'never',
      timezone: null,
    })
    prisma.taskExecution.findUnique.mockResolvedValue({
      id: 'exec_123',
      taskId: 'task_abc123',
      userId: 'user_123',
      status: TaskStatus.running,
    })
    prisma.taskExecution.update.mockResolvedValue({})
    prisma.task.updateMany.mockResolvedValue({ count: 1 })

    await handler(
      {
        query: {
          taskId: 'task_abc123',
          taskExecutionId: 'exec_123',
        },
      },
      mockSession
    )

    expect(getNext).toHaveBeenCalledWith('never', { timezone: null })
    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextRunAt: null,
        }),
      })
    )
  })

  it('should return both execution id and task id in the response', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue({
      id: 'task_xyz',
      userId: 'user_123',
      schedule: null,
      timezone: null,
    })
    prisma.taskExecution.findUnique.mockResolvedValue({
      id: 'exec_xyz',
      taskId: 'task_xyz',
      userId: 'user_123',
      status: TaskStatus.canceled,
    })

    const result = await handler(
      {
        query: {
          taskId: 'task_xyz',
          taskExecutionId: 'exec_xyz',
        },
      },
      mockSession
    )

    expect(result).toEqual({
      status: 200,
      body: {
        id: 'exec_xyz',
        taskId: 'task_xyz',
      },
    })
  })
})
