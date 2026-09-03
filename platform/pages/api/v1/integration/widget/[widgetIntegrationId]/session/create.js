// @ts-check
import {
  HALF_HOUR_IN_SECONDS,
  ONE_DAY_IN_MILLISECONDS,
  ONE_DAY_IN_SECONDS,
  ONE_HOUR_IN_SECONDS,
  timePlusDays,
} from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { ENDUSER_INTEGRATION_WIDGET_SESSION_CREATE_AUDIENCE } from '@/lib/audience.consts'
import { isTrustedSession } from '@/lib/audience.helpers'
import { getConversationDetails } from '@/lib/bot.conversation'
import { swrCache } from '@/lib/cache'
import {
  createContactFingerprint,
  ensureTrustedContact,
  ensureUntrustedContact,
} from '@/lib/contact.create'
import { createConversation } from '@/lib/conversation.create'
import cuid from '@/lib/cuid'
import debug, { assert, createSpan } from '@/lib/debug'
import { captureError } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notFound, ok, respondFromError, throwNotFound } from '@/lib/response'
import { getRandomId } from '@/lib/string'
import { cacheUser, fastGetUserById } from '@/lib/user.get'

import { userMessagesSchema } from '@/schemas/messages'
import metaSchema from '@/schemas/meta'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'

export const WIDGET_CONTACT_NAMESPACE = '11ccd8f6-b364-44c7-a3fd-8c2741dccfbb' // @note do not change

/**
 * @typedef {import('@/lib/session.get').Session} Session
 *
 * @typedef {import('@/prisma/types').WidgetIntegration & {
 *   bot: import('@/prisma/types').Bot?
 * }} WidgetIntegration
 */

/**
 * @param {(req: Request, session: Session, widgetIntegration: WidgetIntegration, ...args: any) => Promise<Response>} fn
 */
export function withWidgetIntegration(fn) {
  return async function (req, ...args) {
    const widgetIntegrationId = requiredUrlParam(req, 'widgetIntegrationId')

    const span = createSpan({ name: 'withWidgetIntegration' })

    try {
      const { widgetIntegration, user } = await swrCache(
        `widget-integration-${widgetIntegrationId}-swr`,
        ONE_HOUR_IN_SECONDS,
        async () => {
          const span = createSpan({
            name: 'prisma.widgetIntegration.findUnique',
          })

          let widgetIntegration

          try {
            widgetIntegration = await prisma.widgetIntegration.findUnique({
              where: {
                id: widgetIntegrationId,
              },

              include: {
                bot: true, // @note super important
              },

              cacheStrategy: {
                ttl: 60,
                swr: 60,
              },
            })
          } finally {
            span.finish()
          }

          if (!widgetIntegration) {
            return throwNotFound()
          }

          const user = await fastGetUserById(widgetIntegration.userId)

          assert(user, 'user not found')

          return { widgetIntegration, user }
        }
      )

      if (!widgetIntegration) {
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
          aud: ENDUSER_INTEGRATION_WIDGET_SESSION_CREATE_AUDIENCE,
        },
        expires: timePlusDays(1).toISOString(),
      }

      return fn(req, pseudoSession, widgetIntegration, ...args)
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

  // @note the meta field is considered to be safe to pass through the
  // conversation creation process

  meta: metaSchema,
})

