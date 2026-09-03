// @ts-check
import prisma from '@/prisma/client'
import { Trigger } from '@/prisma/types'

import { setContextConversation } from '@/lib/context.store'
import { isAutonomousConversation } from '@/lib/conversation.app'
import debug from '@/lib/debug'
import { fetchPlusPlus } from '@/lib/egress.fetch'
import { captureInputError } from '@/lib/error'
import { extractData } from '@/lib/extract.data'
import { getFetchError } from '@/lib/fetch'
import { normalizeRequest, parseRequest } from '@/lib/http'
import { runTasks } from '@/lib/job'
import { logEvent, logMetric } from '@/lib/log'
import { getSortedMessages } from '@/lib/message'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import {
  throwConflict,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'
import { createHmacHexDigest } from '@/lib/webcrypto'
import { parseAsync } from '@/lib/zod.schema'

import { z } from 'zod'

export const IDLE_EVENT_TYPE = 'idle'

/**
 * Detects numeric values in extracted data for fields marked for collection
 *
 * @param {Record<string, any>} extractedData - The extracted data from conversation
 * @param {Record<string, any>} schemaDefinition - The schema definition with collect flags
 * @returns {Array<{field: string, value: number, type: 'integer' | 'float'}>} Array of numeric metrics
 */
function detectNumericMetrics(extractedData, schemaDefinition) {
  const numericValues = []

  if (
    !extractedData ||
    typeof extractedData !== 'object' ||
    !schemaDefinition ||
    typeof schemaDefinition !== 'object'
  ) {
    return numericValues
  }

  // iterate through extracted data to find numeric values that are marked for collection

  Object.entries(extractedData).forEach(([key, value]) => {
    const fieldSchema = schemaDefinition[key]

    // only collect metrics for fields that have collect: true in the schema

    if (
      fieldSchema &&
      fieldSchema.collect === true &&
      typeof value === 'number' &&
      !isNaN(value)
    ) {
      numericValues.push({
        field: key,
        value: value,
        type: Number.isInteger(value) ? 'integer' : 'float',
      })
    }
  })

  return numericValues
}

/**
 * @typedef {z.infer<typeof IdlePayloadSchema>} IdlePayload
 */
export const IdlePayloadSchema = z.object({
  conversationId: z.string(),
})

/**
 * @typedef {{
 *   type: typeof IDLE_EVENT_TYPE,
 *   payload: IdlePayload
 * }} IdleEvent
 *
 * @param {string} extractIntegrationId
 * @param {IdlePayload} payload
 * @returns {Promise<void>}
 */
export async function handleIdleEvent(extractIntegrationId, payload, context) {
  debug(`handle idle event`, { extractIntegrationId, payload })
    .log('integration.extract.handleIdleEvent')
    .log('temp.integration.extract.handleIdleEvent') // @todo temp setup to be removed after 2025/09/30

  const integration = await prisma.extractIntegration.findUnique({
    where: {
      id: extractIntegrationId,
    },
  })

  if (!integration) {
    return throwNotFound(
      `ExtractIntegration not found: ${extractIntegrationId}`
    )
  }

  // @note no need to stop if no bot configured

  if (integration.trigger === Trigger.never) {
    return
  }

  if (!integration.schema) {
    return throwConflict(
      `ExtractIntegration not configured: ${extractIntegrationId}`
    )
  }

  // Find the conversation.

  const conversation = await prisma.conversation.findUnique({
    where: {
      id: payload.conversationId,

      ...(integration.botId ? { botId: integration.botId } : {}), // filter by botId if provided
    },

    include: {
      user: true,
    },
  })

  if (!conversation) {
    return throwNotFound(`Conversation not found: ${payload.conversationId}`)
  }

  if (integration.userId !== conversation.userId) {
    return throwNotAuthorized(
      `Conversation access not allowed: ${payload.conversationId}`
    )
  }

  // @note autonomous conversations (trigger/task runs) have no human
  // counterpart, so idle extraction does not apply to them.

  if (isAutonomousConversation(conversation)) {
    debug(`skipping extraction for autonomous conversation`, {
      conversationId: conversation.id,
      app: conversation.meta?.app,
    }).log('integration.extract.handleIdleEvent')

    return
  }

  // Get the messages.

  const messages = getSortedMessages(
    await prisma.message.findMyriad({
      where: {
        conversationId: conversation.id,
      },

      select: {
        id: true, // @note important for sorting

        type: true,
        text: true,

        meta: true, // @note required for activity message processing

        createdAt: true, // @note important for sorting
      },

      orderBy: {
        createdAt: 'desc',
      },
    })
  )

  // Perform the extraction.

  // @note the engine resolves message attachments (images) through the
  // context conversation; without it any conversation with an upload throws

  setContextConversation(conversation)

  // @note usage is recorded by the conversation engine internally via
  // usageMeta and usageReferences passed here

  const { data } = await extractData(messages, integration.schema, {
    user: conversation.user,
    model: integration.model || undefined,
    // @note forward the queue monitor's hard-timeout signal so a slow extraction
    // aborts promptly instead of running to the hard kill (mirrors the trigger
    // path; see the queue-timeout regression)
    signal: context?.signal,
    usageMeta: { reason: 'conversation/extract' },
    usageReferences: {
      conversationId: conversation.id,
      botId: conversation.botId || undefined,
    },
  })

  await runTasks([
    // capture meta

    async () => {
      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },

        data: {
          meta: {
            ...conversation.meta,

            integrations: {
              ...conversation.meta?.integrations,

              extract: {
                ...conversation.meta?.integrations?.extract,

                data: data,
              },
            },
          },
        },
      })
    },

    // record metrics for numeric values marked for collection

    async () => {
      if (data && integration.schema) {
        const numericValues = detectNumericMetrics(data, integration.schema)

        if (numericValues.length > 0) {
          // log metrics for all numeric values in parallel

          await runTasks(
            numericValues.map((numericValue) => async () => {
              await logMetric({
                user: { id: integration.userId },
                name: numericValue.field,
                // @ts-ignore dynamic metric type based on user-defined field names
                type: `integration.extract[${integration.id}].${numericValue.field}`,
                value: numericValue.value,
                relations: {
                  extractIntegrationId: integration.id,
                  conversationId: conversation.id,
                  botId: integration.botId,
                  blueprintId: integration.blueprintId,
                },
              })
            })
          )
        }
      }
    },

    // record item

    async () => {
      if (data) {
        await prisma.extractIntegrationItem.upsert({
          where: {
            extractIntegrationId_conversationId: {
              extractIntegrationId: integration.id,
              conversationId: conversation.id,
            },
          },

          create: {
            extractIntegrationId: integration.id,
            conversationId: conversation.id,
            data: data,
          },

          update: {
            data: data,
          },
        })
      }
    },

    // trigger request

    async () => {
      if (integration.request) {
        const request = parseRequest(
          integration.request.match(/^https?:\/\//i)
            ? `POST ${integration.request} HTTP/1.1\n\n`
            : integration.request,
          '\n'
        )

        request.body = JSON.stringify({
          // the extracted data

          data: data,

          // the conversation we use for the extract

          conversation: {
            messages: messages
              .filter(({ type }) => ['bot', 'user'].includes(type))
              .map(({ type, text }) => ({
                type,
                text,
              })),
          },
        })

        const { method, uri: url, headers, body } = normalizeRequest(request)

        if (url && /^https:\/\//.test(url)) {
          const algorithm = 'sha256'
          const secret = integration.id

          const hmac = await createHmacHexDigest(
            algorithm,
            secret,
            request.body
          )

          headers['x-hub-signature'] = `${algorithm}=${hmac}`

          debug(`sending request`, { method, url, headers, body })

          try {
            const response = await fetchPlusPlus(url, {
              method,

              // @ts-ignore
              headers,

              body,
            })

            await logEvent({
              user: { id: integration.userId },
              type: 'integration.extract.request',
              relations: {
                blueprintId: integration.blueprintId,
                extractIntegrationId: integration.id,
                conversationId: conversation.id,
              },
              meta: {
                method,
                url,
                status: response.status,
              },
            })

            if (!response.ok) {
              throw await getFetchError(response)
            }

            // @todo maybe log the first 512 bytes of the response

            if (response.body) {
              // @ts-ignore
              for await (const chunk of response.body) {
                chunk // @note we simply pull the result
              }
            }
          } catch (/** @type {any} */ error) {
            // @note webhook delivery may fail because the customer endpoint
            // times out, is unreachable, or responds with an error status. The
            // extraction itself has already completed and been stored, so we
            // record the delivery failure as an integration event rather than
            // letting it surface as an unhandled platform exception.

            await logEvent({
              user: { id: integration.userId },
              type: 'integration.extract.request.error',
              relations: {
                blueprintId: integration.blueprintId,
                extractIntegrationId: integration.id,
                conversationId: conversation.id,
              },
              meta: {
                method,
                url,
                error: error?.message || String(error),
              },
            })
          }
        } else {
          await logEvent({
            user: { id: integration.userId },
            type: 'integration.extract.request.error',
            relations: {
              blueprintId: integration.blueprintId,
              extractIntegrationId: integration.id,
              conversationId: conversation.id,
            },
            meta: {
              error: 'Invalid URL',
              url: url,
            },
          })
        }
      }
    },
  ])
}

