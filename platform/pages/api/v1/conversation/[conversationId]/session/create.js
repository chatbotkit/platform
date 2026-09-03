// @ts-check
import {
  HALF_HOUR_IN_SECONDS,
  ONE_DAY_IN_SECONDS,
  ONE_HOUR_IN_SECONDS,
} from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { ENDUSER_CONVERSATION_AUDIENCE } from '@/lib/audience.consts'
import cuid from '@/lib/cuid'
import schema, { withSchema } from '@/lib/joi.handler'
import { sign } from '@/lib/jwt'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @param {{
 *   conversationId: string,
 *   userId: string,
 *   durationInSeconds: number,
 *   extra?: Record<string,any>,
 * }} options
 * @returns {Promise<string>}
 */
export async function createConversationSessionToken({
  conversationId,
  userId,
  durationInSeconds,
  extra,
}) {
  const payload = {
    sub: cuid(), // @todo maybe make it identifiable

    ...extra,

    conversationId: conversationId,
    userId: userId,
  }

  const result = await sign(
    payload,
    durationInSeconds,
    ENDUSER_CONVERSATION_AUDIENCE
  )

  return result
}

export const bodySchema = schema.object({
  durationInSeconds: schema
    .number()
    .min(HALF_HOUR_IN_SECONDS)
    .max(ONE_DAY_IN_SECONDS)
    .allow(null),
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/session/create:
 *   post:
 *     operationId: createConversationSession
 *     summary: Create conversation session
 *     description: |
 *       Conversation tokens allow client-side applications to create a unique,
 *       authenticated credential for each conversation. This token can be used
 *       to interact with the conversation/{conversationId}/send,
 *       conversation/{conversationId}/receive, and
 *       conversation/{conversationId}/message/create routes. By creating an
 *       individual token for each conversation, a client-side application is
 *       able to directly access and manipulate the conversation through these
 *       routes. Without conversation tokens, a client-side application would
 *       need to authenticate and access conversation routes through a
 *       server-side application, which can be more complex and require
 *       additional infrastructure. By providing a way for client-side
 *       applications to authenticate and access the conversation routes
 *       directly, the token route simplifies the process of integrating with
 *       the API and makes it more convenient for developers to build AI
 *       applications.
 *     tags:
 *       - Conversation Session
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           description: The ID of the conversation
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
 *     responses:
 *       200:
 *         description: The session was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the conversation
 *                   type: string
 *                 token:
 *                   description: The token for this conversation
 *                   type: string
 *                 expiresAt:
 *                   description: The time the token will expire in milliseconds
 *                   type: number
 *               required:
 *                 - id
 *                 - token
 *                 - expiresAt
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { durationInSeconds: dis } = body

      const conversation = await prisma.conversation.findUnique({
        where: {
          id: requiredUrlParam(req, 'conversationId'),
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

      const durationInSeconds = dis || ONE_HOUR_IN_SECONDS

      const token = await createConversationSessionToken({
        conversationId: conversation.id,
        userId: conversation.userId,
        durationInSeconds,
        extra: {
          options: {
            // @note add extra options here
          },
        },
      })

      const expiresAt = Date.now() + durationInSeconds * 1000

      return ok({ id: conversation.id, token, expiresAt })
    })
  )
)

/**
 * @manual Conversation Sessions
 * @description Conversation sessions provide secure, time-limited tokens that allow client-side applications to interact directly with conversations without exposing your API credentials.
 * @category Objects/Conversations
 * @tags conversation, session, authentication, security
 * @index 20
 *
 * Conversation sessions are a powerful feature that enables client-side applications
 * to securely interact with conversations without requiring your API keys to be
 * exposed to end users. By creating a session token for a specific conversation,
 * you can grant temporary, scoped access that allows client applications to send
 * and receive messages directly, while maintaining security and control.
 *
 * This approach is essential for building client-side chat interfaces, mobile
 * applications, and interactive web experiences where you need to enable real-time
 * conversation interactions without compromising your account security.
 *
 * ## Creating Conversation Sessions
 *
 * To create a conversation session, you generate a time-limited token that is
 * scoped to a specific conversation. This token can then be used by client-side
 * applications to authenticate requests to conversation endpoints like send,
 * receive, and message creation.
 *
 * Create a conversation session by sending a POST request to the session
 * creation endpoint:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/session/create
 * Content-Type: application/json
 *
 * {
 *   "durationInSeconds": 3600
 * }
 * ```
 *
 * The API will return a session object containing the conversation ID, a secure
 * token, and an expiration timestamp:
 *
 * ```json
 * {
 *   "id": "conv_abc123",
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expiresAt": 1640995200000
 * }
 * ```
 *
 * ### Session Duration
 *
 * You can specify how long the session token should remain valid by setting the
 * `durationInSeconds` parameter:
 *
 * - **Minimum duration**: 1,800 seconds (30 minutes)
 * - **Maximum duration**: 86,400 seconds (24 hours)
 * - **Default duration**: 3,600 seconds (1 hour) if not specified
 *
 * Choose a duration that balances security with user experience. Shorter
 * durations are more secure but may require users to refresh their session more
 * frequently, while longer durations provide a smoother experience but increase
 * the risk if a token is compromised.
 *
 * ## Using Session Tokens
 *
 * Once you have a session token, client-side applications can use it to
 * authenticate requests to conversation endpoints. Include the token in the
 * Authorization header of your requests:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/send
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * Content-Type: application/json
 *
 * {
 *   "text": "Hello, how can I help you today?"
 * }
 * ```
 *
 * The session token provides access to the following conversation operations:
 *
 * - **Send messages**: Post new messages to the conversation
 * - **Receive responses**: Get AI-generated responses
 * - **Create messages**: Add messages to the conversation history
 * - **List messages**: Retrieve conversation message history
 *
 * ## Security Considerations
 *
 * Conversation sessions are designed with security as a priority:
 *
 * - **Scoped access**: Each token is limited to a single conversation, preventing
 *   access to other conversations or account resources
 * - **Time-limited**: Tokens automatically expire after the specified duration,
 *   limiting the window of potential misuse
 * - **No account access**: Session tokens cannot be used to access account
 *   settings, billing information, or create new resources
 * - **Revocable**: Tokens become invalid once they expire; there is no need for
 *   manual revocation
 *
 * **Best Practices:**
 *
 * - Generate session tokens server-side and pass them to your client application
 * - Use HTTPS when transmitting tokens to prevent interception
 * - Store tokens securely on the client (e.g., in memory, not localStorage)
 * - Implement token refresh logic for long-running applications
 * - Monitor token expiration and handle renewal gracefully
 *
 * ## Common Use Cases
 *
 * Conversation sessions are ideal for:
 *
 * - **Web chat interfaces**: Allow users to interact with AI bots directly from
 *   your website without exposing API keys
 * - **Mobile applications**: Enable native mobile chat experiences with secure,
 *   temporary authentication
 * - **Third-party integrations**: Provide partners with limited access to
 *   specific conversations
 * - **Embedded experiences**: Create chat widgets that can be embedded in various
 *   platforms securely
 * - **Multi-user applications**: Give each user scoped access to their own
 *   conversations
 *
 * **Important Note:** Session tokens are meant for end-user interactions. For
 * server-to-server communication or administrative operations, continue using
 * your API keys with full authentication.
 */
