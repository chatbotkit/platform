// @ts-check
import prisma from '@/prisma/client'

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
 * /bot/{botId}/upvote:
 *   post:
 *     operationId: upvoteBot
 *     summary: Upvote a bot
 *     tags:
 *       - Bot
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           description: The ID of the bot
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
 *         description: The bot was upvoted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the upvoted bot
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

      const bot = await prisma.bot.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'botId'),
        {
          select: {
            id: true,

            userId: true,
          },
        }
      )

      if (!bot) {
        return notFound()
      }

      if (bot.userId !== session.user.id) {
        return notAuthorized()
      }

      // @todo the rating limit ok should accept expiry value based on the the
      // current token expiration

      if (
        await ratingLimitOK({
          userId: session.user.id,
          botId: bot.id,
        })
      ) {
        await prisma.rating.create({
          data: {
            userId: session.user.id,

            botId: bot.id,

            value,
            reason,
          },
        })
      } else {
        debug('rating limit reached')
      }

      return ok({ id: bot.id })
    })
  )
)

/**
 * @manual Bot Ratings
 * @description Bot ratings enable you to record feedback and performance metrics for conversational AI agents, providing a structured way to track quality, measure user satisfaction, and identify areas for improvement over time.
 * @category Resources/Bots
 * @tags bot, rating, feedback, upvote, downvote, performance
 * @index 1
 *
 * Bot rating functionality allows you to record feedback and performance
 * metrics for your conversational AI agents. The upvote and downvote
 * operations provide a structured way to track bot quality, identify areas for
 * improvement, and measure user satisfaction over time.
 *
 * The rating system helps you gather both quantitative and qualitative
 * feedback about bot performance. Numerical values provide metrics for
 * tracking improvements over time, while optional reason text captures
 * specific details about what worked well or needs improvement. This data is
 * invaluable for iterating on bot configuration, refining backstories, and
 * optimizing overall performance.
 *
 * ## Upvoting Bots
 *
 * Upvoting a bot records positive feedback with a configurable value between 1
 * and 100, with 100 being the default maximum positive rating. You can
 * optionally include a reason to document why the bot performed well, which
 * helps with analyzing patterns in successful interactions and understanding
 * what aspects of the bot's behavior are most effective.
 *
 * ```http
 * POST /api/v1/bot/{botId}/upvote
 * Content-Type: application/json
 *
 * {
 *   "value": 100,
 *   "reason": "Provided accurate technical information and resolved the issue quickly"
 * }
 * ```
 *
 * Ratings are associated with your user account and the specific bot being
 * evaluated. The system includes rate limiting to prevent abuse and ensure
 * that ratings reflect genuine feedback rather than artificial manipulation.
 * If you exceed the rate limit, the operation completes successfully but the
 * rating is not recorded.
 *
 * Use bot ratings to establish quality baselines, identify bots that need
 * attention, compare performance across different configurations, and make
 * data-driven decisions about bot improvements. The combination of numerical
 * scores and contextual reasons provides comprehensive insight into bot
 * effectiveness.
 */
