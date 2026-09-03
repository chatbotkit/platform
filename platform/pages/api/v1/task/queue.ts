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
import { Schedule, TaskOutcome, TaskStatus } from '@/prisma/types'
import type { Prisma, Task, TaskExecution } from '@/prisma/types'

import debug from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import { combineAsync } from '@/lib/it'
import { runTasksBatch, runTasksEach } from '@/lib/job'
import { logEvent } from '@/lib/log'
import queue from '@/lib/queue'
import { withQueueHandler } from '@/lib/queue2'
import { getNext } from '@/lib/task.schedule'
import { isSchedule } from '@/lib/task.validation'
import { isScheduledTaskEnabled } from '@/lib/user.limits'
import { parseAsync } from '@/lib/zod.schema'

import { executeTask } from '@/pages/api/v1/task/[taskId]/workflow'

import { z } from 'zod'

export const MAX_RECORD_TAKE = 100
export const MAX_RECORD_BATCH = 100
export const MAX_CONCURRENT_WORKERS = 10

export const CLEANUP_EVENT_TYPE = 'cleanup'
export const SCHEDULE_EVENT_TYPE = 'schedule'
export const TRIGGER_EVENT_TYPE = 'trigger'
export const STALLED_EVENT_TYPE = 'stalled'

export const MAX_TASK_EXECUTION_TIME_IN_MILLISECONDS = ONE_HOUR_IN_MILLISECONDS

export const CleanupPayloadSchema = z.object({
  // pass
})

export const SchedulePayloadSchema = z.object({
  // pass
})

export const TriggerPayloadSchema = z.object({
  // pass
})

export const StalledPayloadSchema = z.object({
  // pass
})

export type CleanupPayload = z.infer<typeof CleanupPayloadSchema>
export type SchedulePayload = z.infer<typeof SchedulePayloadSchema>
export type TriggerPayload = z.infer<typeof TriggerPayloadSchema>
export type StalledPayload = z.infer<typeof StalledPayloadSchema>

export type CleanupEvent = {
  type: typeof CLEANUP_EVENT_TYPE
  payload: CleanupPayload
}

export type ScheduleEvent = {
  type: typeof SCHEDULE_EVENT_TYPE
  payload: SchedulePayload
}

export type TriggerEvent = {
  type: typeof TRIGGER_EVENT_TYPE
  payload: TriggerPayload
}

export type StalledEvent = {
  type: typeof STALLED_EVENT_TYPE
  payload: StalledPayload
}

export async function handleCleanupEvent(
  payload: CleanupPayload
): Promise<void> {
  debug(`cleanup`, { payload }).log('task.queue.handleCleanupEvent')

  // @note cleanup expired tasks. `expiresAt` is the sole gate: a task is
  // collected once its expiry has passed, whether or not it is scheduled - a
  // recurring task can be given a deliberate `expiresAt` to stop it on a date,
  // and that must be honored. The bug where namespace-scoped recurring tasks
  // died after ~1 day is fixed at the source (doTaskCreate no longer
  // auto-stamps an expiry onto scheduled tasks), not by exempting scheduled
  // tasks here.

  const expiredTasks = prisma.task.paginate({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },

    take: MAX_RECORD_TAKE,
  }) as AsyncGenerator<Task>

  await runTasksBatch(
    MAX_CONCURRENT_WORKERS,
    expiredTasks,
    async (tasks) => {
      debug(`deleting expired tasks`, { tasks }).log(
        'task.queue.handleCleanupEvent'
      )

      await prisma.task.deleteMany({
        where: {
          id: {
            in: tasks.map((task) => task.id),
          },
        },
      })
    },
    MAX_RECORD_BATCH
  )

  // @note cleanup old task executions (90 days retention)

  const oldTaskExecutions = prisma.taskExecution.paginate({
    where: {
      createdAt: {
        lte: timePlusDays(-90),
      },
    },

    take: MAX_RECORD_TAKE,
  }) as AsyncGenerator<TaskExecution>

  await runTasksBatch(
    MAX_CONCURRENT_WORKERS,
    oldTaskExecutions,
    async (executions) => {
      debug(`deleting old task executions`, { executions }).log(
        'task.queue.handleCleanupEvent'
      )

      await prisma.taskExecution.deleteMany({
        where: {
          id: {
            in: executions.map((e) => e.id),
          },
        },
      })
    },
    MAX_RECORD_BATCH
  )
}

