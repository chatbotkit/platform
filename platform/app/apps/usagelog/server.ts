'use server'

import prisma from '@/prisma/client'

import { appActionHandler } from '@/lib/app.action'
import { makeJsonSafe } from '@/lib/struct'

import ConfigSchema from './config'
import { APP_NAME } from './const'

import { z } from '@/lib/zod.schema'

export type UsageLogItem = {
  id: string
  type: string
  count: number
  conversationId?: string | null
  messageId?: string | null
  taskId?: string | null
  contactId?: string | null
  blueprintId?: string | null
  botId?: string | null
  datasetId?: string | null
  skillsetId?: string | null
  abilityId?: string | null
  meta?: Record<string, unknown> | null
  createdAt: number
  updatedAt: number
}

export type ListLogsResult = {
  items: UsageLogItem[]
  cursor?: string
}

type FetchLogsParams = {
  cursor?: string
  order?: 'asc' | 'desc'
  take?: number
}

async function fetchLogs(
  userId: string,
  params: FetchLogsParams
): Promise<ListLogsResult> {
  const { cursor, order = 'desc', take = 50 } = params

  const items = makeJsonSafe(
    await prisma.usage.findMany({
      where: {
        userId,
      },
      orderBy: [{ createdAt: order }, { id: order }],
      take,
      ...(cursor
        ? {
            cursor: {
              id: cursor,
            },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        type: true,
        count: true,
        conversationId: true,
        messageId: true,
        taskId: true,
        contactId: true,
        blueprintId: true,
        botId: true,
        datasetId: true,
        skillsetId: true,
        abilityId: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  ) as UsageLogItem[]

  return {
    items,
    cursor: items.length > 0 ? items[items.length - 1].id : undefined,
  }
}

/**
 * @action
 */
export const listLogs = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    cursor: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    take: z.number().optional(),
  }),
  async (_config, session, params): Promise<ListLogsResult> => {
    return fetchLogs(session.user.id, params)
  }
)

/**
 * @action
 */
export const listAll = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    cursor: z.string().optional(),
  }),
  async (_config, session, params): Promise<ListLogsResult> => {
    return fetchLogs(session.user.id, params)
  }
)
