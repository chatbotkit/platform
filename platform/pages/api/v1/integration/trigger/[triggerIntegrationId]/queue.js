// @ts-check
import {
  getShortDateTime,
  getTimezone,
  roundToNearestNMinutes,
} from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { makeActivityMessagePair } from '@/lib/activity'
import { getConversationDetails } from '@/lib/bot.conversation'
import { ensureUntrustedContact } from '@/lib/contact.create'
import { setContextUser } from '@/lib/context.store'
import { createConversation } from '@/lib/conversation.create'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { hasConversation } from '@/lib/conversation.find'
import debug from '@/lib/debug'
import { captureException, captureInputError } from '@/lib/error'
import { setupFrontendHostContext } from '@/lib/integration.context'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { throwLimitsReached, throwNotFound } from '@/lib/response'
import { updateSessionStore } from '@/lib/session.context'
import { resolveSessionDuration } from '@/lib/session.duration'
import { getNext } from '@/lib/task.schedule'
import { userToSessionUser } from '@/lib/user.session'
import { parseAsync } from '@/lib/zod.schema'

import { z } from 'zod'

const GET_INCOMING_EVENT_ACTIVITY = '_getIncomingEvent'

const GET_TRIGGER_DETAILS_ACTIVITY = '_getTriggerDetails'

const CHECK_TRIGGER_RUN_STATUS_ACTIVITY = '_checkTriggerRunStatus'

export const INTERACT_EVENT_TYPE = 'interact'
export const INVOKE_EVENT_TYPE = 'invoke'

/**
 * @typedef {z.infer<typeof InteractPayloadSchema>} InteractPayload
 */
export const InteractPayloadSchema = z.object({
  session: z.string().optional(),
  contact: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  body: z.string(),
})

/**
 * @typedef {z.infer<typeof InvokePayloadSchema>} InvokePayload
 */
export const InvokePayloadSchema = z.object({
  // @note `schedule` is the integration's schedule (either a Schedule
  // enum value or a cron expression). It is used as the session identifier
  // for the conversation and as a hint in the invoke reason.
  schedule: z.string().optional(),
})

/**
 * @typedef {{
 *   type: typeof INTERACT_EVENT_TYPE,
 *   payload: InteractPayload
 * }} InteractEvent
 *
 * @param {string} triggerIntegrationId
 * @param {InteractPayload} payload
 * @param {{ signal?: AbortSignal, markSignals?: AbortSignal[] }} [context]
 * @returns {Promise<void>}
 */
