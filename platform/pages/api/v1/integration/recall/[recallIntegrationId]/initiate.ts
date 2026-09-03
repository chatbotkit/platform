import prisma from '@/prisma/client'

import { withStream } from '@/lib/stream'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { joinMeeting } from '@/lib/recall.bot'
import {
  throwBadRequest,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'
import { makeJsonSafe } from '@/lib/struct'

import externalUrlSchema from '@/schemas/externalUrl'

export const bodySchema = schema.object({
  meetingUrl: externalUrlSchema,
  text: schema.string().trim().min(1),
  botName: schema.string().trim().allow(null, '').max(100),
})

/**
 * @swagger
 *
 * /integration/recall/{recallIntegrationId}/initiate:
 *   post:
 *     operationId: initiateRecall
 *     summary: Initiates a meeting session with the recall integration
 *     tags:
 *       - Conversation
 *     parameters:
 *       - in: path
 *         name: recallIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the recall integration to use
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meetingUrl:
 *                 description: The URL of the meeting to join
 *                 type: string
 *               text:
 *                 description: The instruction text to use to initiate the meeting session
 *                 type: string
 *               botName:
 *                 description: The display name for the bot in the meeting
 *                 type: string
 *             required:
 *               - meetingUrl
 *               - text
 *     responses:
 *       200:
 *         description: The recall integration was successfully initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the recall integration
 *                   type: string
 *                 bot:
 *                   description: The meeting bot data from Recall.ai
 *                   type: object
 *               required:
 *                 - id
 *                 - bot
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['special/rate/initiate', 'rate/message', 'message', 'token'],
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        const { meetingUrl, text, botName } = body

        const recallIntegration =
          await prisma.recallIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'recallIntegrationId'),
            {
              include: {
                bot: {
                  select: {
                    name: true,
                  },
                },
              },
            }
          )

        if (!recallIntegration) {
          return throwNotFound()
        }

        if (recallIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!recallIntegration.botId) {
          throwBadRequest('Recall integration does not have a bot configured')
        }

        if (!recallIntegration.apiKey) {
          throwBadRequest(
            'Recall integration does not have an API key configured'
          )
        }

        let data

        try {
          data = await joinMeeting({
            recallIntegration: {
              id: recallIntegration.id,
              apiKey: recallIntegration.apiKey,
              region: recallIntegration.region,
              userId: recallIntegration.userId,
            },
            meetingUrl,
            text,
            botName: botName || recallIntegration.bot?.name,
          })
        } catch (error) {
          throwBadRequest(
            error instanceof Error ? error.message : 'Failed to join meeting'
          )
        }

        await stream.result(
          makeJsonSafe({
            id: recallIntegration.id,
            bot: data,
          })
        )
      })
    )
  )
)

/**
 * @manual Recall Integration
 * @description Integrate ChatBotKit with Recall.ai to deploy AI meeting bots that join video conferences, transcribe conversations, and enable intelligent real-time interactions during meetings on Zoom, Google Meet, Microsoft Teams, and other supported platforms.
 * @category Integrations
 * @tags recall, meeting, video conference, bot, transcription
 * @index 1
 *
 * The Recall Integration connects ChatBotKit with the Recall.ai platform, enabling
 * you to deploy AI-powered bots that attend video conference meetings on your behalf.
 * Once a bot joins a meeting, it can transcribe the conversation, respond to
 * participant messages in real time, and hand off context to your configured
 * ChatBotKit bot for intelligent response generation. This integration supports
 * popular conferencing platforms including Zoom, Google Meet, Microsoft Teams,
 * Webex, and others that Recall.ai supports.
 *
 * To use the Recall Integration you must first create an integration record that
 * holds your Recall.ai API key, your preferred region, and a reference to a
 * ChatBotKit bot that will handle the conversation logic. The integration is
 * account-scoped, meaning each integration can be reused across multiple meeting
 * sessions simply by calling the initiate endpoint with a different meeting URL.
 *
 * ## Initiating a Meeting Session
 *
 * The initiate endpoint sends a Recall.ai bot into a live video conference. You
 * supply the meeting URL, an instruction message that guides how the bot should
 * behave during the session, and an optional display name for the bot as it
 * appears to other meeting participants.
 *
 * Before calling this endpoint, ensure your Recall Integration has both a valid
 * `apiKey` and a linked `botId`. If either is missing the request will be
 * rejected with a bad request error. The `meetingUrl` must be a valid, publicly
 * reachable conference URL for a meeting that is either already in progress or
 * scheduled to start soon. Recall.ai will attempt to join the meeting immediately
 * once the bot is dispatched.
 *
 * The `text` parameter is the instruction passed to the bot when the meeting
 * session begins. This is typically a system prompt or a brief description of
 * the task the bot should perform, such as taking notes, answering participant
 * questions, or summarising action items. You can include any information the
 * bot needs to operate effectively in the meeting context.
 *
 * The optional `botName` parameter controls the display name shown to other
 * participants in the conference UI. If omitted, the bot uses the name
 * configured on the linked ChatBotKit bot record. Keeping the name descriptive
 * and recognisable (for example, "Support Assistant" or "Meeting Scribe") helps
 * participants understand the bot's purpose.
 *
 * ```http
 * POST /api/v1/integration/recall/{recallIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "meetingUrl": "https://zoom.us/j/123456789?pwd=xxxxxxxx",
 *   "text": "You are a meeting assistant. Transcribe the discussion and answer questions from participants.",
 *   "botName": "Meeting Assistant"
 * }
 * ```
 *
 * A successful response returns the integration ID and a `bot` object containing
 * the Recall.ai bot record with its unique identifier and current status. You can
 * use this bot ID to track the meeting session, send messages during the meeting,
 * control recording, manage screensharing, or instruct the bot to leave the
 * meeting through the session management endpoints.
 *
 * **Prerequisites:** The Recall Integration record must have an `apiKey` set to
 * a valid Recall.ai API key and a `botId` pointing to a configured ChatBotKit
 * bot. Both fields are required; missing either will result in a `400 Bad Request`
 * response. Make sure the meeting is accessible at the provided URL before
 * calling this endpoint, as Recall.ai will attempt to join immediately.
 *
 * **Region note:** Recall.ai operates in multiple regions to reduce latency.
 * The region is configured on the integration record and determines which
 * Recall.ai data centre processes the meeting. Choose a region geographically
 * close to the meeting host or majority of participants for the best performance.
 */
