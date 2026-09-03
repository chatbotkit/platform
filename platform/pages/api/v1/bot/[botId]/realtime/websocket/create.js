// @ts-check
import {
  HALF_HOUR_IN_SECONDS,
  ONE_DAY_IN_SECONDS,
  ONE_HOUR_IN_SECONDS,
  timePlusDays,
} from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import { BotVisibility } from '@/prisma/types'

import { ENDUSER_BOT_SESSION_CREATE_AUDIENCE } from '@/lib/audience.consts'
import { getConversationDetails } from '@/lib/bot.conversation'
import { bypassCache } from '@/lib/cache'
import { ensureUntrustedContact } from '@/lib/contact.create'
import { createConversation } from '@/lib/conversation.create'
import debug, { assert, createSpan } from '@/lib/debug'
import { captureError } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  notFound,
  ok,
  respondFromError,
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'
import { getSoftSession } from '@/lib/session.get'
import { getRandomId } from '@/lib/string'
import { cacheUser, fastGetUserById } from '@/lib/user.get'

import { userMessagesSchema } from '@/schemas/messages'
import metaSchema from '@/schemas/meta'

import { createRealtimeWebsocketConversation } from '@/pages/api/v1/conversation/[conversationId]/realtime/websocket/create'

/**
 * @typedef {import('@/lib/session.get').Session} Session
 *
 * @typedef {import('@/prisma/types').Bot & {
 * }} Bot
 */

/**
 * @param {(req: Request, session: Session, bot: Bot, ...args: any) => Promise<Response>} fn
 */
export function withBot(fn) {
  return async function (req, ...args) {
    const span = createSpan({ name: 'withBoth' })

    try {
      const botId = requiredUrlParam(req, 'botId')

      const { bot, user } = await bypassCache(
        `bot-${botId}-swr`,
        ONE_HOUR_IN_SECONDS,
        async () => {
          const span = createSpan({ name: 'prisma.bot.findUnique' })

          let bot

          try {
            bot = await prisma.bot.findUnique({
              where: {
                id: botId,
              },

              include: {
                // pass
              },

              cacheStrategy: {
                swr: 60,
                ttl: 60,
              },
            })
          } finally {
            span.finish()
          }

          if (!bot) {
            return throwNotFound()
          }

          switch (bot.visibility) {
            case BotVisibility.public: {
              // @note it is public so everyone can create sessions

              break
            }

            default: {
              const session = await getSoftSession(req)

              if (!session) {
                return throwNotAuthenticated()
              }

              if (bot.userId !== session.user.id) {
                return throwNotAuthorized()
              }

              break
            }
          }

          const user = await fastGetUserById(bot.userId)

          assert(user, 'user not found')

          return { bot, user }
        }
      )

      if (!bot) {
        return notFound()
      }

      if (!user) {
        return notFound()
      }

      await cacheUser(user)

      const pseudoSession = {
        id: getRandomId(),
        user,
        options: {},
        payload: {
          aud: ENDUSER_BOT_SESSION_CREATE_AUDIENCE,
        },
        expires: timePlusDays(1).toISOString(),
      }

      return fn(req, pseudoSession, bot, ...args)
    } finally {
      span.finish()
    }
  }
}

export const bodySchema = schema.object({
  durationInSeconds: schema
    .number()
    .min(HALF_HOUR_IN_SECONDS)
    .max(ONE_DAY_IN_SECONDS)
    .allow(null),

  contact: schema.object({
    name: schema.string().allow(null, ''),
    email: schema.string().allow(null, '').email({ tlds: false }),
    phone: schema.string().allow(null, '').phone(),
  }),

  // @note we use userMessagesSchema because we don't want to introduce
  // hallucinations - any other message type will introduce the potential to
  // influence the bot interactions

  messages: userMessagesSchema,

  meta: metaSchema,
})

/**
 * @param {{
 *   session: Session,
 *   bot: Bot,
 *   durationInSeconds?: number | null,
 *   contact?: {
 *     name?: string | null,
 *     email?: string | null,
 *     phone?: string | null,
 *   } | null,
 *   messages?: { type: string, text: string, meta?: Record<string, any> }[] | null,
 *   meta?: Record<string, any> | null,
 * }} options
 */
export async function createBotRealtimeWebsocketSession({
  session,
  bot,
  durationInSeconds: dis,
  contact: cont,
  messages: msgs,
  meta,
}) {
  debug('creating realtime websocket conversation from bot', {
    bot,
    durationInSeconds: dis,
    contact: cont,
    messages: msgs,
    meta,
  })

  const details = getConversationDetails(bot)

  let contactId

  {
    if (cont && (cont.email || cont.phone)) {
      // @todo when the session is not anonymous allow for trusted contact creation

      const contact = await ensureUntrustedContact(
        { id: bot.userId },
        {
          ...(cont.name ? { name: cont.name } : null),
          ...(cont.email ? { email: cont.email } : null),
          ...(cont.phone ? { phone: cont.phone } : null),
        }
      )

      contactId = contact.id
    }
  }

  const { id: cId, messages: cMsgs } = await createConversation(
    session.user.id,
    {
      ...details,

      contactId,

      messages: [...(msgs ? msgs : [])],

      meta: {
        ...meta,

        app: 'bot',
        botId: bot.id,
      },

      // @note we pass these as an additional information to the
      // conversation in order to gain performance improvements

      resources: [
        {
          type: 'bot',
          instance: bot,
        },
      ],
    }
  )

  const durationInSeconds = dis || ONE_HOUR_IN_SECONDS

  const websocket = await createRealtimeWebsocketConversation({
    conversationId: cId,
    userId: session.user.id,
    durationInSeconds,
    session,
  })

  const expiresAt = Date.now() + durationInSeconds * 1000

  return {
    id: bot.id,

    conversationId: cId,
    websocket,

    expiresAt,

    messages: cMsgs,
  }
}

export default withPost(
  withBot(
    withLimits(
      ['rate/conversation', 'conversation', 'message'],
      withSchema(bodySchema, async function (_req, session, bot, body) {
        const {
          durationInSeconds: dis,

          contact: cont,

          messages: msgs,

          meta,
        } = body

        try {
          return ok(
            await createBotRealtimeWebsocketSession({
              session,
              bot,
              durationInSeconds: dis,
              contact: cont,
              messages: msgs,
              meta,
            })
          )
        } catch (e) {
          debug(`responding with error`, { e })

          await captureError(e)

          return respondFromError(e)
        }
      })
    )
  )
)
