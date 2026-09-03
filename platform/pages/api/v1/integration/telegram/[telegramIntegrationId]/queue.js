/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Telegram) */
// @ts-check
import messages from '@/config/messages'

import prisma from '@/prisma/client'

import { makeActivityMessagePair } from '@/lib/activity'
import { getConversationDetails } from '@/lib/bot.conversation'
import {
  createContactFingerprint,
  ensureTrustedContact,
} from '@/lib/contact.create'
import { setContextNamespace, setContextUser } from '@/lib/context.store'
import {
  makeConversationAttachmentUploadActivityMessages,
  uploadConversationAttachmentFromURL,
} from '@/lib/conversation.attachment'
import { createConversation } from '@/lib/conversation.create'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { hasConversation } from '@/lib/conversation.find'
import { TAG_ERROR, createSinkEvent } from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import { captureInputError, captureUnexpectedState } from '@/lib/error'
import { fetchPlusPlus, getFetchError } from '@/lib/fetch'
import { logIntegrationApiError } from '@/lib/integration.api.error'
import { runTasks } from '@/lib/job'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import { messagingSupersede } from '@/lib/messaging.supersede'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import {
  throwConflict,
  throwLimitsReached,
  throwNotFound,
} from '@/lib/response'
import { updateSessionStore } from '@/lib/session.context'
import { resolveSessionDuration } from '@/lib/session.duration'
import { markdownToMessages } from '@/lib/telegram.markdown'
import {
  parseTelegramAllowFrom,
  telegramSenderIsAllowed,
} from '@/lib/telegram.validation'
import { getMaxFileSize } from '@/lib/user.limits'
import { userToSessionUser } from '@/lib/user.session'
import { parseAsync } from '@/lib/zod.schema'

import { z } from 'zod'

export const TELEGRAM_CONTACT_NAMESPACE = 'a12e2ec7-80e4-4e08-9480-59da798d4d79' // @note do not change

export const INTERACT_EVENT_TYPE = 'interact'
export const INITIATE_EVENT_TYPE = 'initiate'

/**
 * @typedef {z.infer<typeof InteractPayloadSchema>} InteractPayload
 */
export const InteractPayloadSchema = z.object({
  update_id: z.number(),
  message: z.object({
    business_connection_id: z.string().optional(),
    message_thread_id: z.number().optional(),
    chat: z.object({
      id: z.number(),
      type: z.enum(['private', 'group', 'supergroup', 'channel']),
      username: z.string().optional(),
    }),
    from: z.object({
      id: z.number(),
      username: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
    }),
    entities: z
      .array(
        z.object({
          type: z.string(),
          offset: z.number(),
          length: z.number(),
        })
      )
      .optional(),
    text: z.string().optional(),
    caption: z.string().optional(),
    photo: z
      .array(
        z.object({
          file_id: z.string(),
        })
      )
      .optional(),
    document: z
      .object({
        file_id: z.string(),
      })
      .optional(),
    voice: z
      .object({
        file_id: z.string(),
      })
      .optional(),
    audio: z
      .object({
        file_id: z.string(),
      })
      .optional(),
    video: z
      .object({
        file_id: z.string(),
      })
      .optional(),
  }),

  // @note no `order` field here, unlike the other messaging integrations. Their
  // supersede + soft-yield order is allocated on the webhook (allocateOrder) and
  // threaded through an added `order` field; Telegram instead uses its NATIVE
  // `update_id` above - a per-session monotonically-increasing integer already
  // in the payload - so the webhook calls `messagingSupersede(key, update_id)
  // .record()` (no INCR) and the handler reads `payload.update_id`. See
  // lib/messaging.supersede.ts.
})

/**
 * @param {string} telegramIntegrationId
 * @param {Pick<InteractPayload, 'message'>} payload
 * @returns {string}
 */
export function getTelegramInteractSessionKey(telegramIntegrationId, payload) {
  // @note one conversation per chat (chat.id): a DM is per-user (in a DM the
  // chat id IS the user id) and a group is one shared conversation. Forum-topic
  // supergroups get a separate conversation per topic via message_thread_id.
  const { chat, message_thread_id: threadId } = payload.message

  return (
    `telegram-session-${telegramIntegrationId}-${chat.id}` +
    (threadId ? `-thread-${threadId}` : '')
  )
}

/**
 * Legacy interact session key (chat.type + from.id), used only to migrate an
 * active conversation to the new chat.id-based key on first lookup after the
 * key scheme changed. Do not use for new writes.
 *
 * @param {string} telegramIntegrationId
 * @param {Pick<InteractPayload, 'message'>} payload
 * @returns {string}
 */
export function getTelegramLegacyInteractSessionKey(
  telegramIntegrationId,
  payload
) {
  return `telegram-session-${telegramIntegrationId}-${payload.message.chat.type}-${payload.message.from.id}`
}

