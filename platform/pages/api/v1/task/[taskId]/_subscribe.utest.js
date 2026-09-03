/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import { canUseTask } from '@/lib/task.access'
import { pipeTaskWorkflowEventsToStream } from '@/lib/task.workflow.channel'

import handler, { bodySchema } from './subscribe'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    task: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

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

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query?.[param]),
}))

jest.mock('@/lib/response', () => ({
  throwNotAuthorized: jest.fn(() => {
    throw new Error('not authorized')
  }),
  throwNotFound: jest.fn(() => {
    throw new Error('not found')
  }),
}))

jest.mock('@/lib/task.access', () => ({
  canUseTask: jest.fn(),
}))

jest.mock('@/lib/task.workflow.channel', () => ({
  TASK_WORKFLOW_CHANNEL_HISTORY_LENGTH: 1000,
  pipeTaskWorkflowEventsToStream: jest.fn(),
}))

describe('task subscribe bodySchema', () => {
  it('should accept an empty body', () => {
    const result = bodySchema.validate({})

    expect(result.error).toBeUndefined()
  })

  it('should reject historyLength above the task workflow history limit', () => {
    const result = bodySchema.validate({ historyLength: 1001 })

    expect(result.error).toBeDefined()
  })
})

describe('POST /api/v1/task/{taskId}/subscribe', () => {
  const mockSession = { user: { id: 'user-1' } }

  function makeStream() {
    return {
      push: jest.fn().mockResolvedValue(undefined),
      abortSignal: undefined,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    pipeTaskWorkflowEventsToStream.mockResolvedValue(undefined)
  })

  it('should throw notFound when the task does not exist', async () => {
    prisma.task.findUniqueByIdentifier.mockResolvedValue(null)

    await expect(
      handler({ query: { taskId: 'task-1' } }, makeStream(), mockSession, {})
    ).rejects.toThrow('not found')

    expect(pipeTaskWorkflowEventsToStream).not.toHaveBeenCalled()
  })

  it('should throw notAuthorized when the session cannot use the task', async () => {
    const task = { id: 'task-1', userId: 'user-2' }

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    canUseTask.mockReturnValue(false)

    await expect(
      handler({ query: { taskId: 'task-1' } }, makeStream(), mockSession, {})
    ).rejects.toThrow('not authorized')

    expect(pipeTaskWorkflowEventsToStream).not.toHaveBeenCalled()
  })

  it('should stream task workflow messages for the authorized task', async () => {
    const task = { id: 'task-1', userId: 'user-1' }
    const stream = makeStream()

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    canUseTask.mockReturnValue(true)

    await handler({ query: { taskId: 'task-1' } }, stream, mockSession, {
      historyLength: 10,
    })

    expect(pipeTaskWorkflowEventsToStream).toHaveBeenCalledWith(
      mockSession.user.id,
      task.id,
      stream,
      { historyLength: 10 }
    )
  })

  it('should forward undefined historyLength when body does not include it', async () => {
    const task = { id: 'task-1', userId: 'user-1' }
    const stream = makeStream()

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    canUseTask.mockReturnValue(true)

    await handler({ query: { taskId: 'task-1' } }, stream, mockSession, {})

    expect(pipeTaskWorkflowEventsToStream).toHaveBeenCalledWith(
      mockSession.user.id,
      task.id,
      stream,
      { historyLength: undefined }
    )
  })

  it('should propagate errors thrown by pipeTaskWorkflowEventsToStream', async () => {
    const task = { id: 'task-1', userId: 'user-1' }
    const stream = makeStream()

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    canUseTask.mockReturnValue(true)
    pipeTaskWorkflowEventsToStream.mockRejectedValue(new Error('stream error'))

    await expect(
      handler({ query: { taskId: 'task-1' } }, stream, mockSession, {})
    ).rejects.toThrow('stream error')
  })

  it('should look up the task with only id and userId selected', async () => {
    const task = { id: 'task-1', userId: 'user-1' }
    const stream = makeStream()

    prisma.task.findUniqueByIdentifier.mockResolvedValue(task)
    canUseTask.mockReturnValue(true)

    await handler({ query: { taskId: 'task-1' } }, stream, mockSession, {})

    expect(prisma.task.findUniqueByIdentifier).toHaveBeenCalledWith(
      mockSession.user,
      'task-1',
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )
  })
})
