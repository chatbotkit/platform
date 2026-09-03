// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { throwNotFound } from '@/lib/response'
import { parseAsync } from '@/lib/zod.schema'

import { doSync } from '@/pages/api/v1/integration/sitemap/[sitemapIntegrationId]/sync'

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
 * @param {string} sitemapIntegrationId
 * @param {SyncPayload} payload
 * @returns {Promise<void>}
 */
export async function handleSyncEvent(sitemapIntegrationId, payload) {
  debug(`sync`, { sitemapIntegrationId, payload })

  const integration = await prisma.sitemapIntegration.findUnique({
    where: {
      id: sitemapIntegrationId,
    },

    include: {
      user: true,
    },
  })

  if (!integration) {
    return throwNotFound(
      `SitemapIntegration not found: ${sitemapIntegrationId}`
    )
  }

  await doSync(integration)
}

/**
 * @param {string} sitemapIntegrationId
 * @param {SyncEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(sitemapIntegrationId, event) {
  switch (true) {
    case event.type === SYNC_EVENT_TYPE: {
      await parseAsync(SyncPayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(
    `/api/v1/integration/sitemap/${sitemapIntegrationId}/queue`,
    event
  )
}

/**
 */
export default withQueueHandlerBounded('sitemapIntegrationId', {
  [SYNC_EVENT_TYPE]: {
    handler: handleSyncEvent,
    schema: SyncPayloadSchema,
  },
})
