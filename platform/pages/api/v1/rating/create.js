// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'

import botIdSchema from '@/schemas/botId'
import contactIdSchema from '@/schemas/contactId'
import conversationIdSchema from '@/schemas/conversationId'
import descriptionSchema from '@/schemas/description'
import messageIdSchema from '@/schemas/messageId'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  contactId: contactIdSchema('use'),

  botId: botIdSchema('use'),

  conversationId: conversationIdSchema('use'),

  messageId: messageIdSchema('use'),

  value: schema.number().required(),

  reason: schema.string().allow(null, ''),

  meta: metaSchema,
})

/**
 * -@swagger
 *
 * /rating/create:
 *   post:
 *     operationId: createRating
 *     summary: Create a new rating
 *     tags:
 *       - Rating
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - type: object
 *                 properties:
 *                   contactId:
 *                     description: The contact id assigned to this rating
 *                     type: string
 *                   botId:
 *                     description: The bot id assigned to this rating
 *                     type: string
 *                   conversationId:
 *                     description: The conversation id associated with this rating
 *                     type: string
 *                   messageId:
 *                     description: The message id associated with this rating
 *                     type: string
 *                   value:
 *                     description: The rating value
 *                     type: number
 *                   reason:
 *                     description: Optional reason for the rating
 *                     type: string
 *                     nullable: true
 *                 required:
 *                   - value
 *     responses:
 *       200:
 *         description: The rating was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created rating
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    [], // @todo use ['rate/rating', 'rating'],
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        name,
        description,

        contactId: contact,

        botId: bot,

        conversationId: conversation,

        messageId: message,

        value,

        reason,

        meta,
      } = body

      const { id } = await prisma.rating.create({
        data: {
          userId: session.user.id,

          // basic information

          name,
          description,

          // resource linking

          contactId: contact?.id,

          botId: bot?.id,

          conversationId: conversation?.id,

          messageId: message?.id,

          // resource specific

          value,

          reason,

          // meta and others

          meta,
        },

        select: {
          id: true,
        },
      })

      return ok({ id })
    })
  )
)

/**
 * @manual Ratings
 * @index 10
 *
 * ## Creating Ratings
 *
 * Creating a rating captures structured feedback about bot interactions,
 * conversations, or specific messages, enabling comprehensive performance
 * tracking and quality analysis across your conversational AI platform. Unlike
 * simple upvote/downvote operations, the rating creation endpoint provides
 * flexible numerical scoring with optional qualitative context.
 *
 * To create a new rating, send a POST request with the rating value and
 * associated resource identifiers. At minimum, you must provide a numerical
 * value representing the rating score. Optionally link the rating to specific
 * contacts, bots, conversations, or messages for granular feedback tracking:
 *
 * ```http
 * POST /api/v1/rating/create
 * Content-Type: application/json
 *
 * {
 *   "value": -50,
 *   "reason": "The response was inaccurate and missed key information from the knowledge base",
 *   "conversationId": "cnv_abc123",
 *   "messageId": "msg_xyz789",
 *   "botId": "bot_def456",
 *   "contactId": "ctc_ghi012"
 * }
 * ```
 *
 * ### Understanding Rating Values
 *
 * The `value` field accepts any numerical value, providing flexibility for
 * different rating scales and methodologies. Common patterns include:
 *
 * - **Binary feedback**: Use -100 (negative) and 100 (positive) for simple
 *   good/bad ratings
 * - **Five-star equivalent**: Use -100, -50, 0, 50, 100 for five-point scales
 * - **NPS-style**: Use values from -100 to 100 for Net Promoter Score tracking
 * - **Custom metrics**: Define your own scale matching internal quality
 *   standards
 *
 * The numerical approach enables sophisticated analytics including trend
 * analysis, average performance calculation, and statistical quality tracking
 * that would be difficult with categorical feedback alone.
 *
 * ### Resource Association
 *
 * Link ratings to specific platform resources for targeted feedback analysis:
 *
 * - **contactId**: Associate with a specific contact to track satisfaction at
 *   the user level
 * - **botId**: Link to a bot for overall bot performance metrics
 * - **conversationId**: Connect to a conversation for session-level quality
 *   tracking
 * - **messageId**: Tie to a specific message for precise response evaluation
 *
 * You can link to multiple resources simultaneously (e.g., both a conversation
 * and a specific message within it) to enable multi-dimensional analysis of
 * feedback patterns.
 *
 * ### Providing Context with Reasons
 *
 * The optional `reason` field captures qualitative context explaining the
 * numerical rating. This text field helps you understand the "why" behind
 * feedback scores, enabling meaningful improvements to your conversational AI:
 *
 * ```http
 * POST /api/v1/rating/create
 * Content-Type: application/json
 *
 * {
 *   "value": -75,
 *   "reason": "Bot failed to understand technical question about API authentication despite relevant documentation in dataset",
 *   "botId": "bot_support_001",
 *   "conversationId": "cnv_session_456"
 * }
 * ```
 *
 * Detailed reasons transform numerical ratings into actionable insights,
 * helping you identify specific improvement areas, recurring issues, and
 * patterns that require attention. Consider establishing reason categorization
 * standards across your team for consistent feedback analysis.
 *
 * ### Metadata and Organization
 *
 * Use the `meta` field to attach custom attributes for sophisticated rating
 * organization and analysis. Common metadata patterns include:
 *
 * - **Category tags**: `{"category": "accuracy", "subcategory": "factual"}`
 * - **Source tracking**: `{"source": "automated_test", "testId": "acc_001"}`
 * - **Business context**: `{"department": "support", "priority": "high"}`
 * - **Time-based context**: `{"businessHours": true, "peakTime": false}`
 *
 * Metadata provides the flexibility to implement custom rating taxonomies
 * matching your organization's specific quality metrics and reporting needs.
 *
 * **Response:**
 *
 * ```json
 * {
 *   "id": "rtg_abc123xyz"
 * }
 * ```
 *
 * The API returns the newly created rating's unique identifier upon successful
 * creation. Store this ID if you need to update or reference the rating later.
 *
 * **Best Practices:**
 *
 * - **Consistency**: Establish clear rating value conventions across your
 *   organization for meaningful comparative analysis
 * - **Context**: Always provide reasons for extreme ratings (very positive or
 *   very negative) to capture actionable insights
 * - **Timeliness**: Create ratings promptly after interactions while context is
 *   fresh and accurate
 * - **Association**: Link ratings to the most specific resource available (e.g.,
 *   messageId rather than just conversationId) for precise feedback tracking
 * - **Automation**: Consider implementing automated rating creation for quality
 *   assurance testing and continuous performance monitoring
 *
 * **Important Considerations:**
 *
 * Rating data accumulates over time and becomes a valuable analytics asset.
 * Plan your rating strategy carefully, establishing clear conventions for value
 * scales, reason formats, and metadata structure before widespread
 * implementation. Consistent rating patterns enable meaningful trend analysis
 * and performance comparisons across bots, time periods, and use cases.
 */
