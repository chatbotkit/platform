// @ts-check
import { streamChannelEvents } from '@/lib/channel.session'
import { withStream } from '@/lib/stream'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwBadRequest } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({
  historyLength: schema.number().integer().min(0).max(10000).optional(),
})

/**
 * @swagger
 *
 * /channel/{channelId}/subscribe:
 *   post:
 *     operationId: subscribeChannelMessages
 *     summary: Subscribe to channel messages
 *     description: |
 *       Subscribe to a channel to receive real-time messages published to it.
 *       This endpoint returns a streaming response that will continuously send
 *       message events as they are published to the channel via the publish
 *       endpoint. The connection remains open until the client closes it or
 *       an error occurs.
 *     tags:
 *       - Channel
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           description: The ID of the channel to subscribe to (minimum 16 characters)
 *           type: string
 *           minLength: 16
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               historyLength:
 *                 description: |
 *                   Number of historical messages to replay from the channel
 *                   before subscribing to live updates. When provided, the
 *                   subscriber will first receive up to this many recent
 *                   messages that were published before the subscription
 *                   started. This is useful for catching up on messages that
 *                   may have been published during connection setup.
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000
 *     responses:
 *       200:
 *         description: Successfully subscribed to channel messages
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
 *                   description: The message data published to the channel
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
        const channelId = requiredUrlParam(req, 'channelId')

        if (channelId.length < 16) {
          return throwBadRequest(`channelId is too short`)
        }

        await stream.nop() // send initial headers to client

        /** @type {import('@/lib/channel.core').StreamChannelEventsOptions | undefined} */
        const options = body.historyLength
          ? { historyLength: body.historyLength }
          : undefined

        for await (const event of streamChannelEvents(session, channelId, {
          ...options,

          abortSignal: stream.abortSignal,
        })) {
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
 * @manual Channels
 *
 * ## Subscribing to Channel Messages
 *
 * Channel subscription enables real-time message streaming, allowing you to
 * receive messages as they are published to a channel. This creates a
 * persistent connection that continuously delivers events, making it ideal
 * for building real-time applications, live dashboards, and responsive
 * integrations.
 *
 * To subscribe to a channel, establish a streaming connection using the
 * subscribe endpoint with the channel ID you wish to monitor:
 *
 * ```http
 * POST /api/v1/channel/{channelId}/subscribe
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The channel ID must be at least 16 characters long to ensure uniqueness
 * and security. Once connected, the endpoint returns a streaming response
 * that remains open, continuously sending message events as they occur.
 *
 * ## Replaying Historical Messages with historyLength
 *
 * When subscribing to a channel, you can request that the server first replay
 * recent messages that were published before your connection was established.
 * This is useful in dispatch-style workflows where messages may have been
 * published during the brief window between initiating a request and
 * establishing the subscription connection.
 *
 * To enable history replay, include `historyLength` in the request body with
 * the maximum number of past messages you want to receive:
 *
 * ```http
 * POST /api/v1/channel/{channelId}/subscribe
 * Content-Type: application/json
 *
 * { "historyLength": 100 }
 * ```
 *
 * When `historyLength` is set, the server will:
 *
 * 1. First deliver up to that many recent historical messages in chronological
 *    order (oldest to newest), each as a `message` event in the stream.
 * 2. Then continue streaming new live messages as they are published.
 *
 * The `historyLength` value must be an integer between 0 and 10000. History is
 * stored for up to one hour (3600 seconds) by default, so very old messages
 * may no longer be available. If fewer historical messages are available than
 * requested, only the available messages are replayed before live streaming
 * begins.
 *
 * ## Understanding the Streaming Response
 *
 * The subscription endpoint uses streaming, returning JSON Lines (JSONL)
 * format where each line represents a separate event. Each message event
 * includes:
 *
 * ```json
 * {"type":"message","data":"your message content here"}
 * ```
 *
 * The streaming connection remains active until either:
 *
 * - The client closes the connection
 * - A network error or timeout occurs
 * - The server terminates the connection due to inactivity
 *
 * ## Real-Time Communication Pattern
 *
 * Channels provide a pub-sub pattern where publishers send messages and
 * subscribers receive them in real-time. This enables:
 *
 * - **Live updates**: Receive immediate notifications when events occur
 * - **Remote function calling**: Trigger actions in response to published messages
 * - **Multi-subscriber support**: Multiple clients can subscribe to the same channel
 * - **Decoupled communication**: Publishers and subscribers don't need direct connections
 *
 * The subscription endpoint works seamlessly with the channel publish endpoint,
 * creating a complete real-time messaging system. When a message is published
 * to a channel, all active subscribers immediately receive the event through
 * their streaming connections.
 *
 * ## Implementation Example
 *
 * Here's how to implement a channel subscriber in JavaScript, including
 * replaying the last 50 historical messages before receiving live events:
 *
 * ```javascript
 * const response = await fetch('/api/v1/channel/my-channel-id-12345/subscribe', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
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
 *       if (event.type === 'message') {
 *         console.log('Received:', event.data);
 *         // Handle the message
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * **Important:** Channel IDs should be treated as secure identifiers. Only
 * share channel IDs with authorized clients that should receive the messages.
 * Consider using randomly generated channel IDs for sensitive communications.
 */
