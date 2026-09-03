/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Meta Graph) */
// @ts-check
import { template as t } from '@chatbotkit-dev/template'

import messages from '@/config/messages'

import prisma from '@/prisma/client'

import { makeActivityMessagePair } from '@/lib/activity'
import { getConversationDetails } from '@/lib/bot.conversation'
import {
  createContactFingerprint,
  ensureTrustedContact,
} from '@/lib/contact.create'
import { setContextUser } from '@/lib/context.store'
import {
  makeConversationAttachmentUploadActivityMessages,
  uploadConversationAttachmentFromURL,
} from '@/lib/conversation.attachment'
import { createConversation } from '@/lib/conversation.create'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { hasConversation } from '@/lib/conversation.find'
import {
  TAG_COMPLETE_BEGIN,
  TAG_ERROR,
  TAG_OPERATION_BEGIN,
  TAG_REASONING_TOKEN,
  TAG_TOKEN,
  createSinkEvent,
} from '@/lib/conversation.tag'
import { createThrottledAction } from '@/lib/debounce'
import debug from '@/lib/debug'
import {
  captureInputError,
  captureObservation,
  captureUnexpectedState,
} from '@/lib/error'
import { fetchPlusPlus, getFetchError } from '@/lib/fetch'
import { runTasks } from '@/lib/job'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import { allocateOrder, messagingSupersede } from '@/lib/messaging.supersede'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import {
  throwConflict,
  throwLimitsReached,
  throwNotFound,
} from '@/lib/response'
import { updateSessionStore } from '@/lib/session.context'
import { resolveSessionDuration } from '@/lib/session.duration'
import { getMaxFileSize } from '@/lib/user.limits'
import { userToSessionUser } from '@/lib/user.session'
import {
  markdownToMessages,
  mergeMessagesByType,
} from '@/lib/whatsapp.markdown'
import {
  parseWhatsAppAllowFrom,
  whatsAppSenderIsAllowed,
} from '@/lib/whatsapp.validation'
import { parseAsync } from '@/lib/zod.schema'

import libphonenumberJs from 'libphonenumber-js'
import { z } from 'zod'

export const WHATSAPP_CONTACT_NAMESPACE = '024f30fa-decd-495f-820a-308825f979d8' // @note do not change

export const INTERACT_EVENT_TYPE = 'interact'
export const INITIATE_EVENT_TYPE = 'initiate'
export const META_GRAPH_API_VERSION = 'v21.0'

const INITIATE_DEDUPLICATION_TTL_SECONDS = 7 * 24 * 60 * 60

/**
 * @typedef {z.infer<typeof InteractPayloadSchema>} InteractPayload
 */
export const InteractPayloadSchema = z.object({
  contacts: z
    .array(
      z.object({
        // @note WhatsApp omits `profile` (and sometimes `profile.name`) on some
        // inbound message webhooks. Keeping these required caused valid messages
        // to fail validation, return 500, get retried by WhatsApp, and never be
        // processed. Downstream consumers already treat the name as optional.
        profile: z
          .object({
            name: z.string().optional(),
          })
          .optional(),
        wa_id: z.string(),
      })
    )
    .optional(),

  messages: z
    .array(
      z.object({
        id: z.string(),
        from: z.string(),
        type: z.enum([
          'text',
          'image',
          'audio',
          'video',
          'document',
          'sticker',
          'interactive',
          'location',
          'button',
          'contacts',
          'order',
          'reaction',
          'system',
          'unknown',
          'unsupported',
        ]),
        text: z
          .object({
            body: z.string(),
          })
          .optional(),
        image: z
          .object({
            id: z.string(),
            caption: z.string().optional(),
          })
          .optional(),
        audio: z
          .object({
            id: z.string(),
            mime_type: z.string().optional(),
            voice: z.boolean().optional(),
          })
          .optional(),
        video: z
          .object({
            id: z.string(),
            caption: z.string().optional(),
            mime_type: z.string().optional(),
          })
          .optional(),
        document: z
          .object({
            id: z.string(),
            caption: z.string().optional(),
            filename: z.string().optional(),
            mime_type: z.string().optional(),
          })
          .optional(),
        sticker: z
          .object({
            id: z.string(),
            mime_type: z.string().optional(),
          })
          .optional(),
        reaction: z
          .object({
            message_id: z.string(),
            emoji: z.string(),
          })
          .optional(),
        interactive: z
          .object({
            type: z.enum(['button_reply', 'list_reply']).optional(),
            button_reply: z
              .object({
                id: z.string(),
                title: z.string(),
              })
              .optional(),
            list_reply: z
              .object({
                id: z.string(),
                title: z.string(),
                description: z.string().optional(),
              })
              .optional(),
          })
          .optional(),
        location: z
          .object({
            latitude: z.number(),
            longitude: z.number(),
            name: z.string().optional(),
            address: z.string().optional(),
          })
          .optional(),
      })
    )
    .min(1),

  // @note per-sender monotonic order allocated on the webhook path (see
  // allocateOrder); threaded here so the handler can detect it has been
  // superseded by a newer message. Optional for backward-compat with events
  // enqueued before supersede was wired.
  order: z.number().optional(),
})

/**
 * @param {Pick<InteractPayload, 'messages'>} payload
 * @returns {string}
 */
export function getWhatsAppInteractSessionId(payload) {
  return [
    ...new Set(
      payload.messages
        .map(({ from }) => normalizeWhatsAppSessionPhone(from))
        .filter(Boolean)
    ),
  ].join(',')
}

