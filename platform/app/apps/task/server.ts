'use server'

import { Schedule } from '@/prisma/types'

import { appActionHandler, appContactActionHandler } from '@/lib/app.action'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import { getSessionGraphQLClient } from '@/lib/cbk.graphql'
import { getSessionClient } from '@/lib/cbk.sdk'
import debug from '@/lib/debug'
import { captureException, errorToErrorResponse } from '@/lib/error'
import { throwNotFound, throwUnprocessableEntity } from '@/lib/response'
import { isSchedule } from '@/lib/task.validation'
import { z } from '@/lib/zod.schema'

import { assertAllowedBotId, getAllowedBotIds } from './bot.policy'
import ConfigSchema from './config'
import { APP_NAME, CONTACT_NAMESPACE } from './const'

import type { BotListResponse } from '@chatbotkit/sdk/bot/v1'
import type { TaskListResponse } from '@chatbotkit/sdk/contact/task/v1'
import type {
  TaskCreateResponse,
  TaskDeleteResponse,
  TaskUpdateResponse,
} from '@chatbotkit/sdk/task/v1'

type ContactTaskItem = TaskListResponse['items'][number]

const taskScheduleSchema = z.string().refine((value) => isSchedule(value), {
  message: 'Invalid schedule',
})

async function listTasksForContact(session, contactId: string) {
  const userClient = await getSessionClient(session)

  const { items: tasks } = await userClient.contact.task.list(contactId).cache()

  return tasks
}

function ensureContactTask(
  tasks: ContactTaskItem[],
  taskId: string
): ContactTaskItem {
  const task = tasks.find((task) => task.id === taskId)

  if (!task) {
    throwNotFound('Task not found')
  }

  return task
}

/**
 * @action
 */
export const listBots = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (config, session, {}): Promise<BotListResponse['items']> => {
    const userClient = await getSessionClient(session)

    let { items: bots } = await userClient.bot.list().cache()

    if (session.payload.aud === APP_AUDIENCE) {
      const allowedBotIds = getAllowedBotIds(config)

      if (allowedBotIds) {
        const configBots: Array<{ id: string }> = config.bots!.map((bot) =>
          typeof bot === 'string' ? { id: bot } : bot
        )

        bots = bots.filter((bot) => allowedBotIds.includes(bot.id))

        bots = configBots.map(({ id, ...rest }) => ({
          ...bots.find((bot) => bot.id === id),
          ...rest,

          id: id,
        })) as BotListResponse['items']
      }
    }

    return bots
  }
)

/**
 * @action
 */
export const listTasks = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({}),
  async (_config, session, contact, {}): Promise<TaskListResponse['items']> => {
    debug(`list tasks`).log('apps.task.listTasks')

    return await listTasksForContact(session, contact.id)
  }
)

/**
 * @action
 */
export const fetchTaskDetails = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, contact, { id }) => {
    const userClient = await getSessionClient(session)
    const userGraphQLClient = await getSessionGraphQLClient(session)

    const listedTasks = await listTasksForContact(session, contact.id)
    const listedTask = ensureContactTask(listedTasks, id)

    const result = await userGraphQLClient.listContactTasks({
      contactIds: [contact.id],
      taskIds: [id],
    })

    const task = result.tasks?.edges?.[0]?.node

    if (!task?.id) {
      throwNotFound('Task not found')
    }

    const conversations = task.conversations?.edges || []

    const sortedConversations = [...conversations].sort((a, b) => {
      const aTime = a?.node?.updatedAt
        ? new Date(a.node.updatedAt).getTime()
        : 0
      const bTime = b?.node?.updatedAt
        ? new Date(b.node.updatedAt).getTime()
        : 0

      return bTime - aTime
    })

    const mostRecentConversation = sortedConversations[0]?.node

    let messages: Array<{
      id: string
      type: string
      text?: string
      from?: string
      createdAt?: number
    }> = []

    if (mostRecentConversation?.id) {
      const conversationMessages = await userClient.conversation.message.list(
        mostRecentConversation.id,
        {
          order: 'desc',
          take: 50,
        }
      )

      messages = conversationMessages.items
        .reverse()
        .map(({ id, type, text, meta, createdAt }) => ({
          id,
          type,
          text,
          from: typeof meta?.from === 'string' ? meta.from : undefined,
          createdAt,
        }))
    }

    return {
      id: task.id,
      name: task.name || undefined,
      description: task.description || undefined,
      schedule: listedTask?.schedule || undefined,
      timezone:
        (listedTask as ContactTaskItem & { timezone?: string | null })
          ?.timezone || undefined,
      status: listedTask?.status || task.status || undefined,
      outcome: listedTask?.outcome || task.outcome || undefined,
      lastRunAt: task.updatedAt || undefined,
      updatedAt: task.updatedAt || undefined,
      conversation: mostRecentConversation
        ? {
            id: mostRecentConversation.id || '',
            name: mostRecentConversation.name || undefined,
            description: mostRecentConversation.description || undefined,
          }
        : undefined,
      messages,
    }
  }
)

