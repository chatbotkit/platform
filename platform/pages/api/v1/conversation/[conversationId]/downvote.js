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
  value: schema.number().integer().min(-100).max(-1).default(-100),
  reason: schema.string().allow(null, '').optional(), // @todo if true, it should be auto-generated
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/downvote:
 *   post:
 *     operationId: downvoteConversation
 *     summary: Downvote conversation
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
 *                 description: The value of the downvote
 *                 type: integer
 *                 minimum: -100
 *                 maximum: -1
 *                 default: -100
 *               reason:
 *                 description: The reason for the downvote
 *                 type: string
 *     responses:
 *       200:
 *         description: The message was downvoted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The conversation ID of the downvoted conversation
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
              ...makeRequestActivityMessage('downvoteConversation', {
                ...(reason ? { reason } : {}),
              }),

              conversationId: conversation.id,
            },
            {
              ...makeResponseActivityMessage(
                'downvoteConversation',
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
 * @index 130
 *
 * ## Downvoting a Conversation
 *
 * A downvote indicates negative feedback about a conversation, signaling that
 * the AI responses were unhelpful, inaccurate, or failed to meet the user's
 * needs. Downvotes provide critical insights into where your AI bot needs
 * improvement and help identify problematic interaction patterns.
 *
 * To downvote a conversation:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/downvote
 * Content-Type: application/json
 *
 * {
 *   "value": -100,
 *   "reason": "The assistant misunderstood my question and provided irrelevant information"
 * }
 * ```
 *
 * Replace `{conversationId}` with the actual conversation ID. Both fields are
 * optional, with value defaulting to -100 if not specified.
 *
 * ### Downvote Parameters
 *
 * When submitting a downvote, you can specify:
 *
 * - **value**: Integer from -100 to -1 indicating dissatisfaction level
 *   (default: -100)
 *   - -100: Very poor, completely failed to meet expectations
 *   - -75 to -99: Poor, significantly below expectations
 *   - -50 to -74: Below expectations, multiple issues
 *   - -1 to -49: Somewhat disappointing, minor issues
 *
 * - **reason**: Optional text explaining why the conversation was rated
 *   negatively. This is especially valuable for downvotes as it provides
 *   specific, actionable feedback about what went wrong.
 *
 * ### What Happens During a Downvote
 *
 * When a conversation is downvoted:
 *
 * 1. The system verifies you have permission to rate the conversation
 * 2. Rate limiting is checked to prevent duplicate ratings
 * 3. Activity messages are added to the conversation documenting the downvote
 * 4. A rating record is created with a negative value, linking the vote to the
 *    user, bot, contact, and conversation
 * 5. The negative rating becomes available for analytics and improvement
 *    analysis
 *
 * ### Value of Downvote Reasons
 *
 * Providing detailed reasons for downvotes is particularly valuable because it:
 *
 * - **Identifies Specific Issues**: Explains exactly what went wrong
 * - **Enables Targeted Improvements**: Helps focus optimization efforts
 * - **Reveals Pattern Problems**: Shows recurring issues across conversations
 * - **Guides Training**: Informs prompt engineering and model fine-tuning
 * - **Improves User Experience**: Demonstrates that feedback is valued and
 *   actionable
 *
 * ### Common Downvote Reasons
 *
 * Examples of valuable downvote feedback:
 *
 * - "The assistant didn't understand my technical question"
 * - "Responses were too generic and not specific to my situation"
 * - "The bot provided outdated or incorrect information"
 * - "I couldn't get a direct answer to my question"
 * - "The conversation required too many back-and-forth exchanges"
 * - "The tone was inappropriate for my needs"
 *
 * ### Use Cases for Downvotes
 *
 * Downvotes are essential for:
 *
 * - **Problem Identification**: Finding conversations where the AI failed to
 *   meet expectations
 * - **Quality Assurance**: Monitoring for systematic issues or degraded
 *   performance
 * - **Improvement Prioritization**: Identifying which aspects of bot behavior
 *   need the most urgent attention
 * - **Training Data**: Finding negative examples to avoid during model training
 * - **User Satisfaction Tracking**: Understanding the rate and reasons for user
 *   dissatisfaction
 * - **A/B Testing**: Identifying which configurations lead to more negative
 *   feedback
 *
 * ### Analyzing Downvote Feedback
 *
 * To effectively use downvote data:
 *
 * 1. **Review Conversations**: Examine downvoted conversations to understand
 *    what went wrong
 * 2. **Categorize Issues**: Group downvotes by reason to identify common
 *    problems
 * 3. **Measure Impact**: Track downvote rates over time to assess improvement
 *    efforts
 * 4. **Prioritize Fixes**: Address issues causing the most frequent or severe
 *    downvotes first
 * 5. **Test Solutions**: Verify that changes reduce downvote rates for similar
 *    scenarios
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
 * This confirms which conversation was downvoted and can be used for logging,
 * analytics, or triggering follow-up actions.
 *
 * ### Rate Limiting and Abuse Prevention
 *
 * Like upvotes, downvotes are rate-limited to prevent abuse:
 *
 * - Users can only vote once per conversation within a time window
 * - Duplicate downvote attempts are silently rejected but return success
 * - This prevents malicious users from repeatedly downvoting conversations
 * - Legitimate users can still provide feedback on new conversations
 *
 * **Best Practices:**
 *
 * - Always encourage users to provide reasons when downvoting
 * - Make it easy for users to submit feedback at natural conversation endpoints
 * - Review downvoted conversations regularly to identify improvement
 *   opportunities
 * - Use downvote patterns to guide bot configuration and prompt refinement
 * - Consider following up with users who downvote to better understand their
 *   needs
 * - Track downvote rates over time as a key performance indicator
 *
 * **Important Notes:**
 *
 * - Downvotes are permanent once recorded and cannot be changed to upvotes
 * - Downvote activity is recorded in the conversation's message history for
 *   audit purposes
 * - The rating is associated with the bot, enabling cross-conversation analysis
 * - You can only downvote conversations that belong to your account
 * - Rate limiting prevents duplicate votes but doesn't prevent legitimate
 *   feedback on different conversations
 */
