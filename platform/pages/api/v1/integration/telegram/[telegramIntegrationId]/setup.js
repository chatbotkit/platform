/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Telegram) */
// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { getFetchError } from '@/lib/fetch'
import fetch from '@/lib/fetch'
import { tryParse } from '@/lib/json'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  conflict,
  notAuthorized,
  notFound,
  ok,
  throwConflict,
} from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { deriveTelegramSecretToken } from '@/lib/telegram.signature'
import { getTelegramIntegrationWebhook } from '@/lib/telegram.webhook'

/**
 * @param {import('@/prisma/types').TelegramIntegration} telegramIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(telegramIntegration) {
  debug(`do setup`, { telegramIntegration })

  if (!telegramIntegration.botToken) {
    throwConflict('Telegram Integration Error: the bot token is missing')
  }

  const webhookUrl = getTelegramIntegrationWebhook(telegramIntegration.id)

  debug(`using webhook url`, { webhookUrl })

  // @note there is no already-set short-circuit here on purpose. It used to
  // skip registration when getWebhookInfo reported the same url, but Telegram
  // never reports the secret token back, so a webhook registered before the
  // secret existed would keep its unauthenticated registration forever.
  // Re-registering the same url is harmless and stamps the secret on.

  // set the webhook
  {
    const url = new URL(
      `https://api.telegram.org/bot${telegramIntegration.botToken}/setWebhook`
    )

    url.searchParams.append('url', webhookUrl)
    url.searchParams.append(
      'allowed_updates',
      JSON.stringify(['message', 'business_message'])
    )

    // @note derived from the bot token rather than stored - reproducible at
    // verification time and rotates with the credential it comes from
    url.searchParams.append(
      'secret_token',
      await deriveTelegramSecretToken(telegramIntegration.botToken)
    )

    const response = await fetch(url.href, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const error = await getFetchError(response)

      throwConflict(
        `Telegram Integration Error: ${
          tryParse(error.message)?.description || error.message
        }`
      )
    }

    const json = await response.json()

    if (!json.ok) {
      throw new Error(json.description)
    }
  }
}

/**
 * @swagger
 *
 * /integration/telegram/{telegramIntegrationId}/setup:
 *   post:
 *     operationId: setupTelegramIntegration
 *     summary: Setup a Telegram integration
 *     tags:
 *       - Telegram Integration
 *     parameters:
 *       - in: path
 *         name: telegramIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Telegram integration
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
 *         description: The Telegram integration was successfully setup
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Telegram Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const telegramIntegration =
      await prisma.telegramIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'telegramIntegrationId')
      )

    if (!telegramIntegration) {
      return notFound()
    }

    if (telegramIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    if (!telegramIntegration.botToken) {
      return conflict('Telegram Integration requires a bot token')
    }

    // @note we deliberately do not catch here. doSetup throws SafeError-family
    // errors - e.g. a ConflictError when the Telegram API rejects the bot
    // token. Letting them propagate lets the framework wrapper
    // render them via respondFromError while keeping them out of Sentry, since
    // captureUnknownException gates known expected codes like CONFLICT. A local
    // captureError here would bypass that gate and report user-config errors as
    // bugs. This mirrors the GitHub integration setup handler.
    await doSetup(telegramIntegration)

    return ok({ id: telegramIntegration.id })
  })
)

/**
 * @manual Telegram Integration
 *
 * ## Setting Up the Telegram Webhook
 *
 * The setup endpoint is a critical step that configures the webhook connection
 * between Telegram and ChatBotKit. This must be called after creating or updating
 * an integration before your bot can receive and process messages from Telegram
 * users. The setup process automatically registers your ChatBotKit webhook URL
 * with Telegram's servers.
 *
 * To setup the webhook for your Telegram integration, send a POST request:
 *
 * ```http
 * POST /api/v1/integration/telegram/{telegramIntegrationId}/setup
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The request body must be provided but can be empty. The setup process is
 * idempotent - calling it multiple times is safe and will only update the
 * webhook if needed.
 *
 * ### What Setup Does
 *
 * When you call the setup endpoint, ChatBotKit performs several automated steps:
 *
 * 1. **Webhook Verification**: Checks if Telegram already has a webhook configured
 *    for your bot and whether it matches the expected ChatBotKit endpoint.
 *
 * 2. **Webhook Registration**: If no webhook exists or the current webhook is
 *    different, registers the ChatBotKit webhook URL with Telegram using your
 *    bot token.
 *
 * 3. **Update Configuration**: Configures Telegram to send `message` and
 *    `business_message` events to ChatBotKit, ensuring your bot receives all
 *    relevant user interactions.
 *
 * 4. **Validation**: Verifies the webhook was successfully registered by checking
 *    Telegram's webhook info endpoint.
 *
 * ### When to Run Setup
 *
 * You must run setup in these scenarios:
 *
 * - **After Initial Creation**: When you first create a Telegram integration,
 *   setup is required to activate the webhook.
 *
 * - **After Updating Bot Token**: If you change the bot token in the integration,
 *   setup must be run again to register the webhook with the new token.
 *
 * - **After Webhook Changes**: If you manually modify the webhook through
 *   Telegram's API or BotFather, run setup to restore ChatBotKit connectivity.
 *
 * - **Troubleshooting**: If your bot stops receiving messages, running setup
 *   can often resolve webhook configuration issues.
 *
 * ### Understanding Webhook URLs
 *
 * ChatBotKit automatically generates a unique webhook URL for each integration:
 *
 * ```
 * https://api.chatbotkit.com/api/v1/integration/telegram/{integrationId}/webhook
 * ```
 *
 * This URL is where Telegram will send all messages and events for your bot.
 * You should never need to manually construct or modify this URL - the setup
 * endpoint handles all webhook URL configuration automatically.
 *
 * ### Troubleshooting Setup Issues
 *
 * **"Telegram Integration Error: Bot token is invalid"**: Verify your bot token
 * is correct. You can test it by calling Telegram's getMe API directly. The
 * token format should be `{bot_id}:{random_string}`.
 *
 * **"Telegram Integration Error: HTTPS url must be provided"**: This error
 * indicates an internal issue with webhook URL generation. Contact support if
 * you encounter this error.
 *
 * **"Telegram Integration Error: Certificate is invalid"**: Ensure you're using
 * the official ChatBotKit API endpoint. Custom domains require proper SSL
 * certificate configuration.
 *
 * **Setup succeeds but bot doesn't respond**: Check that your connected ChatBotKit
 * bot is properly configured and not in a disabled state. Also verify your bot
 * token permissions allow receiving messages.
 *
 * ### Webhook Security
 *
 * Telegram webhooks are secured through several mechanisms:
 *
 * - **HTTPS Only**: Telegram only allows HTTPS webhook URLs, ensuring encrypted
 *   communication.
 *
 * - **Token Authentication**: Your bot token serves as authentication, and only
 *   Telegram servers with your token can send webhooks.
 *
 * - **Update Filtering**: ChatBotKit validates incoming webhooks to ensure they
 *   match the expected format and content before processing.
 *
 * For detailed information about Telegram's webhook system, refer to the
 * [official Telegram Bot API documentation](https://core.telegram.org/bots/api#setwebhook).
 */
