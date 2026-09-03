// @ts-check
import prisma from '@/prisma/client'

import debug, { warn } from '@/lib/debug'
import { getHeader } from '@/lib/header'
import { logEvent } from '@/lib/log'
import { verifyMetaSignature } from '@/lib/meta.signature'
import { withAny } from '@/lib/method'
import { getQuery, requiredUrlParam } from '@/lib/query.get'
import {
  NOT_AUTHORIZED_STATUS,
  OK_STATUS,
  notAuthorized,
  notFound,
  ok,
  send,
} from '@/lib/response'

import { sendEvent } from '@/pages/api/v1/integration/messenger/[messengerIntegrationId]/queue'

export default withAny(async function (req) {
  const messengerIntegration = await prisma.messengerIntegration.findUnique({
    where: {
      id: requiredUrlParam(req, 'messengerIntegrationId'),
    },
  })

  if (!messengerIntegration) {
    return notFound()
  }

  let body

  if (req.method === 'GET') {
    body = {}
  } else {
    // @note the signature covers the exact bytes Meta sent, so the raw body is
    // read first and parsed only after verification
    const rawBody = await req.text()

    // authenticate the callback before acting on it
    {
      if (!messengerIntegration.appSecret) {
        // @note an integration configured without the app secret cannot be
        // verified. Refusing it would break a working integration, so the
        // bypass is taken and logged rather than hidden.
        warn(
          `messenger callback accepted WITHOUT signature verification - no app secret is configured`
        ).log('integration.messenger.callback.withAny')
      } else {
        const verified = await verifyMetaSignature({
          rawBody,
          header: getHeader(req, 'x-hub-signature-256'),
          appSecret: messengerIntegration.appSecret,
        })

        if (!verified) {
          warn(`messenger signature validation failed`).log(
            'integration.messenger.callback.withAny'
          )

          await logEvent({
            user: { id: messengerIntegration.userId },
            type: 'integration.messenger.configuration.error',
            relations: {
              messengerIntegrationId: messengerIntegration.id,
            },
            meta: {
              status: NOT_AUTHORIZED_STATUS,
              reason: 'There is a signature verification error.',
            },
          })

          return notAuthorized()
        }

        debug(`messenger signature validation passed`).log(
          'integration.messenger.callback.withAny'
        )
      }
    }

    try {
      body = JSON.parse(rawBody)
    } catch {
      body = {}
    }
  }

  debug(`received callback`, { body }).log(
    'integration.messenger.callback.withAny'
  )

  const {
    'hub.mode': mode,
    'hub.verify_token': verifyToken,
    'hub.challenge': challenge,
  } = Object.fromEntries(getQuery(req))

  // handle subscription

  if (mode === 'subscribe') {
    if (verifyToken === messengerIntegration.verifyToken) {
      // we need to return the challenge raw hence why not using ok method

      await logEvent({
        user: { id: messengerIntegration.userId },
        type: 'integration.messenger.callback.subscribe',
        relations: {
          blueprintId: messengerIntegration.blueprintId,
          botId: messengerIntegration.botId,
          messengerIntegrationId: messengerIntegration.id,
        },
        meta: {
          status: OK_STATUS,
          reason: 'OK',
        },
      })

      return send(challenge)
    } else {
      // otherwise return unauthorized

      await logEvent({
        user: { id: messengerIntegration.userId },
        type: 'integration.messenger.callback.subscribe',
        relations: {
          blueprintId: messengerIntegration.blueprintId,
          botId: messengerIntegration.botId,
          messengerIntegrationId: messengerIntegration.id,
        },
        meta: {
          status: NOT_AUTHORIZED_STATUS,
          reason: 'Verification token does not match.',
        },
      })

      return notAuthorized()
    }
  }

  // handle entries

  if (Array.isArray(body?.entry)) {
    await logEvent({
      user: { id: messengerIntegration.userId },
      type: 'integration.messenger.callback.notification',
      relations: {
        blueprintId: messengerIntegration.blueprintId,
        botId: messengerIntegration.botId,
        messengerIntegrationId: messengerIntegration.id,
      },
      meta: {
        // @todo add more information
      },
    })

    for (const entry of body.entry) {
      const { messaging = [] } = entry

      for (const item of messaging) {
        // @note queue handler only supports message and postback payloads
        if (!item.message && !item.postback) {
          debug(`skipping unsupported event shape`, {
            keys: Object.keys(item || {}),
          }).log('integration.messenger.callback.withAny')

          continue
        }

        // @note Skip echo messages (messages sent by our own bot) to prevent
        // processing loops. Meta sends webhook notifications for all messages
        // including those sent by our integration.
        if (item.message?.is_echo) {
          debug(`skipping echo message`, { item }).log(
            'integration.messenger.callback.withAny'
          )

          continue
        }

        // @note Skip deleted messages - they contain no actionable content
        if (item.message?.is_deleted) {
          debug(`skipping deleted message`, { item }).log(
            'integration.messenger.callback.withAny'
          )

          continue
        }

        // @note Skip unsupported message types (stickers, gifs not supported by Meta)
        if (item.message?.is_unsupported) {
          debug(`skipping unsupported message`, { item }).log(
            'integration.messenger.callback.withAny'
          )

          continue
        }

        await sendEvent(messengerIntegration.id, {
          type: 'interact',
          payload: item,
        })
      }
    }
  }

  // default handler

  return ok()
})

