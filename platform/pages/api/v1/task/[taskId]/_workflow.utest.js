/* eslint-disable @typescript-eslint/no-require-imports */
import { DEFAULT_LIMITS, PLATFORM_LIMITS } from '@/config/execution'

import prisma from '@/prisma/client'
import {
  MAX_DB_STRING_BYTES_LENGTH,
  MAX_DB_TEXT_BYTES_LENGTH,
} from '@/prisma/constraints'
import { Schedule, TaskOutcome, TaskStatus } from '@/prisma/types'

import { getBotBlock } from '@/lib/bot.block'
import { createConversation } from '@/lib/conversation.create'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { hasConversation } from '@/lib/conversation.find'
import { extractData } from '@/lib/extract.data'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import { getNext } from '@/lib/task.schedule'
import { createTaskWorkflowOperationSink } from '@/lib/task.workflow.channel'
import { sendWorkflowEvent } from '@/lib/workflow'

import handler, { executeTask, getSessionConversationId } from './workflow'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

jest.mock('@/prisma/client', () => {
  const mockPrisma = {
    task: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    taskExecution: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  }

  return {
    __esModule: true,
    default: mockPrisma,
    ...mockPrisma,
  }
})

jest.mock('@/prisma/types', () => ({
  Schedule: {
    never: 'never',
    hourly: 'hourly',
    daily: 'daily',
  },
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

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  ttl: jest.fn(),
}))

jest.mock('@/lib/bot.block', () => ({
  getBotBlock: jest.fn(),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(),
}))

