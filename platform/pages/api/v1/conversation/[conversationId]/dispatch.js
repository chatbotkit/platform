// @ts-check
import cuid from '@/lib/cuid'
import debug from '@/lib/debug'
import { schema, withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { ok } from '@/lib/response'

import { bodySchema as _bodySchema } from '@/pages/api/v1/conversation/[conversationId]/complete'
import {
  COMPLETE_EVENT_TYPE,
  sendEvent,
} from '@/pages/api/v1/conversation/[conversationId]/queue'

const bodySchema = _bodySchema.keys({
  channelId: schema.string().min(24),
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/dispatch:
 *   post:
 *     operationId: dispatchStatefulConversation
 *     summary: Dispatch a stateful conversation completion to run in the background
 *     description: |
 *       Dispatch a stateful conversation completion to run asynchronously in the
 *       background. This endpoint accepts the same parameters as the complete
 *       endpoint but instead of streaming the response directly, it returns a
 *       channel ID that can be used to subscribe to the completion progress.
 *
 *       The completion will be processed in the background and events will be
 *       published to the channel as the completion progresses. This is useful
 *       for long-running completions that may take several minutes to complete.
 *
 *       To monitor the progress, subscribe to the channel using:
 *       `POST /api/v1/channel/{channelId}/subscribe`
 *     tags:
 *       - Conversation
 *     parameters:
 *       - $ref: '#/components/parameters/ConversationId'
 *       - $ref: '#/components/parameters/TimezoneHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/paths/~1conversation~1{conversationId}~1complete/post/requestBody/content/application~1json/schema'
 *               - type: object
 *                 properties:
 *                   channelId:
 *                     description: A unique ID to deduplicate dispatch requests
 *                     type: string
 *                     minLength: 24
 *     responses:
 *       200:
 *         description: The dispatch was queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channelId:
 *                   description: The channel ID to subscribe to for completion events
 *                   type: string
 *               required:
 *                 - channelId
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['rate/message', 'message', 'token'],
    withSchema(bodySchema, async function (req, session, body) {
      const conversationId = requiredUrlParam(req, 'conversationId')

      debug('dispatch stateful conversation called', {
        conversationId,
        body,
      }).log('api.v1.conversation.conversationId.dispatch')

      const channelId = body.channelId || cuid()

      debug('using channel id', { channelId }).log(
        'api.v1.conversation.conversationId.dispatch'
      )

      // @note store up to 1000 messages for 1 hour to allow subscribers to
      // replay messages they may have missed before connecting

      const historyLength = 1000
      const historyExpireSeconds = 60 * 60 // 1 hour

      await sendEvent(conversationId, {
        type: COMPLETE_EVENT_TYPE,
        payload: {
          session: session.valueOf(),
          channelId,
          body,
          historyLength,
          historyExpireSeconds,
        },
      })

      // @note return raw channelId - the subscribe endpoint will scope it
      // to the session automatically

      return ok({ channelId })
    })
  )
)

/**
 * @manual Dispatching Stateful Conversations
 * @description Learn about running stateful conversation completions in the background using the dispatch endpoint.
 * @category Objects/Conversations
 * @index 3
 *
 * ## Overview
 *
 * The stateful dispatch endpoint allows you to run conversation completions in
 * the background for an existing conversation. This is particularly useful for:
 *
 * - Long-running completions that may take several minutes
 * - Scenarios where the client may disconnect (page refresh, mobile apps)
 * - Batch processing where you want to fire-and-forget
 *
 * ## How It Works
 *
 * 1. **Dispatch**: Call the dispatch endpoint with the conversation ID and the
 *    same parameters as the complete endpoint. You'll receive a `channelId` in
 *    the response.
 *
 * 2. **Subscribe**: Use the channel subscribe endpoint to receive real-time
 *    events as the completion progresses.
 *
 * 3. **Process**: The completion runs in the background, publishing events
 *    to the channel including tokens, operations, and the final result.
 *
 * ## Dispatching a Stateful Completion
 *
 * To dispatch a stateful conversation completion, send a POST request with
 * the text to send to the conversation:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/dispatch
 * Content-Type: application/json
 *
 * {
 *   "text": "Analyze this complex dataset..."
 * }
 * ```
 *
 * The response returns a `channelId` you can use to subscribe to progress events:
 *
 * ```json
 * { "channelId": "ch_abc123..." }
 * ```
 *
 * ## Full Workflow Example
 *
 * ```javascript
 * // Step 1: Dispatch the completion
 * const dispatchResponse = await fetch(`/api/v1/conversation/${conversationId}/dispatch`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     text: "Analyze this complex data..."
 *   })
 * });
 *
 * const { channelId } = await dispatchResponse.json();
 *
 * // Step 2: Subscribe to the channel for updates
 * const subscribeResponse = await fetch(`/api/v1/channel/${channelId}/subscribe`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({})
 * });
 *
 * // Step 3: Process streaming events
 * const reader = subscribeResponse.body.getReader();
 * const decoder = new TextDecoder();
 *
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *
 *   const chunk = decoder.decode(value);
 *   const lines = chunk.split('\n').filter(line => line.trim());
 *
 *   for (const line of lines) {
 *     const event = JSON.parse(line);
 *     console.log('Event:', event.type, event.data);
 *
 *     if (event.type === 'result') {
 *       console.log('Completion finished:', event.data);
 *     }
 *   }
 * }
 * ```
 *
 * ## Channel Events
 *
 * The channel will receive the same events as the streaming complete endpoint:
 *
 * - **send_result**: The user message was stored
 * - **receive_result**: The assistant response was generated
 * - **error**: Any errors that occurred
 *
 * ## Important Considerations
 *
 * - **Channel Lifetime**: Channels remain active during the completion. Once
 *   the completion finishes, the channel will no longer receive new events.
 *
 * - **Missed Events**: If you subscribe after the completion has started, you
 *   may miss some events. Subscribe as soon as you receive the channel ID.
 *
 * - **Session Scope**: The channel ID is scoped to your session for security.
 *
 * - **Conversation State**: The completion will use and update the conversation's
 *   existing message history.
 */
