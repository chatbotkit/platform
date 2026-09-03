'use server'

import prisma from '@/prisma/client'

import { appActionHandler } from '@/lib/app.action'
import { makeJsonSafe } from '@/lib/struct'

import ConfigSchema from './config'
import { APP_NAME } from './const'

import { z } from '@/lib/zod.schema'

export type AuditLogItem = {
  id: string
  name?: string | null
  description?: string | null
  action?: string | null
  conversationId?: string | null
  taskId?: string | null
  contactId?: string | null
  spaceId?: string | null
  blueprintId?: string | null
  botId?: string | null
  datasetId?: string | null
  recordId?: string | null
  skillsetId?: string | null
  abilityId?: string | null
  fileId?: string | null
  secretId?: string | null
  portalId?: string | null
  policyId?: string | null
  webhookId?: string | null
  sessionId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  meta?: Record<string, unknown> | null
  createdAt: number
  updatedAt: number
}

export type ListLogsResult = {
  items: AuditLogItem[]
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
    await prisma.auditLog.findMany({
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
        name: true,
        description: true,
        action: true,
        conversationId: true,
        taskId: true,
        contactId: true,
        spaceId: true,
        blueprintId: true,
        botId: true,
        datasetId: true,
        recordId: true,
        skillsetId: true,
        abilityId: true,
        fileId: true,
        secretId: true,
        portalId: true,
        policyId: true,
        webhookId: true,
        sessionId: true,
        oldValues: true,
        newValues: true,
        ipAddress: true,
        userAgent: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  ) as AuditLogItem[]

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