jest.mock('@/lib/conversation.find', () => ({
  hasConversation: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => ({
  accountConversationalLimitsOk: jest.fn(),
}))

jest.mock('@/lib/extract.data', () => ({
  extractData: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/task.workflow.channel', () => ({
  createTaskWorkflowOperationSink: jest.fn(() => ({ push: jest.fn() })),
}))

// @note var is required here so the declaration is hoisted above the jest.mock
// factory, which runs before let/const initialisers
var mockWorkflowConfig

jest.mock('@/lib/workflow', () => ({
  withWorkflowHandler: jest.fn((config) => {
    mockWorkflowConfig = config

    return config.handler
  }),
  sendWorkflowEvent: jest.fn(),
  WorkflowAbortError: class WorkflowAbortError extends Error {
    constructor(message) {
      super(message)
      this.name = 'WorkflowAbortError'
    }
  },
}))

jest.mock('@/lib/task.schedule', () => ({
  getNext: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
}))

jest.mock('@/lib/session.context', () => ({
  updateSessionStore: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  captureException: jest.fn(),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(() => ({})),
}))

jest.mock('@/lib/user.session', () => ({
  userToSessionUser: jest.fn((user) => user),
}))

// -----------------------------------------------------------------------------
// Test Helpers
// -----------------------------------------------------------------------------

function makeTestTask(overrides = {}) {
  return {
    id: 'task-1',
    userId: 'user-1',
    name: 'Test Task',
    description: 'Test task description',
    status: TaskStatus.idle,
    outcome: TaskOutcome.pending,
    schedule: null,
    sessionDuration: null,
    contactId: null,
    meta: { namespace: 'test' },
    user: { id: 'user-1', email: 'test@example.com' },
    bot: { id: 'bot-1', blueprintId: 'blueprint-1' },
    ...overrides,
  }
}

function makeTestEngine(messages = []) {
  return {
    messages,
    complete: jest.fn(),
    addMessages: jest.fn((msgs) =>
      msgs.map((m, i) => ({ ...m, id: `msg-${i}` }))
    ),
    dispose: jest.fn().mockResolvedValue(undefined),
  }
}

function makeContext() {
  return {
    signal: new AbortController().signal,
    runCount: 1,
    remainingRuns: Infinity,
    elapsedTimeMs: 0,
    remainingTimeMs: Infinity,
  }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('queue.execute', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // @note clearAllMocks resets call records but not queued implementations
    // (mockResolvedValueOnce) - reset the block-check mocks so a test that
    // queues a block can't leak it into the next test, which assumes no block.
    getBotBlock.mockReset()
    memcache.ttl.mockReset()

    prisma.taskExecution.findUnique.mockResolvedValue({
      status: TaskStatus.running,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('executeTask', () => {
    it('should send step event with begin state', async () => {
      await executeTask('task-123')

      expect(sendWorkflowEvent).toHaveBeenCalledWith(
        '/api/v1/task/-/workflow',
        { stage: 'begin', taskId: 'task-123' },
        expect.objectContaining({
          workflowId: expect.stringContaining('task-task-123-execute-'),
        })
      )
    })

    it('should pass delay option through', async () => {
      await executeTask('task-123', { delayInSeconds: 30 })

      expect(sendWorkflowEvent).toHaveBeenCalledWith(
        '/api/v1/task/-/workflow',
        { stage: 'begin', taskId: 'task-123' },
        expect.objectContaining({
          delayInSeconds: 30,
          workflowId: expect.any(String),
        })
      )
    })
  })

  describe('handleBegin (via handler)', () => {
    it('should abort if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null)

      await expect(
        handler({ stage: 'begin', taskId: 'nonexistent' }, makeContext())
      ).rejects.toThrow('Task not found')
    })

    it('should abort if task already running', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      accountConversationalLimitsOk.mockResolvedValue(true)
      // Simulate race condition: updateMany returns 0 because task was already running
      prisma.task.updateMany.mockResolvedValue({ count: 0 })

      await expect(
        handler({ stage: 'begin', taskId: 'task-1' }, makeContext())
      ).rejects.toThrow('Task already running or was modified')
    })

    it('should abort if limits exceeded', async () => {
      const task = makeTestTask()

      prisma.task.findUnique.mockResolvedValue(task)
      accountConversationalLimitsOk.mockResolvedValue(false)

      await expect(
        handler({ stage: 'begin', taskId: 'task-1' }, makeContext())
      ).rejects.toThrow('Limits exceeded')
    })

    it('should create new conversation if none exists', async () => {
      const task = makeTestTask()
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(null)

      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)
      createConversation.mockResolvedValue({ id: 'conv-new' })
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        { stage: 'begin', taskId: 'task-1' },
        makeContext()
      )

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          name: 'Test Task',
          taskId: 'task-1',
        })
      )
      expect(memcache.set).toHaveBeenCalled()
      expect(result).toEqual({
        state: expect.objectContaining({
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-new',
          startMessageId: 'msg-0',
        }),
      })
    })

    it('should reuse existing conversation from session', async () => {
      const task = makeTestTask()
      const engine = makeTestEngine([{ id: 'existing-msg' }])

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(null)

      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-existing')
      hasConversation.mockResolvedValue(true)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        { stage: 'begin', taskId: 'task-1' },
        makeContext()
      )

      expect(createConversation).not.toHaveBeenCalled()
      expect(result.state.conversationId).toBe('conv-existing')
      // @note every run injects a fresh task-details turn marker, even on a
      // reused conversation, so each run is clearly delineated
      expect(engine.addMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'instruction' }),
        ])
      )
      expect(result.state.startMessageId).toBe('msg-0')
    })

    it('should update botId in existing conversation if changed', async () => {
      const task = makeTestTask({
        bot: { id: 'new-bot-id', blueprintId: 'bp-1' },
      })
      const engine = makeTestEngine([{ id: 'existing-msg' }])

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(null)
      // Existing conversation has different botId
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-existing',
        botId: 'old-bot-id',
      })

      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-existing')
      hasConversation.mockResolvedValue(true)
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler({ stage: 'begin', taskId: 'task-1' }, makeContext())

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-existing' },
        data: { botId: 'new-bot-id' },
      })
    })

    it('should not update botId if it has not changed', async () => {
      const task = makeTestTask({
        bot: { id: 'same-bot-id', blueprintId: 'bp-1' },
      })
      const engine = makeTestEngine([{ id: 'existing-msg' }])

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(null)
      // Existing conversation has same botId
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-existing',
        botId: 'same-bot-id',
      })

      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue('conv-existing')
      hasConversation.mockResolvedValue(true)
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler({ stage: 'begin', taskId: 'task-1' }, makeContext())

      expect(prisma.conversation.update).not.toHaveBeenCalled()
    })

    it('should inject task context with last execution info', async () => {
      const task = makeTestTask()
      const engine = makeTestEngine()
      const lastExecution = {
        id: 'prev-exec',
        taskId: 'task-1',
        conversationId: 'conv-other',
        name: 'Previous Run',
        summary: 'Completed successfully',
        status: TaskStatus.idle,
        outcome: TaskOutcome.success,
        completedAt: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
        meta: {},
      }

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(lastExecution)

      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)
      createConversation.mockResolvedValue({ id: 'conv-new' })
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler({ stage: 'begin', taskId: 'task-1' }, makeContext())

      // @note should inject messages including last execution context
      expect(engine.addMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'instruction' }),
        ])
      )
    })

    it('should atomically update task status to running', async () => {
      const task = makeTestTask()
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(null)

      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)
      createConversation.mockResolvedValue({ id: 'conv-new' })
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler({ stage: 'begin', taskId: 'task-1' }, makeContext())

      // @note updateMany should set lastRunAt, status, and outcome atomically
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'task-1',
          status: { not: TaskStatus.running },
        },
        data: {
          lastRunAt: expect.any(Date),
          status: TaskStatus.running,
          outcome: TaskOutcome.pending,
        },
      })
    })

    it('should abort if updateMany fails to claim task', async () => {
      const task = makeTestTask()

      prisma.task.findUnique.mockResolvedValue(task)
      accountConversationalLimitsOk.mockResolvedValue(true)
      // Simulate concurrent execution: updateMany returns 0
      prisma.task.updateMany.mockResolvedValue({ count: 0 })

      await expect(
        handler({ stage: 'begin', taskId: 'task-1' }, makeContext())
      ).rejects.toThrow('Task already running or was modified')
    })

    it('should transition to failure state on error after task set to running', async () => {
      const task = makeTestTask()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)
      createConversation.mockRejectedValue(new Error('Creation failed'))

      const result = await handler(
        { stage: 'begin', taskId: 'task-1' },
        makeContext()
      )

      expect(result).toEqual({
        state: {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: null,
          conversationId: null,
          startMessageId: null,
          endMessageId: null,
          errorMessage: 'Creation failed',
        },
      })
    })

    it('should clamp persisted execution limits to platform bounds', async () => {
      const task = makeTestTask({
        maxIterations: PLATFORM_LIMITS.maxIterations + 123,
        maxTime: PLATFORM_LIMITS.maxTime + 123,
      })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(null)

      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)
      createConversation.mockResolvedValue({ id: 'conv-new' })
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        { stage: 'begin', taskId: 'task-1' },
        makeContext()
      )

      expect(result).toEqual({
        state: expect.objectContaining({
          stage: 'work',
          maxIterations: PLATFORM_LIMITS.maxIterations,
          maxTime: PLATFORM_LIMITS.maxTime,
        }),
      })
    })

    it('should use default execution limits for null and low persisted values', async () => {
      const task = makeTestTask({
        maxIterations: 0,
        maxTime: null,
        maxCalls: null,
      })

      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(null)

      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)
      createConversation.mockResolvedValue({ id: 'conv-new' })
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        { stage: 'begin', taskId: 'task-1' },
        makeContext()
      )

      expect(result).toEqual({
        state: expect.objectContaining({
          stage: 'work',
          maxIterations: DEFAULT_LIMITS.maxIterations,
          maxTime: DEFAULT_LIMITS.maxTime,
          maxCalls: DEFAULT_LIMITS.maxCalls,
        }),
      })
    })

    it('should seed a clamped call budget and zero counter', async () => {
      const task = makeTestTask({
        maxCalls: PLATFORM_LIMITS.maxCalls + 123, // above max -> clamped
      })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(null)

      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)
      createConversation.mockResolvedValue({ id: 'conv-new' })
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        { stage: 'begin', taskId: 'task-1' },
        makeContext()
      )

      expect(result).toEqual({
        state: expect.objectContaining({
          stage: 'work',
          maxCalls: PLATFORM_LIMITS.maxCalls,
          callCount: 0,
        }),
      })
    })
  })

  describe('handleWork (via handler)', () => {
    it('should abort if task execution was canceled before work starts', async () => {
      prisma.taskExecution.findUnique.mockResolvedValue({
        status: TaskStatus.canceled,
      })

      await expect(
        handler(
          {
            stage: 'work',
            taskId: 'task-1',
            taskExecutionId: 'exec-1',
            conversationId: 'conv-1',
            startMessageId: null,
          },
          makeContext()
        )
      ).rejects.toThrow('Task execution canceled')

      expect(prisma.task.findUnique).not.toHaveBeenCalled()
      expect(getStatefulConversationEngine).not.toHaveBeenCalled()
    })

    it('should transition to failure if task deleted during execution', async () => {
      prisma.task.findUnique.mockResolvedValue(null)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      expect(result).toEqual({
        state: {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
          errorMessage: 'Task was deleted during execution',
        },
      })
    })

    it('should continue in work stage if engine returns iteration', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'iteration' })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        },
        makeContext()
      )

      expect(result).toEqual({
        state: expect.objectContaining({
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        }),
      })

      expect(createTaskWorkflowOperationSink).toHaveBeenCalledWith({
        userId: task.userId,
        taskId: task.id,
      })

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            sink: expect.any(Object),
            // @note even an unconfigured run seeds + passes the default budget
            maxCalls: DEFAULT_LIMITS.maxCalls,
            callStats: { calls: 0 },
          }),
        })
      )
    })

    it('should end the task without running a step once the call budget is reached', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          maxCalls: 10,
          callCount: 10, // budget already reached
        },
        makeContext()
      )

      // transitions straight to end - the per-step engine is never run
      expect(result.state.stage).toBe('end')
      expect(engine.complete).not.toHaveBeenCalled()
    })

    it('should seed and accumulate call counts across chunks', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      // @note capture the seeded value before mutating - jest stores call args
      // by reference, so the in-place mutation below would otherwise rewrite what
      // toHaveBeenCalledWith sees.
      let seededCallStats

      // simulate the conv function mutating the seeded stats in place
      engine.complete.mockImplementation(async () => {
        const { options } = getStatefulConversationEngine.mock.calls.at(-1)[0]

        seededCallStats = { ...options.callStats }

        options.callStats.calls += 2

        return { reason: 'iteration' }
      })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          maxCalls: 100,
          callCount: 3,
        },
        makeContext()
      )

      // the budget and running total are seeded into the per-step engine...
      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            maxCalls: 100,
          }),
        })
      )
      expect(seededCallStats).toEqual({ calls: 3 })

      // ...and the post-run total is read back and carried forward
      expect(result).toEqual({
        state: expect.objectContaining({
          stage: 'work',
          maxCalls: 100,
          callCount: 5,
        }),
      })
    })

    it('should add a 50% progress activity when iteration usage reaches the threshold', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'iteration' })

      prisma.task.findUnique.mockResolvedValue(task)
      accountConversationalLimitsOk.mockResolvedValue(true)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          iterationCount: 4,
          maxIterations: 10,
          maxTime: 100000,
          startedAt: Date.now(),
        },
        makeContext()
      )

      expect(engine.addMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'activity',
            meta: expect.objectContaining({
              activity: expect.objectContaining({
                type: 'response',
                function: expect.objectContaining({
                  name: '_checkTaskRunStatus',
                  result: expect.objectContaining({
                    status: 'progress_threshold',
                    threshold: 50,
                    reasons: ['maxIterations'],
                  }),
                }),
              }),
            }),
          }),
        ])
      )

      expect(result.state).toEqual(
        expect.objectContaining({
          stage: 'work',
          notifiedThresholds: [50],
        })
      )
    })

    it('should add only the next pending progress activity when one iteration crosses multiple thresholds', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'iteration' })

      prisma.task.findUnique.mockResolvedValue(task)
      accountConversationalLimitsOk.mockResolvedValue(true)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const now = Date.now()

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          iterationCount: 0,
          maxIterations: 10,
          maxTime: 1000,
          startedAt: now - 900,
          notifiedThresholds: [50],
        },
        makeContext()
      )

      const addedMessages = engine.addMessages.mock.calls[0][0]

      expect(addedMessages).toHaveLength(2)
      expect(addedMessages[1]).toEqual(
        expect.objectContaining({
          type: 'activity',
          meta: expect.objectContaining({
            activity: expect.objectContaining({
              type: 'response',
              function: expect.objectContaining({
                name: '_checkTaskRunStatus',
                result: expect.objectContaining({
                  status: 'progress_threshold',
                  threshold: 80,
                  reasons: ['maxTime'],
                }),
              }),
            }),
          }),
        })
      )

      expect(result.state).toEqual(
        expect.objectContaining({
          stage: 'work',
          notifiedThresholds: [50, 80],
        })
      )
    })

    it('should not repeat a progress activity after the threshold was already announced', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'iteration' })

      prisma.task.findUnique.mockResolvedValue(task)
      accountConversationalLimitsOk.mockResolvedValue(true)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          iterationCount: 5,
          maxIterations: 10,
          maxTime: 100000,
          startedAt: Date.now(),
          notifiedThresholds: [50],
        },
        makeContext()
      )

      expect(engine.addMessages).not.toHaveBeenCalled()
      expect(result.state).toEqual(
        expect.objectContaining({
          stage: 'work',
          notifiedThresholds: [50],
        })
      )
    })

    it('should transition to end stage when engine completes', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'complete' })
      engine.addMessages.mockResolvedValue([{ id: 'status-msg' }])

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        },
        makeContext()
      )

      expect(result).toEqual({
        state: {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          endMessageId: 'status-msg',
        },
      })
    })

    it('should abort if task execution is canceled while the engine is running', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'complete' })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.taskExecution.findUnique
        .mockResolvedValueOnce({ status: TaskStatus.running })
        .mockResolvedValueOnce({ status: TaskStatus.canceled })
      getStatefulConversationEngine.mockResolvedValue(engine)

      await expect(
        handler(
          {
            stage: 'work',
            taskId: 'task-1',
            taskExecutionId: 'exec-1',
            conversationId: 'conv-1',
            startMessageId: 'start-msg',
          },
          makeContext()
        )
      ).rejects.toThrow('Task execution canceled')

      expect(engine.addMessages).not.toHaveBeenCalled()
    })

    it('should abort the engine signal if task execution is canceled during a step', async () => {
      jest.useFakeTimers()

      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()
      let engineSignal
      let resolveComplete

      engine.complete.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveComplete = resolve
          })
      )

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.taskExecution.findUnique.mockResolvedValue({
        status: TaskStatus.running,
      })
      getStatefulConversationEngine.mockImplementation(async (config) => {
        engineSignal = config.options.signal

        return engine
      })

      const result = handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        },
        makeContext()
      )

      await Promise.resolve()

      prisma.taskExecution.findUnique.mockResolvedValue({
        status: TaskStatus.canceled,
      })

      await jest.advanceTimersByTimeAsync(5000)

      expect(engineSignal.aborted).toBe(true)
      expect(engineSignal.reason).toEqual(
        expect.objectContaining({ message: 'Task execution canceled' })
      )

      resolveComplete({ reason: 'complete' })

      await expect(result).rejects.toThrow('Task execution canceled')

      jest.useRealTimers()
    })

    it('should add _checkTaskRunStatus activity when complete', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'complete' })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      // @note activity messages use type 'activity' not 'context'
      expect(engine.addMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'activity' }),
          expect.objectContaining({ type: 'activity' }),
        ])
      )
    })

    it('should use maxIterations=1 for single-step mode', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'complete' })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            maxIterations: 1,
          }),
        })
      )
    })

    it('should transition to failure state on engine error', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine([{ id: 'last-msg' }])

      engine.complete.mockRejectedValue(new Error('Engine failed'))

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        },
        makeContext()
      )

      expect(result).toEqual({
        state: {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          endMessageId: 'last-msg',
          errorMessage: 'Engine failed',
        },
      })
    })

    it('should expose _delay internal function to the engine', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'complete' })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            internalFunctions: expect.arrayContaining([
              expect.objectContaining({
                name: '_delay',
                handler: expect.any(Function),
              }),
            ]),
          }),
        })
      )
    })

    it('should propagate delaySeconds when _delay handler is invoked', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockImplementation(async () => {
        // Simulate the engine calling the _delay handler during complete()
        const call = getStatefulConversationEngine.mock.calls[0][0]
        const delayFn = call.options.internalFunctions.find(
          (f) => f.name === '_delay'
        )

        delayFn.handler({ seconds: 30 })

        return { reason: 'iteration' }
      })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      expect(result.delaySeconds).toBe(30)
      expect(result.state).toEqual(expect.objectContaining({ stage: 'work' }))
    })

    it('should clamp delay to maximum allowed seconds', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockImplementation(async () => {
        const call = getStatefulConversationEngine.mock.calls[0][0]
        const delayFn = call.options.internalFunctions.find(
          (f) => f.name === '_delay'
        )

        delayFn.handler({ seconds: 99999 })

        return { reason: 'iteration' }
      })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      expect(result.delaySeconds).toBe(300)
    })

    it('should clamp delay minimum to 1 second', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockImplementation(async () => {
        const call = getStatefulConversationEngine.mock.calls[0][0]
        const delayFn = call.options.internalFunctions.find(
          (f) => f.name === '_delay'
        )

        delayFn.handler({ seconds: -5 })

        return { reason: 'iteration' }
      })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      expect(result.delaySeconds).toBe(1)
    })

    it('pauses (re-queues the same step, delayed) when a bot block lifts before the session expires', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      accountConversationalLimitsOk.mockResolvedValue(true)
      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      getBotBlock.mockResolvedValueOnce({
        reason: 'This bot has been temporarily disabled by a usage policy.',
        ttl: 60,
      })
      memcache.ttl.mockResolvedValueOnce(3600) // session still has an hour

      // a recent start so the per-task maxTime budget isn't already exhausted
      const startedAt = Date.now()

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          iterationCount: 2,
          callCount: 4,
          startedAt,
        },
        makeContext()
      )

      // re-queued as the SAME work step, delayed until just after the block lifts
      expect(result.state.stage).toBe('work')
      expect(result.delaySeconds).toBe(65) // ttl + BLOCK_RESUME_BUFFER_SECONDS

      // the involuntary pause must not burn the iteration / call budget
      expect(result.state.iterationCount).toBe(2)
      expect(result.state.callCount).toBe(4)

      // startedAt advanced by the pause so the wait doesn't eat the maxTime budget
      expect(result.state.startedAt).toBe(startedAt + 65_000)

      // the engine is never run for a paused step
      expect(engine.complete).not.toHaveBeenCalled()
    })

    it('records a paused checkpoint when it pauses for a bot block', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      accountConversationalLimitsOk.mockResolvedValue(true)
      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      getBotBlock.mockResolvedValueOnce({
        reason: 'This bot has been temporarily disabled by a usage policy.',
        ttl: 60,
      })
      memcache.ttl.mockResolvedValueOnce(3600)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          startedAt: Date.now(),
        },
        makeContext()
      )

      expect(result.delaySeconds).toBe(65)

      // the pause is surfaced to the agent as a paused checkpoint carrying the
      // wait duration so the resumed run can account for the gap
      expect(engine.addMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'activity',
            meta: expect.objectContaining({
              activity: expect.objectContaining({
                type: 'response',
                function: expect.objectContaining({
                  name: '_checkTaskRunStatus',
                  result: expect.objectContaining({
                    status: 'paused',
                    source: 'usage_policy',
                    seconds: 65,
                  }),
                }),
              }),
            }),
          }),
        ])
      )
    })

    it('records a paused checkpoint when the agent requests a _delay', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockImplementation(async () => {
        const call = getStatefulConversationEngine.mock.calls[0][0]
        const delayFn = call.options.internalFunctions.find(
          (f) => f.name === '_delay'
        )

        delayFn.handler({ seconds: 45 })

        return { reason: 'iteration' }
      })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      expect(result.delaySeconds).toBe(45)

      expect(engine.addMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'activity',
            meta: expect.objectContaining({
              activity: expect.objectContaining({
                type: 'response',
                function: expect.objectContaining({
                  name: '_checkTaskRunStatus',
                  result: expect.objectContaining({
                    status: 'paused',
                    source: 'requested',
                    seconds: 45,
                  }),
                }),
              }),
            }),
          }),
        ])
      )
    })

    it('heartbeats the execution stalled deadline on each work step', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'iteration' })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const before = Date.now()

      await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      const after = Date.now()

      // the step pushes the stalled-reaper deadline ~1h into the future so an
      // actively-progressing run is never mistaken for a stuck one
      const heartbeat = prisma.taskExecution.update.mock.calls.find(
        (c) =>
          c[0]?.where?.id === 'exec-1' &&
          c[0]?.data?.keepAliveUntil instanceof Date
      )

      expect(heartbeat).toBeDefined()

      const ONE_HOUR = 60 * 60 * 1000
      const deadline = heartbeat[0].data.keepAliveUntil.getTime()

      expect(deadline).toBeGreaterThanOrEqual(before + ONE_HOUR)
      expect(deadline).toBeLessThanOrEqual(after + ONE_HOUR + 1000)

      // a plain step is not a pause, so the API-facing resumeAt is cleared
      expect(heartbeat[0].data.resumeAt).toBeNull()
    })

    it('extends the stalled deadline over a bot-block pause', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      accountConversationalLimitsOk.mockResolvedValue(true)
      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      getBotBlock.mockResolvedValueOnce({
        reason: 'This bot has been temporarily disabled by a usage policy.',
        ttl: 60,
      })
      memcache.ttl.mockResolvedValueOnce(3600)

      const before = Date.now()

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          startedAt: Date.now(),
        },
        makeContext()
      )

      const after = Date.now()

      expect(result.delaySeconds).toBe(65)

      // the last heartbeat covers the whole pause: now + pause + 1h grace
      const heartbeats = prisma.taskExecution.update.mock.calls.filter(
        (c) => c[0]?.data?.keepAliveUntil instanceof Date
      )

      const ONE_HOUR = 60 * 60 * 1000
      const lastHeartbeat = heartbeats[heartbeats.length - 1][0].data
      const deadline = lastHeartbeat.keepAliveUntil.getTime()

      expect(deadline).toBeGreaterThanOrEqual(before + 65_000 + ONE_HOUR)
      expect(deadline).toBeLessThanOrEqual(after + 65_000 + ONE_HOUR + 1000)

      // resumeAt surfaces the exact resume time (no grace) so a caller can wait
      const resumeAt = lastHeartbeat.resumeAt.getTime()

      expect(resumeAt).toBeGreaterThanOrEqual(before + 65_000)
      expect(resumeAt).toBeLessThanOrEqual(after + 65_000 + 1000)
    })

    it('extends the stalled deadline over an agent-requested _delay', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockImplementation(async () => {
        const call = getStatefulConversationEngine.mock.calls[0][0]
        const delayFn = call.options.internalFunctions.find(
          (f) => f.name === '_delay'
        )

        delayFn.handler({ seconds: 45 })

        return { reason: 'iteration' }
      })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const before = Date.now()

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      const after = Date.now()

      expect(result.delaySeconds).toBe(45)

      const heartbeats = prisma.taskExecution.update.mock.calls.filter(
        (c) => c[0]?.data?.keepAliveUntil instanceof Date
      )

      const ONE_HOUR = 60 * 60 * 1000
      const lastHeartbeat = heartbeats[heartbeats.length - 1][0].data
      const deadline = lastHeartbeat.keepAliveUntil.getTime()

      expect(deadline).toBeGreaterThanOrEqual(before + 45_000 + ONE_HOUR)
      expect(deadline).toBeLessThanOrEqual(after + 45_000 + ONE_HOUR + 1000)

      // resumeAt surfaces the exact resume time (no grace) so a caller can wait
      const resumeAt = lastHeartbeat.resumeAt.getTime()

      expect(resumeAt).toBeGreaterThanOrEqual(before + 45_000)
      expect(resumeAt).toBeLessThanOrEqual(after + 45_000 + 1000)
    })

    it('fails when the bot block outlasts the remaining session', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      accountConversationalLimitsOk.mockResolvedValue(true)
      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      getBotBlock.mockResolvedValueOnce({
        reason: 'This bot has been temporarily disabled by a usage policy.',
        ttl: 7200, // 2h block
      })
      memcache.ttl.mockResolvedValueOnce(60) // session nearly expired

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        },
        makeContext()
      )

      expect(result.state.stage).toBe('failure')
      expect(result.state.errorMessage).toBe(
        'This bot has been temporarily disabled by a usage policy.'
      )
      expect(engine.complete).not.toHaveBeenCalled()
    })

    it('fails on a bot block when the task has no session (sessionDuration 0)', async () => {
      const task = makeTestTask({
        status: TaskStatus.running,
        sessionDuration: 0,
      })
      const engine = makeTestEngine()

      accountConversationalLimitsOk.mockResolvedValue(true)
      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      getBotBlock.mockResolvedValueOnce({
        reason: 'This bot has been temporarily disabled by a usage policy.',
        ttl: 30,
      })

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        },
        makeContext()
      )

      // no session → no remaining session time → cannot resume → fail
      expect(result.state.stage).toBe('failure')
      expect(memcache.ttl).not.toHaveBeenCalled()
      expect(engine.complete).not.toHaveBeenCalled()
    })

    it('fails when the block fits the session but not the workflow time budget', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      accountConversationalLimitsOk.mockResolvedValue(true)
      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      getBotBlock.mockResolvedValueOnce({
        reason: 'This bot has been temporarily disabled by a usage policy.',
        ttl: 3600, // 1h block, well within the session...
      })
      memcache.ttl.mockResolvedValueOnce(7200) // session has 2h left

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        },
        // ...but the workflow's own remaining time budget can't hold the pause
        { ...makeContext(), remainingTimeMs: 1000 }
      )

      expect(result.state.stage).toBe('failure')
      expect(engine.complete).not.toHaveBeenCalled()
    })

    it('fails when the session mapping has already expired (ttl <= 0)', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      accountConversationalLimitsOk.mockResolvedValue(true)
      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      getBotBlock.mockResolvedValueOnce({
        reason: 'This bot has been temporarily disabled by a usage policy.',
        ttl: 30,
      })
      memcache.ttl.mockResolvedValueOnce(-2) // key gone → no remaining session

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        },
        makeContext()
      )

      // persisted session was consulted, but it's gone → cannot resume → fail
      expect(memcache.ttl).toHaveBeenCalled()
      expect(result.state.stage).toBe('failure')
      expect(engine.complete).not.toHaveBeenCalled()
    })
  })

  describe('handleEnd (via handler)', () => {
    it('should not overwrite a canceled task execution', async () => {
      prisma.taskExecution.findUnique.mockResolvedValue({
        status: TaskStatus.canceled,
      })

      const result = await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          endMessageId: 'end-msg',
        },
        makeContext()
      )

      expect(result).toBeNull()
      expect(prisma.task.findUnique).not.toHaveBeenCalled()
      expect(prisma.taskExecution.update).not.toHaveBeenCalled()
    })

    it('should return null if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null)

      const result = await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          endMessageId: 'end-msg',
        },
        makeContext()
      )

      expect(result).toBeNull()
    })

    it('should extract summary from conversation', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine([
        { id: 'msg-1', text: 'Hello' },
        { id: 'msg-2', text: 'World' },
      ])

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({
        data: {
          name: 'Extracted Name',
          description: 'Extracted Description',
          summary: 'Detailed summary of execution',
        },
      })

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          endMessageId: 'end-msg',
        },
        makeContext()
      )

      expect(extractData).toHaveBeenCalled()
      expect(prisma.taskExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          name: 'Extracted Name',
          description: 'Extracted Description',
          summary: 'Detailed summary of execution',
          status: TaskStatus.idle,
          outcome: TaskOutcome.success,
        }),
      })

      // the conversation is relabeled to reflect what the run actually did
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: {
          name: 'Extracted Name',
          description: 'Extracted Description',
        },
      })
    })

    it('should not relabel the conversation when extraction yields no name or description', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({ data: {} })

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      // guard keeps the task-derived label the conversation got at creation
      expect(prisma.conversation.update).not.toHaveBeenCalled()
    })

    it('should constrain name to the active database string limit', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()
      const longName = 'A'.repeat(300)

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({
        data: {
          name: longName,
          description: 'A description',
          summary: 'A summary',
        },
      })

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      expect(prisma.taskExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          name: longName.slice(0, MAX_DB_STRING_BYTES_LENGTH),
        }),
      })
    })

    it('should constrain description to the active database text limit', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()
      const longDescription = 'B'.repeat(70000)

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({
        data: {
          name: 'A name',
          description: longDescription,
          summary: 'A summary',
        },
      })

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      const callArg = prisma.taskExecution.update.mock.calls[0][0]

      expect(callArg.data.description).toBe(
        longDescription.slice(0, MAX_DB_TEXT_BYTES_LENGTH)
      )
    })

    it('should constrain summary to the active database text limit', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()
      const longSummary = 'S'.repeat(70000)

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({
        data: {
          name: 'A name',
          description: 'A description',
          summary: longSummary,
        },
      })

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      const callArg = prisma.taskExecution.update.mock.calls[0][0]

      expect(callArg.data.summary).toBe(
        longSummary.slice(0, MAX_DB_TEXT_BYTES_LENGTH)
      )
    })

    // BUG #1: name ternary has a dead `|| undefined` that should be removed.
    // This test confirms the intended behavior: empty-string name should
    // result in no name override (fallback to default summary constant).
    it('should not set a name when extractData returns an empty string', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({
        data: {
          name: '',
          description: 'A description',
          summary: 'A summary',
        },
      })

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      const callArg = prisma.taskExecution.update.mock.calls[0][0]

      // Empty string name should be treated as undefined (no name override)
      expect(callArg.data.name).toBeUndefined()
    })

    it('should update task status to idle with success', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({ data: {} })

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.success,
          nextRunAt: null, // No schedule, so nextRunAt should be null
        },
      })
    })

    it('should update nextRunAt for scheduled tasks', async () => {
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: Schedule.daily,
      })
      const engine = makeTestEngine()
      const nextRun = new Date(Date.now() + 86400000)

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({ data: {} })
      getNext.mockReturnValue(nextRun)

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      // @note status and nextRunAt should be updated in a single atomic call
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.success,
          nextRunAt: nextRun,
        },
      })
    })

    it('should set nextRunAt to null when getNext returns a past date', async () => {
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: Schedule.daily,
      })
      const engine = makeTestEngine()
      // getNext returns a date in the past (expired schedule)
      const pastDate = new Date(Date.now() - 86400000)

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({ data: {} })
      getNext.mockReturnValue(pastDate)

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      // @note nextRunAt should be set to null when getNext returns past date
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: TaskStatus.idle,
          outcome: TaskOutcome.success,
          nextRunAt: null,
        }),
      })
    })

    it('should set nextRunAt to null when schedule is null', async () => {
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: null,
      })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({ data: {} })

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      // @note nextRunAt should be null when there's no schedule
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: TaskStatus.idle,
          outcome: TaskOutcome.success,
          nextRunAt: null,
        }),
      })
    })

    it('should use single atomic update for status and nextRunAt', async () => {
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: Schedule.daily,
      })
      const engine = makeTestEngine()
      const nextRun = new Date(Date.now() + 86400000)

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({ data: {} })
      getNext.mockReturnValue(nextRun)

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      // @note status and nextRunAt should be updated in a single call
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: TaskStatus.idle,
          outcome: TaskOutcome.success,
          nextRunAt: nextRun,
        }),
      })
    })

    it('should log task completion event', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({ data: {} })

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-1' },
          type: 'task.interact.completed',
          relations: expect.objectContaining({
            taskId: 'task-1',
            taskExecutionId: 'exec-1',
          }),
        })
      )
    })

    it('should handle extractData failure gracefully', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockRejectedValue(new Error('Extract failed'))

      // @note should not throw, just use fallback summary
      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      expect(prisma.taskExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          summary: 'Task completed successfully',
        }),
      })
    })
  })

  describe('handleFailure (via handler)', () => {
    it('should return null if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null)

      const result = await handler(
        {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
          errorMessage: 'Something failed',
        },
        makeContext()
      )

      expect(result).toBeNull()
    })

    it('should update task execution with failure status and close the transcript with a failed marker', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)

      await handler(
        {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          endMessageId: 'end-msg',
          errorMessage: 'Task failed with error',
        },
        makeContext()
      )

      // a terminal `_checkTaskRunStatus { status: 'failed' }` marker is injected
      // so the transcript ends with a resolution instead of dead-ending
      expect(engine.addMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            meta: expect.objectContaining({
              activity: expect.objectContaining({
                function: expect.objectContaining({
                  name: '_checkTaskRunStatus',
                }),
              }),
            }),
          }),
        ])
      )

      expect(prisma.taskExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          completedAt: expect.any(Date),
          startMessageId: 'start-msg',
          // endMessageId now points at the injected marker (last message)
          endMessageId: 'msg-1',
          summary: 'Task failed with error',
        },
      })
    })

    it('should update task status to idle with failure', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})

      await handler(
        {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: null, // No schedule, so nextRunAt should be null
        },
      })
    })

    it('should handle null taskExecutionId', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)

      await handler(
        {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: null,
          conversationId: null,
          startMessageId: null,
          endMessageId: null,
          errorMessage: 'Early failure',
        },
        makeContext()
      )

      // @note should not try to update execution if id is null
      expect(prisma.taskExecution.update).not.toHaveBeenCalled()
      expect(prisma.task.update).toHaveBeenCalled()
    })

    it('should update nextRunAt for scheduled tasks on failure', async () => {
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: Schedule.hourly,
      })
      const nextRun = new Date(Date.now() + 3600000)

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getNext.mockReturnValue(nextRun)

      await handler(
        {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      // @note status and nextRunAt should be updated in a single atomic call
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: nextRun,
        },
      })
    })

    it('should set nextRunAt to null on failure when getNext returns a past date', async () => {
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: Schedule.hourly,
      })
      // getNext returns a date in the past (expired schedule)
      const pastDate = new Date(Date.now() - 3600000)

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getNext.mockReturnValue(pastDate)

      await handler(
        {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      // @note nextRunAt should be set to null when getNext returns past date
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: null,
        }),
      })
    })

    it('should use single atomic update for status and nextRunAt on failure', async () => {
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: Schedule.hourly,
      })
      const nextRun = new Date(Date.now() + 3600000)

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getNext.mockReturnValue(nextRun)

      await handler(
        {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      // @note status and nextRunAt should be updated in a single call
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: nextRun,
        }),
      })
    })

    it('should log completion event on failure', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})

      await handler(
        {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-1' },
          type: 'task.interact.completed',
          relations: expect.objectContaining({
            taskId: 'task-1',
            taskExecutionId: 'exec-1',
          }),
        })
      )
    })
  })

  describe('state transitions', () => {
    it('should follow happy path: begin -> work -> end', async () => {
      const task = makeTestTask()
      const engine = makeTestEngine()

      // Setup for begin
      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(null)
      prisma.taskExecution.update.mockResolvedValue({})
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)
      createConversation.mockResolvedValue({ id: 'conv-1' })
      getStatefulConversationEngine.mockResolvedValue(engine)
      engine.complete.mockResolvedValue({ reason: 'complete' })
      extractData.mockResolvedValue({ data: { summary: 'Done' } })

      // Begin
      const workResult = await handler(
        { stage: 'begin', taskId: 'task-1' },
        makeContext()
      )

      expect(workResult.state.stage).toBe('work')

      // Work
      prisma.task.findUnique.mockResolvedValue({
        ...task,
        status: TaskStatus.running,
      })

      const endResult = await handler(workResult.state, makeContext())

      expect(endResult.state.stage).toBe('end')

      // End
      const result = await handler(endResult.state, makeContext())

      expect(result).toBeNull()
    })

    it('should follow failure path: begin -> work -> failure', async () => {
      const task = makeTestTask()
      const engine = makeTestEngine()

      // Setup for begin
      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.task.updateMany.mockResolvedValue({ count: 1 })
      prisma.taskExecution.create.mockResolvedValue({ id: 'exec-1' })
      prisma.taskExecution.findFirst.mockResolvedValue(null)
      prisma.taskExecution.update.mockResolvedValue({})
      accountConversationalLimitsOk.mockResolvedValue(true)
      memcache.get.mockResolvedValue(null)
      createConversation.mockResolvedValue({ id: 'conv-1' })
      getStatefulConversationEngine.mockResolvedValue(engine)

      // Begin
      const workResult = await handler(
        { stage: 'begin', taskId: 'task-1' },
        makeContext()
      )

      expect(workResult.state.stage).toBe('work')

      // Work - simulate engine failure
      prisma.task.findUnique.mockResolvedValue({
        ...task,
        status: TaskStatus.running,
      })
      engine.complete.mockRejectedValue(new Error('Engine crashed'))

      const failureResult = await handler(workResult.state, makeContext())

      expect(failureResult.state.stage).toBe('failure')
      expect(failureResult.state.errorMessage).toBe('Engine crashed')

      // Failure
      const result = await handler(failureResult.state, makeContext())

      expect(result).toBeNull()
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: null, // No schedule, so nextRunAt should be null
        },
      })
    })
  })

  // -------------------------------------------------------------------------
  // Bug Fix Tests - Iteration Limits and Error Handling
  // -------------------------------------------------------------------------

  describe('iteration limit checks', () => {
    it('should run exactly maxIterations iterations, not one less', async () => {
      const task = makeTestTask({
        status: TaskStatus.running,
        maxIterations: 5,
      })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'iteration' })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      // Start at iteration 0
      let state = {
        stage: 'work',
        taskId: 'task-1',
        taskExecutionId: 'exec-1',
        conversationId: 'conv-1',
        startMessageId: null,
        maxIterations: 5,
        maxTime: null,
        iterationCount: 0,
        startedAt: Date.now(),
      }

      // Iteration 1
      let result = await handler(state, makeContext())

      state = result.state
      expect(state.stage).toBe('work')
      expect(state.iterationCount).toBe(1)

      // Iteration 2
      result = await handler(state, makeContext())
      state = result.state
      expect(state.stage).toBe('work')
      expect(state.iterationCount).toBe(2)

      // Iteration 3
      result = await handler(state, makeContext())
      state = result.state
      expect(state.stage).toBe('work')
      expect(state.iterationCount).toBe(3)

      // Iteration 4
      result = await handler(state, makeContext())
      state = result.state
      expect(state.stage).toBe('work')
      expect(state.iterationCount).toBe(4)

      // Iteration 5 - should still run (not stop at 4)
      result = await handler(state, makeContext())
      state = result.state
      expect(state.stage).toBe('work')
      expect(state.iterationCount).toBe(5)

      // Iteration 6 - NOW should hit limit and stop
      result = await handler(state, makeContext())
      state = result.state
      expect(state.stage).toBe('end')
    })

    it('should exceed limit only when current iteration is greater than max', async () => {
      const task = makeTestTask({
        status: TaskStatus.running,
        maxIterations: 3,
      })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'iteration' })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      // At iteration count 2, next would be 3 (which equals maxIterations)
      // Should still run iteration 3
      let state = {
        stage: 'work',
        taskId: 'task-1',
        taskExecutionId: 'exec-1',
        conversationId: 'conv-1',
        startMessageId: null,
        maxIterations: 3,
        maxTime: null,
        iterationCount: 2,
        startedAt: Date.now(),
      }

      let result = await handler(state, makeContext())

      state = result.state
      expect(state.stage).toBe('work')
      expect(state.iterationCount).toBe(3)

      // Now at iteration 3, next would be 4 (which is > maxIterations)
      // Should transition to end
      result = await handler(state, makeContext())
      state = result.state
      expect(state.stage).toBe('end')
    })
  })

  describe('error completion handling', () => {
    it('should transition to failure when engine returns error reason', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine([{ id: 'last-msg' }])

      // Engine completes with 'error' reason
      engine.complete.mockResolvedValue({ reason: 'error' })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        },
        makeContext()
      )

      // Should transition to failure, not end
      expect(result).toEqual({
        state: {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
          endMessageId: 'last-msg',
          errorMessage: 'Conversation engine returned error',
        },
      })
    })

    // @note `errorMessage` reaches the agent (as the `_checkTaskRunStatus`
    // activity `reason`) and the user (as the task execution `summary`), so the
    // underlying provider error must NOT be interpolated into it - that would
    // leak infrastructure detail. It belongs in the debug log and Sentry only.
    it('should not leak the underlying provider error into the failure message', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine([{ id: 'last-msg' }])

      engine.complete.mockResolvedValue({
        reason: 'error',
        error: {
          code: 'VR_SERVICE_UNAVAILABLE',
          message:
            'Service temporarily unavailable. Please try again shortly. (503)',
        },
      })

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: 'start-msg',
        },
        makeContext()
      )

      expect(result.state.stage).toBe('failure')
      expect(result.state.errorMessage).toBe(
        'Conversation engine returned error'
      )
      expect(result.state.errorMessage).not.toMatch(/503|unavailable/i)
    })

    it('should mark task execution as failure when error reason received', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'error' })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)

      // Work stage with error
      const failureResult = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      expect(failureResult.state.stage).toBe('failure')

      // Process failure stage
      await handler(failureResult.state, makeContext())

      expect(prisma.taskExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: expect.objectContaining({
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          summary: 'Conversation engine returned error',
        }),
      })
    })

    it('should still transition to end for stop reason', async () => {
      // @note in settle mode the engine converts an unsettled `stop` into a
      // nudged `iteration` before it ever reaches handleWork, so a raw `stop`
      // here (engine mocked) is treated as a terminal completion.
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'stop' })
      engine.addMessages.mockResolvedValue([{ id: 'status-msg' }])

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      expect(result.state.stage).toBe('end')
    })

    it('should still transition to end for length reason', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      engine.complete.mockResolvedValue({ reason: 'length' })
      engine.addMessages.mockResolvedValue([{ id: 'status-msg' }])

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeContext()
      )

      expect(result.state.stage).toBe('end')
    })
  })

  // Note: TaskStatus has no 'paused' state.

  // ---------------------------------------------------------------------------
  // BUG TESTS
  // Each test asserts the desired (correct) behavior and FAILS today, proving
  // the bug is real. Fix the source, these turn green.
  // ---------------------------------------------------------------------------

  describe('bugs', () => {
    // BUG: when handleWork hits the internal iteration or time limit, it
    // transitions directly to 'end' with endMessageId: null and no activity
    // message. The agent never learns why execution stopped - it just ends.
    // Desired behavior: a _checkTaskRunStatus activity with status
    // 'limit_exceeded' is injected so the agent has context.
    it('should inject a _checkTaskRunStatus activity message when internal iteration limit is exceeded', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)

      // iterationCount: 100 with maxIterations: 100 → currentIteration=101 > 100, limit hit
      await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          maxIterations: 100,
          maxTime: null,
          iterationCount: 100,
          startedAt: Date.now(),
        },
        makeContext()
      )

      // An activity message pair must be added to tell the agent it was cut short
      expect(engine.addMessages).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ type: 'activity' })])
      )
    })

    // BUG: the platform-level limit handler is 'stop', which means when
    // PLATFORM_LIMITS.maxIterations or PLATFORM_LIMITS.maxTime is exceeded,
    // the task DB record is left with status: 'running' forever. No cleanup
    // runs, no nextRunAt is set for scheduled tasks, and the task is
    // permanently stuck - it can never be re-executed.
    // Desired behavior: both platform callbacks are functions that clean up
    // the task (set status back to idle) rather than the bare string 'stop'.
    it('should use callback functions (not stop) for platform limit handlers so task is cleaned up', () => {
      expect(typeof mockWorkflowConfig.onMaxRunsExceeded).toBe('function')
      expect(typeof mockWorkflowConfig.onMaxTimeExceeded).toBe('function')
    })

    // BUG: in handleWork the new limit-exceeded block calls
    // getStatefulConversationEngine + addMessages without error handling.
    // If the activity injection throws, the exception falls through to the
    // outer catch(error) and the result becomes FailureState instead of EndState.
    // Desired: even when activity injection fails, we still transition to 'end'.
    it('should transition to end (not failure) when activity injection throws inside limit-exceeded path', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      // Engine throws when loaded inside the limit path
      getStatefulConversationEngine.mockRejectedValueOnce(
        new Error('engine unavailable')
      )

      const result = await handler(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          maxIterations: 100,
          maxTime: null,
          iterationCount: 100,
          startedAt: Date.now(),
        },
        makeContext()
      )

      // Must still be 'end', activity failure is non-fatal
      expect(result.state.stage).toBe('end')
    })

    // BUG: in handleEnd, prisma.taskExecution.update and prisma.task.update
    // are sequential with no error handling between them. If the execution
    // update throws, task.update is never reached and the task stays 'running'.
    // Desired: task status is always reset to idle even if the execution
    // record update fails.
    it('should still reset task status to idle when taskExecution update throws in handleEnd', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.taskExecution.update.mockRejectedValueOnce(new Error('DB timeout'))
      prisma.task.update.mockResolvedValue(task)
      getStatefulConversationEngine.mockResolvedValue(engine)
      extractData.mockResolvedValue({ data: {} })

      await handler(
        {
          stage: 'end',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
        },
        makeContext()
      )

      // task.update must still be called to release the running lock
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: TaskStatus.idle }),
        })
      )
    })

    // BUG: in handleFailure, prisma.taskExecution.update runs before
    // prisma.task.update with no error handling between them. If the execution
    // update throws, task.update is never reached - task stays 'running'.
    // Desired: task status is always reset to idle even if the execution
    // record update fails.
    it('should still reset task status to idle when taskExecution update throws in handleFailure', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.taskExecution.update.mockRejectedValueOnce(new Error('DB timeout'))
      prisma.task.update.mockResolvedValue(task)

      await handler(
        {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
          errorMessage: 'Something failed',
        },
        makeContext()
      )

      // task.update must still be called to release the running lock
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: TaskStatus.idle }),
        })
      )
    })

    it('should still release the running lock when the failure-marker injection throws', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      // the marker injection engine fails to load - must be swallowed, not fatal
      getStatefulConversationEngine.mockRejectedValueOnce(
        new Error('engine unavailable')
      )

      await handler(
        {
          stage: 'failure',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
          endMessageId: null,
          errorMessage: 'Something failed',
        },
        makeContext()
      )

      // execution + task are still finalized despite the injection failure
      expect(prisma.taskExecution.update).toHaveBeenCalled()
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: TaskStatus.idle }),
        })
      )
    })

    // BUG: when PLATFORM_LIMITS.maxIterations or PLATFORM_LIMITS.maxTime is
    // exceeded, nextRunAt was not updated - the old past-timestamp remained
    // in the DB, causing the task to re-fire on every queue tick forever.
    // Desired: handlePlatformLimitExceeded updates nextRunAt just like
    // handleEnd and handleFailure do.
    it('should update nextRunAt when platform limit is exceeded', async () => {
      const nextRun = new Date(Date.now() + 86400000)
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: 'daily',
      })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      getNext.mockReturnValue(nextRun)

      await mockWorkflowConfig.onMaxRunsExceeded({
        stage: 'work',
        taskId: 'task-1',
        taskExecutionId: 'exec-1',
        conversationId: 'conv-1',
      })

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            nextRunAt: nextRun,
          }),
        })
      )
    })

    // BUG: handlePlatformLimitExceeded uses two separate prisma.task.update
    // calls and only sets nextRunAt when valid - never clears it to null.
    // Desired: use single atomic update that also clears nextRunAt when
    // schedule returns a past date.
    it('should set nextRunAt to null on platform limit when getNext returns a past date', async () => {
      const pastDate = new Date(Date.now() - 60000)
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: 'daily',
      })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      getNext.mockReturnValue(pastDate)

      // Invoke onMaxRunsExceeded callback
      await mockWorkflowConfig.onMaxRunsExceeded({
        stage: 'work',
        taskId: 'task-1',
        taskExecutionId: 'exec-1',
        conversationId: 'conv-1',
      })

      // Should explicitly clear nextRunAt to null when past date
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            status: TaskStatus.idle,
            nextRunAt: null,
          }),
        })
      )
    })

    // BUG: handlePlatformLimitExceeded uses two separate prisma.task.update
    // calls instead of one atomic update that includes both status and
    // nextRunAt.
    // Desired: single update call includes status, outcome, and nextRunAt.
    it('should use single atomic update for status and nextRunAt on platform limit', async () => {
      const futureDate = new Date(Date.now() + 3600000)
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: 'daily',
      })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      getNext.mockReturnValue(futureDate)

      await mockWorkflowConfig.onMaxRunsExceeded({
        stage: 'work',
        taskId: 'task-1',
        taskExecutionId: 'exec-1',
        conversationId: 'conv-1',
      })

      // Should be called exactly once with both status AND nextRunAt in same call
      const taskUpdateCalls = prisma.task.update.mock.calls.filter(
        (call) => call[0].where.id === 'task-1'
      )

      expect(taskUpdateCalls).toHaveLength(1)
      expect(taskUpdateCalls[0][0].data).toEqual(
        expect.objectContaining({
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: futureDate,
        })
      )
    })
  })

  describe('onAbort (via workflow config)', () => {
    function makeAbortMeta(overrides = {}) {
      return {
        runCount: 1,
        startedAt: Date.now(),
        lastRunAt: Date.now(),
        ...overrides,
      }
    }

    it('should be wired as a function on the workflow config', () => {
      expect(typeof mockWorkflowConfig.onAbort).toBe('function')
    })

    it('should log a task.interact.aborted event with the error message as description', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})

      await mockWorkflowConfig.onAbort(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeAbortMeta(),
        new Error('Task execution canceled')
      )

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task.interact.aborted',
          description: 'Task execution canceled',
          user: { id: 'user-1' },
          relations: expect.objectContaining({
            taskId: 'task-1',
            taskExecutionId: 'exec-1',
            botId: 'bot-1',
            blueprintId: 'blueprint-1',
          }),
        })
      )
    })

    it('should inject an aborted activity message when conversation exists', async () => {
      const task = makeTestTask({ status: TaskStatus.running })
      const engine = makeTestEngine()

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockResolvedValue(engine)

      await mockWorkflowConfig.onAbort(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeAbortMeta(),
        new Error('Account limits exceeded')
      )

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-1',
          options: expect.objectContaining({ userId: 'user-1' }),
        })
      )

      expect(engine.addMessages).toHaveBeenCalled()

      const injected = engine.addMessages.mock.calls[0][0]
      const resultMessage = injected[injected.length - 1]

      expect(resultMessage.meta.activity.function.result).toEqual(
        expect.objectContaining({
          status: 'aborted',
          reason: 'Account limits exceeded',
        })
      )
    })

    it('should NOT call the engine for begin-stage aborts (no conversation yet)', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)

      await mockWorkflowConfig.onAbort(
        { stage: 'begin', taskId: 'task-1' },
        makeAbortMeta(),
        new Error('Task not found')
      )

      expect(getStatefulConversationEngine).not.toHaveBeenCalled()
      expect(prisma.taskExecution.update).not.toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task.interact.aborted',
          description: 'Task not found',
          relations: expect.objectContaining({ taskId: 'task-1' }),
        })
      )
    })

    it('should reset execution and task rows out of running state', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})

      await mockWorkflowConfig.onAbort(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeAbortMeta(),
        new Error('Task execution canceled')
      )

      expect(prisma.taskExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exec-1' },
          data: expect.objectContaining({
            status: TaskStatus.idle,
            outcome: TaskOutcome.failure,
            summary: 'Task aborted: Task execution canceled',
          }),
        })
      )

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            status: TaskStatus.idle,
            outcome: TaskOutcome.failure,
          }),
        })
      )
    })

    it('should set nextRunAt from schedule when aborting a scheduled task', async () => {
      const future = new Date(Date.now() + 86400000)
      const task = makeTestTask({
        status: TaskStatus.running,
        schedule: 'daily',
      })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getNext.mockReturnValue(future)

      await mockWorkflowConfig.onAbort(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeAbortMeta(),
        new Error('boom')
      )

      const update = prisma.task.update.mock.calls.find(
        (c) => c[0].where.id === 'task-1'
      )

      expect(update[0].data.nextRunAt).toBe(future)
    })

    it('should still log event when activity injection throws', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockResolvedValue({})
      getStatefulConversationEngine.mockRejectedValueOnce(
        new Error('engine unavailable')
      )

      await expect(
        mockWorkflowConfig.onAbort(
          {
            stage: 'work',
            taskId: 'task-1',
            taskExecutionId: 'exec-1',
            conversationId: 'conv-1',
            startMessageId: null,
          },
          makeAbortMeta(),
          new Error('Task execution canceled')
        )
      ).resolves.toBeUndefined()

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'task.interact.aborted' })
      )
      expect(prisma.task.update).toHaveBeenCalled()
    })

    it('should still reset task row when taskExecution update throws', async () => {
      const task = makeTestTask({ status: TaskStatus.running })

      prisma.task.findUnique.mockResolvedValue(task)
      prisma.task.update.mockResolvedValue(task)
      prisma.taskExecution.update.mockRejectedValueOnce(new Error('DB timeout'))

      await mockWorkflowConfig.onAbort(
        {
          stage: 'work',
          taskId: 'task-1',
          taskExecutionId: 'exec-1',
          conversationId: 'conv-1',
          startMessageId: null,
        },
        makeAbortMeta(),
        new Error('Task execution canceled')
      )

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: TaskStatus.idle }),
        })
      )
    })

    it('should not throw when the task row no longer exists', async () => {
      prisma.task.findUnique.mockResolvedValue(null)

      await expect(
        mockWorkflowConfig.onAbort(
          {
            stage: 'work',
            taskId: 'task-1',
            taskExecutionId: 'exec-1',
            conversationId: 'conv-1',
            startMessageId: null,
          },
          makeAbortMeta(),
          new Error('Task not found')
        )
      ).resolves.toBeUndefined()

      expect(getStatefulConversationEngine).not.toHaveBeenCalled()
      expect(prisma.task.update).not.toHaveBeenCalled()
      expect(logEvent).not.toHaveBeenCalled()
    })
  })
})

