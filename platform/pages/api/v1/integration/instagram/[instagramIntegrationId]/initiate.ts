import prisma from '@/prisma/client'

import { withStream } from '@/lib/stream'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  throwBadRequest,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'

import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

export const bodySchema = schema.object({
  instagramUserId: schema.string().trim().min(1),
  recipientId: schema.string().trim().min(1),
  text: schema.string().trim().min(1),
})

/**
 * @swagger
 *
 * /integration/instagram/{instagramIntegrationId}/initiate:
 *   post:
 *     operationId: initiateInstagram
 *     summary: Initiates conversation with the instagram integration
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instagramUserId:
 *                 description: The Instagram professional account ID sending the message
 *                 type: string
 *               recipientId:
 *                 description: The Instagram recipient ID from a prior interaction
 *                 type: string
 *               text:
 *                 description: The free-form text message to send while Meta allows messaging this recipient
 *                 type: string
 *             required:
 *               - instagramUserId
 *               - recipientId
 *               - text
 *     responses:
 *       200:
 *         description: The instagram integration was successfully initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the initiated integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['special/rate/initiate', 'rate/message', 'message', 'token'],
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        const { instagramUserId, recipientId, text } = body

        const instagramIntegration =
          await prisma.instagramIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'instagramIntegrationId')
          )

        if (!instagramIntegration) {
          return throwNotFound()
        }

        if (instagramIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!instagramIntegration.botId) {
          throwBadRequest('Instagram integration does not have a bot configured')
        }

        if (!instagramIntegration.accessToken) {
          throwBadRequest('Instagram integration does not have an access token')
        }

        await sendEvent(instagramIntegration.id, {
          type: INITIATE_EVENT_TYPE,
          payload: {
            instagramUserId,
            recipientId,
            text,
          },
        })

        await stream.result({
          id: instagramIntegration.id,
        })
      })
    )
  )
)

/**
 * @manual Instagram Integration
 *
 * ## Initiating an Instagram Message
 *
 * This endpoint sends a free-form Instagram Messaging API message to a known
 * recipient ID and creates a ChatBotKit conversation for subsequent replies.
 *
 * This does not start a conversation with an arbitrary Instagram account. The
 * recipient must already be known from a prior Instagram messaging interaction,
 * and Meta must still allow the professional account to message that recipient.
 * Free-form automated messages are generally limited to Meta's active messaging
 * window; outside that window, the send may be rejected unless an approved
 * exception applies, which this endpoint does not implement.
 *
 * ```http
 * POST /api/v1/integration/instagram/{instagramIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "instagramUserId": "17841400000000000",
 *   "recipientId": "12345678901234567",
 *   "text": "Your support case has an update. Would you like the details?"
 * }
 * ```
 *
 * **Required parameters:**
 *
 * - `instagramUserId` - The Instagram professional account ID that sends the
 *   message. This is the `recipient.id` from inbound Instagram webhook events.
 * - `recipientId` - The Instagram recipient ID for a user who previously
 *   interacted with the account.
 * - `text` - The free-form message body to send.
 *
 * **Provider constraint:** Meta may reject the send if the recipient is outside
 * the allowed messaging window. This endpoint intentionally does not implement
 * human-agent or other exception flows.
 */
