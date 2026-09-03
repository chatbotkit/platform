// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import queue from '@/lib/queue'
import { withQueueHandler } from '@/lib/queue2'

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
 *   type: typeof CLEANUP_EVENT_TYPE,
 *   payload: CleanupPayload
 * }} CleanupEvent
 *
 * @param {CleanupPayload} payload
 * @returns {Promise<void>}
 */
export async function handleCleanupEvent(payload) {
  debug(`cleanup`, { payload })

  const now = new Date()

  await prisma.session.deleteMany({
    where: {
      expires: {
        lt: now,
      },
    },

    // @todo must limit to 1000 items
  })
}

/**
 * @param {CleanupEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(event) {
  switch (true) {
    case event.type === CLEANUP_EVENT_TYPE: {
      await CleanupPayloadSchema.parseAsync(event.payload)

      break
    }
  }

  await queue(`/api/session/queue`, event)
}

/**
 */
export default withQueueHandler({
  [CLEANUP_EVENT_TYPE]: {
    handler: handleCleanupEvent,
    schema: CleanupPayloadSchema,
  },
})
