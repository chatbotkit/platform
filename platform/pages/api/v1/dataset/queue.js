// @ts-check
import debug from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import queue from '@/lib/queue'
import { withQueueHandler } from '@/lib/queue2'
import { parseAsync } from '@/lib/zod.schema'

import { z } from 'zod'

export const MAX_RECORD_TAKE = 1000
export const MAX_RECORD_BATCH = 100
export const MAX_CONCURRENT_WORKERS = 10

export const CLEANUP_EVENT_TYPE = 'cleanup'

/**
 * @typedef {z.infer<typeof CleanupPayloadSchema>} CleanupPayload
 */
export const CleanupPayloadSchema = z.object({
  // pass
})

/**
 * @typedef {{
 *   type: typeof CLEANUP_EVENT_TYPE,
 *   payload: CleanupPayload
 * }} CleanupEvent
 *
 * @param {CleanupPayload} payload
 * @returns {Promise<void>}
 */
export async function handleCleanupEvent(payload) {
  debug(`cleanup`, { payload }).log('dataset.queue.handleCleanupEvent')

  // @note record expiration cleanup is no longer supported since records are
  // now stored in the vector service which does not support expiration.
  // This handler is kept for backwards compatibility but does nothing.
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

  await queue(`/api/v1/dataset/queue`, event)
}

/**
 */
export default withQueueHandler({
  [CLEANUP_EVENT_TYPE]: {
    handler: handleCleanupEvent,
    schema: CleanupPayloadSchema,
  },
})
