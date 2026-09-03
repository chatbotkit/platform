// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { throwNotFound } from '@/lib/response'
import { parseAsync } from '@/lib/zod.schema'

import { doSync } from '@/pages/api/v1/integration/notion/[notionIntegrationId]/sync'

import { z } from 'zod'

export const SYNC_EVENT_TYPE = 'sync'

/**
 * @typedef {z.infer<typeof SyncPayloadSchema>} SyncPayload
 */
export const SyncPayloadSchema = z.object({})

/**
 * @typedef {{
 *   type: typeof SYNC_EVENT_TYPE,
 *   payload: SyncPayload
 * }} SyncEvent
 *
 * @param {string} notionIntegrationId
 * @param {SyncPayload} payload
 * @returns {Promise<void>}
 */
export async function handleSyncEvent(notionIntegrationId, payload) {
  debug(`sync`, { notionIntegrationId, payload })

  const integration = await prisma.notionIntegration.findUnique({
    where: {
      id: notionIntegrationId,
    },

    include: {
      user: true,
    },
  })

  if (!integration) {
    return throwNotFound(`NotionIntegration not found: ${notionIntegrationId}`)
  }

  await doSync(integration)
}

/**
 * @param {string} notionIntegrationId
 * @param {SyncEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(notionIntegrationId, event) {
  switch (true) {
    case event.type === SYNC_EVENT_TYPE: {
      await parseAsync(SyncPayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(`/api/v1/integration/notion/${notionIntegrationId}/queue`, event)
}

/**
 */
export default withQueueHandlerBounded('notionIntegrationId', {
  [SYNC_EVENT_TYPE]: {
    handler: handleSyncEvent,
    schema: SyncPayloadSchema,
  },
})