/**
 * @param {string} telegramIntegrationId
 * @param {Pick<InitiatePayload, 'chatId'>} payload
 * @returns {string}
 */
export function getTelegramInitiateSessionKey(telegramIntegrationId, payload) {
  // @note keyed on the chat id to match getTelegramInteractSessionKey, so a
  // bot-initiated conversation is found when the user later replies. For a DM
  // the chat id is the user id.
  //
  // @todo forum-topic outreach: initiate can only post to a supergroup's
  // General topic today (InitiatePayloadSchema has no topic id), and General
  // replies carry no message_thread_id, so this thread-less key matches them.
  // To proactively reach a *specific* forum topic we'd need to: add an optional
  // messageThreadId to InitiatePayloadSchema, pass it to the initiate
  // sendMessage call, append `-thread-${messageThreadId}` here to mirror
  // getTelegramInteractSessionKey, and surface the field on the ability + public
  // initiate API. Revisit if per-topic outreach becomes a real use case.
  return `telegram-session-${telegramIntegrationId}-${payload.chatId}`
}

/**
 * @param {{ sessionKey: string, legacyKey?: string, sessionDurationSecs?: number }} options
 * @returns {Promise<string | null>}
 */
export async function resolveTelegramSessionConversationId({
  sessionKey,
  legacyKey,
  sessionDurationSecs,
}) {
  const conversationId = await memcache.get(sessionKey)

  if (conversationId) {
    return conversationId
  }

  // @note migrate an active conversation stored under the legacy
  // (chat.type + from.id) key onto the new chat.id-based key, so existing
  // sessions survive the key-scheme change. DMs migrate cleanly 1:1; group
  // sessions used the buggy per-user key and are intentionally left to start
  // fresh (different user → different legacy key → no accidental adoption).
  if (legacyKey) {
    const legacyConversationId = await memcache.get(legacyKey)

    if (legacyConversationId) {
      if (sessionDurationSecs !== undefined) {
        await memcache.set(sessionKey, legacyConversationId, {
          ex: sessionDurationSecs,
        })
      }

      return legacyConversationId
    }
  }

  return null
}

/**
 * @param {{ sessionKey: string, conversationId: string, sessionDurationSecs: number }} options
 * @returns {Promise<void>}
 */
export async function setTelegramSessionConversationId({
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
export async function bumpTelegramSessionConversationId({
  sessionKey,
  sessionDurationSecs,
}) {
  await memcache.expire(sessionKey, sessionDurationSecs)
}

/**
 * @param {{ sessionKey: string }} options
 * @returns {Promise<void>}
 */
export async function deleteTelegramSessionConversationId({ sessionKey }) {
  await memcache.del(sessionKey)
}

/**
 * @param {{
 *   integration: { id: string, userId?: string | null },
 *   name: string,
 *   description: string,
 *   operation: string,
 *   error: unknown,
 *   chatId?: number | string,
 *   conversationId?: string | null,
 *   messageType?: string,
 * }} options
 * @returns {Promise<void>}
 */
async function logTelegramApiError({
  integration,
  name,
  description,
  operation,
  error,
  chatId,
  conversationId,
  messageType,
}) {
  if (!integration.userId) {
    return
  }

  await logIntegrationApiError({
    userId: integration.userId,
    type: 'integration.telegram.api.error',
    name,
    description,
    relations: {
      telegramIntegrationId: integration.id,
      conversationId,
    },
    operation,
    error,
    meta: {
      chatId,
      messageType,
    },
  })
}

/**
 * @param {{id: string, userId?: string | null, botToken: string}} integration
 * @param {InteractPayload['message']} message
 * @returns {Promise<void>}
 */
async function sendTelegramTypingIndicator(integration, message) {
  const response = await fetchPlusPlus(
    `https://api.telegram.org/bot${integration.botToken}/sendChatAction`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_connection_id: message.business_connection_id || undefined,
        chat_id: message.chat.id,
        message_thread_id: message.message_thread_id || undefined,
        action: 'typing',
      }),
    }
  )

  if (!response.ok) {
    const error = await getFetchError(response)

    await captureUnexpectedState(
      'Telegram sendChatAction failed - typing indicator was not delivered',
      {
        telegramIntegrationId: integration.id,
        chatId: message.chat.id,
        error: error.message,
      }
    )

    await logTelegramApiError({
      integration,
      name: 'Telegram Typing Indicator Error',
      description: 'Failed to send Telegram typing indicator.',
      operation: 'sendChatAction',
      error,
      chatId: message.chat.id,
    })
  }
}

