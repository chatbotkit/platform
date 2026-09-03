// @ts-check
import { buf2str } from '@chatbotkit-dev/buffer'

import prisma from '@/prisma/client'

import debug, { warn } from '@/lib/debug'
import { logEvent } from '@/lib/log'
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
import { validateWhatsAppRequest } from '@/lib/whatsapp.signature'

import { sendEvent } from '@/pages/api/v1/integration/whatsapp/[whatsappIntegrationId]/queue'

export default withAny(async function (req) {
  const whatsappIntegration = await prisma.whatsappIntegration.findUnique({
    where: {
      id: requiredUrlParam(req, 'whatsappIntegrationId'),
    },
  })

  if (!whatsappIntegration) {
    return notFound()
  }

  let body

  if (req.method === 'GET') {
    body = {}
  } else {
    const rawBody = buf2str(await req.arrayBuffer())

    // @note signature validation is opt-in: Meta signs every notification with
    // the app secret, but we only enforce it once a secret has been configured.
    // Integrations created before the app secret existed keep receiving
    // messages, and validation kicks in the moment a secret is set. Mirrors the
    // bypass-when-unset behaviour of the github event webhook.

    if (whatsappIntegration.appSecret) {
      try {
        await validateWhatsAppRequest(
          req,
          rawBody,
          whatsappIntegration.appSecret
        )
      } catch {
        await logEvent({
          user: { id: whatsappIntegration.userId },
          type: 'integration.whatsapp.configuration.error',
          relations: {
            blueprintId: whatsappIntegration.blueprintId,
            botId: whatsappIntegration.botId,
            whatsappIntegrationId: whatsappIntegration.id,
          },
          meta: {
            status: NOT_AUTHORIZED_STATUS,
            reason: 'There is a signature verification error.',
          },
        })

        return notAuthorized()
      }
    } else {
      warn(
        `missing app secret for whatsapp integration - bypassing validation`
      ).log('integration.whatsapp.callback.withAny')
    }

    try {
      body = JSON.parse(rawBody)
    } catch {
      return notAuthorized()
    }
  }

  debug(`received callback`, { body }).log(
    'integration.whatsapp.callback.withAny'
  )

  const {
    'hub.mode': mode,
    'hub.verify_token': verifyToken,
    'hub.challenge': challenge,
  } = Object.fromEntries(getQuery(req))

  // handle subscription

  if (mode === 'subscribe') {
    if (verifyToken === whatsappIntegration.verifyToken) {
      // we need to return the challenge raw hence why not using ok method

      await logEvent({
        user: { id: whatsappIntegration.userId },
        type: 'integration.whatsapp.callback.subscribe',
        relations: {
          blueprintId: whatsappIntegration.blueprintId,
          botId: whatsappIntegration.botId,
          whatsappIntegrationId: whatsappIntegration.id,
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
        user: { id: whatsappIntegration.userId },
        type: 'integration.whatsapp.callback.subscribe',
        relations: {
          blueprintId: whatsappIntegration.blueprintId,
          botId: whatsappIntegration.botId,
          whatsappIntegrationId: whatsappIntegration.id,
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
      user: { id: whatsappIntegration.userId },
      type: 'integration.whatsapp.callback.notification',
      relations: {
        blueprintId: whatsappIntegration.blueprintId,
        botId: whatsappIntegration.botId,
        whatsappIntegrationId: whatsappIntegration.id,
      },
      meta: {
        // @todo add more information
      },
    })

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        // handle messages

        if (
          change.field === 'messages' &&
          Array.isArray(change.value?.messages) &&
          change.value.messages.length > 0
        ) {
          await sendEvent(whatsappIntegration.id, {
            type: 'interact',
            payload: change.value,
          })
        }
      }
    }
  }

  // default handler

  return ok()
})

// @note required because we need the exact raw body for signature validation
export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * @manual WhatsApp Integration
 *
 * ## Webhook Callbacks and Event Handling
 *
 * The callback endpoint receives webhook notifications from Meta's WhatsApp
 * Business API, processing incoming messages, status updates, and system
 * events. This endpoint serves as the bridge between WhatsApp's messaging
 * infrastructure and your ChatBotKit conversational AI.
 *
 * Meta sends webhook events to this endpoint whenever users send messages
 * to your WhatsApp Business number or when message status changes occur.
 * The endpoint handles both webhook verification (during initial setup) and
 * ongoing event processing (during normal operation).
 *
 * ### Webhook Verification Process
 *
 * When setting up webhooks in the Meta Developer Portal, Meta verifies
 * endpoint ownership by sending a GET request with a challenge string.
 * Your integration's verify token must match for successful verification:
 *
 * ```http
 * GET /api/v1/integration/whatsapp/{whatsappIntegrationId}/callback?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
 * ```
 *
 * If the verify token matches, the endpoint returns the challenge string
 * and verification completes. Token mismatches return a 403 error.
 *
 * ### Message Event Processing
 *
 * During normal operation, Meta sends POST requests with message events
 * when users interact with your WhatsApp Business number. The endpoint
 * receives these events and queues them for asynchronous processing,
 * ensuring fast webhook responses and preventing timeouts.
 *
 * ### Supported Event Types
 *
 * **Text Messages**: User-sent text messages are extracted and queued for
 * processing by the conversational AI engine.
 *
 * **Media Messages**: Images, videos, documents, and other media types are
 * processed and stored as attachments if the integration has attachments
 * enabled.
 *
 * **Status Updates**: Message delivery status, read receipts, and other
 * status changes are logged for monitoring purposes.
 *
 * **System Messages**: Account notifications and system events are captured
 * in event logs for troubleshooting and auditing.
 *
 * ### Webhook Security
 *
 * **Verify Token Validation**: Every webhook verification request must
 * include the correct verify token. Mismatched tokens result in verification
 * failure.
 *
 * **HTTPS Required**: Meta requires webhook endpoints to use HTTPS. The
 * ChatBotKit platform handles SSL/TLS termination automatically.
 *
 * **Request Validation**: Meta signs notification request bodies with the app
 * secret. When an app secret is configured on the integration, the callback
 * validates `X-Hub-Signature-256` before parsing or queueing any event.
 * Integrations without an app secret are processed without signature
 * validation, so enabling it is a non-breaking, opt-in hardening step.
 *
 * **Rate Limiting**: The endpoint is designed to handle high webhook volumes,
 * with message processing happening asynchronously to prevent backpressure.
 *
 * ### Webhook Troubleshooting
 *
 * **Verification Failures**: If webhook verification fails, verify that:
 * - The verify token in Meta Developer Portal exactly matches your
 * integration's verify token (case-sensitive)
 * - The callback URL is correctly formatted and points to your integration ID
 * - Your integration exists and hasn't been deleted
 *
 * **Message Processing Issues**: If messages aren't being processed:
 * - Check event logs for webhook delivery confirmations
 * - Verify that the "messages" field is subscribed in Meta webhook configuration
 * - Ensure your access token has the required permissions
 * - Confirm that the phone number ID matches your integration configuration
 *
 * **Timeout Errors**: If Meta reports webhook timeouts:
 * - The endpoint uses asynchronous processing to maintain fast response times
 * - Check for platform-wide performance issues if timeouts persist
 * - Review event logs for processing bottlenecks
 *
 * ### Event Monitoring and Debugging
 *
 * All webhook events are logged to the platform's event system, providing
 * visibility into:
 *
 * - Webhook verification attempts and their outcomes
 * - Message reception and processing status
 * - Error conditions and failure reasons
 * - Event payloads for detailed debugging
 *
 * Monitor these logs through the ChatBotKit dashboard or API to ensure
 * your WhatsApp integration is operating correctly and to troubleshoot
 * issues quickly when they arise.
 */
