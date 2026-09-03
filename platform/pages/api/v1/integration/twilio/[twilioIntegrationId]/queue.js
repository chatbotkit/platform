// @ts-check
import relay from '@chatbotkit-dev/relay'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import messages from '@/config/messages'

import prisma from '@/prisma/client'

import { makeActivityMessagePair } from '@/lib/activity'
import { getConversationDetails } from '@/lib/bot.conversation'
import { publishChannelMessage } from '@/lib/channel.core'
import {
  createContactFingerprint,
  ensureTrustedContact,
} from '@/lib/contact.create'
import { setContextUser } from '@/lib/context.store'
import { createConversation } from '@/lib/conversation.create'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { hasConversation } from '@/lib/conversation.find'
import {
  TAG_COMPLETE_END,
  TAG_TOKEN,
  createSinkEvent,
} from '@/lib/conversation.tag'
import cuid from '@/lib/cuid'
import debug from '@/lib/debug'
import { captureInputError, captureObservation } from '@/lib/error'
import { tryParse as tryJsonParse } from '@/lib/json'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import { sleep } from '@/lib/promise'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { throwLimitsReached, throwNotFound } from '@/lib/response'
import { updateSessionStore } from '@/lib/session.context'
import { resolveSessionDuration } from '@/lib/session.duration'
import { sendTwilioCall, sendTwilioMessage } from '@/lib/twilio.api'
import { markdownToMessages } from '@/lib/twilio.markdown'
import { normalizeTwilioMessageAddress } from '@/lib/twilio.phone'
import {
  createTwilioConversationRelayXml,
  createTwilioSmsResponseXml,
} from '@/lib/twilio.twiml'
import {
  parseTwilioAllowFrom,
  twilioSenderIsAllowed,
} from '@/lib/twilio.validation'
import { parseTwilioVoiceOptions } from '@/lib/twilio.voice'
import { userToSessionUser } from '@/lib/user.session'
import { parseAsync } from '@/lib/zod.schema'
import { z } from '@/lib/zod.schema'

import WebSocket from 'ws'

// --- Env ---

// --- Consts ---

export const TWILIO_CONTACT_NAMESPACE = '5bd7fb78-73be-48aa-8a1e-e4e1984fed22' // @note do not change

export const INTERACT_EVENT_TYPE = 'interact'
export const INITIATE_EVENT_TYPE = 'initiate'

export const VOICE_RELAY_CALL_SESSION_ACTIVITY = `_twilioCallSessionStarted`

// --- Utility Schemas ---

const TwilioSenderAddressSchema = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    const normalized = normalizeTwilioMessageAddress(value, {
      allowAlphanumericSender: true,
    })

    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid Twilio sender address',
      })

      return z.NEVER
    }

    return normalized
  })

const TwilioRecipientAddressSchema = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    const normalized = normalizeTwilioMessageAddress(value)

    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid Twilio recipient address',
      })

      return z.NEVER
    }

    return normalized
  })

const InteractPayloadBaseSchema = z.object({
  channelId: z.string(),
  from: z.string(),
  to: z.string().optional(),
  body: z.string(),
})

/**
 * @typedef {z.infer<typeof SmsInteractPayloadSchema>} SmsInteractPayload
 */
export const SmsInteractPayloadSchema = InteractPayloadBaseSchema.extend({
  messageSid: z.string(),
  deliveredKey: z.string().optional(),
  deliveryCheckAt: z.number().optional(),
}).strict()

/**
 * @typedef {z.infer<typeof VoiceInteractPayloadSchema>} VoiceInteractPayload
 */
export const VoiceInteractPayloadSchema = InteractPayloadBaseSchema.extend({
  callSid: z.string(),
}).strict()

// --- Input Schemas ---

/**
 * @typedef {z.infer<typeof InteractPayloadSchema>} InteractPayload
 */
export const InteractPayloadSchema = z.union([
  SmsInteractPayloadSchema,
  VoiceInteractPayloadSchema,
])

/**
 * @typedef {z.infer<typeof InitiatePayloadSchema>} InitiatePayload
 */
