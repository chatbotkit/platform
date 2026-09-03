// @ts-check
import { timePlusDays } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import { PolicyType, Trigger } from '@/prisma/types'
import { RetentionPolicyConfig } from '@/prisma/zod'

import {
  makeRequestActivityMessage,
  makeResponseActivityMessage,
} from '@/lib/activity'
import { publishChannelMessage } from '@/lib/channel.core'
import { makeSessionChannelId } from '@/lib/channel.session'
import { setContextUser } from '@/lib/context.store'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import {
  TAG_ERROR,
  TAG_RECEIVE_RESULT,
  TAG_RESULT,
  TAG_SEND_RESULT,
  createSinkEvent,
} from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import { captureError, captureInputError } from '@/lib/error'
import { ABORT_ERROR_NAME, anySignal } from '@/lib/fetch'
import { setupFrontendHostContext } from '@/lib/integration.context'
import { tryParse as tryJsonParse } from '@/lib/json'
import { runTasks, runTasksEach } from '@/lib/job'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { notifyContentAbuseDetected } from '@/lib/notify'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { updateSessionStore } from '@/lib/session.context'
import { getRandomId } from '@/lib/string'
import { userToSessionUser } from '@/lib/user.session'
import { parseAsync } from '@/lib/zod.schema'

import {
  IDLE_EVENT_TYPE as EXTRACT_INTEGRATION_IDLE_EVENT_TYPE,
  sendEvent as sendExtractEvent,
} from '@/pages/api/v1/integration/extract/[extractIntegrationId]/queue'
import {
  IDLE_EVENT_TYPE as SUPPORT_INTEGRATION_IDLE_EVENT_TYPE,
  sendEvent as sendSupportEvent,
} from '@/pages/api/v1/integration/support/[supportIntegrationId]/queue'

import { z } from 'zod'
import WebSocket from 'ws'

export const MAX_WORKERS = 10

export const REALTIME_EVENT_TYPE = 'realtime'
export const COMPLETE_EVENT_TYPE = 'complete'
export const CALLBACK_EVENT_TYPE = 'callback'
export const IDLE_EVENT_TYPE = 'idle'

const REALTIME_RESPONSE_MODALITIES = new Set(['text', 'audio'])

/**
 * @typedef {z.infer<typeof SessionPayloadSchema>} SessionPayload
 */
export const SessionPayloadSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  user: z.object({
    id: z.string(),
    email: z.string().optional(),
    name: z.string().optional(),
  }),
  billing: z.record(z.any()).optional(),
  options: z.record(z.any()).optional(),
  payload: z.record(z.any()).optional(),
  expires: z.string().optional(),
})

/**
 * @typedef {z.infer<typeof RealtimePayloadSchema>} RealtimePayload
 */
export const RealtimePayloadSchema = z.object({
  session: SessionPayloadSchema,
  relay: z.object({
    channelId: z.string(),
    clientUrl: z.string(),
    runnerUrl: z.string(),
  }),
  expiresAt: z.number(),
})

/**
 * @typedef {z.infer<typeof CompletePayloadSchema>} CompletePayload
 */
export const CompletePayloadSchema = z.object({
  session: SessionPayloadSchema,
  channelId: z.string(),
  body: z.record(z.any()),
  historyLength: z.number().optional(),
  historyExpireSeconds: z.number().optional(),
})

/**
 * @typedef {z.infer<typeof CallbackPayloadSchema>} CallbackPayload
 */
export const CallbackPayloadSchema = z.object({
  body: z.object({}),
})

/**
 * @typedef {z.infer<typeof IdlePayloadSchema>} IdlePayload
 */
export const IdlePayloadSchema = z.object({
  // pass
})

/**
 * @typedef {{
 *   type: typeof REALTIME_EVENT_TYPE,
 *   payload: RealtimePayload
 * }} RealtimeEvent
 *
 * @param {string} conversationId
 * @param {RealtimePayload} payload
 * @param {{ signal?: AbortSignal }} [context]
 * @returns {Promise<void>}
 */
