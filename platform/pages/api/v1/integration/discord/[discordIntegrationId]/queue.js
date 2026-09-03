/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Discord) */
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
import { markdownToMessages } from '@/lib/discord.markdown'
import {
  discordSenderIsAllowed,
  parseDiscordAllowFrom,
} from '@/lib/discord.validation'
import {
  captureError,
  captureInputError,
  captureUnexpectedState,
} from '@/lib/error'
import fetch from '@/lib/fetch'
import { logIntegrationApiError } from '@/lib/integration.api.error'
import { setupFrontendHostContext } from '@/lib/integration.context'
import { runTasks } from '@/lib/job'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { throwLimitsReached, throwNotFound } from '@/lib/response'
import { updateSessionStore } from '@/lib/session.context'
import { resolveSessionDuration } from '@/lib/session.duration'
import { userToSessionUser } from '@/lib/user.session'
import { parseAsync } from '@/lib/zod.schema'

import { doSetup } from '@/pages/api/v1/integration/discord/[discordIntegrationId]/setup'

import { z } from 'zod'

// @see https://discord.com/developers/docs/resources/message#message-object-message-flags
const EPHEMERAL_MESSAGE_FLAG = 1 << 6

export const INTERACT_EVENT_TYPE = 'interact'
export const SETUP_EVENT_TYPE = 'setup'
export const INITIATE_EVENT_TYPE = 'initiate'

/**
 * @typedef {z.infer<typeof InteractPayloadSchema>} InteractPayload
 */
export const InteractPayloadSchema = z.object({
  interactionId: z.string(),
  applicationId: z.string(),
  userId: z.string(),
  username: z.string().optional(),
  token: z.string(),
  message: z.string(),
})

/**
 * @typedef {z.infer<typeof SetupPayloadSchema>} SetupPayload
 */
export const SetupPayloadSchema = z.object({
  // pass
})

/**
 * @param {string} discordIntegrationId
 * @param {Pick<InteractPayload, 'userId'>} payload
 * @returns {string}
 */
export function getDiscordInteractSessionKey(discordIntegrationId, payload) {
  return `discord-session-${discordIntegrationId}-${payload.userId}`
}

/**
 * @param {string} discordIntegrationId
 * @param {Pick<InitiatePayload, 'channelId'>} payload
 * @returns {string}
 */
export function getDiscordInitiateSessionKey(discordIntegrationId, payload) {
  // @note initiate events do not know the Discord userId, so they store the
  // proactive conversation under the channel key.
  return `discord-session-${discordIntegrationId}-${payload.channelId}`
}

/**
 * @param {{ sessionKey: string }} options
 * @returns {Promise<string | null>}
 */
export async function resolveDiscordSessionConversationId({ sessionKey }) {
  return await memcache.get(sessionKey)
}

/**
 * @param {{ sessionKey: string, conversationId: string, sessionDurationSecs: number }} options
 * @returns {Promise<void>}
 */
