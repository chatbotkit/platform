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
  TAG_ERROR,
  TAG_OPERATION_BEGIN,
  TAG_REASONING_TOKEN,
  TAG_TOKEN,
  createSinkEvent,
} from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import {
  captureError,
  captureInputError,
  captureUnexpectedState,
} from '@/lib/error'
import {
  getGoogleChatAccessToken,
  getGoogleChatAttachmentMediaDownloadUrl,
  resolveGoogleChatSpace,
  sendGoogleChatImageMessage,
  sendGoogleChatMessage,
} from '@/lib/googlechat.api'
import { markdownToMessages } from '@/lib/googlechat.markdown'
import {
  googleChatSenderIsAllowed,
  parseGoogleChatAllowFrom,
} from '@/lib/googlechat.validation'
import { setupFrontendHostContext } from '@/lib/integration.context'
import { resolveSession } from '@/lib/integration.session'
import { runTasks } from '@/lib/job'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import { allocateOrder, messagingSupersede } from '@/lib/messaging.supersede'
import { OMIT_UNDEFINED, omit } from '@/lib/object'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { throwLimitsReached, throwNotFound } from '@/lib/response'
import { updateSessionStore } from '@/lib/session.context'
import { resolveSessionDuration } from '@/lib/session.duration'
import { getMaxFileSize } from '@/lib/user.limits'
import { userToSessionUser } from '@/lib/user.session'
import { parseAsync } from '@/lib/zod.schema'

import { doSetup } from '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/setup'

import { z } from 'zod'

export const INTERACT_EVENT_TYPE = 'interact'
export const SETUP_EVENT_TYPE = 'setup'
export const INITIATE_EVENT_TYPE = 'initiate'

export const GOOGLECHAT_CONTACT_NAMESPACE =
  'f32c8b57-5b5a-4d3c-b2bb-718fe94c1fa1'

/**
 * @typedef {z.infer<typeof InteractPayloadSchema>} InteractPayload
 */
export const InteractPayloadSchema = z.object({
  senderName: z.string(),
  senderDisplayName: z.string(),
  spaceName: z.string(),
  spaceDisplayName: z.string().optional(),
  spaceType: z.string().optional(),
  spaceThreadingState: z.string().optional(),
  messageName: z.string().optional(),
  eventTime: z.string().optional(),
  threadName: z.string().optional(),
  privateMessageViewerName: z.string().optional(),
  slashCommand: z
    .object({
      commandId: z.union([z.string(), z.number()]).optional(),
      commandName: z.string().optional(),
      type: z.string().optional(),
    })
    .optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().optional(),
        contentName: z.string().optional(),
        contentType: z.string().optional(),
        source: z.string().optional(),
        attachmentDataRef: z
          .object({
            resourceName: z.string().optional(),
          })
          .optional(),
      })
    )
    .optional(),
  text: z.string(),

  // @note per-session monotonic order allocated on the webhook path (see
  // allocateOrder); threaded here so the handler can detect it has been
  // superseded by a newer message. Optional for backward-compat with events
  // enqueued before supersede was wired.
  order: z.number().optional(),
})

/**
 * @typedef {z.infer<typeof SetupPayloadSchema>} SetupPayload
 */
export const SetupPayloadSchema = z.object({
  // pass
})

/**
 * @param {Pick<InteractPayload, 'spaceType' | 'privateMessageViewerName'>} payload
 * @returns {boolean}
 */
export function isGoogleChatPrivateInteraction(payload) {
  return payload.spaceType === 'DM' || !!payload.privateMessageViewerName
}

/**
 * @param {Pick<InteractPayload, 'spaceThreadingState'>} payload
 * @returns {boolean}
 */
export function isGoogleChatUnthreadedSpace(payload) {
  return payload.spaceThreadingState === 'UNTHREADED_MESSAGES'
}

/**
 * @param {unknown} error
 * @returns {{ name?: string, message: string, code?: string }}
 */
function getGoogleChatErrorLogMeta(error) {
  if (error instanceof Error) {
    const code = /** @type {{ code?: unknown }} */ (error).code

    return omit(
      {
        name: error.name,
        message: error.message,
        code: typeof code === 'string' ? code : undefined,
      },
      [OMIT_UNDEFINED]
    )
  }

  return {
    message: String(error),
  }
}

