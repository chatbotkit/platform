import prisma from '@/prisma/client'
import { TaskOutcome, TaskStatus } from '@/prisma/types'

import { combineAsync } from '@/lib/it'
import { runTasksBatch, runTasksEach } from '@/lib/job'
import { isScheduledTaskEnabled } from '@/lib/user.limits'

import { executeTask } from '@/pages/api/v1/task/[taskId]/workflow'
import {
  getStalledExecutionWhere,
  getStalledTaskWhere,
  handleCleanupEvent,
  handleScheduleEvent,
  handleStalledEvent,
  handleTriggerEvent,
} from '@/pages/api/v1/task/queue'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  task: {
    findUnique: jest.fn(),
    paginate: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  taskExecution: {
    paginate: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
}))

jest.mock('@/prisma/types', () => ({
  Schedule: {
    never: 'never',
    quarterhourly: 'quarterhourly',
    halfhourly: 'halfhourly',
    hourly: 'hourly',
    twicedaily: 'twicedaily',
    daily: 'daily',
    twiceweekly: 'twiceweekly',
    weekly: 'weekly',
    twicemonthly: 'twicemonthly',
    monthly: 'monthly',
  },
  TaskStatus: {
    idle: 'idle',
    running: 'running',
  },
  TaskOutcome: {
    pending: 'pending',
    success: 'success',
    failure: 'failure',
  },
}))

jest.mock('@/lib/job', () => ({
  runTasksBatch: jest.fn(),
  runTasksEach: jest.fn(),
}))

jest.mock('@/lib/it', () => ({
  combineAsync: jest.fn((...args) => args.flat()),
}))

jest.mock('@/pages/api/v1/task/[taskId]/workflow', () => ({
  executeTask: jest.fn(),
}))

// @note the scheduling gate is an ENTITLEMENT, not a tier name: the handler
// asks `isScheduledTaskEnabled`, which resolves against whatever plan
// catalogue the deployment installed. Mocking a plan name instead would make
// this suite depend on LIMITS_CONFIG - green on a planless checkout and red on
// the hosted catalogue, or the reverse - which is exactly what it did before.
jest.mock('@/lib/user.limits', () => ({
  isScheduledTaskEnabled: jest.fn(),
}))

jest.mock('@/lib/queue', () => jest.fn())
jest.mock('@/lib/queue2', () => ({
  withQueueHandler: (handlers) => handlers,
}))

