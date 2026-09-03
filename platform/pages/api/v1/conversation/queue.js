// @ts-check
import { timePlusDays } from '@chatbotkit-dev/time'

import { emptyConversationRetentionDays } from '@/config/conversations'

import prisma from '@/prisma/client'

import { publishChannelMessage } from '@/lib/channel.core'
import { makeSessionChannelId } from '@/lib/channel.session'
import { setContextUser } from '@/lib/context.store'
import { deleteConversation } from '@/lib/conversation.delete'
import {
  getIdleConversations,
  untrackIdlingConversations,
} from '@/lib/conversation.idle'
import { TAG_ERROR } from '@/lib/conversation.tag'
import debug, { assert } from '@/lib/debug'
import { captureError, captureInputError } from '@/lib/error'
import { setupFrontendHostContext } from '@/lib/integration.context'
import it from '@/lib/it'
import { runTasksEach } from '@/lib/job'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import queue from '@/lib/queue'
import { withQueueHandler } from '@/lib/queue2'
import { updateSessionStore } from '@/lib/session.context'
import { fastGetUserById } from '@/lib/user.get'
import { parseAsync } from '@/lib/zod.schema'

import {
  IDLE_EVENT_TYPE as CONVERSATION_IDLE_EVENT_TYPE,
  sendEvent as conversationSendEvent,
} from '@/pages/api/v1/conversation/[conversationId]/queue'

import { z } from 'zod'

export const MAX_RECORD_TAKE = 100
export const MAX_CONCURRENT_WORKERS = 10

export const COMPLETE_EVENT_TYPE = 'complete'
export const EXPIRED_EVENT_TYPE = 'expired'
export const EMPTY_EVENT_TYPE = 'empty'
export const IDLE_EVENT_TYPE = 'idle'

/**
 * @typedef {z.infer<typeof CompletePayloadSchema>} CompletePayload
 */
export const CompletePayloadSchema = z.object({
  session: z.object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    user: z.object({
      id: z.string(),
      email: z.string().optional(),
      name: z.string().optional(),
    }),
    billing: z.record(z.any()).optional(),
    options: z.record(z.any()).optional(),
    payload: z.record(z.any()).optional(),
    expires: z.string().optional(),
  }),
  channelId: z.string(),
  body: z.record(z.any()),
  historyLength: z.number().optional(),
  historyExpireSeconds: z.number().optional(),
})

/**
 * @typedef {z.infer<typeof ExpiredPayloadSchema>} ExpiredPayload
 */
export const ExpiredPayloadSchema = z.object({
  // pass
})

/**
 * @typedef {z.infer<typeof EmptyPayloadSchema>} EmptyPayload
 */
export const EmptyPayloadSchema = z.object({
  // pass
})

/**
 * @typedef {z.infer<typeof IdlePayloadSchema>} IdlePayload
 */
export const IdlePayloadSchema = z.object({
  // pass
})

/**
 * @typedef {{
 *   type: typeof COMPLETE_EVENT_TYPE,
 *   payload: CompletePayload
 * }} CompleteEvent
 *
 * @param {CompletePayload} payload
 * @param {{ signal?: AbortSignal, markSignals?: AbortSignal[] }} [context]
 * @returns {Promise<void>}
 */
