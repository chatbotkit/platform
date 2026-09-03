/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'
import { SyncStatus } from '@/prisma/types'

import { runTasksEach } from '@/lib/job'

import {
  handleCleanupEvent,
  handleScheduleEvent,
  handleStalledEvent,
  handleSyncEvent,
  handleTriggerEvent,
} from '@/pages/api/v1/integration/queue'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
  withPost: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  triggerIntegration: {
    findUnique: jest.fn(),
    paginate: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  sitemapIntegration: {
    paginate: jest.fn(),
    update: jest.fn(),
  },
  notionIntegration: {
    paginate: jest.fn(),
    update: jest.fn(),
  },
  extractIntegrationItem: {
    paginate: jest.fn(),
    deleteMany: jest.fn(),
  },
}))

jest.mock('@/prisma/types', () => ({
  Schedule: {
    never: 'never',
    quarterhourly: 'quarterhourly',
    halfhourly: 'halfhourly',
    hourly: 'hourly',
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
  },
  SyncStatus: {
    pending: 'pending',
    synced: 'synced',
    error: 'error',
  },
  MessageType: {
    user: 'user',
    bot: 'bot',
    context: 'context',
    instruction: 'instruction',
    backstory: 'backstory',
  },
}))

jest.mock('@/lib/job', () => ({
  runTasks: jest.fn((tasks) => Promise.all(tasks)),
  runTasksBatch: jest.fn(),
  runTasksEach: jest.fn(),
}))

jest.mock('@/lib/it', () => ({
  combineAsync: jest.fn((...args) => args.flat()),
}))

// @note the scheduling gate is an ENTITLEMENT, not a tier name: the handler
// asks `isScheduledIntegrationEnabled`, which resolves against whatever plan
// catalogue the deployment installed. Mocking a plan name instead would make
// this suite depend on LIMITS_CONFIG - green on a planless checkout and red on
// the hosted catalogue, or the reverse.
jest.mock('@/lib/user.limits', () => ({
  isScheduledIntegrationEnabled: jest.fn(),
}))

