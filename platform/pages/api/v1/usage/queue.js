// @ts-check
import debug from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import queue from '@/lib/queue'
import { withQueueHandler } from '@/lib/queue2'
import { throwNotFound } from '@/lib/response'
import { cleanupOldUsageRecords } from '@/lib/usage.cleanup'
import { captureUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'
import { parseAsync } from '@/lib/zod.schema'

import { z } from 'zod'

export const CLEANUP_EVENT_TYPE = 'cleanup'
export const RECORD_EVENT_TYPE = 'record'

/**
 * @typedef {z.infer<typeof CleanupPayloadSchema>} CleanupPayload
 */
export const CleanupPayloadSchema = z.object({
  // pass
})

/**
 * @typedef {z.infer<typeof RecordPayloadSchema>} RecordPayload
 */
export const RecordPayloadSchema = z.object({
  userId: z.string(),
  type: z.string().min(1),
  count: z.number(),
  meta: z.record(z.any()),
  references: z
    .object({
      conversationId: z.string().optional(),
      messageId: z.string().optional(),
      taskId: z.string().optional(),
      contactId: z.string().optional(),
      blueprintId: z.string().optional(),
      botId: z.string().optional(),
      datasetId: z.string().optional(),
      skillsetId: z.string().optional(),
      abilityId: z.string().optional(),
    })
    .optional(),
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
  debug(`cleanup`, { payload })

  await cleanupOldUsageRecords()
}

/**
 * @typedef {{
 *   type: typeof RECORD_EVENT_TYPE,
 *   payload: RecordPayload
 * }} RecordEvent
 *
 * @param {RecordPayload} payload
 * @returns {Promise<void>}
 */
export async function handleRecordEvent(payload) {
  debug(`record`, { payload })

  const { userId, type, count, meta, references } = payload

  if (!count) {
    return
  }

  const user = await fastGetUserById(userId)

  if (!user) {
    return throwNotFound(`User not found`)
  }

  await captureUsage({
    confirm: true,

    user,
    type,
    count,

    meta,

    references,
  })
}

/**
 * @param {CleanupEvent|RecordEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(event) {
  switch (true) {
    case event.type === CLEANUP_EVENT_TYPE: {
      await parseAsync(CleanupPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === RECORD_EVENT_TYPE: {
      await parseAsync(RecordPayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(`/api/v1/usage/queue`, event)
}

/**
 */
export default withQueueHandler({
  [CLEANUP_EVENT_TYPE]: {
    handler: handleCleanupEvent,
    schema: CleanupPayloadSchema,
  },
  [RECORD_EVENT_TYPE]: {
    handler: handleRecordEvent,
    schema: RecordPayloadSchema,
  },
})