export async function setDiscordSessionConversationId({
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
export async function bumpDiscordSessionConversationId({
  sessionKey,
  sessionDurationSecs,
}) {
  await memcache.expire(sessionKey, sessionDurationSecs)
}

/**
 * @param {{ sessionKey: string }} options
 * @returns {Promise<void>}
 */
export async function deleteDiscordSessionConversationId({ sessionKey }) {
  await memcache.del(sessionKey)
}

/**
 * @param {{
 *   integration: { id: string, userId: string, botId?: string | null, bot?: { id?: string } | null } | null,
 *   name: string,
 *   description: string,
 *   operation: string,
 *   error: unknown,
 *   conversationId?: string | null,
 *   channelId?: string,
 *   interactionId?: string,
 * }} options
 * @returns {Promise<void>}
 */
async function logDiscordApiError({
  integration,
  name,
  description,
  operation,
  error,
  conversationId,
  channelId,
  interactionId,
}) {
  if (!integration) {
    return
  }

  await logIntegrationApiError({
    userId: integration.userId,
    type: 'integration.discord.api.error',
    name,
    description,
    relations: {
      discordIntegrationId: integration.id,
      botId: integration.botId || integration.bot?.id,
      conversationId,
    },
    operation,
    error,
    meta: {
      channelId,
      interactionId,
    },
  })
}

/**
 * @typedef {{
 *   type: typeof INTERACT_EVENT_TYPE,
 *   payload: InteractPayload
 * }} InteractEvent
 *
 * @param {string} discordIntegrationId
 * @param {InteractPayload} payload
 * @returns {Promise<void>}
 */
export async function handleInteractEvent(
  discordIntegrationId,
  payload,
  context
) {
  debug(`interact`, { discordIntegrationId, payload }).log(
    'integration.discord.queue.handleInteractEvent'
  )

  const integration = await prisma.discordIntegration.findUnique({
    where: {
      id: discordIntegrationId,
    },

    include: {
      user: true, // @note super important

      bot: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(
      `DiscordIntegration not found: ${discordIntegrationId}`
    )
  }

  if (!integration.bot) {
    debug(`skipping - no bot configured`).log(
      'integration.discord.queue.handleInteractEvent'
    )

    return
  }

  // check allowFrom restriction
  {
    const entries = parseDiscordAllowFrom(integration.allowFrom || '')

    if (
      !discordSenderIsAllowed(
        { userId: payload.userId, username: payload.username },
        entries
      )
    ) {
      await logEvent({
        user: { id: integration.userId },
        name: 'Sender Blocked',
        description: `A message was blocked due to allowFrom restrictions.`,
        type: 'integration.discord.blocked',
        relations: { discordIntegrationId: integration.id },
        meta: { userId: payload.userId, username: payload.username },
      })

      return
    }
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    // @note the account is over its usage limits - post a pre-canned reply so
    // the user gets a visible signal instead of silence. Best-effort: a failed
    // post must not mask the underlying limit condition. The normal reply helper
    // is not defined yet here, so mirror it by editing the original interaction
    // response directly.
    if (payload.applicationId && payload.token) {
      try {
        const response = await fetch(
          `https://discord.com/api/v10/webhooks/${payload.applicationId}/${payload.token}/messages/@original`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: messages.limitsReachedReply }),
          }
        )

        if (!response.ok) {
          throw new Error(`Unexpected Discord API response: ${response.status}`)
        }
      } catch (error) {
        debug(`limit reply post failed`, { error }).log(
          'integration.discord.queue.handleInteractEvent'
        )

        await captureError(error)
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

    await setupFrontendHostContext(integration.user)
  }

  const sessionKey = getDiscordInteractSessionKey(integration.id, payload)

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  debug(`session key`, { sessionKey }).log(
    'integration.discord.queue.handleInteractEvent'
  )

  // handle session key
  {
    // @note special handling for restart/reset

    if (
      ['///restart', '///reset', '///new'].includes(
        payload.message?.trim().toLowerCase() || ''
      )
    ) {
      debug(`restart`).log('integration.discord.queue.handleInteractEvent')

      await deleteDiscordSessionConversationId({ sessionKey })

      return
    }
  }

  let conversationId = persist
    ? await resolveDiscordSessionConversationId({ sessionKey })
    : null

  debug(`conversationId`, { conversationId }).log(
    'integration.discord.queue.handleInteractEvent'
  )

  const reusable = !!conversationId && (await hasConversation(conversationId))

  // @note slide the session window: refresh the TTL on every reuse so an active
  // conversation is not cut off at a fixed offset from its creation time.
  if (persist && reusable) {
    await bumpDiscordSessionConversationId({
      sessionKey,
      sessionDurationSecs: ttlSecs,
    })
  }

  if (!conversationId || !reusable) {
    const { id: cid } = await createConversation(integration.userId, {
      ...getConversationDetails(integration),

      meta: {
        app: 'discord',

        discord: {
          integrationId: integration.id,
        },
      },
    })

    conversationId = cid

    if (persist) {
      await setDiscordSessionConversationId({
        sessionKey,
        conversationId,
        sessionDurationSecs: ttlSecs,
      })
    }
  }

  let untrusted

  {
    untrusted = !integration.ephemeral
  }

  const originalMessageUrl = `https://discord.com/api/v10/webhooks/${payload.applicationId}/${payload.token}/messages/@original`
  const followupMessageUrl = `https://discord.com/api/v10/webhooks/${payload.applicationId}/${payload.token}`

  // @note captured in the outer scope so the null-narrowing of `integration`
  // holds inside the nested sender closure below
  const integrationIsEphemeral = !!integration.ephemeral

  /**
   * @param {{
   *   url: string,
   *   method: string,
   *   content: string,
   *   ephemeral?: boolean,
   *   name: string,
   *   operation: string,
   * }} options
   * @returns {Promise<void>}
   */
  async function sendToDiscord({
    url,
    method,
    content,
    ephemeral,
    name,
    operation,
  }) {
    // @see https://discord.com/developers/docs/interactions/receiving-and-responding#responding-to-an-interaction
    // @see https://discord.com/developers/docs/interactions/receiving-and-responding#edit-original-interaction-response

    // @note Sometimes we can get rate-limited. In those cases it will be best
    // to enqueue the message with some exponential back off.

    // @todo implement rate limit handler

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,

        // @note follow-up messages do not inherit the ephemeral visibility of
        // the deferred response, so they have to opt in explicitly to match it
        ...(ephemeral && integrationIsEphemeral
          ? { flags: EPHEMERAL_MESSAGE_FLAG }
          : {}),
      }),
    })

    if (!response.ok) {
      const responseText = await response.text()

      let json

      try {
        if (responseText) {
          json = JSON.parse(responseText)
        } else {
          json = {}
        }
      } catch {
        throw new Error(`Cannot parse Discord API response`)
      }

      const error = new Error(json.message || 'Unexpected Discord API response')

      await logDiscordApiError({
        integration,
        name,
        description: 'Failed to deliver Discord interaction response.',
        operation,
        error,
        conversationId,
        interactionId: payload.interactionId,
      })

      if (response.status === 404) {
        // @note if we are too late it is likely that the webhook is not available
        // and as we result it will 404

        await captureError(error)
      } else {
        throw error
      }
    }
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  function buildContent(text) {
    return `<@${payload.userId}> ${payload.message}\n<@${payload.applicationId}> ${text}`
  }

  // @note delivery splits long replies into multiple Discord messages - the
  // first edits the original interaction response and the remainder are posted
  // as follow-ups - so responses over the per-message limit are no longer
  // dropped with "Invalid Form Body".
  async function deliverMessage(text) {
    debug(`deliverMessage`, { text, payload }).log(
      'integration.discord.queue.handleInteractEvent.deliverMessage'
    )

    const [first, ...rest] = await markdownToMessages(buildContent(text))

    await sendToDiscord({
      url: originalMessageUrl,
      method: 'PATCH',
      content: first?.text ?? '',
      name: 'Discord Interaction Reply Error',
      operation: 'webhooks.messages.update',
    })

    for (const message of rest) {
      await sendToDiscord({
        url: followupMessageUrl,
        method: 'POST',
        content: message.text,
        ephemeral: true,
        name: 'Discord Interaction Follow-up Error',
        operation: 'webhooks.messages.create',
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

    untrusted: untrusted,

    options: {
      signal: context?.signal,

      // @note fire-once per-mark signals from the queue monitor; the engine's
      // `timeoutMarks` feature listens to these. NOT cancellation signals

      markSignals: context?.markSignals,

      features: [
        // @note surface who sent the current message to the model for this turn
        // only - the userInfo feature injects it as a soft activity message and
        // never persists it. Lets the bot stay aware of the sender in shared
        // channels where many users interact with one conversation.

        {
          name: 'userInfo',
          options: {
            username: payload.username,
            externalId: payload.userId,
            source: 'discord',
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

    // handle receive
    {
      // @todo provide indication that the bot is typing

      const { text } = await engine.receive()

      await sink.join()

      await deliverMessage(text)
    }
  } finally {
    await engine.dispose()
  }
}

/**
 * @typedef {{
 *   type: typeof SETUP_EVENT_TYPE,
 *   payload: SetupPayload
 * }} SetupEvent
 *
 * @param {string} discordIntegrationId
 * @param {SetupPayload} payload
 * @returns {Promise<void>}
 */
export async function handleSetupEvent(discordIntegrationId, payload) {
  debug(`setup`, { discordIntegrationId, payload }).log(
    'integration.discord.queue.handleSetupEvent'
  )

  const integration = await prisma.discordIntegration.findUnique({
    where: {
      id: discordIntegrationId,
    },

    include: {
      user: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(
      `DiscordIntegration not found: ${discordIntegrationId}`
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
  channelId: z.string(),
  text: z.string(),
  context: z.record(z.string(), z.any()).optional(),
})

/**
 * @typedef {{
 *   type: typeof INITIATE_EVENT_TYPE,
 *   payload: InitiatePayload
 * }} InitiateEvent
 *
 * Handles the initiate event - sends an initial message to a Discord channel
 * and creates a conversation so that subsequent user replies are tracked.
 *
 * This is used for proactive outreach where the bot initiates the conversation
 * by sending a message to the user, rather than responding to a slash command.
 *
 * @param {string} discordIntegrationId
 * @param {InitiatePayload} payload
 * @returns {Promise<void>}
 */
export async function handleInitiateEvent(discordIntegrationId, payload) {
  debug('initiate', { discordIntegrationId, payload }).log(
    'integration.discord.queue.handleInitiateEvent'
  )

  const integration = await prisma.discordIntegration.findUnique({
    where: {
      id: discordIntegrationId,
    },

    include: {
      user: true,
      bot: true,
    },
  })

  if (!integration) {
    return throwNotFound(
      `DiscordIntegration not found: ${discordIntegrationId}`
    )
  }

  if (!integration.botToken) {
    await captureUnexpectedState(
      'Discord initiate triggered for integration with no bot token',
      { discordIntegrationId, integrationName: integration.name }
    )

    return
  }

  if (!integration.bot) {
    await captureUnexpectedState(
      'Discord initiate triggered for integration with no bot configured',
      { discordIntegrationId, integrationName: integration.name }
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

    await setupFrontendHostContext(integration.user)
  }

  // Send the initial message to Discord via REST API

  const response = await fetch(
    `https://discord.com/api/v10/channels/${payload.channelId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${integration.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: payload.text,
      }),
    }
  )

  if (!response.ok) {
    const text = await response.text()

    let json

    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      json = {}
    }

    await captureUnexpectedState(
      'Discord initiate message failed - user will not receive outreach',
      { discordIntegrationId, channelId: payload.channelId, error: json }
    )

    debug(`failed to send message`, { error: json }).log(
      'integration.discord.queue.handleInitiateEvent'
    )

    await logDiscordApiError({
      integration,
      name: 'Discord Initiate Message Error',
      description: 'Failed to send Discord initiate message.',
      operation: 'channels.messages.create',
      error: new Error(
        json.message || JSON.stringify(json) || 'Unexpected Discord API error'
      ),
      channelId: payload.channelId,
    })

    return
  }

  // @note session key uses channel-based format because we don't know the
  // userId at initiate time. The interact handler uses userId-based keys for
  // slash command interactions. Full session continuity requires handling
  // MESSAGE_CREATE gateway events (not currently supported).

  const sessionKey = getDiscordInitiateSessionKey(discordIntegrationId, payload)

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  debug(`session key`, { sessionKey }).log(
    'integration.discord.queue.handleInitiateEvent'
  )

  // @note if context is provided, add it as an activity so the bot has
  // background information about the recipient for future interactions
  const contextMessages = payload.context
    ? makeActivityMessagePair(
        '_getDiscordContext',
        { channelId: payload.channelId },
        { context: payload.context }
      )
    : []

  const messages = [
    ...makeActivityMessagePair(
      '_initiateConversation',
      {},
      {
        channelId: payload.channelId,
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
      app: 'discord',
      discord: {
        integrationId: integration.id,
        channelId: payload.channelId,
        initiated: true,
      },
    },
  })

  if (persist) {
    await setDiscordSessionConversationId({
      sessionKey,
      conversationId,
      sessionDurationSecs: ttlSecs,
    })
  }

  debug(`conversation created`, { conversationId, sessionKey }).log(
    'integration.discord.queue.handleInitiateEvent'
  )
}

/**
 * @param {string} discordIntegrationId
 * @param {InteractEvent|SetupEvent|InitiateEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(discordIntegrationId, event) {
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

  await queue(
    `/api/v1/integration/discord/${discordIntegrationId}/queue`,
    event,
    {
      ...(event.type === INTERACT_EVENT_TYPE
        ? {
            deduplicationId: `discord-${discordIntegrationId}-${event.type}-${event.payload.interactionId}`,
          }
        : {}),
    }
  )
}

/**
 */
export default withQueueHandlerBounded('discordIntegrationId', {
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
 * @manual Discord Integration
 *
 * ## Background Processing
 *
 * Discord requires webhook responses within 3 seconds, which is too short for
 * most AI conversations. To handle this, slash command interactions and setup
 * operations are processed asynchronously in the background, so the bot can
 * acknowledge Discord immediately and then deliver the AI response when it is
 * ready. Duplicate webhook deliveries from Discord are safely ignored, so users
 * never see the same response twice.
 *
 * ## Conversation Sessions
 *
 * Each user has their own independent conversation context. The
 * `sessionDuration` setting controls how long that context persists between
 * messages and defaults to one day if not specified, up to a maximum of one
 * month. Shorter sessions are useful for stateless queries, while longer
 * sessions enable ongoing, contextual conversations. When a session expires,
 * the next interaction starts a fresh conversation.
 *
 * When the integration's `ephemeral` setting is enabled, responses are visible
 * only to the user who invoked the command and the bot operates with reduced
 * trust to prevent exposure of sensitive information.
 *
 * ## Typing Indicators
 *
 * While the bot is preparing a response, Discord shows the familiar
 * "... is typing" animation in the channel so users know their request is
 * being handled. The typing indicator requires the integration's `botToken` to
 * be configured and is automatically suppressed when the integration is in
 * `ephemeral` mode or when the channel context is not available (such as in
 * some DM scenarios). If the typing animation cannot be shown, the user still
 * receives the response normally.
 *
 * ## Long Responses
 *
 * Discord limits a single message to 2000 characters. When a bot reply exceeds
 * that limit, it is split across multiple messages - the first edits the
 * original interaction response and the rest are delivered as follow-ups - so
 * long responses are delivered in full.
 *
 * ## Sender Filtering with allowFrom
 *
 * The `allowFrom` integration setting restricts which Discord users can trigger
 * the bot. When configured, only messages from permitted user IDs or usernames
 * are processed. Messages from other senders are silently dropped.
 *
 * This is useful for private bots intended for specific team members, internal
 * tools with controlled access, or staged rollouts where you want to limit
 * interaction to a defined group before opening the bot to everyone. Configure
 * `allowFrom` when creating or updating your Discord integration:
 *
 * ```http
 * POST /api/v1/integration/discord/{discordIntegrationId}/update
 * Content-Type: application/json
 *
 * {
 *   "allowFrom": "123456789012345678,987654321098765432"
 * }
 * ```
 *
 * ## Proactive Messaging
 *
 * The `initiate` event type allows your bot to send the opening message in a
 * conversation rather than waiting for a user to invoke a slash command. This
 * enables proactive outreach scenarios such as onboarding notifications,
 * scheduled alerts, and follow-up messages triggered by external events.
 *
 * When an `initiate` event is processed, the bot posts the opening message to
 * the specified Discord channel or thread, and any subsequent user reply in
 * that channel continues the same conversation context.
 *
 * An optional `context` object can be included in the initiate payload to
 * provide background information about the recipient or situation. The bot
 * uses this context when responding to follow-up messages.
 *
 * Sessions created by `initiate` events follow the same `sessionDuration`
 * setting used for reactive slash-command sessions. Once a session expires,
 * the next user message in that channel starts a new conversation.
 *
 * **Warning:** Account-level conversational limits apply to prevent abuse and
 * ensure fair resource allocation. If an account exceeds these limits, new
 * interactions are rejected with a limits exceeded error. Monitor your usage
 * and upgrade plans as needed to accommodate interaction volume.
 */
