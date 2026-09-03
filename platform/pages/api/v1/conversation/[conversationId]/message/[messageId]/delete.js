// @ts-check
// @todo convert to edge
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /conversation/{conversationId}/message/{messageId}/delete:
 *   post:
 *     operationId: deleteConversationMessage
 *     summary: Delete a message
 *     tags:
 *       - Conversation Message
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation containing the message
 *           type: string
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           description: The ID of the message to delete
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The message was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted message
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: requiredUrlParam(req, 'conversationId'),
      },

      select: {
        id: true,
        userId: true,

        messages: {
          where: {
            id: requiredUrlParam(req, 'messageId'),
          },

          select: {
            id: true,
          },

          take: 1,
        },
      },
    })

    if (!conversation) {
      return notFound()
    }

    if (conversation.userId !== session.user.id) {
      return notAuthorized()
    }

    if (!conversation.messages.length) {
      return notFound()
    }

    await prisma.message.delete({
      where: {
        id: conversation.messages[0].id,
      },
    })

    return ok({ id: conversation.messages[0].id })
  })
)

/**
 * @manual Conversation Messages
 * @index 110
 *
 * ## Deleting a Message
 *
 * Removing a message from a conversation permanently deletes its content and
 * metadata. This operation is useful for content moderation, privacy compliance,
 * removing errors, or managing conversation content according to your
 * application's requirements.
 *
 * To delete a message:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/{messageId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{conversationId}` and `{messageId}` with the appropriate IDs. The
 * request body should be an empty JSON object.
 *
 * ### What Gets Deleted
 *
 * When you delete a message, the following is permanently removed:
 *
 * - The message record itself
 * - Message text content
 * - All message metadata
 * - Entity annotations
 * - Any custom fields associated with the message
 *
 * ### Response
 *
 * The API returns the ID of the deleted message:
 *
 * ```json
 * {
 *   "id": "msg_abc123"
 * }
 * ```
 *
 * This confirms which message was deleted and can be used for logging, auditing,
 * or updating your application's UI.
 *
 * ### Impact on Conversations
 *
 * Deleting a message affects the conversation in several ways:
 *
 * **Conversation Context:**
 * - The deleted message is removed from the conversation history
 * - Subsequent AI responses will not have access to the deleted message content
 * - The conversation flow may be affected if the message provided important
 *   context
 *
 * **Message Order:**
 * - Remaining messages maintain their original order and timestamps
 * - No message IDs or positions are reassigned
 * - Gaps in the conversation timeline indicate deleted messages
 *
 * **Conversation Relationships:**
 * - The conversation itself is not affected
 * - Other messages in the conversation remain unchanged
 * - The conversation's updated timestamp may be modified
 *
 * ### Use Cases
 *
 * Common scenarios for deleting messages include:
 *
 * - **Content Moderation**: Removing inappropriate or policy-violating content
 * - **Privacy Compliance**: Deleting messages containing sensitive information
 *   upon user request
 * - **Error Correction**: Removing messages that were created incorrectly or by
 *   mistake
 * - **Conversation Cleanup**: Pruning unnecessary or test messages from
 *   conversations
 * - **PII Removal**: Deleting messages that inadvertently contain personal
 *   information
 *
 * ### Important Considerations
 *
 * **Irreversible Operation:**
 * This deletion is permanent and cannot be undone. Ensure you have proper
 * authorization and confirmation flows in your application before allowing
 * message deletion.
 *
 * **Context Impact:**
 * Deleting messages can affect conversation coherence. If you remove a question
 * message, the corresponding answer message may lose context. Consider whether
 * you need to delete related messages as well.
 *
 * **Bulk Deletion:**
 * To delete multiple messages, you must call the delete endpoint for each
 * message individually. Implement appropriate rate limiting and error handling
 * when performing bulk deletions.
 *
 * **Alternative Approach:**
 * Instead of deleting messages, consider using metadata flags to mark messages
 * as "hidden" or "archived" in your application. This preserves conversation
 * integrity while allowing you to filter messages in your UI.
 *
 * **Security Note:** You can only delete messages from conversations that belong
 * to your account. The API verifies ownership before performing the deletion.
 */