jest.mock('@/lib/queue', () => ({
  __esModule: true,
  default: jest.fn(),
  withQueue: (fn) => fn,
}))
jest.mock('@/lib/queue2', () => ({
  withQueueHandler: (handlers) => handlers,
  withQueueHandlerBounded: (paramName, handlers) => handlers,
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock(
  '@/pages/api/v1/integration/trigger/[triggerIntegrationId]/queue',
  () => ({
    INVOKE_EVENT_TYPE: 'invoke',
    sendEvent: jest.fn(),
  })
)

jest.mock('@/lib/task.schedule', () => ({
  getNext: jest.fn((schedule) => {
    if (schedule === 'daily') {
      return new Date(Date.now() + 24 * 60 * 60 * 1000)
    }

    if (schedule === '2020-01-01') {
      return new Date('2020-01-01')
    }

    return new Date(Date.now() + 60 * 60 * 1000)
  }),
}))

const { getNext } = require('@/lib/task.schedule')

describe('Integration queue API handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // @note scheduling allowed unless a case says otherwise
    require('@/lib/user.limits').isScheduledIntegrationEnabled.mockResolvedValue(
      true
    )

    // Default empty mocks for all paginators to prevent undefined errors
    prisma.triggerIntegration.paginate.mockImplementation(async function* () {
      // Empty by default
    })
    prisma.sitemapIntegration.paginate.mockImplementation(async function* () {
      // Empty by default
    })
    prisma.notionIntegration.paginate.mockImplementation(async function* () {
      // Empty by default
    })
  })

  describe('handleStalledEvent', () => {
    it('should mark stalled sitemap integration syncs as error', async () => {
      const stalledSitemap = {
        id: 'sitemap-1',
        userId: 'user-1',
        syncStatus: SyncStatus.pending,
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      }

      prisma.sitemapIntegration.paginate.mockImplementation(async function* () {
        yield stalledSitemap
      })

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const item of generator) {
          await callback(item)
        }
      })

      await handleStalledEvent({})

      expect(prisma.sitemapIntegration.update).toHaveBeenCalledWith({
        where: { id: 'sitemap-1' },
        data: {
          syncStatus: SyncStatus.error,
        },
      })
    })

    it('should mark stalled notion integration syncs as error', async () => {
      const stalledNotion = {
        id: 'notion-1',
        userId: 'user-1',
        syncStatus: SyncStatus.pending,
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      }

      prisma.notionIntegration.paginate.mockImplementation(async function* () {
        yield stalledNotion
      })

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const item of generator) {
          await callback(item)
        }
      })

      await handleStalledEvent({})

      expect(prisma.notionIntegration.update).toHaveBeenCalledWith({
        where: { id: 'notion-1' },
        data: {
          syncStatus: SyncStatus.error,
        },
      })
    })

    it('should handle empty stalled lists', async () => {
      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const item of generator) {
          await callback(item)
        }
      })

      await handleStalledEvent({})

      expect(prisma.sitemapIntegration.update).not.toHaveBeenCalled()
      expect(prisma.notionIntegration.update).not.toHaveBeenCalled()
    })
  })

  describe('handleScheduleEvent', () => {
    it('should schedule trigger integrations with valid next trigger date', async () => {
      const unscheduledIntegration = {
        id: 'trigger-scheduled',
        schedule: '0 0 * * *',
        timezone: 'America/New_York',
      }

      prisma.triggerIntegration.paginate.mockImplementation(
        async function* (args) {
          if (args?.where?.AND?.[1]?.NOT?.schedule?.in) {
            yield unscheduledIntegration
          }
        }
      )

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const item of generator) {
          await callback(item)
        }
      })

      await handleScheduleEvent({})

      expect(getNext).toHaveBeenCalledWith('0 0 * * *', {
        timezone: 'America/New_York',
      })
      expect(prisma.triggerIntegration.update).toHaveBeenCalledWith({
        where: { id: 'trigger-scheduled' },
        data: {
          nextTriggerAt: expect.any(Date),
        },
      })
    })

    it('should unschedule trigger integrations with invalid next trigger date', async () => {
      const invalidIntegration = {
        id: 'trigger-invalid-date',
        schedule: '2020-01-01',
      }

      prisma.triggerIntegration.paginate.mockImplementation(
        async function* (args) {
          if (args?.where?.AND?.[1]?.NOT?.schedule?.in) {
            yield invalidIntegration
          }
        }
      )

      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const item of generator) {
          await callback(item)
        }
      })

      await handleScheduleEvent({})

      expect(prisma.triggerIntegration.update).toHaveBeenCalledWith({
        where: { id: 'trigger-invalid-date' },
        data: {
          schedule: null,
          nextTriggerAt: null,
        },
      })
    })

    it('should not query trigger integrations with null schedule', async () => {
      runTasksEach.mockImplementation(async (workers, generator, callback) => {
        for await (const item of generator) {
          await callback(item)
        }
      })

      await handleScheduleEvent({})

      // The schedule sweep query must explicitly exclude null schedule
      const call = prisma.triggerIntegration.paginate.mock.calls[0]
      const whereAnd = call[0].where.AND
      const hasNullExclusion = whereAnd.some(
        (clause) => clause.schedule?.not === null
      )

      expect(hasNullExclusion).toBe(true)
    })
  })

  describe('handleTriggerEvent', () => {
    const {
      INVOKE_EVENT_TYPE,
      sendEvent: sendTriggerEvent,
    } = require('@/pages/api/v1/integration/trigger/[triggerIntegrationId]/queue')
    const {
      isScheduledIntegrationEnabled,
    } = require('@/lib/user.limits')
    const { combineAsync } = require('@/lib/it')

    it('should query trigger integrations using hybrid query strategy', async () => {
      const dueIntegration = {
        id: 'trigger-1',
        userId: 'user-1',
        schedule: 'daily',
        lastTriggerAt: null,
        user: { id: 'user-1' },
      }

      combineAsync.mockReturnValue([dueIntegration])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      sendTriggerEvent.mockResolvedValue(undefined)

      await handleTriggerEvent({})

      expect(prisma.triggerIntegration.paginate).toHaveBeenCalled()

      const calls = prisma.triggerIntegration.paginate.mock.calls

      const hasEnumQuery = calls.some(
        ([call]) =>
          call.where.schedule &&
          (call.where.OR || call.where.lastTriggerAt !== undefined)
      )

      expect(hasEnumQuery).toBe(true)

      const hasNextTriggeredAtQuery = calls.some(
        ([call]) => call.where.nextTriggerAt
      )

      expect(hasNextTriggeredAtQuery).toBe(true)
    })

    it('should forward an invoke event to the trigger integration queue for paid users', async () => {
      const dueIntegration = {
        id: 'trigger-due',
        userId: 'user-1',
        schedule: 'daily',
        lastTriggerAt: null,
        user: { id: 'user-1' },
      }

      combineAsync.mockReturnValue([dueIntegration])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      sendTriggerEvent.mockResolvedValue(undefined)

      await handleTriggerEvent({})

      expect(sendTriggerEvent).toHaveBeenCalledWith('trigger-due', {
        type: INVOKE_EVENT_TYPE,
        payload: { schedule: 'daily' },
      })
    })

    it('should disable schedule for free plan users', async () => {
      const freeIntegration = {
        id: 'trigger-free',
        userId: 'user-free',
        schedule: 'daily',
        lastTriggerAt: null,
        user: { id: 'user-free' },
      }

      combineAsync.mockReturnValue([freeIntegration])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      isScheduledIntegrationEnabled.mockResolvedValue(false)

      await handleTriggerEvent({})

      expect(sendTriggerEvent).not.toHaveBeenCalled()

      expect(prisma.triggerIntegration.update).toHaveBeenCalledWith({
        where: { id: 'trigger-free' },
        data: {
          schedule: null,
          nextTriggerAt: null,
        },
      })
    })

    it('should not run trigger for empty results', async () => {
      combineAsync.mockReturnValue([])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleTriggerEvent({})

      expect(sendTriggerEvent).not.toHaveBeenCalled()
    })

    it('should unschedule trigger integrations with invalid schedule', async () => {
      const invalidScheduleIntegration = {
        id: 'trigger-invalid',
        userId: 'user-1',
        schedule: 'invalid-schedule',
        lastTriggerAt: null,
        user: { id: 'user-1' },
      }

      combineAsync.mockReturnValue([invalidScheduleIntegration])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      sendTriggerEvent.mockResolvedValue(undefined)

      await handleTriggerEvent({})

      expect(prisma.triggerIntegration.update).toHaveBeenCalledWith({
        where: { id: 'trigger-invalid' },
        data: {
          schedule: null,
          nextTriggerAt: null,
        },
      })

      expect(sendTriggerEvent).not.toHaveBeenCalled()
    })

    it('should forward an invoke event for triggers with nextTriggerAt in the past', async () => {
      const integrationWithPastTrigger = {
        id: 'trigger-past',
        userId: 'user-1',
        schedule: '0 0 * * *', // cron schedule
        nextTriggerAt: new Date('2020-01-01'),
        user: { id: 'user-1' },
      }

      combineAsync.mockReturnValue([integrationWithPastTrigger])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      sendTriggerEvent.mockResolvedValue(undefined)

      await handleTriggerEvent({})

      expect(sendTriggerEvent).toHaveBeenCalledWith('trigger-past', {
        type: INVOKE_EVENT_TYPE,
        payload: { schedule: '0 0 * * *' },
      })
    })

    it('should not repair custom schedules with missing nextTriggerAt during trigger sweep', async () => {
      combineAsync.mockReturnValue([])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleTriggerEvent({})

      const repairCall = prisma.triggerIntegration.paginate.mock.calls.find(
        ([call]) => call.where?.AND?.[0]?.NOT?.schedule?.in
      )

      expect(repairCall).toBeUndefined()
    })

    // @note isSchedule('never') returns true (it IS a valid interval), so if
    // 'never' somehow entered the combineAsync path the trigger queue would fire.
    // This test documents that the paginate queries structurally exclude 'never'
    // from both the enum-keyed queries and the nextTriggerAt query.
    it('should structurally exclude schedule "never" from all paginate queries', async () => {
      combineAsync.mockReturnValue([])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleTriggerEvent({})

      const calls = prisma.triggerIntegration.paginate.mock.calls

      const hasNeverEnumQuery = calls.some(
        ([call]) => call.where?.schedule === 'never'
      )

      expect(hasNeverEnumQuery).toBe(false)

      const nextTriggerAtCall = calls.find(
        ([call]) => call.where?.nextTriggerAt
      )

      expect(nextTriggerAtCall).toBeDefined()

      const excludedValues = nextTriggerAtCall[0].where.NOT.schedule.in

      expect(excludedValues).toContain('never')
    })
  })

  describe('handleSyncEvent', () => {
    let queue
    let combineAsync
    let isScheduledIntegrationEnabled

    beforeEach(() => {
      queue = require('@/lib/queue').default
      combineAsync = require('@/lib/it').combineAsync
      isScheduledIntegrationEnabled =
        require('@/lib/user.limits').isScheduledIntegrationEnabled
    })

    it('should queue a sitemap sync for a paid user with a datasetId', async () => {
      const sitemapItem = {
        id: 'sitemap-1',
        datasetId: 'ds-1',
        user: { id: 'user-1' },
      }

      combineAsync.mockReturnValueOnce([sitemapItem]).mockReturnValueOnce([])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      queue.mockResolvedValue(undefined)

      await handleSyncEvent({ type: 'sync', payload: {} })

      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/sitemap/sitemap-1/queue`,
        expect.objectContaining({ type: 'sync' })
      )
    })

    it('should queue a notion sync for a paid user with a datasetId', async () => {
      const notionItem = {
        id: 'notion-1',
        datasetId: 'ds-2',
        user: { id: 'user-2' },
      }

      combineAsync.mockReturnValueOnce([]).mockReturnValueOnce([notionItem])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      queue.mockResolvedValue(undefined)

      await handleSyncEvent({ type: 'sync', payload: {} })

      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/notion/notion-1/queue`,
        expect.objectContaining({ type: 'sync' })
      )
    })

    it('should set syncSchedule to never for a free user', async () => {
      const freeItem = {
        id: 'sitemap-free',
        datasetId: 'ds-3',
        user: { id: 'user-free' },
      }

      combineAsync.mockReturnValueOnce([freeItem]).mockReturnValueOnce([])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      isScheduledIntegrationEnabled.mockResolvedValue(false)

      await handleSyncEvent({ type: 'sync', payload: {} })

      expect(queue).not.toHaveBeenCalled()
      expect(prisma.sitemapIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sitemap-free' },
          data: { syncSchedule: 'never' },
        })
      )
    })

    it('should set syncSchedule to never for a basic user', async () => {
      const basicItem = {
        id: 'sitemap-basic',
        datasetId: 'ds-4',
        user: { id: 'user-basic' },
      }

      combineAsync.mockReturnValueOnce([basicItem]).mockReturnValueOnce([])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      isScheduledIntegrationEnabled.mockResolvedValue(false)

      await handleSyncEvent({ type: 'sync', payload: {} })

      expect(queue).not.toHaveBeenCalled()
      expect(prisma.sitemapIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sitemap-basic' },
          data: { syncSchedule: 'never' },
        })
      )
    })

    it('should skip a paid user whose datasetId is null', async () => {
      const noDatasetItem = {
        id: 'sitemap-nodataset',
        datasetId: null,
        user: { id: 'user-paid' },
      }

      combineAsync.mockReturnValueOnce([noDatasetItem]).mockReturnValueOnce([])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleSyncEvent({ type: 'sync', payload: {} })

      expect(queue).not.toHaveBeenCalled()
      expect(prisma.sitemapIntegration.update).not.toHaveBeenCalled()
    })

    it('should not call queue or update when no integrations are due', async () => {
      combineAsync.mockReturnValueOnce([]).mockReturnValueOnce([])

      runTasksEach.mockImplementation(async (workers, items, callback) => {
        for (const item of items) {
          await callback(item)
        }
      })

      await handleSyncEvent({ type: 'sync', payload: {} })

      expect(queue).not.toHaveBeenCalled()
      expect(prisma.sitemapIntegration.update).not.toHaveBeenCalled()
      expect(prisma.notionIntegration.update).not.toHaveBeenCalled()
    })
  })

  describe('handleCleanupEvent', () => {
    let runTasksBatch

    beforeEach(() => {
      runTasksBatch = require('@/lib/job').runTasksBatch
    })

    it('should delete old extract integration items in batches', async () => {
      const oldItems = [{ id: 'item-1' }, { id: 'item-2' }, { id: 'item-3' }]

      runTasksBatch.mockImplementation(async (workers, generator, callback) => {
        await callback(oldItems)
      })

      prisma.extractIntegrationItem.deleteMany.mockResolvedValue({ count: 3 })

      await handleCleanupEvent({ type: 'cleanup', payload: {} })

      expect(prisma.extractIntegrationItem.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['item-1', 'item-2', 'item-3'],
          },
        },
      })
    })

    it('should not call deleteMany when there are no old items', async () => {
      runTasksBatch.mockImplementation(async () => {
        // No batches to process
      })

      await handleCleanupEvent({ type: 'cleanup', payload: {} })

      expect(prisma.extractIntegrationItem.deleteMany).not.toHaveBeenCalled()
    })
  })
})
