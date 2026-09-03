// @ts-check
import { streamChannelEvents } from '@/lib/channel.user'
import { withStream } from '@/lib/stream'
import { UserInputError } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { EVENTS_CHANNEL_NAME } from '@/lib/log'
import { withPost } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { isLiveEventStreamingEnabled } from '@/lib/user.limits'

export const bodySchema = schema.object({
  historyLength: schema.number().integer().min(0).max(10000).optional(),
})

/**
 * @swagger
 *
 * /event/log/subscribe:
 *   post:
 *     operationId: subscribeEventLogs
 *     summary: Subscribe to live event logs
 *     description: |
 *       Subscribe to receive real-time event logs as they are generated. This
 *       endpoint returns a streaming response that continuously delivers events
 *       as they occur in your account. The connection remains open until the
 *       client closes it or an error occurs.
 *
 *       This is useful for:
 *       - Real-time monitoring dashboards
 *       - Live debugging and troubleshooting
 *       - Building reactive integrations
 *       - Streaming event data to external systems
 *
 *       For historical event data, use the `/event/log/list` endpoint instead.
 *     tags:
 *       - Event
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               historyLength:
 *                 description: |
 *                   Number of recent historical events to replay before
 *                   subscribing to live updates. When provided, the subscriber
 *                   will first receive up to this many recent events that were
 *                   logged before the subscription started. This is useful for
 *                   catching up on events that may have occurred during
 *                   connection setup.
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000
 *     responses:
 *       200:
 *         description: Successfully subscribed to event logs
 *         content:
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - item
 *                     data:
 *                       $ref: '#/paths/~1event~1log~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        // @note check if user's plan allows live event streaming

        const canUseLiveStreaming = await isLiveEventStreamingEnabled(
          session.user
        )

        if (!canUseLiveStreaming) {
          throw new UserInputError(
            'Live event streaming is not available on your plan.'
          )
        }

        /** @type {import('@/lib/channel.core').StreamChannelEventsOptions | undefined} */
        const options = body.historyLength
          ? { historyLength: body.historyLength }
          : undefined

        for await (const event of streamChannelEvents(
          session.user.id,
          EVENTS_CHANNEL_NAME,
          {
            ...options,

            abortSignal: stream.abortSignal,
          }
        )) {
          switch (event.type) {
            case 'subscribe': {
              // @note subscribe events indicate successful channel subscription
              // we don't need to forward these to the client
              break
            }

            case 'message': {
              await stream.push({ type: 'item', data: event.data })

              break
            }

            default: {
              // @note ignore unexpected event types
              break
            }
          }
        }
      })
    )
  )
)

/**
 * @manual Event Logs
 * @index 20
 *
 * ## Subscribing to Live Event Logs
 *
 * Event log subscription enables real-time streaming of events as they occur
 * in your account. This creates a persistent connection that continuously
 * delivers events, making it ideal for building real-time monitoring
 * dashboards, live debugging tools, and reactive integrations.
 *
 * To subscribe to live event logs, establish a streaming connection using the
 * subscribe endpoint:
 *
 * ```http
 * POST /api/v1/event/log/subscribe
 * Content-Type: application/json
 * Accept: application/jsonl
 *
 * {}
 * ```
 *
 * Once connected, the endpoint returns a streaming response that remains open,
 * continuously sending event log entries as they are generated. Each event
 * contains the full event data including type, related resource IDs, metadata,
 * and timestamp.
 *
 * ## Understanding the Streaming Response
 *
 * The subscription endpoint uses JSON Lines (JSONL) format where each line
 * represents a separate event. Events are wrapped in an envelope with `type`
 * and `data` fields, matching the format used by other list endpoints:
 *
 * ```json
 * {"type":"item","data":{"id":"evt_123","type":"conversation.create","conversationId":"conv_456","createdAt":"2024-01-15T10:30:00Z","updatedAt":"2024-01-15T10:30:00Z"}}
 * ```
 *
 * The streaming connection remains active until either:
 *
 * - The client closes the connection
 * - A network error or timeout occurs
 * - The server terminates the connection due to inactivity
 *
 * ## Catching Up with Historical Events
 *
 * When connecting, you can optionally request recent historical events to be
 * replayed before receiving live updates. This is useful for ensuring you
 * don't miss events that occurred during connection setup:
 *
 * ```http
 * POST /api/v1/event/log/subscribe
 * Content-Type: application/json
 * Accept: application/jsonl
 *
 * {
 *   "historyLength": 100
 * }
 * ```
 *
 * The `historyLength` parameter specifies how many recent events to replay.
 * These historical events are delivered first, followed by live events.
 *
 * ## Use Cases
 *
 * Live event streaming is particularly valuable for:
 *
 * - **Real-time dashboards**: Display live activity and metrics
 * - **Debugging**: Monitor events as they occur during development
 * - **External integrations**: Stream events to third-party systems
 * - **Alerting**: Trigger actions based on specific event types
 * - **Analytics**: Feed events into real-time analytics pipelines
 *
 * ## Implementation Example
 *
 * Here's how to implement an event subscriber in JavaScript:
 *
 * ```javascript
 * const response = await fetch('/api/v1/event/log/subscribe', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Accept': 'application/jsonl',
 *     'Authorization': 'Bearer YOUR_API_TOKEN'
 *   },
 *   body: JSON.stringify({ historyLength: 50 })
 * });
 *
 * const reader = response.body.getReader();
 * const decoder = new TextDecoder();
 *
 * while (true) {
 *   const { value, done } = await reader.read();
 *   if (done) break;
 *
 *   const chunk = decoder.decode(value);
 *   const lines = chunk.split('\n');
 *
 *   for (const line of lines) {
 *     if (line.trim()) {
 *       const event = JSON.parse(line);
 *       console.log('Event received:', event.data.type, event.data.id);
 *       // Handle the event based on event.data.type
 *     }
 *   }
 * }
 * ```
 *
 * **Best Practices**:
 *
 * - Implement reconnection logic to handle connection drops
 * - Use `historyLength` to catch up on missed events after reconnecting
 * - Process events asynchronously to avoid blocking the stream
 * - Filter events client-side based on type if you only need specific events
 * - For historical analysis, use the `/event/log/list` endpoint instead
 */
