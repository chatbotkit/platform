// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import { fetchPlusPlus } from '@/lib/egress.fetch'
import { normalizeRequest, parseRequest } from '@/lib/http'
import { logEvent } from '@/lib/log'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { createHmacHexDigest } from '@/lib/webcrypto'
import { parseAsync } from '@/lib/zod.schema'

import { z } from 'zod'

export const TRIGGER_EVENT_TYPE = 'trigger'

/**
 * @typedef {z.infer<typeof TriggerPayloadSchema>} TriggerPayload
 */
export const TriggerPayloadSchema = z.object({
  eventType: z.string(),
  eventData: z.record(z.any()),
})

/**
 * @typedef {{
 *   type: typeof TRIGGER_EVENT_TYPE,
 *   payload: TriggerPayload
 * }} TriggerEvent
 *
 * @param {string} webhookId
 * @param {TriggerPayload} payload
 * @returns {Promise<void>}
 */
export async function handleTriggerEventType(webhookId, payload) {
  debug(`handle trigger event type`, { payload })

  const { eventType, eventData } = payload

  const webhook = await prisma.webhook.findUnique({
    where: {
      id: webhookId,
    },
  })

  if (!webhook) {
    debug(`webhook not found`, { webhookId })

    return
  }

  if (!webhook.request) {
    debug(`no request specified`, { webhook })

    return
  }

  if (!webhook.events) {
    debug(`no events specified`, { webhook })

    return
  }

  const supportedEvents = webhook.events.split(',')

  if (!supportedEvents.includes(eventType)) {
    debug(`event not supported`, { supportedEvents, eventType })

    return
  }

  const request = parseRequest(
    webhook.request.match(/^https?:\/\//i)
      ? `POST ${webhook.request} HTTP/1.1\n\n`
      : webhook.request,
    '\n'
  )

  request.body = JSON.stringify({
    eventType,
    eventData,
  })

  const { method, uri: url, headers, body } = normalizeRequest(request)

  const algorithm = 'sha256'
  const secret = webhook.secret

  const hmac = await createHmacHexDigest(algorithm, secret, request.body)

  headers['x-hub-signature'] = `${algorithm}=${hmac}`

  debug(`sending request`, { method, url, headers, body })

  const response = await fetchPlusPlus(url, {
    method,

    // @ts-ignore
    headers,

    body,
  })

  if (!response.ok) {
    await logEvent({
      user: { id: webhook.userId },
      type: 'webhook.request',
      relations: {
        webhookId: webhook.id,
      },
      meta: {
        method,
        url,
        headers,
        body,

        status: response.status,
      },
    })

    // Throwing an error here will trigger the queue retry mechanism. However,
    // this can get very noisy if the webhook is not available. Therefore, we
    // filter this error out elsewhere to reduce the noise.

    throw new Error(`Webhook Request Failure`)
  } else {
    await logEvent({
      user: { id: webhook.userId },
      type: 'webhook.request',
      relations: {
        webhookId: webhook.id,
      },
      meta: {
        method,
        url,
        headers,
        body,

        status: response.status,
      },
    })
  }

  // @todo maybe log the first 512 bytes of the response

  if (response.body) {
    // @ts-ignore
    for await (const chunk of response.body) {
      chunk // @note we simply pull the result
    }
  }
}

/**
 * @param {string} webhookId
 * @param {TriggerEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(webhookId, event) {
  switch (true) {
    case event.type === TRIGGER_EVENT_TYPE: {
      await parseAsync(TriggerPayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(`/api/v1/webhook/${webhookId}/queue`, event, {})
}

/**
 */
export default withQueueHandlerBounded('webhookId', {
  [TRIGGER_EVENT_TYPE]: {
    handler: handleTriggerEventType,
    schema: TriggerPayloadSchema,
  },
})
