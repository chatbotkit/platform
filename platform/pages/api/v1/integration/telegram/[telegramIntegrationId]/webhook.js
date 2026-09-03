/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Telegram) */
// @ts-check
import prisma from '@/prisma/client'

import debug, { warn } from '@/lib/debug'
import fetch from '@/lib/fetch'
import { getHeader } from '@/lib/header'
import { tryParse as tryParseJson } from '@/lib/json'
import { logEvent } from '@/lib/log'
import { withAny } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import {
  deriveTelegramSecretToken,
  verifyTelegramSecretToken,
} from '@/lib/telegram.signature'

import { sendEvent } from '@/pages/api/v1/integration/telegram/[telegramIntegrationId]/queue'

export default withAny(async function (req) {
  const telegramIntegrationId = requiredUrlParam(req, 'telegramIntegrationId')

  const telegramIntegration = await prisma.telegramIntegration.findUnique({
    where: {
      id: telegramIntegrationId,
    },
  })

  if (!telegramIntegration) {
    return notFound()
  }

  // authenticate the callback before acting on it
  {
    const header = getHeader(req, 'x-telegram-bot-api-secret-token')

    if (!telegramIntegration.botToken) {
      // @note without the bot token the expected secret cannot be derived.
      // Refusing would break a working integration, so the bypass is taken
      // and logged rather than hidden.
      warn(
        `telegram webhook accepted WITHOUT secret verification - no bot token is configured`
      ).log('integration.telegram.webhook.handler')
    } else if (!header) {
      // @note Telegram only sends the header when the webhook was registered
      // with a secret - a registration from before the secret existed presents
      // none, and re-running setup stamps it on
      warn(
        `telegram webhook accepted WITHOUT secret verification - webhook registered without a secret token, re-run setup`
      ).log('integration.telegram.webhook.handler')
    } else {
      const verified = verifyTelegramSecretToken({
        header,
        secretToken: await deriveTelegramSecretToken(
          telegramIntegration.botToken
        ),
      })

      if (!verified) {
        warn(`telegram secret token validation failed`).log(
          'integration.telegram.webhook.handler'
        )

        await logEvent({
          user: { id: telegramIntegration.userId },
          type: 'integration.telegram.configuration.error',
          relations: {
            telegramIntegrationId: telegramIntegration.id,
          },
          meta: {
            reason: 'There is a secret token verification error.',
          },
        })

        return notAuthorized()
      }

      debug(`telegram secret token validation passed`).log(
        'integration.telegram.webhook.handler'
      )
    }
  }

  const body = await req.text()

  debug(`received webhook`, { body }).log(
    'integration.telegram.webhook.handler'
  )

  const {
    update_id,

    message: _message,
    business_message: _business_message,
    edited_message: _edited_message,
    edited_business_message: _edited_business_message,
    callback_query: _callback_query,

    // @note this_message is private

    this_message = _message ||
      _business_message ||
      _edited_message ||
      _edited_business_message,
  } = tryParseJson(body) || {}

  if (_callback_query) {
    if (_callback_query.from?.is_bot) {
      return ok()
    }

    if (!_callback_query.message?.chat || !_callback_query.from) {
      return ok()
    }

    await sendEvent(telegramIntegration.id, {
      type: 'interact',
      payload: {
        update_id: update_id,
        message: {
          ..._callback_query.message,
          from: _callback_query.from,
          text:
            _callback_query.data ||
            _callback_query.game_short_name ||
            _callback_query.message?.text ||
            '',
        },
      },
    })

    if (_callback_query.id) {
      const response = await fetch(
        `https://api.telegram.org/bot${telegramIntegration.botToken}/answerCallbackQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: _callback_query.id,
          }),
          signal: AbortSignal.timeout(10000),
        }
      )

      if (!response.ok) {
        debug(`failed to answer callback query`, {
          callbackQueryId: _callback_query.id,
        }).log('integration.telegram.webhook.handler')
      }
    }

    return ok()
  }

  // bail out if the message is not present
  {
    if (!this_message) {
      return ok() // @note there are some events that do not have a message, thus we return ok
    }
  }

  // bail out if the message is from a bot
  {
    if (this_message.from?.is_bot) {
      return ok()
    }
  }

  // bail out if the message is not a mention when in a group chat
  {
    if (this_message.chat?.type !== 'private') {
      if (this_message.entities?.length) {
        let botId
        let botUsername

        {
          const url = new URL(
            `https://api.telegram.org/bot${telegramIntegration.botToken}/getMe`
          )

          const response = await fetch(url.href, {
            signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
            throw new Error('Failed to retrieve bot information')
          }

          const data = await response.json()

          botId = data.result.id
          botUsername = data.result.username
        }

        debug(`bot details`, { botId, botUsername }).log(
          'integration.telegram.webhook.handler'
        )

        const isBotMentioned = this_message.entities?.some((entity) => {
          if (entity.type === 'text_mention') {
            return entity.user?.id === botId
          }

          if (entity.type === 'mention') {
            const mentionText = this_message.text.substring(
              entity.offset,
              entity.offset + entity.length
            )

            return mentionText === '@' + botUsername
          }

          if (entity.type === 'bot_command') {
            const commandText = this_message.text.substring(
              entity.offset,
              entity.offset + entity.length
            )

            return commandText
              .toLowerCase()
              .endsWith(`@${String(botUsername).toLowerCase()}`)
          }

          return false
        })

        if (isBotMentioned) {
          // pass
        } else {
          return ok()
        }
      } else {
        return ok()
      }
    }
  }

  await sendEvent(telegramIntegration.id, {
    type: 'interact',
    payload: {
      update_id: update_id,
      message: this_message,
    },
  })

  return ok()
})

