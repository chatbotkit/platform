// @ts-check
import prisma from '@/prisma/client'

import { untrackIdlingConversations } from '@/lib/conversation.idle'
import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import botConfigSchema from '@/schemas/botConfig'
import botIdSchema from '@/schemas/botId'
import contactIdSchema from '@/schemas/contactId'
import descriptionSchema from '@/schemas/description'
import expiresAtSchema from '@/schemas/expiresAt'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import spaceIdSchema from '@/schemas/spaceId'
import taskIdSchema from '@/schemas/taskId'

export const bodySchema = schema
  .object({
    name: nameSchema,
    description: descriptionSchema,

    contactId: contactIdSchema('use'),

    taskId: taskIdSchema('use'),

    spaceId: spaceIdSchema('use'),

    botId: botIdSchema('use'),

    expiresAt: expiresAtSchema,

    meta: metaSchema,
  })
  .concat(botConfigSchema)

/**
 * @swagger
 *
 * /conversation/{conversationId}/update:
 *   post:
 *     operationId: updateConversation
 *     summary: Update conversation
 *     tags:
 *       - Conversation
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BotRefOrConfig'
 *               - type: object
 *                 properties:
 *                   contactId:
 *                     description: The contact id assigned to this conversation
 *                     type: string
 *                   taskId:
 *                     description: The task id assigned to this conversation
 *                     type: string
 *                   spaceId:
 *                     description: The space id assigned to this conversation
 *                     type: string
 *                   expiresAt:
 *                     type: integer
 *                     nullable: true
 *                     description: Epoch-ms timestamp at which the conversation is automatically deleted; null clears any expiry
 *     responses:
 *       200:
 *         description: The conversation was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated conversation
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

        contactId: contact,

        taskId: task,

        spaceId: space,

        botId: bot,

        backstory,

        model,

        datasetId: dataset,
        skillsetId: skillset,

        privacy,
        moderation,

        expiresAt,

        meta,
      } = body

      // @note undefined -> leave unchanged; null -> clear expiry; epoch ms -> Date
      const normalizedExpiresAt =
        expiresAt === undefined
          ? undefined
          : expiresAt == null
            ? null
            : new Date(expiresAt)

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

      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },

        data: {
          // basic information

          name,
          description,

          // resource linking

          contactId: contact?.id,

          taskId: task?.id,

          spaceId: space?.id,

          botId: bot?.id,

          datasetId: dataset?.id || dataset,

          skillsetId: skillset?.id || skillset,

          // resource specific

          backstory,

          model,

          privacy,
          moderation,

          expiresAt: normalizedExpiresAt,

          // meta and others

          meta: getMeta(meta, conversation.meta),
        },
      })

      await untrackIdlingConversations([conversation.id])

      return ok({ id: conversation.id })
    })
  )
)

/**
 * @manual Conversations
 * @index 30
 *
 * ## Updating a Conversation
 *
 * Modifying a conversation allows you to change its configuration, update
 * relationships, or adjust settings after creation. This is useful for adapting
 * the conversation's behavior, correcting information, or changing associations
 * as your application's needs evolve.
 *
 * To update a conversation, send a POST request with the conversation ID and the
 * fields you want to modify:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated Support Session",
 *   "backstory": "You are an expert technical support assistant...",
 *   "model": "glm-5.2"
 * }
 * ```
 *
 * Replace `{conversationId}` with the actual ID of the conversation you want to
 * update. You only need to include the fields you want to change; all other
 * fields will remain unchanged.
 *
 * ### Updateable Fields
 *
 * You can update the following conversation properties:
 *
 * **Basic Information:**
 * - **name**: Change the conversation's display name
 * - **description**: Update the conversation's description
 *
 * **Relationships:**
 * - **botId**: Change the associated bot (null to remove association)
 * - **contactId**: Change the associated contact (null to remove)
 * - **taskId**: Change the associated task (null to remove)
 * - **spaceId**: Change the associated space (null to remove)
 * - **datasetId**: Change the dataset for knowledge retrieval (null to remove)
 * - **skillsetId**: Change the skillset for capabilities (null to remove)
 *
 * **Configuration:**
 * - **backstory**: Modify the AI's instructions and behavior
 * - **model**: Switch to a different language model
 * - **privacy**: Enable or disable privacy mode
 * - **moderation**: Enable or disable content moderation
 * - **expiresAt**: Epoch-ms expiry after which the conversation is auto-deleted (null to clear)
 *
 * **Metadata:**
 * - **meta**: Update or add custom metadata fields
 *
 * ### Example: Changing AI Behavior
 *
 * You can modify the conversation's backstory to change how the AI responds:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/update
 * Content-Type: application/json
 *
 * {
 *   "backstory": "You are a specialized product expert who helps users find the perfect product. Be enthusiastic and knowledgeable about product features."
 * }
 * ```
 *
 * ### Example: Switching Models
 *
 * To use a different language model for better performance or cost optimization:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/update
 * Content-Type: application/json
 *
 * {
 *   "model": "claude-4.8-opus"
 * }
 * ```
 *
 * ### Example: Updating Relationships
 *
 * Associate the conversation with a different bot or dataset:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/update
 * Content-Type: application/json
 *
 * {
 *   "botId": "bot_new123",
 *   "datasetId": "dataset_xyz789"
 * }
 * ```
 *
 * ### Metadata Management
 *
 * The update operation intelligently merges metadata. If you provide a meta
 * object, it will merge with existing metadata rather than replacing it
 * entirely, preserving fields you don't explicitly update.
 *
 * **Important Considerations:**
 *
 * - Updating a conversation does not affect its existing message history
 * - Configuration changes apply to future messages in the conversation
 * - Changing the model or backstory will change how the AI responds going forward
 * - Updates are applied immediately and affect the next interaction
 * - You can only update conversations that belong to your account
 */
