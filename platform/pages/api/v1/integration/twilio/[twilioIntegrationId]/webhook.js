// @ts-check
import prisma from '@/prisma/client'

import { waitForChannelMessage } from '@/lib/channel.core'
import cuid from '@/lib/cuid'
import debug, { warn } from '@/lib/debug'
import { getHeader } from '@/lib/header'
import { getExternalAPIHostURL } from '@/lib/host'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import { withAny } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { verifyTwilioSignature } from '@/lib/twilio.signature'
import {
  parseTwilioAllowFrom,
  twilioSenderIsAllowed,
} from '@/lib/twilio.validation'

import { sendEvent } from '@/pages/api/v1/integration/twilio/[twilioIntegrationId]/queue'

// --- Consts ---

// @note Twilio expects messaging webhook responses within 15s - we set this
// to 12s in order to give ourselves some buffer to avoid hitting the timeout
const WEBHOOK_RESPONSE_TIMEOUT_MS = 12_000

// @note empty TwiML response used as fallback when no reply is available
const EMPTY_TWIML = '<Response></Response>'

// @note these values are used for confirming delivery of SMS messages
const SMS_DELIVERY_CONFIRMATION_TIMEOUT_MS = 30_000
// @note we set the TTL for delivery confirmation keys to 1 hour in order to
const SMS_DELIVERY_CONFIRMATION_TTL_SECONDS = 60 * 60

// --- Helpers ---

/**
 * @param {string} xml
 * @returns {Response}
 */
function xmlResponse(xml) {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}

/**
 * @param {string} body
 * @returns {URLSearchParams}
 */
function parseTwilioWebhookBody(body) {
  const text = body.trim()

  if (!text) {
    return new URLSearchParams()
  }

  if (text.startsWith('{')) {
    try {
      const data = JSON.parse(text)

      return new URLSearchParams(
        Object.entries(data)
          .filter(([, value]) => value != null)
          .map(([key, value]) => [key, String(value)])
      )
    } catch {
      // @note fall through to form parsing below
    }
  }

  return new URLSearchParams(body)
}

/**
 * @param {{
 *   channelId: string,
 *   timeoutMs: number,
 *   fallbackXml: string,
 *   onDelivered?: () => Promise<void>,
 *   onFailed?: (error: unknown) => Promise<void>,
 * }} options
 * @returns {{ ready: Promise<void>, response: Response }}
 */
