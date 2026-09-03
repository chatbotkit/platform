// @ts-check
import debug from '@/lib/debug'
import { runTasks } from '@/lib/job'
import queue from '@/lib/queue'
import { withQueueHandler } from '@/lib/queue2'

import { sendEvent as sendSessionEvent } from '@/pages/api/session/queue'
import { sendEvent as sendAuditLogEvent } from '@/pages/api/v1/audit/log/queue'
import { sendEvent as sendConversationEvent } from '@/pages/api/v1/conversation/queue'
import { sendEvent as sendDatasetEvent } from '@/pages/api/v1/dataset/queue'
import { sendEvent as sendEventLogEvent } from '@/pages/api/v1/event/log/queue'
import { sendEvent as sendEventMetricEvent } from '@/pages/api/v1/event/metric/queue'
import { sendEvent as sendIntegrationEvent } from '@/pages/api/v1/integration/queue'
import { sendEvent as sendMemoryEvent } from '@/pages/api/v1/memory/queue'
import { sendEvent as sendOAuthEvent } from '@/pages/api/v1/oauth/application/queue'
import { sendEvent as sendTaskEvent } from '@/pages/api/v1/task/queue'
import { sendEvent as sendUsageEvent } from '@/pages/api/v1/usage/queue'

import { z } from 'zod'

export const CLOCK10_EVENT_TYPE = 'clock10' // every 10 minutes

/**
 * @typedef {z.infer<typeof Clock10PayloadSchema>} Clock10Payload
 */
export const Clock10PayloadSchema = z.object({
  // pass
})

/**
 * We use this method to sync integrations.
 */
export async function handleSyncIntegrations() {
  debug(`handle sync schedules`)
    .log('clock.queue.handleSyncIntegrations')
    .log('event.sync.integrations')

  await sendIntegrationEvent({
    type: 'sync',
    payload: {},
  })
}

/**
 * We use this method to trigger integrations.
 */
export async function handleTriggerIntegrations() {
  debug(`handle trigger schedules`)
    .log('clock.queue.handleTriggerIntegrations')
    .log('event.trigger.integrations')

  await sendIntegrationEvent({
    type: 'trigger',
    payload: {},
  })
}

/**
 * We use this method to schedule trigger integrations.
 */
export async function handleScheduleIntegrations() {
  debug(`handle schedule integrations`)
    .log('clock.queue.handleScheduleIntegrations')
    .log('event.schedule.integrations')

  await sendIntegrationEvent({
    type: 'schedule',
    payload: {},
  })
}

/**
 * We use this method to cleanup integrations.
 */
export async function handleCleanupIntegrations() {
  debug(`handle cleanup integrations`)
    .log('clock.queue.handleCleanupIntegrations')
    .log('event.cleanup.integrations')

  await sendIntegrationEvent({
    type: 'cleanup',
    payload: {},
  })
}

/**
 * We use this method to fix stalled trigger integrations.
 */
export async function handleStalledIntegrations() {
  debug(`handle stalled integrations`)
    .log('clock.queue.handleStalledIntegrations')
    .log('event.stalled.integrations')

  await sendIntegrationEvent({
    type: 'stalled',
    payload: {},
  })
}

/**
 * We use this method to cleanup usage records.
 */
export async function handleCleanupUsageRecords() {
  debug(`handle cleanup usage records`)
    .log('clock.queue.handleCleanupUsageRecords')
    .log('event.cleanup.usage.records')

  await sendUsageEvent({
    type: 'cleanup',
    payload: {},
  })
}

/**
 * We use this method to delete expired records.
 */
export async function handleCleanupRecords() {
  debug(`handle cleanup records`)
    .log('clock.queue.handleCleanupRecords')
    .log('event.cleanup.records')

  await sendDatasetEvent({
    type: 'cleanup',
    payload: {},
  })
}

/**
 * We use this method to detect any idle conversations and generated the
 * appropriate events.
 */
export async function handleIdleConversations() {
  debug(`handle idle conversations`)
    .log('clock.queue.handleIdleConversations')
    .log('event.idle.conversations')

  await sendConversationEvent({
    type: 'idle',
    payload: {},
  })
}

/**
 * We use this method to detect any expired conversations and delete them.
 */
export async function handleExpiredConversations() {
  debug(`handle cleanup expired conversations`)
    .log('clock.queue.handleCleanupExpiredConversations')
    .log('event.cleanup.expired.conversations')

  await sendConversationEvent({
    type: 'expired',
    payload: {},
  })
}

/**
 * We use this method to delete empty conversations older than the retention period.
 */
export async function handleEmptyConversations() {
  debug(`handle cleanup empty conversations`)
    .log('clock.queue.handleCleanupEmptyConversations')
    .log('event.cleanup.empty.conversations')

  await sendConversationEvent({
    type: 'empty',
    payload: {},
  })
}

/**
 * We use this method to detect any expired messages and delete them.
 */
export async function handleCleanupMessages() {
  debug(`handle cleanup messages`)
    .log('clock.queue.handleCleanupMessages')
    .log('event.cleanup.messages')

  // @todo implement
}

/**
 * We use this method to trigger scheduled tasks.
 */