describe('Task queue API handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // @note scheduling allowed unless a case says otherwise
    isScheduledTaskEnabled.mockResolvedValue(true)
  })

  function _makeRequest(payload) {
    const url = 'https://example.com/api/v1/task/queue?secret=test-secret'
    const body = JSON.stringify(payload ?? {})

    return new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body,
    })
  }

  describe('handleCleanupEvent', () => {
    it('should delete expired tasks', async () => {
      const expiredTasks = [
        { id: 'task-1', expiresAt: new Date('2020-01-01') },
        { id: 'task-2', expiresAt: new Date('2020-01-02') },
      ]

      prisma.task.paginate.mockImplementation(async function* () {
        for (const task of expiredTasks) {
          yield task
        }
      })

      prisma.taskExecution.paginate.mockImplementation(async function* () {
        // Empty generator for task executions
      })

      runTasksBatch.mockImplementation(
        async (workers, generator, callback, _batchSize) => {
          const tasks = []

          for await (const task of generator) {
            tasks.push(task)
          }

          await callback(tasks)
        }
      )

      await handleCleanupEvent({})

      expect(prisma.task.paginate).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
        take: 100,
      })

      expect(prisma.task.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['task-1', 'task-2'],
          },
        },
      })
    })

    it('should collect an expired task even when it is scheduled', async () => {
      // expiresAt is the sole gate for collection. A scheduled/recurring task
      // can be given a deliberate expiresAt (e.g. "run daily until date X"),
      // and once that expiry passes it must be collected like any other - the
      // sweep must NOT special-case (exempt) scheduled tasks.
      const expiredScheduledTask = {
        id: 'task-recurring',
        schedule: 'daily',
        expiresAt: new Date('2020-01-01'),
      }

      prisma.task.paginate.mockImplementation(async function* () {
        yield expiredScheduledTask
      })

      prisma.taskExecution.paginate.mockImplementation(async function* () {})

      runTasksBatch.mockImplementation(
        async (workers, generator, callback, _batchSize) => {
          const tasks = []

          for await (const task of generator) {
            tasks.push(task)
          }

          if (tasks.length > 0) {
            await callback(tasks)
          }
        }
      )

      await handleCleanupEvent({})

      // The expired-task query keys solely on expiresAt - it must not constrain
      // schedule, otherwise a deliberately-expiring recurring task would leak.
      const [expiredTaskQuery] = prisma.task.paginate.mock.calls[0]

      expect(expiredTaskQuery.where.expiresAt).toEqual({
        lt: expect.any(Date),
      })
      expect(expiredTaskQuery.where).not.toHaveProperty('schedule')

      // and the scheduled-but-expired task is in fact deleted
      expect(prisma.task.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['task-recurring'],
          },
        },
      })
    })

    it('should handle empty expired tasks list', async () => {
      prisma.task.paginate.mockImplementation(async function* () {
        // Empty generator
      })

      prisma.taskExecution.paginate.mockImplementation(async function* () {
        // Empty generator for task executions
      })

      runTasksBatch.mockImplementation(
        async (workers, generator, callback, _batchSize) => {
          const tasks = []

          for await (const task of generator) {
            tasks.push(task)
          }

          if (tasks.length > 0) {
            await callback(tasks)
          }
        }
      )

      await handleCleanupEvent({})

      expect(prisma.task.deleteMany).not.toHaveBeenCalled()
    })

    it('should delete old task executions beyond 90-day retention', async () => {
      const oldExecutions = [
        { id: 'exec-1', createdAt: new Date('2020-01-01') },
        { id: 'exec-2', createdAt: new Date('2020-02-01') },
      ]

      prisma.task.paginate.mockImplementation(async function* () {
        // No expired tasks
      })

      let executionCall = 0

      prisma.taskExecution.paginate.mockImplementation(async function* () {
        executionCall++

        for (const exec of oldExecutions) {
          yield exec
        }
      })

      runTasksBatch.mockImplementation(
        async (workers, generator, callback, _batchSize) => {
          const items = []

          for await (const item of generator) {
            items.push(item)
          }

          if (items.length > 0) {
            await callback(items)
          }
        }
      )

      await handleCleanupEvent({})

      expect(executionCall).toBeGreaterThan(0)

      expect(prisma.taskExecution.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['exec-1', 'exec-2'],
          },
        },
      })
    })

    it('should query old task executions using a cutoff date 90 days in the past', async () => {
      prisma.task.paginate.mockImplementation(async function* () {})

      prisma.taskExecution.paginate.mockImplementation(async function* () {})

      runTasksBatch.mockImplementation(async () => {})

      const beforeCall = Date.now()

      await handleCleanupEvent({})

      const afterCall = Date.now()

      const paginateCalls = prisma.taskExecution.paginate.mock.calls

      expect(paginateCalls.length).toBeGreaterThan(0)

      const [callArg] = paginateCalls[0]

      expect(callArg.where.createdAt.lte).toBeInstanceOf(Date)

      // The cutoff should be approximately 90 days before now
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
      const cutoff = callArg.where.createdAt.lte.getTime()

      expect(cutoff).toBeLessThanOrEqual(beforeCall - ninetyDaysMs + 1000)
      expect(cutoff).toBeGreaterThanOrEqual(afterCall - ninetyDaysMs - 1000)
    })
  })

  describe('handleScheduleEvent', () => {
    it('should schedule tasks with valid next run date', async () => {
      const unscheduledTask = {
        id: 'task-1',
        schedule: 'daily',
      }

      prisma.task.paginate.mockImplementation(async function* () {
        yield unscheduledTask
      })

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const task of generator) {
          await callback(task)
        }
      })

      await handleScheduleEvent({})

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          nextRunAt: expect.any(Date),
        },
      })
    })

    it('should unschedule tasks with invalid next run date', async () => {
      const taskWithPastSchedule = {
        id: 'task-2',
        schedule: '2020-01-01', // past date
      }

      prisma.task.paginate.mockImplementation(async function* () {
        yield taskWithPastSchedule
      })

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const task of generator) {
          await callback(task)
        }
      })

      await handleScheduleEvent({})

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-2' },
        data: {
          schedule: null,
          nextRunAt: null,
        },
      })
    })

    it('should not query tasks with null schedule', async () => {
      prisma.task.paginate.mockImplementation(async function* () {
        // No items yielded - null-schedule tasks are excluded by WHERE
      })

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const task of generator) {
          await callback(task)
        }
      })

      await handleScheduleEvent({})

      // The schedule sweep query must explicitly exclude null schedule
      const call = prisma.task.paginate.mock.calls[0]
      const whereAnd = call[0].where.AND
      const hasNullExclusion = whereAnd.some(
        (clause) => clause.schedule?.not === null
      )

      expect(hasNullExclusion).toBe(true)

      expect(prisma.task.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'task-3' } })
      )
    })
  })

  describe('handleTriggerEvent', () => {
    it('should query tasks using hybrid query strategy', async () => {
      // @note hybrid query strategy: enum-based schedules + nextRunAt
      // This test verifies that paginate is called for both strategies

      const task = {
        id: 'task-1',
        schedule: 'daily',
        lastRunAt: null,
        user: { id: 'user-1' },
      }

      combineAsync.mockReturnValue([task])

      runTasksEach.mockImplementation(async (workers, tasks, callback) => {
        for (const task of tasks) {
          await callback(task)
        }
      })

      await handleTriggerEvent({})

      // Should have multiple paginate calls: one for each schedule type + one for nextRunAt
      expect(prisma.task.paginate).toHaveBeenCalled()

      const calls = prisma.task.paginate.mock.calls

      // At least one should be an enum-based query (by schedule + lastRunAt)
      const hasEnumQuery = calls.some(
        ([call]) =>
          call.where.schedule &&
          (call.where.OR || call.where.lastRunAt !== undefined)
      )

      expect(hasEnumQuery).toBe(true)

      // At least one should be a nextRunAt query
      const hasNextRunAtQuery = calls.some(([call]) => call.where.nextRunAt)

      expect(hasNextRunAtQuery).toBe(true)
    })

    it('should trigger tasks for entitled users', async () => {
      const task = {
        id: 'task-1',
        schedule: 'daily',
        lastRunAt: null,
        user: { id: 'user-1' },
      }

      // Mock combineAsync to return the task directly
      combineAsync.mockReturnValue([task])

      runTasksEach.mockImplementation(async (workers, tasks, callback) => {
        for (const task of tasks) {
          await callback(task)
        }
      })

      await handleTriggerEvent({})

      expect(executeTask).toHaveBeenCalledWith('task-1')
    })

    it('should unschedule tasks when scheduling is not entitled', async () => {
      const task = {
        id: 'task-2',
        schedule: 'daily',
        lastRunAt: null,
        user: { id: 'user-2' },
      }

      combineAsync.mockReturnValue([task])

      runTasksEach.mockImplementation(async (workers, tasks, callback) => {
        for (const task of tasks) {
          await callback(task)
        }
      })

      isScheduledTaskEnabled.mockResolvedValue(false)

      await handleTriggerEvent({})

      expect(executeTask).not.toHaveBeenCalled()
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-2' },
        data: {
          schedule: null,
          nextRunAt: null,
        },
      })
    })

    it('should unschedule tasks with invalid schedule', async () => {
      const task = {
        id: 'task-3',
        schedule: 'invalid-schedule',
        lastRunAt: null,
        user: { id: 'user-3' },
      }

      combineAsync.mockReturnValue([task])

      runTasksEach.mockImplementation(async (workers, tasks, callback) => {
        for (const task of tasks) {
          await callback(task)
        }
      })

      await handleTriggerEvent({})

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-3' },
        data: {
          schedule: null,
          nextRunAt: null,
        },
      })
      expect(executeTask).not.toHaveBeenCalled()
    })

    it('should handle tasks with nextRunAt in the past', async () => {
      const task = {
        id: 'task-4',
        schedule: null,
        nextRunAt: new Date('2020-01-01'),
        user: { id: 'user-4' },
      }

      combineAsync.mockReturnValue([task])

      runTasksEach.mockImplementation(async (workers, tasks, callback) => {
        for (const task of tasks) {
          await callback(task)
        }
      })

      await handleTriggerEvent({})

      // Should unschedule since schedule is invalid
      expect(prisma.task.update).toHaveBeenCalled()
    })

    it('should not run task for empty results', async () => {
      combineAsync.mockReturnValue([])

      runTasksEach.mockImplementation(async (workers, tasks, callback) => {
        for (const task of tasks) {
          await callback(task)
        }
      })

      await handleTriggerEvent({})

      expect(executeTask).not.toHaveBeenCalled()
    })

    it('should unschedule tasks when the entitlement is withheld', async () => {
      const task = {
        id: 'task-basic',
        schedule: 'daily',
        lastRunAt: null,
        user: { id: 'user-basic' },
      }

      combineAsync.mockReturnValue([task])

      runTasksEach.mockImplementation(async (workers, tasks, callback) => {
        for (const task of tasks) {
          await callback(task)
        }
      })

      isScheduledTaskEnabled.mockResolvedValue(false)

      await handleTriggerEvent({})

      expect(executeTask).not.toHaveBeenCalled()
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-basic' },
        data: {
          schedule: null,
          nextRunAt: null,
        },
      })
    })

    it('should trigger tasks when scheduling is entitled', async () => {
      const task = {
        id: 'task-growth',
        schedule: 'daily',
        lastRunAt: null,
        user: { id: 'user-growth' },
      }

      combineAsync.mockReturnValue([task])

      runTasksEach.mockImplementation(async (workers, tasks, callback) => {
        for (const task of tasks) {
          await callback(task)
        }
      })

      isScheduledTaskEnabled.mockResolvedValue(true)

      await handleTriggerEvent({})

      expect(executeTask).toHaveBeenCalledWith('task-growth')
      expect(prisma.task.update).not.toHaveBeenCalled()
    })
  })

  describe('handleStalledEvent', () => {
    it('should mark stalled tasks as idle with failure outcome', async () => {
      const stalledTask = {
        id: 'task-1',
        userId: 'user-1',
        status: TaskStatus.running,
        lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      }

      prisma.task.paginate.mockImplementation(async function* () {
        yield stalledTask
      })

      prisma.taskExecution.paginate.mockImplementation(async function* () {
        // Empty - no orphaned executions
      })

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const task of generator) {
          await callback(task)
        }
      })

      await handleStalledEvent({})

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: null,
        },
      })

      // Should also reset any stalled child executions inline
      expect(prisma.taskExecution.updateMany).toHaveBeenCalledWith({
        where: {
          taskId: 'task-1',
          status: TaskStatus.running,
        },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          summary: 'Task execution stalled - automatically reset',
          completedAt: expect.any(Date),
        },
      })
    })

    it('should handle tasks with null lastRunAt', async () => {
      const stalledTask = {
        id: 'task-2',
        userId: 'user-1',
        status: TaskStatus.running,
        lastRunAt: null,
      }

      prisma.task.paginate.mockImplementation(async function* () {
        yield stalledTask
      })

      prisma.taskExecution.paginate.mockImplementation(async function* () {
        // Empty - no orphaned executions
      })

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const task of generator) {
          await callback(task)
        }
      })

      await handleStalledEvent({})

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-2' },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: null,
        },
      })
    })

    it('should handle empty stalled tasks list', async () => {
      prisma.task.paginate.mockImplementation(async function* () {
        // Empty generator
      })

      prisma.taskExecution.paginate.mockImplementation(async function* () {
        // Empty - no orphaned executions
      })

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const task of generator) {
          await callback(task)
        }
      })

      await handleStalledEvent({})

      expect(prisma.task.update).not.toHaveBeenCalled()
    })

    it('should update stalled Task records to idle with failure outcome', async () => {
      const stalledTask = {
        id: 'task-1',
        userId: 'user-1',
        status: TaskStatus.running,
        lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      }

      prisma.task.paginate.mockImplementation(async function* () {
        yield stalledTask
      })

      prisma.taskExecution.paginate.mockImplementation(async function* () {
        // Empty - no orphaned executions for this test
      })

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const task of generator) {
          await callback(task)
        }
      })

      await handleStalledEvent({})

      // Should update the Task
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: null,
        },
      })

      // Should also reset any stalled child executions inline
      expect(prisma.taskExecution.updateMany).toHaveBeenCalledWith({
        where: {
          taskId: 'task-1',
          status: TaskStatus.running,
        },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          summary: 'Task execution stalled - automatically reset',
          completedAt: expect.any(Date),
        },
      })
    })

    it('should fix orphaned TaskExecution records independently of stalled Tasks', async () => {
      // No stalled tasks
      prisma.task.paginate.mockImplementation(async function* () {
        // Empty - no stalled tasks
      })

      // But there are orphaned TaskExecution records stuck in running
      const stalledExecution = {
        id: 'exec-1',
        taskId: 'task-1',
        userId: 'user-1',
        status: TaskStatus.running,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      }

      prisma.taskExecution.paginate.mockImplementation(async function* () {
        yield stalledExecution
      })

      let callCount = 0

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        callCount++

        for await (const item of generator) {
          await callback(item)
        }
      })

      await handleStalledEvent({})

      // Should be called twice - once for tasks, once for executions
      expect(callCount).toBe(2)

      // Should update the orphaned TaskExecution
      expect(prisma.taskExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          completedAt: expect.any(Date),
          summary: 'Task execution stalled and was cleaned up',
        },
      })
    })

    // BUG: handleStalledEvent does not clear nextRunAt when resetting a
    // stalled task. If the task had a past nextRunAt, the trigger sweep
    // (taskByNextRunAt query: nextRunAt <= now) will pick it up again
    // immediately, causing an infinite stall-trigger-stall loop.
    it('should clear nextRunAt when resetting a stalled task that had a past nextRunAt', async () => {
      const stalledTask = {
        id: 'task-stale-next',
        userId: 'user-1',
        status: TaskStatus.running,
        lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        // This past timestamp is the crux: it will match
        // "nextRunAt: { lte: new Date() }" on the next trigger sweep
        nextRunAt: new Date(Date.now() - 30 * 60 * 1000),
      }

      prisma.task.paginate.mockImplementation(async function* () {
        yield stalledTask
      })

      prisma.taskExecution.paginate.mockImplementation(async function* () {})

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const task of generator) {
          await callback(task)
        }
      })

      await handleStalledEvent({})

      // The update MUST include nextRunAt: null to break the re-trigger loop
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-stale-next' },
        data: expect.objectContaining({
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          nextRunAt: null,
        }),
      })
    })

    it('feeds the exact sweep predicates into paginate, both pinned to one now', async () => {
      prisma.task.paginate.mockImplementation(async function* () {})
      prisma.taskExecution.paginate.mockImplementation(async function* () {})

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const task of generator) {
          await callback(task)
        }
      })

      await handleStalledEvent({})

      const taskWhere = prisma.task.paginate.mock.calls[0][0].where
      const execWhere = prisma.taskExecution.paginate.mock.calls[0][0].where

      // recover the instant the reaper picked, then prove it fed BOTH sweeps the
      // exact builder predicates (unit-tested separately below) for that instant
      const now = taskWhere.taskExecutions.none.keepAliveUntil.gt

      expect(taskWhere).toEqual(getStalledTaskWhere(now))
      expect(execWhere).toEqual(getStalledExecutionWhere(now))

      // both sweeps must pivot on the very same instant, else a run can fall
      // through the gap between "task still has a live execution" (deadline > now)
      // and "execution deadline passed" (deadline < now)
      expect(execWhere.OR[0].keepAliveUntil.lt).toBe(now)
    })
  })

  describe('stalled sweep predicates', () => {
    const now = new Date('2026-07-01T12:00:00.000Z')
    const ONE_HOUR = 60 * 60 * 1000
    const oneHourAgo = new Date(now.getTime() - ONE_HOUR)

    it('getStalledTaskWhere: running, stale/absent lastRunAt, and no live execution', () => {
      expect(getStalledTaskWhere(now)).toEqual({
        status: TaskStatus.running,
        OR: [{ lastRunAt: null }, { lastRunAt: { lt: oneHourAgo } }],
        // a running execution whose keep-alive deadline is still in the future
        // (actively stepping or deliberately paused) keeps the task off the sweep
        taskExecutions: {
          none: {
            status: TaskStatus.running,
            keepAliveUntil: { gt: now },
          },
        },
      })
    })

    it('getStalledExecutionWhere: passed deadline OR legacy (no deadline + old createdAt)', () => {
      expect(getStalledExecutionWhere(now)).toEqual({
        status: TaskStatus.running,
        OR: [
          // heartbeat deadline lapsed → workflow stopped touching it
          { keepAliveUntil: { lt: now } },
          // legacy rows: no deadline, fall back to the original createdAt window
          { keepAliveUntil: null, createdAt: { lt: oneHourAgo } },
        ],
      })
    })

    it('both sweeps pivot on the same instant with a 1h legacy window', () => {
      const taskWhere = getStalledTaskWhere(now)
      const execWhere = getStalledExecutionWhere(now)

      const taskNow = taskWhere.taskExecutions.none.keepAliveUntil.gt
      const execNow = execWhere.OR[0].keepAliveUntil.lt

      // the "live" boundary (> now) and the "stalled" boundary (< now) share the
      // exact same instant - no overlap, no gap
      expect(execNow).toEqual(taskNow)

      // legacy fallback is exactly one hour before that instant
      const legacyCutoff = execWhere.OR[1].createdAt.lt

      expect(execNow.getTime() - legacyCutoff.getTime()).toBe(ONE_HOUR)
    })
  })

  describe('Edge cases and error scenarios', () => {
    it('should handle database errors gracefully in cleanup', async () => {
      prisma.task.paginate.mockImplementation(async function* () {
        throw new Error('Database error')
      })

      // @note runTasksBatch must actually consume the generator so the error propagates
      runTasksBatch.mockImplementation(async (workers, generator) => {
        for await (const _item of generator) {
          // consume items
        }
      })

      await expect(handleCleanupEvent({})).rejects.toThrow('Database error')
    })

    it('should handle database errors in schedule event', async () => {
      prisma.task.paginate.mockImplementation(async function* () {
        yield { id: 'task-1', schedule: 'daily' }
      })

      prisma.task.update.mockRejectedValue(new Error('Update failed'))

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const task of generator) {
          await callback(task)
        }
      })

      await expect(handleScheduleEvent({})).rejects.toThrow('Update failed')
    })

    it('should handle concurrent task processing', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i}`,
        schedule: 'daily',
        lastRunAt: null,
        user: { id: `user-${i}` },
      }))

      combineAsync.mockReturnValue(tasks)

      runTasksEach.mockImplementation(async (workers, taskList, callback) => {
        for (const task of taskList) {
          await callback(task)
        }
      })

      await handleTriggerEvent({})

      expect(executeTask).toHaveBeenCalledTimes(5)
    })
  })

  describe('schedule type coverage for twicedaily, twiceweekly, twicemonthly', () => {
    // Time constants from @chatbotkit-dev/time
    const ONE_DAY_IN_MILLISECONDS = 8.64e7
    const ONE_WEEK_IN_MILLISECONDS = 6.048e8
    const ONE_MONTH_IN_MILLISECONDS = 2.628e9

    beforeEach(() => {
      combineAsync.mockReturnValue([])
      runTasksEach.mockImplementation(async () => {})
    })

    it('should create paginate queries for all three twice-* schedule types', async () => {
      await handleTriggerEvent({})

      const queried = prisma.task.paginate.mock.calls
        .map(([arg]) => arg.where?.schedule)
        .filter(Boolean)

      expect(queried).toContain('twicedaily')
      expect(queried).toContain('twiceweekly')
      expect(queried).toContain('twicemonthly')
    })

    it('should use half-day offset for twicedaily paginate query', async () => {
      const expectedOffset = ONE_DAY_IN_MILLISECONDS / 2

      const before = Date.now()

      await handleTriggerEvent({})

      const after = Date.now()

      const call = prisma.task.paginate.mock.calls.find(
        ([arg]) => arg.where?.schedule === 'twicedaily'
      )

      expect(call).toBeDefined()

      const orClause = call[0].where.OR
      const lastRunAtFilter = orClause.find((c) => c.lastRunAt?.lte)

      expect(lastRunAtFilter).toBeDefined()

      const lte = lastRunAtFilter.lastRunAt.lte.getTime()

      expect(lte).toBeGreaterThanOrEqual(before - expectedOffset - 1000)
      expect(lte).toBeLessThanOrEqual(after - expectedOffset + 1000)
    })

    it('should use half-week offset for twiceweekly paginate query', async () => {
      const expectedOffset = ONE_WEEK_IN_MILLISECONDS / 2

      const before = Date.now()

      await handleTriggerEvent({})

      const after = Date.now()

      const call = prisma.task.paginate.mock.calls.find(
        ([arg]) => arg.where?.schedule === 'twiceweekly'
      )

      expect(call).toBeDefined()

      const orClause = call[0].where.OR
      const lastRunAtFilter = orClause.find((c) => c.lastRunAt?.lte)

      expect(lastRunAtFilter).toBeDefined()

      const lte = lastRunAtFilter.lastRunAt.lte.getTime()

      expect(lte).toBeGreaterThanOrEqual(before - expectedOffset - 1000)
      expect(lte).toBeLessThanOrEqual(after - expectedOffset + 1000)
    })

    it('should use half-month offset for twicemonthly paginate query', async () => {
      const expectedOffset = ONE_MONTH_IN_MILLISECONDS / 2

      const before = Date.now()

      await handleTriggerEvent({})

      const after = Date.now()

      const call = prisma.task.paginate.mock.calls.find(
        ([arg]) => arg.where?.schedule === 'twicemonthly'
      )

      expect(call).toBeDefined()

      const orClause = call[0].where.OR
      const lastRunAtFilter = orClause.find((c) => c.lastRunAt?.lte)

      expect(lastRunAtFilter).toBeDefined()

      const lte = lastRunAtFilter.lastRunAt.lte.getTime()

      expect(lte).toBeGreaterThanOrEqual(before - expectedOffset - 1000)
      expect(lte).toBeLessThanOrEqual(after - expectedOffset + 1000)
    })

    it('should include a lastRunAt: null branch in OR clause for each twice-* schedule', async () => {
      await handleTriggerEvent({})

      for (const schedule of ['twicedaily', 'twiceweekly', 'twicemonthly']) {
        const call = prisma.task.paginate.mock.calls.find(
          ([arg]) => arg.where?.schedule === schedule
        )

        expect(call).toBeDefined()

        const orClause = call[0].where.OR
        const hasNullBranch = orClause.some((c) => c.lastRunAt === null)

        expect(hasNullBranch).toBe(true)
      }
    })
  })
})
