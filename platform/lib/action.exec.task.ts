import { clamp } from '@chatbotkit-dev/math'
import { isDate, parseDuration, timePlusDays } from '@chatbotkit-dev/time'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { PLATFORM_LIMITS } from '@/config/execution'

import prisma from '@/prisma/client'
import { Schedule, type User } from '@/prisma/types'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { getScopedResourceFilter } from '@/lib/action.filter'
import { canUseBot } from '@/lib/bot.access'
import {
  getContextBot,
  getContextContact,
  getContextNamespace,
  getContextUser,
} from '@/lib/context.store'
import { isCron } from '@/lib/cron'
import debug from '@/lib/debug'
import { UserInputError, UserResourceNotFoundError } from '@/lib/error'
import { buildMetaQueryFilter } from '@/lib/filter'
import { getMeta } from '@/lib/meta'
import { getNext } from '@/lib/task.schedule'
import { z } from '@/lib/zod.schema'

import { executeTask } from '@/pages/api/v1/task/[taskId]/workflow'

// @see data/abilities/catalogue/cbk.task.ts for ability definitions related to
// these schemas

// --- Scope ---

/**
 * Access scope
 */
const scope = z.enum(['user', 'contact', 'bot']).describe('The access scope')

type TaskScope = z.infer<typeof scope>

// --- Schemas ---

/**
 * Schema for listing tasks.
 */
export const taskListSchema = z.object({
  '@scope': scope,
  botId: z.string().min(1).optional().describe('Optional bot ID to scope by'),
  meta: z.record(z.unknown()).optional().describe('Optional metadata filter'),
})

/**
 * Schema for fetching a single task - requires task ID
 */
export const taskFetchSchema = z.object({
  '@scope': scope,
  botId: z.string().min(1).optional().describe('Optional bot ID to scope by'),
  taskId: z.string().min(1).describe('The task ID to fetch'),
})

/**
 * Schema for creating a task
 */
export const taskCreateSchema = z.object({
  '@scope': scope,
  botId: z.string().min(1).optional().describe('Optional bot ID to assign'),
  name: z.string().optional().describe('The name of the task'),
  description: z.string().optional().describe('The description of the task'),
  schedule: z
    .union([z.nativeEnum(Schedule), z.string(), z.date(), z.number(), z.null()])
    .optional()
    .describe(
      'The schedule for the task. Can be a Schedule enum value, cron expression, date string/object, or null for one-time execution'
    ),
  timezone: z
    .string()
    .optional()
    .describe('Optional IANA timezone such as UTC or America/New_York'),
  maxIterations: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Maximum reasoning iterations per execution. Clamped to platform limits (10–100000); defaults to 1000 when omitted.'
    ),
  maxTime: z
    .union([z.number().positive(), z.string().min(1)])
    .optional()
    .describe(
      'Maximum wall-clock time per execution, as a duration string like "1 day" or "30 minutes", or a number of milliseconds. Clamped to platform limits (15 minutes–1 day); defaults to 15 minutes when omitted.'
    ),
  maxCalls: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Maximum tool calls allowed across the whole task run. Clamped to platform limits (1–100000); omitted leaves the budget unbounded (the engine per-step default applies).'
    ),
  sessionDuration: z
    .union([z.number().nonnegative(), z.string().min(1)])
    .optional()
    .describe(
      'Session duration controlling conversation reuse across runs, as a duration string like "1 hour" or a number of milliseconds. 0 starts a fresh conversation each run; omitted uses the platform default.'
    ),
  meta: z
    .record(z.unknown())
    .optional()
    .describe('Optional metadata to store on the task'),
})

/**
 * Schema for updating a task
 */
