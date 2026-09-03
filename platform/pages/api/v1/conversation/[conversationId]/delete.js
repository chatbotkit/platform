// @ts-check
import prisma from '@/prisma/client'

import { deleteConversation } from '@/lib/conversation.delete'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /conversation/{conversationId}/delete:
 *   post:
 *     operationId: deleteConversation
 *     summary: Delete conversation
 *     tags:
 *       - Conversation
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation to delete
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
 *         description: The conversation was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted conversation
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
    })

    if (!conversation) {
      return notFound()
    }

    if (conversation.userId !== session.user.id) {
      return notAuthorized()
    }

    await deleteConversation(conversation.id)

    return ok({ id: conversation.id })
  })
)

/**
 * @manual Conversations
 * @index 40
 *
 * ## Deleting a Conversation
 *
 * Deleting a conversation permanently removes it along with all associated
 * messages and data. This operation is irreversible and should be used carefully,
 * typically for cleanup, privacy compliance, or when a conversation is no longer
 * needed.
 *
 * To delete a conversation, send a POST request with the conversation ID:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{conversationId}` with the actual ID of the conversation you want to
 * delete. The request body should be an empty JSON object.
 *
 * ### What Gets Deleted
 *
 * When you delete a conversation, the following data is permanently removed:
 *
 * - The conversation record itself
 * - All messages within the conversation
 * - Any associated metadata and configuration
 * - Message history and context
 * - File attachments and other associated data
 * - Related usage statistics for that conversation
 *
 * ### Response
 *
 * Upon successful deletion, the API returns the ID of the deleted conversation:
 *
 * ```json
 * {
 *   "id": "conv_abc123"
 * }
 * ```
 *
 * This confirms which conversation was deleted and can be used for logging or
 * auditing purposes.
 *
 * ### Data Relationships
 *
 * Deleting a conversation does not affect:
 *
 * - The bot referenced by the conversation (if any)
 * - The contact associated with the conversation (if any)
 * - The task linked to the conversation (if any)
 * - Any datasets or skillsets referenced by the conversation
 * - Other conversations or resources in your account
 *
 * Only the conversation itself and its direct contents (messages) are removed.
 *
 * ### Use Cases
 *
 * Common scenarios for deleting conversations include:
 *
 * - **Privacy Compliance**: Removing user data upon request (GDPR, CCPA)
 * - **Cleanup**: Removing test or obsolete conversations
 * - **Data Management**: Pruning old conversations to manage storage
 * - **Error Correction**: Removing conversations created by mistake
 * - **User-Initiated Deletion**: Allowing users to delete their conversation
 *   history
 *
 * ### Bulk Deletion
 *
 * To delete multiple conversations, you'll need to call the delete endpoint for
 * each conversation individually. Consider implementing rate limiting and error
 * handling when performing bulk deletions to avoid overwhelming the API.
 *
 * **Warning:** This operation is permanent and cannot be undone. Ensure you have
 * proper authorization checks and confirmation flows in your application before
 * allowing conversation deletion. Consider implementing a soft-delete pattern in
 * your application if you need the ability to recover deleted conversations.
 *
 * **Security Note:** You can only delete conversations that belong to your
 * account. Attempting to delete another user's conversation will result in an
 * authorization error.
 */