/**
 * Mirrors OpenClaw's Telegram typing lease behavior: pulse immediately, then
 * keep pulsing on a fixed cadence until the lease is stopped.
 *
 * @param {{id: string, botToken: string}} integration
 * @param {InteractPayload['message']} message
 * @param {{intervalMs?: number}=} options
 * @returns {Promise<{refresh: () => Promise<void>, stop: () => void}>}
 */
async function createTelegramTypingLease(integration, message, options = {}) {
  const intervalMs =
    typeof options.intervalMs === 'number' &&
    Number.isFinite(options.intervalMs)
      ? Math.max(1000, Math.floor(options.intervalMs))
      : 4000

  let stopped = false

  const refresh = async () => {
    if (stopped) {
      return
    }

    await sendTelegramTypingIndicator(integration, message)
  }

  await refresh()

  const timer = setInterval(() => {
    void refresh().catch(() => undefined)
  }, intervalMs)

  timer.unref?.()

  return {
    refresh,
    stop: () => {
      if (stopped) {
        return
      }

      stopped = true
      clearInterval(timer)
    },
  }
}

/**
 * @typedef {{
 *   type: typeof INTERACT_EVENT_TYPE,
 *   payload: InteractPayload
 * }} InteractEvent
 *
 * @param {string} telegramIntegrationId
 * @param {InteractPayload} payload
 * @returns {Promise<void>}
 */