export async function handleRealtimeEvent(conversationId, payload, context) {
  debug(`realtime event`, {
    conversationId,
    relayChannelId: payload.relay.channelId,
    expiresAt: payload.expiresAt,
  }).log('api.v1.conversation.conversationId.handleRealtimeEvent')

  const signal = context?.signal

  /** @type {import('@/prisma/types').Conversation & { user: import('@/prisma/types').User }|null} */
  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },

    include: {
      user: true,
    },
  })

  if (!conversation) {
    debug(`realtime conversation not found`, { conversationId }).log(
      'api.v1.conversation.conversationId.handleRealtimeEvent'
    )

    return
  }

  /** @type {import('next-auth').Session} */
  const realtimeSession = /** @type {any} */ ({
    ...payload.session,
    user: userToSessionUser(conversation.user),
    payload: {
      ...payload.session.payload,
      aud:
        typeof payload.session.payload?.aud === 'string'
          ? payload.session.payload.aud
          : 'user',
    },
  })

  updateSessionStore(realtimeSession)

  setContextUser(conversation.user)

  await setupFrontendHostContext(conversation.user)

  if (!(await accountConversationalLimitsOk(conversation.user))) {
    debug(`limits exceeded for user`, { userId: conversation.user.id }).log(
      'api.v1.conversation.conversationId.handleRealtimeEvent'
    )

    return
  }

  const socket = new WebSocket(payload.relay.runnerUrl)

  /**
   * @param {{ type: string, data?: any, createdAt?: number }} event
   */
  const sendSocketEvent = (event) => {
    if (socket.readyState !== WebSocket.OPEN) {
      return
    }

    socket.send(JSON.stringify(event))
  }

  await new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off('open', handleOpen)
      socket.off('error', handleError)

      signal?.removeEventListener('abort', handleAbort)
    }

    const handleOpen = () => {
      cleanup()

      debug(`realtime socket connected`, {
        conversationId,
        relayChannelId: payload.relay.channelId,
      }).log('api.v1.conversation.conversationId.handleRealtimeEvent')

      resolve(undefined)
    }

    const handleError = (error) => {
      cleanup()

      reject(error)
    }

    const handleAbort = () => {
      cleanup()

      socket.close()

      reject(new Error(`Realtime socket aborted`))
    }

    socket.on('open', handleOpen)
    socket.on('error', handleError)

    signal?.addEventListener('abort', handleAbort, { once: true })
  })

  const sink = new (class {
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

      sendSocketEvent(event)

      return event
    }
  })()

  const engine = await getStatefulConversationEngine({
    conversationId,
    options: {
      signal,
      sink,
      userId: conversation.user.id,
    },
  })

  try {
    return await new Promise((resolve, reject) => {
      let closed = false

      /** @type {AbortController | null} */
      let activeAbortController = null

      /** @type {{ kind: string, abortController: AbortController } | null} */
      let activeOperation = null

      const expireTimeout = setTimeout(
        () => {
          socket.close()
        },
        Math.max(0, payload.expiresAt - Date.now())
      )

      const cleanup = () => {
        closed = true

        activeAbortController?.abort()

        clearTimeout(expireTimeout)

        socket.off('message', handleMessage)
        socket.off('close', handleClose)
        socket.off('error', handleError)

        signal?.removeEventListener('abort', handleAbort)
      }

      /**
       * @param {string} kind
       * @param {(signal: AbortSignal) => Promise<void>} fn
       * @param {{ replace?: boolean }} [options]
       */
      const runRealtimeOperation = async (kind, fn, options = {}) => {
        if (activeOperation) {
          if (!options.replace) {
            sendSocketEvent(
              createSinkEvent({
                type: TAG_ERROR,
                data: {
                  code: 'realtime_busy',
                  message: 'Realtime conversation is already processing',
                  operation: activeOperation.kind,
                },
              })
            )

            return
          }

          activeOperation.abortController.abort()
        }

        const abortController = new AbortController()

        activeOperation = {
          kind,
          abortController,
        }

        activeAbortController = abortController

        const activeSignal = anySignal([signal, abortController.signal])

        try {
          await fn(activeSignal)
        } catch (error) {
          if (error?.name === ABORT_ERROR_NAME) {
            return
          }

          throw error
        } finally {
          // @note a replacing operation can start before the aborted one finishes

          if (activeOperation?.abortController === abortController) {
            activeOperation = null
          }

          if (activeAbortController === abortController) {
            activeAbortController = null
          }
        }
      }

      /**
       * @param {any} data
       */
      const handleDataMessage = async (data) => {
        const raw = Buffer.isBuffer(data) ? data.toString('utf8') : String(data)

        const message = tryJsonParse(raw) || {
          type: 'unknown',
          raw,
        }

        if (message.type?.startsWith('relay.')) {
          debug(`realtime socket received relay message`, {
            conversationId,
            relayChannelId: payload.relay.channelId,
            message,
          }).log('api.v1.conversation.conversationId.handleRealtimeEvent')

          return
        }

        /** @type {'text' | 'audio'} */
        const modality = REALTIME_RESPONSE_MODALITIES.has(message.data?.modality)
          ? message.data.modality
          : 'text'

        const getRealtimeCompletionOptions = (signal) => ({
          signal,
          modality,
        })

        const getRealtimeAudioCompletionOptions = (signal) => ({
          signal,
          modality: /** @type {'audio'} */ ('audio'),
        })

        switch (message.type) {
          case 'initiate': {
            const text = message.data?.text ?? message.text

            if (typeof text !== 'string' || !text.trim()) {
              debug(`realtime socket received unknown message`, {
                conversationId,
                relayChannelId: payload.relay.channelId,
                message,
              }).log('api.v1.conversation.conversationId.handleRealtimeEvent')

              return
            }

            await runRealtimeOperation('initiate', async (activeSignal) => {
              const usage = {
                token: 0,
              }

              const {
                usage: sendUsage,
                messages: sendMessages,
                entities: safeEntities,
              } = await engine.send(text, {
                type: 'instruction',
                signal: activeSignal,
              })

              usage.token += sendUsage.token

              const lastSendMessage = sendMessages.slice().pop()

              sendSocketEvent(
                createSinkEvent({
                  type: TAG_SEND_RESULT,
                  data: {
                    id: lastSendMessage?.id || getRandomId('msg-'),
                    text: lastSendMessage?.text || '',
                    entities: safeEntities,
                    usage,
                  },
                })
              )

              const {
                usage: receiveUsage,
                messages: receiveMessages,
                reason: receiveReason,
              } = await engine.receive({
                ...getRealtimeCompletionOptions(activeSignal),
              })

              usage.token += receiveUsage.token

              const lastReceiveMessage = receiveMessages.slice().pop()

              sendSocketEvent(
                createSinkEvent({
                  type: TAG_RECEIVE_RESULT,
                  data: {
                    id: lastReceiveMessage?.id || getRandomId('msg-'),
                    text: lastReceiveMessage?.text || '',
                    usage,
                    end: {
                      reason: receiveReason,
                    },
                  },
                })
              )

              sendSocketEvent(
                createSinkEvent({
                  type: TAG_RESULT,
                  data: {
                    id: lastReceiveMessage?.id || getRandomId('msg-'),
                    text: lastReceiveMessage?.text || '',
                    usage,
                    end: {
                      reason: receiveReason,
                    },
                  },
                })
              )
            })

            return
          }

          case 'complete': {
            const text = message.data?.text ?? message.text

            await runRealtimeOperation('complete', async (activeSignal) => {
              const usage = {
                token: 0,
              }

              if (typeof text === 'string') {
                const {
                  usage: sendUsage,
                  messages: sendMessages,
                  entities: safeEntities,
                } = await engine.send(text, {
                  signal: activeSignal,
                })

                usage.token += sendUsage.token

                const lastSendMessage = sendMessages.slice().pop()

                sendSocketEvent(
                  createSinkEvent({
                    type: TAG_SEND_RESULT,
                    data: {
                      id: lastSendMessage?.id || getRandomId('msg-'),
                      text: lastSendMessage?.text || '',
                      entities: safeEntities,
                      usage,
                    },
                  })
                )
              }

              const {
                usage: receiveUsage,
                messages: receiveMessages,
                reason: receiveReason,
              } = await engine.receive({
                ...getRealtimeCompletionOptions(activeSignal),
              })

              usage.token += receiveUsage.token

              const lastReceiveMessage = receiveMessages.slice().pop()

              sendSocketEvent(
                createSinkEvent({
                  type: TAG_RECEIVE_RESULT,
                  data: {
                    id: lastReceiveMessage?.id || getRandomId('msg-'),
                    text: lastReceiveMessage?.text || '',
                    usage,
                    end: {
                      reason: receiveReason,
                    },
                  },
                })
              )

              sendSocketEvent(
                createSinkEvent({
                  type: TAG_RESULT,
                  data: {
                    id: lastReceiveMessage?.id || getRandomId('msg-'),
                    text: lastReceiveMessage?.text || '',
                    usage,
                    end: {
                      reason: receiveReason,
                    },
                  },
                })
              )
            })

            return
          }

          case 'steer': {
            const text = message.data?.text ?? message.text

            if (typeof text !== 'string' || !text.trim()) {
              debug(`realtime socket received unknown message`, {
                conversationId,
                relayChannelId: payload.relay.channelId,
                message,
              }).log('api.v1.conversation.conversationId.handleRealtimeEvent')

              return
            }

            await runRealtimeOperation(
              'steer',
              async (activeSignal) => {
                await engine.steer(text, {
                  ...getRealtimeCompletionOptions(activeSignal),
                })
              },
              { replace: true }
            )

            return
          }

          case 'abort': {
            activeOperation?.abortController.abort()

            return
          }

          case 'audio': {
            const audio = message.data

            if (
              typeof audio?.data !== 'string' ||
              audio.format?.encoding !== 'pcm16' ||
              typeof audio.format?.sampleRate !== 'number' ||
              typeof audio.format?.channels !== 'number'
            ) {
              debug(`realtime socket received unknown message`, {
                conversationId,
                relayChannelId: payload.relay.channelId,
                message,
              }).log('api.v1.conversation.conversationId.handleRealtimeEvent')

              return
            }

            await runRealtimeOperation('audio', async (activeSignal) => {
              await engine.audio(audio, {
                ...getRealtimeAudioCompletionOptions(activeSignal),
              })
            })

            return
          }

          default: {
            debug(`realtime socket received unknown message`, {
              conversationId,
              relayChannelId: payload.relay.channelId,
              message,
            }).log('api.v1.conversation.conversationId.handleRealtimeEvent')

            return
          }
        }
      }

      const handleMessage = (data) => {
        void handleDataMessage(data).catch((error) => {
          if (!closed) {
            sendSocketEvent({
              type: TAG_ERROR,
              data: { message: error.message },
              createdAt: Date.now(),
            })
          }

          cleanup()

          socket.close()

          reject(error)
        })
      }

      const handleClose = (code, reason) => {
        cleanup()

        debug(`realtime socket closed`, {
          conversationId,
          relayChannelId: payload.relay.channelId,
          code,
          reason: reason?.toString(),
        }).log('api.v1.conversation.conversationId.handleRealtimeEvent')

        resolve()
      }

      const handleError = (error) => {
        cleanup()

        reject(error)
      }

      const handleAbort = () => {
        cleanup()

        socket.close()

        reject(new Error(`Realtime socket aborted`))
      }

      socket.on('message', handleMessage)
      socket.on('close', handleClose)
      socket.on('error', handleError)

      signal?.addEventListener('abort', handleAbort, { once: true })
    })
  } finally {
    await engine.dispose()
  }
}