export const InitiatePayloadSchema = z.object({
  channel: z.enum(['sms', 'call']).default('sms'),
  from: TwilioSenderAddressSchema.describe('The Twilio sender phone number'),
  to: TwilioRecipientAddressSchema.describe('The recipient phone number'),
  text: z
    .string()
    .min(1)
    .describe('The instruction to use to initiate the conversation'),
  context: z.record(z.string(), z.any()).optional(),
})

// --- Helpers ---

/**
 * @param {{
 *   integration: {
 *     id: string,
 *     userId: string,
 *     contactCollection?: boolean | null,
 *     backstory?: string | null,
 *     model?: string | null,
 *     datasetId?: string | null,
 *     skillsetId?: string | null,
 *     privacy?: boolean | null,
 *     moderation?: boolean | null,
 *     bot?: {
 *       id: string,
 *       backstory?: string | null,
 *       model?: string | null,
 *       datasetId?: string | null,
 *       skillsetId?: string | null,
 *       privacy?: boolean | null,
 *       moderation?: boolean | null,
 *     } | null,
 *     sessionDuration?: number | null,
 *   },
 *   phone: string,
 * }} options
 * @returns {Promise<{ conversationId: string, reused: boolean }>}
 */
export async function getConversationSessionId({ integration, phone }) {
  const sessionKey = `twilio-session-${
    integration.id
  }-${normalizeTwilioSessionPhone(phone)}`

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  let conversationId = persist ? await memcache.get(sessionKey) : null

  if (conversationId && (await hasConversation(conversationId))) {
    // @note slide the session window: refresh the TTL on reuse so an active
    // conversation is not cut off at a fixed offset from its creation time.
    await bumpTwilioSessionConversationId({
      sessionKey,
      sessionDurationSecs: ttlSecs,
    })

    return {
      conversationId,
      reused: true,
    }
  }

  let contactId

  if (integration.contactCollection) {
    const contact = await ensureTrustedContact(
      { id: integration.userId },
      {
        phone,

        meta: {
          app: 'twilio',
        },
      },
      createContactFingerprint(TWILIO_CONTACT_NAMESPACE, [phone])
    )

    contactId = contact.id
  }

  const { id } = await createConversation(integration.userId, {
    contactId,

    ...getConversationDetails(integration),

    meta: {
      app: 'twilio',

      twilio: {
        integrationId: integration.id,
      },
    },
  })

  if (persist) {
    await memcache.set(sessionKey, id, {
      ex: ttlSecs,
    })
  }

  return {
    conversationId: id,
    reused: false,
  }
}

/**
 * Normalize a phone/address to Twilio's canonical form for session keying, so a
 * bot-initiated `to` (normalized at the schema) and the inbound webhook `from`
 * (raw) resolve to the same session. Falls back to the raw value when the
 * address can't be parsed, preserving today's behavior for non-standard inputs.
 * Channel prefixes (e.g. `whatsapp:`) are preserved, so channels stay distinct.
 *
 * @param {string} phone
 * @returns {string}
 */
function normalizeTwilioSessionPhone(phone) {
  return normalizeTwilioMessageAddress(phone) || phone
}

/**
 * Slide the session window by refreshing the key's TTL without rewriting its
 * value, so an actively-used conversation is not cut off at a fixed offset from
 * its creation time. Called on every reuse of an existing session.
 *
 * @param {{ sessionKey: string, sessionDurationSecs: number }} options
 * @returns {Promise<void>}
 */
export async function bumpTwilioSessionConversationId({
  sessionKey,
  sessionDurationSecs,
}) {
  await memcache.expire(sessionKey, sessionDurationSecs)
}

/**
 * @param {string} channelId
 * @param {string} side
 * @param {{ events?: boolean }} [options]
 * @returns {string}
 */
export function createRelayChannelUrl(channelId, side, options = {}) {
  return relay.channelUrl(channelId, side, options)
}

/**
 * @param {{
 *   integration: { id?: string | null, userId?: string | null, accountSid?: string | null, authToken?: string | null },
 *   from?: string,
 *   to?: string,
 *   message: { type: 'text', text: string } | { type: 'image', image: string },
 * }} options
 * @returns {Promise<void>}
 */