export async function handleCompleteEvent(payload, context) {
  debug(`conversation complete event`, { payload }).log(
    'api.v1.conversation.handleCompleteEvent'
  )

  const { session, channelId, body, historyLength, historyExpireSeconds } =
    payload

  /** @type {import('next-auth').Session} */
  const typedSession = /** @type {any} */ (session)

  updateSessionStore(typedSession)

  const sessionChannelId = makeSessionChannelId(typedSession, channelId)

  setContextUser(await fastGetUserById(typedSession.user.id))

  await setupFrontendHostContext(typedSession.user)

  /** @type {import('@/lib/channel.core').PublishChannelMessageOptions | undefined} */
  const historyOptions =
    historyLength != null ? { historyLength, historyExpireSeconds } : undefined

  if (!(await accountConversationalLimitsOk(typedSession.user))) {
    debug(`limits exceeded for user`, { userId: typedSession.user.id }).log(
      'api.v1.conversation.handleCompleteEvent'
    )

    await publishChannelMessage(
      sessionChannelId,
      { type: TAG_ERROR, data: { message: 'Limits exceeded for user' } },
      historyOptions
    )

    return
  }

  debug(`starting completion`, { sessionChannelId }).log(
    'api.v1.conversation.handleCompleteEvent'
  )

  // Import complete dynamically to avoid circular dependency

  const { complete } = await import('@/pages/api/v1/conversation/complete')

  try {
    for await (const { type, data } of complete(
      typedSession,
      {
        ...body,

        extensions: {
          ...body.extensions,

          features: [
            ...(Array.isArray(body.extensions?.features)
              ? body.extensions.features
              : []),

            // @note ensure agent is aware we run in the background

            { name: 'batch', options: { settle: true } },
          ],
        },
      },
      {
        abortSignal: context?.signal,

        // @note fire-once per-mark signals from the queue monitor; the engine's
        // `timeoutMarks` feature listens to these so a background completion
        // running out of time leaves a breadcrumb. NOT cancellation signals

        markSignals: context?.markSignals,
      }
    )) {
      debug(`publishing event to channel`, { type }).log(
        'api.v1.conversation.handleCompleteEvent'
      )

      await publishChannelMessage(
        sessionChannelId,
        { type, data },
        historyOptions
      )
    }

    debug(`completion finished`).log('api.v1.conversation.handleCompleteEvent')
  } catch (e) {
    debug(`completion error`, { error: e }).log(
      'api.v1.conversation.handleCompleteEvent'
    )

    await captureError(e)

    await publishChannelMessage(
      sessionChannelId,
      { type: TAG_ERROR, data: { message: e.message } },
      historyOptions
    )
  }
}

/**
 * @typedef {{
 *   type: typeof EXPIRED_EVENT_TYPE,
 *   payload: ExpiredPayload
 * }} ExpiredEvent
 *
 * @param {ExpiredPayload} payload
 * @returns {Promise<void>}
 */
export async function handleExpiredEvent(payload) {
  debug(`conversation expired cleanup event`, { payload })
    .log('api.v1.conversation.handleExpiredEvent')
    .log('event.conversation.cleanup')

  const conversations = await prisma.conversation.findMany({
    where: {
      expiresAt: {
        lte: new Date(),
      },
    },

    orderBy: [
      {
        userId: 'asc',
      },
    ],

    select: {
      id: true,
      botId: true,
      expiresAt: true,
    },

    take: MAX_RECORD_TAKE,
  })

  await runTasksEach(
    MAX_CONCURRENT_WORKERS,
    conversations,
    async (conversation) => {
      debug(`deleting expired conversation ${conversation.id}`).log(
        'api.v1.conversation.handleExpiredEvent'
      )

      assert(
        conversation.expiresAt && conversation.expiresAt <= new Date(),
        `conversation ${conversation.id} expiresAt must be before current date`
      )

      await deleteConversation(conversation.id)
    }
  )
}

/**
 * @typedef {{
 *   type: typeof EMPTY_EVENT_TYPE,
 *   payload: EmptyPayload
 * }} EmptyEvent
 *
 * @param {EmptyPayload} payload
 * @returns {Promise<void>}
 */
export async function handleEmptyEvent(payload) {
  return // @note disabled because it is kills the database unless we run it against a replica or something else

  debug(`conversation empty cleanup event`, { payload })
    .log('api.v1.conversation.handleEmptyEvent')
    .log('event.conversation.cleanup')

  const emptyConversationCutoff = timePlusDays(-emptyConversationRetentionDays)

  assert(
    emptyConversationCutoff < new Date(),
    `empty conversation cutoff ${emptyConversationCutoff.toISOString()} must be in the past`
  )

  const conversations = await prisma.conversation.findMany({
    where: {
      createdAt: {
        lte: emptyConversationCutoff,
      },
      messages: {
        none: {},
      },
    },

    orderBy: [
      {
        createdAt: 'asc',
      },
    ],

    select: {
      id: true,
      botId: true,
      expiresAt: true,
      createdAt: true,
    },

    take: MAX_RECORD_TAKE,
  })

  await runTasksEach(
    MAX_CONCURRENT_WORKERS,
    conversations,
    async (conversation) => {
      debug(`deleting empty conversation ${conversation.id}`).log(
        'api.v1.conversation.handleEmptyEvent'
      )

      assert(
        conversation.createdAt <= emptyConversationCutoff,
        `conversation ${conversation.id} createdAt must be before cutoff`
      )

      await deleteConversation(conversation.id)
    }
  )
}

