// @ts-check
import prisma from '@/prisma/client'

import {
  makeRequestActivityMessage,
  makeResponseActivityMessage,
} from '@/lib/activity'
import debug from '@/lib/debug'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { ratingLimitOK } from '@/lib/rating'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({
  value: schema.number().integer().min(1).max(100).default(100),
  reason: schema.string().allow(null, '').optional(), // @todo if true, it should be auto-generated
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/upvote:
 *   post:
 *     operationId: upvoteConversation
 *     summary: Upvote conversation
 *     tags:
 *       - Conversation
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 description: The value of the upvote
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 100
 *               reason:
 *                 description: The reason for the upvote
 *                 type: string
 *     responses:
 *       200:
 *         description: The conversation was upvoted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the upvoted conversation
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { value, reason } = body

      const conversation = await prisma.conversation.findUnique({
        where: {
          id: requiredUrlParam(req, 'conversationId'),
        },

        select: {
          id: true,

          userId: true,

          botId: true,

          contactId: true,
        },
      })

      if (!conversation) {
        return notFound()
      }

      if (conversation.userId !== session.user.id) {
        return notAuthorized()
      }

      // @todo the vote limit ok should accept expiry value based on the the
      // current token expiration

      if (
        await ratingLimitOK({
          userId: session.user.id,
          botId: conversation.botId,
          conversationId: conversation.id,
        })
      ) {
        await prisma.message.createMany({
          data: [
            {
              ...makeRequestActivityMessage('upvoteConversation', {
                ...(reason ? { reason } : {}),
              }),

              conversationId: conversation.id,
            },
            {
              ...makeResponseActivityMessage(
                'upvoteConversation',
                {
                  ...(reason ? { reason } : {}),
                },
                {}
              ),

              conversationId: conversation.id,
            },
          ],
        })

        await prisma.rating.create({
          data: {
            userId: session.user.id,

            botId: conversation.botId,

            contactId: conversation.contactId,

            conversationId: conversation.id,

            value,
            reason,
          },
        })
      } else {
        debug('rating limit reached')
      }

      return ok({ id: conversation.id })
    })
  )
)

/**
 * @manual Conversation Feedback
 * @description Conversation feedback allows users to provide ratings and evaluations of AI responses through upvotes and downvotes, helping improve bot performance and gather user sentiment data.
 * @category Objects/Conversations
 * @tags conversation, feedback, ratings, upvote, downvote
 * @index 120
 *
 * Feedback mechanisms in conversations enable users to rate AI responses and
 * provide valuable signals about response quality, helpfulness, and accuracy.
 * The platform supports both upvotes (positive feedback) and downvotes (negative
 * feedback), with optional reasons to provide context for the rating.
 *
 * Collecting feedback helps you understand which interactions are successful and
 * which need improvement, enabling data-driven optimization of your AI bots. The
 * feedback system tracks ratings per conversation and implements rate limiting to
 * prevent abuse while allowing legitimate user feedback.
 *
 * ## Upvoting a Conversation
 *
 * An upvote indicates positive feedback about a conversation, signaling that the
 * AI responses were helpful, accurate, or met the user's needs. Upvotes can
 * include an optional value (1-100) to indicate varying degrees of satisfaction
 * and an optional reason explaining why the conversation was rated positively.
 *
 * To upvote a conversation:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/upvote
 * Content-Type: application/json
 *
 * {
 *   "value": 100,
 *   "reason": "The assistant provided clear, accurate answers to all my questions"
 * }
 * ```
 *
 * Replace `{conversationId}` with the actual conversation ID. Both fields are
 * optional, with value defaulting to 100 if not specified.
 *
 * ### Upvote Parameters
 *
 * When submitting an upvote, you can specify:
 *
 * - **value**: Integer from 1 to 100 indicating satisfaction level (default: 100)
 *   - 100: Excellent, exceeded expectations
 *   - 75-99: Very good, met expectations well
 *   - 50-74: Good, adequately met expectations
 *   - 1-49: Acceptable, minimally met expectations
 *
 * - **reason**: Optional text explaining why the conversation was rated
 *   positively. This provides valuable context for analyzing successful
 *   interactions and identifying what works well.
 *
 * ### What Happens During an Upvote
 *
 * When a conversation is upvoted:
 *
 * 1. The system verifies you have permission to rate the conversation
 * 2. Rate limiting is checked to prevent duplicate ratings
 * 3. Activity messages are added to the conversation documenting the upvote
 * 4. A rating record is created linking the vote to the user, bot, contact, and
 *    conversation
 * 5. The rating becomes available for analytics and reporting
 *
 * ### Use Cases for Upvotes
 *
 * Upvotes are valuable for:
 *
 * - **Quality Metrics**: Tracking overall bot performance and user satisfaction
 * - **Success Identification**: Finding exemplary conversations that can inform
 *   training and improvements
 * - **User Engagement**: Encouraging users to provide positive feedback
 * - **A/B Testing**: Comparing satisfaction levels between different bot
 *   configurations
 * - **Training Data**: Identifying high-quality conversations for model training
 *   or prompt refinement
 *
 * ### Response
 *
 * The API returns:
 *
 * ```json
 * {
 *   "id": "conv_abc123"
 * }
 * ```
 *
 * This confirms which conversation was upvoted and can be used for UI feedback
 * or logging purposes.
 *
 * **Important Notes:**
 *
 * - Upvotes are rate-limited to prevent abuse - users can only vote once per
 *   conversation within a time window
 * - If rate limiting is triggered, the API still returns success but does not
 *   record the duplicate vote
 * - Upvote activity is recorded in the conversation's message history
 * - The rating is associated with the bot, allowing for cross-conversation
 *   analytics
 * - You can only upvote conversations that belong to your account
 */
