// @ts-check
import prisma from '@/prisma/client'

import { streamConversationMonitorEvents } from '@/lib/conversation.monitor.channel'
import { withStream } from '@/lib/stream'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({
  historyLength: schema.number().integer().min(0).max(10000).optional(),
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/channel/subscribe:
 *   post:
 *     operationId: subscribeConversationChannel
 *     summary: Subscribe to a conversation's live monitor channel
 *     description: |
 *       Subscribe to a conversation to receive a live, curated feed of its
 *       lifecycle events as it runs - message, operation (tool call), completion
 *       and error events - regardless of how the conversation is being executed
 *       (interactive, dispatched, or via an integration such as Slack, Discord
 *       or WhatsApp). High-frequency token events are not included.
 *
 *       This returns a streaming response that stays open until the client
 *       closes it. You can only subscribe to conversations that belong to your
 *       account.
 *     tags:
 *       - Conversation
 *     parameters:
 *       - $ref: '#/components/parameters/ConversationId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               historyLength:
 *                 description: |
 *                   Number of recent monitor events to replay before following
 *                   live, so a console opening mid-conversation can catch up.
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000
 *     responses:
 *       200:
 *         description: Successfully subscribed to the conversation monitor channel
 *         content:
 *           application/jsonl:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   description: The type of event
 *                   type: string
 *                   enum:
 *                     - message
 *                 data:
 *                   description: The monitor event published to the channel
 *                   type: object
 *                   properties: {}
 *                   additionalProperties: true
 *               required:
 *                 - type
 *                 - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        const conversationId = requiredUrlParam(req, 'conversationId')

        const conversation = await prisma.conversation.findUnique({
          where: {
            id: conversationId,
          },

          select: {
            id: true,
            userId: true,
          },
        })

        if (!conversation) {
          return throwNotFound(`Conversation not found`)
        }

        if (conversation.userId !== session.user.id) {
          return throwNotAuthorized(
            `Not authorized to access this conversation`
          )
        }

        await stream.nop() // send initial headers to client

        /** @type {import('@/lib/conversation.monitor.channel').StreamChannelEventsOptions | undefined} */
        const options = body.historyLength
          ? { historyLength: body.historyLength }
          : undefined

        for await (const event of streamConversationMonitorEvents(
          conversation.userId,
          conversationId,
          {
            ...options,

            abortSignal: stream.abortSignal,
          }
        )) {
          switch (event.type) {
            case 'message': {
              await stream.push({ type: 'message', data: event.data })

              break
            }
          }
        }
      })
    )
  )
)

/**
 * @manual Conversations
 * @index 25
 *
 * ## Subscribing to Conversation Monitor Events
 *
 * The conversation monitor channel provides a real-time, streaming interface to observe
 * the lifecycle of a conversation as it executes. This is useful for building live
 * dashboards, monitoring tools, logging systems, and interactive consoles that need to
 * display conversation progress in real-time.
 *
 * When you subscribe to a conversation's monitor channel, you receive a curated feed of
 * events including messages, tool calls (operations), completions, and errors. The stream
 * remains open and continues to push events as they occur, allowing you to monitor
 * conversations regardless of how they are being executed - whether interactively,
 * dispatched as background jobs, or triggered via integrations such as Slack, Discord,
 * or WhatsApp.
 *
 * ### Real-Time Event Streaming
 *
 * The subscribe endpoint opens a streaming connection that delivers monitor events as
 * JSON-lines format (one JSON object per line). High-frequency token events are excluded
 * from the stream to keep bandwidth efficient, so you receive only meaningful lifecycle
 * events.
 *
 * To subscribe to a conversation's monitor channel:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/channel/subscribe
 * Content-Type: application/json
 *
 * {
 *   "historyLength": 100
 * }
 * ```
 *
 * The `historyLength` parameter is optional and defaults to 0. When specified, the server
 * replays the last N monitor events before following the live stream. This allows clients
 * that join mid-conversation to catch up on recent activity before receiving new events.
 *
 * **Response Format:**
 *
 * The endpoint returns a streaming response where each line is a JSON object representing
 * a monitor event:
 *
 * ```json
 * {
 *   "type": "message",
 *   "data": {
 *     "id": "msg_123",
 *     "role": "user",
 *     "content": "Hello, how can I help?",
 *     "timestamp": "2025-06-26T07:38:21Z"
 *   }
 * }
 * ```
 *
 * ### Authorization and Scope
 *
 * You can only subscribe to conversations that belong to your account. Attempting to
 * subscribe to a conversation owned by another user returns a 403 Unauthorized response.
 *
 * The stream stays open until the client closes the connection. Server-side, the stream
 * automatically closes when the conversation completes or if the underlying connection
 * is interrupted.
 *
 * ### Use Cases
 *
 * Monitor channels are ideal for:
 *
 * - **Live Monitoring Dashboards**: Display conversation progress with real-time event updates
 * - **Debugging and Logging**: Capture all events for forensic analysis and troubleshooting
 * - **Interactive Consoles**: Build terminal-like interfaces showing conversation output as it streams
 * - **Analytics and Telemetry**: Collect events for downstream processing and metrics collection
 * - **Third-party Integrations**: Forward events to external logging, monitoring, or analytics platforms
 *
 * ### Important Notes
 *
 * - The stream connection requires an active client to remain open; closing the client connection terminates the stream
 * - History replay (via `historyLength`) only includes recent events; older events are not included
 * - Monitor events are ordered chronologically and reflect the actual sequence of conversation lifecycle events
 * - The `historyLength` parameter accepts values from 0 to 10000
 */