/**
 * @typedef {{
 *   type: typeof COMPLETE_EVENT_TYPE,
 *   payload: CompletePayload
 * }} CompleteEvent
 *
 * @param {string} conversationId
 * @param {CompletePayload} payload
 * @param {{ signal?: AbortSignal, markSignals?: AbortSignal[] }} [context]
 * @returns {Promise<void>}
 */
export async function handleCompleteEvent(conversationId, payload, context) {
  debug(`conversation complete event`, { conversationId, payload }).log(
    'api.v1.conversation.conversationId.handleCompleteEvent'
  )

  const { session, channelId, body, historyLength, historyExpireSeconds } =
    payload

  /** @type {import('@/prisma/types').Conversation & { user: import('@/prisma/types').User }|null} */
  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },

    include: {
      user: true,
    },
  })

  if (!conversation) {
    debug(`complete conversation not found`, { conversationId }).log(
      'api.v1.conversation.conversationId.handleCompleteEvent'
    )

    return
  }

  /** @type {import('next-auth').Session} */
  const completeSession = /** @type {any} */ ({
    ...session,
    user: userToSessionUser(conversation.user),
    payload: {
      ...session.payload,
      aud:
        typeof session.payload?.aud === 'string' ? session.payload.aud : 'user',
    },
  })

  updateSessionStore(completeSession)

  const sessionChannelId = makeSessionChannelId(completeSession, channelId)

  setContextUser(conversation.user)

  await setupFrontendHostContext(conversation.user)

  /** @type {import('@/lib/channel.core').PublishChannelMessageOptions | undefined} */
  const historyOptions =
    historyLength != null ? { historyLength, historyExpireSeconds } : undefined

  if (!(await accountConversationalLimitsOk(conversation.user))) {
    debug(`limits exceeded for user`, { userId: conversation.user.id }).log(
      'api.v1.conversation.conversationId.handleCompleteEvent'
    )

    await publishChannelMessage(
      sessionChannelId,
      { type: TAG_ERROR, data: { message: 'Limits exceeded for user' } },
      historyOptions
    )

    return
  }

  debug(`starting stateful completion`, {
    conversationId,
    sessionChannelId,
  }).log('api.v1.conversation.conversationId.handleCompleteEvent')

  // Import complete dynamically to avoid circular dependency

  const { complete } = await import(
    '@/pages/api/v1/conversation/[conversationId]/complete'
  )

  try {
    for await (const { type, data } of complete(
      completeSession,
      conversationId,
      {
        ...body,

        extensions: {
          ...body.extensions,

          features: [
            ...(Array.isArray(body.extensions?.features)
              ? body.extensions.features
              : []),

            // @note ensure agent is aware we run in the background

            { name: 'batch', options: { settle: true } },
          ],
        },
      },
      {
        abortSignal: context?.signal,

        // @note fire-once per-mark signals from the queue monitor; the engine's
        // `timeoutMarks` feature listens to these so a background completion
        // running out of time leaves a breadcrumb. NOT cancellation signals

        markSignals: context?.markSignals,
      }
    )) {
      debug(`publishing event to channel`, { type }).log(
        'api.v1.conversation.conversationId.handleCompleteEvent'
      )

      await publishChannelMessage(
        sessionChannelId,
        { type, data },
        historyOptions
      )
    }

    debug(`stateful completion finished`).log(
      'api.v1.conversation.conversationId.handleCompleteEvent'
    )
  } catch (e) {
    debug(`completion error`, { error: e }).log(
      'api.v1.conversation.conversationId.handleCompleteEvent'
    )

    await captureError(e)

    await publishChannelMessage(
      sessionChannelId,
      { type: TAG_ERROR, data: { message: e.message } },
      historyOptions
    )
  }
}

