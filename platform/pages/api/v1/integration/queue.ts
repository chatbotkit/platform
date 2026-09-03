/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  HALF_HOUR_IN_MILLISECONDS,
  ONE_DAY_IN_MILLISECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_MONTH_IN_MILLISECONDS,
  ONE_WEEK_IN_MILLISECONDS,
  QUARTER_HOUR_IN_MILLISECONDS,
  timePlusDays,
} from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import { Schedule, SyncStatus } from '@/prisma/types'

import debug, { warn } from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import { combineAsync } from '@/lib/it'
import { runTasks, runTasksBatch, runTasksEach } from '@/lib/job'
import { logEvent } from '@/lib/log'
import queue from '@/lib/queue'
import { withQueueHandler } from '@/lib/queue2'
import { getNext } from '@/lib/task.schedule'
import { isSchedule } from '@/lib/task.validation'
import { isScheduledIntegrationEnabled } from '@/lib/user.limits'
import { parseAsync } from '@/lib/zod.schema'

import type { SyncEvent as NotionSyncEvent } from '@/pages/api/v1/integration/notion/[notionIntegrationId]/queue'
import type { SyncEvent as SitemapSyncEvent } from '@/pages/api/v1/integration/sitemap/[sitemapIntegrationId]/queue'
import {
  INVOKE_EVENT_TYPE as TRIGGER_INVOKE_EVENT_TYPE,
  sendEvent as sendTriggerEvent,
} from '@/pages/api/v1/integration/trigger/[triggerIntegrationId]/queue'

import { z } from 'zod'

export const MAX_RECORD_TAKE = 100
export const MAX_CONCURRENT_WORKERS = 10

export const SYNC_EVENT_TYPE = 'sync'
export const SCHEDULE_EVENT_TYPE = 'schedule'
export const TRIGGER_EVENT_TYPE = 'trigger'
export const CLEANUP_EVENT_TYPE = 'cleanup'
export const STALLED_EVENT_TYPE = 'stalled'

export const MAX_TRIGGER_EXECUTION_TIME_IN_MILLISECONDS =
  ONE_HOUR_IN_MILLISECONDS

export const SyncPayloadSchema = z.object({
  // pass
})

export const SchedulePayloadSchema = z.object({
  // pass
})

export const TriggerPayloadSchema = z.object({
  // pass
})

export const CleanupPayloadSchema = z.object({
  // pass
})

export const StalledPayloadSchema = z.object({
  // pass
})

export type SyncPayload = z.infer<typeof SyncPayloadSchema>
export type SchedulePayload = z.infer<typeof SchedulePayloadSchema>
export type TriggerPayload = z.infer<typeof TriggerPayloadSchema>
export type CleanupPayload = z.infer<typeof CleanupPayloadSchema>
export type StalledPayload = z.infer<typeof StalledPayloadSchema>

export type SyncEvent = {
  type: typeof SYNC_EVENT_TYPE
  payload: SyncPayload
}

export type ScheduleEvent = {
  type: typeof SCHEDULE_EVENT_TYPE
  payload: SchedulePayload
}

export type TriggerEvent = {
  type: typeof TRIGGER_EVENT_TYPE
  payload: TriggerPayload
}

export type CleanupEvent = {
  type: typeof CLEANUP_EVENT_TYPE
  payload: CleanupPayload
}

export type StalledEvent = {
  type: typeof STALLED_EVENT_TYPE
  payload: StalledPayload
}