export const taskUpdateSchema = z.object({
  '@scope': scope,
  botId: z.string().min(1).optional().describe('Optional bot ID to scope by'),
  taskId: z.string().min(1).describe('The task ID to update'),
  name: z.string().optional().describe('The new name of the task'),
  description: z
    .string()
    .optional()
    .describe('The new description of the task'),
  schedule: z
    .union([z.nativeEnum(Schedule), z.string(), z.date(), z.number(), z.null()])
    .optional()
    .describe(
      'The new schedule for the task. Can be a Schedule enum value, cron expression, date string/object, or null'
    ),
  timezone: z
    .string()
    .nullable()
    .optional()
    .describe('Optional IANA timezone such as UTC or America/New_York'),
  maxIterations: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe(
      'Maximum reasoning iterations per execution. Clamped to platform limits (10–100000); null resets to the default.'
    ),
  maxTime: z
    .union([z.number().positive(), z.string().min(1)])
    .nullable()
    .optional()
    .describe(
      'Maximum wall-clock time per execution, as a duration string like "1 day" or "30 minutes", or a number of milliseconds. Clamped to platform limits (15 minutes–1 day); null resets to the default.'
    ),
  maxCalls: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe(
      'Maximum tool calls allowed across the whole task run. Clamped to platform limits (1–100000); null clears the budget (unbounded).'
    ),
  sessionDuration: z
    .union([z.number().nonnegative(), z.string().min(1)])
    .nullable()
    .optional()
    .describe(
      'Session duration controlling conversation reuse across runs, as a duration string like "1 hour" or a number of milliseconds. 0 starts a fresh conversation each run; null resets to the default.'
    ),
  meta: z
    .record(z.unknown())
    .optional()
    .describe('Optional metadata to store on the task'),
})

/**
 * Schema for deleting a task - requires task ID
 */
export const taskDeleteSchema = z.object({
  '@scope': scope,
  botId: z.string().min(1).optional().describe('Optional bot ID to scope by'),
  taskId: z.string().min(1).describe('The task ID to delete'),
})

/**
 * Schema for running a task - requires task ID
 */
export const taskRunSchema = z.object({
  '@scope': scope,
  botId: z.string().min(1).optional().describe('Optional bot ID to scope by'),
  taskId: z.string().min(1).describe('The task ID to run'),
})

// --- Inferred Types ---

/**
 * Inferred type for task list schema
 */
export type TaskListSchema = z.infer<typeof taskListSchema>

/**
 * Inferred type for task fetch schema
 */
export type TaskFetchSchema = z.infer<typeof taskFetchSchema>

/**
 * Inferred type for task create schema
 */
export type TaskCreateSchema = z.infer<typeof taskCreateSchema>

/**
 * Inferred type for task update schema
 */
export type TaskUpdateSchema = z.infer<typeof taskUpdateSchema>

/**
 * Inferred type for task delete schema
 */
export type TaskDeleteSchema = z.infer<typeof taskDeleteSchema>

/**
 * Inferred type for task run schema
 */
export type TaskRunSchema = z.infer<typeof taskRunSchema>

// --- Operation Names ---

// @note operation name constants for compile-time validation in action.tags.ts
export const TASK_LIST_OPERATION_NAME = 'list'
export const TASK_FETCH_OPERATION_NAME = 'fetch'
export const TASK_CREATE_OPERATION_NAME = 'create'
export const TASK_UPDATE_OPERATION_NAME = 'update'
export const TASK_DELETE_OPERATION_NAME = 'delete'
export const TASK_RUN_OPERATION_NAME = 'run'

// --- Types ---

/**
 * The contact interface for task actions.
 */
interface Contact {
  id: string
}

/**
 * The parameters for task actions.
 */
interface TaskActionParams {
  user: User
  input: string
  params: ActionParams
  options: ActionOptions
}

// --- Helpers ---

/**
 * Resolves the bot ID for task actions using the established priority order.
 */
function getTaskActionBotId(
  options: ActionOptions,
  explicitBotId?: string
): string | undefined {
  // @note linked bot takes priority as it is the hard-connected bot
  const linkedBotId = options.linkedResources?.botId

  if (linkedBotId) {
    return linkedBotId
  }

  // @note explicit botId from params is next
  if (explicitBotId) {
    return explicitBotId
  }

  // @note context bot is the fallback
  const contextBotId = getContextBot()?.id

  if (contextBotId) {
    return contextBotId
  }

  return undefined
}

/**
 * Builds the scoped Prisma where clause for task operations.
 */