/**
 * @typedef {{
 *   type: typeof CALLBACK_EVENT_TYPE,
 *   payload: CallbackPayload
 * }} CallbackEvent
 *
 * @param {string} conversationId
 * @param {CallbackPayload} payload
 * @returns {Promise<void>}
 */
export async function handleCallbackEvent(conversationId, payload) {
  debug(`callback`, { conversationId, payload }).log(
    'api.v1.conversation.handleCallbackEvent'
  )

  /** @type {import('@/prisma/types').Conversation & { user: import('@/prisma/types').User }|null} */
  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },

    include: {
      user: {
        include: {
          parent: true,
        },
      },
    },
  })

  if (!conversation) {
    return
  }

  const engine = await getStatefulConversationEngine({
    conversationId: conversationId,

    options: {
      userId: conversation.user.id,

      features: [{ name: 'batch' }],
    },
  })

  try {
    let sentSome = false

    // add the details for the event
    {
      await engine.addMessages([
        makeRequestActivityMessage('getIncomingEventDetails', {}),
        makeResponseActivityMessage(
          'getIncomingEventDetails',
          {},
          {
            ...payload.body,
          }
        ),
      ])

      sentSome = true
    }

    if (!sentSome) {
      debug(`no messages sent so bail out`).log(
        'api.v1.conversation.instance.queue.handleInteractEvent'
      )

      return
    }

    // @todo should we process the event?
  } finally {
    await engine.dispose()
  }
}

