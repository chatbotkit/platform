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
  conversationId: schema.string().trim().min(1).required(),
  text: schema.string().trim().min(1).required(),
})

/**
 * @swagger
 *
 * /integration/microsoftteams/{microsoftteamsIntegrationId}/initiate:
 *   post:
 *     operationId: initiateTeams
 *     summary: Initiate a conversation with a Microsoft Teams integration
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               conversationId:
 *                 description: The Microsoft Teams Bot Framework conversation ID to send to
 *                 type: string
 *               text:
 *                 description: The text message to send to the Teams conversation
 *                 type: string
 *             required:
 *               - conversationId
 *               - text
 *     responses:
 *       200:
 *         description: The Microsoft Teams integration was initiated successfully
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
        const { conversationId, text } = body

        const microsoftteamsIntegration =
          await prisma.microsoftteamsIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'microsoftteamsIntegrationId')
          )

        if (!microsoftteamsIntegration) {
          return throwNotFound()
        }

        if (microsoftteamsIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!microsoftteamsIntegration.botId) {
          throwBadRequest(
            'Microsoft Teams integration does not have a bot configured'
          )
        }

        if (!microsoftteamsIntegration.botFrameworkAppId) {
          throwBadRequest(
            'Microsoft Teams integration does not have a Bot Framework app ID'
          )
        }

        if (!microsoftteamsIntegration.botFrameworkAppSecret) {
          throwBadRequest(
            'Microsoft Teams integration does not have a Bot Framework app secret'
          )
        }

        await sendEvent(microsoftteamsIntegration.id, {
          type: INITIATE_EVENT_TYPE,
          payload: {
            conversationId,
            text,
          },
        })

        await stream.result({
          id: microsoftteamsIntegration.id,
        })
      })
    )
  )
)

/**
 * @manual Microsoft Teams Integration
 *
 * ## Initiating a Microsoft Teams Message
 *
 * The Microsoft Teams initiate endpoint sends a proactive message from the
 * configured Teams bot into an existing Bot Framework conversation and creates
 * a ChatBotKit conversation record for continuity.
 *
 * ```http
 * POST /api/v1/integration/microsoftteams/{microsoftteamsIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "conversationId": "19:abc123@thread.tacv2",
 *   "text": "The deployment check is complete. Ask if anyone wants the summary."
 * }
 * ```
 *
 * **Required parameters:**
 *
 * - `conversationId` - The Microsoft Teams Bot Framework conversation ID
 * - `text` - The message body to send
 *
 * **Prerequisites:** The Microsoft Teams integration must have a bot configured and Bot
 * Framework credentials. The bot must already be installed in the target Teams
 * conversation. This endpoint does not send by email, phone, or UPN.
 */