/**
 * @typedef {{
 *   type: typeof IDLE_EVENT_TYPE,
 *   payload: IdlePayload
 * }} IdleEvent
 *
 * @param {IdlePayload} payload
 * @returns {Promise<void>}
 */
export async function handleIdleEvent(payload) {
  debug(`conversation idle event`, { payload })
    .log('api.v1.conversation.handleIdleEvent')
    .log('event.conversation.idle')

  const conversationIds = await getIdleConversations()

  debug(`found idle conversations`, { conversationIds }).log(
    'api.v1.conversation.handleIdleEvent'
  )

  await runTasksEach(
    MAX_CONCURRENT_WORKERS,
    it(conversationIds),
    async (conversationId) => {
      debug(`processing idle conversation`, { conversationId }).log(
        'api.v1.conversation.handleIdleEvent'
      )

      // run tasks associated with this conversation
      {
        await conversationSendEvent(conversationId, {
          type: CONVERSATION_IDLE_EVENT_TYPE,
          payload: {},
        })
      }

      // untrack the idling conversation
      {
        // It is safer to untrack one by one in case of a failure with the
        // queueing mechanism.

        await untrackIdlingConversations([conversationId])
      }
    }
  )
}

/**
 * @param {CompleteEvent|ExpiredEvent|EmptyEvent|IdleEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(event) {
  switch (true) {
    case event.type === COMPLETE_EVENT_TYPE: {
      await parseAsync(CompletePayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === EXPIRED_EVENT_TYPE: {
      await parseAsync(ExpiredPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === EMPTY_EVENT_TYPE: {
      await parseAsync(EmptyPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === IDLE_EVENT_TYPE: {
      await parseAsync(IdlePayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(`/api/v1/conversation/queue`, event, {
    deduplicationId:
      event.type === COMPLETE_EVENT_TYPE
        ? `stateless-conversation-complete-event-${event.payload.channelId}`
        : undefined,
  })
}

/**
 */
export default withQueueHandler({
  [COMPLETE_EVENT_TYPE]: {
    handler: handleCompleteEvent,
    schema: CompletePayloadSchema,
  },
  [EXPIRED_EVENT_TYPE]: {
    handler: handleExpiredEvent,
    schema: ExpiredPayloadSchema,
  },
  [EMPTY_EVENT_TYPE]: {
    handler: handleEmptyEvent,
    schema: EmptyPayloadSchema,
  },
  [IDLE_EVENT_TYPE]: {
    handler: handleIdleEvent,
    schema: IdlePayloadSchema,
  },
})

/**
 * @manual Conversation Cleanup
 * @description Learn how conversations are automatically cleaned up through expiry and empty conversation retention policies.
 * @category Objects/Conversations
 * @index 50
 *
 * ## Conversation Expiry and Cleanup
 *
 * Conversations can be automatically removed from the platform through two
 * distinct lifecycle mechanisms: expiry and empty conversation cleanup.
 *
 * ### Expiry
 *
 * Conversations can be created with an optional `expiresAt` timestamp. Once
 * that timestamp passes, the conversation is considered expired and will be
 * deleted during the next cleanup cycle. This is useful for time-bounded
 * sessions, such as temporary support chats or short-lived agent interactions,
 * where you want to guarantee data is not retained beyond a fixed window.
 *
 * You can set expiry when creating or updating a conversation:
 *
 * ```json
 * {
 *   "expiresAt": "2026-06-01T00:00:00.000Z"
 * }
 * ```
 *
 * ### Empty Conversation Cleanup
 *
 * Conversations that were created but never used - meaning they have no messages
 * at all - are automatically deleted after some time. This prevents abandoned
 * or programmatically created conversations from accumulating indefinitely.
 *
 * No action is required to opt in to this behavior. It applies to all
 * conversations regardless of how they were created.
 */