export async function handleInteractEvent(
  telegramIntegrationId,
  payload,
  context
) {
  debug(`interact`, { telegramIntegrationId, payload })

  payload = await InteractPayloadSchema.parseAsync(payload)

  const integration = await prisma.telegramIntegration.findUnique({
    where: {
      id: telegramIntegrationId,
    },

    include: {
      user: true, // @note super important

      bot: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(
      `TelegramIntegration not found: ${telegramIntegrationId}`
    )
  }

  if (!integration.bot) {
    debug(`skipping - no bot configured`).log(
      'integration.telegram.queue.handleInteractEvent'
    )

    return
  }

  if (!integration.botToken) {
    return throwConflict(
      `TelegramIntegration not configured: ${telegramIntegrationId}`
    )
  }

  // check allowFrom restriction
  {
    const entries = parseTelegramAllowFrom(integration.allowFrom || '')

    if (
      !telegramSenderIsAllowed(
        payload.message.from.id,
        payload.message.chat.id,
        payload.message.from.username,
        entries
      )
    ) {
      debug(`sender not allowed`, {
        userId: payload.message.from.id,
        chatId: payload.message.chat.id,
        username: payload.message.from.username,
      }).log('integration.telegram.queue.handleInteractEvent')

      await logEvent({
        user: { id: integration.userId },
        name: 'Sender Blocked',
        description: `A message was blocked due to allowFrom restrictions.`,
        type: 'integration.telegram.blocked',
        relations: {
          telegramIntegrationId: integration.id,
        },
        meta: {
          userId: payload.message.from.id,
          chatId: payload.message.chat.id,
          username: payload.message.from.username,
        },
      })

      return
    }
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    // @note the account is over its usage limits - post a pre-canned reply so
    // the user gets a visible signal instead of silence. Best-effort: a failed
    // post must not mask the underlying limit condition.
    if (integration.botToken) {
      try {
        const response = await fetchPlusPlus(
          `https://api.telegram.org/bot${integration.botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              business_connection_id:
                payload.message.business_connection_id || undefined,
              chat_id: payload.message.chat.id,
              message_thread_id: payload.message.message_thread_id || undefined,
              text: messages.limitsReachedReply,
            }),
          }
        )

        if (!response.ok) {
          const error = await getFetchError(response)

          debug(`limit reply post failed`, { error: error.message }).log(
            'integration.telegram.queue.handleInteractEvent'
          )
        }
      } catch (error) {
        debug(`limit reply post failed`, { error }).log(
          'integration.telegram.queue.handleInteractEvent'
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

  // @note set the context namespace to blank so that we cannot use it to
  // authenticate the user in a shared-channel setting
  // @todo this is not a clear behavior and perhaps we should replace it with
  // a more clear way to handle this
  {
    if (!['private'].includes(payload.message.chat.type)) {
      debug(`unset context namespace because it is not a private chat`).log(
        'integration.telegram.queue.handleInteractEvent'
      )

      setContextNamespace('')
    }
  }

  const sessionKey = getTelegramInteractSessionKey(integration.id, payload)

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )
  const incomingText = payload.message.text ?? payload.message.caption

  {
    // @todo we should check for exact commands only

    if (
      ['///restart', '///reset', '///new'].includes(
        incomingText?.trim().toLowerCase() || ''
      )
    ) {
      debug(`restart`)

      await deleteTelegramSessionConversationId({ sessionKey })

      return
    }
  }

  let conversationId = persist
    ? await resolveTelegramSessionConversationId({
        sessionKey,
        legacyKey: getTelegramLegacyInteractSessionKey(integration.id, payload),
        sessionDurationSecs: ttlSecs,
      })
    : null

  const reusable = !!conversationId && (await hasConversation(conversationId))

  // @note slide the session window: refresh the TTL on every reuse so an active
  // conversation is not cut off at a fixed offset from its creation time.
  if (persist && reusable) {
    await bumpTelegramSessionConversationId({
      sessionKey,
      sessionDurationSecs: ttlSecs,
    })
  }

  if (!conversationId || !reusable) {
    let contactId

    {
      if (integration.contactCollection) {
        if (payload.message.from.first_name || payload.message.from.last_name) {
          const contact = await ensureTrustedContact(
            { id: integration.userId },
            {
              name: `${payload.message.from.first_name} ${payload.message.from.last_name}`.trim(),

              meta: {
                app: 'telegram',

                telegramUserId: payload.message.from.id,
              },
            },
            createContactFingerprint(TELEGRAM_CONTACT_NAMESPACE, [
              payload.message.from.id,
            ])
          )

          contactId = contact.id

          // @note we don't want to associate a contact in a public channel
          // setting because this could be a privacy issue - plus it does not
          // make sense because many can interact with the bot

          if (!['private'].includes(payload.message.chat.type)) {
            debug(`unset contact id because it is not a private chat`).log(
              'integration.telegram.queue.handleInteractEvent'
            )

            contactId = undefined
          }
        }
      }
    }

    const { id: cid } = await createConversation(integration.userId, {
      contactId,

      ...getConversationDetails(integration),

      meta: {
        app: 'telegram',

        telegram: {
          integrationId: integration.id,
        },
      },
    })

    conversationId = cid

    if (persist) {
      await setTelegramSessionConversationId({
        sessionKey,
        conversationId,
        sessionDurationSecs: ttlSecs,
      })
    }
  }

  let untrusted

  {
    // @note set the context namespace to blank so that we cannot use it to
    // authenticate the user in a shared-channel setting
    // @todo this is not a clear behavior and perhaps we should replace it with
    // a more clear way to handle this
    {
      if (!['private'].includes(payload.message.chat.type)) {
        debug(`unset context namespace because it is not a private chat`).log(
          'integration.telegram.queue.handleInteractEvent'
        )

        untrusted = true
      }
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
      }

      return event
    }

    async join() {
      await runTasks(this.#promises)
    }
  })()

  // @note generic supersede controller (shared across channels), bound once to
  // this turn's (sessionKey, update_id). The watch trips the engine's soft-yield
  // when a newer message for this session arrives mid-turn, so the engine
  // finishes the current agentic round and stops gracefully (valid state) rather
  // than running a long turn to completion. Distinct from context.signal (hard
  // timeout abort that cuts the live stream). Only meaningful when sessions
  // persist (otherwise each message is its own conversation).
  const supersede = messagingSupersede(sessionKey, payload.update_id)

  const watch = persist ? supersede.watch() : null

  const engine = await getStatefulConversationEngine({
    conversationId: conversationId,

    untrusted: untrusted,

    options: {
      signal: context?.signal,

      // @note fire-once per-mark signals from the queue monitor; the engine's
      // `timeoutMarks` feature listens to these. NOT cancellation signals

      markSignals: context?.markSignals,

      yieldSignal: watch?.yieldSignal,

      features: [
        // @note surface who sent the current message to the model for this turn
        // only - the userInfo feature injects it as a soft activity message and
        // never persists it. Lets the bot stay aware of the sender in group
        // chats where many users interact with one conversation.

        {
          name: 'userInfo',
          options: {
            name:
              [payload.message.from.first_name, payload.message.from.last_name]
                .filter(Boolean)
                .join(' ') || undefined,
            username: payload.message.from.username,
            externalId: String(payload.message.from.id),
            source: 'telegram',
          },
        },

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

      userId: integration.userId,

      sink,
    },
  })

  try {
    let sentSome = false

    if (integration.attachments) {
      // @note cap ingested attachments at the account plan's max file size.
      // Without this the shared upload guard treated a missing limit as 0 and
      // rejected every file (see lib/conversation.attachment.js).
      const maxFileSize = await getMaxFileSize(integration.user)

      const attachmentFiles = [
        // @note telegram sends the same photo in multiple sizes, keep only first
        ...(payload.message.photo?.slice(0, 1).map((item) => ({
          fileId: item.file_id,
          kind: 'photo',
        })) || []),
        ...(payload.message.document
          ? [{ fileId: payload.message.document.file_id, kind: 'document' }]
          : []),
        ...(payload.message.voice
          ? [{ fileId: payload.message.voice.file_id, kind: 'voice' }]
          : []),
        ...(payload.message.audio
          ? [{ fileId: payload.message.audio.file_id, kind: 'audio' }]
          : []),
        ...(payload.message.video
          ? [{ fileId: payload.message.video.file_id, kind: 'video' }]
          : []),
      ]

      for (const attachmentFile of attachmentFiles) {
        const response = await fetchPlusPlus(
          `https://api.telegram.org/bot${integration.botToken}/getFile`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_id: attachmentFile.fileId,
            }),
          }
        )

        if (response.ok) {
          const { result } = await response.json()
          const { file_path } = result
          const {
            attachmentId,
            name: attachmentName,
            type: attachmentType,
          } = await uploadConversationAttachmentFromURL(
            conversationId,
            `https://api.telegram.org/file/bot${integration.botToken}/${file_path}`,
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
          await captureUnexpectedState(
            `Telegram getFile failed - user ${attachmentFile.kind} attachment dropped`,
            {
              telegramIntegrationId: integration.id,
              fileId: attachmentFile.fileId,
            }
          )
        }
      }
    } else if (
      payload.message.photo?.length ||
      payload.message.document ||
      payload.message.voice ||
      payload.message.audio ||
      payload.message.video
    ) {
      debug(`attachments not supported`)
    }

    if (incomingText) {
      debug(`text`, { text: incomingText })

      sentSome = true

      await engine.send(incomingText)
    }

    if (!sentSome) {
      debug(`no messages sent so bail out`)

      return
    }

    // @note supersede check (before generation): a newer message for this
    // session is already queued, so skip producing a reply that would be thrown
    // away. This message is already appended to the conversation above, so the
    // latest message's handler coalesces it. Graceful early-exit, no abort.
    // Only meaningful when sessions persist (otherwise each message is its own
    // conversation and there is nothing to coalesce).
    if (persist && (await supersede.isSuperseded())) {
      debug(`superseded before generation - skipping reply`)

      return
    }

    const typingLease = await createTelegramTypingLease(
      {
        ...integration,
        // @ts-ignore - the botToken is checked above and this is just to satisfy the type checker
        botToken: integration.botToken,
      },
      payload.message
    )

    try {
      const { text } = await engine.receive()

      await sink.join()

      // @note the engine yielded mid-turn because a newer message superseded
      // this one. Its partial progress is stored in the conversation, so we
      // suppress the post and let the latest message's handler produce the
      // reply the user actually sees.
      if (watch?.didYield()) {
        debug(`yielded to a newer message - suppressing post`)

        return
      }

      const messages = await markdownToMessages(text)

      debug(`messages`, { messages })

      for (const message of messages) {
        if (message.type === 'text') {
          const body = JSON.stringify({
            business_connection_id:
              payload.message.business_connection_id || undefined,
            chat_id: payload.message.chat.id,
            message_thread_id: payload.message.message_thread_id || undefined,
            parse_mode: 'MarkdownV2',
            text: message.text,
          })

          debug(`sending message`, { body })

          const response = await fetchPlusPlus(
            `https://api.telegram.org/bot${integration.botToken}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: body,
            }
          )

          if (!response.ok) {
            const error = await getFetchError(response)

            debug(`error`, { error })

            // @note capture so we know the user is not receiving responses
            await captureUnexpectedState(
              'Telegram sendMessage failed - user will not receive bot response',
              {
                telegramIntegrationId: integration.id,
                chatId: payload.message.chat.id,
                error: error.message,
              }
            )

            await logTelegramApiError({
              integration,
              name: 'Telegram Message Send Error',
              description: 'Failed to send Telegram bot response.',
              operation: 'sendMessage',
              error,
              chatId: payload.message.chat.id,
              conversationId,
              messageType: message.type,
            })
          }
        } else if (message.type === 'image') {
          const body = JSON.stringify({
            business_connection_id:
              payload.message.business_connection_id || undefined,
            chat_id: payload.message.chat.id,
            message_thread_id: payload.message.message_thread_id || undefined,
            photo: message.image,
          })

          debug(`sending photo`, { body })

          const response = await fetchPlusPlus(
            `https://api.telegram.org/bot${integration.botToken}/sendPhoto`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: body,
            }
          )

          if (!response.ok) {
            const error = await getFetchError(response)

            debug(`error`, { error })

            // @note capture so we know the user is not receiving image responses
            await captureUnexpectedState(
              'Telegram sendPhoto failed - user will not receive bot image',
              {
                telegramIntegrationId: integration.id,
                chatId: payload.message.chat.id,
                error: error.message,
              }
            )

            await logTelegramApiError({
              integration,
              name: 'Telegram Photo Send Error',
              description: 'Failed to send Telegram bot image.',
              operation: 'sendPhoto',
              error,
              chatId: payload.message.chat.id,
              conversationId,
              messageType: message.type,
            })
          }
        } else if (message.type === 'video') {
          const body = JSON.stringify({
            business_connection_id:
              payload.message.business_connection_id || undefined,
            chat_id: payload.message.chat.id,
            message_thread_id: payload.message.message_thread_id || undefined,
            video: message.video,
          })

          debug(`sending video`, { body })

          const response = await fetchPlusPlus(
            `https://api.telegram.org/bot${integration.botToken}/sendVideo`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: body,
            }
          )

          if (!response.ok) {
            const error = await getFetchError(response)

            debug(`error`, { error })

            // @note capture so we know the user is not receiving video responses
            await captureUnexpectedState(
              'Telegram sendVideo failed - user will not receive bot video',
              {
                telegramIntegrationId: integration.id,
                chatId: payload.message.chat.id,
                error: error.message,
              }
            )

            await logTelegramApiError({
              integration,
              name: 'Telegram Video Send Error',
              description: 'Failed to send Telegram bot video.',
              operation: 'sendVideo',
              error,
              chatId: payload.message.chat.id,
              conversationId,
              messageType: message.type,
            })
          }
        } else if (message.type === 'audio') {
          const body = JSON.stringify({
            business_connection_id:
              payload.message.business_connection_id || undefined,
            chat_id: payload.message.chat.id,
            message_thread_id: payload.message.message_thread_id || undefined,
            audio: message.audio,
          })

          debug(`sending audio`, { body })

          const response = await fetchPlusPlus(
            `https://api.telegram.org/bot${integration.botToken}/sendAudio`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: body,
            }
          )

          if (!response.ok) {
            const error = await getFetchError(response)

            debug(`error`, { error })

            // @note capture so we know the user is not receiving audio responses
            await captureUnexpectedState(
              'Telegram sendAudio failed - user will not receive bot audio',
              {
                telegramIntegrationId: integration.id,
                chatId: payload.message.chat.id,
                error: error.message,
              }
            )

            await logTelegramApiError({
              integration,
              name: 'Telegram Audio Send Error',
              description: 'Failed to send Telegram bot audio.',
              operation: 'sendAudio',
              error,
              chatId: payload.message.chat.id,
              conversationId,
              messageType: message.type,
            })
          }
        } else if (message.type === 'voice') {
          const body = JSON.stringify({
            business_connection_id:
              payload.message.business_connection_id || undefined,
            chat_id: payload.message.chat.id,
            message_thread_id: payload.message.message_thread_id || undefined,
            voice: message.voice,
          })

          debug(`sending voice`, { body })

          const response = await fetchPlusPlus(
            `https://api.telegram.org/bot${integration.botToken}/sendVoice`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: body,
            }
          )

          if (!response.ok) {
            const error = await getFetchError(response)

            debug(`error`, { error })

            // @note capture so we know the user is not receiving voice responses
            await captureUnexpectedState(
              'Telegram sendVoice failed - user will not receive bot voice',
              {
                telegramIntegrationId: integration.id,
                chatId: payload.message.chat.id,
                error: error.message,
              }
            )

            await logTelegramApiError({
              integration,
              name: 'Telegram Voice Send Error',
              description: 'Failed to send Telegram bot voice.',
              operation: 'sendVoice',
              error,
              chatId: payload.message.chat.id,
              conversationId,
              messageType: message.type,
            })
          }
        } else if (message.type === 'file') {
          const body = JSON.stringify({
            business_connection_id:
              payload.message.business_connection_id || undefined,
            chat_id: payload.message.chat.id,
            message_thread_id: payload.message.message_thread_id || undefined,
            document: message.file,
          })

          debug(`sending file`, { body })

          const response = await fetchPlusPlus(
            `https://api.telegram.org/bot${integration.botToken}/sendDocument`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: body,
            }
          )

          if (!response.ok) {
            const error = await getFetchError(response)

            debug(`error`, { error })

            // @note capture so we know the user is not receiving file responses
            await captureUnexpectedState(
              'Telegram sendDocument failed - user will not receive bot file',
              {
                telegramIntegrationId: integration.id,
                chatId: payload.message.chat.id,
                error: error.message,
              }
            )

            await logTelegramApiError({
              integration,
              name: 'Telegram Document Send Error',
              description: 'Failed to send Telegram bot file.',
              operation: 'sendDocument',
              error,
              chatId: payload.message.chat.id,
              conversationId,
              messageType: message.type,
            })
          }
        }
      }
    } finally {
      typingLease.stop()
    }
  } finally {
    // @note stop watching the session channel and tear down its subscription;
    // the turn is over (settled, yielded, or errored).
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
  chatId: z.union([z.string(), z.number()]),
  text: z.string(),
  context: z.record(z.string(), z.any()).optional(),
})

