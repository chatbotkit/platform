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
  pageId: schema.string().trim().min(1),
  recipientId: schema.string().trim().min(1),
  text: schema.string().trim().min(1),
})

/**
 * @swagger
 *
 * /integration/messenger/{messengerIntegrationId}/initiate:
 *   post:
 *     operationId: initiateMessenger
 *     summary: Initiates conversation with the messenger integration
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pageId:
 *                 description: The Facebook Page ID sending the message
 *                 type: string
 *               recipientId:
 *                 description: The Messenger recipient PSID from a prior interaction
 *                 type: string
 *               text:
 *                 description: The free-form text message to send while Meta allows messaging this recipient
 *                 type: string
 *             required:
 *               - pageId
 *               - recipientId
 *               - text
 *     responses:
 *       200:
 *         description: The messenger integration was successfully initiated
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
        const { pageId, recipientId, text } = body

        const messengerIntegration =
          await prisma.messengerIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'messengerIntegrationId')
          )

        if (!messengerIntegration) {
          return throwNotFound()
        }

        if (messengerIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!messengerIntegration.botId) {
          throwBadRequest('Messenger integration does not have a bot configured')
        }

        if (!messengerIntegration.accessToken) {
          throwBadRequest('Messenger integration does not have an access token')
        }

        await sendEvent(messengerIntegration.id, {
          type: INITIATE_EVENT_TYPE,
          payload: {
            pageId,
            recipientId,
            text,
          },
        })

        await stream.result({
          id: messengerIntegration.id,
        })
      })
    )
  )
)

/**
 * @manual Messenger Integration
 *
 * ## Initiating a Messenger Message
 *
 * This endpoint sends a free-form Messenger message to a known recipient PSID
 * and creates a ChatBotKit conversation for subsequent replies.
 *
 * This does not start a conversation with an arbitrary Facebook user. The
 * recipient must already be known from a prior Messenger interaction, and Meta
 * must still allow the Page to message that recipient. Free-form automated
 * messages are generally limited to Meta's active messaging window; outside that
 * window, Messenger requires an approved policy exception such as an eligible
 * message tag, which this endpoint does not send.
 *
 * ```http
 * POST /api/v1/integration/messenger/{messengerIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "pageId": "123456789012345",
 *   "recipientId": "987654321098765",
 *   "text": "Your support case has an update. Would you like the details?"
 * }
 * ```
 *
 * **Required parameters:**
 *
 * - `pageId` - The Facebook Page ID that sends the message. This is the
 *   `recipient.id` from inbound Messenger webhook events.
 * - `recipientId` - The Messenger PSID for a user who previously interacted
 *   with the Page.
 * - `text` - The free-form message body to send.
 *
 * **Provider constraint:** Meta may reject the send if the recipient is outside
 * the allowed messaging window. This endpoint intentionally does not implement
 * message tags or sponsored/marketing message flows.
 */