export async function handleScheduleEvent(
  payload: SchedulePayload
): Promise<void> {
  debug(`schedule`, { payload }).log('task.queue.handleScheduleEvent')

  const unscheduledTasks = prisma.task.paginate({
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
        // and nextRunAt has not been populated yet by a previous schedule sweep
        {
          OR: [
            {
              nextRunAt: null,
            },
            // @note the reason this this disabled is because it will make
            // so that tasks that have an interval less than the clock to be
            // constantly rescheduled without ever running
            // {
            //   nextRunAt: {
            //     lte: new Date(),
            //   },
            // },
          ],
        },
        // and the task is not expired
        {
          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: new Date(),
              },
            },
          ],
        },
      ],
    },

    take: MAX_RECORD_TAKE,
  }) as AsyncGenerator<Task>

  await runTasksEach(MAX_CONCURRENT_WORKERS, unscheduledTasks, async (task) => {
    debug(`scheduling task`, { task }).log('task.queue.handleScheduleEvent')

    const nextRunAt = task.schedule
      ? getNext(task.schedule, { timezone: task.timezone })
      : null

    if (nextRunAt && nextRunAt > new Date()) {
      debug(`update task next run`, { nextRunAt }).log(
        'task.queue.handleScheduleEvent'
      )

      await prisma.task.update({
        where: {
          id: task.id,
        },

        data: {
          nextRunAt: nextRunAt,
        },
      })
    } else {
      debug(`unschedule task`, { nextRunAt }).log(
        'task.queue.handleScheduleEvent'
      )

      await prisma.task.update({
        where: {
          id: task.id,
        },

        data: {
          schedule: null,
          nextRunAt: null,
        },
      })
    }
  })
}

export async function handleTriggerEvent(
  payload: TriggerPayload
): Promise<void> {
  debug(`trigger`, { payload }).log('task.queue.handleTriggerEvent')

  const tasksBySchedule = Object.entries({
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
      return prisma.task.paginate({
        where: {
          schedule,

          OR: [
            {
              lastRunAt: null,
            },
            {
              lastRunAt: {
                lte: new Date(Date.now() - offset),
              },
            },
          ],
        },

        include: {
          user: true, // @note very important
        },
      })
    }
  )

  const taskByNextRunAt = prisma.task.paginate({
    where: {
      NOT: {
        schedule: {
          in: Object.keys(Schedule),
        },
      },

      nextRunAt: {
        lte: new Date(),
      },

      // Only fire tasks that have not expired
      OR: [
        {
          expiresAt: null,
        },
        {
          expiresAt: {
            gt: new Date(),
          },
        },
      ],
    },

    include: {
      user: true, // @note very important
    },
  })

  await runTasksEach(
    MAX_CONCURRENT_WORKERS,
    combineAsync(...tasksBySchedule, taskByNextRunAt),
    async (task) => {
      if (!isSchedule(task.schedule)) {
        debug(`unschedule task`, { task }).log('task.queue.handleTriggerEvent')

        await prisma.task.update({
          where: {
            id: task.id,
          },

          data: {
            schedule: null,
            nextRunAt: null,
          },
        })

        return
      }

      if (await isScheduledTaskEnabled(task.user)) {
        debug(`trigger task`, { task }).log('task.queue.handleTriggerEvent')

        await executeTask(task.id)
      } else {
        debug(`unschedule task`, { task }).log('task.queue.handleTriggerEvent')

        await prisma.task.update({
          where: {
            id: task.id,
          },

          data: {
            schedule: null,
            nextRunAt: null,
          },
        })
      }
    }
  )
}

/**
 * Predicate for the stalled-task sweep: a task stuck in `running` past the
 * maximum execution window that no longer has a legitimately-live execution.
 *
 * A run counts as "live" while its execution is running with a `keepAliveUntil`
 * deadline still in the future - the workflow renews that deadline on every step
 * and stretches it over any deliberate pause, so an actively-progressing or
 * paused run is excluded here and left for the execution sweep to reap once its
 * deadline lapses.
 *
 * @note exported so the reaper and its tests exercise the exact same predicate
 * (avoids the two drifting apart).
 */
export function getStalledTaskWhere(now: Date): Prisma.TaskWhereInput {
  const oneHourAgo = new Date(
    now.getTime() - MAX_TASK_EXECUTION_TIME_IN_MILLISECONDS
  )

  return {
    status: TaskStatus.running,

    OR: [{ lastRunAt: null }, { lastRunAt: { lt: oneHourAgo } }],

    taskExecutions: {
      none: {
        status: TaskStatus.running,
        keepAliveUntil: {
          gt: now,
        },
      },
    },
  }
}

/**
 * Predicate for the stalled-execution sweep: an execution stuck in `running`
 * whose keep-alive deadline has already passed (the workflow stopped renewing
 * it), or - for legacy rows written before heartbeats existed - one with no
 * deadline at all and a `createdAt` older than the maximum execution window.
 *
 * @note `now` must be the SAME instant passed to `getStalledTaskWhere` in a
 * given sweep, otherwise a run could slip through the gap between "task still has
 * a live execution" and "execution deadline passed". Exported so the reaper and
 * its tests exercise the exact same predicate.
 */
