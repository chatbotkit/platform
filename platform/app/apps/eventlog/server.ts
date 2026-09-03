'use server'

import { appActionHandler } from '@/lib/app.action'
import type { StoreSession } from '@/lib/app.context'
import { getSessionClient } from '@/lib/cbk.sdk'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME } from './const'

import { stream } from '@chatbotkit/react/utils/stream'

export type EventLogItem = {
  id: string
  name?: string
  description?: string
  type: string
  conversationId?: string
  taskId?: string
  contactId?: string
  blueprintId?: string
  botId?: string
  datasetId?: string
  recordId?: string
  skillsetId?: string
  abilityId?: string
  fileId?: string
  secretId?: string
  portalId?: string
  widgetIntegrationId?: string
  slackIntegrationId?: string
  githubIntegrationId?: string
  discordIntegrationId?: string
  microsoftteamsIntegrationId?: string
  googlechatIntegrationId?: string
  whatsappIntegrationId?: string
  messengerIntegrationId?: string
  instagramIntegrationId?: string
  telegramIntegrationId?: string
  twilioIntegrationId?: string
  emailIntegrationId?: string
  sitemapIntegrationId?: string
  notionIntegrationId?: string
  triggerIntegrationId?: string
  supportIntegrationId?: string
  extractIntegrationId?: string
  mcpserverIntegrationId?: string
  skillserverIntegrationId?: string
  // @todo enable when anam/avatar/recall emit events (see the schema +
  // event log/metric whitelists)
  // anamIntegrationId?: string
  // avatarIntegrationId?: string
  // recallIntegrationId?: string
  meta?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export type ListLogsResult = {
  items: EventLogItem[]
  cursor?: string
}

type FetchLogsParams = {
  cursor?: string
  order?: 'asc' | 'desc'
  take?: number
}

// @note internal helper function to fetch logs using the SDK event.log.list method
async function fetchLogs(
  session: StoreSession,
  params: FetchLogsParams
): Promise<ListLogsResult> {
  const { cursor, order = 'desc', take = 50 } = params

  const client = await getSessionClient(session)

  const data = await client.event.log.list({
    cursor,
    order,
    take,
  })

  const items = data.items || []

  // @note the API returns the last item's ID as the cursor for pagination
  const nextCursor = items.length > 0 ? items[items.length - 1].id : undefined

  return {
    items,
    cursor: nextCursor,
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
    return fetchLogs(session, params)
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
    return fetchLogs(session, params)
  }
)

/**
 * Subscribes to live event logs using the SDK event.log.subscribe method.
 *
 * @action
 */
export const subscribeLogs = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    historyLength: z.number().optional(),
  }),
  async (_config, session, { historyLength = 10 }) => {
    return stream(
      (async function* () {
        const client = await getSessionClient(session)

        const subscription = client.event.log.subscribe({
          historyLength,
        })

        for await (const event of subscription.stream()) {
          yield event
        }
      })()
    )
  }
)