function createQueuedXmlResponse({
  channelId,
  timeoutMs,
  fallbackXml,
  onDelivered,
  onFailed,
}) {
  /** @type {() => void} */
  let resolveReady = () => {}

  /** @type {Promise<void>} */
  const ready = new Promise((resolve) => {
    resolveReady = () => resolve(undefined)
  })

  const messagePromise = waitForChannelMessage(channelId, {
    abortSignal: AbortSignal.timeout(timeoutMs),
    onSubscribe: async () => {
      resolveReady()
    },
  })

  const encoder = new TextEncoder()

  messagePromise.catch(() => {
    resolveReady()
  })

  return {
    ready,
    response: new Response(
      new ReadableStream({
        async start(controller) {
          try {
            const message = await messagePromise

            if (onDelivered) {
              await onDelivered()
            }

            controller.enqueue(
              encoder.encode(/** @type {string} */ (message.xml))
            )
          } catch (e) {
            if (onFailed) {
              await onFailed(e)
            }

            controller.enqueue(encoder.encode(fallbackXml))
          } finally {
            controller.close()
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    ),
  }
}

/**
 * @param {{
 *   twilioIntegrationId: string,
 *   userId: string,
 *   messageSid: string,
 *   from?: string,
 *   to?: string,
 *   body?: string,
 * }} options
 * @returns {Promise<Response>}
 */
async function handleSmsWebhook({
  twilioIntegrationId,
  userId,
  messageSid,
  from,
  to,
  body,
}) {
  if (!from) {
    debug(`skipping sms webhook - missing from`, { messageSid }).log(
      'integration.twilio.webhook.handler'
    )

    return ok()
  }

  if (!body) {
    debug(`skipping sms webhook - missing body`, { messageSid, from, to }).log(
      'integration.twilio.webhook.handler'
    )

    return ok()
  }

  const channelId = `twilio-${cuid()}`
  const deliveredKey = `twilio-webhook-delivered-${channelId}`
  const deliveryCheckAt = Date.now() + SMS_DELIVERY_CONFIRMATION_TIMEOUT_MS

  await logEvent({
    user: { id: userId },
    name: 'Twilio SMS Received',
    description: 'An inbound SMS was received through the Twilio integration.',
    type: 'integration.twilio.sms.received',
    relations: {
      twilioIntegrationId,
    },
    meta: {
      from,
      to,
      messageSid,
    },
  })

  debug(`queueing sms webhook`, {
    twilioIntegrationId,
    channelId,
    from,
    to,
    messageSid,
    deliveredKey,
    deliveryCheckAt,
  }).log('integration.twilio.webhook.handler')

  const queuedXml = createQueuedXmlResponse({
    channelId,
    timeoutMs: WEBHOOK_RESPONSE_TIMEOUT_MS,
    fallbackXml: EMPTY_TWIML,
    onDelivered: async () => {
      debug(`sms webhook response delivered through channel`, {
        channelId,
        messageSid,
        deliveredKey,
      }).log('integration.twilio.webhook.handler')

      await memcache.set(deliveredKey, '1', {
        ex: SMS_DELIVERY_CONFIRMATION_TTL_SECONDS,
      })
    },
    onFailed: async (e) => {
      debug(`sms channel wait failed, returning empty TwiML`, {
        e,
        channelId,
        messageSid,
      }).log('integration.twilio.webhook.handler')
    },
  })

  await queuedXml.ready

  await sendEvent(twilioIntegrationId, {
    type: 'interact',
    payload: {
      channelId,
      messageSid,
      from,
      to,
      body,
      deliveredKey,
      deliveryCheckAt,
    },
  })

  return queuedXml.response
}

/**
 * @param {{
 *   twilioIntegrationId: string,
 *   userId: string,
 *   callSid: string,
 *   from?: string,
 *   to?: string,
 * }} options
 * @returns {Promise<Response>}
 */
async function handleVoiceWebhook({
  twilioIntegrationId,
  userId,
  callSid,
  from,
  to,
}) {
  if (!from) {
    debug(`skipping voice webhook - missing from`, { callSid }).log(
      'integration.twilio.webhook.handler'
    )

    return ok()
  }

  const channelId = `twilio-voice-${cuid()}-${cuid()}`

  await logEvent({
    user: { id: userId },
    name: 'Twilio Call Received',
    description: 'An inbound call was received through the Twilio integration.',
    type: 'integration.twilio.call.received',
    relations: {
      twilioIntegrationId,
    },
    meta: {
      from,
      to,
      callSid,
    },
  })

  debug(`queueing voice webhook`, {
    twilioIntegrationId,
    channelId,
    from,
    to,
    callSid,
  }).log('integration.twilio.webhook.handler')

  const queuedXml = createQueuedXmlResponse({
    channelId,
    timeoutMs: WEBHOOK_RESPONSE_TIMEOUT_MS,
    fallbackXml: EMPTY_TWIML,
    onDelivered: async () => {
      debug(`voice webhook response delivered through channel`, {
        channelId,
        callSid,
      }).log('integration.twilio.webhook.handler')
    },
    onFailed: async (e) => {
      debug(`voice channel wait failed, returning empty TwiML`, {
        e,
        channelId,
        callSid,
      }).log('integration.twilio.webhook.handler')
    },
  })

  await queuedXml.ready

  await sendEvent(twilioIntegrationId, {
    type: 'interact',
    payload: {
      channelId,
      callSid,
      from,
      to,
      body: '',
    },
  })

  return queuedXml.response
}

// --- Handler ---

export default withAny(async function (req) {
  const twilioIntegrationId = requiredUrlParam(req, 'twilioIntegrationId')

  const twilioIntegration = await prisma.twilioIntegration.findUnique({
    where: {
      id: twilioIntegrationId,
    },
  })

  if (!twilioIntegration) {
    return notFound()
  }

  const body = await req.text()

  debug(`received webhook`, { body }).log('integration.twilio.webhook.handler')

  const query = parseTwilioWebhookBody(body)

  // authenticate the callback before acting on it
  {
    // @note Twilio signs the PUBLIC callback url it was configured with, not
    // the host this request arrived on - behind a proxy those differ
    const url = getExternalAPIHostURL(
      `/api/v1/integration/twilio/${twilioIntegrationId}/webhook`
    )

    if (!twilioIntegration.authToken) {
      // @note an integration configured before the auth token was captured
      // cannot be verified. Refusing it would break a working integration on
      // upgrade, so the bypass is taken and logged rather than hidden.
      warn(
        `twilio webhook accepted WITHOUT signature verification - no auth token is configured`
      ).log('integration.twilio.webhook.handler')
    } else {
      const verified = await verifyTwilioSignature({
        url,
        params: Object.fromEntries(query),
        header: getHeader(req, 'x-twilio-signature'),
        authToken: twilioIntegration.authToken,
      })

      if (!verified) {
        warn(`twilio signature validation failed`).log(
          'integration.twilio.webhook.handler'
        )

        await logEvent({
          user: { id: twilioIntegration.userId },
          type: 'integration.twilio.configuration.error',
          relations: { twilioIntegrationId },
          meta: {
            reason: 'There is a signature verification error.',
          },
        })

        return notAuthorized()
      }

      debug(`twilio signature validation passed`).log(
        'integration.twilio.webhook.handler'
      )
    }
  }

  const MessageSid = query.get('MessageSid')?.trim()
  const CallSid = query.get('CallSid')?.trim()
  const From = query.get('From')?.trim()
  const To = query.get('To')?.trim()
  const Body = query.get('Body')?.trim()

  debug(`parsed webhook`, {
    twilioIntegrationId: twilioIntegration.id,
    messageSid: MessageSid,
    callSid: CallSid,
    from: From,
    to: To,
    hasBody: Boolean(Body),
  }).log('integration.twilio.webhook.handler')

  // check allowFrom restriction before queueing any inbound work
  if (From) {
    const entries = parseTwilioAllowFrom(twilioIntegration.allowFrom ?? '*')

    if (!twilioSenderIsAllowed(From, entries)) {
      debug(`sender not allowed`, {
        twilioIntegrationId: twilioIntegration.id,
        from: From,
        to: To,
        messageSid: MessageSid,
        callSid: CallSid,
      }).log('integration.twilio.webhook.handler')

      await logEvent({
        user: { id: twilioIntegration.userId },
        name: 'Sender Blocked',
        description: `A message was blocked due to allowFrom restrictions.`,
        type: 'integration.twilio.blocked',
        relations: {
          twilioIntegrationId: twilioIntegration.id,
        },
        meta: {
          from: From,
          to: To,
          messageSid: MessageSid,
          callSid: CallSid,
        },
      })

      return xmlResponse(EMPTY_TWIML)
    }
  }

  if (MessageSid) {
    return await handleSmsWebhook({
      twilioIntegrationId: twilioIntegration.id,
      userId: twilioIntegration.userId,
      messageSid: MessageSid,
      from: From,
      to: To,
      body: Body,
    })
  }

  if (CallSid) {
    return await handleVoiceWebhook({
      twilioIntegrationId: twilioIntegration.id,
      userId: twilioIntegration.userId,
      callSid: CallSid,
      from: From,
      to: To,
    })
  }

  debug(`returning empty TwiML - no sms or voice identifier`, {
    twilioIntegrationId: twilioIntegration.id,
  }).log('integration.twilio.webhook.handler')

  return xmlResponse(EMPTY_TWIML)
})

// @note required because we need the exact raw body for signature validation
// (X-Twilio-Signature is computed over the form parameters as sent). Without
// this Next's body parser consumes the stream first and the handler sees a
// re-serialised copy - which the Slack and WhatsApp siblings already guard
// against the same way.
export const config = {
  api: {
    bodyParser: false,
  },
}