async function getTaskScopedWhere({
  userId,
  scope,
  options,
  explicitBotId,
}: {
  userId: string
  scope: TaskScope
  options: ActionOptions
  explicitBotId?: string
}) {
  // @note resolve the effective bot ID from linked, explicit, or context
  // sources

  const botId = getTaskActionBotId(options, explicitBotId)

  // @note verify the user has access to the resolved bot before using it
  // to scope queries

  if (botId) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } })

    if (!bot || (await canUseBot(userId, bot)) === false) {
      throw new UserInputError(`Bot not found`)
    }
  }

  // @note inject the resolved botId into linkedResources so that
  // getScopedResourceFilter can see it when scope is 'bot'. Without this, a
  // botId resolved from params or context would be invisible to the scope
  // filter and '@scope: bot' queries would fail.

  const linkedResources = botId
    ? {
        ...(options.linkedResources || {}),
        botId,
      }
    : options.linkedResources

  const scopedWhere = getScopedResourceFilter({
    userId,
    scope,
    linkedResources,
  })

  if (!botId) {
    return scopedWhere
  }

  // @note append botId directly to the where clause so Prisma always filters by
  // it, regardless of whether the scope is 'bot', 'user', or 'contact'

  return {
    ...scopedWhere,
    botId,
  }
}

/**
 * Parses and validates the task schedule parameter.
 *
 * @throws
 */
function getTaskSchedule(schedule: unknown): string | null | undefined {
  debug(`getTaskSchedule`, { schedule }).log('action.exec.task.getTaskSchedule')

  // @note 'now' means execute immediately with no recurring schedule
  if (schedule === 'now') {
    return null
  }

  let taskSchedule: string | null | undefined = undefined

  switch (true) {
    case typeof schedule === 'string' && schedule in Schedule: {
      taskSchedule = schedule

      break
    }

    case typeof schedule === 'string' && isCron(schedule): {
      taskSchedule = schedule

      break
    }

    default: {
      if (schedule) {
        if (
          typeof schedule !== 'string' &&
          typeof schedule !== 'number' &&
          !(schedule instanceof Date)
        ) {
          throw new UserInputError(`Invalid schedule`)
        }

        if (!isDate(schedule)) {
          throw new UserInputError(`Invalid schedule`)
        }

        if (new Date(schedule) < new Date()) {
          throw new UserInputError(`Schedule is in the past`)
        }

        taskSchedule = new Date(schedule).toISOString()
      } else if (schedule === null) {
        // @note explicit null means "clear the schedule"; undefined means "no change"
        taskSchedule = null
      }

      break
    }
  }

  debug(`taskSchedule`, { taskSchedule }).log(
    'action.exec.task.getTaskSchedule'
  )

  return taskSchedule
}

/**
 * Determines the expiration date for a task based on namespace and contact.
 */
function getTaskExpiresAt(
  namespace: string | null | undefined,
  contact: Contact | null | undefined
): Date | undefined {
  debug(`getTaskExpiresAt`, { namespace, contact }).log(
    'action.exec.task.getTaskExpiresAt'
  )

  let expiresAt: Date | undefined = undefined

  switch (true) {
    case !!contact: {
      // @note tasks associated with contacts do not expire

      break
    }

    case !!namespace: {
      // @note tasks associated with namespaces expire after 1 day

      expiresAt = timePlusDays(1)

      break
    }

    default: {
      // @note by default tasks do not expire unless specified
      // @todo handle input here

      break
    }
  }

  debug(`expiresAt`, { expiresAt: expiresAt?.toISOString() }).log(
    'action.exec.task.getTaskExpiresAt'
  )

  return expiresAt
}

// --- Handlers ---

/**
 * Normalize an agent-supplied execution limit before persisting it:
 * - `undefined` is left untouched (Prisma ignores it and the default applies),
 * - `null` clears any override back to the default,
 * - a number is clamped to the platform's allowed range so a task can never be
 *   configured outside the bounds the queue handler enforces anyway.
 */
function normalizeMaxIterations(
  value: number | null | undefined
): number | null | undefined {
  if (value === undefined || value === null) {
    return value
  }

  return clamp(
    Math.round(value),
    PLATFORM_LIMITS.minIterations,
    PLATFORM_LIMITS.maxIterations
  )
}

