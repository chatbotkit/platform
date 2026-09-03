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
 * /integration/extract/{extractIntegrationId}/trigger:
 *   post:
 *     operationId: triggerExtractIntegration
 *     summary: Trigger extract integration on historic conversations
 *     tags:
 *       - Extract Integration
 *     parameters:
 *       - in: path
 *         name: extractIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Extract integration
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
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Extract integration trigger initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: ID of the extract integration
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
      const extractIntegrationId = requiredUrlParam(req, 'extractIntegrationId')

      const { conversationIds, sample = 20 } = body

      const integration = await prisma.extractIntegration.findUnique({
        where: {
          id: extractIntegrationId,
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
          sendEvent(extractIntegrationId, {
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
 * @manual Extract Integration
 *
 * ## Triggering Extraction on Historic Conversations
 *
 * The trigger endpoint provides the ability to retroactively apply data extraction
 * to existing conversations. This powerful feature is essential when you've just
 * created an integration and want to extract data from past conversations, or when
 * you've updated your extraction schema and need to reprocess conversations with
 * the new configuration.
 *
 * ```http
 * POST /api/v1/integration/extract/{extractIntegrationId}/trigger
 * Content-Type: application/json
 *
 * {
 *   "sample": 20
 * }
 * ```
 *
 * ### Use Cases
 *
 * **Initial Setup**: After creating a new extract integration, trigger it on your
 * most recent conversations to immediately populate your analytics and test that
 * your extraction schema works as expected.
 *
 * **Schema Updates**: When you've refined your extraction schema and want to apply
 * the improvements to historical conversations. This ensures consistency across all
 * your extracted data.
 *
 * **Data Recovery**: If extraction failed for some conversations due to temporary
 * issues, you can reprocess them to capture the missing data.
 *
 * **Analytics Refresh**: Update your metrics and charts with newly extracted data
 * after making schema changes that add or modify numeric fields marked for collection.
 *
 * ### Processing Options
 *
 * **Sample Recent Conversations**: Use the `sample` parameter (default: 20) to
 * specify how many of your most recent conversations to process. This is ideal
 * for quick testing or periodic data updates.
 *
 * ```http
 * POST /api/v1/integration/extract/{extractIntegrationId}/trigger
 * Content-Type: application/json
 *
 * {
 *   "sample": 50
 * }
 * ```
 *
 * **Specific Conversations**: Provide an array of `conversationIds` to extract
 * data from specific conversations. This is useful when you need to reprocess
 * particular conversations after troubleshooting or schema adjustments.
 *
 * ```http
 * POST /api/v1/integration/extract/{extractIntegrationId}/trigger
 * Content-Type: application/json
 *
 * {
 *   "conversationIds": [
 *     "conv_abc123",
 *     "conv_def456",
 *     "conv_ghi789"
 *   ]
 * }
 * ```
 *
 * ### How It Works
 *
 * When you trigger extraction on historic conversations:
 *
 * 1. **Conversation Selection**: The system identifies conversations based on your
 *    criteria (sample size or specific IDs)
 * 2. **Bot Filtering**: If your integration is linked to a specific bot, only
 *    conversations from that bot are processed
 * 3. **Queue Processing**: Each conversation is queued for extraction using the
 *    same processing pipeline as real-time extraction
 * 4. **Metadata Update**: The conversation metadata is updated with newly extracted
 *    data, and any previous extraction results are replaced
 * 5. **Metrics Collection**: If your schema includes numeric fields marked with
 *    `collect: true`, new metrics are logged
 * 6. **Webhook Notification**: If configured, your webhook receives the extracted
 *    data for each processed conversation
 *
 * The response includes the number of conversations that were queued for processing:
 *
 * ```json
 * {
 *   "id": "ext_abc123",
 *   "triggered": 20
 * }
 * ```
 *
 * ### Important Considerations
 *
 * - Processing happens asynchronously in the background
 * - Large batches may take several minutes to complete
 * - The maximum sample size is 1000 conversations per request
 * - Each extraction consumes API tokens based on conversation length
 * - Webhook notifications are sent as conversations are processed
 * - Previous extraction results for these conversations will be overwritten
 *
 * **Note:** If you're testing a new schema, start with a small sample (5-10
 * conversations) to verify the extraction works as expected before processing
 * larger batches.
 */
