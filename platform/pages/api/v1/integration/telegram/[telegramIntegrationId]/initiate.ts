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
  chatId: schema
    .alternatives()
    .try(schema.string().trim().min(1), schema.number().integer()),
  text: schema.string().trim().min(1),
})

/**
 * @swagger
 *
 * /integration/telegram/{telegramIntegrationId}/initiate:
 *   post:
 *     operationId: initiateTelegram
 *     summary: Initiates conversation with the telegram integration
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chatId:
 *                 description: The Telegram chat ID, user ID, group chat ID, or channel username to send to
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *               text:
 *                 description: The text instruction to use to initiate the conversation
 *                 type: string
 *             required:
 *               - chatId
 *               - text
 *     responses:
 *       200:
 *         description: The telegram integration was successfully initiated
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
        const { chatId, text } = body

        const telegramIntegration =
          await prisma.telegramIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'telegramIntegrationId')
          )

        if (!telegramIntegration) {
          return throwNotFound()
        }

        if (telegramIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!telegramIntegration.botId) {
          throwBadRequest('Telegram integration does not have a bot configured')
        }

        if (!telegramIntegration.botToken) {
          throwBadRequest('Telegram integration does not have a bot token')
        }

        await sendEvent(telegramIntegration.id, {
          type: INITIATE_EVENT_TYPE,
          payload: {
            chatId,
            text,
          },
        })

        await stream.result({
          id: telegramIntegration.id,
        })
      })
    )
  )
)

/**
 * @manual Telegram Integration
 *
 * ## Initiating a Conversation via Telegram
 *
 * The Telegram initiate endpoint allows you to programmatically start or resume
 * an AI-powered conversation in a Telegram chat known to your bot. This is useful
 * for proactive notifications and follow-ups after a user has already contacted
 * the bot, or for groups/channels where the bot has the required access.
 *
 * Telegram requires a `chatId` destination. This can be a private chat/user ID,
 * group chat ID, channel ID, or a supported channel username. Telegram bots cannot
 * initiate a private conversation from a phone number; the user must first contact
 * the bot or otherwise provide a Telegram chat identifier.
 *
 * ```http
 * POST /api/v1/integration/telegram/{telegramIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "chatId": "123456789",
 *   "text": "Remind the user that their report is ready and ask if they need anything else"
 * }
 * ```
 *
 * A successful response returns the integration ID confirming the initiation was
 * queued:
 *
 * ```json
 * {
 *   "id": "telegram-integration-id"
 * }
 * ```
 *
 * **Required parameters:**
 *
 * - `chatId` - The Telegram chat identifier or supported channel username to
 *   deliver the opening message to
 * - `text` - The instruction text to send as the opening message
 *
 * **Prerequisites:** The Telegram integration must have a bot assigned and a bot
 * token configured. If either is missing, the request returns a `400 Bad Request`
 * error with a descriptive message.
 *
 * **Rate limits:** This endpoint shares rate limits with other message-generating
 * operations. Repeated calls in quick succession may be throttled to protect
 * service quality.
 */
