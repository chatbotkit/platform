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
  value: schema.number().integer().min(-100).max(-1).default(-100),
  reason: schema.string().allow(null, '').optional(), // @todo if true, it should be auto-generated
})

/**
 * @swagger
 *
 * /bot/{botId}/downvote:
 *   post:
 *     operationId: downvoteBot
 *     summary: Downvote a bot
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
 *                   description: The bot ID of the downvoted bot
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
 * @index 10
 *
 * ## Downvoting Bots
 *
 * Downvoting complements the upvote functionality by recording negative
 * feedback and identifying problematic bot interactions. This helps you
 * quickly spot issues, track patterns in bot failures, and prioritize areas
 * that need improvement.
 *
 * Downvote values range from -100 to -1, where -100 represents the most
 * severe negative feedback. Including a reason with your downvote provides
 * critical context about what went wrong, enabling targeted improvements to
 * bot configuration, backstory, or connected resources.
 *
 * ```http
 * POST /api/v1/bot/{botId}/downvote
 * Content-Type: application/json
 *
 * {
 *   "value": -100,
 *   "reason": "Bot provided harmful advice that violated safety guidelines"
 * }
 * ```
 *
 * Analyzing downvotes helps identify common failure patterns such as
 * inaccurate information, inappropriate responses, inability to handle certain
 * questions, or violations of intended behavior. Use this feedback to refine
 * your bot's backstory, adjust connected datasets, or implement additional
 * safeguards through moderation settings.
 *
 * Like upvotes, downvotes are subject to rate limiting to ensure data
 * integrity. The combination of upvote and downvote data provides a complete
 * picture of bot performance, enabling you to calculate overall satisfaction
 * scores, identify trends, and make informed decisions about bot optimization
 * priorities.
 */
