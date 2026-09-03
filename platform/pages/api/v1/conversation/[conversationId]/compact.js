// @ts-check
import '@/lib/scope.server'

import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @param {import('@/lib/session.get').Session} session
 * @param {string} conversationId
 * @returns {Promise<Response>}
 */
export async function compact(session, conversationId) {
  const engine = await getStatefulConversationEngine({
    conversationId,

    options: {
      sessionId: session.id,
      userId: session.user.id,
    },
  })

  try {
    const { message, usage } = await engine.definitelyCompact()

    return ok({
      id: message?.id || conversationId,
      text: message?.text ?? '',
      usage: { token: usage.token },
    })
  } finally {
    await engine.dispose()
  }
}

/**
 * @swagger
 *
 * /conversation/{conversationId}/compact:
 *   post:
 *     operationId: compactConversation
 *     summary: Compact a conversation into a checkpoint
 *     tags:
 *       - Conversation
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation to compact
 *           type: string
 *     responses:
 *       200:
 *         description: The conversation was compacted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created checkpoint message, or the conversation ID if there was nothing to compact
 *                   type: string
 *                 text:
 *                   description: The compacted text of the messages, or an empty string if there was nothing to compact
 *                   type: string
 *                 usage:
 *                   $ref: '#/components/schemas/Usage'
 *               required:
 *                 - id
 *                 - text
 *                 - usage
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const conversationId = requiredUrlParam(req, 'conversationId')

    return compact(session, conversationId)
  })
)

/**
 * @manual Conversations
 * @index 55
 *
 * ## Compacting a Conversation
 *
 * As conversations grow longer, they can accumulate many messages that slow
 * down processing and increase token usage for AI completions. The compact
 * endpoint addresses this by summarizing all messages since the last checkpoint
 * into a single concise checkpoint message. This reduces context size while
 * preserving the essential meaning and history of the conversation.
 *
 * To compact a conversation, send a POST request:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/compact
 * Content-Type: application/json
 * ```
 *
 * The request body is not required. The operation is safe to call at any time
 * during a conversation.
 *
 * ### How Compaction Works
 *
 * When you call the compact endpoint, ChatBotKit performs the following steps:
 *
 * 1. **Checkpoint Detection**: Checks whether a previous checkpoint message
 *    exists. If one exists, only the messages created after that checkpoint
 *    are included in the next compaction, avoiding redundant summarization.
 *
 * 2. **Message Summarization**: Sends the accumulated messages to the AI to
 *    produce a concise summary that captures the key points, decisions, and
 *    context from the conversation so far.
 *
 * 3. **Checkpoint Creation**: Stores the generated summary as a new checkpoint
 *    message in the conversation. Future completions and compactions will
 *    reference this checkpoint as the condensed history.
 *
 * ### Response
 *
 * A successful response returns the ID of the newly created checkpoint message
 * along with the compacted `text` and the token `usage` incurred. If there are
 * no messages to compact (empty conversation or nothing since the last
 * checkpoint), the response returns the conversation ID instead, an empty
 * `text`, and no checkpoint is written:
 *
 * ```javascript
 * // When a checkpoint was created:
 * { "id": "msg_xxxxxxxxxxxxxxxx", "text": "Summary of the conversation...", "usage": { "token": 320 } }
 *
 * // When there was nothing to compact:
 * { "id": "conv_xxxxxxxxxxxxxxxx", "text": "", "usage": { "token": 0 } }
 * ```
 *
 * ### When to Compact
 *
 * Compaction is most useful in these scenarios:
 *
 * - **Long-running conversations**: When a conversation has accumulated many
 *   turns and you want to reduce the context window used for subsequent
 *   completions.
 *
 * - **Before archiving**: Compact before storing a conversation to preserve
 *   its key points in a space-efficient form.
 *
 * - **Periodic maintenance**: Schedule periodic compaction for always-on
 *   assistant bots that handle very long sessions.
 *
 * - **Cost optimization**: Reducing message history lowers the number of
 *   tokens processed in future completions, which directly reduces API usage
 *   costs.
 *
 * ### Idempotency and Safety
 *
 * Compaction is safe to call multiple times. If there are no new messages
 * since the last checkpoint, the operation is a no-op and returns immediately.
 * The existing conversation history and any previously created checkpoints
 * are never deleted or modified by this operation.
 */
