// @ts-check
import prisma from '@/prisma/client'

import { deleteBot } from '@/lib/bot.delete'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /bot/{botId}/delete:
 *   post:
 *     operationId: deleteBot
 *     summary: Delete a bot
 *     tags:
 *       - Bot
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           description: The ID of the bot to delete
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The bot was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted bot
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
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

    await deleteBot(bot)

    return ok({ id: bot.id })
  })
)

/**
 * @manual Bots
 * @index 40
 *
 * ## Deleting Bots
 *
 * Deleting a bot permanently removes it from your account along with its
 * configuration and settings. This operation is irreversible and should be
 * used carefully, especially for bots that are actively deployed or integrated
 * into production systems.
 *
 * When you delete a bot, the bot entity itself is removed, including its name,
 * description, backstory, model configuration, and all associated settings.
 * However, the operation does not delete connected resources like datasets or
 * skillsets, which remain available for use with other bots or applications.
 *
 * ```http
 * POST /api/v1/bot/{botId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The deletion process handles cleanup of bot-related data, including
 * conversation associations and session tokens. Any active conversations using
 * this bot will be affected, so it's important to ensure that the bot is not
 * currently serving users before deletion.
 *
 * Consider archiving or disabling bots instead of deleting them if you want to
 * preserve historical data or maintain the ability to restore bot
 * functionality in the future. You can use visibility settings to make a bot
 * private or update its configuration to prevent it from being used while
 * keeping it available for reference.
 *
 * Before deleting a bot that's integrated into applications or communication
 * channels, make sure to update or remove those integrations to prevent errors
 * or service disruptions. Check for any dependencies on the bot in your
 * workflows, automation rules, or API integrations.
 *
 * **Warning:** Bot deletion is permanent and cannot be undone. Make sure you
 * have backups of any critical configuration data, including the backstory and
 * settings, before proceeding with deletion. Consider exporting bot
 * configuration or cloning the bot before deletion if you might need to
 * recreate it later.
 */
