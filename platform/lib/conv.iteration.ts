/**
 * @fileoverview The single between-iteration gate the provider drivers consult
 * to decide whether the agentic loop recurses. Pure and dependency-free (no env,
 * no provider imports) so it can be unit-tested in isolation.
 */

/**
 * Decide whether the agentic loop should stop at this iteration boundary.
 *
 * Returns true when EITHER the cooperative soft-yield has been requested
 * (`yieldSignal` aborted - see `ConversationInput.yieldSignal` in `conv.ts`) OR
 * the NEXT iteration would reach the configured `maxIterations` limit. The yield
 * check is first and unconditional, so a caller can bow out gracefully even when
 * no iteration limit is set.
 */
export function iterationLimitReached(input: {
  yieldSignal?: AbortSignal
  currentIterations: number
  maxIterations?: number
}): boolean {
  // @note cooperative soft-yield: when asked to yield, stop at this iteration
  // boundary. The current round has already finished, so the conversation is in
  // a valid state (tool results in, nothing dangling) - same stopping point as
  // the iteration limit, just triggered by the caller instead.
  if (input.yieldSignal?.aborted) {
    return true
  }

  if (input.maxIterations === undefined) {
    return false // no limit set
  }

  // @note check if the NEXT iteration would exceed the limit
  return input.currentIterations + 1 >= input.maxIterations
}
