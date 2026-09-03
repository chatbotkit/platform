// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /conversation/{conversationId}/fetch:
 *   get:
 *     operationId: fetchConversation
 *     summary: Fetch conversation
 *     tags:
 *       - Conversation
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The conversation was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BotRefOrConfig'
 *                 - type: object
 *                   properties:
 *                     contactId:
 *                       description: The contact id assigned to this conversation
 *                       type: string
 *                     taskId:
 *                       description: The task id assigned to this conversation
 *                       type: string
 *                     expiresAt:
 *                       description: The timestamp (ms) at which the conversation expires and is automatically deleted
 *                       type: number
 *                       nullable: true
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: requiredUrlParam(req, 'conversationId'),
      },

      select: {
        // identifiers

        id: true,

        // basic information

        name: true,
        description: true,

        // resource linking

        userId: true,

        contactId: true,

        taskId: true,

        botId: true,

        datasetId: true,

        skillsetId: true,

        // resource specific

        backstory: true,

        model: true,

        privacy: true,
        moderation: true,

        expiresAt: true,

        // meta and others

        meta: true,

        createdAt: true,
        updatedAt: true,
      },
    })

    if (!conversation) {
      return notFound()
    }

    if (conversation.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (conversation).userId)

    return ok(makeJsonSafe(conversation))
  })
)

/**
 * @manual Conversations
 * @index 20
 *
 * ## Fetching a Conversation
 *
 * Retrieving a specific conversation provides access to its complete
 * configuration, including all settings, relationships, and metadata. This is
 * useful when you need to inspect a conversation's current state, verify its
 * configuration, or retrieve details for display or modification.
 *
 * To fetch a conversation, send a GET request with the conversation ID:
 *
 * ```http
 * GET /api/v1/conversation/{conversationId}/fetch
 * ```
 *
 * Replace `{conversationId}` with the actual ID of the conversation you want to
 * retrieve. The conversation ID is returned when you create a conversation or
 * can be obtained from the list endpoint.
 *
 * ### Response Details
 *
 * The response includes the complete conversation object with all configuration
 * and relationship information, including references to associated resources,
 * conversation settings, and metadata.
 *
 * ### Use Cases
 *
 * Fetching a conversation is commonly used to:
 *
 * - Verify the current configuration before sending messages
 * - Display conversation details in a user interface
 * - Retrieve the conversation state for analytics or monitoring
 * - Check which bot, dataset, or skillset is associated
 * - Access custom metadata for application-specific logic
 *
 * **Security Note:** You can only fetch conversations that belong to your
 * account. Attempting to access another user's conversation will result in an
 * authorization error.
 */