/**
 * This method is used to trigger support integrations associated with the given
 * conversation.
 *
 * @param {import('@/prisma/types').Conversation} conversation
 * @returns {Promise<void>}
 *
 * @todo move into integration/queue
 */
export async function triggerSupportIntegrations(conversation) {
  debug(`trigger support integrations`, { conversation }).log(
    'api.v1.conversation.triggerSupportIntegrations'
  )

  const it = prisma.supportIntegration.paginate({
    where: {
      userId: conversation.userId,
      trigger: Trigger.automatic,

      // @note global integrations (botId null) apply to every conversation;
      // bot-scoped integrations (botId set) only apply to their own bot's
      // conversations. This mirrors the support/extract idle handlers, which
      // treat a null botId as "any conversation".

      OR: [
        { botId: null },
        ...(conversation.botId ? [{ botId: conversation.botId }] : []),
      ],
    },
  })

  await runTasksEach(MAX_WORKERS, it, async (supportIntegration) => {
    await sendSupportEvent(supportIntegration.id, {
      type: SUPPORT_INTEGRATION_IDLE_EVENT_TYPE,
      payload: {
        conversationId: conversation.id,
      },
    })
  })
}

/**
 * This method is used to trigger extract integrations associated with the given
 * conversation.
 *
 * @todo move into integration/queue
 */
