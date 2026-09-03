// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({})

/**
 * @swagger
 *
 * /bot/{botId}/clone:
 *   post:
 *     operationId: cloneBot
 *     summary: Clone bot
 *     tags:
 *       - Bot
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: The bot was cloned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the cloned bot
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {} = body

      const bot = await prisma.bot.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'botId')
      )

      if (!bot) {
        return notFound()
      }

      if (bot.userId !== session.user.id) {
        return notAuthorized()
      }

      const { id } = await prisma.bot.create({
        data: {
          userId: session.user.id,

          // everything else is copied from the original bot

          name: bot.name,
          description: bot.description,

          // blueprintId: bot.blueprintId, // @note the new bot should not be part of any blueprint

          backstory: bot.backstory,

          model: bot.model,

          datasetId: bot.datasetId,
          skillsetId: bot.skillsetId,

          privacy: bot.privacy,
          moderation: bot.moderation,

          meta: bot.meta,
        },
      })

      return ok({ id })
    })
  )
)

/**
 * @manual Bots
 * @index 50
 *
 * ## Cloning Bots
 *
 * Cloning a bot creates an exact duplicate with the same configuration,
 * backstory, model settings, and connected resources. This operation is useful
 * for creating variations of existing bots, testing configuration changes
 * without affecting production bots, or quickly deploying similar bots for
 * different purposes or environments.
 *
 * The cloning process copies all bot properties including the name,
 * description, backstory, AI model, dataset and skillset connections, privacy
 * settings, moderation configuration, and custom metadata. The cloned bot
 * receives a new unique identifier and is created as an independent entity
 * that can be modified without affecting the original.
 *
 * ```http
 * POST /api/v1/bot/{botId}/clone
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * After cloning, you'll receive the ID of the newly created bot, which you can
 * immediately use for conversations or update with different settings. The
 * cloned bot starts with identical configuration but operates independently,
 * allowing you to experiment with changes or deploy it to different channels
 * without risk to the original bot.
 *
 * This feature is particularly valuable when creating bot variations for
 * different departments, languages, or use cases. You can clone a well-tuned
 * bot and then modify specific aspects like the backstory or connected
 * datasets to adapt it for new purposes while maintaining the core
 * functionality that works well.
 *
 * Cloned bots are not associated with any blueprint, even if the original bot
 * was part of one. This ensures that clones remain independent and don't
 * inherit blueprint-level constraints or relationships. If you need the cloned
 * bot to be part of a blueprint, you can update it after creation to establish
 * that connection.
 *
 * Common use cases for bot cloning include creating development and production
 * versions of the same bot, deploying regional variations with localized
 * instructions, building A/B testing scenarios to compare different
 * approaches, and quickly spinning up multiple specialized bots based on a
 * proven template.
 *
 * **Tip:** After cloning, update the bot's name and description to clearly
 * distinguish it from the original and prevent confusion when managing
 * multiple bots.
 */
