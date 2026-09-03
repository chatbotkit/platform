// @ts-check
import { publishChannelMessage } from '@/lib/channel.session'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { badRequest, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({
  message: schema.object().required(),
})

/**
 * @swagger
 *
 * /channel/{channelId}/publish:
 *   post:
 *     operationId: publishChannelMessage
 *     summary: Publish a message to a channel
 *     description: |
 *       Publish a message to a specific channel. The message will be broadcast
 *       to all subscribers currently listening to this channel via the
 *       subscribe endpoint.
 *     tags:
 *       - Channel
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           description: The ID of the channel to publish to (minimum 16 characters)
 *           type: string
 *           minLength: 16
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 description: The message to publish to the channel
 *                 type: object
 *                 properties: {}
 *                 additionalProperties: true
 *             required:
 *               - message
 *     responses:
 *       200:
 *         description: The message was published successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the channel the message was published to
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { message } = body

      const channelId = requiredUrlParam(req, 'channelId')

      if (channelId.length < 16) {
        return badRequest(`channelId is too short`)
      }

      await publishChannelMessage(session, channelId, message)

      return ok({ id: channelId })
    })
  )
)

/**
 * @manual Channels
 * @description Learn about publishing messages to channels for remote function calling in conversational AI and more.
 * @category Channels
 * @index 1
 *
 * ## Primary Use Case
 *
 * While this endpoint can be used generically by ChatBotKit customers for
 * pub/sub messaging, its primary purpose is to support **remote function calling**
 * in conversational AI workflows.
 *
 * ## How Remote Function Calling Works
 *
 * 1. **Setup**: When calling the `/complete` routes with function definitions,
 *    you can specify a `channel` name in the result configuration.
 *
 * 2. **Function Invocation**: If the AI model decides to call one of the defined
 *    functions, it returns a message item containing:
 *    - The function name
 *    - The function arguments
 *    - The channel name that was specified in the `/complete` request
 *
 * 3. **Result Publishing**: The caller then executes the function locally and
 *    pushes the result back to the model by publishing to this endpoint using
 *    the channel name provided by the model.
 *
 * ## Publishing a Message
 *
 * To publish a message to a channel, send a POST request with the `message`
 * payload as a JSON object:
 *
 * ```http
 * POST /api/v1/channel/{channelId}/publish
 * Content-Type: application/json
 *
 * {
 *   "message": { "temperature": 72, "conditions": "sunny" }
 * }
 * ```
 *
 * ## Workflow Example
 *
 * ```javascript
 * // Step 1: Call /complete with function definitions and channel
 * POST /v1/conversation/complete
 * {
 *   "model": "...",
 *   "messages": [...],
 *   "functions": [
 *     {
 *       "name": "get_weather",
 *       "parameters": {...},
 *       "result": {
 *         "channel": "my-function-channel-abc123"
 *       }
 *     }
 *   ]
 * }
 *
 * // Step 2: Model responds with function call
 * // Response includes: function="get_weather", args={city: "NYC"}, channel="my-function-channel-abc123"
 *
 * // Step 3: Execute function locally
 * const result = await getWeather("NYC")
 *
 * // Step 4: Publish result back via this endpoint
 * POST /v1/channel/my-function-channel-abc123/publish
 * {
 *   "message": { "temperature": result.temperature, "conditions": result.conditions }
 * }
 * ```
 *
 * ## Important Notes
 *
 * - **Channel ID Requirements**: Channel IDs must be at least 16 characters
 *   long for security and collision avoidance.
 *
 * - **Channel ID Namespace**: Channel IDs are scoped to your session, so they
 *   cannot conflict across different ChatBotKit sessions.
 *
 * - **Message Format**: The `message` field accepts any JSON object. For
 *   function results, pass the result data directly as a JSON object.
 *
 * - **Real-time Delivery**: Messages are delivered in real-time to active
 *   subscribers. If no subscriber is listening at the time of publish, the
 *   message is not delivered to late-joining subscribers unless those
 *   subscribers use the `historyLength` option to request history replay.
 *
 * - **Message History**: In system-managed workflows (such as dispatch-based
 *   function calling), messages are persisted in a Redis Stream for up to one
 *   hour. Subscribers can replay these stored messages by passing `historyLength`
 *   to the subscribe endpoint. This allows subscribers to catch up on messages
 *   published before the connection was established.
 */