/**
 * Normalize the whole-task tool-call budget. Mirrors {@link normalizeMaxIterations}:
 * `undefined`/`null` pass through (leaving the budget unset/cleared) and a
 * provided value is clamped to the platform bounds.
 */
function normalizeMaxCalls(
  value: number | null | undefined
): number | null | undefined {
  if (value === undefined || value === null) {
    return value
  }

  return clamp(
    Math.round(value),
    PLATFORM_LIMITS.minCalls,
    PLATFORM_LIMITS.maxCalls
  )
}

/**
 * Normalize an agent-supplied duration limit. Like {@link normalizeMaxIterations}
 * but the value may also be a human-readable string such as `"1 day"` or
 * `"30 minutes"` (resolved via {@link parseDuration}), since an agent fills these
 * in. An unparseable duration is a user error.
 *
 * @throws {UserInputError} when the value is a string that cannot be parsed as a
 *   duration.
 */
function normalizeMaxTime(
  value: number | string | null | undefined
): number | null | undefined {
  if (value === undefined || value === null) {
    return value
  }

  const ms = parseDuration(value)

  if (ms === null) {
    throw new UserInputError(`Invalid duration for maxTime: "${value}"`)
  }

  return clamp(ms, PLATFORM_LIMITS.minTime, PLATFORM_LIMITS.maxTime)
}

function normalizeSessionDuration(
  value: number | string | null | undefined
): number | null | undefined {
  if (value === undefined || value === null) {
    return value
  }

  const ms = parseDuration(value)

  if (ms === null) {
    throw new UserInputError(`Invalid duration for sessionDuration: "${value}"`)
  }

  return Math.max(0, ms)
}

/**
 * This function performs task listing logic.
 */
export async function doTaskList({
  user,
  input,
  params,
  options,
}: TaskActionParams): Promise<ActionReturn> {
  debug(`do task list`, {
    user,
    input,
    params,
    options,
  }).log('action.exec.task.doTaskList')

  const {
    '@scope': scope,
    botId,
    meta,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: taskListSchema,
    options,
  })

  debug(`vars`, { scope, botId, meta }).log('action.exec.task.doTaskList')

  let metaWhere = {}

  if (meta && Object.keys(meta).length > 0) {
    metaWhere = {
      AND: buildMetaQueryFilter(meta),
    }
  }

  const listScopedWhere = await getTaskScopedWhere({
    userId: user.id,
    scope: scope,
    options: options,
    explicitBotId: botId,
  })

  debug(`list scoped where`, { listScopedWhere }).log(
    'action.exec.task.doTaskList'
  )

  const tasks = await prisma.task.findMany({
    where: {
      ...listScopedWhere,

      userId: user.id, // @note added for more security

      ...metaWhere,
    },

    select: {
      id: true,

      name: true,
      description: true,

      schedule: true,

      status: true,
      outcome: true,

      lastRunAt: true,
      nextRunAt: true,

      // @note include the latest execution's summary/outcome so the caller can
      // read results across many tasks in one list call, without a fetch per
      // task (the orchestrator's "join" over its dispatched sub-tasks).
      taskExecutions: {
        select: {
          status: true,
          outcome: true,
          completedAt: true,
          summary: true,
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 1,
      },
    },

    orderBy: {
      createdAt: 'desc',
    },

    take: 10,
  })

  debug(`tasks`, { tasks }).log('action.exec.task.doTaskList')

  return {
    result: tasks,
    messages: [],
  }
}

/**
 * This function performs task fetching logic.
 */