export async function sendTwilioIntegrationMessage({
  integration,
  from,
  to,
  message,
}) {
  const normalizedFrom = from
    ? normalizeTwilioMessageAddress(from, {
        allowAlphanumericSender: true,
      }) || from
    : from

  const normalizedTo = to ? normalizeTwilioMessageAddress(to) || to : to

  try {
    await sendTwilioMessage({
      accountSid: integration.accountSid,
      authToken: integration.authToken,
      from,
      to,
      message,
    })

    if (integration.id && integration.userId) {
      await logEvent({
        user: { id: integration.userId },
        name: 'Twilio Message Sent',
        description: 'The Twilio message was sent to the recipient.',
        type: 'integration.twilio.sent',
        relations: {
          twilioIntegrationId: integration.id,
        },
        meta: {
          from: normalizedFrom,
          to: normalizedTo,
          messageType: message.type,
        },
      })
    }
  } catch (error) {
    if (integration.id && integration.userId) {
      await logEvent({
        user: { id: integration.userId },
        name: 'Twilio Message Failed',
        description: 'The Twilio message could not be sent to the recipient.',
        type: 'integration.twilio.failed',
        relations: {
          twilioIntegrationId: integration.id,
        },
        meta: {
          from: error?.data?.from || normalizedFrom,
          to: error?.data?.to || normalizedTo,
          messageType: message.type,
          error: error?.message,
          status: error?.data?.status,
          code: error?.data?.code,
          moreInfo: error?.data?.moreInfo,
        },
      })
    }

    throw error
  }
}

/**
 * @param {{
 *   integration: { id?: string | null, userId?: string | null, accountSid?: string | null, authToken?: string | null },
 *   payload: SmsInteractPayload,
 *   messages: Awaited<ReturnType<typeof markdownToMessages>>,
 * }} options
 * @returns {Promise<void>}
 */
export async function sendTwilioSmsFallbackMessages({
  integration,
  payload,
  messages,
}) {
  if (!payload.deliveredKey) {
    return
  }

  const delayMs = Math.max(0, (payload.deliveryCheckAt || 0) - Date.now())

  if (delayMs > 0) {
    await sleep(delayMs)
  }

  const delivered = await memcache.get(payload.deliveredKey)

  if (delivered) {
    debug(`skipping Twilio API fallback - webhook delivered`, {
      deliveredKey: payload.deliveredKey,
    })

    return
  }

  for (const message of messages) {
    await sendTwilioIntegrationMessage({
      integration,
      from: payload.to,
      to: payload.from,
      message,
    })
  }
}

/**
 * @param {{
 *   relayUrl: string,
 *   integration: { id: string, userId: string, voice?: string | null },
 *   conversationId: string,
 *   payload: { channelId: string, callSid?: string, from: string },
 *   initialInstruction?: string | null,
 *   initialContext?: Record<string, any> | null,
 *   onReady?: () => void,
 *   signal?: AbortSignal,
 * }} options
 * @returns {Promise<void>}
 */
