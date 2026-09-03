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
  channelId: schema.string().trim().min(1),
  text: schema.string().trim().min(1),
})

/**
 * @swagger
 *
 * /integration/discord/{discordIntegrationId}/initiate:
 *   post:
 *     operationId: initiateDiscord
 *     summary: Initiates conversation with the discord integration
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channelId:
 *                 description: The Discord channel ID to send to
 *                 type: string
 *               text:
 *                 description: The text message to send to the Discord channel
 *                 type: string
 *             required:
 *               - channelId
 *               - text
 *     responses:
 *       200:
 *         description: The discord integration was successfully initiated
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
        const { channelId, text } = body

        const discordIntegration =
          await prisma.discordIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'discordIntegrationId')
          )

        if (!discordIntegration) {
          return throwNotFound()
        }

        if (discordIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!discordIntegration.botId) {
          throwBadRequest('Discord integration does not have a bot configured')
        }

        if (!discordIntegration.botToken) {
          throwBadRequest('Discord integration does not have a bot token')
        }

        await sendEvent(discordIntegration.id, {
          type: INITIATE_EVENT_TYPE,
          payload: {
            channelId,
            text,
          },
        })

        await stream.result({
          id: discordIntegration.id,
        })
      })
    )
  )
)

/**
 * @manual Discord Integration
 *
 * ## Initiating a Discord Channel Message
 *
 * The Discord initiate endpoint sends a message from the configured Discord bot
 * to a specific channel and creates a ChatBotKit conversation record for that
 * initiated message.
 *
 * ```http
 * POST /api/v1/integration/discord/{discordIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "channelId": "123456789012345678",
 *   "text": "Deployment checks are complete. Ask the channel if anyone needs the summary."
 * }
 * ```
 *
 * A successful response returns the integration ID confirming the initiation was
 * queued:
 *
 * ```json
 * {
 *   "id": "discord-integration-id"
 * }
 * ```
 *
 * **Required parameters:**
 *
 * - `channelId` - The Discord channel ID where the bot should post the message
 * - `text` - The message body to send
 *
 * **Prerequisites:** The Discord integration must have a bot configured and a
 * bot token. The bot must have permission to send messages in the target
 * channel.
 *
 * **Reply continuity:** This endpoint can send the initiated channel message and
 * store a session for it. Full reply continuity depends on Discord message event
 * coverage for channel replies, which is separate from slash-command handling.
 */
