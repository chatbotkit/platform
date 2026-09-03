// @ts-check
import messages from '@/config/messages'

import prisma from '@/prisma/client'

import { makeActivityMessagePair } from '@/lib/activity'
import { getConversationDetails } from '@/lib/bot.conversation'
import { setContextUser } from '@/lib/context.store'
import { createConversation } from '@/lib/conversation.create'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { hasConversation } from '@/lib/conversation.find'
import { TAG_ERROR, createSinkEvent } from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import {
  captureError,
  captureInputError,
  captureUnexpectedState,
} from '@/lib/error'
import { logIntegrationApiError } from '@/lib/integration.api.error'
import { setupFrontendHostContext } from '@/lib/integration.context'
import { resolveSession } from '@/lib/integration.session'
import { runTasks } from '@/lib/job'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import { allocateOrder, messagingSupersede } from '@/lib/messaging.supersede'
import {
  DEFAULT_TEAMS_SERVICE_URL,
  sendTeamsMessage,
  sendTeamsReply,
} from '@/lib/microsoftteams.api'
import {
  chunkText,
  normalizeConversationId,
} from '@/lib/microsoftteams.markdown'
import {
  parseTeamsAllowFrom,
  teamsFromIsAllowed,
} from '@/lib/microsoftteams.validation'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { throwLimitsReached, throwNotFound } from '@/lib/response'
import { updateSessionStore } from '@/lib/session.context'
import { resolveSessionDuration } from '@/lib/session.duration'
import { userToSessionUser } from '@/lib/user.session'
import { parseAsync } from '@/lib/zod.schema'

import { doSetup } from '@/pages/api/v1/integration/microsoftteams/[microsoftteamsIntegrationId]/setup'

import { z } from 'zod'

export const INTERACT_EVENT_TYPE = 'interact'
export const SETUP_EVENT_TYPE = 'setup'
export const INITIATE_EVENT_TYPE = 'initiate'

/**
 * @typedef {z.infer<typeof InteractPayloadSchema>} InteractPayload
 */