// -----------------------------------------------------------------------------
// getSessionConversationId
// -----------------------------------------------------------------------------

describe('getSessionConversationId', () => {
  // ONE_DAY_IN_SECONDS from @chatbotkit-dev/time
  const ONE_DAY_IN_SECONDS = 86400

  function makeSessionTask(overrides = {}) {
    return {
      id: 'task-session',
      userId: 'user-1',
      name: 'Session Task',
      description: 'A task with session',
      sessionDuration: null,
      contactId: null,
      meta: { namespace: 'test' },
      bot: { id: 'bot-1' },
      ...overrides,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should create a new conversation and store the ID in Redis with ONE_DAY expiry when sessionDuration is null', async () => {
    memcache.get.mockResolvedValue(null)
    createConversation.mockResolvedValue({ id: 'conv-new' })

    const result = await getSessionConversationId(makeSessionTask())

    expect(result).toBe('conv-new')
    expect(createConversation).toHaveBeenCalledTimes(1)
    expect(memcache.set).toHaveBeenCalledWith(
      'task-session-task-session-bot-1',
      'conv-new',
      {
        ex: ONE_DAY_IN_SECONDS,
      }
    )
  })

  it('should NOT look up or store in Redis when sessionDuration is 0 (no session)', async () => {
    memcache.get.mockResolvedValue(null)
    createConversation.mockResolvedValue({ id: 'conv-none' })

    const result = await getSessionConversationId(
      makeSessionTask({ id: 'task-none', sessionDuration: 0 })
    )

    // no session: a fresh conversation is created and nothing is persisted
    expect(result).toBe('conv-none')
    expect(memcache.get).not.toHaveBeenCalled()
    expect(memcache.set).not.toHaveBeenCalled()
  })

  it('should store a short positive sessionDuration (floored to >= 1 second)', async () => {
    memcache.get.mockResolvedValue(null)
    createConversation.mockResolvedValue({ id: 'conv-short' })

    // 59 000 ms = 59 s - small positive durations now persist (no 60 s floor)
    const result = await getSessionConversationId(
      makeSessionTask({ id: 'task-short', sessionDuration: 59000 })
    )

    expect(result).toBe('conv-short')
    expect(memcache.set).toHaveBeenCalledWith(
      expect.any(String),
      'conv-short',
      {
        ex: 59,
      }
    )
  })

  it('should store in Redis with the rounded custom sessionDuration when >= 60 seconds', async () => {
    memcache.get.mockResolvedValue(null)
    createConversation.mockResolvedValue({ id: 'conv-custom' })

    // 120 000 ms = 120 s - above the threshold
    await getSessionConversationId(
      makeSessionTask({ id: 'task-custom', sessionDuration: 120000 })
    )

    expect(memcache.set).toHaveBeenCalledWith(
      expect.any(String),
      'conv-custom',
      {
        ex: 120,
      }
    )
  })

  it('should use "default" as the sessionId component in the Redis key when the task has no bot', async () => {
    memcache.get.mockResolvedValue(null)
    createConversation.mockResolvedValue({ id: 'conv-nobot' })

    await getSessionConversationId(
      makeSessionTask({ id: 'task-nobot', bot: null })
    )

    expect(memcache.set).toHaveBeenCalledWith(
      'task-session-task-nobot-default',
      'conv-nobot',
      expect.any(Object)
    )
  })

  it('should reuse an existing conversation ID from Redis when the conversation still exists', async () => {
    memcache.get.mockResolvedValue('conv-existing')
    hasConversation.mockResolvedValue(true)
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-existing',
      botId: 'bot-1',
    })

    const result = await getSessionConversationId(makeSessionTask())

    expect(result).toBe('conv-existing')
    expect(createConversation).not.toHaveBeenCalled()
    expect(memcache.set).not.toHaveBeenCalled()
  })

  it('should create a new conversation when the Redis key exists but the conversation has been deleted', async () => {
    memcache.get.mockResolvedValue('conv-deleted')
    hasConversation.mockResolvedValue(false)
    createConversation.mockResolvedValue({ id: 'conv-replacement' })

    const result = await getSessionConversationId(makeSessionTask())

    expect(result).toBe('conv-replacement')
    expect(createConversation).toHaveBeenCalledTimes(1)
  })

  it('should update the conversation botId when the stored conversation has a different bot', async () => {
    memcache.get.mockResolvedValue('conv-wrong-bot')
    hasConversation.mockResolvedValue(true)
    // Conversation was originally linked to a different bot
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-wrong-bot',
      botId: 'bot-other',
    })

    await getSessionConversationId(makeSessionTask({ bot: { id: 'bot-1' } }))

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-wrong-bot' },
      data: { botId: 'bot-1' },
    })
  })
})
