// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import { runTasksBatch } from '@/lib/job'
import queue from '@/lib/queue'
import { withQueueHandler } from '@/lib/queue2'
import { parseAsync } from '@/lib/zod.schema'

import { z } from 'zod'

export const MAX_RECORD_TAKE = 1000 // @note 1000 is the maximum number of records that can be taken
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
  debug(`cleanup`, { payload }).log('memory.queue.handleCleanupEvent')

  const expiredMemories =
    /** @type {AsyncGenerator<import('@/prisma/types').Memory>} */ (
      prisma.memory.paginate({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },

        take: MAX_RECORD_TAKE,
      })
    )

  await runTasksBatch(
    MAX_CONCURRENT_WORKERS,
    expiredMemories,
    async (memories) => {
      debug(`deleting expired memories`, { memories }).log(
        'memory.queue.handleCleanupEvent'
      )

      await prisma.memory.deleteMany({
        where: {
          id: {
            in: memories.map((memory) => memory.id),
          },
        },
      })
    },
    MAX_RECORD_BATCH
  )
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

  await queue(`/api/v1/memory/queue`, event)
}

/**
 */
export default withQueueHandler({
  [CLEANUP_EVENT_TYPE]: {
    handler: handleCleanupEvent,
    schema: CleanupPayloadSchema,
  },
})