/**
 * @action
 */
export const createTask = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    name: z.string(),
    description: z.string(),
    botId: z.string(),
    schedule: taskScheduleSchema,
    timezone: z.string().optional(),
  }),
  async (
    config,
    session,
    contact,
    { name, description, botId, schedule, timezone }
  ): Promise<TaskCreateResponse> => {
    debug(`creating task`, {
      name,
      description,
      botId,
      schedule,
      timezone,
    }).log('apps.task.createTask')

    const userClient = await getSessionClient(session)

    assertAllowedBotId(getAllowedBotIds(config), botId)

    const task = await userClient.task.create({
      name,
      description,
      contactId: contact.id,
      botId,
      schedule,
      timezone,
    } as Parameters<typeof userClient.task.create>[0] & {
      timezone?: string
    })

    if (schedule === Schedule.never) {
      try {
        await userClient.task.trigger(task.id)
      } catch (error) {
        // @note task is already created; keep create successful and record trigger failure
        await captureException(error)
      }
    }

    return task
  }
)

/**
 * @action
 */
export const updateTask = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    botId: z.string(),
    schedule: taskScheduleSchema,
    timezone: z.string().optional(),
  }),
  async (
    config,
    session,
    contact,
    { id, name, description, botId, schedule, timezone }
  ): Promise<TaskUpdateResponse> => {
    debug(`updating task`, {
      id,
      name,
      description,
      botId,
      schedule,
      timezone,
    }).log('apps.task.updateTask')

    const userClient = await getSessionClient(session)

    const listedTasks = await listTasksForContact(session, contact.id)

    ensureContactTask(listedTasks, id)

    assertAllowedBotId(getAllowedBotIds(config), botId)

    return await userClient.task.update(id, {
      name,
      description,
      botId,
      schedule,
      timezone,
    } as Parameters<typeof userClient.task.update>[1] & {
      timezone?: string
    })
  }
)

/**
 * @action
 */
export const deleteTask = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, contact, { id }): Promise<TaskDeleteResponse> => {
    debug(`deleting task`, { id }).log('apps.task.deleteTask')

    const userClient = await getSessionClient(session)

    const listedTasks = await listTasksForContact(session, contact.id)

    ensureContactTask(listedTasks, id)

    return await userClient.task.delete(id)
  }
)

/**
 * @action
 */
export const triggerTask = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, contact, { id }) => {
    debug(`triggering task`, { id }).log('apps.task.triggerTask')

    const userClient = await getSessionClient(session)

    const listedTasks = await listTasksForContact(session, contact.id)

    ensureContactTask(listedTasks, id)

    return await userClient.task.trigger(id)
  }
)

/**
 * @action
 */
export const listAll = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (
    _config,
    _session,
    {}
  ): Promise<{
    tasks: TaskListResponse['items']
    bots: BotListResponse['items']
  }> => {
    const [tasks, bots] = await Promise.all([listTasks({}), listBots({})])

    if (!tasks) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if (!bots) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if ('error' in tasks) {
      throw errorToErrorResponse(tasks.error)
    }

    if ('error' in bots) {
      throw errorToErrorResponse(bots.error)
    }

    return { tasks, bots }
  }
)