export default withPost(
  withWidgetIntegration(
    withLimits(
      ['rate/conversation', 'conversation', 'message'],
      withSchema(
        bodySchema,
        /**
         * @param {Request} _req
         * @param {Session} session
         * @param {WidgetIntegration} widgetIntegration
         * @param {any} body
         */
        async function (_req, session, widgetIntegration, body) {
          const {
            durationInSeconds: dis,

            contact: cont,

            messages: msgs,

            meta,
          } = body

          debug('creating conversation from widget integration', {
            widgetIntegration,
            durationInSeconds: dis,
            contact: cont,
            messages: msgs,
            meta,
          })

          const details = getConversationDetails(widgetIntegration)

          if (widgetIntegration.attachments) {
            // @todo find a way to whitelist the attachments endpoints here - currently enabled by default
          }

          let contactId

          {
            if (cont && (cont.email || cont.phone)) {
              const { name, email, phone } = cont

              if (isTrustedSession(session)) {
                const contact = await ensureTrustedContact(
                  {
                    id: widgetIntegration.userId,
                  },
                  { name, email, phone },
                  createContactFingerprint(WIDGET_CONTACT_NAMESPACE, [
                    email,
                    phone,
                  ])
                )

                contactId = contact.id
              } else {
                const contact = await ensureUntrustedContact(
                  {
                    id: widgetIntegration.userId,
                  },
                  { name, email, phone }
                )

                contactId = contact.id
              }
            }
          }

          try {
            const { id: cId, messages: cMsgs } = await createConversation(
              session.user.id,
              {
                ...details,

                contactId,

                messages: [
                  ...(widgetIntegration.initial
                    ? [
                        {
                          type: 'bot',
                          text: widgetIntegration.initial,
                        },
                      ]
                    : []),

                  ...(msgs ? msgs : []),
                ],

                meta: {
                  ...meta,

                  app: 'widget',

                  widget: {
                    integrationId: widgetIntegration.id,
                  },
                },

                // @note we pass these as an additional information to the
                // conversation in order to gain performance improvements

                resources: widgetIntegration.bot
                  ? [
                      {
                        type: 'bot',
                        instance: widgetIntegration.bot,
                      },
                    ]
                  : [],
              }
            )

            const sessionDuration =
              widgetIntegration.sessionDuration || ONE_DAY_IN_MILLISECONDS

            // @note dis is in seconds, sessionDuration is in milliseconds - convert before comparing
            const disMs = dis != null ? dis * 1000 : null

            const durationInSeconds =
              Math.min(disMs || sessionDuration, sessionDuration) / 1000

            const token = await createConversationSessionToken({
              conversationId: cId,
              userId: session.user.id,
              durationInSeconds,
              extra: {
                options: {
                  engine: {
                    features:
                      /** @type {import('@/lib/conversation.engine').Feature[]} */ ([
                        { name: 'noInlineDatasets' },
                        { name: 'noInlineSkillsets' },

                        { name: 'markdown' },

                        { name: 'buttons' },

                        ...(widgetIntegration.attachments
                          ? [{ name: 'attachments' }]
                          : []),

                        ...(widgetIntegration.verbose
                          ? [{ name: 'justification' }]
                          : []),

                        ...(widgetIntegration.math ? [{ name: 'math' }] : []),

                        ...(widgetIntegration.carousel
                          ? [{ name: 'carousel' }]
                          : []),

                        ...(widgetIntegration.form ? [{ name: 'form' }] : []),
                      ]),
                  },

                  // @todo document what the special limits are

                  limits: {
                    // @todo use types

                    special: {
                      rate: {
                        id: cuid(),
                      },
                    },
                  },
                },
              },
            })

            const expiresAt = Date.now() + durationInSeconds * 1000

            return ok({
              id: widgetIntegration.id,

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
        }
      )
    )
  )
)

/**
 * @manual Widget Integration
 * @index 25
 *
 * ## Creating Widget Sessions
 *
 * Creating a widget session establishes an authenticated connection between your
 * widget integration and a conversation, enabling real-time chat interactions
 * with your bot. This endpoint is the foundation of widget communication,
 * generating secure session tokens and initializing conversations with optional
 * contact information and message history.
 *
 * Widget sessions are temporary authenticated connections that allow the widget
 * client to interact with the ChatBotKit API on behalf of a user. Each session
 * is scoped to a single conversation and includes security tokens, conversation
 * identifiers, and configuration that determines how the widget behaves during
 * the interaction.
 *
 * When you create a widget session, the platform automatically creates a new
 * conversation (or can attach to an existing one), processes any initial
 * messages, collects contact information if provided, and returns everything
 * needed for the widget to begin interactive chat.
 *
 * ```http
 * POST /api/v1/integration/widget/{widgetIntegrationId}/session/create
 * Content-Type: application/json
 *
 * {
 *   "contact": {
 *     "name": "John Smith",
 *     "email": "john@example.com"
 *   },
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "Hello, I need help with my order"
 *     }
 *   ],
 *   "durationInSeconds": 3600
 * }
 * ```
 *
 * The response provides everything the widget needs to start interacting:
 *
 * ```json
 * {
 *   "id": "widget_abc123",
 *   "conversationId": "conv_xyz789",
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expiresAt": 1735124400000,
 *   "messages": [
 *     {
 *       "type": "bot",
 *       "text": "Welcome! How can I help you today?"
 *     },
 *     {
 *       "type": "user",
 *       "text": "Hello, I need help with my order"
 *     }
 *   ]
 * }
 * ```
 *
 * ## Session Configuration
 *
 * **Duration Management:**
 *
 * The `durationInSeconds` parameter controls how long the session remains valid:
 *
 * - **Minimum:** 1,800 seconds (30 minutes)
 * - **Maximum:** 86,400 seconds (24 hours)
 * - **Default:** Uses the widget's configured `sessionDuration` setting
 *
 * Sessions automatically expire after the specified duration, requiring users
 * to create new sessions for continued interaction. Choose durations based on
 * your use case - shorter durations improve security, while longer durations
 * provide better user experience for extended interactions.
 *
 * **Contact Collection:**
 *
 * The optional `contact` object enables lead capture and user identification:
 *
 * - **name:** User's full name (optional)
 * - **email:** Valid email address (optional, validated)
 * - **phone:** Phone number in international format (optional, validated)
 *
 * When contact information is provided, the platform automatically creates or
 * updates contact records, enabling you to track users across conversations and
 * maintain persistent user profiles. Contact information is only collected if
 * the widget's `contactCollection` setting is enabled.
 *
 * **Initial Messages:**
 *
 * The `messages` array allows you to seed the conversation with context or
 * user input collected before session creation:
 *
 * ```json
 * {
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "I'm interested in pricing"
 *     }
 *   ]
 * }
 * ```
 *
 * Initial messages appear in the conversation history immediately, and the bot
 * processes them before returning, so responses are included in the session
 * creation response. This enables pre-seeding conversations with context or
 * handling form submissions that trigger chat interactions.
 *
 * **Important Notes:**
 *
 * - Only `user` type messages are allowed in the `messages` array to prevent
 *   potential prompt injection or bot behavior manipulation
 *
 * - If the widget has an `initial` message configured, it's automatically
 *   prepended as a `bot` message before any user messages
 *
 * - The widget integration must have a bot configured (`botId`) to process
 *   messages; sessions without bot configuration will fail
 *
 * **Session Security:**
 *
 * The returned `token` is a JWT that grants limited access to the conversation
 * API on behalf of the widget owner. This token:
 *
 * - Grants read/write access only to the specific conversation
 * - Expires automatically after the session duration
 * - Cannot be refreshed - new sessions must be created after expiration
 * - Should be treated as sensitive and not logged or exposed publicly
 *
 * ## Metadata and Tracking
 *
 * Use the optional `meta` parameter to attach custom metadata to the
 * conversation:
 *
 * ```json
 * {
 *   "meta": {
 *     "source": "homepage",
 *     "campaign": "summer-2025",
 *     "utmSource": "google"
 *   }
 * }
 * ```
 *
 * Metadata is preserved throughout the conversation lifecycle and can be used
 * for analytics, routing, and reporting purposes. The platform automatically
 * adds `app: "widget"` and `widget.integrationId` to track widget-initiated
 * conversations.
 *
 * ## Advanced Features
 *
 * Widget sessions automatically respect the widget's configuration:
 *
 * - **Attachments:** If enabled, users can upload files during conversations
 * - **Math Rendering:** Mathematical expressions are formatted if enabled
 * - **Carousels:** Carousel UI elements are supported if configured
 * - **Forms:** Structured form interactions are available if enabled
 *
 * These features are controlled by the widget integration settings and cannot
 * be overridden during session creation, ensuring consistent behavior across
 * all widget instances.
 *
 * **Performance Optimizations:**
 *
 * The session creation endpoint includes several optimizations for widget
 * deployments:
 *
 * - Widget configuration is cached with SWR strategy for low-latency responses
 * - Inline dataset and skillset features are disabled to improve response times
 * - Rate limiting is applied per-session to prevent abuse
 * - Message processing happens synchronously so initial responses are immediate
 *
 * These optimizations ensure fast widget loading and responsive interactions,
 * critical for maintaining good user experience in chat interfaces.
 */