export async function doTaskFetch({
  user,
  input,
  params,
  options,
}: TaskActionParams): Promise<ActionReturn> {
  debug(`do task fetch`, {
    user,
    input,
    params,
    options,
  }).log('action.exec.task.doTaskFetch')

  const {
    '@scope': scope,
    botId: botId,
    taskId: taskId,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: taskFetchSchema,
    options,
  })

  debug(`vars`, { scope, botId, taskId }).log('action.exec.task.doTaskFetch')

  const fetchScopedWhere = await getTaskScopedWhere({
    userId: user.id,
    scope: scope,
    options: options,
    explicitBotId: botId,
  })

  debug(`fetch scoped where`, { fetchScopedWhere }).log(
    'action.exec.task.doTaskFetch'
  )

  const task = await prisma.task.findFirst({
    where: {
      ...fetchScopedWhere,

      id: taskId,

      userId: user.id, // @note added for more security
    },

    select: {
      id: true,

      name: true,
      description: true,

      status: true,
      outcome: true,

      // @note fetch is the full record of one task: its configuration and
      // bounds, the assigned bot, and the execution history with full outputs -
      // the detail that would be too heavy to return per row in a list.
      schedule: true,
      timezone: true,

      maxIterations: true,
      maxTime: true,
      maxCalls: true,
      sessionDuration: true,

      expiresAt: true,

      lastRunAt: true,
      nextRunAt: true,

      meta: true,

      bot: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },

      taskExecutions: {
        select: {
          id: true,

          name: true,
          description: true,

          status: true,
          outcome: true,

          completedAt: true,

          summary: true,

          meta: true,

          // @note the full final output of the run, not just the distilled
          // summary - this is the main reason to fetch over list.
          endMessage: {
            select: {
              text: true,
            },
          },

          createdAt: true,
          updatedAt: true,

          conversation: {
            select: {
              id: true,

              name: true,
              description: true,
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },

        // @note recent execution history, not just the latest run as list returns
        take: 10,
      },
    },
  })

  if (!task) {
    throw new UserResourceNotFoundError(`Task not found`)
  }

  debug(`task`, { task }).log('action.exec.task.doTaskFetch')

  return {
    result: task,
    messages: [],
  }
}

/**
 * This function performs task creation logic.
 */
export async function doTaskCreate({
  user,
  input,
  params,
  options,
}: TaskActionParams): Promise<ActionReturn> {
  debug(`do task create`, {
    user,
    input,
    params,
    options,
  }).log('action.exec.task.doTaskCreate')

  const {
    '@scope': scope,
    botId,
    name,
    description,
    schedule,
    timezone,
    maxIterations,
    maxTime,
    maxCalls,
    sessionDuration,
    meta,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: taskCreateSchema,
    options,
  })

  debug(`vars`, { scope, botId, name, description, meta }).log(
    'action.exec.task.doTaskCreate'
  )

  const contact = getContextContact()
  const namespace = getContextNamespace()

  const taskActionBotId = getTaskActionBotId(options, botId)

  const resolvedBot = taskActionBotId
    ? await prisma.bot.findUnique({
        where: {
          id: taskActionBotId,
        },
      })
    : null

  if (!resolvedBot) {
    throw new UserInputError(`Bot not found`)
  }

  if ((await canUseBot(user.id, resolvedBot)) === false) {
    throw new UserInputError(`Bot not found`)
  }

  const normalizedSchedule =
    schedule === undefined
      ? undefined
      : schedule === ''
        ? null
        : getTaskSchedule(schedule)

  const normalizedTimezone =
    timezone === undefined ? undefined : timezone || null

  const nextRunAt = normalizedSchedule
    ? getNext(normalizedSchedule, { timezone: normalizedTimezone })
    : null

  const taskMeta =
    meta || namespace
      ? {
          ...(meta || {}),
          ...(namespace ? { namespace } : {}),
        }
      : undefined

  const task = await prisma.task.create({
    data: {
      userId: user.id,

      botId: resolvedBot.id,

      contactId: contact?.id,

      name,
      description,

      schedule: normalizedSchedule,
      timezone: normalizedTimezone,

      maxIterations: normalizeMaxIterations(maxIterations),
      maxTime: normalizeMaxTime(maxTime),
      maxCalls: normalizeMaxCalls(maxCalls),
      sessionDuration: normalizeSessionDuration(sessionDuration),

      ...(normalizedSchedule
        ? {
            nextRunAt: nextRunAt && nextRunAt > new Date() ? nextRunAt : null,
          }
        : {}),

      // @note a scheduled (recurring or future-dated) task must not carry an
      // auto-expiry, otherwise the cleanup sweep would collect it out from under
      // its schedule. Only unscheduled tasks get the namespace/contact-derived
      // expiry.
      // @todo perhaps make the task expiery customisable for both create and
      // the update routes
      expiresAt: normalizedSchedule
        ? undefined
        : getTaskExpiresAt(namespace, contact),

      meta: taskMeta,
    },

    select: {
      id: true,

      name: true,
      description: true,

      schedule: true,
      timezone: true,

      expiresAt: true,
    },
  })

  debug(`task`, { task }).log('action.exec.task.doTaskCreate')

  // @note 'now' means execute immediately after creation
  if (schedule === 'now') {
    await executeTask(task.id)
  }

  return {
    result: task,
    messages: [],
  }
}

