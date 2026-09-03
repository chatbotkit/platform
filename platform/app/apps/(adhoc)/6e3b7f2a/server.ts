'use server'

import { appActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { getTemporaryUserSessionToken } from '@/lib/session.temp'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME } from './const'
import {
  type AutomationItem,
  compareByUpdatedAtDesc,
  normalizeTask,
} from './normalize'

const PAGE_TAKE = 100
const MAX_PAGE_COUNT = 5

const LIST_TOKEN_DURATION_SECONDS = 15 * 60
const TASK_TOKEN_DURATION_SECONDS = 15 * 60

export type ListAllResult = {
  items: AutomationItem[]
  updatedAt: number
}

async function listPaginatedItems(
  fetchPage: (request: {
    cursor?: string
    order: 'asc' | 'desc'
    take: number
  }) => Promise<{ items?: Array<Record<string, unknown>>; cursor?: string }>
) {
  const items: Array<Record<string, unknown>> = []

  let cursor: string | undefined

  for (let index = 0; index < MAX_PAGE_COUNT; index += 1) {
    const result = await fetchPage({ cursor, order: 'desc', take: PAGE_TAKE })

    const pageItems = result.items || []

    items.push(...pageItems)

    if (!result.cursor || pageItems.length === 0) {
      break
    }

    cursor = result.cursor
  }

  return items
}

/**
 * @action
 *
 * Light task list used for the SSR initial data - task-level rows only. The
 * per-task execution lookup that used to fan out here is gone; execution detail
 * and live activity are fetched client-direct on selection via the mint facades
 * below. The client refreshes the list directly too (this is only the first
 * paint).
 */
export const listAll = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    includeIdle: z.boolean().optional(),
    take: z.number().optional(),
  }),
  async (
    _config,
    session,
    { includeIdle = false, take = 60 }
  ): Promise<ListAllResult> => {
    const client = await getSessionClient(session)

    const taskData = await listPaginatedItems((request) =>
      client.task.list(request)
    )

    const items = taskData
      .map(normalizeTask)
      .filter((item) => (includeIdle ? true : item.status === 'running'))
      .sort(compareByUpdatedAtDesc)
      .slice(0, take)

    return {
      items,
      updatedAt: Date.now(),
    }
  }
)

// @note the mint actions only AUTHORIZE + SCOPE - they return short-lived bearer
// tokens the embedded client uses to call the task API directly (and in
// parallel). Tokens act as the embedding user and are restricted to the listed
// routes, so they cannot reach anything else.

/**
 * @action
 *
 * Mint a token the client uses to list tasks directly against the API.
 */
export const mintAutomationsListToken = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (_config, session) => {
    const token = await getTemporaryUserSessionToken(session, {
      allowedRoutes: ['/api/v1/task/list'],
      durationInSeconds: LIST_TOKEN_DURATION_SECONDS,
    })

    return { token }
  }
)

/**
 * @action
 *
 * Mint a token scoped to a single task's read + control routes (fetch,
 * executions, subscribe, cancel). The client uses it to refresh that task,
 * stream its live workflow events, and cancel it - directly, no per-tick server
 * aggregation.
 */
export const mintAutomationToken = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    taskId: z.string(),
  }),
  async (_config, session, { taskId }) => {
    const token = await getTemporaryUserSessionToken(session, {
      allowedRoutes: [`/api/v1/task/${taskId}/**`],
      durationInSeconds: TASK_TOKEN_DURATION_SECONDS,
    })

    return { token }
  }
)

/**
 * @action
 */
export const cancelAutomation = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    kind: z.literal('task'),
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const client = await getSessionClient(session)

    return client.task.cancel(id)
  }
)

/**
 * @action
 */
export const cancelAutomationExecution = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    kind: z.literal('task'),
    id: z.string(),
    executionId: z.string(),
  }),
  async (_config, session, { id, executionId }) => {
    const client = await getSessionClient(session)

    return client.task.execution.cancel(id, executionId)
  }
)
