/**
 * @fileoverview Execution limits configuration for queue handlers.
 *
 * This file defines platform-level maximum limits and default values for
 * queue-based execution handlers (triggers, workflows, etc.).
 */
import {
  ONE_DAY_IN_MILLISECONDS,
  QUARTER_HOUR_IN_MILLISECONDS,
} from '@chatbotkit-dev/time'

// -----------------------------------------------------------------------------
// Platform Limits
// -----------------------------------------------------------------------------

/**
 * @note Platform limits represent the absolute maximum values that can be
 * configured. These are enforced at the infrastructure level by the chunked
 * queue handler and cannot be exceeded regardless of user configuration.
 */
export const PLATFORM_LIMITS = {
  /**
   * Minimum number of iterations allowed per execution.
   * This is the lower bound for user-configurable maxIterations.
   */
  minIterations: 10,

  /**
   * Maximum number of iterations allowed per execution.
   * This is the upper bound for user-configurable maxIterations.
   */
  maxIterations: 100_000,

  /**
   * Minimum time allowed per execution in milliseconds.
   * This is the lower bound for user-configurable maxTime.
   */
  minTime: QUARTER_HOUR_IN_MILLISECONDS,

  /**
   * Maximum time allowed per execution in milliseconds.
   * This is the upper bound for user-configurable maxTime.
   */
  maxTime: ONE_DAY_IN_MILLISECONDS,

  /**
   * Minimum number of tool calls allowed across an execution.
   * This is the lower bound for user-configurable maxCalls.
   */
  minCalls: 1,

  /**
   * Maximum number of tool calls allowed across an execution.
   * This is the upper bound for user-configurable maxCalls.
   */
  maxCalls: 100_000,
} as const

// -----------------------------------------------------------------------------
// Default Limits
// -----------------------------------------------------------------------------

/**
 * @note Default limits are applied when the user does not specify custom
 * limits. These provide sensible defaults for most use cases while still
 * allowing users to configure higher values up to the platform limits.
 */
export const DEFAULT_LIMITS = {
  /**
   * Default number of iterations per execution when not specified.
   */
  maxIterations: Math.min(1_000, PLATFORM_LIMITS.maxIterations),

  /**
   * Default time limit per execution in milliseconds when not specified.
   */
  maxTime: Math.min(QUARTER_HOUR_IN_MILLISECONDS, PLATFORM_LIMITS.maxTime),

  /**
   * Default whole-task tool-call budget when not specified.
   *
   * @note Sits comfortably above the iteration default (a single iteration can
   * issue several tool calls) so it does not choke legitimate multi-call tasks,
   * while still bounding a runaway an order of magnitude below the platform
   * ceiling. Distinct from the conv per-run `DEFAULT_MAX_CALLS`, which caps a
   * single-shot completion (e.g. chat) rather than a whole task.
   */
  maxCalls: Math.min(10_000, PLATFORM_LIMITS.maxCalls),
} as const