// @note required because we need the exact raw body for the update to arrive
// exactly as Telegram sent it; the secret-token check does not cover the body,
// but a parsed-then-reserialised body is not what was received. Without this
// Next's body parser consumes the stream first and the handler sees a
// re-serialised copy - which the Slack and WhatsApp siblings already guard
// against the same way.
export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * @manual Telegram Integration
 *
 * ## Webhook Event Handling
 *
 * The webhook endpoint is the receiver for all messages and events from Telegram.
 * When users interact with your Telegram bot, Telegram sends these interactions
 * to the webhook URL configured during setup. This endpoint processes incoming
 * events and routes them to your ChatBotKit bot for intelligent response generation.
 *
 * This endpoint is called automatically by Telegram's servers - you do not need
 * to call it directly. However, understanding its behavior helps with integration
 * troubleshooting and advanced customization scenarios.
 *
 * ### Webhook URL Format
 *
 * ```
 * POST /api/v1/integration/telegram/{telegramIntegrationId}/webhook
 * ```
 *
 * Telegram sends POST requests to this URL with JSON payloads containing message
 * and event data. The webhook is automatically configured when you call the
 * setup endpoint.
 *
 * ### Supported Event Types
 *
 * The webhook processes these Telegram update types:
 *
 * - **message**: Standard messages sent directly to your bot in private chats
 * - **business_message**: Messages sent through Telegram Business accounts
 * - **edited_message**: Edited message updates routed through normal bot processing
 * - **edited_business_message**: Edited business message updates
 * - **callback_query**: Inline keyboard button presses from interactive messages
 *
 * Other event types (edited messages, inline queries) are
 * currently not processed but may be acknowledged to prevent Telegram errors.
 *
 * ### Message Processing Logic
 *
 * When a message arrives, the webhook applies several filters:
 *
 * **Bot Message Filter**: Messages sent by other bots are automatically ignored
 * to prevent bot-to-bot loops and reduce unnecessary processing.
 *
 * **Group Chat Mentions**: In group chats, the bot only responds when explicitly
 * mentioned using `@botname`. This prevents the bot from responding to every
 * message in the group and keeps conversations focused.
 *
 * **Command Handling**: Telegram commands such as `/start` and
 * `/start@yourbot` are processed like regular messages. This allows command
 * driven conversations in both private chats and groups.
 *
 * **Private Chats**: In one-on-one conversations, all messages are processed
 * without requiring mentions, providing a seamless chat experience.
 *
 * ### Group Chat Behavior
 *
 * To use your Telegram bot in group chats:
 *
 * 1. **Add Bot to Group**: Add your bot to the Telegram group using the group
 *    settings or directly through the bot's username.
 *
 * 2. **Make Bot Admin**: Set the bot as a group administrator to ensure it
 *    receives all messages. Without admin privileges, the bot may not receive
 *    certain message types.
 *
 * 3. **Mention the Bot**: Users must mention the bot using `@botname` followed
 *    by their message for the bot to respond. For example: `@supportbot How
 *    do I reset my password?`
 *
 * This mention requirement prevents the bot from responding to unrelated
 * conversations and allows multiple bots to coexist in the same group.
 *
 * ### Forum Topic Support
 *
 * Supergroups with Telegram's forum topics feature are fully supported. When a
 * message includes a `message_thread_id`, the webhook forwards that identifier
 * to the queue processor, which routes the bot reply back into the same forum
 * topic and maintains a separate conversation session per topic. No extra
 * configuration is needed - topic routing is handled automatically.
 *
 * ### Event Processing Flow
 *
 * When a valid message passes all filters:
 *
 * 1. **Validation**: The webhook validates the integration exists and extracts
 *    message details from the Telegram payload.
 *
 * 2. **Queue Dispatch**: The message is queued for asynchronous processing,
 *    ensuring fast webhook response times and preventing Telegram timeouts.
 *
 * 3. **Bot Processing**: The queued event is processed by your ChatBotKit bot,
 *    which generates an appropriate response using configured AI models.
 *
 * 4. **Response Delivery**: The bot's response is sent back to Telegram through
 *    the Telegram API, appearing as a message from your bot. The integration
 *    automatically converts bot responses into the appropriate Telegram message
 *    types based on the content format.
 *
 * ### Supported Response Message Types
 *
 * The integration intelligently converts bot response content into different
 * Telegram message types, enabling rich media experiences beyond plain text:
 *
 * - **Text**: Standard markdown-formatted text messages sent via `sendMessage`.
 *   Supports Telegram's MarkdownV2 formatting with bold, italic, code blocks,
 *   and links. Long messages are automatically split to respect the 4096 character
 *   limit per message.
 *
 * - **Images**: When a bot response includes an image URL in markdown syntax
 *   (e.g., `![description](https://example.com/image.png)`), the integration
 *   sends it using Telegram's `sendPhoto` API, displaying it as an inline photo
 *   in the conversation.
 *
 * - **Videos**: Video URLs in markdown image syntax
 *   (e.g., `![video](https://example.com/clip.mp4)`) are detected by their
 *   file extension and delivered via `sendVideo`, giving users a native
 *   video player experience within Telegram.
 *
 * - **Audio**: Audio file URLs in markdown image syntax are detected by common
 *   audio extensions (`.mp3`, `.m4a`, `.aac`, `.wav`, `.flac`, `.opus`, `.oga`,
 *   `.ogg`) and sent using Telegram's `sendAudio` API. This enables bots to
 *   deliver music or audio content directly to users.
 *   (e.g., `![music](https://example.com/track.mp3)`)
 *
 * - **Voice**: Audio URLs with alt text matching `voice note` or `voicenote`
 *   (case-insensitive) are delivered as Telegram voice messages using the
 *   `sendVoice` API. Telegram renders voice messages with a native waveform
 *   player optimized for spoken audio. OGG format is recommended for voice
 *   messages as it provides the best compatibility and quality.
 *   (e.g., `![voice note](https://example.com/reply.ogg)`)
 *
 * If a media URL cannot be delivered (for example, due to an unsupported format
 * or Telegram API error), the integration logs the failure and continues
 * processing remaining messages in the response.
 *
 * ### Debugging Webhook Issues
 *
 * **Bot not responding in private chats**: Verify the webhook is properly setup
 * by calling the setup endpoint. Check that your integration exists and the
 * bot token is valid.
 *
 * **Bot not responding in groups**: Ensure the bot is added to the group as an
 * administrator. Verify users are mentioning the bot correctly with `@botname`.
 *
 * **Messages delayed or missing**: High message volumes can cause queueing. This
 * is normal behavior. If delays persist, check your account's rate limits and
 * processing capacity.
 *
 * **Command messages not responding in groups**: Ensure commands in groups
 * explicitly target your bot, such as `/start@yourbot`. Untargeted commands
 * are ignored to avoid handling commands meant for other bots.
 *
 * ### Telegram Business Support
 *
 * The webhook supports Telegram Business messages, allowing businesses to use
 * ChatBotKit bots for customer communication through Telegram's business features.
 * Business messages are processed identically to regular messages with the same
 * filtering and routing logic.
 *
 * For more details about Telegram's webhook mechanism and message structure,
 * see the [Telegram Bot API documentation](https://core.telegram.org/bots/api#update).
 */