/**
 * @param {string} whatsappIntegrationId
 * @param {Pick<InteractPayload, 'messages'>} payload
 * @returns {string}
 */
export function getWhatsAppInteractSessionKey(whatsappIntegrationId, payload) {
  return `whatsapp-session-${whatsappIntegrationId}-${getWhatsAppInteractSessionId(
    payload
  )}`
}

/**
 * Normalize a phone number to the WhatsApp wa_id form (digits only, no '+') so
 * a bot-initiated `to` and the inbound webhook `from` produce the same session
 * key. Inbound wa_id values are already digits-only; this brings a
 * caller-supplied `to` (which may carry '+', spaces or punctuation) into line.
 *
 * @param {string} phone
 * @returns {string}
 */
function normalizeWhatsAppSessionPhone(phone) {
  return String(phone ?? '').replace(/\D/g, '')
}

/**
 * @param {string} whatsappIntegrationId
 * @param {Pick<InitiatePayload, 'to'>} payload
 * @returns {string}
 */
export function getWhatsAppInitiateSessionKey(whatsappIntegrationId, payload) {
  return `whatsapp-session-${whatsappIntegrationId}-${normalizeWhatsAppSessionPhone(
    payload.to
  )}`
}

/**
 * @param {{ sessionKey: string }} options
 * @returns {Promise<string | null>}
 */
export async function resolveWhatsAppSessionConversationId({ sessionKey }) {
  return await memcache.get(sessionKey)
}

/**
 * @param {{ sessionKey: string, conversationId: string, sessionDurationSecs: number }} options
 * @returns {Promise<void>}
 */
export async function setWhatsAppSessionConversationId({
  sessionKey,
  conversationId,
  sessionDurationSecs,
}) {
  await memcache.set(sessionKey, conversationId, {
    ex: sessionDurationSecs,
  })
}

/**
 * Slide the session window by refreshing the key's TTL without rewriting its
 * value, so an actively-used conversation is not cut off at a fixed offset from
 * its creation time. Called on every reuse of an existing session.
 *
 * @param {{ sessionKey: string, sessionDurationSecs: number }} options
 * @returns {Promise<void>}
 */
export async function bumpWhatsAppSessionConversationId({
  sessionKey,
  sessionDurationSecs,
}) {
  await memcache.expire(sessionKey, sessionDurationSecs)
}

/**
 * @param {{ sessionKey: string }} options
 * @returns {Promise<void>}
 */
export async function deleteWhatsAppSessionConversationId({ sessionKey }) {
  await memcache.del(sessionKey)
}

/**
 * @typedef {{
 *   type: typeof INTERACT_EVENT_TYPE,
 *   payload: InteractPayload
 * }} InteractEvent
 *
 * @param {string} whatsappIntegrationId
 * @param {InteractPayload} payload
 * @returns {Promise<void>}
 */
