// @ts-check
import debug from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import { cleanupOldAuditLogs } from '@/lib/log.cleanup'
import queue from '@/lib/queue'
import { withQueueHandler } from '@/lib/queue2'
import { parseAsync } from '@/lib/zod.schema'

import { z } from 'zod'

export const CLEANUP_EVENT_TYPE = 'cleanup'

/**
 * @typedef {z.infer<typeof CleanupPayloadSchema>} CleanupPayload
 */
export const CleanupPayloadSchema = z.object({
  // pass
})

/**
 * @typedef {{
 *  type: typeof CLEANUP_EVENT_TYPE,
 *  payload: CleanupPayload
 * }} CleanupEvent
 *
 * @param {CleanupPayload} payload
 * @returns {Promise<void>}
 */
export async function handleCleanupEvent(payload) {
  debug(`cleanup`, { payload }).log('audit.log.queue.handleCleanupEvent')

  await cleanupOldAuditLogs()
}

/**
 * @param {CleanupEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(event) {
  switch (true) {
    case event.type === CLEANUP_EVENT_TYPE: {
      await parseAsync(CleanupPayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(`/api/v1/audit/log/queue`, event)
}

/**
 */
export default withQueueHandler({
  [CLEANUP_EVENT_TYPE]: {
    handler: handleCleanupEvent,
    schema: CleanupPayloadSchema,
  },
})
