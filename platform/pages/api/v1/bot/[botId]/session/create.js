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

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'

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
 * @swagger
 *
 * /bot/{botId}/session/create:
 *   post:
 *     operationId: createBotSession
 *     summary: Create bot session
 *     tags:
 *       - Bot Session
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           description: The ID of the bot for this session
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               durationInSeconds:
 *                 description: The maximum amount of time this session will stay open
 *                 type: number
 *               messages:
 *                 description: An array of messages to be included in the conversation
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       $ref: '#/components/schemas/MessageType'
 *                     text:
 *                       description: The text of the message
 *                       type: string
 *                   required:
 *                     - type
 *                     - text
 *               meta:
 *                 $ref: '#/components/schemas/Meta'
 *     responses:
 *       200:
 *         description: The bot was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the bot
 *                   type: string
 *                 conversationId:
 *                   description: The ID of the conversation
 *                   type: string
 *                 token:
 *                   description: The token for this conversation
 *                   type: string
 *                 expiresAt:
 *                   description: The time the token will expire in milliseconds
 *                   type: number
 *                 messages:
 *                   description: An array of messages included in the conversation
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         $ref: '#/components/schemas/MessageType'
 *                       text:
 *                         description: The text of the message
 *                         type: string
 *                     required:
 *                       - type
 *                       - text
 *               required:
 *                 - id
 *                 - conversationId
 *                 - token
 *                 - expiresAt
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
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

        debug('creating conversation from bot', {
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
              cont
            )

            contactId = contact.id
          }
        }

        try {
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

          const token = await createConversationSessionToken({
            conversationId: cId,
            userId: session.user.id,
            durationInSeconds,
            extra: {
              options: {
                // @note add extra options here
              },
            },
          })

          const expiresAt = Date.now() + durationInSeconds * 1000

          return ok({
            id: bot.id,

            conversationId: cId,
            token,

            expiresAt,

            messages: cMsgs,
          })
        } catch (e) {
          debug(`responding with error`, { e })

          await captureError(e)

          return respondFromError(e)
        }
      })
    )
  )
)

/**
 * @manual Bot Sessions
 * @description Bot sessions provide secure, time-limited authentication tokens for conversational interactions, enabling users to engage with bots through applications, websites, and third-party platforms without exposing full API credentials.
 * @category Resources/Bots
 * @tags bot, session, authentication, conversation, token
 * @index 1
 *
 * Bot sessions are the secure gateway for enabling conversations with your
 * bots in user-facing applications. Each session generates a time-limited
 * authentication token that grants controlled access to bot interactions
 * without requiring users to have full API credentials. This security model
 * protects your API keys while enabling seamless conversational experiences.
 *
 * ## Creating Bot Sessions
 *
 * Creating a bot session establishes a secure, time-limited way to interact
 * with your bots through conversations. The session generates an
 * authentication token that allows users to send messages and receive
 * responses from the bot without requiring full API credentials. This is
 * essential for embedding bots in applications, websites, or third-party
 * platforms.
 *
 * When you create a bot session, you establish a conversation context that
 * persists throughout the session duration. The session includes the bot's
 * configuration, connected resources like datasets and skillsets, and any
 * initial messages you want to include. The returned session token
 * authenticates subsequent conversation API calls, enabling secure real-time
 * interactions.
 *
 * ```http
 * POST /api/v1/bot/{botId}/session/create
 * Content-Type: application/json
 *
 * {
 *   "durationInSeconds": 3600,
 *   "contact": {
 *     "name": "John Doe",
 *     "email": "john@example.com"
 *   },
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "Hello, I need help with my account"
 *     }
 *   ]
 * }
 * ```
 *
 * The session duration determines how long the authentication token remains
 * valid, with a minimum of 30 minutes and maximum of 24 hours. Longer
 * durations are useful for persistent chat widgets or applications where users
 * might return to continue conversations, while shorter durations provide
 * better security for sensitive use cases.
 *
 * Including contact information when creating a session associates the
 * conversation with a specific user, enabling features like conversation
 * history, user tracking, and personalized responses. The contact data can
 * include name, email, and phone number, which helps with analytics and follow-up.
 *
 * You can optionally include initial messages when creating the session. This
 * is useful for pre-populating conversation context, simulating previous
 * interactions, or starting the conversation with specific information. Only
 * user-type messages are allowed in the initial message array to prevent
 * potential manipulation of bot responses.
 *
 * The response includes the conversation ID, session token, token expiration
 * time, and any processed initial messages. Use the session token for all
 * subsequent conversation API calls to send messages and receive bot responses.
 * The conversation ID allows you to retrieve conversation history or perform
 * other conversation-related operations.
 *
 * Bot sessions respect visibility settings - public bots can create sessions
 * for any user, while private bots require the session creator to be the bot
 * owner. This enables flexible deployment scenarios from open chatbots to
 * restricted internal tools.
 *
 * **Security Note:** Session tokens should be treated as sensitive credentials
 * and transmitted securely. They grant access to bot conversations for the
 * specified duration, so implement appropriate token management and storage
 * practices in your applications.
 */