/**
 * @param {{
 *   integration: { id: string, userId: string, botId?: string | null, bot?: { id?: string } | null } | null
 *   name: string
 *   description: string
 *   operation: string
 *   error: unknown
 *   conversationId?: string | null
 *   payload?: Partial<Pick<InteractPayload, 'senderName' | 'senderDisplayName' | 'spaceName' | 'spaceDisplayName' | 'spaceType' | 'spaceThreadingState' | 'threadName' | 'messageName' | 'privateMessageViewerName'>>
 * }} params
 */
async function logGoogleChatApiError({
  integration,
  name,
  description,
  operation,
  error,
  conversationId,
  payload,
}) {
  if (!integration) {
    return
  }

  await logEvent({
    user: { id: integration.userId },
    name,
    description,
    type: 'integration.googlechat.api.error',
    relations: omit(
      {
        googlechatIntegrationId: integration.id,
        botId: integration.botId || integration.bot?.id,
        conversationId,
      },
      [OMIT_UNDEFINED]
    ),
    meta: omit(
      {
        operation,
        error: getGoogleChatErrorLogMeta(error),
        payload: payload
          ? omit(
              {
                senderName: payload.senderName,
                senderDisplayName: payload.senderDisplayName,
                spaceName: payload.spaceName,
                spaceDisplayName: payload.spaceDisplayName,
                spaceType: payload.spaceType,
                spaceThreadingState: payload.spaceThreadingState,
                threadName: payload.threadName,
                messageName: payload.messageName,
                privateMessageViewerName: payload.privateMessageViewerName,
              },
              [OMIT_UNDEFINED]
            )
          : undefined,
      },
      [OMIT_UNDEFINED]
    ),
  })
}

/**
 * Compute the session key (and fallback keys) for an incoming interact
 * payload. Mirrors the Slack integration's model:
 *
 * - **Private surfaces** (1:1 DM or private command response): session is
 *   keyed by the sender, so the user has a single continuous conversation
 *   with the bot regardless of which DM/private command surface Google routes
 *   through. A fallback key scoped to the space name is checked too so
 *   bot-initiated DM threads (which store under the space) can still be
 *   resumed when the user replies.
 *
 * - **ROOM / SPACE** (multi-user): session is keyed by the thread for
 *   threaded spaces, so everyone participating in the same thread shares
 *   one conversation context (matching how Slack treats channel threads).
 *   In unthreaded spaces, Google still includes per-message thread names,
 *   so use the space name instead to keep follow-up mentions in the same
 *   conversation. If the message has no thread name we also fall back to
 *   the space.
 *
 * @param {string} googlechatIntegrationId
 * @param {Pick<InteractPayload, 'senderName' | 'spaceName' | 'spaceType' | 'spaceThreadingState' | 'threadName'>} payload
 * @returns {{ sessionKey: string, sessionFallbackKeys: string[] }}
 */
export function getGoogleChatInteractSessionKeys(
  googlechatIntegrationId,
  payload
) {
  if (isGoogleChatPrivateInteraction(payload)) {
    return {
      sessionKey: `googlechat-session-dm-${googlechatIntegrationId}-${payload.senderName}`,
      sessionFallbackKeys: [
        `googlechat-session-dm-${googlechatIntegrationId}-${payload.spaceName}`,
      ],
    }
  }

  const threadOrSpace = isGoogleChatUnthreadedSpace(payload)
    ? payload.spaceName
    : payload.threadName || payload.spaceName

  return {
    sessionKey: `googlechat-session-room-${googlechatIntegrationId}-${threadOrSpace}`,
    sessionFallbackKeys: [],
  }
}

/**
 * @param {string} googlechatIntegrationId
 * @param {Pick<InitiatePayload, 'space'>} payload
 * @returns {string}
 */
export function getGoogleChatInitiateSessionKey(
  googlechatIntegrationId,
  payload
) {
  return `googlechat-session-room-${googlechatIntegrationId}-${payload.space}`
}

/**
 * @param {string} googlechatIntegrationId
 * @param {Pick<InitiatePayload, 'space'>} payload
 * @returns {string}
 */
export function getGoogleChatInitiateDmSessionKey(
  googlechatIntegrationId,
  payload
) {
  // @note initiate events do not know the Google Chat senderName, so store a
  // space-based DM fallback. Inbound DM replies check this key.
  return `googlechat-session-dm-${googlechatIntegrationId}-${payload.space}`
}

