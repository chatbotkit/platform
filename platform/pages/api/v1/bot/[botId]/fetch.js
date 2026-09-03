// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /bot/{botId}/fetch:
 *   get:
 *     operationId: fetchBot
 *     summary: Fetch a bot
 *     tags:
 *       - Bot
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           description: The ID of the bot to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The bot was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BotConfig'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     visibility:
 *                       $ref: '#/components/schemas/BotVisibility'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const bot = await prisma.bot.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'botId'),
      {
        select: {
          // identifiers

          id: true,

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          blueprintId: true,

          datasetId: true,

          skillsetId: true,

          // resource specific

          backstory: true,

          model: true,

          visibility: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!bot) {
      return notFound()
    }

    if (bot.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (bot).userId)

    return ok(makeJsonSafe(bot))
  })
)

/**
 * @manual Bots
 * @index 20
 *
 * ## Fetching Bot Details
 *
 * Retrieving detailed information about a specific bot allows you to access
 * its complete configuration, including the backstory, model settings,
 * connected resources, and all customization options. This operation is
 * essential for displaying bot information in user interfaces, verifying bot
 * settings before starting conversations, or retrieving configuration data for
 * programmatic bot management.
 *
 * The fetch operation returns the full bot object with all properties,
 * including the AI model being used, the backstory that defines its behavior,
 * connections to datasets and skillsets, privacy and moderation settings, and
 * any custom metadata you've attached to the bot.
 *
 * ```http
 * GET /api/v1/bot/{botId}/fetch
 * ```
 *
 * Replace `{botId}` with the unique identifier of the bot you want to
 * retrieve. The bot ID is returned when you create a bot and can also be
 * obtained from the bot listing endpoint. You can use either the bot's unique
 * identifier or a custom identifier you've defined in the bot's metadata.
 *
 * The response includes comprehensive information about the bot's
 * configuration. You'll receive the bot's name and description, its backstory
 * instructions, the AI model it uses, and references to any connected datasets
 * or skillsets. The response also includes visibility settings, privacy
 * options, moderation settings, and timestamps indicating when the bot was
 * created and last updated.
 *
 * This endpoint is particularly useful when you need to verify bot
 * configuration before initiating conversations, display bot details to users
 * for selection or management purposes, or retrieve specific settings like the
 * model or backstory for auditing or analysis.
 *
 * **Security Note:** Only bots that belong to your account can be fetched.
 * Attempting to retrieve a bot that doesn't exist or belongs to another user
 * will result in an error response.
 */
