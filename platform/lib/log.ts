// --- Imports ---
import prisma from '@/prisma/client'
import type { AuditLog, EventLog, EventMetric } from '@/prisma/types'

import { publishChannelMessage } from '@/lib/channel.user'
import debug from '@/lib/debug'
import defer from '@/lib/defer'
import { captureError } from '@/lib/error'
import availableEvents from '@/lib/event'
import type {
  EventConfigEventType,
  TriggerableEventConfigEventType,
} from '@/lib/event'
import { fastGetUserById } from '@/lib/user.get'
import { isLiveEventStreamingEnabled } from '@/lib/user.limits'

// --- Event Config ---

export const EVENTS_CHANNEL_NAME = 'event/logs'

export const triggerableEventTypes = availableEvents
  .filter(({ trigger }) => !!trigger)
  .map(({ type }) => type)

function isTriggerableEventType(
  type: string
): type is TriggerableEventConfigEventType {
  return (triggerableEventTypes as readonly string[]).includes(type)
}

// --- Shared Types ---

interface User {
  // @todo for safety reason we should also require the user email here to avoid
  // passing objects that have id but are nothing like the user

  id: string
}

type ExtractIdFields<T> = {
  [K in keyof T as K extends `${string}Id`
    ? K extends 'userId'
      ? never
      : K
    : never]?: T[K]
}

export type AuditRelations = ExtractIdFields<AuditLog>

// @note event names are intentionally sourced from lib/event so each logged
// event is documented in one place before it can be used in code.

interface LogEventOptions {
  user: User
  name?: string
  description?: string
  type: EventConfigEventType
  relations: ExtractIdFields<EventLog>
  meta?: Record<string, unknown>
}

interface LogMetricOptions {
  user: User
  name?: string
  description?: string
  type: EventConfigEventType
  value: number
  relations?: ExtractIdFields<EventMetric>
  meta?: Record<string, unknown>
}

interface LogAuditOptions {
  user: User
  name?: string
  description?: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EMAIL'
  oldValues: Record<string, unknown> | undefined
  newValues: Record<string, unknown> | undefined
  relations: ExtractIdFields<AuditLog>
  meta?: Record<string, unknown>
}

// --- Event Logging ---

/**
 * Enhanced logEvent function that writes to database
 */
export async function logEventNow({
  user,
  name,
  description,
  type,
  relations,
  meta,
}: LogEventOptions): Promise<void> {
  if (process.env.SKIP_LOG_RECORDING === 'true') {
    debug(`skipping log event`, {
      user,
      name,
      description,
      type,
      relations,
      meta,
    }).log('log.logEvent')

    return
  }

  debug(`log event`, { user, name, description, type, relations, meta }).log(
    'log.logEvent'
  )

  try {
    const { id, createdAt } = await prisma.eventLog.create({
      data: {
        ...relations,

        userId: user.id,

        name: name,
        description: description,

        type: type,

        meta: {
          // @note adding the relations to the meta in order to ensure that we
          // preserve this information in case something is deleted

          relations,

          ...meta,
        },
      },

      select: {
        id: true,
        createdAt: true,
      },
    })

    // @note keep existing logging for now (dual-write phase)

    // eslint-disable-next-line no-console
    console.info('Event', {
      userId: user.id,
      eventId: id,
      eventType: type,
      eventRelations: relations,
      eventMeta: meta,
    })

    // @note Live event streaming cost/performance assessment:
    //
    // COSTS (Upstash Redis pricing as of 2024):
    // - $0.20 per 100,000 commands (pay-as-you-go)
    // - Each publishChannelMessage = 1 HTTP POST = 1 command
    // - 1M events/month = ~$2/month in Upstash costs
    // - 10M events/month = ~$20/month in Upstash costs
    //
    // PERFORMANCE:
    // - Fire-and-forget pattern: non-blocking, doesn't slow logEvent
    // - Each publish: ~50-100ms HTTP request to Upstash (async)
    // - Messages discarded if no subscribers (no storage cost)
    //
    // RISK MITIGATION:
    // - Feature is gated by user plan (pro+ only) via limits.yaml
    // - No impact on free/basic tiers

    // @note defer live event streaming so it can run after the response when
    // possible while still being tracked by the request lifetime.

    await defer(async () => {
      try {
        // @note use cached user lookup for performance
        const fullUser = await fastGetUserById(user.id)

        if (!fullUser) {
          return
        }

        const enabled = await isLiveEventStreamingEnabled(fullUser)

        if (enabled) {
          await publishChannelMessage(user.id, EVENTS_CHANNEL_NAME, {
            id,
            type,
            name,
            description,
            ...relations,
            meta,
            createdAt: createdAt.toISOString(),
            updatedAt: createdAt.toISOString(),
          })
        }
      } catch (error) {
        await captureError(error)
      }
    })
  } catch (error) {
    await captureError(error)
  }

  if (isTriggerableEventType(type)) {
    const { sendEvent } = await import('@/pages/api/user/[userId]/queue')

    await sendEvent(user.id, {
      type: 'trigger',
      payload: {
        eventType: type,
        eventData: relations,
      },
    })
  }
}