/**
 * @param {string} extractIntegrationId
 * @param {IdleEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(extractIntegrationId, event) {
  switch (true) {
    case event.type === IDLE_EVENT_TYPE: {
      await parseAsync(IdlePayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(
    `/api/v1/integration/extract/${extractIntegrationId}/queue`,
    event
  )
}

/**
 */
export default withQueueHandlerBounded('extractIntegrationId', {
  [IDLE_EVENT_TYPE]: {
    handler: handleIdleEvent,
    schema: IdlePayloadSchema,
  },
})

/**
 * @manual Extract Integration
 *
 * ## Extraction Processing and Webhook Delivery
 *
 * The extract integration uses a sophisticated background processing system to
 * handle data extraction from conversations. This ensures that extraction happens
 * reliably without blocking conversation flow or impacting user experience.
 *
 * ### Automatic Extraction Triggers
 *
 * Extraction is automatically triggered when:
 *
 * - **Conversation Ends**: When a conversation is marked as completed
 * - **Conversation Goes Idle**: After a period of inactivity (configurable via the `trigger` setting)
 * - **Manual Trigger**: When you explicitly trigger extraction via the API
 *
 * The system queues each extraction request and processes them asynchronously,
 * ensuring reliable data capture even during high-traffic periods.
 *
 * ### Extraction Process
 *
 * When a conversation is queued for extraction:
 *
 * 1. **Message Retrieval**: All messages from the conversation are retrieved and sorted chronologically
 * 2. **Schema-Based Extraction**: The AI model analyzes the conversation and extracts data according to your JSON schema
 * 3. **Metadata Update**: The extracted data is stored in the conversation's metadata under `integrations.extract.data`
 * 4. **Metrics Collection**: Numeric values from fields marked with `collect: true` are logged as metrics
 * 5. **Item Storage**: The extracted data is stored in the ExtractIntegrationItem table for query and reporting
 * 6. **Webhook Delivery**: If configured, the extracted data is POSTed to your webhook URL
 *
 * ### Webhook Request Format
 *
 * When your webhook is invoked, it receives a POST request with the following structure:
 *
 * ```json
 * {
 *   "data": {
 *     // Your extracted data according to the schema
 *     "customerName": "John Doe",
 *     "email": "john@example.com",
 *     "orderAmount": 299.99
 *   },
 *   "conversation": {
 *     "messages": [
 *       {
 *         "type": "user",
 *         "text": "I'd like to place an order"
 *       },
 *       {
 *         "type": "bot",
 *         "text": "I'd be happy to help! May I have your name?"
 *       }
 *       // ... more messages
 *     ]
 *   }
 * }
 * ```
 *
 * ### Webhook Security
 *
 * All webhook requests include an HMAC signature for verification:
 *
 * - **Header**: `x-hub-signature: sha256=<hmac_hex_digest>`
 * - **Algorithm**: SHA-256
 * - **Secret**: The extract integration ID
 * - **Payload**: The JSON request body
 *
 * To verify the signature, compute the HMAC of the request body using your
 * integration ID as the secret and compare it with the signature in the header.
 *
 * ### Webhook Retry Logic
 *
 * If webhook delivery fails, the system automatically retries:
 *
 * - **Retry Attempts**: Up to 5 retries
 * - **Backoff Strategy**: Exponential backoff with the formula: `min(86400, e^(2.5*n))` seconds
 * - **Logging**: All attempts are logged in the integration event logs
 * - **Failure Notification**: Final failures are recorded but do not block data extraction
 *
 * Failed webhook deliveries do not prevent the data from being extracted and
 * stored. The extracted data remains accessible in conversation metadata and
 * through the integration items, even if webhook delivery fails.
 *
 * ### Numeric Metrics Collection
 *
 * Fields marked with `collect: true` in your schema trigger automatic metrics logging:
 *
 * - **Metric Type**: `integration.extract[{integrationId}].{fieldName}`
 * - **Value**: The numeric value extracted from the conversation
 * - **Relations**: Linked to the integration, conversation, bot, and blueprint
 * - **Aggregation**: Available for analytics, charts, and trend analysis
 *
 * This enables powerful analytics capabilities without requiring additional
 * configuration or custom code.
 *
 * ### Token Usage and Billing
 *
 * Each extraction operation consumes API tokens:
 *
 * - **Model Used**: Determined by your account settings and conversation context
 * - **Token Count**: Based on the conversation length and schema complexity
 * - **Usage Recording**: Tracked under the reason `conversation/extract`
 * - **References**: Linked to the specific conversation for audit purposes
 *
 * Longer conversations and more complex schemas will consume more tokens. Monitor
 * your usage through the usage API to track extraction costs.
 */