export async function triggerExtractIntegrations(conversation) {
  debug(`trigger extract integrations`, { conversation }).log(
    'api.v1.conversation.triggerExtractIntegrations'
  )

  const it = prisma.extractIntegration.paginate({
    where: {
      userId: conversation.userId,
      trigger: Trigger.automatic,

      // @note global integrations (botId null) apply to every conversation;
      // bot-scoped integrations (botId set) only apply to their own bot's
      // conversations. This mirrors the support/extract idle handlers, which
      // treat a null botId as "any conversation".

      OR: [
        { botId: null },
        ...(conversation.botId ? [{ botId: conversation.botId }] : []),
      ],
    },
  })

  await runTasksEach(MAX_WORKERS, it, async (extractIntegration) => {
    await sendExtractEvent(extractIntegration.id, {
      type: EXTRACT_INTEGRATION_IDLE_EVENT_TYPE,
      payload: {
        conversationId: conversation.id,
      },
    })
  })
}

/**
 * This method is used to trigger notifications associated with the given
 * conversation.
 */
export async function triggerNotifications(conversation) {
  debug(`trigger notifications`, { conversation }).log(
    'api.v1.conversation.triggerNotifications'
  )

  if (conversation?.meta?.abuse?.flagged) {
    await notifyContentAbuseDetected(
      conversation.user.parent || conversation.user,
      conversation.id,
      conversation.meta.abuse.categories
    )
  }
}

/**
 * Apply retention policies to set conversation expiry.
 *
 * A retention policy scoped to the conversation's bot takes precedence; when no
 * bot-specific policy exists we fall back to a global policy (one with no
 * botId). A conversation without a bot can only match a global policy.
 */
