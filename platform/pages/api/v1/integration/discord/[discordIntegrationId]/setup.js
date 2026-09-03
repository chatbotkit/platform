// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { fetchAPI } from '@/lib/discord.api'
import { captureError } from '@/lib/error'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  notAuthorized,
  notFound,
  ok,
  respondFromError,
  throwConflict,
} from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @param {import('@/prisma/types').DiscordIntegration} discordIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(discordIntegration) {
  debug(`do setup`, { discordIntegration })

  if (discordIntegration.appId == null || !discordIntegration.appId) {
    return throwConflict(`No appId specified`)
  }

  if (discordIntegration.botToken == null || !discordIntegration.botToken) {
    return throwConflict(`No botToken specified`)
  }

  if (discordIntegration.publicKey == null || !discordIntegration.publicKey) {
    return throwConflict(`No publicKey specified`)
  }

  const handle = (discordIntegration.handle || 'chatbotkit')
    .trim()
    .replace(/\W/g, '')

  if (!handle) {
    return throwConflict(`No handle specified`)
  }

  const commands = await fetchAPI(
    // @todo fix this
    // @ts-ignore
    discordIntegration,
    'GET',
    `applications/${discordIntegration.appId}/commands`
  )

  if (!Array.isArray(commands)) {
    return throwConflict(`Unexpected commands`)
  }

  await Promise.all(
    commands.map(async ({ id }) => {
      try {
        await fetchAPI(
          // @todo fix this
          // @ts-ignore
          discordIntegration,
          'DELETE',
          `applications/${discordIntegration.appId}/commands/${id}`
        )
      } catch {
        debug(`dailed to delete command ${id}, continuing with setup`, {
          commandId: id,
        })

        // @note individual command deletion failures are non-fatal; continue setup
      }
    })
  )

  await fetchAPI(
    // @todo fix this
    // @ts-ignore
    discordIntegration,
    'POST',
    `applications/${discordIntegration.appId}/commands`,
    {
      name: handle,
      description: 'Talk to the bot',
      options: [
        {
          type: 3,
          name: 'message',
          description: 'message',
          required: true,
        },
      ],
    }
  )
}

/**
 * @swagger
 *
 * /integration/discord/{discordIntegrationId}/setup:
 *   post:
 *     operationId: setupDiscordIntegration
 *     summary: Setup Discord integration
 *     tags:
 *       - Discord Integration
 *     parameters:
 *       - in: path
 *         name: discordIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Discord integration
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
 *         description: The Discord integration was setup successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the setup Discord integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const discordIntegration =
      await prisma.discordIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'discordIntegrationId')
      )

    if (!discordIntegration) {
      return notFound()
    }

    if (discordIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(discordIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: discordIntegration.id })
  })
)

/**
 * @manual Discord Integration
 * @index 10
 *
 * ## Setting Up Your Discord Integration
 *
 * Setting up a Discord integration involves configuring slash commands and establishing
 * the interaction endpoint between Discord and ChatBotKit. This process registers your
 * bot's commands with Discord and ensures proper webhook communication. The setup process
 * must be completed after creating the integration and obtaining the necessary Discord
 * application credentials.
 *
 * The setup endpoint automatically configures your Discord bot by registering the
 * slash command specified in the integration's handle parameter. It removes any existing
 * commands to prevent conflicts and creates a new command with the specified handle
 * and description. This ensures your bot responds consistently to the correct slash
 * command format.
 *
 * ```http
 * POST /api/v1/integration/discord/{discordIntegrationId}/setup
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * After creating your Discord integration, you must configure the Interactions Endpoint
 * URL in your Discord application settings. Navigate to the Discord Developer Portal,
 * select your application, and go to the General Information section. Paste the
 * Interactions Endpoint URL (provided in your ChatBotKit integration settings) into
 * the "Interactions Endpoint URL" field and save the changes.
 *
 * This endpoint receives webhook events from Discord whenever users invoke your bot's
 * slash commands. Discord will verify the endpoint by sending a PING interaction, which
 * ChatBotKit automatically handles by responding with a PONG. This verification must
 * succeed before Discord allows your bot to receive interaction events.
 *
 * ## Common Setup Issues and Solutions
 *
 * **Issue: Slash command not appearing in Discord**
 * - Solution: Run the setup endpoint to register commands. Discord may cache command
 *   lists, so you might need to restart your Discord client or wait a few minutes for
 *   commands to appear. In some cases, leaving and rejoining the server can refresh
 *   the command list.
 *
 * **Issue: "Invalid application command" error**
 * - Solution: This typically indicates the Interactions Endpoint URL is not configured
 *   correctly in the Discord Developer Portal. Verify the URL is copied exactly as shown
 *   in your ChatBotKit integration settings and that you've saved the Discord application
 *   settings. Run the setup endpoint again after correcting the URL.
 *
 * **Issue: Signature verification failures**
 * - Solution: Ensure the Public Key in your ChatBotKit integration matches exactly with
 *   the Public Key shown in your Discord application settings. Any mismatch will cause
 *   Discord to reject webhook verifications. Update the Public Key if needed and run
 *   the setup endpoint again.
 *
 * **Warning:** The setup process will attempt to delete all existing slash commands for your
 * Discord application before registering the new command. If individual deletions fail, setup
 * continues and the new command will still be registered. However, if you have multiple bots
 * or commands configured outside of ChatBotKit, they may persist alongside the new command.
 * Ensure you're using dedicated Discord applications for ChatBotKit integrations to avoid
 * conflicts.
 *
 * For troubleshooting other issues, check the Event Log in your Discord integration
 * settings, which provides detailed records of all webhook interactions and error
 * messages. This log is invaluable for diagnosing configuration problems and API
 * communication failures.
 */