export async function handleInteractEvent(
  whatsappIntegrationId,
  payload,
  context
) {
  debug(`interact`, { whatsappIntegrationId, payload }).log(
    'integration.whatsapp.queue.handleInteractEvent'
  )

  const integration = await prisma.whatsappIntegration.findUnique({
    where: {
      id: whatsappIntegrationId,
    },

    include: {
      user: true, // @note super important

      bot: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(
      `WhatsAppIntegration not found: ${whatsappIntegrationId}`
    )
  }

  if (!integration.bot) {
    debug(`skipping - no bot configured`).log(
      'integration.whatsapp.queue.handleInteractEvent'
    )

    return
  }

  if (!integration.phoneNumberId || !integration.accessToken) {
    return throwConflict(
      `WhatsAppIntegration not configured: ${whatsappIntegrationId}`
    )
  }

  // check allowFrom restriction
  {
    const entries = parseWhatsAppAllowFrom(integration.allowFrom || '')

    const senderPhone = payload.messages
      .map(({ from }) => from)
      .find((from) => from && !whatsAppSenderIsAllowed(from, entries))

    if (senderPhone) {
      debug(`sender not allowed`, {
        from: senderPhone,
      }).log('integration.whatsapp.queue.handleInteractEvent')

      await logEvent({
        user: { id: integration.userId },
        name: 'Sender Blocked',
        description: `A message was blocked due to allowFrom restrictions.`,
        type: 'integration.whatsapp.blocked',
        relations: {
          whatsappIntegrationId: integration.id,
        },
        meta: {
          from: senderPhone,
        },
      })

      return
    }
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    // @note the account is over its usage limits - post a pre-canned reply so
    // the user gets a visible signal instead of silence. Best-effort: a failed
    // post must not mask the underlying limit condition.
    const recipient = payload.messages?.[0]?.from

    if (integration.phoneNumberId && integration.accessToken && recipient) {
      try {
        const response = await fetchPlusPlus(
          `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${integration.phoneNumberId}/messages`,
          {
            method: 'POST',

            headers: {
              Authorization: `Bearer ${integration.accessToken}`,
              'Content-Type': 'application/json',
            },

            body: JSON.stringify({
              messaging_product: 'whatsapp',

              to: recipient,

              text: {
                body: messages.limitsReachedReply,
              },
            }),
          }
        )

        if (!response.ok) {
          debug(`limit reply post failed`, { status: response.status }).log(
            'integration.whatsapp.queue.handleInteractEvent'
          )
        }
      } catch (error) {
        debug(`limit reply post failed`, { error }).log(
          'integration.whatsapp.queue.handleInteractEvent'
        )
      }

      return
    }

    return throwLimitsReached(`Limits exceeded`)
  }

  if (integration.user) {
    updateSessionStore({
      user: userToSessionUser(integration.user),
    })

    setContextUser(integration.user)
  }

  const sessionKey = getWhatsAppInteractSessionKey(integration.id, payload)

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  // @note supersede + soft-yield: a newer message from the same sender (a rapid
  // follow-up) should steer this turn rather than queue a second reply. Only
  // meaningful when sessions persist and the webhook allocated an order (events
  // enqueued before supersede was wired carry none).
  const superseding = persist && payload.order != null

  const supersede = messagingSupersede(sessionKey, payload.order ?? 0)

  /** @type {import('@/lib/messaging.supersede').SupersedeWatch|null} */
  let watch = null

  // @todo we should check for exact commands only

  if (
    ['/restart', '/reset', '/new'].includes(
      payload.messages[0]?.text?.body?.trim().toLowerCase() || ''
    )
  ) {
    debug(`restart`).log('integration.whatsapp.queue.handleInteractEvent')

    await deleteWhatsAppSessionConversationId({ sessionKey })

    return
  }

  const typingMessageId = payload.messages[0]?.id

  const typing = createThrottledAction({
    intervalMs: 10_000,
    action: async () => {
      if (!typingMessageId) {
        return
      }

      await fetchPlusPlus(
        `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${integration.phoneNumberId}/messages`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: typingMessageId,
            typing_indicator: { type: 'text' },
          }),
        }
      )
    },
  })

  await typing.trigger()

  let conversationId = persist
    ? await resolveWhatsAppSessionConversationId({
        sessionKey,
      })
    : null

  const reusable = !!conversationId && (await hasConversation(conversationId))

  // @note slide the session window: refresh the TTL on every reuse so an active
  // conversation is not cut off at a fixed offset from its creation time.
  if (persist && reusable) {
    await bumpWhatsAppSessionConversationId({
      sessionKey,
      sessionDurationSecs: ttlSecs,
    })
  }

  if (!conversationId || !reusable) {
    let contactId

    {
      if (integration.contactCollection) {
        const contacts = await Promise.all(
          (payload.contacts || [])
            .map(({ wa_id, ...rest }) => {
              const phoneNumber = libphonenumberJs(`+${wa_id}`, {
                defaultCountry: 'US',
              })

              if (!phoneNumber) {
                return { ...rest, phone: null }
              }

              return {
                ...rest,

                phone: phoneNumber.number.toString(),
              }
            })
            .filter(({ phone }) => Boolean(phone))
            .map(async ({ profile, phone }) => {
              const contact = await ensureTrustedContact(
                { id: integration.userId },
                {
                  name: profile?.name,
                  phone: phone,

                  meta: {
                    app: 'whatsapp',
                  },
                },
                createContactFingerprint(WHATSAPP_CONTACT_NAMESPACE, [phone])
              )

              return contact
            })
        )

        if (contacts.length > 0) {
          contactId = contacts[0].id
        }
      }
    }

    const { id: cid } = await createConversation(integration.userId, {
      contactId,

      ...getConversationDetails(integration),

      meta: {
        app: 'whatsapp',

        whatsapp: {
          integrationId: integration.id,
        },
      },
    })

    conversationId = cid

    if (persist) {
      await setWhatsAppSessionConversationId({
        sessionKey,
        conversationId,
        sessionDurationSecs: ttlSecs,
      })
    }
  }

  const sink = new (class {
    /** @type {Array<Promise<any>>} */
    #promises = []

    async push(type, data) {
      const event = createSinkEvent(
        /** @type {import('@/lib/conversation.tag').EngineSinkItem} */ ({
          type,
          data,
        })
      )

      switch (type) {
        case TAG_ERROR: {
          // @note do NOT re-capture here. The conversation engine already
          // reports the *raw* error (with its `cause` chain) to Sentry at the
          // throw site; by the time it reaches this sink it has been normalized
          // to `{code, message}` for the stream, so re-capturing would only add
          // a duplicate, stack-less, cause-less event. See the slack queue and
          // the original analysis.

          break
        }

        case TAG_TOKEN: {
          // @todo support streaming tokens

          break
        }

        case TAG_REASONING_TOKEN: {
          // @todo support streaming reasoning tokens

          break
        }

        case TAG_OPERATION_BEGIN: {
          this.#promises.push(typing.trigger())

          break
        }

        case TAG_COMPLETE_BEGIN: {
          this.#promises.push(typing.trigger())

          break
        }
      }

      return event
    }

    async join() {
      await runTasks(this.#promises)
    }
  })()

  watch = superseding ? supersede.watch() : null

  const engine = await getStatefulConversationEngine({
    conversationId: conversationId,

    options: {
      signal: context?.signal,

      // @note fire-once per-mark signals from the queue monitor; the engine's
      // `timeoutMarks` feature listens to these. NOT cancellation signals

      markSignals: context?.markSignals,

      // @note cooperative soft-yield: tripped when a newer message from the same
      // sender supersedes this turn, so the engine stops at its next iteration
      // boundary instead of finishing a reply that would be thrown away.

      yieldSignal: watch?.yieldSignal,

      // prettier-ignore
      backstoryExtra: t`
# Runtime Context

This conversation is happening over WhatsApp. Write concise, mobile-friendly responses and use normal markdown; the response will be converted to WhatsApp-compatible messages before delivery.
        `,

      userId: integration.userId,

      features: [
        // @note surface who sent the current message to the model for this turn
        // only - the userInfo feature injects it as a soft activity message and
        // never persists it

        /** @type {import('@/lib/conversation.features').UserInfoFeature} */ ({
          name: 'userInfo',
          options: {
            name: payload.contacts?.[0]?.profile?.name,
            externalId: payload.messages?.[0]?.from,
            source: 'whatsapp',
          },
        }),

        // @note record a checkpoint activity into the conversation each time the
        // queue handler crosses a timeout-budget mark (driven by markSignals
        // above), visible to the model on the next turn

        { name: 'timeoutMarks' },

        // @note time gives the model reliable current date/time awareness
        // instead of guessing from stale training data

        /** @type {import('@/lib/conversation.features').TimeFeature} */ ({
          name: 'time',
        }),

        ...(integration.attachments
          ? [
              /** @type {import('@/lib/conversation.features').AttachmentsFeature} */ ({
                name: 'attachments',
              }),
            ]
          : []),
      ],

      sink,

      internalFunctions: [
        // internal whatsapp specific functions

        {
          name: '_report_task_progress',
          description: t`
            This function can be used to report task progress to the WhatsApp user.
          `,

          parameters: {
            type: 'object',
            properties: {
              progress: {
                type: 'string',
                description: 'Progress message',
              },
            },
            required: ['progress'],
          },

          async handler({ progress }) {
            debug(`_report_task_progress`, { progress }).log(
              'integration.whatsapp.queue.handleInteractEvent'
            )

            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${integration.phoneNumberId}/messages`,
              {
                method: 'POST',

                headers: {
                  Authorization: `Bearer ${integration.accessToken}`,
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  messaging_product: 'whatsapp',

                  to: payload.messages[0].from,

                  text: {
                    body: progress,
                  },
                }),
              }
            )

            if (!response.ok) {
              await captureObservation(
                'WhatsApp _report_task_progress API call failed',
                {
                  whatsappIntegrationId: integration.id,
                  status: response.status,
                }
              )
            }
          },
        },

        {
          name: '_send_interactive_buttons',
          description: t`
            Send an interactive buttons message to the WhatsApp user.

            Use this when you want the user to pick exactly one option from up to 3 choices.
          `,

          parameters: {
            type: 'object',
            properties: {
              body: {
                type: 'string',
                description: 'Main message body displayed above buttons',
              },
              footer: {
                type: 'string',
                description: 'Optional footer text',
                nullable: true,
              },
              buttons: {
                type: 'array',
                description:
                  'List of buttons (max 3). Each will generate a reply when clicked.',
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      description:
                        'Stable identifier for the button (machine readable)',
                    },
                    title: {
                      type: 'string',
                      description: 'Button title (user visible)',
                    },
                  },
                  required: ['id', 'title'],
                },
              },
            },
            required: ['body', 'buttons'],
          },

          async handler({ body, footer, buttons }) {
            debug(`_send_interactive_buttons`, { body, footer, buttons }).log(
              'integration.whatsapp.queue.handleInteractEvent'
            )

            if (!Array.isArray(buttons) || buttons.length === 0) {
              return
            }

            const trimmedButtons = buttons.slice(0, 3)

            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${integration.phoneNumberId}/messages`,
              {
                method: 'POST',

                headers: {
                  Authorization: `Bearer ${integration.accessToken}`,
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  messaging_product: 'whatsapp',

                  to: payload.messages[0].from,

                  type: 'interactive',

                  interactive: {
                    type: 'button',

                    body: { text: body },

                    ...(footer ? { footer: { text: footer } } : {}),

                    action: {
                      buttons: trimmedButtons.map((b) => ({
                        type: 'reply',
                        reply: { id: b.id, title: b.title },
                      })),
                    },
                  },
                }),
              }
            )

            if (!response.ok) {
              await captureObservation(
                'WhatsApp _send_interactive_buttons API call failed',
                {
                  whatsappIntegrationId: integration.id,
                  status: response.status,
                }
              )
            }
          },
        },

        {
          name: '_send_interactive_list',
          description: t`
            Send an interactive list message to the WhatsApp user.

            Use this for more than 3 options organized in sections.
          `,

          parameters: {
            type: 'object',
            properties: {
              header: {
                type: 'string',
                description: 'Optional header text',
                nullable: true,
              },
              body: {
                type: 'string',
                description: 'Main body text shown to user',
              },
              footer: {
                type: 'string',
                description: 'Optional footer text',
                nullable: true,
              },
              buttonText: {
                type: 'string',
                description: 'Text of the list open button (e.g. "Select")',
              },
              sections: {
                type: 'array',
                description: 'Sections containing list row options',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Section title' },
                    rows: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            description: 'Stable row identifier',
                          },
                          title: {
                            type: 'string',
                            description: 'Row title displayed to user',
                          },
                          description: {
                            type: 'string',
                            description: 'Optional row description',
                            nullable: true,
                          },
                        },
                        required: ['id', 'title'],
                      },
                    },
                  },
                  required: ['title', 'rows'],
                },
              },
            },
            required: ['body', 'buttonText', 'sections'],
          },

          async handler({ header, body, footer, buttonText, sections }) {
            debug(`_send_interactive_list`, {
              header,
              body,
              footer,
              buttonText,
              sections,
            }).log('integration.whatsapp.queue.handleInteractEvent')

            if (!Array.isArray(sections) || sections.length === 0) {
              return
            }

            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${integration.phoneNumberId}/messages`,
              {
                method: 'POST',

                headers: {
                  Authorization: `Bearer ${integration.accessToken}`,
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  messaging_product: 'whatsapp',

                  to: payload.messages[0].from,

                  type: 'interactive',

                  interactive: {
                    type: 'list',

                    ...(header
                      ? { header: { type: 'text', text: header } }
                      : {}),

                    body: { text: body },

                    ...(footer ? { footer: { text: footer } } : {}),

                    action: {
                      button: buttonText,

                      sections: sections.map((s) => ({
                        title: s.title,

                        rows: s.rows.map((r) => ({
                          id: r.id,
                          title: r.title,

                          ...(r.description
                            ? { description: r.description }
                            : {}),
                        })),
                      })),
                    },
                  },
                }),
              }
            )

            if (!response.ok) {
              await captureObservation(
                'WhatsApp _send_interactive_list API call failed',
                {
                  whatsappIntegrationId: integration.id,
                  status: response.status,
                }
              )
            }
          },
        },

        {
          name: '_send_location',
          description: t`
            Send a location message to the WhatsApp user.

            Use when you want to show the user a specific location on the map.
          `,

          parameters: {
            type: 'object',
            properties: {
              latitude: {
                type: 'number',
                description: 'Latitude in decimal degrees',
              },
              longitude: {
                type: 'number',
                description: 'Longitude in decimal degrees',
              },
              name: {
                type: 'string',
                description: 'Optional location name/title',
                nullable: true,
              },
              address: {
                type: 'string',
                description: 'Optional location address/label',
                nullable: true,
              },
            },
            required: ['latitude', 'longitude'],
          },

          async handler({ latitude, longitude, name, address }) {
            debug(`_send_location`, {
              latitude,
              longitude,
              name,
              address,
            }).log('integration.whatsapp.queue.handleInteractEvent')

            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${integration.phoneNumberId}/messages`,
              {
                method: 'POST',

                headers: {
                  Authorization: `Bearer ${integration.accessToken}`,
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  messaging_product: 'whatsapp',

                  to: payload.messages[0].from,

                  type: 'location',

                  location: {
                    latitude,
                    longitude,
                    ...(name ? { name } : {}),
                    ...(address ? { address } : {}),
                  },
                }),
              }
            )

            if (!response.ok) {
              await captureObservation(
                'WhatsApp _send_location API call failed',
                {
                  whatsappIntegrationId: integration.id,
                  status: response.status,
                }
              )
            }
          },
        },

        {
          name: '_request_location',
          description: t`
            Ask the user to share their current location.

            Use when you need the user's location to proceed. Provide context on why it's needed.
          `,

          parameters: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Prompt asking user to share location',
              },
              buttonText: {
                type: 'string',
                description: 'Optional label for the share location button',
                nullable: true,
              },
            },
            required: ['prompt'],
          },

          async handler({ prompt, buttonText }) {
            debug(`_request_location`, { prompt, buttonText }).log(
              'integration.whatsapp.queue.handleInteractEvent'
            )

            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${integration.phoneNumberId}/messages`,
              {
                method: 'POST',

                headers: {
                  Authorization: `Bearer ${integration.accessToken}`,
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: payload.messages[0].from,
                  type: 'interactive',
                  interactive: {
                    type: 'location_request_message',
                    body: {
                      text: prompt,
                    },
                    action: {
                      name: 'send_location',
                    },
                  },
                }),
              }
            )

            if (!response.ok) {
              await captureObservation(
                'WhatsApp _request_location API call failed',
                {
                  whatsappIntegrationId: integration.id,
                  status: response.status,
                }
              )
            }
          },
        },

        {
          name: '_start_new_conversation',
          description: t`
            This function can be used to start a new conversation with the WhatsApp user.
            
            It will reset the current conversation and start a new one.
            
            The function must be explicitly requested by the user.
          `,

          parameters: {
            type: 'object',
            properties: {},
          },

          async handler() {
            debug(`_start_new_conversation`).log(
              'integration.whatsapp.queue.handleInteractEvent'
            )

            await deleteWhatsAppSessionConversationId({ sessionKey })
          },
        },
      ],
    },
  }).catch(async (error) => {
    await watch?.dispose()

    throw error
  })

  try {
    let sentSome = false

    for (const message of payload.messages) {
      debug(`message`, { message }).log(
        'integration.whatsapp.queue.handleInteractEvent'
      )

      if (message.location) {
        debug(`location`, { location: message.location }).log(
          'integration.whatsapp.queue.handleInteractEvent'
        )

        const { latitude, longitude, name, address } = message.location

        const locationTextParts = [
          `[location lat=${latitude} lon=${longitude}`,
          name ? `name="${name.replace(/"/g, '\\"')}"` : null,
          address ? `address="${address.replace(/"/g, '\\"')}"` : null,
          `]`,
        ].filter(Boolean)

        const locationText = locationTextParts.join(' ')

        sentSome = true

        await engine.send(locationText)
      }

      const media =
        message.image ||
        message.audio ||
        message.video ||
        message.document ||
        message.sticker

      if (media) {
        debug(`media`, { type: message.type, media }).log(
          'integration.whatsapp.queue.handleInteractEvent'
        )

        if (integration.attachments) {
          try {
            const maxFileSize = await getMaxFileSize(integration.user)

            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${media.id}`,
              {
                headers: {
                  Authorization: `Bearer ${integration.accessToken}`,
                },
              }
            )

            if (!response.ok) {
              throw await getFetchError(response)
            }

            const { url: responseUrl } = await response.json()

            if (!responseUrl) {
              throw new Error('WhatsApp media metadata has no URL')
            }

            const {
              attachmentId,
              name: attachmentName,
              type: attachmentType,
            } = await uploadConversationAttachmentFromURL(
              conversationId,
              responseUrl,
              {
                Authorization: `Bearer ${integration.accessToken}`,
                'User-Agent':
                  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
              },
              { maxSize: maxFileSize }
            )

            const { request: activityRequest, response: activityResponse } =
              makeConversationAttachmentUploadActivityMessages({
                id: attachmentId,
                name: attachmentName,
                type: attachmentType,
              })

            await engine.addMessages([activityRequest, activityResponse])

            sentSome = true
          } catch (error) {
            await captureObservation('WhatsApp attachment upload failed', {
              whatsappIntegrationId: integration.id,
              conversationId,
              messageId: message.id,
              mediaType: message.type,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        } else {
          debug(`attachments not supported`).log(
            'integration.whatsapp.queue.handleInteractEvent'
          )
        }

        if ('caption' in media && media.caption) {
          debug(`caption`, { caption: media.caption }).log(
            'integration.whatsapp.queue.handleInteractEvent'
          )

          sentSome = true

          await engine.send(media.caption)
        }
      }

      if (message.text) {
        debug(`text`, { text: message.text }).log(
          'integration.whatsapp.queue.handleInteractEvent'
        )

        sentSome = true

        await engine.send(message.text.body)
      }

      if (message.type === 'interactive' && message.interactive) {
        debug(`interactive`, { interactive: message.interactive }).log(
          'integration.whatsapp.queue.handleInteractEvent'
        )

        const { type, button_reply, list_reply } = message.interactive

        // @note we convert interactive selections into a structured textual form
        // that the engine can easily reason about while still exposing both the
        // stable id and the human readable title

        let selectionText

        if (type === 'button_reply' && button_reply) {
          selectionText = `[selection button id=${button_reply.id}] ${button_reply.title}`
        } else if (type === 'list_reply' && list_reply) {
          selectionText = `[selection list id=${list_reply.id}] ${list_reply.title}`
        }

        if (selectionText) {
          sentSome = true

          await engine.send(selectionText)
        }
      }
    }

    if (!sentSome) {
      debug(`no messages sent so bail out`).log(
        'integration.whatsapp.queue.handleInteractEvent'
      )

      return
    }

    await typing.trigger()

    // @note superseded before generation - the message is now in the
    // conversation, so skip producing a reply the latest message's handler will
    // coalesce. Cheap guard that avoids a doomed model call.
    if (superseding && (await supersede.isSuperseded())) {
      debug(`superseded before generation - skipping reply`).log(
        'integration.whatsapp.queue.handleInteractEvent'
      )

      return
    }

    const { text: receivedText } = await engine.receive()

    debug(`receivedText`, { receivedText }).log(
      'integration.whatsapp.queue.handleInteractEvent'
    )

    await sink.join()

    // @note the engine soft-yielded mid-turn because a newer message superseded
    // this one; its partial progress is stored, so skip the send and let the
    // latest message's handler produce the reply the user actually sees.
    if (watch?.didYield()) {
      debug(`yielded to a newer message - skipping send`).log(
        'integration.whatsapp.queue.handleInteractEvent'
      )

      return
    }

    // @note whatsapp does not guarantee the message delivery order - so we rather
    // than sending messages in a loop - we need to batch them together in as few
    // requests as possible - ideally one

    const splitMessages = await markdownToMessages(receivedText)

    debug(`splitMessages`, { messages: splitMessages }).log(
      'integration.whatsapp.queue.handleInteractEvent'
    )

    const mergedMessages = mergeMessagesByType(splitMessages)

    debug(`mergedMessages`, { messages: mergedMessages }).log(
      'integration.whatsapp.queue.handleInteractEvent'
    )

    const recipients = [
      ...new Map(
        payload.messages.map(({ from }) => [
          normalizeWhatsAppSessionPhone(from),
          from,
        ])
      ).values(),
    ].filter(Boolean)

    for (const message of mergedMessages) {
      for (const recipient of recipients) {
        const response = await fetchPlusPlus(
          `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${integration.phoneNumberId}/messages`,
          {
            method: 'POST',

            headers: {
              Authorization: `Bearer ${integration.accessToken}`,
              'Content-Type': 'application/json',
            },

            body: JSON.stringify({
              ...message,

              messaging_product: 'whatsapp',

              to: recipient,
            }),
          }
        )

        if (!response.ok) {
          const error = await getFetchError(response)

          await logEvent({
            user: { id: integration.userId },
            name: 'Failed WhatsApp message send',
            description: `Failed to send WhatsApp message to ${recipient}`,
            type: 'integration.whatsapp.api.error',
            relations: {
              blueprintId: integration.blueprintId,
              botId: integration.botId,
              whatsappIntegrationId: integration.id,
              conversationId: conversationId,
            },
            meta: {
              error: {
                message: error.message,
                code: error.code,
              },
            },
          })

          throw error
        }
      }
    }
  } finally {
    // @note stop watching the sender channel and tear down its subscription;
    // the turn is over (sent, yielded, or errored).
    if (watch) {
      await watch.dispose()
    }

    await engine.dispose()
  }
}

/**
 * @typedef {z.infer<typeof InitiatePayloadSchema>} InitiatePayload
 */
export const InitiatePayloadSchema = z.object({
  id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,128}$/)
    .optional(),
  to: z.string(),
  text: z.string(),
  context: z.record(z.string(), z.any()).optional(),
})

/**
 * @typedef {{
 *   type: typeof INITIATE_EVENT_TYPE,
 *   payload: InitiatePayload
 * }} InitiateEvent
 *
 * Handles the initiate event - sends an initial message to a WhatsApp user
 * and creates a conversation so that subsequent user replies are tracked.
 *
 * This is used for proactive outreach where the bot initiates the conversation
 * by sending a message to the user, rather than responding to a user message.
 *
 * @note WhatsApp requires that bot-initiated messages outside the 24-hour
 * messaging window use approved message templates. This handler sends a
 * plain text message which will only work within an active messaging window.
 *
 * @param {string} whatsappIntegrationId
 * @param {InitiatePayload} payload
 * @returns {Promise<void>}
 */
export async function handleInitiateEvent(whatsappIntegrationId, payload) {
  debug('initiate', { whatsappIntegrationId, payload }).log(
    'integration.whatsapp.queue.handleInitiateEvent'
  )

  const integration = await prisma.whatsappIntegration.findUnique({
    where: {
      id: whatsappIntegrationId,
    },

    include: {
      user: true,
      bot: true,
    },
  })

  if (!integration) {
    return throwNotFound(
      `WhatsappIntegration not found: ${whatsappIntegrationId}`
    )
  }

  if (!integration.accessToken || !integration.phoneNumberId) {
    await captureUnexpectedState(
      'WhatsApp initiate triggered for integration with missing credentials',
      {
        whatsappIntegrationId,
        hasAccessToken: !!integration.accessToken,
        hasPhoneNumberId: !!integration.phoneNumberId,
      }
    )

    return
  }

  if (!integration.bot) {
    await captureUnexpectedState(
      'WhatsApp initiate triggered for integration with no bot configured',
      { whatsappIntegrationId, integrationName: integration.name }
    )

    return
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    return throwLimitsReached(`Limits exceeded`)
  }

  if (integration.user) {
    updateSessionStore({
      user: userToSessionUser(integration.user),
    })

    setContextUser(integration.user)
  }

  const deliveryKey = payload.id
    ? `whatsapp-initiate-${integration.id}-${payload.id}`
    : null
  const deliveryState = deliveryKey ? await memcache.get(deliveryKey) : null

  if (deliveryState === 'complete') {
    debug(`skipping completed initiate delivery`, { deliveryKey }).log(
      'integration.whatsapp.queue.handleInitiateEvent'
    )

    return
  }

  // Send the initial message to WhatsApp via Meta Graph API

  if (deliveryState !== 'sent') {
    const response = await fetchPlusPlus(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${integration.phoneNumberId}/messages`,
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: payload.to,
          type: 'text',
          text: {
            body: payload.text,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await getFetchError(response)

      await captureUnexpectedState(
        'WhatsApp initiate message failed - user will not receive outreach',
        {
          whatsappIntegrationId: integration.id,
          to: payload.to,
          error: error.message,
        }
      )

      debug(`failed to send message`, { error }).log(
        'integration.whatsapp.queue.handleInitiateEvent'
      )

      await logEvent({
        user: { id: integration.userId },
        name: 'WhatsApp Initiate Message Error',
        description: `Failed to send initial message to ${payload.to}`,
        type: 'integration.whatsapp.api.error',
        relations: {
          whatsappIntegrationId: integration.id,
        },
        meta: {
          operation: 'messages.initiate',
          to: payload.to,
          reason: error.message,
        },
      })

      return
    }

    if (deliveryKey) {
      await memcache.set(deliveryKey, 'sent', {
        ex: INITIATE_DEDUPLICATION_TTL_SECONDS,
      })
    }
  }

  // @note create a session keyed by phone number so that subsequent
  // interactions from the same user can find this conversation

  const sessionKey = getWhatsAppInitiateSessionKey(integration.id, payload)

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  debug(`session key`, { sessionKey }).log(
    'integration.whatsapp.queue.handleInitiateEvent'
  )

  // @note if context is provided, add it as an activity so the bot has
  // background information about the recipient for future interactions
  const contextMessages = payload.context
    ? makeActivityMessagePair(
        '_getWhatsAppContext',
        { to: payload.to },
        { context: payload.context }
      )
    : []

  const messages = [
    ...makeActivityMessagePair(
      '_initiateConversation',
      {},
      {
        to: payload.to,
        initiatedAt: new Date().toISOString(),
      }
    ),
    ...contextMessages,
    {
      type: 'bot',
      text: payload.text,
    },
  ]

  const { id: conversationId } = await createConversation(integration.userId, {
    ...getConversationDetails(integration),

    messages,

    meta: {
      app: 'whatsapp',
      whatsapp: {
        integrationId: integration.id,
        to: payload.to,
        initiated: true,
      },
    },
  })

  if (persist) {
    await setWhatsAppSessionConversationId({
      sessionKey,
      conversationId,
      sessionDurationSecs: ttlSecs,
    })
  }

  debug(`conversation created`, { conversationId, sessionKey }).log(
    'integration.whatsapp.queue.handleInitiateEvent'
  )

  if (deliveryKey) {
    await memcache.set(deliveryKey, 'complete', {
      ex: INITIATE_DEDUPLICATION_TTL_SECONDS,
    })
  }
}

/**
 * @param {string} whatsappIntegrationId
 * @param {InteractEvent|InitiateEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(whatsappIntegrationId, event) {
  switch (true) {
    case event.type === INTERACT_EVENT_TYPE: {
      await parseAsync(InteractPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === INITIATE_EVENT_TYPE: {
      await parseAsync(InitiatePayloadSchema, event.payload, captureInputError)

      break
    }
  }

  if (event.type === INTERACT_EVENT_TYPE) {
    const messagesBySender = new Map()

    for (const message of event.payload.messages) {
      const sender = normalizeWhatsAppSessionPhone(message.from)
      const messages = messagesBySender.get(sender) || []

      messages.push(message)
      messagesBySender.set(sender, messages)
    }

    if (messagesBySender.size > 1) {
      for (const [sender, messages] of messagesBySender) {
        await sendEvent(whatsappIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: {
            ...event.payload,
            contacts: (event.payload.contacts || []).filter(
              ({ wa_id }) => normalizeWhatsAppSessionPhone(wa_id) === sender
            ),
            messages,
            order: undefined,
          },
        })
      }

      return
    }

    // @note allocate a per-sender order and nudge any in-flight handler for an
    // earlier message so it can soft-yield; thread the order into the (validated)
    // payload. Dispatch is already serialized per sender via the flow below.
    event.payload.order = await allocateOrder(
      getWhatsAppInteractSessionKey(whatsappIntegrationId, event.payload)
    )
  }

  await queue(
    `/api/v1/integration/whatsapp/${whatsappIntegrationId}/queue`,
    event,
    {
      ...(event.type === INTERACT_EVENT_TYPE
        ? {
            deduplicationId: `whatsapp-${whatsappIntegrationId}-${
              event.type
            }-${event.payload.messages.map(({ id }) => id).join(',')}`,

            flow: {
              key: `whatsapp-${whatsappIntegrationId}-${
                event.type
              }-${getWhatsAppInteractSessionId(event.payload)}`,

              parallel: 1,
            },
          }
        : event.type === INITIATE_EVENT_TYPE && event.payload.id
        ? {
            deduplicationId: `whatsapp-${whatsappIntegrationId}-${event.type}-${event.payload.id}`,
            flow: {
              key: `whatsapp-${whatsappIntegrationId}-${
                event.type
              }-${normalizeWhatsAppSessionPhone(event.payload.to)}`,
              parallel: 1,
            },
          }
        : {}),
    }
  )
}

/**
 */
export default withQueueHandlerBounded('whatsappIntegrationId', {
  [INTERACT_EVENT_TYPE]: {
    handler: handleInteractEvent,
    schema: InteractPayloadSchema,
  },
  [INITIATE_EVENT_TYPE]: {
    handler: handleInitiateEvent,
    schema: InitiatePayloadSchema,
  },
})

/**
 * @manual WhatsApp Integration
 *
 * ## Background Processing
 *
 * Incoming WhatsApp messages are processed asynchronously in the background,
 * so Meta's webhook is acknowledged immediately and the bot delivers its
 * reply when ready. This ensures reliable message handling even under high
 * load. Duplicate webhook deliveries from Meta are safely ignored, and rapid
 * messages from the same user are handled in order so the conversation stays
 * coherent.
 *
 * ## Conversation Sessions
 *
 * Each WhatsApp number has its own independent conversation context. The
 * `sessionDuration` setting controls how long that context persists between
 * messages, allowing natural conversation breaks while preserving history
 * within an active session. When a session expires, the next message from
 * that user starts a fresh conversation.
 *
 * Users can manually reset their session at any time by sending `/restart`,
 * `/reset`, or `/new`, which immediately clears the current context and
 * starts a new conversation.
 *
 * ## Contact Collection
 *
 * When enabled, contact information for users who message your bot is
 * automatically captured into the contact database, deduplicated by phone
 * number, so you can track and follow up with the people interacting with
 * your bot.
 *
 * ## Supported Message Types
 *
 * The integration handles a variety of message types from WhatsApp users:
 *
 * - **Text** - Plain text messages are processed conversationally by the bot.
 *
 * - **Image** - When attachments are enabled, images sent by users are made
 *   available to vision-enabled AI models. Captions accompanying images are
 *   processed as text input.
 *
 * - **Audio** - Voice messages are stored as conversation attachments,
 *   enabling transcription and downstream processing.
 *
 * - **Interactive** - Button clicks and list selections from previously sent
 *   interactive messages are passed to the bot in a way that preserves both
 *   the user-visible label and the underlying selection so the bot can
 *   reliably understand the user's choice.
 *
 * - **Location** - Shared locations are passed to the bot with coordinates,
 *   name, and address, enabling location-aware conversational responses.
 *
 * ## Interactive Bot Responses
 *
 * The bot can reply with rich interactive elements in addition to plain text:
 *
 * - **Quick-reply Buttons** - Up to three buttons that produce a structured
 *   response when clicked. Ideal for yes/no questions or limited choice
 *   scenarios.
 *
 * - **Lists** - Organized lists with multiple sections and rows, allowing
 *   users to select from many options without cluttering the conversation.
 *
 * - **Location Requests** - Prompt the user to share their location, with an
 *   explanation of why the information is needed.
 *
 * - **Location Sharing** - Send a specific location to the user, displayed on
 *   a map with optional name and address labels.
 *
 * - **Progress Updates** - Send intermediate progress messages during
 *   long-running operations so users stay informed without waiting silently
 *   for the full response.
 *
 * ## Typing Indicators and Response Formatting
 *
 * While the bot is preparing a reply, a typing indicator is displayed to the
 * user as visual feedback that their message is being handled. AI-generated
 * markdown responses are formatted appropriately for WhatsApp, with longer
 * replies split as needed and consecutive messages of the same type merged
 * to keep the conversation tidy.
 *
 * ## Reliability
 *
 * If processing one part of a message fails - for example, a single
 * attachment cannot be downloaded - the rest of the message continues to be
 * handled normally. Transient failures when sending replies are retried with
 * backoff to avoid losing responses to temporary issues.
 */
