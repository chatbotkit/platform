'use server'

import { appActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME } from './const'

/**
 * @action
 */
export const getConversations = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    cursor: z.string().optional(),
    take: z.number().default(10),
    order: z.enum(['asc', 'desc']).default('desc'),
    meta: z.record(z.unknown()).optional(),
  }),
  async (_config, session, { cursor, take, order, meta }) => {
    const cbk = await getSessionClient(session)

    const { items, cursor: nextCursor } = await cbk.conversation.list({
      cursor,
      take,
      order,

      ...(meta
        ? Object.fromEntries(
            Object.entries(meta).map(([key, value]) => {
              return [`meta.${key}`, value]
            })
          )
        : {}),
    })

    return { items, cursor: nextCursor }
  }
)

/**
 * @action
 */
export const deleteConversation = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    id: z.string(),
  }),
  async (_config, session, { id }) => {
    const cbk = await getSessionClient(session)

    await cbk.conversation.delete(id)

    return {
      id,
    }
  }
)