export const InteractPayloadSchema = z.object({
  activityId: z.string(),
  conversationId: z.string(),
  serviceUrl: z.string(),
  fromId: z.string(),
  fromName: z.string(),
  message: z.string(),

  // @note per-sender monotonic order allocated on the webhook path (see
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
 * @param {string} microsoftteamsIntegrationId
 * @param {Pick<InteractPayload, 'fromId'>} payload
 * @returns {string}
 */
export function getTeamsInteractSessionKey(
  microsoftteamsIntegrationId,
  payload
) {
  return `microsoftteams-session-${microsoftteamsIntegrationId}-${payload.fromId}`
}

/**
 * @param {string} microsoftteamsIntegrationId
 * @param {Pick<InteractPayload, 'conversationId' | 'fromId'>} payload
 * @returns {{ sessionKey: string, sessionFallbackKeys: string[] }}
 */
export function getTeamsInteractSessionKeys(
  microsoftteamsIntegrationId,
  payload
) {
  const normalizedConversationId = normalizeConversationId(
    payload.conversationId
  )

  return {
    sessionKey: getTeamsInteractSessionKey(
      microsoftteamsIntegrationId,
      payload
    ),
    sessionFallbackKeys: [
      `microsoftteams-session-conversation-${microsoftteamsIntegrationId}-${normalizedConversationId}`,
    ],
  }
}

/**
 * @param {string} microsoftteamsIntegrationId
 * @param {{ conversationId: string }} payload
 * @returns {string}
 */
export function getTeamsInitiateSessionKey(
  microsoftteamsIntegrationId,
  payload
) {
  const normalizedConversationId = normalizeConversationId(
    payload.conversationId
  )

  return `microsoftteams-session-conversation-${microsoftteamsIntegrationId}-${normalizedConversationId}`
}

/**
 * @param {{ sessionKey: string, sessionFallbackKeys?: string[], sessionDurationSecs?: number }} options
 * @returns {Promise<string | null>}
 */
export async function resolveTeamsSessionConversationId({
  sessionKey,
  sessionFallbackKeys = [],
  sessionDurationSecs,
}) {
  let conversationId = await memcache.get(sessionKey)

  if (!conversationId && sessionFallbackKeys.length > 0) {
    const resolved = await resolveSession(sessionFallbackKeys)

    if (resolved) {
      conversationId = resolved.value

      debug(`resolved from fallback key`, {
        fallbackKey: resolved.key,
        conversationId,
      }).log(
        'integration.microsoftteams.queue.resolveTeamsSessionConversationId'
      )

      if (sessionDurationSecs) {
        await memcache.set(sessionKey, conversationId, {
          ex: sessionDurationSecs,
        })
      }
    }
  }

  return conversationId
}

/**
 * @param {{ sessionKey: string, conversationId: string, sessionDurationSecs: number }} options
 * @returns {Promise<void>}
 */
export async function setTeamsSessionConversationId({
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
export async function bumpTeamsSessionConversationId({
  sessionKey,
  sessionDurationSecs,
}) {
  await memcache.expire(sessionKey, sessionDurationSecs)
}

/**
 * @param {{ sessionKey: string, sessionFallbackKeys?: string[] }} options
 * @returns {Promise<void>}
 */
export async function deleteTeamsSessionConversationId({
  sessionKey,
  sessionFallbackKeys = [],
}) {
  await memcache.del(sessionKey)

  for (const key of sessionFallbackKeys) {
    await memcache.del(key)
  }
}

/**
 * @param {{
 *   integration: { id: string, userId: string, botId?: string | null, bot?: { id?: string } | null } | null,
 *   name: string,
 *   description: string,
 *   operation: string,
 *   error: unknown,
 *   serviceUrl?: string,
 *   conversationId?: string | null,
 *   targetConversationId?: string,
 *   activityId?: string,
 * }} options
 * @returns {Promise<void>}
 */
async function logTeamsApiError({
  integration,
  name,
  description,
  operation,
  error,
  serviceUrl,
  conversationId,
  targetConversationId,
  activityId,
}) {
  if (!integration) {
    return
  }

  await logIntegrationApiError({
    userId: integration.userId,
    type: 'integration.microsoftteams.api.error',
    name,
    description,
    relations: {
      microsoftteamsIntegrationId: integration.id,
      botId: integration.botId || integration.bot?.id,
      conversationId,
    },
    operation,
    error,
    meta: {
      serviceUrl,
      conversationId: targetConversationId || conversationId,
      activityId,
    },
  })
}

/**
 * @typedef {{
 *   type: typeof INTERACT_EVENT_TYPE,
 *   payload: InteractPayload
 * }} InteractEvent
 *
 * @param {string} microsoftteamsIntegrationId
 * @param {InteractPayload} payload
 * @returns {Promise<void>}
 */
export async function handleInteractEvent(
  microsoftteamsIntegrationId,
  payload,
  context
) {
  debug(`interact`, { microsoftteamsIntegrationId, payload }).log(
    'integration.microsoftteams.queue.handleInteractEvent'
  )

  const integration = await prisma.microsoftteamsIntegration.findUnique({
    where: {
      id: microsoftteamsIntegrationId,
    },

    include: {
      user: true, // @note super important

      bot: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(
      `MicrosoftteamsIntegration not found: ${microsoftteamsIntegrationId}`
    )
  }

  if (!integration.bot) {
    debug(`skipping - no bot configured`).log(
      'integration.microsoftteams.queue.handleInteractEvent'
    )

    return
  }

  // check allowFrom restriction
  {
    const entries = parseTeamsAllowFrom(integration.allowFrom || '')

    const senderId = payload.fromId

    if (senderId && !teamsFromIsAllowed(senderId, entries)) {
      debug(`sender not allowed`, {
        fromId: senderId,
      }).log('integration.microsoftteams.queue.handleInteractEvent')

      await logEvent({
        user: { id: integration.userId },
        name: 'Sender Blocked',
        description: `A message was blocked due to allowFrom restrictions.`,
        type: 'integration.microsoftteams.blocked',
        relations: {
          microsoftteamsIntegrationId: integration.id,
        },
        meta: {
          fromId: senderId,
          fromName: payload.fromName,
        },
      })

      return
    }
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    // @note the account is over its usage limits - post a pre-canned reply so
    // the user gets a visible signal instead of silence. Best-effort: a failed
    // send is logged but must not mask the underlying limit condition.
    if (integration.botFrameworkAppId && integration.botFrameworkAppSecret) {
      try {
        await sendTeamsReply(
          /** @type {import('@/lib/microsoftteams.api').MicrosoftteamsIntegration} */ (
            integration
          ),
          payload.serviceUrl,
          {
            conversationId: normalizeConversationId(payload.conversationId),
            activityId: payload.activityId,
            text: messages.limitsReachedReply,
          }
        )
      } catch (e) {
        await captureError(e)

        debug(`limit reply send failed`, { error: e }).log(
          'integration.microsoftteams.queue.handleInteractEvent'
        )
      }

      return
    }

    return throwLimitsReached(`Limits exceeded`)
  }

  // @note re-assign after null guard so TS narrows the type for closures below
  const teamsConfig =
    /** @type {import('@/lib/microsoftteams.api').MicrosoftteamsIntegration} */ (
      integration
    )

  if (integration.user) {
    updateSessionStore({
      user: userToSessionUser(integration.user),
    })

    setContextUser(integration.user)

    await setupFrontendHostContext(integration.user)
  }

  const normalizedConversationId = normalizeConversationId(
    payload.conversationId
  )

  const { sessionKey, sessionFallbackKeys } = getTeamsInteractSessionKeys(
    integration.id,
    payload
  )
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

  debug(`session key`, { sessionKey }).log(
    'integration.microsoftteams.queue.handleInteractEvent'
  )

  // handle session key
  {
    // @note special handling for restart/reset

    if (
      ['///restart', '///reset', '///new'].includes(
        payload.message?.trim().toLowerCase() || ''
      )
    ) {
      debug(`restart`).log(
        'integration.microsoftteams.queue.handleInteractEvent'
      )

      await deleteTeamsSessionConversationId({
        sessionKey,
        sessionFallbackKeys,
      })

      return
    }
  }

  let conversationId = persist
    ? await resolveTeamsSessionConversationId({
        sessionKey,
        sessionFallbackKeys,
        sessionDurationSecs: ttlSecs,
      })
    : null

  debug(`conversationId`, { conversationId }).log(
    'integration.microsoftteams.queue.handleInteractEvent'
  )

  const reusable = !!conversationId && (await hasConversation(conversationId))

  // @note slide the session window: refresh the TTL on every reuse so an active
  // conversation is not cut off at a fixed offset from its creation time.
  if (persist && reusable) {
    await bumpTeamsSessionConversationId({
      sessionKey,
      sessionDurationSecs: ttlSecs,
    })
  }

  if (!conversationId || !reusable) {
    const { id: cid } = await createConversation(integration.userId, {
      ...getConversationDetails(integration),

      meta: {
        app: 'microsoftteams',

        microsoftteams: {
          integrationId: integration.id,
        },
      },
    })

    conversationId = cid

    if (persist) {
      await setTeamsSessionConversationId({
        sessionKey,
        conversationId,
        sessionDurationSecs: ttlSecs,
      })
    }
  }

  async function replaceMessage(text) {
    debug(`replaceMessage`, { text, payload }).log(
      'integration.microsoftteams.queue.handleInteractEvent.replaceMessage'
    )

    try {
      await sendTeamsReply(teamsConfig, payload.serviceUrl, {
        conversationId: normalizedConversationId,
        activityId: payload.activityId,
        text,
      })
    } catch (e) {
      await captureError(e)

      await logTeamsApiError({
        integration,
        name: 'Microsoft Teams Reply Error',
        description: 'Failed to send Microsoft Teams reply.',
        operation: 'activities.reply',
        error: e,
        serviceUrl: payload.serviceUrl,
        conversationId,
        activityId: payload.activityId,
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
      }

      return event
    }

    async join() {
      await runTasks(this.#promises)
    }
  })()

  const engine = await getStatefulConversationEngine({
    conversationId: conversationId,

    untrusted: true,

    options: {
      signal: context?.signal,

      // @note fire-once per-mark signals from the queue monitor; the engine's
      // `timeoutMarks` feature listens to these. NOT cancellation signals

      markSignals: context?.markSignals,

      // @note cooperative soft-yield: tripped when a newer message from the same
      // sender supersedes this turn, so the engine stops at its next iteration
      // boundary instead of finishing a reply that is thrown away.

      yieldSignal: watch?.yieldSignal,

      features: [
        // @note surface who sent the current message to the model for this turn
        // only - the userInfo feature injects it as a soft activity message and
        // never persists it. Lets the bot stay aware of the sender in shared
        // channels where many users interact with one conversation.

        {
          name: 'userInfo',
          options: {
            name: payload.fromName,
            externalId: payload.fromId,
            source: 'microsoftteams',
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
    // handle send
    {
      const text = payload.message.trim()

      if (text) {
        await engine.send(payload.message)
      }
    }

    // @note superseded before generation - the message is now in the
    // conversation, so skip producing a reply the latest message's handler will
    // coalesce. Cheap guard that avoids a doomed model call.
    if (superseding && (await supersede.isSuperseded())) {
      debug(`superseded before generation - skipping reply`).log(
        'integration.microsoftteams.queue.handleInteractEvent'
      )

      return
    }

    // handle receive
    {
      // @todo provide indication that the bot is typing

      const { text } = await engine.receive()

      await sink.join()

      // @note the engine soft-yielded mid-turn because a newer message
      // superseded this one; skip the final reply and let the latest message's
      // handler produce the one the user sees.
      if (watch?.didYield()) {
        debug(`yielded to a newer message - skipping send`).log(
          'integration.microsoftteams.queue.handleInteractEvent'
        )

        return
      }

      // @note Teams has a ~4000 char limit per message so we chunk long
      //   responses and send each part as a separate message

      const chunks = chunkText(text)

      if (chunks.length <= 1) {
        await replaceMessage(text)
      } else {
        // @note first chunk replies to the original activity, subsequent
        //   chunks are sent as new messages in the same conversation

        await replaceMessage(chunks[0])

        for (let i = 1; i < chunks.length; i++) {
          try {
            await sendTeamsMessage(
              teamsConfig,
              payload.serviceUrl,
              normalizedConversationId,
              chunks[i]
            )
          } catch (e) {
            await captureError(e)
          }
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
 * @typedef {{
 *   type: typeof SETUP_EVENT_TYPE,
 *   payload: SetupPayload
 * }} SetupEvent
 *
 * @param {string} microsoftteamsIntegrationId
 * @param {SetupPayload} payload
 * @returns {Promise<void>}
 */
export async function handleSetupEvent(microsoftteamsIntegrationId, payload) {
  debug(`setup`, { microsoftteamsIntegrationId, payload }).log(
    'integration.microsoftteams.queue.handleSetupEvent'
  )

  const integration = await prisma.microsoftteamsIntegration.findUnique({
    where: {
      id: microsoftteamsIntegrationId,
    },

    include: {
      user: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(
      `MicrosoftteamsIntegration not found: ${microsoftteamsIntegrationId}`
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
export const InitiatePayloadSchema = z.object({
  conversationId: z.string(),
  text: z.string(),
  context: z.record(z.string(), z.any()).optional(),
})

/**
 * @typedef {{
 *   type: typeof INITIATE_EVENT_TYPE,
 *   payload: InitiatePayload
 * }} InitiateEvent
 *
 * @param {string} microsoftteamsIntegrationId
 * @param {InitiatePayload} payload
 * @returns {Promise<void>}
 */
export async function handleInitiateEvent(
  microsoftteamsIntegrationId,
  payload
) {
  debug(`initiate`, { microsoftteamsIntegrationId, payload }).log(
    'integration.microsoftteams.queue.handleInitiateEvent'
  )

  const integration = await prisma.microsoftteamsIntegration.findUnique({
    where: {
      id: microsoftteamsIntegrationId,
    },

    include: {
      user: true,
      bot: true,
    },
  })

  if (!integration) {
    return throwNotFound(
      `MicrosoftteamsIntegration not found: ${microsoftteamsIntegrationId}`
    )
  }

  if (!integration.bot) {
    await captureUnexpectedState(
      'Microsoft Teams initiate triggered for integration with no bot configured',
      { microsoftteamsIntegrationId, integrationName: integration.name }
    )

    return
  }

  if (!integration.botFrameworkAppId || !integration.botFrameworkAppSecret) {
    await captureUnexpectedState(
      'Microsoft Teams initiate triggered for integration with missing Bot Framework credentials',
      { microsoftteamsIntegrationId, integrationName: integration.name }
    )

    return
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    return throwLimitsReached(`Limits exceeded`)
  }

  const teamsConfig =
    /** @type {import('@/lib/microsoftteams.api').MicrosoftteamsIntegration} */ (
      integration
    )

  if (integration.user) {
    updateSessionStore({
      user: userToSessionUser(integration.user),
    })

    setContextUser(integration.user)

    await setupFrontendHostContext(integration.user)
  }

  const serviceUrl = DEFAULT_TEAMS_SERVICE_URL
  const targetConversationId = normalizeConversationId(payload.conversationId)

  try {
    await sendTeamsMessage(
      teamsConfig,
      serviceUrl,
      targetConversationId,
      payload.text
    )
  } catch (error) {
    await captureUnexpectedState(
      'Microsoft Teams initiate message failed - user will not receive outreach',
      {
        microsoftteamsIntegrationId,
        conversationId: targetConversationId,
        error: error instanceof Error ? error.message : String(error),
      }
    )

    debug(`failed to send message`, { error }).log(
      'integration.microsoftteams.queue.handleInitiateEvent'
    )

    await logTeamsApiError({
      integration,
      name: 'Microsoft Teams Initiate Message Error',
      description: 'Failed to send Microsoft Teams initiate message.',
      operation: 'activities.create',
      error,
      serviceUrl,
      targetConversationId,
    })

    return
  }

  const sessionKey = getTeamsInitiateSessionKey(microsoftteamsIntegrationId, {
    conversationId: targetConversationId,
  })

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  const contextMessages = payload.context
    ? makeActivityMessagePair(
        '_getTeamsContext',
        { conversationId: targetConversationId },
        { context: payload.context }
      )
    : []

  const messages = [
    ...makeActivityMessagePair(
      '_initiateConversation',
      {},
      {
        conversationId: targetConversationId,
        serviceUrl,
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
      app: 'microsoftteams',

      microsoftteams: {
        integrationId: integration.id,
        conversationId: targetConversationId,
        serviceUrl,
        initiated: true,
      },
    },
  })

  if (persist) {
    await setTeamsSessionConversationId({
      sessionKey,
      conversationId,
      sessionDurationSecs: ttlSecs,
    })
  }

  debug(`conversation created`, { conversationId, sessionKey }).log(
    'integration.microsoftteams.queue.handleInitiateEvent'
  )
}

/**
 * @param {string} microsoftteamsIntegrationId
 * @param {InteractEvent|SetupEvent|InitiateEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(microsoftteamsIntegrationId, event) {
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
    // @note allocate a per-sender order and nudge any in-flight handler for an
    // earlier message so it can soft-yield; thread the order into the (validated)
    // payload and serialize the dispatch per sender so handlers run one at a
    // time.
    const { sessionKey } = getTeamsInteractSessionKeys(
      microsoftteamsIntegrationId,
      event.payload
    )

    event.payload.order = await allocateOrder(sessionKey)

    await queue(
      `/api/v1/integration/microsoftteams/${microsoftteamsIntegrationId}/queue`,
      event,
      {
        deduplicationId: `microsoftteams-${microsoftteamsIntegrationId}-${event.type}-${event.payload.activityId}`,
        flow: { key: sessionKey, parallel: 1 },
      }
    )

    return
  }

  await queue(
    `/api/v1/integration/microsoftteams/${microsoftteamsIntegrationId}/queue`,
    event,
    {}
  )
}

/**
 */
export default withQueueHandlerBounded('microsoftteamsIntegrationId', {
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
 * @manual Microsoft Teams Integration
 *
 * ## Background Processing
 *
 * Messages from Teams are processed asynchronously in the background, so the
 * Bot Framework webhook is acknowledged immediately and the bot delivers its
 * reply when ready. This enables complex AI conversations without timing out.
 *
 * ## Conversation Sessions
 *
 * Each user has their own independent conversation context. The
 * `sessionDuration` setting controls how long that context persists between
 * messages and defaults to one day if not specified. Sessions enable
 * contextual conversations where the bot remembers previous messages within
 * the session window.
 *
 * Users can restart their conversation at any time by sending `///restart`,
 * `///reset`, or `///new`, which clears the current context and starts a
 * fresh session.
 *
 * ## Long Responses
 *
 * Teams limits message length, so when a bot reply is long it is split into
 * multiple messages - the first replies to the user's message and the rest
 * follow in the same conversation - so long responses are delivered in full.
 */