/**
 * @typedef {{
 *   type: typeof INITIATE_EVENT_TYPE,
 *   payload: InitiatePayload
 * }} InitiateEvent
 *
 * Handles the initiate event - sends an initial message to a Telegram chat
 * and creates a conversation so that subsequent user replies are tracked.
 *
 * This is used for proactive outreach where the bot initiates the conversation
 * by sending a message to the user, rather than responding to a user message.
 *
 * @param {string} telegramIntegrationId
 * @param {InitiatePayload} payload
 * @returns {Promise<void>}
 */
export async function handleInitiateEvent(telegramIntegrationId, payload) {
  debug('initiate', { telegramIntegrationId, payload }).log(
    'integration.telegram.queue.handleInitiateEvent'
  )

  const integration = await prisma.telegramIntegration.findUnique({
    where: {
      id: telegramIntegrationId,
    },

    include: {
      user: true,
      bot: true,
    },
  })

  if (!integration) {
    return throwNotFound(
      `TelegramIntegration not found: ${telegramIntegrationId}`
    )
  }

  if (!integration.botToken) {
    return throwConflict(
      `TelegramIntegration not configured: ${telegramIntegrationId}`
    )
  }

  if (!integration.bot) {
    await captureUnexpectedState(
      'Telegram initiate triggered for integration with no bot configured',
      { telegramIntegrationId, integrationName: integration.name }
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

  // Send the initial message to Telegram via Bot API

  const response = await fetchPlusPlus(
    `https://api.telegram.org/bot${integration.botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: payload.chatId,
        text: payload.text,
      }),
    }
  )

  if (!response.ok) {
    const error = await getFetchError(response)

    await captureUnexpectedState(
      'Telegram initiate message failed - user will not receive outreach',
      { telegramIntegrationId, chatId: payload.chatId, error: error.message }
    )

    debug(`failed to send message`, { error }).log(
      'integration.telegram.queue.handleInitiateEvent'
    )

    await logTelegramApiError({
      integration,
      name: 'Telegram Initiate Message Error',
      description: 'Failed to send Telegram initiate message.',
      operation: 'sendMessage',
      error,
      chatId: payload.chatId,
      messageType: 'text',
    })

    return
  }

  // @note create a session keyed by chat so that subsequent interactions in
  // the same chat can find this conversation

  const sessionKey = getTelegramInitiateSessionKey(integration.id, payload)

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  debug(`session key`, { sessionKey }).log(
    'integration.telegram.queue.handleInitiateEvent'
  )

  // @note if context is provided, add it as an activity so the bot has
  // background information about the recipient for future interactions
  const contextMessages = payload.context
    ? makeActivityMessagePair(
        '_getTelegramContext',
        { chatId: payload.chatId },
        { context: payload.context }
      )
    : []

  const messages = [
    ...makeActivityMessagePair(
      '_initiateConversation',
      {},
      {
        chatId: payload.chatId,
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
      app: 'telegram',
      telegram: {
        integrationId: integration.id,
        chatId: payload.chatId,
        initiated: true,
      },
    },
  })

  if (persist) {
    await setTelegramSessionConversationId({
      sessionKey,
      conversationId,
      sessionDurationSecs: ttlSecs,
    })
  }

  debug(`conversation created`, { conversationId, sessionKey }).log(
    'integration.telegram.queue.handleInitiateEvent'
  )
}

/**
 * @param {string} telegramIntegrationId
 * @param {InteractEvent|InitiateEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(telegramIntegrationId, event) {
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
    const sessionKey = getTelegramInteractSessionKey(
      telegramIntegrationId,
      event.payload
    )

    // @note record this message as the session's latest and nudge any in-flight
    // handler for an earlier message, so it can soft-yield mid-turn (generic,
    // shared across messaging channels). update_id is monotonic per session.
    await messagingSupersede(sessionKey, event.payload.update_id).record()

    await queue(
      `/api/v1/integration/telegram/${telegramIntegrationId}/queue`,
      event,
      {
        deduplicationId: `telegram-${telegramIntegrationId}-${event.type}-${event.payload.update_id}-${event.payload.message.chat.id}`,

        // @note serialize a session's handlers (parallel: 1) so the supersede
        // check is meaningful - the latest message's handler runs after the
        // earlier ones and is the one that produces the reply.
        flow: { key: sessionKey, parallel: 1 },
      }
    )

    return
  }

  await queue(
    `/api/v1/integration/telegram/${telegramIntegrationId}/queue`,
    event,
    {}
  )
}

/**
 */
export default withQueueHandlerBounded('telegramIntegrationId', {
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
 * @manual Telegram Integration
 *
 * ## Background Processing
 *
 * Telegram requires webhook responses within a short window, so message
 * processing and bot response generation happen asynchronously in the
 * background. Incoming updates are acknowledged immediately, and the bot
 * delivers its reply as soon as it is ready, even for longer AI responses.
 *
 * ## Typing Indicators
 *
 * While the bot is preparing a reply, Telegram displays the familiar
 * "typing..." indicator to the user. The indicator is refreshed automatically
 * until the response is delivered, so users see continuous feedback. If the
 * typing animation cannot be displayed for any reason, the user still receives
 * the reply normally.
 *
 * ## Sender Filtering with allowFrom
 *
 * The `allowFrom` integration setting restricts which Telegram users can interact
 * with the bot. When configured, only messages from permitted user IDs, chat IDs,
 * or usernames are processed. Messages from other senders are silently dropped.
 *
 * This feature is useful for private bots serving specific teams or individuals,
 * for internal tools where only authorized employees should have access, and for
 * beta deployments where you want to control the audience before a wider release.
 *
 * Configure `allowFrom` when creating or updating your Telegram integration:
 *
 * ```http
 * POST /api/v1/integration/telegram/{telegramIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "allowFrom": "123456789,@myteam_user,987654321"
 * }
 * ```
 *
 * ## Attachment Handling
 *
 * When the integration has `attachments` enabled, media files sent by Telegram
 * users - including photos, documents, voice messages, audio files, and videos
 * - are made available to the bot as conversation attachments for processing.
 *
 * If a single attachment cannot be processed, the remaining attachments and
 * any accompanying text continue to be handled normally, providing a resilient
 * experience for users sending mixed-media messages.
 *
 * ## Supported Bot Response Types
 *
 * The Telegram integration supports multiple message types for bot responses,
 * allowing AI bots to communicate through a variety of rich media formats in
 * addition to plain text:
 *
 * - **text** - Plain text messages with MarkdownV2 formatting. Bold, italic,
 *   code blocks, and links are preserved in the Telegram conversation.
 *
 * - **image** - Image files attached directly to the conversation for visual
 *   responses.
 *
 * - **video** - Video content for richer, multimedia interactions.
 *
 * - **audio** - Audio files suitable for music, recorded interviews, podcasts,
 *   or other audio content responses.
 *
 * - **voice** - Voice messages where the bot responds with spoken audio,
 *   enabling natural voice interactions within Telegram. Voice responses are
 *   ideal when your bot is paired with a text-to-speech ability and users
 *   expect conversational audio replies.
 *
 * - **file** - Document files of any type, such as PDFs, spreadsheets, or
 *   archives, sent as attachments.
 *
 * If one message type cannot be delivered (for example, if Telegram rejects a
 * particular voice format), it does not prevent other messages in the same
 * response from being delivered.
 *
 * ## Proactive Messaging
 *
 * The `initiate` event type enables your bot to start a conversation with a
 * Telegram user rather than waiting for them to send the first message. This
 * is useful for notifications, onboarding flows, scheduled reminders, and
 * any scenario where the bot needs to reach out proactively.
 *
 * To send a proactive message, send an `initiate` event with the target
 * `chatId` and the opening `text` message. An optional `context` object can
 * provide background information that the bot will use in subsequent replies.
 *
 * When the message is sent, any user reply in that chat is automatically
 * associated with the same conversation, enabling a natural follow-up
 * exchange. If a `context` object was provided, the bot uses it as background
 * information when responding to the user's reply.
 *
 * Sessions created by `initiate` events follow the same `sessionDuration`
 * setting as reactive sessions. Once a session expires, a user reply will
 * start a new conversation rather than continuing the proactively initiated
 * one.
 *
 * ## Forum Topics and Thread Support
 *
 * The Telegram integration supports Telegram supergroups with forum topics
 * enabled. When a message arrives in a forum topic, all processing and
 * replies are automatically routed into that topic thread.
 *
 * This affects two key behaviors:
 *
 * **Thread-scoped sessions**: Each forum topic maintains its own independent
 * conversation session. If the same user sends messages in topic A and topic
 * B within the same supergroup, they each receive separate conversation
 * histories and context, so conversations remain isolated between topics.
 *
 * **Thread-targeted replies**: All bot responses - including text, images,
 * videos, audio, voice, and file messages - appear inside the correct topic
 * thread rather than in the supergroup's general chat. The typing indicator
 * is also scoped to the thread, so users see the "typing..." animation within
 * the topic where they sent their message.
 *
 * To use your Telegram bot in a forum supergroup, the setup steps are the
 * same as a regular group: add the bot as an administrator and mention it
 * using `@botname` when messaging in a topic. No additional configuration is
 * required - thread routing is handled automatically.
 *
 * **Note:** Account-level conversational limits apply to both `interact` and
 * `initiate` events to ensure reliable processing under high message volumes
 * and prevent abuse.
 */
