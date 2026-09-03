// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import { IDLE_EVENT_TYPE, sendEvent } from './queue'

export const bodySchema = schema.object({
  conversationIds: schema.array().items(schema.string()).optional(),
  sample: schema.number().min(1).max(1000).optional(),
})

/**
 * @swagger
 *
 * /integration/support/{supportIntegrationId}/trigger:
 *   post:
 *     operationId: triggerSupportIntegration
 *     summary: Trigger support integration on historic conversations
 *     tags:
 *       - Support Integration
 *     parameters:
 *       - in: path
 *         name: supportIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Support integration
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               conversationIds:
 *                 description: Array of conversation IDs to process
 *                 type: array
 *                 items:
 *                   type: string
 *               sample:
 *                 description: Number of recent conversations to process (default 20)
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000
 *     responses:
 *       200:
 *         description: Support integration trigger initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: ID of the support integration
 *                   type: string
 *                 triggered:
 *                   description: Number of conversations queued for processing
 *                   type: number
 *               required:
 *                 - id
 *                 - triggered
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const supportIntegrationId = requiredUrlParam(req, 'supportIntegrationId')

      const { conversationIds, sample = 20 } = body

      const integration = await prisma.supportIntegration.findUnique({
        where: {
          id: supportIntegrationId,
        },
      })

      if (!integration) {
        return notFound()
      }

      if (integration.userId !== session.user.id) {
        return notAuthorized()
      }

      let conversations = []

      if (conversationIds && conversationIds.length > 0) {
        conversations = await prisma.conversation.findMany({
          where: {
            userId: session.user.id,

            ...(integration.botId ? { botId: integration.botId } : {}),

            id: { in: conversationIds },
          },

          select: {
            id: true,
          },
        })
      } else {
        conversations = await prisma.conversation.findMany({
          where: {
            userId: session.user.id,

            ...(integration.botId ? { botId: integration.botId } : {}),
          },

          select: {
            id: true,
          },

          orderBy: {
            createdAt: 'desc',
          },

          take: sample,
        })
      }

      await Promise.all(
        conversations.map((conversation) =>
          sendEvent(supportIntegrationId, {
            type: IDLE_EVENT_TYPE,
            payload: {
              conversationId: conversation.id,
            },
          })
        )
      )

      const triggered = conversations.length

      return ok({ id: integration.id, triggered })
    })
  )
)

/**
 * @manual Support Integration
 *
 * ## Triggering Support on Historic Conversations
 *
 * The trigger endpoint provides the ability to retroactively apply the support
 * integration to existing conversations. This is useful when you've just created
 * a support integration and want to process past conversations, or when you've
 * updated your configuration and need to reprocess conversations.
 *
 * ```http
 * POST /api/v1/integration/support/{supportIntegrationId}/trigger
 * Content-Type: application/json
 *
 * {
 *   "sample": 20
 * }
 * ```
 *
 * ### Use Cases
 *
 * **Initial Setup**: After creating a new support integration, trigger it on your
 * most recent conversations to immediately forward them for support processing.
 *
 * **Configuration Updates**: When you've updated your support integration settings
 * (e.g. changed the email address), you can reprocess conversations with the new
 * configuration.
 *
 * **Data Recovery**: If processing failed for some conversations due to temporary
 * issues, you can reprocess them to capture the missing data.
 *
 * ### Processing Options
 *
 * **Sample Recent Conversations**: Use the `sample` parameter (default: 20) to
 * specify how many of your most recent conversations to process.
 *
 * ```http
 * POST /api/v1/integration/support/{supportIntegrationId}/trigger
 * Content-Type: application/json
 *
 * {
 *   "sample": 50
 * }
 * ```
 *
 * **Specific Conversations**: Provide an array of `conversationIds` to process
 * specific conversations.
 *
 * ```http
 * POST /api/v1/integration/support/{supportIntegrationId}/trigger
 * Content-Type: application/json
 *
 * {
 *   "conversationIds": [
 *     "conv_abc123",
 *     "conv_def456"
 *   ]
 * }
 * ```
 *
 * ### How It Works
 *
 * When you trigger support on historic conversations:
 *
 * 1. **Conversation Selection**: The system identifies conversations based on your
 *    criteria (sample size or specific IDs)
 * 2. **Bot Filtering**: If your integration is linked to a specific bot, only
 *    conversations from that bot are processed
 * 3. **Queue Processing**: Each conversation is queued for support processing using
 *    the same pipeline as real-time processing
 * 4. **Contact Extraction**: Contact details are extracted from conversations
 * 5. **Email Forwarding**: If configured, conversation transcripts are forwarded
 *    to the support email
 *
 * The response includes the number of conversations that were queued for processing:
 *
 * ```json
 * {
 *   "id": "sup_abc123",
 *   "triggered": 20
 * }
 * ```
 *
 * ### Important Considerations
 *
 * - Processing happens asynchronously in the background
 * - Large batches may take several minutes to complete
 * - The maximum sample size is 1000 conversations per request
 * - Each processing consumes API tokens based on conversation length
 * - Previous support processing results for these conversations will be overwritten
 */
