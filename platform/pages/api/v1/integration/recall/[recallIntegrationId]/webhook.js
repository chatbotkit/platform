// @ts-check
import prisma from '@/prisma/client'

import debug, { warn } from '@/lib/debug'
import { getHeader } from '@/lib/header'
import { logEvent } from '@/lib/log'
import { withAny } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { verifyRecallSignature } from '@/lib/recall.signature'
import { notAuthorized, notFound, ok } from '@/lib/response'

import { FINALISE_EVENT_TYPE, sendEvent } from './queue'

// --- Consts ---

// @note Recall bot status change event we react to. The bot has left the call
// at this point, so the webhook only enqueues server-side finalisation.
const RECALL_BOT_CALL_ENDED_EVENT = 'bot.call_ended'

// --- Helpers ---

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Parses the webhook body. Recall sends JSON; we accept anything that parses
 * and return an empty object otherwise so we can short-circuit cleanly.
 *
 * @param {string} body
 * @returns {Record<string, unknown>}
 */
function parseWebhookBody(body) {
  if (!body) {
    return {}
  }

  try {
    const parsed = JSON.parse(body)

    return isObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// --- Handler ---

export default withAny(async function (req) {
  const recallIntegrationId = requiredUrlParam(req, 'recallIntegrationId')

  const recallIntegration = await prisma.recallIntegration.findUnique({
    where: {
      id: recallIntegrationId,
    },
  })

  if (!recallIntegration) {
    return notFound()
  }

  const body = await req.text()

  debug('received recall webhook', {
    recallIntegrationId,
    bodyLength: body.length,
  }).log('integration.recall.webhook.handler')

  // authenticate the callback before acting on it
  {
    if (!recallIntegration.webhookSecret) {
      // @note an integration configured without the endpoint's signing secret
      // cannot be verified. Refusing would break a working integration, so the
      // bypass is taken and logged rather than hidden.
      warn(
        `recall webhook accepted WITHOUT signature verification - no webhook secret is configured`
      ).log('integration.recall.webhook.handler')
    } else {
      const verified = await verifyRecallSignature({
        rawBody: body,
        svixId: getHeader(req, 'svix-id', 'webhook-id'),
        svixTimestamp: getHeader(req, 'svix-timestamp', 'webhook-timestamp'),
        svixSignature: getHeader(req, 'svix-signature', 'webhook-signature'),
        webhookSecret: recallIntegration.webhookSecret,
      })

      if (!verified) {
        warn('recall signature validation failed').log(
          'integration.recall.webhook.handler'
        )

        await logEvent({
          user: { id: recallIntegration.userId },
          type: 'integration.recall.configuration.error',
          relations: {
            blueprintId: recallIntegration.blueprintId,
            botId: recallIntegration.botId,
          },
          meta: { reason: 'There is a signature verification error.' },
        })

        return notAuthorized()
      }

      debug('recall signature validation passed').log(
        'integration.recall.webhook.handler'
      )
    }
  }

  const payload = parseWebhookBody(body)

  const event = typeof payload.event === 'string' ? payload.event : ''

  // We only act on call-ended. Every other bot status event is acked with 200
  // so Recall doesn't retry - but we still ignore it here.
  if (event !== RECALL_BOT_CALL_ENDED_EVENT) {
    debug('ignoring recall webhook event', {
      recallIntegrationId,
      event: event || '(missing)',
    }).log('integration.recall.webhook.handler')

    return ok()
  }

  const bot = isObject(payload.bot) ? payload.bot : {}
  const data = isObject(payload.data) ? payload.data : {}
  const metadata = isObject(bot.metadata) ? bot.metadata : {}

  const recallBotId = typeof bot.id === 'string' ? bot.id : ''

  const sessionId =
    typeof metadata.sessionId === 'string' ? metadata.sessionId : ''

  // @note the bot carries the integration it was created for in its metadata
  // (see recall.bot.ts). A delivery whose metadata names a different
  // integration is not ours to act on, whatever url it arrived at.
  if (
    typeof metadata.recallIntegrationId === 'string' &&
    metadata.recallIntegrationId !== recallIntegrationId
  ) {
    debug('recall webhook metadata names a different integration', {
      recallIntegrationId,
      metadataIntegrationId: metadata.recallIntegrationId,
    }).log('integration.recall.webhook.handler')

    return ok()
  }

  const subCode = typeof data.sub_code === 'string' ? data.sub_code : ''

  if (!sessionId) {
    debug('recall webhook missing sessionId metadata', {
      recallIntegrationId,
      recallBotId,
    }).log('integration.recall.webhook.handler')

    return ok()
  }

  await sendEvent(recallIntegrationId, {
    type: FINALISE_EVENT_TYPE,
    payload: {
      sessionId,

      ...(recallBotId ? { recallBotId } : null),
      ...(subCode ? { subCode } : null),
    },
  })

  debug('queued recall meeting finalisation', {
    recallIntegrationId,
    sessionId,
    recallBotId,
    subCode,
  }).log('integration.recall.webhook.handler')

  return ok()
})

// @note required because we need the exact raw body for signature validation
// (the Svix signature is computed over the exact bytes Recall sent). Without
// this Next's body parser consumes the stream first and the handler sees a
// re-serialised copy - which the Slack and WhatsApp siblings already guard
// against the same way.
export const config = {
  api: {
    bodyParser: false,
  },
}
