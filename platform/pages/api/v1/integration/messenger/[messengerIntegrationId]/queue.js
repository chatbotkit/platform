/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Meta Graph) */
// @ts-check
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
import debug from '@/lib/debug'
import { captureInputError, captureUnexpectedState } from '@/lib/error'
import { fetchPlusPlus, getFetchError } from '@/lib/fetch'
import { logIntegrationApiError } from '@/lib/integration.api.error'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import memcache from '@/lib/memcache'
import { allocateOrder, messagingSupersede } from '@/lib/messaging.supersede'
import { markdownToMessages } from '@/lib/messenger.markdown'
import { getMetaUserInfo } from '@/lib/meta.user'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import {
  throwBadRequest,
  throwConflict,
  throwLimitsReached,
  throwNotFound,
} from '@/lib/response'
import { updateSessionStore } from '@/lib/session.context'
import { resolveSessionDuration } from '@/lib/session.duration'
import { getMaxFileSize } from '@/lib/user.limits'
import { userToSessionUser } from '@/lib/user.session'
import { parseAsync } from '@/lib/zod.schema'

import { z } from 'zod'

export const MESSENGER_CONTACT_NAMESPACE =
  '44df431b-dfbb-4d9f-9041-d6ed06bae475' // @note do not change

// @note Meta Graph API version - update this when migrating to newer API versions
export const META_GRAPH_API_VERSION = 'v21.0'

// @note Meta Page Inbox App ID for human agent handoff via pass_thread_control API
export const META_PAGE_INBOX_APP_ID = '263902037430900'

export const INTERACT_EVENT_TYPE = 'interact'
export const INITIATE_EVENT_TYPE = 'initiate'

export const InteractPayloadBasicSchema = z.object({
  sender: z.object({
    id: z.string(),
  }),

  recipient: z.object({
    id: z.string(),
  }),

  timestamp: z.number(),

  // @note per-sender monotonic order allocated on the webhook path (see
  // allocateOrder); threaded here so the handler can detect it has been
  // superseded by a newer message. Optional for backward-compat with events
  // enqueued before supersede was wired. On the shared base so both the message
  // and postback variants carry it.
  order: z.number().optional(),
})

export const InteractPayloadPostbackSchema = InteractPayloadBasicSchema.extend({
  postback: z.object({
    title: z.string(),
    payload: z.string(),
  }),
})

export const InteractPayloadMessageSchema = InteractPayloadBasicSchema.extend({
  message: z.object({
    mid: z.string(),
    text: z.string().optional(),
    attachments: z
      .array(
        z.object({
          type: z.string(),
          payload: z.object({
            url: z.string(),
          }),
        })
      )
      .optional(),
  }),
})

/**
 * @typedef {z.infer<typeof InteractPayloadSchema>} InteractPayload
 */
export const InteractPayloadSchema = z.union([
  InteractPayloadPostbackSchema,
  InteractPayloadMessageSchema,
])

/**
 * @typedef {z.infer<typeof InitiatePayloadSchema>} InitiatePayload
 */
export const InitiatePayloadSchema = z.object({
  pageId: z.string(),
  recipientId: z.string(),
  text: z.string(),
  context: z.record(z.string(), z.any()).optional(),
})

/**
 * @param {string} messengerIntegrationId
 * @param {Pick<InteractPayload, 'sender'>} payload
 * @returns {string}
 */
export function getMessengerInteractSessionKey(
  messengerIntegrationId,
  payload
) {
  return `messenger-session-${messengerIntegrationId}-${payload.sender.id}`
}

/**
 * @param {string} messengerIntegrationId
 * @param {Pick<InitiatePayload, 'recipientId'>} payload
 * @returns {string}
 */
export function getMessengerInitiateSessionKey(
  messengerIntegrationId,
  payload
) {
  return `messenger-session-${messengerIntegrationId}-${payload.recipientId}`
}

/**
 * @param {{ sessionKey: string }} options
 * @returns {Promise<string | null>}
 */
export async function resolveMessengerSessionConversationId({ sessionKey }) {
  return await memcache.get(sessionKey)
}

/**
 * @param {{ sessionKey: string, conversationId: string, sessionDurationSecs: number }} options
 * @returns {Promise<void>}
 */