export async function handleSyncEvent(payload: SyncPayload): Promise<void> {
  debug(`sync`, { payload }).log('integration.queue.handleSyncEvent')

  const forEachScheduledItem = async (
    model: any,
    handler: (item: Record<string, any>) => Promise<void>
  ) => {
    const map = {
      [Schedule.quarterhourly]: ONE_HOUR_IN_MILLISECONDS, // pinned to one hour
      [Schedule.halfhourly]: ONE_HOUR_IN_MILLISECONDS, // pinned to one hour
      [Schedule.hourly]: ONE_HOUR_IN_MILLISECONDS,
      [Schedule.twicedaily]: ONE_DAY_IN_MILLISECONDS / 2,
      [Schedule.daily]: ONE_DAY_IN_MILLISECONDS,
      [Schedule.twiceweekly]: ONE_WEEK_IN_MILLISECONDS / 2,
      [Schedule.weekly]: ONE_WEEK_IN_MILLISECONDS,
      [Schedule.twicemonthly]: ONE_MONTH_IN_MILLISECONDS / 2,
      [Schedule.monthly]: ONE_MONTH_IN_MILLISECONDS,
    } satisfies Record<Exclude<Schedule, 'never'>, number>

    const its = Object.entries(map).map(([syncSchedule, offset]) => {
      return model.paginate({
        where: {
          syncSchedule,

          // @note only sync integrations that have a dataset configured

          datasetId: { not: null },

          lastSyncedAt: {
            // @note this expression will match both when lastSyncedAt is null
            // and when lastSyncedAt is less than the offset - verified by a
            // test in prisma/client.utest.js

            lte: new Date(Date.now() - offset),
          },
        },

        include: {
          user: true,
        },
      })
    })

    await runTasksEach(
      MAX_CONCURRENT_WORKERS,
      combineAsync<Record<string, any>>(...its),
      async (item) => {
        if (await isScheduledIntegrationEnabled(item.user)) {
          // @note defensive check in case the query filter is bypassed

          if (!item.datasetId) {
            warn(`skipping sync - no dataset configured`, { item })

            return
          }

          await handler(item)
        } else {
          debug(`turn off sync for integration`, { item }).log(
            'integration.queue.handleSyncEvent'
          )

          await model.update({
            where: {
              id: item.id,
            },

            data: {
              syncSchedule: Schedule.never,
            },
          })
        }
      }
    )
  }

  await runTasks([
    // sitemap
    forEachScheduledItem(prisma.sitemapIntegration, async (item) => {
      debug(`sitemap integration`, { item }).log(
        'integration.queue.handleSyncEvent'
      )

      const queueData: SitemapSyncEvent = {
        type: 'sync',
        payload: {},
      }

      await queue(`/api/v1/integration/sitemap/${item.id}/queue`, queueData)
    }),

    // notion
    forEachScheduledItem(prisma.notionIntegration, async (item) => {
      debug(`notion integration`, { item }).log(
        'integration.queue.handleSyncEvent'
      )

      const queueData: NotionSyncEvent = {
        type: 'sync',
        payload: {},
      }

      await queue(`/api/v1/integration/notion/${item.id}/queue`, queueData)
    }),
  ])
}

export async function handleScheduleEvent(
  payload: SchedulePayload
): Promise<void> {
  debug(`schedule`, { payload }).log('integration.queue.handleScheduleEvent')

  const unscheduledIntegrations = prisma.triggerIntegration.paginate({
    where: {
      AND: [
        // schedule is set (not null)
        {
          schedule: {
            not: null,
          },
        },
        // schedule is not a known interval value (i.e. it is a custom schedule)
        {
          NOT: {
            schedule: {
              in: Object.keys(Schedule),
            },
          },
        },
        // and nextTriggerAt has not been populated yet by a previous schedule sweep
        {
          OR: [
            {
              nextTriggerAt: null,
            },
          ],
        },
      ],
    },

    take: MAX_RECORD_TAKE,
  })

  await runTasksEach(
    MAX_CONCURRENT_WORKERS,
    unscheduledIntegrations,
    async (integration: Record<string, any>) => {
      debug(`scheduling integration`, { integration }).log(
        'integration.queue.handleScheduleEvent'
      )

      const nextTriggerAt = integration.schedule
        ? getNext(integration.schedule, {
            timezone: integration.timezone,
          })
        : null

      if (nextTriggerAt && nextTriggerAt > new Date()) {
        debug(`update integration next triggered at`, { nextTriggerAt }).log(
          'integration.queue.handleScheduleEvent'
        )

        await prisma.triggerIntegration.update({
          where: {
            id: integration.id,
          },

          data: {
            nextTriggerAt,
          },
        })
      } else {
        debug(`unschedule integration`, { nextTriggerAt }).log(
          'integration.queue.handleScheduleEvent'
        )

        await prisma.triggerIntegration.update({
          where: {
            id: integration.id,
          },

          data: {
            schedule: null,
            nextTriggerAt: null,
          },
        })
      }
    }
  )
}