/**
 * This function performs task update logic.
 */
export async function doTaskUpdate({
  user,
  input,
  params,
  options,
}: TaskActionParams): Promise<ActionReturn> {
  debug(`do task update`, {
    user,
    input,
    params,
    options,
  }).log('action.exec.task.doTaskUpdate')

  const {
    '@scope': scope,
    botId,
    taskId,
    name,
    description,
    schedule,
    timezone,
    maxIterations,
    maxTime,
    maxCalls,
    sessionDuration,
    meta,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: taskUpdateSchema,
    options,
  })

  debug(`vars`, { scope, botId, taskId, name, description, meta }).log(
    'action.exec.task.doTaskUpdate'
  )

  const updateScopedWhere = await getTaskScopedWhere({
    userId: user.id,
    scope: scope,
    options: options,
    explicitBotId: botId,
  })

  debug(`update scoped where`, { updateScopedWhere }).log(
    'action.exec.task.doTaskUpdate'
  )

  const existingTask = await prisma.task.findFirst({
    where: {
      ...updateScopedWhere,

      id: taskId,

      userId: user.id, // @note added for more security
    },
  })

  if (!existingTask) {
    throw new UserResourceNotFoundError(`Task not found`)
  }

  const existingMeta =
    existingTask.meta &&
    typeof existingTask.meta === 'object' &&
    !Array.isArray(existingTask.meta)
      ? (existingTask.meta as Record<string, unknown>)
      : undefined

  const normalizedSchedule =
    schedule === undefined
      ? undefined
      : schedule === ''
        ? null
        : getTaskSchedule(schedule)

  const normalizedTimezone =
    timezone === undefined ? undefined : timezone || null
  const effectiveSchedule =
    normalizedSchedule !== undefined
      ? normalizedSchedule
      : existingTask.schedule
  const effectiveTimezone =
    normalizedTimezone !== undefined
      ? normalizedTimezone
      : existingTask.timezone
  const nextRunAt =
    effectiveSchedule &&
    (normalizedSchedule !== undefined || normalizedTimezone !== undefined)
      ? getNext(effectiveSchedule, { timezone: effectiveTimezone })
      : null

  const task = await prisma.task.update({
    where: {
      id: taskId,
    },

    data: {
      name,
      description,

      schedule: normalizedSchedule,
      timezone: normalizedTimezone,

      maxIterations: normalizeMaxIterations(maxIterations),
      maxTime: normalizeMaxTime(maxTime),
      maxCalls: normalizeMaxCalls(maxCalls),
      sessionDuration: normalizeSessionDuration(sessionDuration),

      nextRunAt:
        normalizedSchedule !== undefined || normalizedTimezone !== undefined
          ? effectiveSchedule
            ? nextRunAt && nextRunAt > new Date()
              ? nextRunAt
              : null
            : null
          : undefined,

      ...(meta !== undefined
        ? {
            meta: getMeta(meta, existingMeta),
          }
        : {}),
    },

    select: {
      id: true,

      name: true,
      description: true,

      schedule: true,
      timezone: true,

      expiresAt: true,
    },
  })

  debug(`task`, { task }).log('action.exec.task.doTaskUpdate')

  return {
    result: task,
    messages: [],
  }
}

/**
 * This function performs task deletion logic.
 */