/**
 * @param {{
 *   sessionKey: string,
 *   sessionFallbackKeys?: string[],
 *   sessionDurationSecs: number,
 * }} options
 * @returns {Promise<string | null>}
 */
export async function resolveGoogleChatSessionConversationId({
  sessionKey,
  sessionFallbackKeys = [],
  sessionDurationSecs,
}) {
  let conversationId = await memcache.get(sessionKey)

  // @note if the primary key missed, try fallback keys (e.g. the
  // space-based DM key written by bot-initiated conversations)
  if (!conversationId && sessionFallbackKeys.length > 0) {
    const resolved = await resolveSession(sessionFallbackKeys)

    if (resolved) {
      conversationId = resolved.value

      debug(`resolved from fallback key`, {
        fallbackKey: resolved.key,
        conversationId,
      }).log(
        'integration.googlechat.queue.resolveGoogleChatSessionConversationId'
      )

      // @note migrate to the primary key so future lookups are direct
      await memcache.set(sessionKey, conversationId, {
        ex: sessionDurationSecs,
      })
    }
  }

  return conversationId
}

/**
 * @param {{ sessionKey: string, conversationId: string, sessionDurationSecs: number }} options
 * @returns {Promise<void>}
 */
export async function setGoogleChatSessionConversationId({
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
export async function bumpGoogleChatSessionConversationId({
  sessionKey,
  sessionDurationSecs,
}) {
  await memcache.expire(sessionKey, sessionDurationSecs)
}

/**
 * @param {{ sessionKey: string, sessionFallbackKeys?: string[] }} options
 * @returns {Promise<void>}
 */
export async function deleteGoogleChatSessionConversationId({
  sessionKey,
  sessionFallbackKeys = [],
}) {
  await memcache.del(sessionKey)

  for (const key of sessionFallbackKeys) {
    await memcache.del(key)
  }
}

/**
 * @param {string} googlechatIntegrationId
 * @param {Pick<InteractPayload, 'messageName' | 'eventTime'>} payload
 * @returns {string | undefined}
 */
export function getGoogleChatInteractDeduplicationId(
  googlechatIntegrationId,
  payload
) {
  const eventIdentifier = payload.messageName || payload.eventTime

  if (!eventIdentifier) {
    return undefined
  }

  return `googlechat-${googlechatIntegrationId}-${INTERACT_EVENT_TYPE}-${eventIdentifier}`
}

/**
 * @param {string} googlechatIntegrationId
 * @param {InteractPayload} payload
 * @returns {Promise<void>}
 */
export async function handleInteractEvent(
  googlechatIntegrationId,
  payload,
  context
) {
  debug(`interact`, { googlechatIntegrationId, payload }).log(
    'integration.googlechat.queue.handleInteractEvent'
  )

  // @note Google Chat 1:1 DMs render threaded replies as nested threads
  // under each message, which looks awkward in a one-on-one chat. Unthreaded
  // spaces can also expose per-message thread names; posting back without
  // a thread keeps Meet-style chat replies in the visible space stream.
  const replyThreadName =
    payload.spaceType === 'DM' || isGoogleChatUnthreadedSpace(payload)
      ? undefined
      : payload.threadName

  const integration = await prisma.googlechatIntegration.findUnique({
    where: {
      id: googlechatIntegrationId,
    },

    include: {
      user: true, // @note super important

      bot: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(
      `GooglechatIntegration not found: ${googlechatIntegrationId}`
    )
  }

  if (!integration.bot) {
    debug(`skipping - no bot configured`).log(
      'integration.googlechat.queue.handleInteractEvent'
    )

    return
  }

  // check allowFrom restriction
  {
    const entries = parseGoogleChatAllowFrom(integration.allowFrom || '*')

    if (!googleChatSenderIsAllowed({ name: payload.senderName }, entries)) {
      debug(`sender not allowed`, { senderName: payload.senderName }).log(
        'integration.googlechat.queue.handleInteractEvent'
      )

      await logEvent({
        user: { id: integration.userId },
        name: 'Sender Blocked',
        description: `A message was blocked due to allowFrom restrictions.`,
        type: 'integration.googlechat.blocked',
        relations: {
          googlechatIntegrationId: integration.id,
        },
        meta: {
          senderName: payload.senderName,
          senderDisplayName: payload.senderDisplayName,
        },
      })

      return
    }
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    // @note the account is over its usage limits - post a pre-canned reply so
    // the user gets a visible signal instead of silence, mirroring the Slack
    // integration. Best-effort: a failed post must not mask the limit condition.
    const limitReplyConfig =
      /** @type {import('@/lib/googlechat.api').GooglechatIntegration} */ (
        integration
      )

    try {
      if (payload.privateMessageViewerName) {
        await sendGoogleChatMessage(
          limitReplyConfig,
          payload.spaceName,
          messages.limitsReachedReply,
          replyThreadName,
          { privateMessageViewerName: payload.privateMessageViewerName }
        )
      } else {
        await sendGoogleChatMessage(
          limitReplyConfig,
          payload.spaceName,
          messages.limitsReachedReply,
          replyThreadName
        )
      }

      return
    } catch (error) {
      await captureError(error)

      debug(`limit reply send failed`, { error }).log(
        'integration.googlechat.queue.handleInteractEvent'
      )
    }

    return throwLimitsReached(`Limits exceeded`)
  }

  const googlechatConfig =
    /** @type {import('@/lib/googlechat.api').GooglechatIntegration} */ (
      integration
    )

  if (integration.user) {
    updateSessionStore({
      user: userToSessionUser(integration.user),
    })

    setContextUser(integration.user)

    await setupFrontendHostContext(integration.user)
  }

  // @note session keys are scoped per integration and per conversation
  // surface - sender for DMs, thread for multi-user spaces - mirroring how
  // the Slack integration models its sessions.

  const { sessionKey, sessionFallbackKeys } = getGoogleChatInteractSessionKeys(
    integration.id,
    payload
  )
  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  // @note supersede + soft-yield: a newer message in the same space/thread (a
  // rapid follow-up) should steer this turn rather than queue a second reply.
  // Only meaningful when sessions persist and the webhook allocated an order
  // (events enqueued before supersede was wired carry none).
  const superseding = persist && payload.order != null

  const supersede = messagingSupersede(sessionKey, payload.order ?? 0)

  const watch = superseding ? supersede.watch() : null

  debug(`session key`, { sessionKey, sessionFallbackKeys }).log(
    'integration.googlechat.queue.handleInteractEvent'
  )

  // handle session reset commands
  {
    if (
      ['///restart', '///reset', '///new'].includes(
        payload.text?.trim().toLowerCase() || ''
      )
    ) {
      debug(`restart`).log('integration.googlechat.queue.handleInteractEvent')

      await deleteGoogleChatSessionConversationId({
        sessionKey,
        sessionFallbackKeys,
      })

      await sendGoogleChatMessage(
        googlechatConfig,
        payload.spaceName,
        'Session reset. Start a new conversation!',
        replyThreadName
      ).catch(async (error) => {
        await captureError(error)

        await logGoogleChatApiError({
          integration,
          name: 'Google Chat Session Reset Reply Error',
          description:
            'Failed to send the Google Chat session reset confirmation.',
          operation: 'spaces.messages.create',
          error,
          payload,
        })
      })

      return
    }
  }

  let conversationId = persist
    ? await resolveGoogleChatSessionConversationId({
        sessionKey,
        sessionFallbackKeys,
        sessionDurationSecs: ttlSecs,
      })
    : null

  debug(`conversationId`, { conversationId }).log(
    'integration.googlechat.queue.handleInteractEvent'
  )

  const reusable = !!conversationId && (await hasConversation(conversationId))

  // @note slide the session window: refresh the TTL on every reuse so an active
  // conversation is not cut off at a fixed offset from its creation time.
  if (persist && reusable) {
    await bumpGoogleChatSessionConversationId({
      sessionKey,
      sessionDurationSecs: ttlSecs,
    })
  }

  if (!conversationId || !reusable) {
    let contactId

    if (
      integration.contactCollection &&
      isGoogleChatPrivateInteraction(payload) &&
      payload.senderName
    ) {
      const contact = await ensureTrustedContact(
        { id: integration.userId },
        {
          name: payload.senderDisplayName || undefined,
          nick: payload.senderName,

          meta: {
            app: 'googlechat',

            googlechat: {
              integrationId: integration.id,
              projectNumber: integration.projectNumber,
              senderName: payload.senderName,
              senderDisplayName: payload.senderDisplayName,
              spaceName: payload.spaceName,
            },
          },
        },
        createContactFingerprint(GOOGLECHAT_CONTACT_NAMESPACE, [
          integration.projectNumber || integration.id,
          payload.senderName,
        ])
      )

      contactId = contact.id
    }

    const { id: cid } = await createConversation(integration.userId, {
      contactId,

      ...getConversationDetails(integration),

      meta: {
        app: 'googlechat',

        googlechat: {
          integrationId: integration.id,
          spaceName: payload.spaceName,
          senderName: payload.senderName,
        },
      },
    })

    conversationId = cid

    if (persist) {
      await setGoogleChatSessionConversationId({
        sessionKey,
        conversationId,
        sessionDurationSecs: ttlSecs,
      })
    }
  }

  async function sendReply(text) {
    debug(`sendReply`, { text: text.substring(0, 100), payload }).log(
      'integration.googlechat.queue.handleInteractEvent.sendReply'
    )

    try {
      if (payload.privateMessageViewerName) {
        await sendGoogleChatMessage(
          googlechatConfig,
          payload.spaceName,
          text,
          replyThreadName,
          { privateMessageViewerName: payload.privateMessageViewerName }
        )
      } else {
        await sendGoogleChatMessage(
          googlechatConfig,
          payload.spaceName,
          text,
          replyThreadName
        )
      }
    } catch (e) {
      await captureError(e)

      await logGoogleChatApiError({
        integration,
        name: 'Google Chat Reply Error',
        description: 'Failed to send a Google Chat reply.',
        operation: 'spaces.messages.create',
        error: e,
        conversationId,
        payload,
      })
    }
  }

  async function sendImageReply(imageUrl) {
    debug(`sendImageReply`, { imageUrl, payload }).log(
      'integration.googlechat.queue.handleInteractEvent.sendImageReply'
    )

    try {
      if (payload.privateMessageViewerName) {
        await sendGoogleChatImageMessage(
          googlechatConfig,
          payload.spaceName,
          imageUrl,
          replyThreadName,
          { privateMessageViewerName: payload.privateMessageViewerName }
        )
      } else {
        await sendGoogleChatImageMessage(
          googlechatConfig,
          payload.spaceName,
          imageUrl,
          replyThreadName
        )
      }
    } catch (e) {
      await captureError(e)

      await logGoogleChatApiError({
        integration,
        name: 'Google Chat Image Reply Error',
        description: 'Failed to send a Google Chat image reply.',
        operation: 'spaces.messages.create',
        error: e,
        conversationId,
        payload,
      })
    }
  }

  const sink = new (class {
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
          // @note Google Chat does not support incremental message updates
          // in the same way as Slack, so we accumulate tokens and send once

          break
        }

        case TAG_REASONING_TOKEN: {
          // @note reasoning tokens are not surfaced to end users

          break
        }

        case TAG_OPERATION_BEGIN: {
          // @todo support indicating operations

          break
        }
      }

      return event
    }

    async join() {
      await runTasks(this.#promises)
    }
  })()

  const engine = await getStatefulConversationEngine({
    conversationId: conversationId,

    // @note Google Chat DMs and private command responses can keep trusted
    // context for secret-backed auth. Ordinary multi-user space messages must
    // remain untrusted so the engine resets contact/namespace context before
    // resolving secrets.
    untrusted: !isGoogleChatPrivateInteraction(payload),

    options: {
      features:
        /** @type {import('@/lib/conversation.features').Feature[]} */ ([
          // @note surface who sent the current message to the model for this
          // turn only - the userInfo feature injects it as a soft activity
          // message and never persists it. Lets the bot stay aware of the
          // sender in multi-user spaces sharing one conversation.

          {
            name: 'userInfo',
            options: {
              name: payload.senderDisplayName || undefined,
              externalId: payload.senderName,
              source: 'googlechat',
            },
          },

          // @note record a checkpoint activity into the conversation each time
          // the queue handler crosses a timeout-budget mark (driven by
          // markSignals below), visible to the model on the next turn

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
            ? [
                /** @type {import('@/lib/conversation.features').AttachmentsFeature} */ ({
                  name: 'attachments',
                }),
              ]
            : []),
        ]),

      userId: integration.userId,

      signal: context?.signal,

      // @note fire-once per-mark signals from the queue monitor; the engine's
      // `timeoutMarks` feature listens to these. NOT cancellation signals

      markSignals: context?.markSignals,

      // @note cooperative soft-yield: tripped when a newer message in the same
      // space/thread supersedes this turn, so the engine stops at its next
      // iteration boundary instead of finishing a reply that is thrown away.

      yieldSignal: watch?.yieldSignal,

      // prettier-ignore
      backstoryExtra: t`
# Runtime Context

This conversation is happening inside Google Chat. Your response will be posted back to Google Chat, so write in a Google Chat-friendly style and assume Google Chat markdown/card formatting limits apply during delivery.
If this is a multi-user space or threaded conversation, other space members may be able to read the response. If this is a direct message, treat it as a private 1:1 chat.
When the conversation is in a space or thread, keep the surrounding space context in mind and avoid assuming the current sender is the only participant.

# Space Information

Space Name: ${payload.spaceName}
Space Display Name: ${payload.spaceDisplayName} ${t.when(!!payload.spaceDisplayName)}
Space Type: ${payload.spaceType} ${t.when(!!payload.spaceType)}
Space Threading State: ${payload.spaceThreadingState} ${t.when(!!payload.spaceThreadingState)}
Thread Name: ${payload.threadName} ${t.when(!!payload.threadName)}
Private Message Viewer: ${payload.privateMessageViewerName} ${t.when(!!payload.privateMessageViewerName)}
`,

      sink,
    },
  })

  try {
    // handle uploaded file attachments
    {
      const attachments = payload.attachments || []

      if (integration.attachments && attachments.length > 0) {
        const maxFileSize = await getMaxFileSize(integration.user)

        debug(`processing ${attachments.length} attachment(s)`, {
          attachments: attachments.map((attachment) => ({
            name: attachment.name,
            contentName: attachment.contentName,
            contentType: attachment.contentType,
            source: attachment.source,
          })),
        }).log('integration.googlechat.queue.handleInteractEvent')

        for (const attachment of attachments) {
          const resourceName = attachment.attachmentDataRef?.resourceName

          if (!resourceName) {
            debug(`skipping attachment without media resource`, {
              attachment,
            }).log('integration.googlechat.queue.handleInteractEvent')

            continue
          }

          try {
            const accessToken = await getGoogleChatAccessToken(googlechatConfig)

            const {
              attachmentId,
              name: attachmentName,
              type: attachmentType,
            } = await uploadConversationAttachmentFromURL(
              conversationId,
              getGoogleChatAttachmentMediaDownloadUrl(resourceName),
              {
                Authorization: `Bearer ${accessToken}`,
              },
              {
                maxSize: maxFileSize,
                name: attachment.contentName,
                type: attachment.contentType,
              }
            )

            const { request: activityRequest, response: activityResponse } =
              makeConversationAttachmentUploadActivityMessages({
                id: attachmentId,
                name: attachmentName,
                type: attachmentType,
              })

            await engine.addMessages([activityRequest, activityResponse])

            debug(`uploaded attachment`, {
              resourceName,
              attachmentName,
              attachmentType,
            }).log('integration.googlechat.queue.handleInteractEvent')
          } catch (error) {
            await captureError(error)

            debug(`failed to upload attachment`, {
              resourceName,
              error: error instanceof Error ? error.message : String(error),
            }).log('integration.googlechat.queue.handleInteractEvent')
          }
        }
      } else if (attachments.length > 0) {
        debug(
          `attachments feature disabled - skipping ${attachments.length} attachment(s)`
        ).log('integration.googlechat.queue.handleInteractEvent')
      }
    }

    // handle send
    {
      const text = payload.text.trim()

      if (text) {
        await engine.send(payload.text)
      } else {
        // @note file-only messages should add attachments to context but not
        // generate an unsolicited response without user text.
        debug(`no text to send - returning after attachment processing`).log(
          'integration.googlechat.queue.handleInteractEvent'
        )

        return
      }
    }

    // @note superseded before generation - the message is now in the
    // conversation, so skip producing a reply the latest message's handler will
    // coalesce. Cheap guard that avoids a doomed model call.
    if (superseding && (await supersede.isSuperseded())) {
      debug(`superseded before generation - skipping reply`).log(
        'integration.googlechat.queue.handleInteractEvent'
      )

      return
    }

    // handle receive
    {
      const { text } = await engine.receive()

      await sink.join()

      // @note the engine soft-yielded mid-turn because a newer message superseded
      // this one; its partial progress is stored, so skip the send and let the
      // latest message's handler produce the reply.
      if (watch?.didYield()) {
        debug(`yielded to a newer message - skipping send`).log(
          'integration.googlechat.queue.handleInteractEvent'
        )

        return
      }

      if (text) {
        const messages = await markdownToMessages(text)

        for (const message of messages) {
          if (message.type === 'text') {
            await sendReply(message.text)
          }

          if (message.type === 'image') {
            await sendImageReply(message.image)
          }
        }
      }
    }
  } finally {
    // @note stop watching the session channel and tear down its subscription;
    // the turn is over (sent, yielded, or errored).
    if (watch) {
      await watch.dispose()
    }

    await engine.dispose()
  }
}

/**
 * @param {string} googlechatIntegrationId
 * @param {SetupPayload} payload
 * @returns {Promise<void>}
 */
export async function handleSetupEvent(googlechatIntegrationId, payload) {
  debug(`setup`, { googlechatIntegrationId, payload }).log(
    'integration.googlechat.queue.handleSetupEvent'
  )

  const integration = await prisma.googlechatIntegration.findUnique({
    where: {
      id: googlechatIntegrationId,
    },

    include: {
      user: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(
      `GooglechatIntegration not found: ${googlechatIntegrationId}`
    )
  }

  if (integration.user) {
    updateSessionStore({
      user: userToSessionUser(integration.user),
    })

    setContextUser(integration.user)

    await setupFrontendHostContext(integration.user)
  }

  await doSetup(integration)
}

/**
 * @typedef {z.infer<typeof InitiatePayloadSchema>} InitiatePayload
 */
export const InitiatePayloadSchema = z
  .object({
    space: z.string(),
    text: z.string(),
    context: z.record(z.string(), z.any()).optional(),
  })
  .strict()

/**
 * @typedef {{
 *   type: typeof INITIATE_EVENT_TYPE,
 *   payload: InitiatePayload
 * }} InitiateEvent
 *
 * @param {string} googlechatIntegrationId
 * @param {InitiatePayload} payload
 * @returns {Promise<void>}
 */
export async function handleInitiateEvent(googlechatIntegrationId, payload) {
  debug(`initiate`, { googlechatIntegrationId, payload }).log(
    'integration.googlechat.queue.handleInitiateEvent'
  )

  const integration = await prisma.googlechatIntegration.findUnique({
    where: {
      id: googlechatIntegrationId,
    },

    include: {
      user: true,
      bot: true,
    },
  })

  if (!integration) {
    return throwNotFound(
      `GooglechatIntegration not found: ${googlechatIntegrationId}`
    )
  }

  if (!integration.bot) {
    await captureUnexpectedState(
      'Google Chat initiate triggered for integration with no bot configured',
      { googlechatIntegrationId, integrationName: integration.name }
    )

    return
  }

  if (!integration.serviceAccountKey) {
    await captureUnexpectedState(
      'Google Chat initiate triggered for integration with no service account key',
      { googlechatIntegrationId, integrationName: integration.name }
    )

    return
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    return throwLimitsReached(`Limits exceeded`)
  }

  const googlechatConfig =
    /** @type {import('@/lib/googlechat.api').GooglechatIntegration} */ (
      integration
    )

  if (integration.user) {
    updateSessionStore({
      user: userToSessionUser(integration.user),
    })

    setContextUser(integration.user)

    await setupFrontendHostContext(integration.user)
  }

  let space

  try {
    space = await resolveGoogleChatSpace(googlechatConfig, payload.space)

    await sendGoogleChatMessage(googlechatConfig, space, payload.text)
  } catch (error) {
    await captureUnexpectedState(
      'Google Chat initiate message failed - user will not receive outreach',
      {
        googlechatIntegrationId,
        spaceName: space,
        error: error instanceof Error ? error.message : String(error),
      }
    )

    await logGoogleChatApiError({
      integration,
      name: 'Google Chat Initiate Message Error',
      description: 'Failed to send a Google Chat initiate message.',
      operation: 'spaces.messages.create',
      error,
      payload: {
        senderName: '',
        senderDisplayName: '',
        spaceName: space || payload.space,
      },
    })

    debug(`failed to send message`, { error }).log(
      'integration.googlechat.queue.handleInitiateEvent'
    )

    return
  }

  const sessionKey = getGoogleChatInitiateSessionKey(googlechatIntegrationId, {
    space,
  })

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  debug(`session key`, { sessionKey }).log(
    'integration.googlechat.queue.handleInitiateEvent'
  )

  const contextMessages = payload.context
    ? makeActivityMessagePair(
        '_getGoogleChatContext',
        { space },
        { context: payload.context }
      )
    : []

  const messages = [
    ...makeActivityMessagePair(
      '_initiateConversation',
      {},
      {
        space,
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
      app: 'googlechat',

      googlechat: {
        integrationId: integration.id,
        spaceName: space,
        initiated: true,
      },
    },
  })

  if (persist) {
    await setGoogleChatSessionConversationId({
      sessionKey,
      conversationId,
      sessionDurationSecs: ttlSecs,
    })

    const dmSessionKey = getGoogleChatInitiateDmSessionKey(
      googlechatIntegrationId,
      { space }
    )

    if (dmSessionKey !== sessionKey) {
      await setGoogleChatSessionConversationId({
        sessionKey: dmSessionKey,
        conversationId,
        sessionDurationSecs: ttlSecs,
      })
    }
  }

  debug(`conversation created`, { conversationId, sessionKey }).log(
    'integration.googlechat.queue.handleInitiateEvent'
  )
}

/**
 * @typedef {(
 *   | {type: typeof INTERACT_EVENT_TYPE, payload: InteractPayload}
 *   | {type: typeof INITIATE_EVENT_TYPE, payload: InitiatePayload}
 *   | {type: typeof SETUP_EVENT_TYPE, payload: SetupPayload}
 * ) & Record<string, unknown>} GoogleChatEvent
 */

/**
 * @param {string} googlechatIntegrationId
 * @param {GoogleChatEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(googlechatIntegrationId, event) {
  switch (true) {
    case event.type === INTERACT_EVENT_TYPE: {
      await parseAsync(InteractPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === INITIATE_EVENT_TYPE: {
      await parseAsync(InitiatePayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === SETUP_EVENT_TYPE: {
      await parseAsync(SetupPayloadSchema, event.payload, captureInputError)

      break
    }
  }

  if (event.type === INTERACT_EVENT_TYPE) {
    // @note allocate a per-session order and nudge any in-flight handler for an
    // earlier message so it can soft-yield; thread the order into the (validated)
    // payload and serialize the dispatch per session so handlers run one at a
    // time.
    const { sessionKey } = getGoogleChatInteractSessionKeys(
      googlechatIntegrationId,
      event.payload
    )

    event.payload.order = await allocateOrder(sessionKey)

    await queue(
      `/api/v1/integration/googlechat/${googlechatIntegrationId}/queue`,
      event,
      omit(
        {
          deduplicationId: getGoogleChatInteractDeduplicationId(
            googlechatIntegrationId,
            event.payload
          ),
          flow: { key: sessionKey, parallel: 1 },
        },
        [OMIT_UNDEFINED]
      )
    )

    return
  }

  await queue(
    `/api/v1/integration/googlechat/${googlechatIntegrationId}/queue`,
    event,
    {}
  )
}

/**
 */
export default withQueueHandlerBounded('googlechatIntegrationId', {
  [INTERACT_EVENT_TYPE]: {
    handler: handleInteractEvent,
    schema: InteractPayloadSchema,
  },
  [INITIATE_EVENT_TYPE]: {
    handler: handleInitiateEvent,
    schema: InitiatePayloadSchema,
  },
  [SETUP_EVENT_TYPE]: {
    handler: handleSetupEvent,
    schema: SetupPayloadSchema,
  },
})

/**
 * @manual Google Chat Integration
 *
 * ## Background Processing
 *
 * Google Chat requires webhook responses within 30 seconds, which is too
 * short for many AI conversations. To handle this, messages are processed
 * asynchronously in the background, allowing the bot to acknowledge Google
 * Chat immediately and deliver its reply when ready.
 *
 * ## Conversation Sessions
 *
 * Each user in each Google Chat space has their own independent conversation
 * context, so a single user can hold separate ongoing conversations across
 * different spaces without them mixing.
 *
 * Users can restart their conversation at any time by sending `///restart`,
 * `///reset`, or `///new`, which clears the current context and starts a
 * fresh session.
 */
