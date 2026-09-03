// @ts-check
// @todo convert to edge
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMessageType } from '@/lib/message'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { detectPiiEntities, getSafeTextAndEntities } from '@/lib/pii'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import descriptionSchema from '@/schemas/description'
import messageTextSchema from '@/schemas/messageText'
import messageTypeSchema from '@/schemas/messageType'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  type: messageTypeSchema,

  text: messageTextSchema,

  entities: schema.array().items(schema.object({}).unknown(true)),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/message/{messageId}/update:
 *   post:
 *     operationId: updateConversationMessage
 *     summary: Update conversation message
 *     tags:
 *       - Conversation Message
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation
 *           type: string
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           description: The ID of the message
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - type: object
 *                 properties:
 *                   type:
 *                     $ref: '#/components/schemas/MessageType'
 *                   text:
 *                     description: The updated text of the message
 *                     type: string
 *                   entities:
 *                     description: Known entities
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Entity'
 *     responses:
 *       200:
 *         description: The message was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated message
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        name,
        description,

        type,

        text,

        entities: knownEntities = [],

        meta,
      } = body

      let safeText, safeEntities

      if (text && knownEntities?.length) {
        const entities = await detectPiiEntities(text)

        ;({ safeText, safeEntities } = getSafeTextAndEntities(
          text,
          entities,
          knownEntities
        ))
      } else {
        ;(safeText = text), (safeEntities = [])
      }

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

              meta: true,
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

      await prisma.message.update({
        where: {
          id: conversation.messages[0].id,
        },

        data: {
          // basic information

          name,
          description,

          // resource specific

          type: type ? getMessageType(type) : undefined,

          text: safeText,

          // meta and others

          meta: getMeta(meta, conversation.messages[0].meta),
        },
      })

      return ok({ id: conversation.messages[0].id, entities: safeEntities })
    })
  )
)

/**
 * @manual Conversation Messages
 * @index 100
 *
 * ## Updating a Message
 *
 * Modifying an existing message allows you to correct content, update metadata,
 * or change message attributes after creation. This is useful for editing
 * mistakes, refining message content, or updating associated metadata without
 * deleting and recreating messages.
 *
 * To update a message:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/{messageId}/update
 * Content-Type: application/json
 *
 * {
 *   "text": "Updated message content with corrections",
 *   "meta": {
 *     "edited": true,
 *     "edit_timestamp": "2025-01-09T10:35:00Z"
 *   }
 * }
 * ```
 *
 * Replace `{conversationId}` and `{messageId}` with the appropriate IDs. You
 * only need to include fields you want to change; all other fields remain
 * unchanged.
 *
 * ### Entity Handling During Updates
 *
 * When you update message text with entity annotations, the system will:
 *
 * 1. Detect PII in the new text content
 * 2. Apply entity annotations to mark sensitive information
 * 3. Redact PII based on your privacy settings
 * 4. Return the updated entity positions
 *
 * Example with entity annotations:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/{messageId}/update
 * Content-Type: application/json
 *
 * {
 *   "text": "My new email is jane@example.com",
 *   "entities": [
 *     {"begin": 16, "end": 32}
 *   ]
 * }
 * ```
 *
 * ### Metadata Management
 *
 * When updating metadata, the system intelligently merges the new meta object
 * with existing metadata. This means you can:
 *
 * - Add new fields without removing existing ones
 * - Update specific fields while preserving others
 * - Build up metadata incrementally over time
 *
 * ### Response
 *
 * The API returns:
 *
 * - **id**: The ID of the updated message (confirms which message was updated)
 * - **entities**: Array of entity positions in the updated text
 *
 * This allows you to track entity locations after the update, which is important
 * for maintaining PII protection and data privacy compliance.
 *
 * ### Use Cases for Message Updates
 *
 * Common scenarios for updating messages include:
 *
 * - **Content Correction**: Fixing typos or errors in message text
 * - **Metadata Enhancement**: Adding tags, flags, or other metadata after
 *   message creation
 * - **PII Updates**: Re-applying entity annotations if privacy requirements
 *   change
 * - **Type Changes**: Adjusting message type if initially classified incorrectly
 * - **Content Refinement**: Improving message content based on user feedback
 *
 * ### Important Considerations
 *
 * - Updating a message does not trigger new AI responses or reprocessing of the
 *   conversation
 * - The updatedAt timestamp will reflect when the message was modified
 * - Message history and conversation context remain intact
 * - Entity detection and PII handling apply to the updated content
 * - You can only update messages in conversations you own
 *
 * **Best Practice:** When implementing message editing in your application,
 * consider maintaining an edit history in the metadata for audit trail purposes.
 * This can help with debugging, compliance, and understanding how messages
 * evolved over time.
 */