export async function doTaskDelete({
  user,
  input,
  params,
  options,
}: TaskActionParams): Promise<ActionReturn> {
  debug(`do task delete`, {
    user,
    input,
    params,
    options,
  }).log('action.exec.task.doTaskDelete')

  const {
    '@scope': scope,
    botId: botId,
    taskId: taskId,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: taskDeleteSchema,
    options,
  })

  debug(`vars`, { scope, botId, taskId }).log('action.exec.task.doTaskDelete')

  const deleteScopedWhere = await getTaskScopedWhere({
    userId: user.id,
    scope: scope,
    options: options,
    explicitBotId: botId,
  })

  debug(`delete scoped where`, { deleteScopedWhere }).log(
    'action.exec.task.doTaskDelete'
  )

  const existingTask = await prisma.task.findFirst({
    where: {
      ...deleteScopedWhere,

      id: taskId,

      userId: user.id, // @note added for more security
    },
  })

  if (!existingTask) {
    throw new UserResourceNotFoundError(`Task not found`)
  }

  const task = await prisma.task.delete({
    where: {
      id: taskId,
    },

    select: {
      id: true,
    },
  })

  debug(`task`, { task }).log('action.exec.task.doTaskDelete')

  return {
    result: task,
    messages: [],
  }
}

/**
 * This function performs task execution logic.
 */
export async function doTaskRun({
  user,
  input,
  params,
  options,
}: TaskActionParams): Promise<ActionReturn> {
  debug(`do task run`, {
    user,
    input,
    params,
    options,
  }).log('action.exec.task.doTaskRun')

  const {
    '@scope': scope,
    botId: botId,
    taskId: taskId,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: taskRunSchema,
    options,
  })

  debug(`vars`, { scope, botId, taskId }).log('action.exec.task.doTaskRun')

  const runScopedWhere = await getTaskScopedWhere({
    userId: user.id,
    scope: scope,
    options: options,
    explicitBotId: botId,
  })

  debug(`run scoped where`, { runScopedWhere }).log(
    'action.exec.task.doTaskRun'
  )

  const task = await prisma.task.findFirst({
    where: {
      ...runScopedWhere,

      id: taskId,

      userId: user.id, // @note added for more security
    },

    select: {
      id: true,
    },
  })

  debug(`task`, { task }).log('action.exec.task.doTaskRun')

  if (!task) {
    throw new UserResourceNotFoundError(`Task not found`)
  }

  await executeTask(task.id)

  return {
    result: task,
    messages: [],
  }
}

// --- Main ---

/**
 * The main router for the task action.
 */
export async function executeTaskAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute task action`, { input, params, options }).log(
    'action.exec.task.executeTaskAction'
  )

  const user = getContextUser()

  if (!user) {
    throw new Error(`Missing user`)
  }

  type TaskOperation =
    | typeof TASK_LIST_OPERATION_NAME
    | typeof TASK_FETCH_OPERATION_NAME
    | typeof TASK_CREATE_OPERATION_NAME
    | typeof TASK_UPDATE_OPERATION_NAME
    | typeof TASK_DELETE_OPERATION_NAME
    | typeof TASK_RUN_OPERATION_NAME

  let operation: TaskOperation

  {
    switch (true) {
      case 'list' in params: {
        operation = TASK_LIST_OPERATION_NAME

        break
      }

      case 'fetch' in params: {
        operation = TASK_FETCH_OPERATION_NAME

        break
      }

      case 'create' in params: {
        operation = TASK_CREATE_OPERATION_NAME

        break
      }

      case 'update' in params: {
        operation = TASK_UPDATE_OPERATION_NAME

        break
      }

      case 'delete' in params: {
        operation = TASK_DELETE_OPERATION_NAME

        break
      }

      case 'run' in params: {
        operation = TASK_RUN_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown operation`)
      }
    }
  }

  let response: ActionReturn

  const actionParams = { user, input, params, options }

  switch (operation) {
    case TASK_LIST_OPERATION_NAME: {
      response = await doTaskList(actionParams)

      break
    }

    case TASK_FETCH_OPERATION_NAME: {
      response = await doTaskFetch(actionParams)

      break
    }

    case TASK_CREATE_OPERATION_NAME: {
      response = await doTaskCreate(actionParams)

      break
    }

    case TASK_UPDATE_OPERATION_NAME: {
      response = await doTaskUpdate(actionParams)

      break
    }

    case TASK_DELETE_OPERATION_NAME: {
      response = await doTaskDelete(actionParams)

      break
    }

    case TASK_RUN_OPERATION_NAME: {
      response = await doTaskRun(actionParams)

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}