export async function setMessengerSessionConversationId({
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
export async function bumpMessengerSessionConversationId({
  sessionKey,
  sessionDurationSecs,
}) {
  await memcache.expire(sessionKey, sessionDurationSecs)
}

/**
 * @param {{ sessionKey: string }} options
 * @returns {Promise<void>}
 */
export async function deleteMessengerSessionConversationId({ sessionKey }) {
  await memcache.del(sessionKey)
}

/**
 * @param {{
 *   integration: { id: string, userId?: string | null },
 *   name: string,
 *   description: string,
 *   operation: string,
 *   error: unknown,
 *   pageId?: string,
 *   recipientId?: string,
 *   senderId?: string,
 *   conversationId?: string | null,
 *   messageType?: string,
 * }} options
 * @returns {Promise<void>}
 */
async function logMessengerApiError({
  integration,
  name,
  description,
  operation,
  error,
  pageId,
  recipientId,
  senderId,
  conversationId,
  messageType,
}) {
  if (!integration.userId) {
    return
  }

  await logIntegrationApiError({
    userId: integration.userId,
    type: 'integration.messenger.api.error',
    name,
    description,
    relations: {
      messengerIntegrationId: integration.id,
      conversationId,
    },
    operation,
    error,
    meta: {
      pageId,
      recipientId,
      senderId,
      messageType,
    },
  })
}

/**
 * @param {{id: string, userId?: string | null, accessToken: string}} integration
 * @param {string} pageId
 * @param {{id: string}} recipient
 * @param {'typing_on'|'typing_off'} senderAction
 * @returns {Promise<void>}
 */
async function sendMessengerSenderAction(
  integration,
  pageId,
  recipient,
  senderAction
) {
  const response = await fetchPlusPlus(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${pageId}/messages?access_token=${encodeURIComponent(
      integration.accessToken
    )}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient,
        sender_action: senderAction,
      }),
    }
  )

  if (!response.ok) {
    const error = await getFetchError(response)

    await captureUnexpectedState(
      `Messenger sender action failed - ${senderAction} indicator not delivered`,
      {
        messengerIntegrationId: integration.id,
        recipientId: recipient.id,
        error: error.message,
      }
    )

    await logMessengerApiError({
      integration,
      name: 'Messenger Sender Action Error',
      description: `Failed to send Messenger ${senderAction} sender action.`,
      operation: 'messages.sender_action',
      error,
      pageId,
      recipientId: recipient.id,
      messageType: senderAction,
    })
  }
}

/**
 * @typedef {{
 *   type: typeof INTERACT_EVENT_TYPE,
 *   payload: InteractPayload
 * }} InteractEvent
 *
 * @param {string} messengerIntegrationId
 * @param {InteractPayload} payload
 * @returns {Promise<void>}
 */
