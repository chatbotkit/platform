// @ts-check
import prisma from '@/prisma/client'

import { makeActivityMessagePair } from '@/lib/activity'
import { setContextUser } from '@/lib/context.store'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import debug from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { getRecallMeetingSession } from '@/lib/recall.session'
import { throwLimitsReached, throwNotFound } from '@/lib/response'
import { updateSessionStore } from '@/lib/session.context'
import { userToSessionUser } from '@/lib/user.session'
import { parseAsync } from '@/lib/zod.schema'
import { z } from '@/lib/zod.schema'

// --- Consts ---

export const FINALISE_EVENT_TYPE = 'finalise'

const RECALL_MEETING_ENDED_ACTIVITY = '_recallMeetingEnded'

// --- Input Schemas ---

export const FinalisePayloadSchema = z
  .object({
    sessionId: z.string().min(1),
    recallBotId: z.string().optional(),
    subCode: z.string().optional(),
  })
  .strict()

/**
 * @typedef {z.infer<typeof FinalisePayloadSchema>} FinalisePayload
 */

// --- Event Handlers ---

/**
 * @typedef {{
 *   type: typeof FINALISE_EVENT_TYPE,
 *   payload: FinalisePayload,
 * }} FinaliseEvent
 *
 * @param {string} recallIntegrationId
 * @param {FinalisePayload} payload
 * @param {{ signal?: AbortSignal, markSignals?: AbortSignal[] }} [context]
 * @returns {Promise<void>}
 */
export async function handleFinaliseEvent(
  recallIntegrationId,
  payload,
  context
) {
  debug(`recall finalise`, { recallIntegrationId, payload }).log(
    'integration.recall.queue.handleFinaliseEvent'
  )

  payload = await FinalisePayloadSchema.parseAsync(payload)

  const integration = await prisma.recallIntegration.findUnique({
    where: {
      id: recallIntegrationId,
    },

    include: {
      user: true, // @note super important
      bot: true, // @note super important
    },
  })

  if (!integration) {
    return throwNotFound(`RecallIntegration not found: ${recallIntegrationId}`)
  }

  if (!integration.bot) {
    debug(`skipping - no bot configured`).log(
      'integration.recall.queue.handleFinaliseEvent'
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

  const recallSession = await getRecallMeetingSession(payload.sessionId)

  if (
    !recallSession ||
    recallSession.recallIntegrationId !== recallIntegrationId
  ) {
    debug(`session missing or mismatched`, {
      sessionId: payload.sessionId,
    }).log('integration.recall.queue.handleFinaliseEvent')

    return
  }

  if (!recallSession.conversationId) {
    debug(`session has no conversation`, {
      sessionId: payload.sessionId,
    }).log('integration.recall.queue.handleFinaliseEvent')

    return
  }

  const engine = await getStatefulConversationEngine({
    conversationId: recallSession.conversationId,

    options: {
      signal: context?.signal,

      // @note fire-once per-mark signals from the queue monitor; the engine's
      // `timeoutMarks` feature listens to these. NOT cancellation signals

      markSignals: context?.markSignals,

      userId: integration.userId,

      features: [
        // @todo no per-message human sender exists here: recall is a meeting
        // transcription service, not person-to-person messaging, and this
        // handler runs on the meeting-finalised event. If per-speaker
        // attribution becomes available from transcript diarization, surface it
        // via a `userInfo` feature the way the other messaging integrations do.

        // @note record a checkpoint activity into the conversation each time the
        // queue handler crosses a timeout-budget mark (driven by markSignals
        // above), visible to the model on the next turn

        { name: 'timeoutMarks' },
      ],
    },
  })

  try {
    // Record the call-ended signal as an activity pair on the conversation
    // before steering the agent so downstream tooling can attribute the
    // closing summary to the `bot.call_ended` event.

    await engine.addMessages(
      makeActivityMessagePair(
        RECALL_MEETING_ENDED_ACTIVITY,
        {
          sessionId: payload.sessionId,
          recallBotId: payload.recallBotId,
          subCode: payload.subCode,
        },
        {
          event: 'ended',
        }
      )
    )

    // Drive the agent to produce a final closing summary against the meeting
    // history (transcript turns + chat messages it received during the call).

    await engine.send(
      'The meeting has just ended. Produce a brief closing summary of what was discussed.',
      { type: 'instruction' }
    )

    await engine.receive()
  } finally {
    await engine.dispose()
  }
}

// --- Send Helper ---

/**
 * @param {string} recallIntegrationId
 * @param {FinaliseEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(recallIntegrationId, event) {
  if (event.type === FINALISE_EVENT_TYPE) {
    await parseAsync(FinalisePayloadSchema, event.payload, captureInputError)
  }

  await queue(
    `/api/v1/integration/recall/${recallIntegrationId}/queue`,
    event,
    {
      // De-dupe by sessionId so retried webhooks (Recall retries 4xx/5xx)
      // don't trigger multiple closing summaries on the same conversation.

      deduplicationId: `recall-${recallIntegrationId}-${event.type}-${event.payload.sessionId}`,
    }
  )
}

export default withQueueHandlerBounded('recallIntegrationId', {
  [FINALISE_EVENT_TYPE]: {
    handler: handleFinaliseEvent,
    schema: FinalisePayloadSchema,
  },
})
