import limits from '@/config/limits'

import { revealUserPlan } from '@/lib/user.plan'

export async function getMaxFileSize(
  user: Parameters<typeof revealUserPlan>[0]
): Promise<number> {
  const { plan } = await revealUserPlan(user)

  const maxFileSize = limits[plan].attachment.maxFileSize

  return maxFileSize
}

/**
 * Check if live event streaming is enabled for a user based on their plan.
 *
 * @note live streaming is gated because of its cost/performance implications:
 * each event logged triggers a pub/sub message to Redis.
 *
 * @param user - The user to check
 * @returns true if live streaming is enabled for this user's plan
 */
export async function isLiveEventStreamingEnabled(
  user: Parameters<typeof revealUserPlan>[0]
): Promise<boolean> {
  const { plan } = await revealUserPlan(user)

  return limits[plan]?.eventLogs?.liveStreaming === true
}

/**
 * Check whether a user's plan may run integrations on a schedule - recurring
 * dataset syncs and scheduled triggers.
 *
 * @note the queue worker turns the schedule off when this is false, so the
 * check runs once per due item rather than on every read.
 *
 * @param user - The user to check
 * @returns true if scheduled integrations are enabled for this user's plan
 */
export async function isScheduledIntegrationEnabled(
  user: Parameters<typeof revealUserPlan>[0]
): Promise<boolean> {
  const { plan } = await revealUserPlan(user)

  return limits[plan]?.scheduling?.integrations === true
}

/**
 * Check whether a user's plan may run tasks on a schedule. A task can always
 * be run manually - this gates only the recurring run.
 *
 * @param user - The user to check
 * @returns true if scheduled tasks are enabled for this user's plan
 */
export async function isScheduledTaskEnabled(
  user: Parameters<typeof revealUserPlan>[0]
): Promise<boolean> {
  const { plan } = await revealUserPlan(user)

  return limits[plan]?.scheduling?.tasks === true
}