export async function handleTriggerEvent(
  payload: TriggerPayload
): Promise<void> {
  debug(`trigger`, { payload }).log('integration.queue.handleTriggerEvent')

  // @note hybrid query strategy:
  // 1. Query enum schedules by lastTriggerAt
  // 2. Query custom schedules by nextTriggerAt after schedule sweep has populated it

  const itemsBySchedule = Object.entries({
    [Schedule.quarterhourly]: QUARTER_HOUR_IN_MILLISECONDS,
    [Schedule.halfhourly]: HALF_HOUR_IN_MILLISECONDS,
    [Schedule.hourly]: ONE_HOUR_IN_MILLISECONDS,
    [Schedule.twicedaily]: ONE_DAY_IN_MILLISECONDS / 2,
    [Schedule.daily]: ONE_DAY_IN_MILLISECONDS,
    [Schedule.twiceweekly]: ONE_WEEK_IN_MILLISECONDS / 2,
    [Schedule.weekly]: ONE_WEEK_IN_MILLISECONDS,
    [Schedule.twicemonthly]: ONE_MONTH_IN_MILLISECONDS / 2,
    [Schedule.monthly]: ONE_MONTH_IN_MILLISECONDS,
  } satisfies Record<Exclude<Schedule, 'never'>, number>).map(
    ([schedule, offset]) => {
      return prisma.triggerIntegration.paginate({
        where: {
          schedule,

          OR: [
            {
              lastTriggerAt: null,
            },
            {
              lastTriggerAt: {
                lte: new Date(Date.now() - offset),
              },
            },
          ],
        },

        include: {
          user: true,
        },
      })
    }
  )

  const itemsByNextTriggeredAt = prisma.triggerIntegration.paginate({
    where: {
      NOT: {
        schedule: {
          in: Object.keys(Schedule),
        },
      },

      nextTriggerAt: {
        lte: new Date(),
      },
    },

    include: {
      user: true,
    },
  })

  await runTasksEach(
    MAX_CONCURRENT_WORKERS,
    combineAsync(...itemsBySchedule, itemsByNextTriggeredAt),
    async (item: Record<string, any>) => {
      // @note validate schedule at runtime - handles data corruption, direct SQL,
      // or migration bugs that could leave invalid schedules in the database
      if (!isSchedule(item.schedule)) {
        debug(`unschedule trigger integration with invalid schedule`, {
          item,
        }).log('integration.queue.handleTriggerEvent')

        await prisma.triggerIntegration.update({
          where: {
            id: item.id,
          },

          data: {
            schedule: null,
            nextTriggerAt: null,
          },
        })

        return
      }

      if (await isScheduledIntegrationEnabled(item.user)) {
        debug(`trigger integration`, { item }).log(
          'integration.queue.handleTriggerEvent'
        )

        await sendTriggerEvent(item.id, {
          type: TRIGGER_INVOKE_EVENT_TYPE,
          payload: {
            schedule: item.schedule || 'never',
          },
        })
      } else {
        debug(`turn off trigger for integration`, { item }).log(
          'integration.queue.handleTriggerEvent'
        )

        await prisma.triggerIntegration.update({
          where: {
            id: item.id,
          },

          data: {
            schedule: null,
            nextTriggerAt: null,
          },
        })
      }
    }
  )
}

export async function handleCleanupEvent(
  payload: CleanupPayload
): Promise<void> {
  debug(`cleanup`, { payload }).log('integration.queue.handleCleanupEvent')

  const forEachOldBatchOfItems = async (
    model: any,
    maxAgeInDays: number,
    handler: (items: Record<string, any>[]) => Promise<void>
  ) => {
    const its = model.paginate({
      where: {
        createdAt: {
          lte: timePlusDays(-maxAgeInDays),
        },
      },
    })

    await runTasksBatch(MAX_CONCURRENT_WORKERS, its, handler, 100)
  }

  await runTasks([
    // extract
    forEachOldBatchOfItems(prisma.extractIntegrationItem, 90, async (items) => {
      debug(`extract integration`, { items }).log(
        'integration.queue.handleCleanupEvent'
      )

      await prisma.extractIntegrationItem.deleteMany({
        where: {
          id: {
            in: items.map((i) => i.id),
          },
        },
      })
    }),
  ])
}