async function runConversationRelayAppSocket({
  relayUrl,
  integration,
  conversationId,
  payload,
  initialInstruction,
  initialContext,
  onReady,
  signal,
}) {
  const socket = new WebSocket(relayUrl)

  debug(`voice relay app socket connecting`, {
    channelId: payload.channelId,
    callSid: payload.callSid,
    relayUrl,
  }).log('integration.twilio.queue.voiceRelay')

  // Wait for the relay app socket to open before wiring the conversation turn.
  {
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        socket.off('open', handleOpen)
        socket.off('error', handleError)

        signal?.removeEventListener('abort', handleAbort)
      }

      const handleOpen = () => {
        cleanup()

        debug(`voice relay app socket connected`, {
          channelId: payload.channelId,
          callSid: payload.callSid,
          relayUrl,
        }).log('integration.twilio.queue.voiceRelay')

        resolve(undefined)
      }

      const handleError = (error) => {
        cleanup()

        reject(error)
      }

      const handleAbort = () => {
        cleanup()

        socket.close()

        reject(new Error(`Voice relay app socket aborted`))
      }

      socket.on('open', handleOpen)
      socket.on('error', handleError)

      signal?.addEventListener('abort', handleAbort, { once: true })
    })
  }

  /**
   * @param {string} text
   * @param {{ last?: boolean }} [options]
   */
  const sendConversationRelayText = (text, options = {}) => {
    if (socket.readyState !== WebSocket.OPEN) {
      return
    }

    socket.send(
      JSON.stringify({
        type: 'text',
        token: text,
        last: options.last ?? true,
      })
    )
  }

  const sink = new (class {
    #lastToken = null

    /**
     * @param {string} type
     * @param {any} data
     */
    async push(type, data) {
      const event = createSinkEvent(
        /** @type {import('@/lib/conversation.tag').EngineSinkItem} */ ({
          type,
          data,
        })
      )

      switch (type) {
        case TAG_TOKEN: {
          if (this.#lastToken) {
            sendConversationRelayText(this.#lastToken, { last: false })
          }

          this.#lastToken = data?.token

          break
        }

        case TAG_COMPLETE_END: {
          if (this.#lastToken) {
            sendConversationRelayText(this.#lastToken, { last: true })
          }

          this.#lastToken = null

          break
        }
      }

      return event
    }
  })()

  const engine = await getStatefulConversationEngine({
    conversationId,

    options: {
      signal,
      sink,

      backstoryExtra: `IMPORTANT

This conversation is over a voice call. Keep messages concise and natural to speak. Use plain speakable text only. Do not use emoji, emoticons, markdown formatting, bullets, or decorative symbols.`,

      features: [
        // @todo surface the caller to the model via a `userInfo` feature, the
        // way the other messaging integrations do. Only the caller's phone
        // number (payload.from) is available here; resolving a human-readable
        // display name would need a Twilio Lookup API call, which is not
        // currently made.

        // @note auth is required to prompt the model to ask the user to
        // re-authenticate any secrets that are missing or expired

        /** @type {import('@/lib/conversation.features').AuthFeature} */ ({
          name: 'auth',
        }),

        // @note time gives the model reliable current date/time awareness
        // instead of guessing from stale training data

        /** @type {import('@/lib/conversation.features').TimeFeature} */ ({
          name: 'time',
        }),
      ],

      userId: integration.userId,
    },
  })

  await engine.addMessages(
    makeActivityMessagePair(
      VOICE_RELAY_CALL_SESSION_ACTIVITY,
      {
        callSid: payload.callSid,
        channelId: payload.channelId,
      },
      {
        event: 'started',
      }
    )
  )

  if (initialContext) {
    await engine.addMessages(
      makeActivityMessagePair(
        '_getTwilioContext',
        { from: payload.from },
        { context: initialContext }
      )
    )
  }

  const promptChunks = []

  const handleDataMessage = async (data) => {
    const raw = Buffer.isBuffer(data) ? data.toString('utf8') : String(data)

    const message = tryJsonParse(raw) || {
      type: 'unknown',
      raw,
    }

    switch (message.type) {
      case 'relay.ping': {
        debug(`voice relay received Twilio ping`, {
          channelId: payload.channelId,
          callSid: payload.callSid || message.callSid,
        }).log('integration.twilio.queue.voiceRelay')

        break
      }

      case 'relay.peer.closed': {
        debug(`voice relay peer closed`, {
          channelId: payload.channelId,
          callSid: payload.callSid,
          side: message.side,
          code: message.code,
          reason: message.reason,
        }).log('integration.twilio.queue.voiceRelay')

        socket.close()

        break
      }

      case 'relay.peer.connected': {
        debug(`voice relay Twilio peer connected`, {
          channelId: payload.channelId,
          callSid: payload.callSid,
          side: message.side,
        }).log('integration.twilio.queue.voiceRelay')

        break
      }

      case 'setup': {
        if (message.callSid) {
          payload.callSid = message.callSid

          await engine.addMessages(
            makeActivityMessagePair(
              VOICE_RELAY_CALL_SESSION_ACTIVITY,
              {
                callSid: payload.callSid,
              },
              {
                event: 'setup',
              }
            )
          )
        }

        debug(`voice relay received setup message`, {
          channelId: payload.channelId,
          callSid: payload.callSid || message.callSid,
          message: message,
        }).log('integration.twilio.queue.voiceRelay')

        try {
          await engine.steer(initialInstruction || 'Great the user.', {
            type: 'instruction',
          })
        } catch (error) {
          if (error?.name !== 'AbortError') {
            throw error
          }

          await captureObservation(error)
        }

        break
      }

      case 'prompt': {
        debug(`voice relay received Twilio voice prompt`, {
          channelId: payload.channelId,
          callSid: payload.callSid || message.callSid,
          message: message,
        }).log('integration.twilio.queue.voiceRelay')

        promptChunks.push(message.voicePrompt)

        if (message.last) {
          try {
            const text = promptChunks.join('')

            promptChunks.length = 0

            await engine.steer(text)
          } catch (error) {
            if (error?.name !== 'AbortError') {
              throw error
            }

            await captureObservation(error)
          }
        }

        break
      }

      case 'interrupt': {
        debug(`voice relay received Twilio interrupt`, {
          channelId: payload.channelId,
          callSid: payload.callSid || message.callSid,
          message: message,
        }).log('integration.twilio.queue.voiceRelay')

        break
      }

      case 'error': {
        debug(`voice relay Twilio error`, {
          channelId: payload.channelId,
          callSid: payload.callSid,
          message: message,
        }).log('integration.twilio.queue.voiceRelay')

        break
      }

      default: {
        debug(`voice relay received unknown message`, {
          channelId: payload.channelId,
          callSid: payload.callSid,
          message: message,
        }).log('integration.twilio.queue.voiceRelay')

        break
      }
    }
  }

  try {
    return await new Promise((resolve, reject) => {
      const cleanup = () => {
        socket.off('message', handleMessage)
        socket.off('close', handleClose)
        socket.off('error', handleError)

        signal?.removeEventListener('abort', handleAbort)
      }

      const handleMessage = (data) => {
        void handleDataMessage(data).catch((error) => {
          cleanup()

          socket.close()

          reject(error)
        })
      }

      const handleClose = (code, reason) => {
        cleanup()

        debug(`voice relay app socket closed`, {
          channelId: payload.channelId,
          callSid: payload.callSid,
          code: code,
          reason: reason?.toString(),
        }).log('integration.twilio.queue.voiceRelay')

        resolve()
      }

      const handleError = (error) => {
        cleanup()

        reject(error)
      }

      const handleAbort = () => {
        cleanup()

        socket.close()

        reject(new Error(`Voice relay app socket aborted`))
      }

      socket.on('message', handleMessage)
      socket.on('close', handleClose)
      socket.on('error', handleError)

      signal?.addEventListener('abort', handleAbort, { once: true })

      onReady?.()
    })
  } finally {
    await engine.dispose()
  }
}

// --- Event Handlers ---

/**
 * @typedef {{
 *   type: typeof INTERACT_EVENT_TYPE,
 *   payload: InteractPayload
 * }} InteractEvent
 *
 * @param {string} twilioIntegrationId
 * @param {InteractPayload} payload
 * @returns {Promise<void>}
 */
export async function handleInteractEvent(
  twilioIntegrationId,
  payload,
  context
) {
  debug(`interact`, { twilioIntegrationId, payload })

  payload = await InteractPayloadSchema.parseAsync(payload)

  const integration = await prisma.twilioIntegration.findUnique({
    where: {
      id: twilioIntegrationId,
    },

    include: {
      user: true, // @note super important

      bot: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(`TwilioIntegration not found: ${twilioIntegrationId}`)
  }

  if (!integration.bot) {
    debug(`skipping - no bot configured`).log(
      'integration.twilio.queue.handleInteractEvent'
    )

    return
  }

  // check allowFrom restriction
  {
    const entries = parseTwilioAllowFrom(integration.allowFrom || '')

    if (!twilioSenderIsAllowed(payload.from, entries)) {
      debug(`sender not allowed`, {
        from: payload.from,
      }).log('integration.twilio.queue.handleInteractEvent')

      await logEvent({
        user: { id: integration.userId },
        name: 'Sender Blocked',
        description: `A message was blocked due to allowFrom restrictions.`,
        type: 'integration.twilio.blocked',
        relations: {
          twilioIntegrationId: integration.id,
        },
        meta: {
          from: payload.from,
        },
      })

      return
    }
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    // @note the account is over its usage limits - send a pre-canned reply so
    // the user gets a visible signal instead of silence. Best-effort: a failed
    // send must not mask the underlying limit condition.
    if (integration.accountSid && integration.authToken) {
      try {
        await sendTwilioIntegrationMessage({
          integration,
          from: payload.to,
          to: payload.from,
          message: { type: 'text', text: messages.limitsReachedReply },
        })
      } catch (error) {
        debug(`limit reply send failed`, { error }).log(
          'integration.twilio.queue.handleInteractEvent'
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

  const type =
    'messageSid' in payload
      ? 'sms'
      : 'callSid' in payload
        ? 'call'
        : /** @type {never} */ ('unknown')

  switch (type) {
    case 'sms': {
      const smsPayload = /** @type {SmsInteractPayload} */ (payload)

      // @note special handling for restart/reset
      if (
        ['///restart', '///reset', '///new'].includes(
          smsPayload.body.trim().toLowerCase() || ''
        )
      ) {
        debug(`restart`)

        await memcache.del(
          `twilio-session-${integration.id}-${normalizeTwilioSessionPhone(
            smsPayload.from
          )}`
        )

        return
      }

      const { conversationId } = await getConversationSessionId({
        integration,
        phone: smsPayload.from,
      })

      const engine = await getStatefulConversationEngine({
        conversationId: conversationId,

        options: {
          signal: context?.signal,

          // @note fire-once per-mark signals from the queue monitor; the engine's
          // `timeoutMarks` feature listens to these. NOT cancellation signals

          markSignals: context?.markSignals,

          backstoryExtra: `IMPORTANT

This conversation is over SMS. Keep messages short and to the point.`,

          features: [
            // @todo surface the sender to the model via a `userInfo` feature,
            // the way the other messaging integrations do. Only the sender's
            // phone number (payload.from) is available here; resolving a
            // human-readable display name would need a Twilio Lookup API call,
            // which is not currently made.

            // @note record a checkpoint activity into the conversation each time
            // the queue handler crosses a timeout-budget mark (driven by
            // markSignals above), visible to the model on the next turn

            { name: 'timeoutMarks' },

            // @note auth is required to prompt the model to ask the user to
            // re-authenticate any secrets that are missing or expired

            /** @type {import('@/lib/conversation.features').AuthFeature} */ ({
              name: 'auth',
            }),

            // @note time gives the model reliable current date/time awareness
            // instead of guessing from stale training data

            /** @type {import('@/lib/conversation.features').TimeFeature} */ ({
              name: 'time',
            }),
          ],

          userId: integration.userId,
        },
      })

      try {
        let sentSome = false

        // @todo handle mms

        if (smsPayload.body) {
          debug(`text`, { text: smsPayload.body })

          sentSome = true

          await engine.send(smsPayload.body)
        }

        if (!sentSome) {
          debug(`no messages sent so bail out`)

          return
        }

        const { text } = await engine.receive()

        const messages = await markdownToMessages(text)

        debug(`messages`, { messages })

        const xml = createTwilioSmsResponseXml(messages)

        await publishChannelMessage(smsPayload.channelId, {
          xml,
        })

        await sendTwilioSmsFallbackMessages({
          integration,
          payload: smsPayload,
          messages,
        })
      } finally {
        await engine.dispose()
      }

      break
    }

    case 'call': {
      const voicePayload = /** @type {VoiceInteractPayload} */ (payload)

      const twRelayUrl = createRelayChannelUrl(voicePayload.channelId, 'twilio')

      const appRelayUrl = createRelayChannelUrl(voicePayload.channelId, 'app', {
        events: true,
      })

      const voiceOptions = parseTwilioVoiceOptions(integration.voice)

      const twiml = createTwilioConversationRelayXml(twRelayUrl, {
        ttsLanguage: voiceOptions.language,
        ttsProvider: voiceOptions.provider,
        voice: voiceOptions.voice,
        reportInputDuringAgentSpeech: 'speech',
      })

      const { conversationId } = await getConversationSessionId({
        integration,
        phone: voicePayload.from,
      })

      let relayReadyError

      /** @type {() => void} */
      let resolveRelayReady = () => {}

      const relayReady = new Promise((resolve) => {
        resolveRelayReady = () => resolve(undefined)
      })

      const relaySessionPromise = runConversationRelayAppSocket({
        relayUrl: appRelayUrl,
        integration,
        conversationId,
        payload: voicePayload,
        onReady: resolveRelayReady,
        signal: context?.signal,
      }).catch((error) => {
        relayReadyError = error

        resolveRelayReady()

        throw error
      })

      await relayReady

      if (relayReadyError) {
        await relaySessionPromise
      }

      debug(`publishing voice relay TwiML`, {
        channelId: voicePayload.channelId,
        callSid: voicePayload.callSid,
        relayUrl: twRelayUrl,
        appRelayUrl,
      }).log('integration.twilio.queue.handleInteractEvent')

      await publishChannelMessage(voicePayload.channelId, {
        xml: twiml,
      })

      debug(`published voice relay TwiML; waiting for app relay socket`, {
        channelId: voicePayload.channelId,
        callSid: voicePayload.callSid,
        relayUrl: twRelayUrl,
        appRelayUrl,
      }).log('integration.twilio.queue.handleInteractEvent')

      await relaySessionPromise

      break
    }

    default: {
      assertUnreachable(/** @type {never} */ (null))
    }
  }
}

/**
 * @typedef {{
 *   type: typeof INITIATE_EVENT_TYPE,
 *   payload: InitiatePayload
 * }} InitiateEvent
 *
 * @param {string} twilioIntegrationId
 * @param {InitiatePayload} payload
 * @returns {Promise<void>}
 */
export async function handleInitiateEvent(
  twilioIntegrationId,
  payload,
  context
) {
  debug(`initiate`, { twilioIntegrationId, payload })

  payload = await InitiatePayloadSchema.parseAsync(payload)

  const integration = await prisma.twilioIntegration.findUnique({
    where: {
      id: twilioIntegrationId,
    },

    include: {
      user: true,
      bot: true,
    },
  })

  if (!integration) {
    return throwNotFound(`TwilioIntegration not found: ${twilioIntegrationId}`)
  }

  if (!integration.bot) {
    debug(`skipping - no bot configured`).log(
      'integration.twilio.queue.handleInitiateEvent'
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

  const { conversationId } = await getConversationSessionId({
    integration,
    phone: payload.to,
  })

  switch (payload.channel) {
    case 'sms': {
      const engine = await getStatefulConversationEngine({
        conversationId,

        options: {
          signal: context?.signal,

          // @note fire-once per-mark signals from the queue monitor; the engine's
          // `timeoutMarks` feature listens to these. NOT cancellation signals

          markSignals: context?.markSignals,

          backstoryExtra: `IMPORTANT

This conversation is over SMS. Keep messages short and to the point.`,

          features: [
            // @todo surface the sender to the model via a `userInfo` feature,
            // the way the other messaging integrations do. Only the sender's
            // phone number (payload.from) is available here; resolving a
            // human-readable display name would need a Twilio Lookup API call,
            // which is not currently made.

            // @note record a checkpoint activity into the conversation each time
            // the queue handler crosses a timeout-budget mark (driven by
            // markSignals above), visible to the model on the next turn

            { name: 'timeoutMarks' },

            // @note auth is required to prompt the model to ask the user to
            // re-authenticate any secrets that are missing or expired

            /** @type {import('@/lib/conversation.features').AuthFeature} */ ({
              name: 'auth',
            }),

            // @note time gives the model reliable current date/time awareness
            // instead of guessing from stale training data

            /** @type {import('@/lib/conversation.features').TimeFeature} */ ({
              name: 'time',
            }),
          ],

          userId: integration.userId,
        },
      })

      try {
        if (payload.context) {
          await engine.addMessages(
            makeActivityMessagePair(
              '_getTwilioContext',
              { from: payload.to, to: payload.from },
              { context: payload.context }
            )
          )
        }

        await engine.send(payload.text, { type: 'instruction' })

        const { text } = await engine.receive()

        const messages = await markdownToMessages(text)

        debug(`messages`, { messages })

        for (const message of messages) {
          await sendTwilioIntegrationMessage({
            integration,
            from: payload.from,
            to: payload.to,
            message,
          })
        }
      } finally {
        await engine.dispose()
      }

      break
    }

    case 'call': {
      const channelId = `twilio-voice-${cuid()}-${cuid()}`

      const twRelayUrl = createRelayChannelUrl(channelId, 'twilio')

      const appRelayUrl = createRelayChannelUrl(channelId, 'app', {
        events: true,
      })

      let relayReadyError

      /** @type {() => void} */
      let resolveRelayReady = () => {}

      const relayReady = new Promise((resolve) => {
        resolveRelayReady = () => resolve(undefined)
      })

      const relaySessionPromise = runConversationRelayAppSocket({
        relayUrl: appRelayUrl,
        integration,
        conversationId,
        payload: {
          channelId,
          from: payload.to,
        },
        initialInstruction: payload.text,
        initialContext: payload.context,
        onReady: resolveRelayReady,
        signal: context?.signal,
      }).catch((error) => {
        relayReadyError = error
        resolveRelayReady()

        throw error
      })

      const voiceOptions = parseTwilioVoiceOptions(integration.voice)

      const twiml = createTwilioConversationRelayXml(twRelayUrl, {
        ttsLanguage: voiceOptions.language,
        ttsProvider: voiceOptions.provider,
        voice: voiceOptions.voice,
        reportInputDuringAgentSpeech: 'speech',
      })

      debug(`starting initiated voice relay call`, {
        channelId,
        relayUrl: twRelayUrl,
        appRelayUrl,
        from: payload.from,
        to: payload.to,
        twimlLength: twiml.length,
      }).log('integration.twilio.queue.handleInitiateEvent')

      await relayReady

      if (relayReadyError) {
        await relaySessionPromise
      }

      await sendTwilioCall({
        accountSid: integration.accountSid,
        authToken: integration.authToken,
        from: payload.from,
        to: payload.to,
        twiml,
      })

      debug(`initiated voice relay call sent; waiting for relay session`, {
        channelId,
        relayUrl: twRelayUrl,
        appRelayUrl,
      }).log('integration.twilio.queue.handleInitiateEvent')

      await relaySessionPromise

      break
    }

    default: {
      assertUnreachable(payload.channel)
    }
  }
}

/**
 * @param {string} twilioIntegrationId
 * @param {InteractEvent|InitiateEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(twilioIntegrationId, event) {
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

  await queue(
    `/api/v1/integration/twilio/${twilioIntegrationId}/queue`,
    event,
    {
      ...(event.type === INTERACT_EVENT_TYPE
        ? {
            deduplicationId:
              'messageSid' in event.payload && event.payload.messageSid
                ? `twilio-${twilioIntegrationId}-${event.type}-${event.payload.messageSid}`
                : undefined,
          }
        : {}),
    }
  )
}

/**
 */
export default withQueueHandlerBounded('twilioIntegrationId', {
  [INTERACT_EVENT_TYPE]: {
    handler: handleInteractEvent,
    schema: InteractPayloadSchema,
  },
  [INITIATE_EVENT_TYPE]: {
    handler: handleInitiateEvent,
    schema: InitiatePayloadSchema,
  },
})

// ---

// @todo use external web socket to drive the conversation longer than 15 mins
