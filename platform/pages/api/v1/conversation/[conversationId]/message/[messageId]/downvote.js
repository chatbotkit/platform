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
  value: schema.number().integer().min(-100).max(-1).default(-100),
  reason: schema.string().allow(null, '').optional(), // @todo if true, it should be auto-generated
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/message/{messageId}/downvote:
 *   post:
 *     operationId: downvoteConversationMessage
 *     summary: Downvote conversation message
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
 *                   description: The ID of the downvoted message
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

      // @todo the rating limit ok should accept expiry value based on the the
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
              ...makeRequestActivityMessage('downvoteMessage', {
                ...(reason ? { reason } : {}),
              }),

              conversationId: conversation.id,
            },
            {
              ...makeResponseActivityMessage(
                'downvoteMessage',
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
 * @category Objects/Conversations
 * @index 21
 *
 * ## Downvoting Messages
 *
 * Downvoting messages provides negative feedback on AI responses that were
 * unhelpful, inaccurate, or inappropriate, helping to identify areas where
 * the AI needs improvement. This feedback mechanism is essential for
 * maintaining conversation quality and training the system to avoid similar
 * issues in future interactions.
 *
 * Similar to upvoting, the downvote operation records a rating with a
 * negative value and creates activity entries in the conversation history.
 * The value parameter ranges from -100 to -1, with -100 representing the
 * most severe issues and -1 indicating minor problems. The default value is
 * -100, signaling significant dissatisfaction with the response.
 *
 * To downvote a message, send a POST request to the message's downvote
 * endpoint:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/message/{messageId}/downvote
 * Content-Type: application/json
 *
 * {
 *   "value": -100,
 *   "reason": "Response was inaccurate and potentially misleading"
 * }
 * ```
 *
 * The reason parameter is particularly valuable for downvotes, as it helps
 * identify specific issues with the response. Common reasons include
 * factual inaccuracies, inappropriate tone, failure to follow instructions,
 * or responses that don't address the user's actual question.
 *
 * ### Response
 *
 * The API returns the ID of the message that was downvoted:
 *
 * ```json
 * {
 *   "id": "msg_abc123"
 * }
 * ```
 *
 * **Important Notes:**
 *
 * - The value parameter must be an integer between -100 and -1
 * - Rate limiting applies the same way as upvoting to prevent duplicate
 *   feedback
 * - Downvotes are tracked separately from upvotes and both can contribute
 *   to overall quality metrics
 * - Providing detailed reasons helps improve AI training and response quality
 * - Activity messages document the downvote action for complete conversation
 *   history
 */