export function getStalledExecutionWhere(
  now: Date
): Prisma.TaskExecutionWhereInput {
  const oneHourAgo = new Date(
    now.getTime() - MAX_TASK_EXECUTION_TIME_IN_MILLISECONDS
  )

  return {
    status: TaskStatus.running,

    OR: [
      // @note the workflow pushes `keepAliveUntil` forward on every step and
      // over any pause; once it lies in the past the workflow has stopped
      // touching this run, so it is genuinely stalled.
      {
        keepAliveUntil: {
          lt: now,
        },
      },

      // @note legacy rows created before heartbeats existed have no
      // `keepAliveUntil`; fall back to the original createdAt-based window.
      {
        keepAliveUntil: null,
        createdAt: {
          lt: oneHourAgo,
        },
      },
    ],
  }
}

export async function handleStalledEvent(
  payload: StalledPayload
): Promise<void> {
  debug(`stalled`, { payload }).log('task.queue.handleStalledEvent')

  // @note a single `now` drives both sweeps so they agree on the cutoff (see
  // getStalledExecutionWhere).
  const now = new Date()

  // @note fix stalled Tasks that are stuck in running status for more than
  // the maximum execution time

  const stalledTasks = prisma.task.paginate({
    where: getStalledTaskWhere(now),

    take: MAX_RECORD_TAKE,
  }) as AsyncGenerator<Task>

  await runTasksEach(MAX_CONCURRENT_WORKERS, stalledTasks, async (task) => {
    debug(`fixing stalled task`, { task }).log('task.queue.handleStalledEvent')

    // Reset the task status
    await prisma.task.update({
      where: {
        id: task.id,
      },

      data: {
        status: TaskStatus.idle,
        outcome: TaskOutcome.failure,
        nextRunAt: null,
      },
    })

    // Also reset any stalled executions for this task
    await prisma.taskExecution.updateMany({
      where: {
        taskId: task.id,
        status: TaskStatus.running,
      },

      data: {
        status: TaskStatus.idle,
        outcome: TaskOutcome.failure,
        summary: 'Task execution stalled - automatically reset',
        completedAt: new Date(),
      },
    })

    await logEvent({
      user: { id: task.userId },
      type: 'task.fix',
      relations: {
        taskId: task.id,
      },
    })
  })

  // @note fix orphaned TaskExecution records that are stuck in running status
  // even when their parent Task has already been reset to idle

  const stalledTaskExecutions = prisma.taskExecution.paginate({
    where: getStalledExecutionWhere(now),

    take: MAX_RECORD_TAKE,
  }) as AsyncGenerator<TaskExecution>

  await runTasksEach(
    MAX_CONCURRENT_WORKERS,
    stalledTaskExecutions,
    async (execution) => {
      debug(`fixing stalled task execution`, { execution }).log(
        'task.queue.handleStalledEvent'
      )

      await prisma.taskExecution.update({
        where: {
          id: execution.id,
        },
        data: {
          status: TaskStatus.idle,
          outcome: TaskOutcome.failure,
          completedAt: new Date(),
          summary: 'Task execution stalled and was cleaned up',
        },
      })

      await logEvent({
        user: { id: execution.userId },
        type: 'task.execution.fix',
        relations: {
          taskId: execution.taskId,
          taskExecutionId: execution.id,
        },
      })
    }
  )
}

export async function sendEvent(
  event: CleanupEvent | ScheduleEvent | TriggerEvent | StalledEvent
): Promise<void> {
  switch (true) {
    case event.type === CLEANUP_EVENT_TYPE: {
      await parseAsync(CleanupPayloadSchema, event.payload, captureInputError)

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

    case event.type === STALLED_EVENT_TYPE: {
      await parseAsync(StalledPayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(`/api/v1/task/queue`, event)
}

export default withQueueHandler({
  [CLEANUP_EVENT_TYPE]: {
    handler: handleCleanupEvent,
    schema: CleanupPayloadSchema,
  },
  [SCHEDULE_EVENT_TYPE]: {
    handler: handleScheduleEvent,
    schema: SchedulePayloadSchema,
  },
  [TRIGGER_EVENT_TYPE]: {
    handler: handleTriggerEvent,
    schema: TriggerPayloadSchema,
  },
  [STALLED_EVENT_TYPE]: {
    handler: handleStalledEvent,
    schema: StalledPayloadSchema,
  },
})

// @note this is an internal endpoint that must not be documented using docs and
// manual sections
