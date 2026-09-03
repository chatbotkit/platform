// @ts-check
import {
  HALF_HOUR_IN_SECONDS,
  ONE_DAY_IN_SECONDS,
  ONE_HOUR_IN_SECONDS,
} from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  createRealtimeRelayChannelId,
  createRealtimeRelayChannelUrl,
} from '@/lib/realtime.session'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import {
  REALTIME_EVENT_TYPE,
  sendEvent,
} from '@/pages/api/v1/conversation/[conversationId]/queue'

export const bodySchema = schema.object({
  durationInSeconds: schema
    .number()
    .min(HALF_HOUR_IN_SECONDS)
    .max(ONE_DAY_IN_SECONDS)
    .allow(null),
})

/**
 * @param {{
 *   conversationId: string,
 *   userId: string,
 *   durationInSeconds: number,
 *   session: import('@/lib/session.get').Session,
 * }} options
 * @returns {Promise<string>}
 */
export async function createRealtimeWebsocketConversation({
  conversationId,
  userId,
  durationInSeconds,
  session,
}) {
  const expiresAt = Date.now() + durationInSeconds * 1000

  const relayChannelId = createRealtimeRelayChannelId()

  const clientUrl = createRealtimeRelayChannelUrl(relayChannelId, 'client', {
    events: true,
  })

  const runnerUrl = createRealtimeRelayChannelUrl(relayChannelId, 'runner', {
    events: true,
  })

  const sessionPayload =
    /** @type {import('@/pages/api/v1/conversation/[conversationId]/queue').SessionPayload} */ (
      session.valueOf()
    )

  await sendEvent(conversationId, {
    type: REALTIME_EVENT_TYPE,
    payload: {
      session: sessionPayload,
      relay: {
        channelId: relayChannelId,
        clientUrl,
        runnerUrl,
      },
      expiresAt,
    },
  })

  return clientUrl
}

/**
 * @param {{
 *   session: import('@/lib/session.get').Session,
 *   conversation: {
 *     id: string,
 *     userId: string,
 *   },
 *   durationInSeconds?: number | null,
 * }} options
 */
export async function createConversationRealtimeWebsocketSession({
  session,
  conversation,
  durationInSeconds: dis,
}) {
  const durationInSeconds = dis || ONE_HOUR_IN_SECONDS

  const websocket = await createRealtimeWebsocketConversation({
    conversationId: conversation.id,
    userId: conversation.userId,
    durationInSeconds,
    session,
  })

  const expiresAt = Date.now() + durationInSeconds * 1000

  return {
    id: conversation.id,
    websocket,
    expiresAt,
  }
}

export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const conversationId = requiredUrlParam(req, 'conversationId')

      const conversation = await prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },

        select: {
          id: true,
          userId: true,
        },
      })

      if (!conversation) {
        return notFound()
      }

      if (conversation.userId !== session.user.id) {
        return notAuthorized()
      }

      return ok(
        await createConversationRealtimeWebsocketSession({
          session,
          conversation,
          durationInSeconds: body.durationInSeconds,
        })
      )
    })
  )
)