/**
 * Defers event logging when the caller is running inside a deferred context.
 */
export async function logEvent(options: LogEventOptions): Promise<void> {
  await defer(async () => {
    await logEventNow(options)
  })
}

// --- Metric Logging ---

/**
 * Enhanced logMetric function that writes to database
 */
export async function logMetricNow({
  user,
  name,
  description,
  type,
  value,
  relations,
  meta,
}: LogMetricOptions): Promise<void> {
  if (process.env.SKIP_LOG_RECORDING === 'true') {
    debug(`skipping log metric`, {
      user,
      name,
      description,
      type,
      value,
      relations,
      meta,
    }).log('log.logMetric')

    return
  }

  debug(`log metric`, {
    user,
    name,
    description,
    type,
    value,
    relations,
    meta,
  }).log('log.logMetric')

  try {
    const { id } = await prisma.eventMetric.create({
      data: {
        ...relations,

        userId: user.id,

        name,
        description,

        type: type,

        value: value,

        meta: {
          // @note adding the relations to the meta in order to ensure that we
          // preserve this information in case something is deleted

          relations,

          ...meta,
        },
      },

      select: {
        id: true,
      },
    })

    // @note keep existing logging for now (dual-write phase)

    // eslint-disable-next-line no-console
    console.info('Metric', {
      userId: user.id,
      metricId: id,
      metricType: type,
      metricValue: value,
      metricRelations: relations,
      metricMeta: meta,
    })
  } catch (error) {
    await captureError(error)
  }
}

/**
 * Defers metric logging when the caller is running inside a deferred context.
 */
export async function logMetric(options: LogMetricOptions): Promise<void> {
  await defer(async () => {
    await logMetricNow(options)
  })
}

// --- Audit Logging ---

/**
 * Audit logging capability for compliance tracking
 */
export async function logAuditNow({
  user,
  name,
  description,
  action,
  oldValues,
  newValues,
  relations,
  meta,
}: LogAuditOptions): Promise<void> {
  if (process.env.SKIP_LOG_RECORDING === 'true') {
    debug(`skipping log audit`, {
      user,
      name,
      description,
      action,
      relations,
      meta,
    }).log('log.logAudit')

    return
  }

  debug(`log audit`, { user, name, description, action, relations, meta }).log(
    'log.logAudit'
  )

  try {
    await prisma.auditLog.create({
      data: {
        ...relations,

        userId: user.id,

        name,
        description,

        action: action,

        oldValues: oldValues,
        newValues: newValues,

        meta: {
          // @note adding the relations to the meta in order to ensure that we
          // preserve this information in case something is deleted

          relations,

          ...meta,
        },
      },
    })
  } catch (error) {
    await captureError(error)
  }
}

/**
 * Defers audit logging when the caller is running inside a deferred context.
 */
export async function logAudit(options: LogAuditOptions): Promise<void> {
  await defer(async () => {
    await logAuditNow(options)
  })
}
