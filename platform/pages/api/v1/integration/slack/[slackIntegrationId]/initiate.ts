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
  channel: schema.string().trim().min(1),
  text: schema.string().trim().min(1),
})

/**
 * @swagger
 *
 * /integration/slack/{slackIntegrationId}/initiate:
 *   post:
 *     operationId: initiateSlack
 *     summary: Initiates conversation with the slack integration
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channel:
 *                 description: The Slack channel or user to send to
 *                 type: string
 *               text:
 *                 description: The text instruction to use to initiate the conversation
 *                 type: string
 *             required:
 *               - channel
 *               - text
 *     responses:
 *       200:
 *         description: The slack integration was successfully initiated
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
        const { channel, text } = body

        const slackIntegration =
          await prisma.slackIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'slackIntegrationId')
          )

        if (!slackIntegration) {
          return throwNotFound()
        }

        if (slackIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!slackIntegration.botId) {
          throwBadRequest('Slack integration does not have a bot configured')
        }

        if (!slackIntegration.botToken) {
          throwBadRequest('Slack integration does not have a bot token')
        }

        await sendEvent(slackIntegration.id, {
          type: INITIATE_EVENT_TYPE,
          payload: {
            channelId: channel,
            text,
          },
        })

        await stream.result({
          id: slackIntegration.id,
        })
      })
    )
  )
)

/**
 * @manual Slack Integration
 *
 * ## Initiating a Conversation via Slack
 *
 * The Slack initiate endpoint allows you to programmatically start a new AI-powered
 * conversation in any Slack channel or direct message without waiting for a user to
 * send the first message. This is ideal for proactive notification workflows, scheduled
 * check-ins, alert escalations, and any scenario where your system needs to push
 * contextual information to a Slack audience and engage them in a conversation.
 *
 * To use this endpoint, your Slack integration must have a bot configured and a valid
 * bot token. The `channel` parameter accepts a Slack channel ID (e.g., `C01234ABCDE`)
 * or a user ID for direct messages (e.g., `U01234ABCDE`). The `text` parameter is an
 * instruction that guides the bot on what to say when opening the conversation - it is
 * not sent verbatim, but used as context to generate an appropriate opening message
 * tailored to the Slack audience.
 *
 * Once initiated, the bot sends its opening message to the specified channel, and
 * any replies from channel participants are handled through the standard Slack event
 * webhook, maintaining a full conversational flow as with any user-initiated exchange.
 *
 * ```http
 * POST /api/v1/integration/slack/{slackIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "channel": "C01234ABCDE",
 *   "text": "Remind the team that the deployment window opens at 3pm and ask if anyone has concerns"
 * }
 * ```
 *
 * A successful response returns the integration ID confirming the initiation was queued:
 *
 * ```json
 * {
 *   "id": "slack-integration-id"
 * }
 * ```
 *
 * **Required parameters:**
 *
 * - `channel` - The Slack channel ID or user ID to deliver the opening message to
 * - `text` - The instruction text that guides the bot's opening message content
 *
 * **Prerequisites:** The Slack integration must have a bot assigned and a bot token
 * configured. If either is missing, the request returns a `400 Bad Request` error with
 * a descriptive message. Ensure your integration has been fully set up using the setup
 * endpoint before calling initiate.
 *
 * **Rate limits:** This endpoint shares rate limits with other message-generating
 * operations. Repeated calls in quick succession may be throttled to protect service
 * quality.
 */