// @note required because we need the exact raw body for signature validation
// (X-Hub-Signature-256 is computed over the exact bytes Meta sent). Without
// this Next's body parser consumes the stream first and the handler sees a
// re-serialised copy - which the Slack and WhatsApp siblings already guard
// against the same way.
export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * @manual Messenger Integration
 *
 * ## Webhook Event Handling and Verification
 *
 * The callback endpoint serves as the webhook receiver for Facebook Messenger
 * events, handling both the initial webhook verification process required by
 * Facebook and the ongoing stream of message events sent whenever users interact
 * with your bot. This endpoint is the bridge between Facebook's Messenger
 * platform and ChatBotKit's conversation processing system, ensuring reliable,
 * real-time message delivery and bot response handling.
 *
 * Facebook's webhook system requires a two-step verification process before
 * sending live events. First, Facebook sends a GET request to your callback URL
 * with verification parameters including `hub.mode` set to "subscribe",
 * `hub.verify_token` containing the token you provided during webhook setup,
 * and `hub.challenge` containing a random string that must be returned exactly
 * as received to complete verification. ChatBotKit automatically handles this
 * verification by comparing the provided token with your integration's verify
 * token and returning the challenge response when they match.
 *
 * Once verified, Facebook begins sending POST requests containing message events,
 * postback events, and other user interactions. Each webhook payload contains
 * an array of entry objects, with each entry containing a messaging array that
 * holds individual user interactions. The callback endpoint processes these
 * events by queuing them for asynchronous processing, ensuring fast response
 * times and preventing webhook timeouts even when handling complex bot logic
 * or external API calls.
 *
 * The callback URL you configure in Facebook's Developer Portal must match this
 * endpoint exactly. The URL format is:
 *
 * ```
 * https://api.chatbotkit.com/api/v1/integration/messenger/{messengerIntegrationId}/callback
 * ```
 *
 * Replace `{messengerIntegrationId}` with your actual integration ID from
 * ChatBotKit. This URL must be publicly accessible and support both GET (for
 * verification) and POST (for events) requests. Facebook requires HTTPS with
 * a valid SSL certificate and will reject webhooks using self-signed certificates
 * or plain HTTP connections.
 *
 * **Webhook Configuration Steps:**
 *
 * 1. Navigate to your Facebook App in the Developer Portal
 * 2. Select Messenger from the products list
 * 3. Click "Setup Webhooks" in the Webhooks section
 * 4. Enter your callback URL with the integration ID
 * 5. Enter the verify token from your integration's fetch response
 * 6. Subscribe to webhook events: `messages`, `messaging_postbacks`, and optionally `message_deliveries` and `message_reads`
 * 7. Click "Verify and Save" to complete the webhook configuration
 *
 * **Event Processing:** The callback endpoint immediately acknowledges webhook
 * deliveries with a 200 OK response to prevent Facebook from marking deliveries
 * as failed and implementing exponential backoff. Events are then queued for
 * asynchronous processing, where conversation engines handle message routing,
 * bot response generation, session management, and context tracking. This
 * architecture ensures webhook responses stay within Facebook's strict timeout
 * requirements while allowing complex bot logic to execute without constraints.
 */