export async function handleInteractEvent(
  messengerIntegrationId,
  payload,
  context
) {
  debug(`interact`, { messengerIntegrationId, payload })

  payload = await InteractPayloadSchema.parseAsync(payload)

  const integration = await prisma.messengerIntegration.findUnique({
    where: {
      id: messengerIntegrationId,
    },

    include: {
      user: true, // @note super important

      bot: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(
      `MessengerIntegration not found: ${messengerIntegrationId}`
    )
  }

  if (!integration.bot) {
    debug(`skipping - no bot configured`).log(
      'integration.messenger.queue.handleInteractEvent'
    )

    return
  }

  if (!integration.accessToken) {
    return throwConflict(
      `MessengerIntegration not configured: ${messengerIntegrationId}`
    )
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    // @note the account is over its usage limits - post a pre-canned reply so
    // the user gets a visible signal instead of silence. Best-effort: a failed
    // send must not mask the underlying limit condition.
    if (integration.accessToken) {
      try {
        const response = await fetchPlusPlus(
          `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
            payload.recipient.id
          }/messages?access_token=${encodeURIComponent(
            integration.accessToken
          )}`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
            },

            body: JSON.stringify({
              recipient: payload.sender,

              message_type: 'RESPONSE',

              message: {
                text: messages.limitsReachedReply,
              },
            }),
          }
        )

        if (!response.ok) {
          const error = await getFetchError(response)

          debug(`limit reply send failed`, { error }).log(
            'integration.messenger.queue.handleInteractEvent'
          )
        }
      } catch (error) {
        debug(`limit reply send failed`, { error }).log(
          'integration.messenger.queue.handleInteractEvent'
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

  if ('postback' in payload) {
    debug(`handling postback`, { postback: payload.postback })

    if (payload.postback.payload === 'GET_STARTED') {
      // send a welcome message to the user
      {
        const response = await fetchPlusPlus(
          `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
            payload.recipient.id
          }/messages?access_token=${encodeURIComponent(
            integration.accessToken
          )}`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
            },

            body: JSON.stringify({
              recipient: payload.sender,

              message: {
                text: `Hi! How can I help you today?`,
              },
            }),
          }
        )

        if (!response.ok) {
          const error = await getFetchError(response)

          throw error
        }
      }

      return
    }

    if (payload.postback.payload !== 'HUMAN_AGENT') {
      debug(`skipping postback`, { payload: payload.postback.payload }).log(
        'integration.messenger.queue.handleInteractEvent'
      )

      return
    }

    // send a message to the user that a human agent will be with them shortly
    {
      const response = await fetchPlusPlus(
        `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
          payload.recipient.id
        }/messages?access_token=${encodeURIComponent(integration.accessToken)}`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            recipient: payload.sender,

            message: {
              text: `A human agent will be with you shortly.`,
            },
          }),
        }
      )

      if (!response.ok) {
        const error = await getFetchError(response)

        throw error
      }
    }

    // transfer the conversation to a human agent, i.e messenger inbox
    {
      const response = await fetchPlusPlus(
        `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
          payload.recipient.id
        }/pass_thread_control?access_token=${encodeURIComponent(
          integration.accessToken
        )}`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            recipient: payload.sender,

            target_app_id: META_PAGE_INBOX_APP_ID,
          }),
        }
      )

      if (!response.ok) {
        const error = await getFetchError(response)

        throw error
      }
    }
  } else if ('message' in payload) {
    debug(`handling message`, { message: payload.message })

    const sessionKey = getMessengerInteractSessionKey(integration.id, payload)

    const { persist, ttlSecs } = resolveSessionDuration(
      integration.sessionDuration
    )

    // @note supersede + soft-yield: a newer message from the same sender (a rapid
    // follow-up) should steer this turn rather than queue a second reply. Only
    // meaningful when sessions persist and the webhook allocated an order (events
    // enqueued before supersede was wired carry none).
    const superseding = persist && payload.order != null

    const supersede = messagingSupersede(sessionKey, payload.order ?? 0)

    const watch = superseding ? supersede.watch() : null

    // @todo we should check for exact commands only

    if (
      ['/restart', '/reset', '/new'].includes(
        payload.message.text?.trim().toLowerCase() || ''
      )
    ) {
      debug(`restart`)

      await deleteMessengerSessionConversationId({ sessionKey })

      return
    }

    let conversationId = persist
      ? await resolveMessengerSessionConversationId({
          sessionKey,
        })
      : null

    // @note resolve who sent the current message on every turn (cached) so the
    // bot stays aware of the sender even on existing conversations, surfaced to
    // the model via the userInfo feature (a soft activity message, never
    // persisted). The opaque sender id is always available; the name is resolved
    // via a cached Graph lookup (mirrors Slack's getUserInfo) and reused for
    // contact creation below.
    const metaUser = await getMetaUserInfo(payload.sender.id, {
      accessToken: integration.accessToken,
      fields: 'first_name,last_name',
      version: META_GRAPH_API_VERSION,
    })

    const metaUserName = metaUser
      ? [metaUser.first_name, metaUser.last_name].filter(Boolean).join(' ')
      : ''

    const userInfo = metaUser
      ? {
          name: metaUserName || undefined,
          externalId: payload.sender.id,
          source: 'messenger',
        }
      : { externalId: payload.sender.id, source: 'messenger' }

    const reusable = !!conversationId && (await hasConversation(conversationId))

    // @note slide the session window: refresh the TTL on every reuse so an
    // active conversation is not cut off at a fixed offset from its creation.
    if (persist && reusable) {
      await bumpMessengerSessionConversationId({
        sessionKey,
        sessionDurationSecs: ttlSecs,
      })
    }

    if (!conversationId || !reusable) {
      let contactId

      {
        if (integration.contactCollection && metaUser) {
          const contact = await ensureTrustedContact(
            { id: integration.userId },
            {
              name: metaUserName,

              meta: {
                app: 'messenger',
              },
            },
            createContactFingerprint(MESSENGER_CONTACT_NAMESPACE, [
              payload.sender.id,
            ])
          )

          contactId = contact.id
        }
      }

      const { id: cid } = await createConversation(integration.userId, {
        contactId,

        ...getConversationDetails(integration),

        meta: {
          app: 'messenger',

          messenger: {
            integrationId: integration.id,
          },
        },
      })

      conversationId = cid

      if (persist) {
        await setMessengerSessionConversationId({
          sessionKey,
          conversationId,
          sessionDurationSecs: ttlSecs,
        })
      }
    }

    const engine = await getStatefulConversationEngine({
      conversationId: conversationId,

      options: {
        signal: context?.signal,

        // @note fire-once per-mark signals from the queue monitor; the engine's
        // `timeoutMarks` feature listens to these. NOT cancellation signals

        markSignals: context?.markSignals,

        // @note cooperative soft-yield: tripped when a newer message from the
        // same sender supersedes this turn, so the engine stops at its next
        // iteration boundary instead of finishing a reply that is thrown away.

        yieldSignal: watch?.yieldSignal,

        features: [
          // @note surface who sent the current message to the model for this
          // turn only (soft activity message, never persisted)

          { name: 'userInfo', options: userInfo },

          // @note record a checkpoint activity into the conversation each time the
          // queue handler crosses a timeout-budget mark (driven by markSignals
          // above), visible to the model on the next turn

          { name: 'timeoutMarks' },

          // @note auth is required to prompt the model to ask the user to
          // re-authenticate any secrets that are missing or expired

          { name: 'auth' },

          // @note time gives the model reliable current date/time awareness
          // instead of guessing from stale training data

          { name: 'time' },

          // @note if attachments are enabled, the model should have the ability
          // to read them from the context and reference them in its responses

          ...(integration.attachments
            ? [{ name: 'attachments' }]
            : /** @type {any[]} */ ([])),
        ],

        // @todo add extra backstory to indicate that this conversation is happening over messenger

        userId: integration.userId,
      },
    })

    try {
      let sentSome = false

      if (payload.message.attachments?.length) {
        debug(`attachments`, { attachments: payload.message.attachments })

        // @note cap ingested attachments at the account plan's max file size.
        // Without this the shared upload guard treated a missing limit as 0 and
        // rejected every file (see lib/conversation.attachment.js).
        const maxFileSize = await getMaxFileSize(integration.user)

        for (const attachment of payload.message.attachments) {
          debug(`attachment`, { attachment })

          if (integration.attachments) {
            const responseUrl = attachment.payload.url

            const {
              attachmentId,
              name: attachmentName,
              type: attachmentType,
            } = await uploadConversationAttachmentFromURL(
              conversationId,
              responseUrl,
              undefined,
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
          } else {
            debug(`attachments not supported`)
          }
        }
      }

      if (payload.message.text) {
        debug(`text`, { text: payload.message.text })

        sentSome = true

        await engine.send(payload.message.text)
      }

      if (!sentSome) {
        debug(`no messages sent so bail out`)

        return
      }

      await sendMessengerSenderAction(
        /** @type {{ id: string, accessToken: string }} */ (integration),
        payload.recipient.id,
        payload.sender,
        'typing_on'
      )

      try {
        // @note superseded before generation - the message is now in the
        // conversation, so skip producing a reply the latest message's handler
        // will coalesce. Cheap guard that avoids a doomed model call.
        if (superseding && (await supersede.isSuperseded())) {
          debug(`superseded before generation - skipping reply`)

          return
        }

        const { text } = await engine.receive()

        // @note the engine soft-yielded mid-turn because a newer message
        // superseded this one; its partial progress is stored, so skip the send
        // and let the latest message's handler produce the reply.
        if (watch?.didYield()) {
          debug(`yielded to a newer message - skipping send`)

          return
        }

        const messages = await markdownToMessages(text)

        debug(`messages`, { messages })

        for (const message of messages) {
          if (message.type === 'text') {
            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
                payload.recipient.id
              }/messages?access_token=${encodeURIComponent(
                integration.accessToken
              )}`,
              {
                method: 'POST',

                headers: {
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  recipient: payload.sender,

                  message_type: 'RESPONSE',

                  message: {
                    text: message.text.body,
                  },
                }),
              }
            )

            if (!response.ok) {
              const error = await getFetchError(response)

              await logMessengerApiError({
                integration,
                name: 'Messenger Message Send Error',
                description: 'Failed to send Messenger bot text response.',
                operation: 'messages.create',
                error,
                pageId: payload.recipient.id,
                recipientId: payload.sender.id,
                senderId: payload.recipient.id,
                conversationId,
                messageType: message.type,
              })

              throw error
            }
          } else if (message.type === 'quickReplies') {
            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
                payload.recipient.id
              }/messages?access_token=${encodeURIComponent(
                integration.accessToken
              )}`,
              {
                method: 'POST',

                headers: {
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  recipient: payload.sender,

                  message_type: 'RESPONSE',

                  messaging_type: 'RESPONSE',

                  message: {
                    text: message.text.body,
                    quick_replies: message.quickReplies,
                  },
                }),
              }
            )

            if (!response.ok) {
              const error = await getFetchError(response)

              await logMessengerApiError({
                integration,
                name: 'Messenger Quick Replies Send Error',
                description: 'Failed to send Messenger quick replies response.',
                operation: 'messages.create',
                error,
                pageId: payload.recipient.id,
                recipientId: payload.sender.id,
                senderId: payload.recipient.id,
                conversationId,
                messageType: message.type,
              })

              throw error
            }
          } else if (message.type === 'image') {
            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
                payload.recipient.id
              }/messages?access_token=${encodeURIComponent(
                integration.accessToken
              )}`,
              {
                method: 'POST',

                headers: {
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  recipient: payload.sender,

                  message_type: 'RESPONSE',

                  message: {
                    attachment: {
                      type: 'image',

                      payload: {
                        url: message.image.link,
                      },
                    },
                  },
                }),
              }
            )

            if (!response.ok) {
              const error = await getFetchError(response)

              await logMessengerApiError({
                integration,
                name: 'Messenger Image Send Error',
                description: 'Failed to send Messenger bot image.',
                operation: 'messages.create',
                error,
                pageId: payload.recipient.id,
                recipientId: payload.sender.id,
                senderId: payload.recipient.id,
                conversationId,
                messageType: message.type,
              })

              throw error
            }
          } else if (message.type === 'video') {
            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
                payload.recipient.id
              }/messages?access_token=${encodeURIComponent(
                integration.accessToken
              )}`,
              {
                method: 'POST',

                headers: {
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  recipient: payload.sender,

                  message_type: 'RESPONSE',

                  message: {
                    attachment: {
                      type: 'video',

                      payload: {
                        url: message.video.link,
                      },
                    },
                  },
                }),
              }
            )

            if (!response.ok) {
              const error = await getFetchError(response)

              await logMessengerApiError({
                integration,
                name: 'Messenger Video Send Error',
                description: 'Failed to send Messenger bot video.',
                operation: 'messages.create',
                error,
                pageId: payload.recipient.id,
                recipientId: payload.sender.id,
                senderId: payload.recipient.id,
                conversationId,
                messageType: message.type,
              })

              throw error
            }
          } else if (message.type === 'audio') {
            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
                payload.recipient.id
              }/messages?access_token=${encodeURIComponent(
                integration.accessToken
              )}`,
              {
                method: 'POST',

                headers: {
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  recipient: payload.sender,

                  message_type: 'RESPONSE',

                  message: {
                    attachment: {
                      type: 'audio',

                      payload: {
                        url: message.audio.link,
                      },
                    },
                  },
                }),
              }
            )

            if (!response.ok) {
              const error = await getFetchError(response)

              await logMessengerApiError({
                integration,
                name: 'Messenger Audio Send Error',
                description: 'Failed to send Messenger bot audio.',
                operation: 'messages.create',
                error,
                pageId: payload.recipient.id,
                recipientId: payload.sender.id,
                senderId: payload.recipient.id,
                conversationId,
                messageType: message.type,
              })

              throw error
            }
          } else if (message.type === 'file') {
            const response = await fetchPlusPlus(
              `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
                payload.recipient.id
              }/messages?access_token=${encodeURIComponent(
                integration.accessToken
              )}`,
              {
                method: 'POST',

                headers: {
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  recipient: payload.sender,

                  message_type: 'RESPONSE',

                  message: {
                    attachment: {
                      type: 'file',

                      payload: {
                        url: message.file.link,
                      },
                    },
                  },
                }),
              }
            )

            if (!response.ok) {
              const error = await getFetchError(response)

              await logMessengerApiError({
                integration,
                name: 'Messenger File Send Error',
                description: 'Failed to send Messenger bot file.',
                operation: 'messages.create',
                error,
                pageId: payload.recipient.id,
                recipientId: payload.sender.id,
                senderId: payload.recipient.id,
                conversationId,
                messageType: message.type,
              })

              throw error
            }
          }
        }
      } finally {
        await sendMessengerSenderAction(
          /** @type {{ id: string, accessToken: string }} */ (integration),
          payload.recipient.id,
          payload.sender,
          'typing_off'
        )
      }
    } finally {
      // @note stop watching the sender channel and tear down its subscription;
      // the turn is over (sent, yielded, or errored).
      if (watch) {
        await watch.dispose()
      }

      await engine.dispose()
    }
  } else {
    throwBadRequest(`Unexpected payload`)
  }
}

/**
 * @typedef {{
 *   type: typeof INITIATE_EVENT_TYPE,
 *   payload: InitiatePayload
 * }} InitiateEvent
 *
 * Handles a free-form Messenger message to a known recipient ID.
 *
 * @note Meta only allows free-form automated messages to eligible recipients
 * inside the active messaging window. Outside that window, Meta may reject the
 * API call unless a valid policy exception/message tag is used.
 *
 * @param {string} messengerIntegrationId
 * @param {InitiatePayload} payload
 * @returns {Promise<void>}
 */
export async function handleInitiateEvent(messengerIntegrationId, payload) {
  debug(`initiate`, { messengerIntegrationId, payload }).log(
    'integration.messenger.queue.handleInitiateEvent'
  )

  const integration = await prisma.messengerIntegration.findUnique({
    where: {
      id: messengerIntegrationId,
    },

    include: {
      user: true,
      bot: true,
    },
  })

  if (!integration) {
    return throwNotFound(
      `MessengerIntegration not found: ${messengerIntegrationId}`
    )
  }

  if (!integration.bot) {
    await captureUnexpectedState(
      'Messenger initiate triggered for integration with no bot configured',
      { messengerIntegrationId, integrationName: integration.name }
    )

    return
  }

  if (!integration.accessToken) {
    return throwConflict(
      `MessengerIntegration not configured: ${messengerIntegrationId}`
    )
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

  const response = await fetchPlusPlus(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${
      payload.pageId
    }/messages?access_token=${encodeURIComponent(integration.accessToken)}`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        recipient: {
          id: payload.recipientId,
        },

        messaging_type: 'RESPONSE',

        message: {
          text: payload.text,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await getFetchError(response)

    await captureUnexpectedState(
      'Messenger initiate message failed - recipient may be outside the allowed messaging window',
      {
        messengerIntegrationId: integration.id,
        pageId: payload.pageId,
        recipientId: payload.recipientId,
        error: error.message,
      }
    )

    debug(`failed to send message`, { error }).log(
      'integration.messenger.queue.handleInitiateEvent'
    )

    await logMessengerApiError({
      integration,
      name: 'Messenger Initiate Message Error',
      description: 'Failed to send Messenger initiate message.',
      operation: 'messages.create',
      error,
      pageId: payload.pageId,
      recipientId: payload.recipientId,
      messageType: 'text',
    })

    return
  }

  const sessionKey = getMessengerInitiateSessionKey(integration.id, payload)

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  const contextMessages = payload.context
    ? makeActivityMessagePair(
        '_getMessengerContext',
        { recipientId: payload.recipientId },
        { context: payload.context }
      )
    : []

  const messages = [
    ...makeActivityMessagePair(
      '_initiateConversation',
      {},
      {
        pageId: payload.pageId,
        recipientId: payload.recipientId,
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
      app: 'messenger',
      messenger: {
        integrationId: integration.id,
        pageId: payload.pageId,
        recipientId: payload.recipientId,
        initiated: true,
      },
    },
  })

  if (persist) {
    await setMessengerSessionConversationId({
      sessionKey,
      conversationId,
      sessionDurationSecs: ttlSecs,
    })
  }
}

/**
 * @param {string} messengerIntegrationId
 * @param {InteractEvent|InitiateEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(messengerIntegrationId, event) {
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
    // @note allocate a per-sender order and nudge any in-flight handler for an
    // earlier message so it can soft-yield; thread the order into the (validated)
    // payload and serialize the dispatch per sender so handlers run one at a
    // time.
    const sessionKey = getMessengerInteractSessionKey(
      messengerIntegrationId,
      event.payload
    )

    event.payload.order = await allocateOrder(sessionKey)

    await queue(
      `/api/v1/integration/messenger/${messengerIntegrationId}/queue`,
      event,
      { flow: { key: sessionKey, parallel: 1 } }
    )

    return
  }

  await queue(
    `/api/v1/integration/messenger/${messengerIntegrationId}/queue`,
    event,
    {}
  )
}

/**
 */
export default withQueueHandlerBounded('messengerIntegrationId', {
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
 * @note This is an internal queue endpoint and should not be documented in user-facing manual documentation
 */