export async function handleTriggerTasks() {
  debug(`handle trigger tasks`)
    .log('clock.queue.handleTriggerTasks')
    .log('event.trigger.tasks')

  await sendTaskEvent({
    type: 'trigger',
    payload: {},
  })
}

/**
 * We use this method to clean up expired tasks.
 */
export async function handleCleanupTasks() {
  debug(`handle cleanup tasks`)
    .log('clock.queue.handleCleanupTasks')
    .log('event.cleanup.tasks')

  await sendTaskEvent({
    type: 'cleanup',
    payload: {},
  })
}

/**
 * We use this method to clean up expired tasks.
 */
export async function handleScheduleTasks() {
  debug(`handle schedule tasks`)
    .log('clock.queue.handleScheduleTasks')
    .log('event.schedule.tasks')

  await sendTaskEvent({
    type: 'schedule',
    payload: {},
  })
}

/**
 * We use this method to fix stalled tasks.
 */
export async function handleStalledTasks() {
  debug(`handle stalled tasks`)
    .log('clock.queue.handleStalledTasks')
    .log('event.stalled.tasks')

  await sendTaskEvent({
    type: 'stalled',
    payload: {},
  })
}

/**
 * We use this method to clean up expired memories.
 */
export async function handleCleanupMemories() {
  debug(`handle cleanup memories`)
    .log('clock.queue.handleCleanupMemories')
    .log('event.cleanup.memories')

  await sendMemoryEvent({
    type: 'cleanup',
    payload: {},
  })
}

/**
 * We use this method to clean up expired sessions.
 */
export async function handleCleanupSessions() {
  debug(`handle cleanup sessions`)
    .log('clock.queue.handleCleanupSessions')
    .log('event.cleanup.sessions')

  await sendSessionEvent({
    type: 'cleanup',
    payload: {},
  })
}

/**
 * We use this method to clean up expired oauth tokens.
 */
export async function handleCleanupOAuthTokens() {
  debug(`handle cleanup oauth tokens`)
    .log('clock.queue.handleCleanupOAuthTokens')
    .log('event.cleanup.oauth.tokens')

  await sendOAuthEvent({
    type: 'cleanup',
    payload: {},
  })
}

/**
 * We use this method to clean up old event logs.
 */
export async function handleCleanupEventLogs() {
  debug(`handle cleanup event logs`)
    .log('clock.queue.handleCleanupEventLogs')
    .log('event.cleanup.event.logs')

  await sendEventLogEvent({
    type: 'cleanup',
    payload: {},
  })
}

/**
 * We use this method to clean up old event metrics.
 */
export async function handleCleanupEventMetrics() {
  debug(`handle cleanup event metrics`)
    .log('clock.queue.handleCleanupEventMetrics')
    .log('event.cleanup.event.metrics')

  await sendEventMetricEvent({
    type: 'cleanup',
    payload: {},
  })
}

/**
 * We use this method to clean up old audit logs.
 */
export async function handleCleanupAuditLogs() {
  debug(`handle cleanup audit logs`)
    .log('clock.queue.handleCleanupAuditLogs')
    .log('event.cleanup.audit.logs')

  await sendAuditLogEvent({
    type: 'cleanup',
    payload: {},
  })
}

/**
 * @typedef {{
 *   type: typeof CLOCK10_EVENT_TYPE,
 *   payload: Clock10Payload
 * }} Clock10Event
 *
 * @param {Clock10Payload} payload
 * @returns {Promise<void>}
 */
export async function handleClock10Event(payload) {
  debug(`clock10`, { payload })
    .log('clock.queue.handleClock10Event')
    .log('event.clock10')

  await runTasks([
    // parallel maintenance and trigger phase

    // @note schedule dispatch is intentionally best-effort repair, not a hard
    // prerequisite for the trigger sweep. create/update/execute paths already
    // maintain nextRunAt/nextTriggerAt, so running these queue dispatches in
    // the same batch is expected and sufficient here.

    // integrations

    handleSyncIntegrations(),
    handleScheduleIntegrations(),
    handleTriggerIntegrations(),
    handleCleanupIntegrations(),
    handleStalledIntegrations(),

    // usage

    handleCleanupUsageRecords(),

    // records

    handleCleanupRecords(),

    // conversations

    handleIdleConversations(),
    handleExpiredConversations(),
    handleEmptyConversations(),

    // messages

    handleCleanupMessages(),

    // tasks

    handleScheduleTasks(),
    handleTriggerTasks(),
    handleCleanupTasks(),
    handleStalledTasks(),

    // memories

    handleCleanupMemories(),

    // sessions

    handleCleanupSessions(),

    // oauth tokens

    handleCleanupOAuthTokens(),

    // logs

    handleCleanupEventLogs(),
    handleCleanupEventMetrics(),
    handleCleanupAuditLogs(),
  ])
}

/**
 * @param {Clock10Event} event
 * @returns {Promise<void>}
 */
export async function sendEvent(event) {
  switch (true) {
    case event.type === CLOCK10_EVENT_TYPE: {
      await Clock10PayloadSchema.parseAsync(event.payload)

      break
    }
  }

  await queue(`/api/system/queue`, event)
}

/**
 */
export default withQueueHandler({
  [CLOCK10_EVENT_TYPE]: {
    handler: handleClock10Event,
    schema: Clock10PayloadSchema,
  },
})