export async function handleStalledEvent(
  payload: StalledPayload
): Promise<void> {
  debug(`stalled`, { payload }).log('integration.queue.handleStalledEvent')

  await runTasks([
    // @note fix stalled SitemapIntegration syncs that are stuck in pending
    // status for more than the maximum execution time (e.g., due to timeout)

    (async () => {
      const oneHourAgo = new Date(
        Date.now() - MAX_TRIGGER_EXECUTION_TIME_IN_MILLISECONDS
      )

      const its = prisma.sitemapIntegration.paginate({
        where: {
          syncStatus: SyncStatus.pending,
          updatedAt: { lt: oneHourAgo },
        },
        take: MAX_RECORD_TAKE,
      })

      await runTasksEach(MAX_CONCURRENT_WORKERS, its, async (integration) => {
        debug(`fixing stalled sitemap integration sync`, {
          integrationId: integration.id,
        }).log('integration.queue.handleStalledEvent')

        await prisma.sitemapIntegration.update({
          where: { id: integration.id },
          data: {
            syncStatus: SyncStatus.error,
          },
        })

        await logEvent({
          user: { id: integration.userId },
          type: 'integration.sitemap.sync.fix',
          relations: {
            sitemapIntegrationId: integration.id,
          },
        })
      })
    })(),

    // @note fix stalled NotionIntegration syncs that are stuck in pending
    // status for more than the maximum execution time (e.g., due to timeout)

    (async () => {
      const oneHourAgo = new Date(
        Date.now() - MAX_TRIGGER_EXECUTION_TIME_IN_MILLISECONDS
      )

      const its = prisma.notionIntegration.paginate({
        where: {
          syncStatus: SyncStatus.pending,
          updatedAt: { lt: oneHourAgo },
        },
        take: MAX_RECORD_TAKE,
      })

      await runTasksEach(MAX_CONCURRENT_WORKERS, its, async (integration) => {
        debug(`fixing stalled notion integration sync`, {
          integrationId: integration.id,
        }).log('integration.queue.handleStalledEvent')

        await prisma.notionIntegration.update({
          where: { id: integration.id },
          data: {
            syncStatus: SyncStatus.error,
          },
        })

        await logEvent({
          user: { id: integration.userId },
          type: 'integration.notion.sync.fix',
          relations: {
            notionIntegrationId: integration.id,
          },
        })
      })
    })(),
  ])
}

export async function sendEvent(
  event: SyncEvent | ScheduleEvent | TriggerEvent | CleanupEvent | StalledEvent
): Promise<void> {
  switch (true) {
    case event.type === SYNC_EVENT_TYPE: {
      await parseAsync(SyncPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === SCHEDULE_EVENT_TYPE: {
      await parseAsync(SchedulePayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === TRIGGER_EVENT_TYPE: {
      await parseAsync(TriggerPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === CLEANUP_EVENT_TYPE: {
      await parseAsync(CleanupPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === STALLED_EVENT_TYPE: {
      await parseAsync(StalledPayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(`/api/v1/integration/queue`, event)
}

export default withQueueHandler({
  [SYNC_EVENT_TYPE]: {
    handler: handleSyncEvent,
    schema: SyncPayloadSchema,
  },
  [SCHEDULE_EVENT_TYPE]: {
    handler: handleScheduleEvent,
    schema: SchedulePayloadSchema,
  },
  [TRIGGER_EVENT_TYPE]: {
    handler: handleTriggerEvent,
    schema: TriggerPayloadSchema,
  },
  [CLEANUP_EVENT_TYPE]: {
    handler: handleCleanupEvent,
    schema: CleanupPayloadSchema,
  },
  [STALLED_EVENT_TYPE]: {
    handler: handleStalledEvent,
    schema: StalledPayloadSchema,
  },
})

// @note do not generate manuals or docs for this internal endpoint