export async function applyRetentionPolicies(conversation) {
  debug(`apply retention policies`, { conversation }).log(
    'api.v1.conversation.applyRetentionPolicies'
  )

  if (conversation.expiresAt) {
    debug(`conversation already has expiry date`, {
      conversationId: conversation.id,
      expiresAt: conversation.expiresAt,
    }).log('api.v1.conversation.applyRetentionPolicies')

    return
  }

  const where = {
    userId: conversation.userId,
    type: PolicyType.retention,
  }

  // @todo revise the selection rule. Currently a bot-scoped policy fully
  // overrides the global one ("most specific wins"). We may instead want the
  // shortest retention to win regardless of scope, or to combine multiple
  // matching policies rather than picking a single oldest one.
  const policy =
    (conversation.botId
      ? await prisma.policy.findFirst({
          where: {
            ...where,
            botId: conversation.botId,
          },
          orderBy: {
            createdAt: 'asc',
          },
        })
      : null) ??
    (await prisma.policy.findFirst({
      where: {
        ...where,
        botId: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    }))

  if (!policy) {
    return
  }

  if (!policy.config) {
    // a retention policy without a config sets no expiry - nothing to apply
    return
  }

  // parse (not just cast) so a config that does not match the retention shape
  // fails loudly instead of being silently trusted. The query above only
  // selects retention policies, so the config must be the retention variant.
  const result = RetentionPolicyConfig.safeParse(policy.config)

  if (!result.success) {
    throw new Error(
      `policy ${policy.id} has an invalid retention config: ${result.error.message}`
    )
  }

  const { expiresInDays } = result.data

  if (!expiresInDays) {
    debug(`retention policy has no expiry configured`, {
      policyId: policy.id,
    }).log('api.v1.conversation.applyRetentionPolicies')

    return
  }

  const expiresAt = timePlusDays(expiresInDays)

  await prisma.conversation.update({
    where: {
      id: conversation.id,
    },
    data: {
      expiresAt,
    },
  })

  debug(`applied retention policy`, {
    conversationId: conversation.id,
    policyId: policy.id,
    expiresInDays,
    expiresAt: expiresAt.toISOString(),
  }).log('api.v1.conversation.applyRetentionPolicies')
}

/**
 * @typedef {{
 *   type: typeof IDLE_EVENT_TYPE,
 *   payload: IdlePayload
 * }} IdleEvent
 *
 * @param {string} conversationId
 * @param {IdleEvent} event
 * @returns {Promise<void>}
 */
export async function handleIdleEvent(conversationId, event) {
  debug(`handle idle event type`, { event }).log(
    'api.v1.conversation.handleIdleEvent'
  )

  /** @type {import('@/prisma/types').Conversation & { user: import('@/prisma/types').User }|null} */
  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },

    include: {
      user: {
        include: {
          parent: true,
        },
      },
    },
  })

  if (!conversation) {
    return
  }

  await runTasks([
    // log event

    logEvent({
      user: { id: conversation.userId },
      type: 'conversation.idle',
      relations: {
        conversationId: conversation.id,
      },
    }),

    // apply retention policies

    applyRetentionPolicies(conversation),

    // trigger associated support integrations

    triggerSupportIntegrations(conversation),

    // trigger associated extract integrations

    triggerExtractIntegrations(conversation),

    // trigger notifications

    triggerNotifications(conversation),
  ])
}

/**
 * @param {string} conversationId
 * @param {RealtimeEvent|CompleteEvent|CallbackEvent|IdleEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(conversationId, event) {
  switch (true) {
    case event.type === REALTIME_EVENT_TYPE: {
      await parseAsync(
        RealtimePayloadSchema,
        event.payload,
        captureInputError
      )

      break
    }

    case event.type === COMPLETE_EVENT_TYPE: {
      await parseAsync(CompletePayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === CALLBACK_EVENT_TYPE: {
      await parseAsync(CallbackPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === IDLE_EVENT_TYPE: {
      await parseAsync(IdlePayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(`/api/v1/conversation/${conversationId}/queue`, event, {
    deduplicationId:
      event.type === COMPLETE_EVENT_TYPE
        ? `stateful-conversation-complete-event-${event.payload.channelId}`
        : undefined,
  })
}

/**
 */
export default withQueueHandlerBounded('conversationId', {
  [REALTIME_EVENT_TYPE]: {
    handler: handleRealtimeEvent,
    schema: RealtimePayloadSchema,
  },
  [COMPLETE_EVENT_TYPE]: {
    handler: handleCompleteEvent,
    schema: CompletePayloadSchema,
  },
  [CALLBACK_EVENT_TYPE]: {
    handler: handleCallbackEvent,
    schema: CallbackPayloadSchema,
  },
  [IDLE_EVENT_TYPE]: {
    handler: handleIdleEvent,
    schema: IdlePayloadSchema,
  },
})

// @note do not generate manuals or docs for this internal endpoint