export async function handleInteractEvent(
  triggerIntegrationId,
  payload,
  context
) {
  debug(`interact`, { triggerIntegrationId, payload }).log(
    'triggerIntegration.queue.handleInteractEvent'
  )

  const integration = await prisma.triggerIntegration.findUnique({
    where: {
      id: triggerIntegrationId,
    },

    include: {
      user: true, // @note super important

      bot: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(
      `TriggerIntegration not found: ${triggerIntegrationId}`
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

    await setupFrontendHostContext(integration.user)
  }

  const sessionId =
    payload.session ||
    payload.contact?.email ||
    payload.contact?.phone ||
    Math.random().toString(36).slice(2)

  const sessionKey = `trigger-session-${integration.id}-${sessionId}`

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  // @note when `persist` is false (sessionDuration === 0, i.e. "no session")
  // we never look up or store the mapping, so every event starts a fresh
  // conversation.
  let conversationId = persist ? await memcache.get(sessionKey) : null

  if (!conversationId || !(await hasConversation(conversationId))) {
    let contactId

    {
      if (payload.contact?.email || payload.contact?.phone) {
        const contact = await ensureUntrustedContact(
          { id: integration.userId },
          {
            name: payload.contact.name,
            email: payload.contact.email,
            phone: payload.contact.phone,
          }
        )

        contactId = contact.id
      }
    }

    const { id: cid } = await createConversation(integration.userId, {
      name: integration.name,
      description: integration.description,

      contactId,

      ...getConversationDetails(integration),

      meta: {
        app: 'trigger',

        trigger: {
          integrationId: integration.id,
        },
      },
    })

    conversationId = cid

    if (persist) {
      await memcache.set(sessionKey, conversationId, {
        ex: ttlSecs,
      })
    }
  }

  await logEvent({
    user: { id: integration.userId },
    type: 'integration.trigger.interact',
    relations: {
      blueprintId: integration.blueprintId,
      botId: integration.botId,
      triggerIntegrationId: integration.id,
      conversationId: conversationId,
    },
  })

  const engine = await getStatefulConversationEngine({
    conversationId: conversationId,

    options: {
      userId: integration.userId,

      // @note pass the hard-timeout cancellation signal from the queue monitor
      // into the engine. Without it the 750s abort cancels nothing and the run
      // is only stopped by Vercel's 800s hard process kill - which terminates
      // the function before the engine flushes the run's messages to the
      // database (in batch/settle mode the entire multi-turn run is buffered and
      // persisted in a single write at the very end). With the signal wired the
      // deadline surfaces as a catchable AbortError: the engine salvages partial
      // output, persists it, and records the status below - all within the 50s
      // buffer before the hard kill.

      signal: context?.signal,

      // @note fire-once per-mark signals from the queue monitor; the engine's
      // `timeoutMarks` feature listens to these. NOT cancellation signals

      markSignals: context?.markSignals,

      features: [
        // @note when the trigger payload carries contact info, surface it to
        // the model for this turn only via the userInfo feature (a soft
        // activity message, never persisted). Contact is optional and
        // caller-provided, so the feature is only added when present.

        ...(payload.contact?.name ||
        payload.contact?.email ||
        payload.contact?.phone
          ? [
              {
                name: 'userInfo',
                options: {
                  name: payload.contact.name,
                  email: payload.contact.email,
                  phone: payload.contact.phone,
                  source: 'trigger',
                },
              },
            ]
          : /** @type {any[]} */ ([])),

        // @note record a checkpoint activity into the conversation each time the
        // queue handler crosses a timeout-budget mark (driven by markSignals
        // above), visible to the model on the next turn

        { name: 'timeoutMarks' },

        // @note ensure agent is aware we run in the background, and make it
        // run to completion: `settle` keeps re-completing until the agent
        // finishes by calling `_success` / `_failure` (driven by the
        // `engine.receive()` loop below) instead of stopping after one turn

        { name: 'batch', options: { settle: true } },

        {
          name: 'notes',

          options: {
            notes: [
              `This trigger conversation can contain multiple independent trigger runs. Each incoming event starts a new turn for you: the turn begins with the latest ${GET_INCOMING_EVENT_ACTIVITY} activity and ends when ${CHECK_TRIGGER_RUN_STATUS_ACTIVITY} records its status. Treat earlier turns and checkpoints as historical context only; the latest incoming event is the current turn to execute.`,

              `Follow the instructions in the ${GET_TRIGGER_DETAILS_ACTIVITY} activity. Do not make assumptions about the trigger integration.`,
            ],
          },
        },
      ],
    },
  })

  try {
    let sentSome = false

    const textParts = []

    // add the incoming event and the details for the trigger integration
    {
      // @note surface when this run actually executed, formatted in the
      // integration's own timezone and including the timezone itself, so the
      // model reasons about the run in the user's local time rather than UTC
      const timezone = getTimezone(integration.timezone)

      const ranAt = getShortDateTime(new Date(), {
        timeZone: timezone,
        timeZoneName: 'short',
      })

      await engine.addMessages([
        {
          type: 'instruction',
          text: 'A new turn starts now. Fetch the current trigger integration details and execute the steps in the enclosed instructions.',
        },

        ...makeActivityMessagePair(
          GET_INCOMING_EVENT_ACTIVITY,
          {},
          {
            body: payload.body,
            ranAt: ranAt,
            timezone: timezone,
          }
        ),
      ])

      await engine.addMessages([
        ...makeActivityMessagePair(
          GET_TRIGGER_DETAILS_ACTIVITY,
          {},
          {
            name: integration.name,
            description: integration.description,
            meta: integration.meta, // @todo should we?
          }
        ),
      ])

      sentSome = true
    }

    const text = textParts
      .map((part) => part.trim())
      .filter(Boolean)
      .join('\n\n')

    if (text) {
      await engine.send(text)

      sentSome = true
    }

    if (!sentSome) {
      debug(`no messages sent so bail out`).log(
        'triggerIntegration.queue.handleInteractEvent'
      )

      return
    }

    // @note the engine's `batch` feature keeps nudging the model until it
    // settles the run by calling `_success` / `_failure` (surfaced here as
    // `reason === 'abort'`). If the model still has not settled once the nudge
    // budget is exhausted - or the run errored - we record the run as
    // incomplete instead of silently claiming it completed.
    let reason

    try {
      ;({ reason } = await engine.receive())
    } finally {
      // @note always record a terminal status breadcrumb - even when the engine
      // throws or the run is cut short by the hard timeout - so a run never ends
      // without a marker the next turn can see. In settle mode a successful
      // settlement and a hard-timeout abort BOTH surface as `reason === 'abort'`,
      // so we use the hard-timeout signal to disambiguate: a fired signal means
      // the deadline cut the run short, not that the model settled.
      try {
        const timedOut = context?.signal?.aborted ?? false

        await engine.addMessages([
          ...makeActivityMessagePair(
            CHECK_TRIGGER_RUN_STATUS_ACTIVITY,
            {},
            {
              status:
                !timedOut && reason === 'abort' ? 'complete' : 'incomplete',

              ...(timedOut && { reason: 'timeout' }),
            }
          ),
        ])
      } catch (error) {
        // @note never let a failure to write the breadcrumb mask the original
        // run outcome (which may be propagating out of the inner try)
        await captureException(error)
      }
    }
  } finally {
    await engine.dispose()
  }
}

/**
 * @typedef {{
 *   type: typeof INVOKE_EVENT_TYPE,
 *   payload: InvokePayload
 * }} InvokeEvent
 *
 * @param {string} triggerIntegrationId
 * @param {InvokePayload} payload
 * @param {{ signal?: AbortSignal, markSignals?: AbortSignal[] }} [context]
 * @returns {Promise<void>}
 */
export async function handleInvokeEvent(
  triggerIntegrationId,
  payload,
  context
) {
  debug(`invoke`, { triggerIntegrationId, payload }).log(
    'triggerIntegration.queue.handleInvokeEvent'
  )

  const integration = await prisma.triggerIntegration.findUnique({
    where: {
      id: triggerIntegrationId,
    },

    select: {
      schedule: true,
      timezone: true,
    },
  })

  if (!integration) {
    return throwNotFound(
      `TriggerIntegration not found: ${triggerIntegrationId}`
    )
  }

  const schedule = payload.schedule || integration.schedule
  const nextTriggerAt = schedule
    ? getNext(schedule, { timezone: integration.timezone })
    : null

  // @note we update the trigger last triggered at when we invoke - not when we
  // interact with the trigger - this is an important distinction to make as we
  // want to know when the task was last triggered - not when it was last
  // interacted with
  {
    await prisma.triggerIntegration.update({
      where: {
        id: triggerIntegrationId,
      },

      data: {
        lastTriggerAt: new Date(),
        nextTriggerAt:
          nextTriggerAt && nextTriggerAt > new Date() ? nextTriggerAt : null,
      },
    })
  }

  // @note forward the queue monitor's hard-timeout signal and per-mark signals
  // through to the interact handler. Scheduled triggers run via this invoke path,
  // so without this the engine never receives the deadline: the abort/salvage and
  // timeout-budget machinery stay dormant and a timed-out run is hard-killed
  // having persisted nothing (the queue-timeout regression).
  await handleInteractEvent(
    triggerIntegrationId,
    {
      session: payload.schedule || 'invoke',
      body: JSON.stringify({
        type: 'invoke',
        reason:
          payload.schedule && payload.schedule !== 'never'
            ? `scheduled to run ${payload.schedule}`
            : undefined,
      }),
    },
    context
  )

  // @note nextTriggerAt was updated above so custom schedules do not remain
  // immediately due and get picked up again on the next scheduler sweep.
}

/**
 * @param {string} triggerIntegrationId
 * @param {InteractEvent|InvokeEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(triggerIntegrationId, event) {
  switch (true) {
    case event.type === INTERACT_EVENT_TYPE: {
      await parseAsync(InteractPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === INVOKE_EVENT_TYPE: {
      await parseAsync(InvokePayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(
    `/api/v1/integration/trigger/${triggerIntegrationId}/queue`,
    event,
    {
      // @note do not deduplicate interact events. Each external trigger
      // webhook hit is a distinct event, even when multiple events arrive in
      // the same rounded time bucket.

      ...(event.type === INVOKE_EVENT_TYPE
        ? {
            deduplicationId: `trigger-${triggerIntegrationId}-${
              event.type
            }-${roundToNearestNMinutes(1).getTime()}`,
          }
        : {}),
    }
  )
}

/**
 */
export default withQueueHandlerBounded('triggerIntegrationId', {
  [INTERACT_EVENT_TYPE]: {
    handler: handleInteractEvent,
    schema: InteractPayloadSchema,
  },
  [INVOKE_EVENT_TYPE]: {
    handler: handleInvokeEvent,
    schema: InvokePayloadSchema,
  },
})
