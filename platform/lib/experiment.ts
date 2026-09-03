/**
 * A/B Testing and Feature Experiment Infrastructure
 *
 * Provides deterministic percentage-based feature rollouts using consistent
 * hashing. The same identifier will always produce the same result, ensuring
 * users have a consistent experience across requests.
 *
 * @example
 * ```ts
 * // Use centrally configured experiment
 * if (await isInExperiment('chunking', userId)) {
 *   // run experiment variant
 * }
 *
 * // Or with explicit percentage
 * if (await shouldRunExperiment('new-feature', userId, 20)) {
 *   // run experiment variant
 * }
 * ```
 */
import experiments from '@/config/experiments'

import { sha256 } from '@/lib/webcrypto'

/**
 * Determines if an experiment should run for a given identifier.
 *
 * Uses deterministic hashing so the same identifier always gets the same
 * result for the same experiment name and percentage.
 *
 * @param experimentName - Unique name for the experiment (used for hashing)
 * @param identifier - Stable identifier (userId, sessionId, etc.)
 * @param percentage - Percentage of traffic to include (0-100)
 * @returns true if the experiment should run
 *
 * @example
 * ```ts
 * // Enable feature for 20% of users
 * if (await shouldRunExperiment('new-feature', userId, 20)) {
 *   // new feature code
 * }
 *
 * // Gradually roll out: start at 5%, increase to 50%, then 100%
 * if (await shouldRunExperiment('gradual-rollout', userId, 50)) {
 *   // rolled out feature
 * }
 * ```
 */
export async function shouldRunExperiment(
  experimentName: string,
  identifier: string,
  percentage: number
): Promise<boolean> {
  if (!identifier) {
    return false
  }

  if (percentage <= 0) {
    return false
  }

  if (percentage >= 100) {
    return true
  }

  const hash = await sha256(`${experimentName}:${identifier}`)

  // @note use first 8 hex chars for sufficient randomness distribution
  const hashValue = parseInt(hash.substring(0, 8), 16)
  const bucket = hashValue % 100

  return bucket < percentage
}

/**
 * Determines if an identifier is in a centrally configured experiment.
 *
 * Uses the experiment configuration from @/config/experiments to determine
 * the percentage. If the experiment is not configured, returns false.
 *
 * @param experimentName - Name of the experiment (must be defined in config)
 * @param identifier - Stable identifier (userId, sessionId, etc.)
 * @returns true if the identifier is in the experiment group
 *
 * @example
 * ```ts
 * // Check if user is in the chunking experiment
 * if (await isInExperiment('chunking', userId)) {
 *   features.push({ name: 'chunking' })
 * }
 * ```
 */
export async function isInExperiment(
  experimentName: keyof typeof experiments,
  identifier: string
): Promise<boolean> {
  const percentage = experiments[experimentName]

  if (percentage === undefined) {
    return false
  }

  return shouldRunExperiment(experimentName, identifier, percentage)
}
