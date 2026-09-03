// @ts-check
// @todo convert to edge
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
 * /conversation/{conversationId}/message/{messageId}/upvote:
 *   post:
 *     operationId: upvoteConversationMessage
 *     summary: Upvote conversation message
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
 *         description: The message was upvoted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the upvoted message
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

      // @todo the vote limit ok should accept expiry value based on the the
      // current token expiration

      if (
        await ratingLimitOK({
          userId: session.user.id,
          botId: conversation.botId,
          conversationId: conversation.id,
          messageId: conversation.messages[0].id,
        })
      ) {
        await prisma.message.createMany({
          data: [
            {
              ...makeRequestActivityMessage('upvoteMessage', {
                ...(reason ? { reason } : {}),
              }),

              conversationId: conversation.id,
            },
            {
              ...makeResponseActivityMessage(
                'upvoteMessage',
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

            messageId: conversation.messages[0].id,

            value,
            reason,
          },
        })
      } else {
        debug('rating limit reached')
      }

      return ok({ id: conversation.messages[0].id })
    })
  )
)

/**
 * @manual Conversation Feedback
 * @description The rating system allows users to provide feedback on individual messages within a conversation by upvoting or downvoting them. This feedback mechanism helps improve the quality of AI-generated responses by identifying which messages are helpful and which are not. Users can specify a value for their rating, with upvotes being positive values and downvotes being negative values. Additionally, users can provide a reason for their rating, which can be used to further analyze and enhance the AI's performance.
 * @category Objects/Conversations
 * @index 20
 *
 * ## Upvoting Messages
 *
 * Upvoting messages allows you to provide positive feedback on AI-generated
 * responses, helping to improve the quality of future interactions and track
 * which responses are most helpful to users. When you upvote a message, the
 * system records a rating with a positive value and creates activity entries
 * in the conversation history to maintain a complete audit trail of feedback.
 *
 * The upvote operation accepts a value parameter ranging from 1 to 100,
 * allowing you to indicate different levels of positive feedback. The default
 * value is 100, representing the highest level of satisfaction. You can also
 * optionally provide a reason explaining why the message was upvoted, which
 * can be valuable for understanding what makes responses particularly helpful
 * or effective.
 *
 * To upvote a message, send a POST request to the message's upvote endpoint:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/{messageId}/upvote
 * Content-Type: application/json
 *
 * {
 *   "value": 100,
 *   "reason": "Clear explanation that solved my problem"
 * }
 * ```
 *
 * The system implements rate limiting on rating operations to prevent abuse
 * and ensure data quality. Each user, bot, conversation, and message
 * combination can only be rated once within a specific time window. If the
 * rate limit has been reached, the API will still return success but will not
 * create a new rating record, preventing duplicate ratings that could skew
 * feedback data.
 *
 * ### Response
 *
 * The API returns the ID of the message that was upvoted:
 *
 * ```json
 * {
 *   "id": "msg_abc123"
 * }
 * ```
 *
 * **Important Notes:**
 *
 * - The value parameter must be an integer between 1 and 100
 * - Only the conversation owner can upvote messages in their conversations
 * - Rate limiting prevents multiple votes on the same message within the time
 *   window
 * - Activity messages are automatically added to the conversation to track the
 *   upvote action
 * - The reason parameter is optional but recommended for detailed feedback
 *   analysis
 */
