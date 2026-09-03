import { getTextTokensLength, slice } from '@chatbotkit-dev/gpt'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { languageModels } from '@/config/models'

import type { MessageType } from '@/prisma/types'

import {
  REQUEST_ACTIVITY_TYPE,
  RESPONSE_ACTIVITY_TYPE,
  TRIGGER_ACTIVITY_TYPE,
  isPairedActivityMessage,
  makeActivityMessagePair,
  makeRequestActivityMessage,
  makeResponseActivityMessage,
} from '@/lib/activity'
import {
  getContextConversation,
  getContextNamespace,
} from '@/lib/context.store'
import {
  TAG_ABORT,
  TAG_AUDIO,
  TAG_COMPLETE_BEGIN,
  TAG_COMPLETE_END,
  TAG_ERROR,
  TAG_MESSAGE,
  TAG_REASONING_TOKEN,
  TAG_TOKEN,
  TAG_USAGE,
} from '@/lib/conv'
import type {
  ConversationFunction,
  ConversationInput,
  ConversationOutput,
  Item,
  Message,
  MessageWithUsage,
  Usage,
} from '@/lib/conv'
import { iterationLimitReached } from '@/lib/conv.iteration'
import {
  getConversationAttachmentDownloadURL,
  getConversationAttachmentUploadActivityMessageDetails,
} from '@/lib/conversation.attachment'
import { responseToDataUrl } from '@/lib/dataurl.response'
import debug, { assert, createSpan } from '@/lib/debug'
import {
  ContentModerationError,
  SafeError,
  SystemError,
  UnexpectedStateError,
  captureException,
  captureObservation,
  captureUnexpectedState,
  isContentModerationError,
} from '@/lib/error'
import fetch, { TIMEOUT_ERROR_NAME } from '@/lib/fetch'
import { cancelable, events, yieldSequentiallyFromParallel } from '@/lib/it'
import type { AbortableTask } from '@/lib/job'
import { runAbortableTask } from '@/lib/job'
import { tryStringify as tryStringifyJson } from '@/lib/json'
import type { ActivityMessage } from '@/lib/message'
import type {
  CreateChatCompletionStreamFinishReason,
  CreateResponseCompletionStreamFinishReason,
  CreateTextCompletionStreamFinishReason,
  OpenAIFunctionCall,
  OpenAIResponseToolCall,
  OpenAIToolCall,
  RealtimeSocket,
  ResponseInput,
} from '@/lib/model.provider.openai'
import {
  createChatCompletionStream,
  createRealtimeSocket,
  createResponseCompletionStream,
  createTextCompletionStream,
} from '@/lib/model.provider.openai.adaptor'
import { isRetriableError } from '@/lib/model.retry'
import {
  modelHasAudioInputEnabled,
  modelHasFileInputEnabled,
  modelHasImageInputEnabled,
  modelHasVideoInputEnabled,
  modelSupportsChat,
  modelSupportsRealtime,
  modelSupportsResponses,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'
import {
  getNamespaceAttachmentTempDownloadURL,
  getNamespaceAttachmentUploadActivityMessageDetails,
} from '@/lib/namespace.attachment'
import { clone } from '@/lib/object'
import { awaitWithAbortGrace } from '@/lib/promise'
import { throwConflict } from '@/lib/response'
import { Result } from '@/lib/result'
import { byteSlice, getRandomId } from '@/lib/string'
import {
  buildThread,
  createRepetitionGuard,
  describeThreadCycle,
  isThreadCyclic,
} from '@/lib/thread'

import type OpenAI from 'openai'

// --- Types ---

/**
 * This is the type of message that is sent to the OpenAI API.
 */
type ProviderMessage = OpenAI.Chat.ChatCompletionMessageParam & {
  reasoning_content?: string
}

/**
 * Gemini-3 returns a per-tool-call `thought_signature` that must be replayed
 * verbatim on the follow-up request or the provider rejects the tool turn. It
 * is persisted on the request activity's function meta so it survives a
 * stateless rebuild of the conversation.
 *
 * @note typed here rather than on `FunctionRequestActivityMessage` on purpose -
 * this is a provider-level concern, not part of the shared message contract.
 */
type ActivityFunctionWithThoughtSignature = {
  thoughtSignature?: string
}

/**
 * Utility type for getMessageName options.
 */
type GetNameOptions = {
  withNames?:
    | boolean
    | {
        user: string
        assistant: string
        reasoning: string
        context: string
        instruction: string
        backstory: string
        checkpoint: string
        activity: string
      }
}

// --- Constants ---

export const MIN_TOKENS = 10_000 // @note this is the number of min input tokens - to ensure we have enough space for the backstory and functions to begin with

// @note the in-message runaway guard does not arm until the model has produced
// this many characters in the turn. Short repetitive output (a small list, a few
// identical lines) is harmless - it ends on its own - and was the bulk of the
// loop-detection false positives; a genuine runaway is unbounded and crosses
// this floor, so the only cost is letting it run this far before the stop. The
// 52-event production batch topped out at ~1.3k chars of legitimate repetition,
// so 2000 clears every observed false positive with margin. ~500 tokens.
export const RUNAWAY_GUARD_MIN_CHARS = 2_000

// @note these are the conv loop's built-in safety limits. Only `maxCalls` is
// exposed as user configuration, and only on tasks (Task.maxCalls, enforced as
// a whole-task budget by the task workflow). This is by design: a task is the
// only primitive meant to run for a long period, so it is the only one that
// needs a tunable budget - every other primitive (interactive chat, bot
// sessions, etc.) runs a single bounded turn and keeps these defaults. The
// rest stay fixed defaults everywhere on purpose, so there is intentionally no
// configuration surface for them.
export const DEFAULT_MAX_CONTINUATIONS = 20 // @note retry/recovery cap (output truncated, empty, or retryable stream error); not configurable by design
export const DEFAULT_MAX_CALLS = 1000 // @note per-run tool-call cap for single-shot completions (e.g. chat); tasks instead run under a whole-task budget (config DEFAULT_LIMITS.maxCalls, overridable via Task.maxCalls)
export const DEFAULT_MAX_ITERATIONS = 1000 // @note agentic-round cap applied when a caller does not specify one (e.g. interactive conversation completions); mirrors config DEFAULT_LIMITS.maxIterations. This is a behavioural guard, not a stack-safety one - the loop is driven iteratively (see the completeChatConversationStream/completeResponseConversationStream drivers) so any value, including the PLATFORM_LIMITS ceiling, is stack-safe
export const DEFAULT_MAX_CYCLES = 2 // @note maximum number of cycle detections before stopping; not configurable by design
export const DEFAULT_MAX_SETTLES = 20 // @note maximum number of settle nudges before surfacing the unsettled turn as an iteration; not configurable by design
export const DEFAULT_MAX_EMPTIES = 3 // @note maximum number of empty turns (a `stop` with neither answer text nor a tool call) before giving up; kept far tighter than the continuation budget because retrying an empty turn rarely recovers - mirrors the cyclic-behaviour guard (the follow-up regression); not configurable by design

// @note grace period given to a tool handler after the request deadline (the
// wired hard-timeout abort signal) fires. The handler always receives the signal
// so a cooperative tool can cancel its own in-flight work; this is how long the
// loop then waits for it to return before bypassing it - it records a timeout
// result in the handler's place (so the tool call still gets a paired response)
// and the loop stops on the next round. A non-cooperative handler keeps running
// orphaned, but it no longer strands the whole turn past the hard kill. Not
// configurable by design, like the rest of these knobs.
export const HANDLER_DEADLINE_GRACE_MS = 5_000

// @note recorded as the tool result when a handler is bypassed, so the bypassed
// tool call still gets a paired response the model can see on the next turn.
const HANDLER_DEADLINE_BYPASS_ERROR =
  'The tool did not return before the request deadline and was bypassed.'

// @note the model is given an in-thread heads-up - see addCallBudgetLowNotice -
// once the remaining tool-call budget enters a "low" band, so it can prioritise
// and wrap up before it hits the hard stop instead of being cut off mid-task
// with no warning. The band is the SMALLER of two knobs so it
// stays sensible across very different budgets:
//   - CALL_BUDGET_LOW_RATIO: a fraction of the total budget, so a small budget
//     does not warn almost immediately (a budget of 10 must not warn at 9 left),
//     and
//   - CALL_BUDGET_LOW_CAP: an absolute ceiling, so a large budget does not warn
//     far too early (a budget of 200 should still warn ~10 calls from the end,
//     not at 40 left).
// warn-at = min(CAP, floor(maxCalls * RATIO)). At the default budget of 50 both
// yield 10, preserving the original behaviour. Budgets too small for the ratio
// to clear a single call resolve to 0 and - via the `remaining > 0` guard - are
// never warned (a heads-up with no runway left to act on is just noise).
export const CALL_BUDGET_LOW_RATIO = 0.2
export const CALL_BUDGET_LOW_CAP = 10

export const USER_MESSAGE_TYPE = 'user'
export const BOT_MESSAGE_TYPE = 'bot'
export const REASONING_MESSAGE_TYPE = 'reasoning'
export const CONTEXT_MESSAGE_TYPE = 'context'
export const INSTRUCTION_MESSAGE_TYPE = 'instruction'
export const BACKSTORY_MESSAGE_TYPE = 'backstory'
export const CHECKPOINT_MESSAGE_TYPE = 'checkpoint'
export const ACTIVITY_MESSAGE_TYPE = 'activity'

export const TMP_FUNCTIONS_MESSAGE_TYPE = '_tmpFunctions'
export const TMP_BACKSTORY_MESSAGE_TYPE = '_tmpBackstory'
export const TMP_CHECKPOINT_MESSAGE_TYPE = '_tmpCheckpoint'

const EMPTY_DETECTED_FUNCTION_NAME = '_emptyDetected'
const CYCLE_DETECTED_FUNCTION_NAME = '_cycleDetected'
const CALL_BUDGET_LOW_FUNCTION_NAME = '_callBudgetLow'
const MODERATION_REDUCED_FUNCTION_NAME = '_moderationReduced'
const SETTLE_REQUIRED_FUNCTION_NAME = '_settleRequired'

const CHECKPOINT_FUNCTION_NAME = '_checkpoint'

const LOOP_STOP_USER_MESSAGE =
  'I seem to be stuck in a loop. Let me stop here - please try rephrasing your request or providing more details.'
const LOOP_STOP_BACKGROUND_MESSAGE =
  'I seem to be stuck in a loop. Let me stop here, reframe the problem, and try again from a different angle.'

const CALL_LIMIT_STOP_USER_MESSAGE =
  'I have reached the limit of actions I can take for this request. Let me stop here - please try again or break the task into smaller steps.'
const CALL_LIMIT_STOP_BACKGROUND_MESSAGE =
  'I have reached the limit of actions I can take for this request. Let me stop here and continue from what I have so far.'

// --- Stubs ---

/**
 * The following are function stubs defined in case the model decides to call
 * any one of them.
 */
const internalFunctionStubs = {
  [EMPTY_DETECTED_FUNCTION_NAME]: {
    handler: async () => {
      throw new Error('Internal function - should not be called directly')
    },
  },

  [CYCLE_DETECTED_FUNCTION_NAME]: {
    handler: async () => {
      throw new Error('Internal function - should not be called directly')
    },
  },

  [CALL_BUDGET_LOW_FUNCTION_NAME]: {
    handler: async () => {
      throw new Error('Internal function - should not be called directly')
    },
  },

  [MODERATION_REDUCED_FUNCTION_NAME]: {
    handler: async () => {
      throw new Error('Internal function - should not be called directly')
    },
  },

  [SETTLE_REQUIRED_FUNCTION_NAME]: {
    handler: async () => {
      throw new Error('Internal function - should not be called directly')
    },
  },
}

/**
 * Maps an OpenAI finish reason to our public CompleteReason type.
 *
 * @throws UnexpectedStateError if the finish reason is null or unrecognized
 */
export function mapFinishReasonToCompleteReason(
  finishReason:
    | CreateChatCompletionStreamFinishReason
    | CreateTextCompletionStreamFinishReason
): 'length' | 'stop' | 'activity' | 'abort' | 'error' | 'iteration' {
  switch (finishReason) {
    case 'stop':
      return 'stop'

    case 'length':
      return 'length'

    case 'error':
      return 'error'

    case 'functionCall':
    case 'toolCalls':
      return 'activity'

    case 'contentFilter':
      return 'error' // @note contentFilter is treated as an error from the API perspective

    case null:
      throw new UnexpectedStateError(
        'Unexpected null finish reason from OpenAI API'
      )

    default:
      assertUnreachable(finishReason)
  }
}

/**
 * Check if abort error.
 */
export function isAbortError(error: Error): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message.toLowerCase().includes('abort'))
  )
}

/**
 * Check if a thrown error is a fetch-layer timeout - either the headers-phase
 * guard (`withTimeout`) or the body-phase guard (`withBodyTimeout`). Keyed off
 * the name those wrappers set ({@link TIMEOUT_ERROR_NAME}), so it stays in sync
 * with `@/lib/fetch`.
 *
 * @note this is deliberately distinct from {@link isAbortError}: an AbortError
 * is the conversation's hard deadline firing and must never be retried, whereas
 * a TimeoutError means a *single* request stalled after every lower-level retry
 * was exhausted (fetch-layer header retries + the streaming layer's pre-token
 * body-stall retry). Such a stall is usually a transient gateway hiccup, so the
 * catch blocks below grant it one more iteration-bounded continuation rather
 * than killing the whole run.
 */
export function isFetchTimeoutError(error: Error): boolean {
  return error instanceof Error && error.name === TIMEOUT_ERROR_NAME
}

/**
 * Whether a thrown error is a transient provider failure that the round can
 * recover from by re-issuing the request.
 *
 * @note two shapes qualify, and they are the same class of problem:
 *
 * - a fetch TimeoutError - a single request stalled after every lower-level
 *   retry was exhausted;
 * - a retriable provider error - a 5xx from the gateway/upstream, after the
 *   adaptor's own short retry loop (3 attempts, sub-second backoff) gave up.
 *
 * Neither says anything is wrong with the request itself, so killing the run is
 * the wrong response - a task run in particular can afford to wait. Previously
 * only the timeout was recovered here and a 5xx fell straight through to the
 * re-throw below, which is how a transient AI Gateway 503 ("Service temporarily
 * unavailable") terminated whole task runs.
 *
 * Cost is bounded the same way the timeout path is: by the continuation budget,
 * the iteration limit, and the round-start deadline. A *persistent* 5xx (e.g. a
 * genuinely broken upstream) therefore still terminates the run, it just does so
 * after the budget is spent rather than immediately.
 */
export function isRecoverableProviderError(error: Error): boolean {
  return isFetchTimeoutError(error) || isRetriableError(error)
}

/**
 * Describes why a round is being re-issued, so the retry telemetry can still
 * distinguish a stall from an upstream 5xx.
 */
export function getRecoverableProviderErrorCause(
  error: Error
): 'timeout' | 'retriable' {
  return isFetchTimeoutError(error) ? 'timeout' : 'retriable'
}

/**
 * Detects if an error message is a token limit error from OpenAI. This is
 * necessary because it is not always possible to exactly calculate the max
 * tokens which makes us run into strange issues.
 */
export function detectTokenLimitError(errorMessage: string):
  | {
      isTokenLimitError: false
    }
  | {
      isTokenLimitError: true
      suggestedLimit: number
      matchedMaxTokens: number
      matchedUsedTokens: number
    } {
  debug(`detectTokenLimitError`, { errorMessage }).log(
    'openai.conv.detectTokenLimitError'
  )

  // @note detect openai token limit errors that suggest token reduction

  const tokenLimitPattern =
    /maximum context length is\s+(\d+)\s+tokens.*?your messages resulted in\s+(\d+)\s+tokens/i

  const match = errorMessage.match(tokenLimitPattern)

  if (match) {
    const matchedMaxTokens = parseInt(match[1], 10)
    const matchedUsedTokens = parseInt(match[2], 10)

    // @note suggest a token limit that's 85% of the maximum to provide buffer

    const suggestedLimit = Math.floor(matchedMaxTokens * 0.85)

    const result = {
      isTokenLimitError: true,
      suggestedLimit,
      matchedMaxTokens,
      matchedUsedTokens,
    }

    debug(`token limit result`, { result }).log(
      'openai.conv.detectTokenLimitError'
    )

    return result
  }

  return { isTokenLimitError: false }
}

/**
 * Shrinks a conversation in response to a provider content moderation
 * rejection. Such filters score the aggregate input, so retrying the identical
 * request is futile and a single offending message is rarely the sole cause -
 * the flagged content is often spread across many turns. We drop the oldest
 * half of the droppable window (everything except the system/backstory framing
 * and the final turn) so the conversation converges on a minimal, passable
 * context within a few continuations.
 *
 * The neutral notice content surfaced to the model where messages were dropped
 * during a moderation reduction. The wording intentionally contains no
 * moderation / safety vocabulary so it cannot itself raise the aggregate
 * content score that the reduction is trying to bring the request under.
 */
const MODERATION_REDUCED_NOTICE =
  'One or more messages could not be processed by the content filter and were removed. Use the remaining context to respond. If the most recent user request was the part that was removed, tell the user it could not be processed due to a content restriction and ask them to rephrase.'

/**
 * Returns true if the message is part of a synthetic moderation-reduction notice
 * (either half of the activity pair). Used to strip a previous notice before
 * reducing again so notices never accumulate across repeated retries.
 */
function isModerationReductionNotice(message: Message): boolean {
  return (
    message.type === ACTIVITY_MESSAGE_TYPE &&
    message.meta?.activity?.function?.name === MODERATION_REDUCED_FUNCTION_NAME
  )
}

/**
 * Shrinks a conversation in response to a provider content moderation rejection.
 *
 * The conversation is built incrementally and each previous request already
 * cleared the filter, so the content appended since - the newest messages - is
 * what tipped this request over. We therefore peel from the newest droppable
 * end. In an agentic loop the newest message is usually a freshly retrieved tool
 * result (untrusted external content); in a fresh request it is the user's own
 * question - either way the newest content is the most likely offender.
 *
 * Only the system/backstory framing is preserved (it defines the bot and cannot
 * be dropped). The current user turn is NOT specially protected: when it is the
 * newest message it is the prime suspect and is dropped like anything else, and
 * the notice then tells the model to let the user know their request could not be
 * processed. When the user turn is not the newest (a tool result follows it),
 * newest-first dropping removes that tool result first and leaves the question
 * alone, so it is protected naturally without a special rule.
 *
 * Whole messages are dropped, never parts of them, so the assistant tool-call /
 * tool-result pairs derived from each activity message stay balanced. The notice
 * is a synthetic `_moderationReduced` activity pair, matching the
 * `_emptyDetected` / `_cycleDetected` convention.
 *
 * @returns the reduced message list, or null when only framing remains (in which
 * case the caller should surface the moderation error).
 */
export function reduceMessagesForModeration(
  messages: Message[] | undefined
): Message[] | null {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null
  }

  // @note strip any notice left by a previous reduction so notices never
  // accumulate across repeated retries and never count toward the droppable set

  const sourceMessages = messages.filter(
    (message) => !isModerationReductionNotice(message)
  )

  const isFraming = (message: Message): boolean =>
    message.type === BACKSTORY_MESSAGE_TYPE ||
    message.type === TMP_BACKSTORY_MESSAGE_TYPE ||
    message.type === INSTRUCTION_MESSAGE_TYPE

  const droppableIndices = sourceMessages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => !isFraming(message))
    .map(({ index }) => index)

  if (droppableIndices.length === 0) {
    // @note only framing remains - nothing left to try
    return null
  }

  // @note remove the newest droppable half. Direction (newest-first) matters
  // most - it targets the content that tipped the request over; halving keeps
  // the round count bounded so the removal outweighs the inserted notice

  const dropCount = Math.max(1, Math.ceil(droppableIndices.length / 2))

  const dropIndices = new Set(droppableIndices.slice(-dropCount))

  const reduced: Message[] = []

  let noticeInserted = false

  for (let index = 0; index < sourceMessages.length; index++) {
    if (dropIndices.has(index)) {
      // @note insert the notice once, at the gap left by the dropped messages

      if (!noticeInserted) {
        reduced.push(
          ...makeActivityMessagePair(
            MODERATION_REDUCED_FUNCTION_NAME,
            {},
            { notice: MODERATION_REDUCED_NOTICE }
          )
        )

        noticeInserted = true
      }

      continue
    }

    reduced.push(sourceMessages[index])
  }

  return reduced
}

/**
 * This function appends additional activity messages to the list of messages
 * when the last response from the agent was empty. This is to prompt the model
 * to continue the response.
 */
export function addEmptyNotice(messages: Message[]): Message[] {
  return [
    ...messages,

    ...makeActivityMessagePair(
      EMPTY_DETECTED_FUNCTION_NAME,
      {},
      {
        solution: 'Please provide a response.',
      }
    ),
  ]
}

/**
 * Appends a settle nudge: the run is in settle mode and the model ended its
 * turn without calling a terminal tool, so we prompt it to keep going and
 * finish by calling `_success` / `_failure`.
 */
export function addSettleNotice(messages: Message[]): Message[] {
  return [
    ...messages,

    ...makeActivityMessagePair(
      SETTLE_REQUIRED_FUNCTION_NAME,
      {},
      {
        solution:
          'You ended your turn without finishing this run. Keep working and, once everything is complete, finish by calling the "_success" tool. If you hit an unrecoverable error, call the "_failure" tool instead. Do not stop until you have called one of these tools.',
      }
    ),
  ]
}

/**
 * This function appends additional activity messages to the list of messages
 * when cyclic behavior is detected. This is to prompt the model to try a
 * different approach.
 */
export function addCycleNotice(messages: Message[]): Message[] {
  return [
    ...messages,

    ...makeActivityMessagePair(
      CYCLE_DETECTED_FUNCTION_NAME,
      {},
      {
        warning:
          'You have been making repeated tool calls that keep returning the same results. Please try a different approach, change your parameters or search terms, or explain to the user why you cannot proceed.',
      }
    ),
  ]
}

/**
 * Appends an advisory activity pair warning the model that it is approaching the
 * maximum number of tool calls allowed for this request. Unlike the call-limit
 * *stop* (which only fires once the budget is already exhausted and ends the
 * run), this notice is injected while budget remains so the model can see the
 * limit coming, prioritise the most important remaining actions, and wrap up on
 * its own terms instead of being cut off mid-task.
 *
 * Mirrors addCycleNotice: the pair is model-facing context carried into the
 * next round only - it is not streamed to the user nor persisted.
 */
export function addCallBudgetLowNotice(
  messages: Message[],
  { remaining, maxCalls }: { remaining: number; maxCalls: number }
): Message[] {
  return [
    ...messages,

    ...makeActivityMessagePair(
      CALL_BUDGET_LOW_FUNCTION_NAME,
      {},
      {
        warning: `You are approaching the maximum number of tool calls for this request - about ${remaining} of ${maxCalls} remain. When the limit is reached this request is stopped automatically, even if the task is unfinished. Prioritise the most important remaining actions, avoid redundant or exploratory calls, and once you have enough information stop calling tools and give the user the best answer you can with what you have.`,
      }
    ),
  ]
}

/**
 * The remaining-call count at or below which the budget-low advisory fires for a
 * given budget: the smaller of the absolute cap and a ratio of the budget (see
 * CALL_BUDGET_LOW_RATIO / CALL_BUDGET_LOW_CAP for the rationale). Returns 0 for
 * budgets too small for the ratio to clear a single call, which - combined with
 * the `remaining > 0` guard in maybeAddCallBudgetLowNotice - means tiny budgets
 * are never warned.
 */
export function getCallBudgetLowThreshold(maxCalls: number): number {
  return Math.min(
    CALL_BUDGET_LOW_CAP,
    Math.floor(maxCalls * CALL_BUDGET_LOW_RATIO)
  )
}

/**
 * Injects the "approaching call limit" notice into the thread when the remaining
 * call budget has dropped into the warning band but is not yet exhausted. Fires
 * at most once per run (tracked on `callStats.budgetWarned`) so the reminder
 * stays visible via the carried-forward thread without bloating it on every
 * subsequent round. Returns the (possibly extended) messages.
 */
function maybeAddCallBudgetLowNotice(
  messages: Message[],
  callStats: { calls: number; budgetWarned?: boolean },
  maxCalls: number
): Message[] {
  if (callStats.budgetWarned) {
    return messages
  }

  const remaining = maxCalls - callStats.calls
  const threshold = getCallBudgetLowThreshold(maxCalls)

  // @note nothing to warn about when the budget is exhausted (the stop path
  // handles that) or when there is still more than the low band remaining
  if (remaining <= 0 || remaining > threshold) {
    return messages
  }

  callStats.budgetWarned = true

  return addCallBudgetLowNotice(messages, { remaining, maxCalls })
}

/**
 * True when a message is the advisory activity injected by
 * addCallBudgetLowNotice.
 */
function isCallBudgetLowActivity(message: Message): boolean {
  return (
    message.type === 'activity' &&
    (message as { meta?: { activity?: { function?: { name?: unknown } } } })
      .meta?.activity?.function?.name === CALL_BUDGET_LOW_FUNCTION_NAME
  )
}

/**
 * Returns the thread with any call-budget-low advisory removed. The advisory is
 * a one-off, model-facing nudge; it must be invisible to cycle detection,
 * otherwise its single insertion would break the consecutive-repetition pattern
 * the detector relies on and mask a genuine loop for a round.
 */
function withoutCallBudgetNotice(messages: Message[]): Message[] {
  if (!messages.some(isCallBudgetLowActivity)) {
    return messages
  }

  return messages.filter((message) => !isCallBudgetLowActivity(message))
}

/**
 * Produces a compact, size-bounded tail of the thread for attaching to a
 * stuck-run observation. It keeps the last `limit` messages and truncates each
 * field so the loop can be reconstructed in Sentry without shipping the whole
 * (potentially huge) thread or leaking unbounded payloads.
 */
function summarizeThreadTail(
  messages: Message[],
  { limit = 12, maxLength = 500 }: { limit?: number; maxLength?: number } = {}
): Array<Record<string, unknown>> {
  const truncate = (value: unknown): string => {
    let text: string

    try {
      text = typeof value === 'string' ? value : JSON.stringify(value)
    } catch {
      text = String(value)
    }

    return text.length > maxLength
      ? `${text.slice(0, maxLength)}…[+${text.length - maxLength} chars]`
      : text
  }

  return messages.slice(-limit).map((message) => {
    // @note meta shape varies across message types, so reach in defensively
    const fn = (
      message as {
        meta?: {
          activity?: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            function?: any
          }
        }
      }
    ).meta?.activity?.function

    return {
      type: message.type,
      ...(message.text ? { text: truncate(message.text) } : {}),
      ...(fn?.name ? { fn: fn.name } : {}),
      ...(fn?.arguments !== undefined ? { args: truncate(fn.arguments) } : {}),
      ...(fn?.result !== undefined ? { result: truncate(fn.result) } : {}),
    }
  })
}

/**
 * @note temp monitoring functions for cyclic behavior
 * @todo remove after monitoring period (added 2026-01-14)
 */
function observeThreadCycleMaxReached(
  location: 'function_call_path' | 'tool_calls_path',
  cycleStats: { detected: number },
  maxCycles: number,
  messages: Message[],
  modelName: string,
  heuristic: string | null
): void {
  const conversation = getContextConversation()

  void captureObservation(
    'thread cycle max reached',
    {
      event: 'thread_cycle_max_reached',
      location,
      cycleDetectionCount: cycleStats.detected,
      maxCycles,
      messageCount: messages.length,
      // @note which heuristic tripped and the offending tail - the "why" that
      // makes a stuck run actionable instead of just flagged
      heuristic,
      threadTail: summarizeThreadTail(messages),
      conversationId: conversation?.id,
      userId: conversation?.userId,
      botId: conversation?.botId,
      modelName,
      action: 'stopping_conversation',
    },
    { sentry: true, level: 'warning' }
  )
}

/**
 * @param {'function_call_path' | 'tool_calls_path'} location
 * @param {number} messageCount
 * @param {string} modelName
 */
function observeThreadCycleBroken(
  location: 'function_call_path' | 'tool_calls_path',
  messageCount: number,
  modelName: string
): void {
  const conversation = getContextConversation()

  void captureObservation('thread cycle broken', {
    event: 'thread_cycle_broken',
    location,
    messageCount,
    conversationId: conversation?.id,
    userId: conversation?.userId,
    botId: conversation?.botId,
    modelName,
    action: 'cycle_counter_reset',
  })
}

/**
 * @note temp monitoring for runaway in-message repetition
 * @todo monitoring extended 2026-06-16: now also logs the
 * window unique/hapax ratios so the false-positive rate can be measured from
 * production. Once enough trips are collected, decide whether to retune the gate
 * (currently 0.4) or move detection off a pure ratio, then remove this.
 */
function observeRunawayTextRun(
  location: 'text_completion_path' | 'chat_completion_path',
  bufferLength: number,
  modelName: string,
  detail: {
    reason: {
      phrase: string
      count: number
      text: string
      uniqueRatio: number
      hapaxRatio: number
    } | null
    sample: string
    messages: Message[]
  }
): void {
  const conversation = getContextConversation()

  void captureObservation(
    'runaway text run detected',
    {
      event: 'runaway_text_run_detected',
      location,
      bufferLength,
      // @note the phrase the model got stuck repeating, how many times it
      // recurred, and a sample of the offending buffer - the "why"
      repeatedPhrase: detail.reason?.phrase,
      // @note the phrase as the model actually wrote it (casing + punctuation);
      // the normalized `repeatedPhrase` above is for grouping, this is for eyes
      repeatedPhraseText: detail.reason?.text,
      repeatCount: detail.reason?.count,
      // @note the discriminators: a genuine loop is low on both; a wrongly
      // flagged progressing list runs higher. Logged so each trip self-triages
      // and the gate can be tuned from real data instead of a handful of samples
      windowUniqueRatio: detail.reason?.uniqueRatio,
      windowHapaxRatio: detail.reason?.hapaxRatio,
      textSample: detail.sample,
      threadTail: summarizeThreadTail(detail.messages),
      conversationId: conversation?.id,
      userId: conversation?.userId,
      botId: conversation?.botId,
      modelName,
      action: 'stopping_stream',
    },
    { sentry: true, level: 'warning' }
  )
}

function getLoopStopMessage(options: Pick<ConversationInput, 'background'>) {
  return options.background
    ? LOOP_STOP_BACKGROUND_MESSAGE
    : LOOP_STOP_USER_MESSAGE
}

/**
 * The stop message emitted when the in-message runaway guard fires. Unlike the
 * generic loop notice this names the phrase the model got stuck on, so the stop
 * is transparent to the user and actionable to the model on the next turn (it
 * can vary that phrase or wrap up) instead of a cryptic "stuck in a loop". Falls
 * back to the generic message when no phrase is available.
 *
 * @param {{ background?: boolean }} options
 * @param {{ text?: string } | null} reason the guard's `reason()` output
 */
function getRunawayStopMessage(
  options: Pick<ConversationInput, 'background'>,
  reason: { text?: string } | null
) {
  const phrase = reason?.text?.trim()

  if (!phrase) {
    return getLoopStopMessage(options)
  }

  return options.background
    ? `I noticed I kept repeating "${phrase}", so I stopped that line of output. Let me reframe and continue from what I have.`
    : `I noticed I kept repeating "${phrase}", so I stopped here to avoid looping. Please rephrase your request or add a little more detail and I'll try again.`
}

function getCallLimitStopMessage(
  options: Pick<ConversationInput, 'background'>
) {
  return options.background
    ? CALL_LIMIT_STOP_BACKGROUND_MESSAGE
    : CALL_LIMIT_STOP_USER_MESSAGE
}

/**
 * @note monitoring for conversations stopped by an exhausted call budget
 */
function observeCallLimitReached(
  location: 'function_call_path' | 'tool_calls_path',
  callStats: { calls: number },
  maxCalls: number,
  messages: Message[],
  modelName: string
): void {
  const conversation = getContextConversation()

  void captureObservation(
    'call limit max reached',
    {
      event: 'call_limit_max_reached',
      location,
      calls: callStats.calls,
      maxCalls,
      messageCount: messages.length,
      // @note the recent tool calls so it is clear what budget was burned on
      threadTail: summarizeThreadTail(messages),
      conversationId: conversation?.id,
      userId: conversation?.userId,
      botId: conversation?.botId,
      modelName,
      action: 'stopping_conversation',
    },
    { sentry: true, level: 'warning' }
  )
}

/**
 * @note monitoring for runs abandoned after an `error` finish reason exhausted
 * the retry/continuation budget - i.e. the provider kept failing the completion
 * across every retry. Previously this was a silent observation, so persistent
 * provider failures (and the unsettled trigger/task runs they caused) were
 * invisible. Opting in to Sentry makes them searchable.
 */
function observeErrorFinishReasonExhausted(
  location: 'chat_completion_path' | 'response_completion_path',
  modelName: string,
  detail: {
    currentIterations: number
    currentContinuations: number
    maxContinuations: number
    callStats: { calls: number }
  }
): void {
  const conversation = getContextConversation()

  void captureObservation(
    'error finish reason exhausted',
    {
      event: 'error_finish_reason_exhausted',
      location,
      currentIterations: detail.currentIterations,
      currentContinuations: detail.currentContinuations,
      maxContinuations: detail.maxContinuations,
      calls: detail.callStats.calls,
      conversationId: conversation?.id,
      userId: conversation?.userId,
      botId: conversation?.botId,
      modelName,
      action: 'stopping_conversation',
    },
    { sentry: true, level: 'warning' }
  )
}

/**
 * @note monitoring for turns abandoned because the model kept ending its turn
 * empty - a `stop` with neither answer text nor a tool call - until the (tight)
 * empty budget was spent. Previously the interactive empty-retry path exhausted
 * silently, so a turn that burned continuations producing nothing left no trace
 * (unlike the batch/settle equivalent, `settle_budget_exhausted`). Opting in to
 * Sentry makes these runaway-empty turns searchable.
 */
function observeEmptyExhausted(
  location:
    | 'chat_completion_path'
    | 'response_completion_path'
    | 'text_completion_path',
  modelName: string,
  detail: {
    empties: number
    maxEmpties: number
    currentContinuations: number
    currentIterations: number
  }
): void {
  const conversation = getContextConversation()

  void captureObservation(
    'empty budget exhausted without output',
    {
      event: 'empty_budget_exhausted',
      location,
      empties: detail.empties,
      maxEmpties: detail.maxEmpties,
      currentContinuations: detail.currentContinuations,
      currentIterations: detail.currentIterations,
      conversationId: conversation?.id,
      userId: conversation?.userId,
      botId: conversation?.botId,
      modelName,
      action: 'stopping_conversation',
    },
    { sentry: true, level: 'warning' }
  )
}

/**
 * @note monitoring for settle-mode runs that never settled: the model kept
 * ending its turn without calling a terminal tool (`_success` / `_failure`)
 * until the settle (or iteration) budget was spent. Opts in to Sentry so an
 * agent that never completes is visible rather than silently recorded as
 * `incomplete` by the caller.
 */
function observeSettleExhausted(
  location: 'chat_completion_path' | 'response_completion_path',
  modelName: string,
  detail: {
    nudges: number
    maxSettles: number
    currentIterations: number
  }
): void {
  const conversation = getContextConversation()

  void captureObservation(
    'settle budget exhausted without settlement',
    {
      event: 'settle_budget_exhausted',
      location,
      nudges: detail.nudges,
      maxSettles: detail.maxSettles,
      currentIterations: detail.currentIterations,
      conversationId: conversation?.id,
      userId: conversation?.userId,
      botId: conversation?.botId,
      modelName,
      action: 'stopping_conversation',
    },
    { sentry: true, level: 'warning' }
  )
}

/**
 * @note monitoring for runs ended by the provider's content filter. Unlike an
 * `error`, a content filter is a deterministic safety refusal - retrying the
 * same content just re-filters - so the run ends incomplete rather than being
 * retried. Opts in to Sentry at `info` (not `warning`) so a trigger/task dying
 * to a filter is visible and searchable without reading as an alert; filters can
 * be high-volume for some bots.
 */
function observeContentFilter(
  location:
    | 'text_completion_path'
    | 'chat_completion_path'
    | 'response_completion_path',
  modelName: string
): void {
  const conversation = getContextConversation()

  void captureObservation(
    'content filter reason detected',
    {
      event: 'content_filter_reason_detected',
      location,
      conversationId: conversation?.id,
      userId: conversation?.userId,
      botId: conversation?.botId,
      modelName,
      action: 'stopping_conversation',
    },
    { sentry: true, level: 'info' }
  )
}

/**
 *
 */
async function getAttachmentTempDownloadURL(name) {
  const conversation = getContextConversation()

  if (conversation) {
    return await getConversationAttachmentDownloadURL(conversation.id, name)
  }

  const namespace = getContextNamespace()

  if (namespace) {
    return await getNamespaceAttachmentTempDownloadURL(namespace, name)
  }

  throw new Error('No conversation or namespace found')
}

/**
 *
 */
function getAttachmentUploadActivityMessageDetails(message) {
  const conversation = getContextConversation()

  if (conversation) {
    return getConversationAttachmentUploadActivityMessageDetails(message)
  }

  const namespace = getContextNamespace()

  if (namespace) {
    return getNamespaceAttachmentUploadActivityMessageDetails(message)
  }

  // @note no need to throw because we do check for null
}

/**
 * Function names can get hallucinated by the model, so we need to make sure
 * that the function name is valid and does not contain any invalid
 * characters.
 */
export function getFunctionName(
  incomingName: string,
  functions?: ConversationFunction[]
): string {
  // if the function name exists in the list of functions then, return it as is
  {
    if (functions?.some(({ name }) => name === incomingName)) {
      return incomingName
    }
  }

  // if the function is not in the list
  {
    // if there is a single match then return it
    {
      const niceIncomingName = incomingName.trim().toLowerCase()

      // @note the match must sit on token boundaries - this rescues
      // namespaced hallucinations such as `functions.search` or `search()`
      // without misrouting names that merely contain a function name as a
      // substring (e.g. `research` must not resolve to `search`)

      const isBoundaryChar = (char: string | undefined) =>
        char === undefined || !/[a-z0-9]/.test(char)

      const matches = functions?.filter(({ name }) => {
        const niceName = name.trim().toLowerCase()

        if (!niceName) {
          return false
        }

        let index = niceIncomingName.indexOf(niceName)

        while (index >= 0) {
          if (
            isBoundaryChar(niceIncomingName[index - 1]) &&
            isBoundaryChar(niceIncomingName[index + niceName.length])
          ) {
            return true
          }

          index = niceIncomingName.indexOf(niceName, index + 1)
        }

        return false
      })

      if (matches?.length === 1) {
        return matches[0].name
      }
    }
  }

  // do best effort to sanitize the function name
  {
    return incomingName
      .replace(/\W+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_{2,}/g, '_')
  }
}

/**
 * This is a placeholder function that is used to get the function arguments.
 */
export function getFunctionArguments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  incomingArguments: any,
  functions?: ConversationFunction[]
): string {
  functions

  return incomingArguments
}

/**
 * Get the names for the message based on type and options.
 */
export function getMessageName(
  type: MessageType,
  options: GetNameOptions = {}
): string | undefined {
  debug(`getMessageName`, { type, options }).log('openai.conv.getMessageName')

  let name

  if (options?.withNames) {
    let typeToNameMap: Record<MessageType, string>

    if (typeof options.withNames === 'boolean') {
      typeToNameMap = {
        [USER_MESSAGE_TYPE]: 'user',
        [BOT_MESSAGE_TYPE]: 'assistant',
        [REASONING_MESSAGE_TYPE]: 'reasoning',
        [CONTEXT_MESSAGE_TYPE]: 'context',
        [INSTRUCTION_MESSAGE_TYPE]: 'instruction',
        [BACKSTORY_MESSAGE_TYPE]: 'backstory',
        [CHECKPOINT_MESSAGE_TYPE]: 'checkpoint',
        [ACTIVITY_MESSAGE_TYPE]: 'assistant',
      }
    } else {
      typeToNameMap = {
        [USER_MESSAGE_TYPE]: options.withNames.user,
        [BOT_MESSAGE_TYPE]: options.withNames.assistant,
        [REASONING_MESSAGE_TYPE]: options.withNames.reasoning,
        [CONTEXT_MESSAGE_TYPE]: options.withNames.context,
        [INSTRUCTION_MESSAGE_TYPE]: options.withNames.instruction,
        [BACKSTORY_MESSAGE_TYPE]: options.withNames.backstory,
        [CHECKPOINT_MESSAGE_TYPE]: options.withNames.checkpoint,
        [ACTIVITY_MESSAGE_TYPE]: options.withNames.activity,
      }
    }

    name = typeToNameMap[type]
  }

  return name
}

/**
 * Optimistic estimation of the tokens that a message will use.
 */
export async function estimateMessageUsage(message: Message): Promise<Usage> {
  debug(`estimateMessageUsage`, { message }).log(
    'openai.conv.estimateMessageUsage'
  )

  // @see https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb

  const tokensPerMessage = 4 // every message follows <|start|>{role/name}\n{content}<|end|>\n
  const tokensPerName = 1 // this should be -1 for some models but we are using 1 for now
  const tokensPerReply = 3 // every reply is primed with <|start|>assistant<|message|>

  let tokens = tokensPerMessage + tokensPerName + tokensPerReply

  // @todo we need to calculate the message name which is now just estimated
  {
    tokens += 2
  }

  switch (message.type) {
    case TMP_FUNCTIONS_MESSAGE_TYPE: {
      // @todo find a better way to estimate the tokens for the functions

      tokens += getTextTokensLength(
        message.text + tryStringifyJson(message.meta)
      )

      break
    }

    case TMP_BACKSTORY_MESSAGE_TYPE: {
      // @todo find a better way to estimate the tokens for the messages

      tokens += getTextTokensLength(message.text)

      break
    }

    case ACTIVITY_MESSAGE_TYPE: {
      // @todo find a better way to estimate the tokens for the activities

      tokens += getTextTokensLength(
        message.text + tryStringifyJson(message.meta)
      )

      // @todo calculate the usage of uploads

      break
    }

    default: {
      // @todo find a better way to estimate the tokens for the messages

      tokens += getTextTokensLength(message.text)
    }
  }

  return { tokens }
}

/**
 * This is a very optimistic message trimming function. It simply truncates the
 * message text to the maximum number of tokens. This is not a good strategy
 * because it can cut the message in the middle of a word. However, it is a
 * simple strategy that can be used to reduce the number of tokens in a message.
 */
export async function trimSingleMessage(
  message: MessageWithUsage,
  maxTokens: number
): Promise<MessageWithUsage | false> {
  debug(`trimMessage`, { message, maxTokens }).log('openai.conv.trimMessage')

  if (message.type === ACTIVITY_MESSAGE_TYPE) {
    debug(`skip trimming activity message`, { message }).log(
      'openai.conv.trimMessage.skipActivity'
    )

    // @note we cannot trim activity messages so our only other options is to
    // simply filter them out

    return false
  }

  if (message.type === BACKSTORY_MESSAGE_TYPE) {
    debug(`skip trimming backstory message`, { message }).log(
      'openai.conv.trimMessage.skipBackstory'
    )

    // @note backstory messages are not trimmed because they end up being used
    // as the system prompt, so we need to return them as they are

    return message
  }

  if (message.type === CHECKPOINT_MESSAGE_TYPE) {
    debug(`skip trimming checkpoint message`, { message }).log(
      'openai.conv.trimMessage.skipCheckpoint'
    )

    // @note checkpoint messages carry compaction summary context and must
    // survive token trimming as-is

    return message
  }

  if (message.type === TMP_BACKSTORY_MESSAGE_TYPE) {
    debug(`skip trimming tmp backstory message`, { message }).log(
      'openai.conv.trimMessage.skipTmpBackstory'
    )

    // @note this is for internal use only so we cannot trim it

    return message
  }

  if (message.type === TMP_CHECKPOINT_MESSAGE_TYPE) {
    debug(`skip trimming tmp checkpoint message`, { message }).log(
      'openai.conv.trimMessage.skipTmpCheckpoint'
    )

    // @note this is for internal use only so we cannot trim it

    return message
  }

  if (message.type === TMP_FUNCTIONS_MESSAGE_TYPE) {
    debug(`skip trimming tmp functions message`, { message }).log(
      'openai.conv.trimMessage.skipTmpFunctions'
    )

    // @note this is for internal use only, so we cannot trim it

    return message
  }

  message = clone(message)

  if (message.text) {
    message.text = slice(message.text, maxTokens)
  }

  message.usage.tokens = maxTokens

  return message
}

/**
 * This function gets a list of messages and organizes them into the correct
 * order with attention to activity messages because they need to be clustered
 * together.
 */
export function organizeMessages<T extends Message | MessageWithUsage>(
  messages: T[]
): T[] {
  debug(`organizeMessages`, { messages }).log('openai.conv.organizeMessages')

  let organizedMessages: T[] = []

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]

    switch (message.type) {
      case ACTIVITY_MESSAGE_TYPE: {
        // @note given that activities are structured as request/response pairs
        // we need to ensure that they are clustered together - this is done for
        // safety reasons as not all models will support if otherwise

        // @note activity messages that are not in pairs should be stripped out
        // as they are not useful for the model and may cause issues

        const type: unknown = message.meta?.activity?.type

        // @note validate activity type before processing - this can happen when
        // activity messages are fetched without the meta field

        if (
          type !== TRIGGER_ACTIVITY_TYPE &&
          type !== REQUEST_ACTIVITY_TYPE &&
          type !== RESPONSE_ACTIVITY_TYPE
        ) {
          void captureUnexpectedState(
            `Activity message has invalid or missing meta.activity.type`,
            {
              messageId: 'id' in message ? message.id : undefined,
              messageType: message.type,
              hasMeta: !!message.meta,
              hasActivity: !!message.meta?.activity,
              activityType: type,
            }
          )

          break
        }

        switch (type) {
          case TRIGGER_ACTIVITY_TYPE: {
            // @note trigger activity messages must be the last in the list - we
            // must ignore them if otherwise

            // @note the list of messages may include TMP_FUNCTIONS_MESSAGE_TYPE
            // and TMP_BACKSTORY_MESSAGE_TYPE messages, so we need to take that
            // into account

            const remainingMessages = messages
              .slice(i + 1)
              .filter(
                ({ type }) =>
                  ![
                    TMP_BACKSTORY_MESSAGE_TYPE,
                    TMP_CHECKPOINT_MESSAGE_TYPE,
                    TMP_FUNCTIONS_MESSAGE_TYPE,
                  ].includes(type)
              )

            if (remainingMessages.length === 0) {
              organizedMessages.push(message)
            } else {
              void captureUnexpectedState(
                `Trigger activity message is not the last in the list`
              )

              break
            }

            break
          }

          case REQUEST_ACTIVITY_TYPE: {
            // @note add request activity messages to the list as they are

            organizedMessages.push(message)

            break
          }

          case RESPONSE_ACTIVITY_TYPE: {
            // @note response activity messages must be clustered with their
            // corresponding request activity message

            const requestActivityMessageIndex = organizedMessages.findLastIndex(
              (m) => isPairedActivityMessage(m, message)
            )

            if (requestActivityMessageIndex >= 0) {
              // @note insert the response activity message after the
              // request activity message

              organizedMessages.splice(
                requestActivityMessageIndex + 1,
                0,
                message
              )

              break
            } else {
              // @note disabled because it is too noisy
              // @todo ensure we expect this state with more unit testing
              // void captureUnexpectedState(
              //   `Response activity message without a corresponding request activity message found`
              // )
            }

            break
          }

          default: {
            assertUnreachable(type)
          }
        }

        break
      }

      default: {
        organizedMessages.push(message)

        break
      }
    }
  }

  // @note we need to remove activity request messages that do not have a
  // corresponding response message
  {
    // @note the reason we don't have this logic in to optimizeMessages is
    // because we rely on the logic twice in there

    organizedMessages = organizedMessages.filter((message) => {
      if (message.type !== ACTIVITY_MESSAGE_TYPE) {
        return true
      }

      const type: unknown = message.meta?.activity?.type

      // @note we only want to keep request activity messages that have a
      // corresponding response message

      if (type === REQUEST_ACTIVITY_TYPE) {
        const responseActivityMessageIndex = organizedMessages.findIndex((m) =>
          isPairedActivityMessage(m, message)
        )

        if (responseActivityMessageIndex >= 0) {
          return true
        } else {
          // @note disabled because it is too noisy
          // @todo ensure we expect this state with more unit testing
          // void captureUnexpectedState(
          //   `Request activity message without a corresponding response activity message found`
          // )

          return false
        }
      }

      return true
    })
  }

  // @note we need to remove activity response messages that do not have a
  // corresponding request message
  {
    // @note the reason we don't have this logic in to optimizeMessages is
    // because we rely on the logic twice in there

    organizedMessages = organizedMessages.filter((message) => {
      if (message.type !== ACTIVITY_MESSAGE_TYPE) {
        return true
      }

      const type: unknown = message.meta?.activity?.type

      // @note we only want to keep response activity messages that have a
      // corresponding request message

      if (type === RESPONSE_ACTIVITY_TYPE) {
        const requestActivityMessageIndex = organizedMessages.findLastIndex(
          (m) => isPairedActivityMessage(m, message)
        )

        if (requestActivityMessageIndex >= 0) {
          return true
        } else {
          // @note disabled because it is too noisy
          // @todo ensure we expect this state with more unit testing
          // void captureUnexpectedState(
          //   `Response activity message without a corresponding request activity message found`
          // )

          return false
        }
      }

      return true
    })
  }

  return organizedMessages
}

/**
 * This function gets a list of messages and optional functions and optimizes
 * them to fit in a single request.
 */
export async function optimizeMessages(
  messages: Message[],
  functions: ConversationFunction[] | undefined,
  maxTokens: number,
  options: {
    model: string
    liveMessages?: () => Message[] | Promise<Message[]>
  }
): Promise<{ messages: MessageWithUsage[]; usage: Usage }> {
  debug(`optimizeMessages`, { messages, functions, maxTokens, options }).log(
    'openai.conv.optimizeMessages'
  )

  // @note pull and append any ephemeral, in-flight-only messages (e.g.
  // timeout-budget checkpoints) so they are surfaced to the model on this round
  // as the most recent context. The producer drains them, so they are injected
  // once and then carried forward by the caller - never re-inserted, never
  // persisted.
  if (typeof options.liveMessages === 'function') {
    const liveMessages = await options.liveMessages()

    if (liveMessages.length) {
      messages = [...messages, ...liveMessages]
    }
  }

  const span = createSpan({
    name: 'openai.optimizeMessages',
    op: 'ai.processing',
  })

  span.setAttribute('messageCount', messages.length)
  span.setAttribute('functionCount', functions?.length || 0)
  span.setAttribute('maxTokens', maxTokens)

  const startTime = Date.now()

  let newMessages: MessageWithUsage[] = []

  let newUsage: Usage

  try {
    // organize messages to ensure that messages of particular types are grouped
    // together

    messages = organizeMessages(messages)

    // ensure that maxTokens is a positive number and is not less than the system
    // default for minimum tokens

    maxTokens = Math.max(MIN_TOKENS, Math.abs(maxTokens))

    // start processing

    let hasBackstory = false
    let hasCheckpoint = false

    // find the last message with type backstory and put it at the end of the list
    {
      const index = messages.findLastIndex(
        ({ type }) => type === BACKSTORY_MESSAGE_TYPE
      )

      if (index >= 0) {
        hasBackstory = true

        // take the message

        const backstoryMessage = messages.splice(index, 1)[0]

        // remove any other BACKSTORY_MESSAGE_TYPE messages as a good measure

        messages = messages.filter(
          ({ type }) => type !== BACKSTORY_MESSAGE_TYPE
        )

        // add the message to the end of the list

        messages.push({
          ...backstoryMessage,

          type: TMP_BACKSTORY_MESSAGE_TYPE,
        })
      }
    }

    // find the last message with type checkpoint and put it at the end of the
    // list
    {
      const index = messages.findLastIndex(
        ({ type }) => type === CHECKPOINT_MESSAGE_TYPE
      )

      if (index >= 0) {
        hasCheckpoint = true

        const checkpointMessage = messages.splice(index, 1)[0]

        messages = messages.filter(
          ({ type }) => type !== CHECKPOINT_MESSAGE_TYPE
        )

        messages.push({
          ...checkpointMessage,

          type: TMP_CHECKPOINT_MESSAGE_TYPE,
        })
      }
    }

    // slice the messages to take into account interactionMaxMessages
    {
      const { config: modelConfig } = parseAndRevealLanguageModel(options.model)

      let take = modelConfig.interactionMaxMessages || Infinity

      if (hasBackstory) {
        take += 1
      }

      if (hasCheckpoint) {
        take += 1
      }

      messages = messages.slice(-take)
    }

    // if there are any functions we need to add them to the list of messages
    {
      if (functions?.length) {
        messages.push({
          type: TMP_FUNCTIONS_MESSAGE_TYPE,
          text: '',
          meta: functions,
        })
      }
    }

    // build the thread
    {
      let minMessages = 1

      if (hasBackstory) {
        minMessages += 1
      }

      if (hasCheckpoint) {
        minMessages += 1
      }

      if (functions?.length) {
        minMessages += 1
      }

      const buildThreadSpan = createSpan({
        name: 'thread.build',
        op: 'ai.processing',
      })

      buildThreadSpan.setAttribute('messageCount', messages.length)
      buildThreadSpan.setAttribute('maxTokens', maxTokens)

      const buildThreadStartTime = Date.now()
      let buildThreadDuration = 0
      let result

      try {
        result = await buildThread({
          messages: messages,
          tokenEstimationFunction: estimateMessageUsage,
          maxTokens: maxTokens,
          minMessages: minMessages,
          inclusive: trimSingleMessage,
        })
      } finally {
        buildThreadDuration = Date.now() - buildThreadStartTime
        buildThreadSpan.finish()
      }

      if (buildThreadDuration > 3000) {
        debug(`slow buildThread`, {
          duration: buildThreadDuration,
          messageCount: messages.length,
        }).log('openai.conv.optimizeMessages.slowBuildThread')
      }

      // @note we need to run this function again in order to ensure any messages
      // that did not fit in the thread are properly organized and trimmed

      newMessages = organizeMessages(result.messages)
      newUsage = result.usage
    }

    // remove the TMP_FUNCTIONS_MESSAGE_TYPE messages
    {
      newMessages = newMessages.filter(
        ({ type }) => type !== TMP_FUNCTIONS_MESSAGE_TYPE
      )
    }

    // move the backstory message to the beginning of the list
    {
      const index = newMessages.findLastIndex(
        ({ type }) => type === TMP_BACKSTORY_MESSAGE_TYPE
      )

      if (index >= 0) {
        const message = newMessages.splice(index, 1)[0]

        newMessages.unshift({
          ...message,

          type: BACKSTORY_MESSAGE_TYPE,
        })
      }
    }

    // move the checkpoint message right after the backstory message if present,
    // otherwise to the beginning of the list
    {
      const index = newMessages.findLastIndex(
        ({ type }) => type === TMP_CHECKPOINT_MESSAGE_TYPE
      )

      if (index >= 0) {
        const message = newMessages.splice(index, 1)[0]
        const backstoryIndex = newMessages.findIndex(
          ({ type }) => type === BACKSTORY_MESSAGE_TYPE
        )

        newMessages.splice(backstoryIndex + 1, 0, {
          ...message,

          type: CHECKPOINT_MESSAGE_TYPE,
        })
      }
    }

    // remove the TMP_BACKSTORY_MESSAGE_TYPE messages
    {
      newMessages = newMessages.filter(
        ({ type }) => type !== TMP_BACKSTORY_MESSAGE_TYPE
      )
    }

    // remove the TMP_CHECKPOINT_MESSAGE_TYPE messages
    {
      newMessages = newMessages.filter(
        ({ type }) => type !== TMP_CHECKPOINT_MESSAGE_TYPE
      )
    }

    // remove empty messages
    {
      // @todo should we remove empty messages, if not explain why
    }

    // return the optimized messages

    debug(`done`, { newMessages, newUsage }).log('openai.conv.optimizeMessages')

    const duration = Date.now() - startTime

    // Log slow message optimization (over 5 seconds)
    if (duration > 5000) {
      debug(`slow message optimization`, {
        duration,
        inputMessageCount: messages.length,
        outputMessageCount: newMessages.length,
      }).log('openai.conv.optimizeMessages.slow')

      await captureObservation('Slow message optimization', {
        duration,
        inputMessageCount: messages.length,
        outputMessageCount: newMessages.length,
        maxTokens,
      })
    }

    return { messages: newMessages, usage: newUsage }
  } finally {
    span.setAttribute('outputMessageCount', newMessages?.length || 0)
    span.finish()
  }
}

/**
 * This function converts a list of messages to a list of OpenAI messages. While
 * the function can be inlined this is a separate function to make it easier to
 * test.
 */
export async function convertMessages(
  messages: Message[],
  model: string,
  options?: {} & GetNameOptions
): Promise<ProviderMessage[]> {
  debug(`convertMessages`, { messages, model, options }).log(
    'openai.conv.convertMessages'
  )

  const span = createSpan({
    name: 'openai.convertMessages',
    op: 'ai.processing',
  })

  span.setAttribute('messageCount', messages.length)
  span.setAttribute('model', model)

  const startTime = Date.now()

  const newMessages: ProviderMessage[] = []

  try {
    let toolId: number = 0

    // @note carries the thought signature captured on a request activity to its
    // paired response activity (they are always adjacent after organizeMessages).
    // A signature only exists in storage because a provider returned one, so its
    // presence is the signal to replay it - no provider sniffing needed.
    let pendingThoughtSignature: string | undefined

    // @note tracks the assistant message just emitted for a reasoning record so
    // a tool call that immediately follows it can reclaim it: popReasoningMessage
    // removes it from the output again and hands the text back to be replayed as
    // `reasoning_content` on the tool-call message itself, which is where some
    // OpenAI-compatible providers expect it. Only valid while it is still the
    // last entry in newMessages, hence the identity check below.
    let lastReasoningMessage: ProviderMessage | null = null

    const popReasoningMessage = () => {
      const message = newMessages[newMessages.length - 1]

      if (
        message !== lastReasoningMessage ||
        message.role !== 'assistant' ||
        typeof message.content !== 'string'
      ) {
        return null
      }

      newMessages.pop()
      lastReasoningMessage = null

      return message.content
    }

    const pushReasoningMessage = () => {
      lastReasoningMessage = newMessages[newMessages.length - 1]
    }

    for (const { type, text: _text, name, meta } of messages) {
      let text = _text

      // @note a message cannot exceed 65,533 bytes in length, according to the
      // OpenAI API documentation, so we need to slice it to that length max
      {
        // @todo check if this is true for all models and make it configurable

        text = byteSlice(text, 0, 65_500) // @note rounded down to 65,500 to account for different encoding algorithms
      }

      switch (type) {
        case TMP_FUNCTIONS_MESSAGE_TYPE: {
          await captureUnexpectedState(
            `Unexpected TMP_FUNCTIONS_MESSAGE_TYPE found`
          )

          break
        }

        case TMP_BACKSTORY_MESSAGE_TYPE: {
          await captureUnexpectedState(
            `Unexpected TMP_BACKSTORY_MESSAGE_TYPE found`
          )

          break
        }

        case TMP_CHECKPOINT_MESSAGE_TYPE: {
          await captureUnexpectedState(
            `Unexpected TMP_CHECKPOINT_MESSAGE_TYPE found`
          )

          break
        }

        case USER_MESSAGE_TYPE: {
          newMessages.push({
            role: 'user',

            content: text,

            name: name || getMessageName(type, options),
          })

          break
        }

        case BOT_MESSAGE_TYPE: {
          newMessages.push({
            role: 'assistant',

            content: text,

            name: name || getMessageName(type, options),
          })

          break
        }

        case REASONING_MESSAGE_TYPE: {
          newMessages.push({
            role: 'assistant',

            content: text,

            name: name || getMessageName(type, options),
          })

          pushReasoningMessage()

          break
        }

        case CONTEXT_MESSAGE_TYPE: {
          // @note Context is mostly used for providing additional information,
          // such as search results. In the case of ChatGPT this information comes
          // from the user prompt. This is why we are also using the user role
          // here. The assumption is that the user prompt is the context.

          newMessages.push({
            role: 'user',

            content: text,

            name: name || getMessageName(type, options),
          })

          break
        }

        case INSTRUCTION_MESSAGE_TYPE: {
          // @note Instructions are used to provide additional information to the
          // to the model on behalf of the user. This is why we are using the user
          // role here. The assumption is that the user is providing the
          // instructions.

          newMessages.push({
            role: 'user',

            content: text,

            name: name || getMessageName(type, options),
          })

          break
        }

        case BACKSTORY_MESSAGE_TYPE: {
          // @note The backstory is the equivalent of the system message.

          newMessages.push({
            role: 'system',

            content: text,

            name: name || getMessageName(type, options),
          })

          break
        }

        case CHECKPOINT_MESSAGE_TYPE: {
          // @note convert checkpoint summary to a synthetic tool-call pair so
          // it follows the same structure as activity response messages

          const id = getRandomId(`t${toolId++}`).slice(0, 9)

          const reasoning = popReasoningMessage()

          newMessages.push({
            role: 'assistant',

            name: name || getMessageName('bot', options),

            // @note Some OpenAI-compatible providers expect reasoning to be
            // replayed on the assistant tool-call message itself.

            ...(reasoning ? { reasoning_content: reasoning } : null),

            tool_calls: [
              {
                id: id,
                type: 'function',
                function: {
                  name: CHECKPOINT_FUNCTION_NAME,
                  arguments: '{}',
                },
              },
            ],
          })

          newMessages.push({
            role: 'tool',
            content: text || '',
            tool_call_id: id,
          })

          break
        }

        case ACTIVITY_MESSAGE_TYPE: {
          // @note The activity message is used to represent a function call or a
          // tool call. It is a complex message that could represent both.

          const activityMeta: Partial<ActivityMessage['meta']> = meta || {}

          const { activity } = activityMeta

          const { type, function: _function } = activity || {}

          switch (type) {
            case RESPONSE_ACTIVITY_TYPE: {
              // @note Response activity messages are converted to function calls
              // and tool calls.

              const {
                name: functionName,
                arguments: functionArguments,
                result: functionResult,
              } = _function || {}

              // @note we are only interested in the activity response messages
              // here therefore we look for the name and the result to be present

              if (functionName && functionResult) {
                // @note not sure why but it causes mistral to fail if it is
                // longer than 9 characters and contains anything but alphanumeric
                // characters, thus we are slicing it to 9 characters only

                // @todo make the id sequential to avoid conflicts

                const id = getRandomId(`t${toolId++}`).slice(0, 9)

                const reasoning = popReasoningMessage()

                // @note replay the provider thought signature captured on the
                // paired request activity. Providers that never issue one have
                // nothing stored here, and providers that ignore the field are
                // unaffected by it.
                const replayThoughtSignature = pendingThoughtSignature

                pendingThoughtSignature = undefined

                newMessages.push({
                  role: 'assistant',

                  name: name || getMessageName('bot', options),

                  // @note Some OpenAI-compatible providers expect reasoning to
                  // be replayed on the assistant tool-call message itself.

                  ...(reasoning ? { reasoning_content: reasoning } : null),

                  // @note Cloudflare's OpenAI-compat endpoint rejects a tool-call
                  // message carrying a thought signature unless a `content` field
                  // is present (null is accepted, an absent key is not).
                  ...(replayThoughtSignature ? { content: null } : null),

                  tool_calls: [
                    {
                      id: id,
                      type: 'function',
                      function: {
                        name: functionName,

                        // @todo this looks a bit flaky and I think we need some
                        // more research and testing to make sure it is correct

                        // @note sliced to honor the same per-message byte cap
                        // applied to message text above - oversized payloads
                        // would otherwise poison every subsequent request

                        arguments: byteSlice(
                          typeof functionArguments === 'string'
                            ? functionArguments
                            : // @todo maybe filter properties that begin with _
                              tryStringifyJson(functionArguments),
                          0,
                          65_500
                        ),
                      },

                      // @note replayed verbatim, in the same extra_content shape
                      // the provider returned it on the tool call
                      ...(replayThoughtSignature
                        ? {
                            extra_content: {
                              google: {
                                thought_signature: replayThoughtSignature,
                              },
                            },
                          }
                        : null),
                    },
                  ],
                } as ProviderMessage)

                newMessages.push({
                  role: 'tool',

                  // @todo this looks a bit flaky and I think we need some more
                  // research and testing to make sure it is correct

                  // @note sliced to honor the same per-message byte cap applied
                  // to message text above - oversized payloads would otherwise
                  // poison every subsequent request

                  content: byteSlice(
                    typeof functionResult === 'string'
                      ? functionResult
                      : // @todo maybe filter properties that begin with _
                        tryStringifyJson(functionResult),
                    0,
                    65_500
                  ),

                  tool_call_id: id,
                })
              }

              break
            }

            case REQUEST_ACTIVITY_TYPE: {
              // @note stash the thought signature captured on this request
              // activity so the paired response branch (emitted next) can
              // replay it on the reconstructed assistant tool-call message
              pendingThoughtSignature = (
                _function as ActivityFunctionWithThoughtSignature | undefined
              )?.thoughtSignature

              // @note Special activity messages may get convert to image or file
              // input messages depending on the model

              // @todo DEAD BRANCH: `details` is always null here, so no native
              // vision/file content part is ever emitted.
              // getAttachmentUploadActivityMessageDetails only returns details
              // for a RESPONSE-typed upload activity (the response half of the
              // uploadAttachment pair carries the {id,name,type} result), but
              // this is the REQUEST branch. Net effect: image/file attachments
              // reach the model only as the uploadAttachment tool-result URL
              // (text), never as image_url / input_file content parts - i.e.
              // native vision/file input is effectively unwired for
              // conversations. Fix: detect the uploadAttachment on the RESPONSE
              // branch and emit the content part there when
              // modelHasImageInputEnabled / modelHasFileInputEnabled.

              const details = getAttachmentUploadActivityMessageDetails({
                meta: meta || {},
              })

              if (details) {
                const { type, name } = details

                if (false) {
                  // pass
                } else if (/image\/(?:jpg|jpeg|png|webp)/.test(type)) {
                  // @todo detect if the format is supported by the model

                  if (modelHasImageInputEnabled(model)) {
                    const attachmentUrl =
                      await getAttachmentTempDownloadURL(name)

                    newMessages.push({
                      role: 'user',

                      content: [
                        {
                          type: 'image_url',
                          image_url: {
                            url: attachmentUrl,
                          },
                        },
                      ],
                    })
                  } else {
                    // pass
                  }
                } else if (/audio\//.test(type)) {
                  // @todo detect if the format is supported by the model

                  if (modelHasAudioInputEnabled(model)) {
                    // pass
                  } else {
                    // pass
                  }
                } else if (/video\//.test(type)) {
                  // @todo detect if the format is supported by the model

                  if (modelHasVideoInputEnabled(model)) {
                    // pass
                  } else {
                    // pass
                  }
                } else {
                  if (modelHasFileInputEnabled(model)) {
                    const fileAttachmentSpan = createSpan({
                      name: 'attachment.fetchAndEncode',
                      op: 'http.client',
                    })

                    fileAttachmentSpan.setAttribute('filename', name)

                    const fileAttachmentStartTime = Date.now()
                    let fileAttachmentDuration = 0

                    try {
                      const attachmentUrl =
                        await getAttachmentTempDownloadURL(name)

                      const response = await fetch(attachmentUrl)

                      if (!response.ok) {
                        // pass
                      } else {
                        const fileDataUrl = await responseToDataUrl(response)

                        newMessages.push({
                          role: 'user',

                          content: [
                            {
                              type: 'file',
                              file: {
                                filename: name,
                                file_data: fileDataUrl,
                              },
                            },
                          ],
                        })
                      }
                    } finally {
                      fileAttachmentDuration =
                        Date.now() - fileAttachmentStartTime
                      fileAttachmentSpan.finish()
                    }

                    if (fileAttachmentDuration > 2000) {
                      debug(`slow attachment fetch and encode`, {
                        filename: name,
                        duration: fileAttachmentDuration,
                      }).log('openai.conv.convertMessages.slowAttachmentFetch')
                    }
                  } else {
                    // pass
                  }
                }
              }

              break
            }
          }

          break
        }
      }
    }

    // @note some messages may contains attachment urls which we need to replace
    // with the actual urls
    {
      for (const message of newMessages) {
        // @note for simplicity reasons we only support string content for now as
        // the assumption is that this is what we doing above in the previous step

        if (typeof message.content === 'string') {
          const attachmentUrls = Array.from(
            new Set(
              Array.from(
                message.content.matchAll(
                  /attachment:\/\/(.+?)(\s|"|\)|$)/g // @note pretty naive regex but it works for now
                )
              ).map((match) => `attachment://${match[1]}`)
            )
          )

          if (attachmentUrls.length) {
            const attachmentSpan = createSpan({
              name: 'attachment.download',
              op: 'http.client',
            })

            attachmentSpan.setAttribute(
              'attachmentCount',
              attachmentUrls.length
            )

            const attachmentStartTime = Date.now()
            let attachmentDuration = 0

            const attachmentUrlMap: Record<string, string> = {}

            try {
              await Promise.all(
                attachmentUrls.map(async (attachmentUrl) => {
                  const name = attachmentUrl
                    .replace(/^attachment:\/\//, '')
                    .trim()

                  const tempDownloadURL =
                    await getAttachmentTempDownloadURL(name)

                  attachmentUrlMap[attachmentUrl] = tempDownloadURL
                })
              )
            } finally {
              attachmentDuration = Date.now() - attachmentStartTime
              attachmentSpan.finish()
            }

            if (attachmentDuration > 2000) {
              debug(`slow attachment downloads`, {
                duration: attachmentDuration,
                count: attachmentUrls.length,
              }).log('openai.conv.convertMessages.slowAttachments')
            }

            for (const [attachmentUrl, tempDownloadURL] of Object.entries(
              attachmentUrlMap
            )) {
              // @note this is a naive string replacement and it will not work if
              // there are any encoding issues but for now we don't have such
              // issues so we are using it

              message.content = message.content.replaceAll(
                attachmentUrl,
                tempDownloadURL
              )
            }
          }
        }
      }
    }

    // @todo perhaps optimize to keep the number of images to a minimum
    // @todo maybe combined contingent messages into a single message

    debug(`done`, { newMessages }).log('openai.conv.convertMessages')

    const duration = Date.now() - startTime

    // Log slow message conversion (over 3 seconds)
    if (duration > 3000) {
      debug(`slow message conversion`, {
        duration,
        messageCount: messages.length,
      }).log('openai.conv.convertMessages.slow')

      await captureObservation('Slow message conversion', {
        duration,
        messageCount: messages.length,
        model,
      })
    }

    return newMessages
  } finally {
    span.setAttribute('outputMessageCount', newMessages.length)
    span.finish()
  }
}

/**
 * Calculates the maximum input and output tokens for a given model.
 */
export function calculateMaxTokens(
  modelName: string,
  maxTokens: number,
  messages: Message[]
): { inputTokens: number; totalTokens: number } {
  debug(`calculateMaxTokens`, { modelName, maxTokens, messages }).log(
    'openai.conv.calculateMaxTokens'
  )

  // @note for OpenAI the max tokens is the maximum number of tokens for the
  // completion only, but this value plus the prompt should not exceed the
  // maximum tokens for the model

  // @note for us the max tokens caps the INPUT budget only - the amount of
  // prompt we are willing to send. We do this because output length is
  // decided by the model and cannot be predicted, so splitting a combined
  // budget between input and output risks starving the completion (e.g. a
  // near-full prompt would leave only a handful of tokens for the response).
  // The output is therefore allowed to use the model's full maxOutputTokens.
  // The exception is the legacy text completion path which must pass an
  // explicit max_tokens to the API - see completeTextConversationStream.

  const modelConfig = languageModels[modelName] || languageModels.custom

  // @note clamp the user-provided maxTokens to [MIN_TOKENS, maxInputTokens].
  // maxInputTokens is the only meaningful ceiling because this value is used
  // exclusively as an input budget - the output is handled separately below.

  const inputTokens = Math.min(
    Math.max(MIN_TOKENS, Math.abs(maxTokens)),
    modelConfig.maxInputTokens
  )

  // @note the output always gets the model's full maxOutputTokens - see the
  // note above for why

  const totalTokens = modelConfig.maxOutputTokens

  // @note config invariant: input + output must fit inside the model's total
  // context window

  assert(
    inputTokens + totalTokens <= modelConfig.maxTokens,
    `input tokens + total tokens exceed model's max tokens limit`
  )

  return {
    inputTokens,
    totalTokens,
  }
}

/**
 * The payload shape consumed by the OpenAI Responses API: a separate top-level
 * `instructions` string (the system framing) plus an ordered list of `input`
 * items (user / assistant turns, plus function_call / function_call_output
 * items for tool round-trips).
 *
 * @note this is the Responses-API analogue of the ProviderMessage[] that
 * convertMessages produces for the chat completions API. The two differ because
 * the Responses API models the system prompt and tool round-trips as distinct
 * item kinds rather than role-tagged messages.
 */
export interface ResponseConversationInput {
  instructions?: string
  input: ResponseInput
}

/**
 * Converts our internal message list into the OpenAI Responses API input shape.
 * This is the Responses-API counterpart of convertMessages:
 *
 * - backstory / system framing becomes the top-level `instructions` string
 * - user / context / instruction turns become `user` input message items
 * - bot turns become `assistant` input message items
 * - activity (tool) request/response pairs and checkpoints become
 *   `function_call` / `function_call_output` items with a shared `call_id`
 * - attachments become `input_image` / `input_file` content parts
 *
 * @note reasoning messages are replayed as plain `assistant` message items.
 * True reasoning-item fidelity (encrypted_content carried across tool turns) is
 * deferred - see completeResponseConversationStream.
 */
export async function convertMessagesToResponseInput(
  messages: Message[],
  model: string,
  options?: {} & GetNameOptions
): Promise<ResponseConversationInput> {
  debug(`convertMessagesToResponseInput`, { messages, model, options }).log(
    'openai.conv.convertMessagesToResponseInput'
  )

  const span = createSpan({
    name: 'openai.convertMessagesToResponseInput',
    op: 'ai.processing',
  })

  span.setAttribute('messageCount', messages.length)
  span.setAttribute('model', model)

  const input: ResponseInput = []

  // @note the Responses API takes the system framing as a separate top-level
  // `instructions` string rather than as a message, so backstory text is
  // accumulated here instead of being pushed into `input`

  const instructionParts: string[] = []

  try {
    let toolId = 0

    for (const { type, text: _text, meta } of messages) {
      // @note honor the same per-message byte cap convertMessages applies
      const text = byteSlice(_text, 0, 65_500)

      switch (type) {
        case TMP_FUNCTIONS_MESSAGE_TYPE: {
          await captureUnexpectedState(
            `Unexpected TMP_FUNCTIONS_MESSAGE_TYPE found`
          )

          break
        }

        case TMP_BACKSTORY_MESSAGE_TYPE: {
          await captureUnexpectedState(
            `Unexpected TMP_BACKSTORY_MESSAGE_TYPE found`
          )

          break
        }

        case TMP_CHECKPOINT_MESSAGE_TYPE: {
          await captureUnexpectedState(
            `Unexpected TMP_CHECKPOINT_MESSAGE_TYPE found`
          )

          break
        }

        case BACKSTORY_MESSAGE_TYPE: {
          if (text) {
            instructionParts.push(text)
          }

          break
        }

        case USER_MESSAGE_TYPE:
        case CONTEXT_MESSAGE_TYPE:
        case INSTRUCTION_MESSAGE_TYPE: {
          // @note context and instruction are provided on behalf of the user,
          // matching convertMessages

          input.push({ role: 'user', content: text })

          break
        }

        case BOT_MESSAGE_TYPE:
        case REASONING_MESSAGE_TYPE: {
          // @note reasoning is replayed as a plain assistant message. True
          // reasoning-item fidelity (encrypted_content carried across tool
          // turns) is deferred - see completeResponseConversationStream.

          input.push({ role: 'assistant', content: text })

          break
        }

        case CHECKPOINT_MESSAGE_TYPE: {
          // @note model the checkpoint summary as a synthetic function call /
          // output pair, mirroring how convertMessages represents it for chat

          const callId = getRandomId(`fc${toolId++}`)

          input.push({
            type: 'function_call',
            call_id: callId,
            name: CHECKPOINT_FUNCTION_NAME,
            arguments: '{}',
          })

          input.push({
            type: 'function_call_output',
            call_id: callId,
            output: text || '',
          })

          break
        }

        case ACTIVITY_MESSAGE_TYPE: {
          const activityMeta: Partial<ActivityMessage['meta']> = meta || {}

          const { activity } = activityMeta

          const { type: activityType, function: _function } = activity || {}

          switch (activityType) {
            case RESPONSE_ACTIVITY_TYPE: {
              const {
                name: functionName,
                arguments: functionArguments,
                result: functionResult,
              } = _function || {}

              // @note we only emit a tool round-trip when both the name and the
              // result are present, matching convertMessages

              if (functionName && functionResult) {
                const callId = getRandomId(`fc${toolId++}`)

                input.push({
                  type: 'function_call',
                  call_id: callId,
                  name: functionName,

                  // @note sliced to honor the same per-message byte cap applied
                  // to message text above

                  arguments: byteSlice(
                    typeof functionArguments === 'string'
                      ? functionArguments
                      : tryStringifyJson(functionArguments),
                    0,
                    65_500
                  ),
                })

                input.push({
                  type: 'function_call_output',
                  call_id: callId,

                  output: byteSlice(
                    typeof functionResult === 'string'
                      ? functionResult
                      : tryStringifyJson(functionResult),
                    0,
                    65_500
                  ),
                })
              }

              break
            }

            case REQUEST_ACTIVITY_TYPE: {
              // @note request activity messages may carry an attachment that
              // becomes an image or file content part depending on the model

              // @todo DEAD BRANCH: same bug as convertMessages - `details` is
              // always null because the upload detail extractor only matches a
              // RESPONSE-typed activity, not this REQUEST branch, so input_image
              // / input_file parts are never emitted. See the @todo in
              // convertMessages for the full explanation and fix.

              const details = getAttachmentUploadActivityMessageDetails({
                meta: meta || {},
              })

              if (details) {
                const { type: attachmentType, name } = details

                if (/image\/(?:jpg|jpeg|png|webp)/.test(attachmentType)) {
                  if (modelHasImageInputEnabled(model)) {
                    const attachmentUrl =
                      await getAttachmentTempDownloadURL(name)

                    input.push({
                      role: 'user',
                      content: [
                        {
                          type: 'input_image',
                          detail: 'auto',
                          image_url: attachmentUrl,
                        },
                      ],
                    })
                  }
                } else if (/audio\//.test(attachmentType)) {
                  // pass - audio input is not supported on this path yet
                } else if (/video\//.test(attachmentType)) {
                  // pass - video input is not supported on this path yet
                } else {
                  if (modelHasFileInputEnabled(model)) {
                    const attachmentUrl =
                      await getAttachmentTempDownloadURL(name)

                    const response = await fetch(attachmentUrl)

                    if (response.ok) {
                      const fileDataUrl = await responseToDataUrl(response)

                      input.push({
                        role: 'user',
                        content: [
                          {
                            type: 'input_file',
                            filename: name,
                            file_data: fileDataUrl,
                          },
                        ],
                      })
                    }
                  }
                }
              }

              break
            }
          }

          break
        }
      }
    }

    // @note replace attachment:// placeholders with their temporary URLs, the
    // same post-processing convertMessages applies to string message content

    {
      for (const item of input) {
        if (!('content' in item) || typeof item.content !== 'string') {
          continue
        }

        const content = item.content

        const attachmentUrls = Array.from(
          new Set(
            Array.from(
              content.matchAll(/attachment:\/\/(.+?)(\s|"|\)|$)/g)
            ).map((match) => `attachment://${match[1]}`)
          )
        )

        if (!attachmentUrls.length) {
          continue
        }

        const attachmentUrlMap: Record<string, string> = {}

        await Promise.all(
          attachmentUrls.map(async (attachmentUrl) => {
            const name = attachmentUrl.replace(/^attachment:\/\//, '').trim()

            attachmentUrlMap[attachmentUrl] =
              await getAttachmentTempDownloadURL(name)
          })
        )

        let replaced = content

        for (const [attachmentUrl, tempDownloadURL] of Object.entries(
          attachmentUrlMap
        )) {
          replaced = replaced.replaceAll(attachmentUrl, tempDownloadURL)
        }

        item.content = replaced
      }
    }

    const instructions = instructionParts.length
      ? instructionParts.join('\n\n')
      : undefined

    debug(`done`, { instructions, input }).log(
      'openai.conv.convertMessagesToResponseInput'
    )

    return { ...(instructions ? { instructions } : null), input }
  } finally {
    span.setAttribute('outputItemCount', input.length)
    span.finish()
  }
}

// --- Debug Functions ---

function summarizeOptionsForDebug(
  options: CompleteChatConversationStreamOptions
) {
  return {
    ...options,

    context: options.context
      ? {
          keys: Object.keys(options.context),
          hasOpenAIRealtime: Boolean(options.context.openaiRealtime),
          hasOpenAIRealtimeCompletionSinks: Boolean(
            options.context.openaiRealtimeCompletionSinks
          ),
        }
      : undefined,

    sink: options.sink ? '[ConversationSink]' : undefined,

    abortSignal: options.abortSignal
      ? {
          aborted: options.abortSignal.aborted,
          reason: options.abortSignal.reason,
        }
      : undefined,
  }
}

// --- Completion Functions ---

type CompleteTextConversationStreamOptions = {
  createTextCompletionStream?: typeof createTextCompletionStream
  openBracket?: string
  closeBracket?: string
  overrideMaxTokens?: number
} & GetNameOptions &
  ConversationInput

/**
 * A function that completes a text conversation. It does not support functions
 * or tool calls.
 */
export async function* completeTextConversationStream(
  options: CompleteTextConversationStreamOptions
): ConversationOutput {
  debug(`completeTextConversationStream`, {
    options: summarizeOptionsForDebug(options),
  }).log('openai.conv.completeTextConversationStream')

  const meta = options.meta

  const model = options.model

  const { name: modelName, config: modelConfig } =
    parseAndRevealLanguageModel(model)

  const { inputTokens, totalTokens } = calculateMaxTokens(
    modelName,
    options.overrideMaxTokens || modelConfig.maxInputTokens,
    options.messages
  )

  const temperature = modelConfig.temperature

  const reasoningEffort = modelConfig.reasoningEffort

  const stop = options.stop

  const user = options.clientId

  const openaiFunctions =
    typeof options.functions === 'function'
      ? await options.functions()
      : options.functions

  if (openaiFunctions?.length) {
    throwConflict('Functions are not supported')
  }

  const { messages, usage } = await optimizeMessages(
    options.messages,
    openaiFunctions,

    inputTokens,

    options
  )

  const openBracket = options.openBracket || '<|'
  const closeBracket = options.closeBracket || '|>'

  const convertedMessages = await convertMessages(messages, model, options)

  const openaiMessages = convertedMessages

  let openaiPrompt = openaiMessages
    .map((message) => {
      if (
        message.role !== 'user' &&
        message.role !== 'assistant' &&
        message.role !== 'tool'
      ) {
        return null
      }

      if (!message.content) {
        return null
      }

      const content = (
        Array.isArray(message.content) ? message.content : [message.content]
      )
        .map((content) => {
          if (typeof content === 'string') {
            return content
          } else {
            return '' // @todo maybe support other types
          }
        })
        .join(' ')

      if ('name' in message) {
        return `${openBracket}${
          message.name || message.role
        }${closeBracket}${content.trim()}`
      } else {
        return `${openBracket}${message.role}${closeBracket}${content.trim()}`
      }
    })
    .filter(Boolean)
    .join('\n')

  openaiPrompt += `\n${openBracket}assistant${closeBracket}`

  // @note the text/QA completion path has no function calling, so the model
  // cannot call `_success` / `_failure` - settle does not apply here and a plain
  // stop is genuinely terminal.

  const currentContinuations = Math.max(options.currentContinuations || 0, 0)
  const maxContinuations = options.maxContinuations ?? DEFAULT_MAX_CONTINUATIONS

  debug(`using`, {
    currentContinuations,
    maxContinuations,
  }).log('openai.conv.completeTextConversationStream')

  let inputTokensUsed = usage.tokens
  let outputTokensUsed = 0

  let hasError = false
  let hasStreamed = false

  const fn = options.createTextCompletionStream || createTextCompletionStream

  const span = createSpan({
    name: 'openai.completeTextConversationStream',
    op: 'ai.completion',
  })

  span.setAttribute('model', modelName)

  const startTime = Date.now()

  try {
    yield {
      type: TAG_COMPLETE_BEGIN,
      data: {},
    }

    const stream = fn({
      model: modelName,

      // @note metric label only - lets an observability dashboard break TTFT /
      // throughput down by provider (resolved here from the model config)
      provider: modelConfig.provider,

      // @note we must specify the max tokens for the completion stream - it is
      // a legacy things

      maxTokens: totalTokens,

      temperature: temperature,

      reasoningEffort: reasoningEffort,

      includeUsage: true,

      stop: [...(stop || []), openBracket, closeBracket].slice(0, 4),

      user: user,

      prompt: openaiPrompt,

      // context: options.context,

      // sink: options.sink,
    })

    let fullReasoning = ''

    let lastText = ''
    let fullText = ''

    const runawayGuard = createRepetitionGuard({
      minChars: RUNAWAY_GUARD_MIN_CHARS,
    })

    let runawayDetected = false

    let stopSequenceDetected = false

    let finalFinishReason: Exclude<
      CreateTextCompletionStreamFinishReason,
      null
    > = 'stop'

    for await (const {
      reasoning,

      completion: _text,

      finishReason,

      usage,
    } of stream) {
      let text = _text

      hasStreamed = true

      if (reasoning) {
        outputTokensUsed += 1

        fullReasoning += reasoning

        yield {
          type: TAG_REASONING_TOKEN,
          data: {
            token: reasoning,
          },
        }
      }

      if (text) {
        // If this is the first token, considering continuations as well, then
        // we should left trim it to remove any leading whitespace. This is a
        // common issue when the text contains a newline character.
        {
          if (!lastText && currentContinuations === 0) {
            text = text.trimStart()
          }
        }

        // Record the tokens used for the completion.
        {
          outputTokensUsed += 1
        }

        // Sometimes the output contains the brackets which is not a a great
        // experience as they are not expected. This code checks for the
        // presence of the open and close brackets and strips them off from the
        // final token. Keep in mind that this is only occurring when the finish
        // reason is stop.
        {
          if (finishReason === 'stop') {
            if (text.endsWith(openBracket)) {
              text = text.slice(0, -openBracket.length)
            } else if (text.endsWith(closeBracket)) {
              text = text.slice(0, -closeBracket.length)
            }
          }
        }

        // Here we try to cater for more than 4 tokens. The way we do this
        // is to add the current token text to the last token text and search
        // for the stop sequences. If we find a sequence we then substring the
        // text and use that instead.
        {
          const lastChunk = lastText + text

          for (const token of options.stop || []) {
            const index = lastChunk.indexOf(token)

            if (index >= 0) {
              const safeIndex = Math.max(index, lastText.length)

              text = lastChunk.substring(lastText.length, safeIndex)

              stopSequenceDetected = true

              break
            }
          }
        }

        // We check for the text again because it might have been modified in
        // the previous steps. If the text is empty we skip it. This is a
        // safety measure to prevent empty tokens from being sent to the
        // consumer.
        {
          if (text) {
            yield {
              type: TAG_TOKEN,
              data: {
                token: text,
              },
            }

            lastText = text

            fullText += text
          }
        }

        // A detected stop sequence must terminate the stream - the API-side
        // stop list is capped at 4 entries so this is the only enforcement
        // for the remaining sequences. Without this everything the model
        // emits after the stop sequence would keep streaming to the consumer.
        {
          if (stopSequenceDetected) {
            finalFinishReason = 'stop'

            break
          }
        }
      }

      // @note guard against runaway in-message repetition. The guard is O(1) per
      // chunk so it runs on every token and trips within a few repeats of a
      // tight loop, before much garbage is streamed.
      //
      // @note only the user-visible answer text is guarded. The reasoning
      // (chain-of-thought) channel is deliberately exempt: it
      // is the model's scratchpad, where it legitimately drafts and re-verifies
      // repetitive structures - tables, ASCII grids, enumerations - that are
      // indistinguishable from a loop on lexical diversity alone; it is not shown
      // as the answer, and it is already bounded by maxTokens, so tripping there
      // only aborts otherwise-good turns mid-thought. Activity (tool-call) output
      // is never fed here either. A genuinely degenerate answer still trips.
      {
        if (text && runawayGuard.push(text)) {
          runawayDetected = true

          debug(`detected runaway in-message repetition, stopping stream`, {
            reasoningLength: fullReasoning.length,
            textLength: fullText.length,
          }).log('openai.conv.completeTextConversationStream')

          break
        }
      }

      if (finishReason) {
        finalFinishReason = finishReason
      }

      if (usage) {
        debug(`usage`, {
          inputTokensUsed,
          outputTokensUsed,

          usage,

          inputTokensDelta: usage.promptTokens - inputTokensUsed,
          outputTokensDelta: usage.completionTokens - outputTokensUsed,
        }).log('openai.conv.completeTextConversationStream.usage')

        // @todo measure drift

        inputTokensUsed = usage.promptTokens
        outputTokensUsed = usage.completionTokens
      }
    }

    if (runawayDetected) {
      observeRunawayTextRun(
        'text_completion_path',
        fullReasoning.length + fullText.length,
        modelName,
        {
          reason: runawayGuard.reason(),
          sample: `${fullReasoning}\n${fullText}`.slice(-1500),
          messages,
        }
      )

      yield {
        type: TAG_MESSAGE,
        data: {
          type: BOT_MESSAGE_TYPE,
          text: getRunawayStopMessage(options, runawayGuard.reason()),
          meta: {
            ...meta,

            cycleDetected: true,
            runawayTextDetected: true,
          },
        },
      }

      yield {
        type: TAG_COMPLETE_END,
        data: {
          reason: 'stop',
        },
      }

      return
    }

    if (fullReasoning) {
      yield {
        type: TAG_MESSAGE,
        data: {
          type: REASONING_MESSAGE_TYPE,
          text: fullReasoning,
          meta: {
            ...meta,
          },
        },
      }
    }

    if (fullText) {
      yield {
        type: TAG_MESSAGE,
        data: {
          type: BOT_MESSAGE_TYPE,
          text: fullText,
          meta: {
            ...meta,
          },
        },
      }
    }

    yield {
      type: TAG_COMPLETE_END,
      data: {
        reason: mapFinishReasonToCompleteReason(finalFinishReason),
      },
    }

    // @todo finalFinishReason should be handled by the API, not this

    switch (finalFinishReason) {
      case 'error': {
        debug(`detected error finish reason`).log(
          'openai.conv.completeTextConversationStream'
        )

        // @note this is an observation for analysis, not a bug - the AI model
        // returned an error finish reason which indicates an issue with the
        // model provider or the request itself

        await captureObservation(`Error finish reason detected`, options)

        return
      }

      case 'stop': {
        debug(`detected stop reason`).log(
          'openai.conv.completeTextConversationStream'
        )

        if (!fullText && !options.background) {
          // @note an empty turn (a `stop` with no text). Retrying rarely
          // recovers, so this tight guard bails well before the generic
          // continuation budget and, unlike the old silent return, surfaces a
          // Sentry observation and a user-facing stop message.

          const emptyStats = options.emptyStats || { count: 0 }
          const maxEmpties = options.maxEmpties ?? DEFAULT_MAX_EMPTIES

          emptyStats.count += 1

          if (emptyStats.count >= maxEmpties) {
            observeEmptyExhausted('text_completion_path', modelName, {
              empties: emptyStats.count,
              maxEmpties,
              currentContinuations,
              currentIterations: options.currentIterations ?? 0,
            })

            yield {
              type: TAG_MESSAGE,
              data: {
                type: BOT_MESSAGE_TYPE,
                text: getLoopStopMessage(options),
                meta: {
                  ...meta,

                  emptyExhausted: true,
                },
              },
            }

            return
          }

          if (currentContinuations <= maxContinuations) {
            debug(
              `retrying completion because of stop finish reason and no text was generated`,
              {
                empties: emptyStats.count,
                maxEmpties,
                currentContinuations,
                maxContinuations,
              }
            ).log('openai.conv.completeTextConversationStream')

            yield* completeTextConversation({
              ...options,

              messages: addEmptyNotice(messages),

              currentContinuations: currentContinuations + 1,

              // @note carry the (mutated) empty counter forward so the budget
              // accumulates across empty turns
              emptyStats,
            })
          }
        }

        return
      }

      case 'length': {
        debug(`detected length reason`).log(
          'openai.conv.completeTextConversationStream'
        )

        if (currentContinuations <= maxContinuations) {
          yield* completeTextConversation({
            ...options,

            messages: messages.concat({
              type: BOT_MESSAGE_TYPE,
              text: fullText,
              usage: {
                tokens: outputTokensUsed,
              },
            }),

            currentContinuations: currentContinuations + 1,
          })
        }

        return
      }

      case 'contentFilter': {
        debug(`detected content filter reason`).log(
          'openai.conv.completeTextConversationStream'
        )

        // @note the provider's content filter is a deterministic safety refusal,
        // not a bug - it is not retried (the same content would just re-filter).
        // Surface it to Sentry at `info` level so a run dying to a filter is
        // visible without reading as an alert.

        observeContentFilter('text_completion_path', modelName)

        // @todo should we throw like above

        return
      }

      default: {
        assertUnreachable(finalFinishReason)
      }
    }
  } catch (e) {
    if (isAbortError(e)) {
      // @note an abort error can be triggered by the user or by the system
      // (e.g. timeout) in fetch or some other component of the stack and it
      // has nothing to do with the interactivity of conversation

      const duration = Date.now() - startTime

      debug(`text completion stream aborted`, {
        model: modelName,
        duration,
        currentContinuations,
      }).log('openai.conv.completeTextConversationStream.aborted')

      await captureObservation('Text completion stream aborted', {
        model: modelName,
        duration,
        inputTokensUsed,
        outputTokensUsed,
        currentContinuations,
      })

      throw e
    }

    // @note catch token limit errors during streaming

    const tokenLimitDetection = detectTokenLimitError(e.message || String(e))

    if (tokenLimitDetection.isTokenLimitError) {
      debug(
        `detected token limit error during text streaming, retrying with reduced tokens`,
        {
          suggestedLimit: tokenLimitDetection.suggestedLimit,
          currentMaxTokens: totalTokens,
        }
      ).log('openai.conv.completeTextConversationStream')

      if (currentContinuations <= maxContinuations) {
        yield* completeTextConversation({
          ...options,

          // @note reduce token limit to suggested amount - use in overrideMaxTokens for calculateMaxTokens

          // @todo does not work on small models as the maxTokens do not include the backstory or the functions :(

          overrideMaxTokens: tokenLimitDetection.suggestedLimit,

          currentContinuations: currentContinuations + 1,
        })

        return
      }
    }

    // @note a transient provider failure - a stalled request or an upstream 5xx
    // the adaptor could not outlast - is re-issued once more, bounded by the
    // continuation budget. An AbortError - the hard deadline - is re-thrown
    // above and never reaches here. See isRecoverableProviderError.

    if (isRecoverableProviderError(e)) {
      if (currentContinuations <= maxContinuations) {
        debug(`retrying text completion after recoverable provider error`, {
          model: modelName,
          cause: getRecoverableProviderErrorCause(e),
          currentContinuations,
          maxContinuations,
        }).log('openai.conv.completeTextConversationStream')

        yield* completeTextConversation({
          ...options,

          currentContinuations: currentContinuations + 1,
        })

        return
      }
    }

    // @note re-throw non-token-limit errors

    hasError = true

    throw e
  } finally {
    const duration = Date.now() - startTime

    span.setAttribute('inputTokensUsed', inputTokensUsed)
    span.setAttribute('outputTokensUsed', outputTokensUsed)
    span.finish()

    // Log slow operations (over 30 seconds)
    if (duration > 30000) {
      debug(`slow text completion stream`, {
        model: modelName,
        duration,
        inputTokensUsed,
        outputTokensUsed,
      }).log('openai.conv.completeTextConversationStream.slow')

      await captureObservation('Slow text completion stream', {
        model: modelName,
        duration,
        inputTokensUsed,
        outputTokensUsed,
        currentContinuations,
      })
    }

    // @note skip usage reporting when the request failed before streaming
    // started. If the provider started delivering chunks we still report
    // usage because input tokens were already consumed.

    if (!hasError || hasStreamed) {
      yield {
        type: TAG_USAGE,
        data: {
          model: modelName,
          inputTokensUsed: inputTokensUsed,
          outputTokensUsed: outputTokensUsed,
        },
      }
    }
  }
}

type CompleteChatConversationStreamOptions = {
  createChatCompletionStream?: typeof createChatCompletionStream
  startFunctions?: string[]
  endFunctions?: string[]
  overrideMaxTokens?: number
} & GetNameOptions &
  ConversationInput

/**
 * A function that completes a chat conversation. It supports functions and
 * tool calls.
 */
async function* completeChatConversationRound(
  options: CompleteChatConversationStreamOptions
): AsyncGenerator<Item, CompleteChatConversationStreamOptions | undefined> {
  debug(`completeChatConversationStream`, {
    options: summarizeOptionsForDebug(options),
  }).log('openai.conv.completeChatConversationStream')

  // @note cooperative deadline. The hard-timeout abort signal can only interrupt
  // an in-flight model fetch on its own; while a tool handler runs (or during any
  // await outside a fetch) it goes unobserved. Every iteration of the agentic
  // loop re-enters this round, so we check the deadline here before starting
  // another model round and stop with a graceful abort instead of doing more work
  // the process will not live to persist. Mirrors the
  // terminal-tool abort path below.
  if (options.abortSignal?.aborted) {
    yield { type: TAG_ABORT, data: { reason: 'deadline reached' } }

    yield { type: TAG_COMPLETE_END, data: { reason: 'abort' } }

    return
  }

  const meta = options.meta

  const model = options.model

  const { name: modelName, config: modelConfig } =
    parseAndRevealLanguageModel(model)

  const { inputTokens, totalTokens } = calculateMaxTokens(
    modelName,
    options.overrideMaxTokens || modelConfig.maxInputTokens,
    options.messages
  )

  const temperature = modelConfig.temperature

  const reasoningEffort = modelConfig.reasoningEffort

  const stop = options.stop

  const user = options.clientId

  const fn = options.createChatCompletionStream || createChatCompletionStream

  const openaiFunctions =
    typeof options.functions === 'function'
      ? await options.functions()
      : options.functions

  const { messages, usage } = await optimizeMessages(
    options.messages,
    openaiFunctions,

    inputTokens,

    options
  )

  const convertedMessages = await convertMessages(messages, model, options)

  const openaiMessages = convertedMessages

  const startFunctions = options.startFunctions || []
  const endFunctions = options.endFunctions || []

  const currentIterations = Math.max(options.currentIterations ?? 0, 0)
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS

  const currentContinuations = Math.max(options.currentContinuations || 0, 0)
  const maxContinuations = options.maxContinuations ?? DEFAULT_MAX_CONTINUATIONS

  const settleStats = options.settleStats || { nudges: 0 }

  settleStats.nudges = Math.max(settleStats.nudges ?? 0, 0)

  const maxSettles = options.maxSettles ?? 0

  const callStats = options.callStats || { calls: 0 }

  callStats.calls = Math.max(callStats.calls ?? 0, 0)

  const maxCalls = options.maxCalls ?? DEFAULT_MAX_CALLS

  // @note when the call budget was already exhausted before this round even
  // started, every call made in this round is rejected with 'too many calls'
  // and the model has already had a full round to see those errors and wrap
  // up - we use this to stop the recursion below as cycle detection alone
  // cannot catch a runaway model that varies its arguments on every call

  const callBudgetExhaustedBeforeRound = callStats.calls > maxCalls

  debug(`using`, {
    currentIterations,
    maxIterations,
    currentContinuations,
    maxContinuations,
    callStats,
    maxCalls,
    startFunctions,
    endFunctions,
  }).log('openai.conv.completeChatConversationStream')

  let inputTokensUsed = usage.tokens
  let outputTokensUsed = 0

  let hasError = false
  let hasStreamed = false

  const span = createSpan({
    name: 'openai.completeChatConversationStream',
    op: 'ai.completion',
  })

  span.setAttribute('model', modelName)
  span.setAttribute('hasFunctions', Boolean(openaiFunctions?.length))

  const startTime = Date.now()

  /**
   * Checks if the iteration limit has been reached and we should stop recursing.
   *
   * @note We check if the NEXT iteration would exceed the limit. Since
   * currentIterations is 0-indexed (first call = 0, second = 1, etc.),
   * we need to check if currentIterations + 1 >= maxIterations.
   *
   * Example: maxIterations = 2
   * - Call 1 (ci=0): check 0+1 >= 2? No → proceed
   * - Call 2 (ci=1): check 1+1 >= 2? Yes → stop (don't recurse)
   * Result: 2 calls made
   *
   * @returns {boolean} true if we should stop recursing due to iteration limit
   */
  const isIterationLimitReached = () =>
    iterationLimitReached({
      yieldSignal: options.yieldSignal,
      currentIterations,
      maxIterations,
    })

  /**
   * Creates options for the next recursive call with incremented iteration.
   *
   * @param {object} additionalOptions - additional options to merge
   * @returns {object} options for the next recursive call
   */
  const nextIterationOptions = (additionalOptions = {}) => ({
    ...options,

    currentIterations: currentIterations + 1,

    ...additionalOptions,
  })

  try {
    yield {
      type: TAG_COMPLETE_BEGIN,
      data: {},
    }

    const stream = fn({
      model: modelName,

      // @note metric label only - lets an observability dashboard break TTFT /
      // throughput down by provider (resolved here from the model config)
      provider: modelConfig.provider,

      // @note not specifying the max tokens will result in using all available
      // tokens in the model

      // maxTokens: maxOutputTokens,

      temperature: temperature,

      reasoningEffort: reasoningEffort,

      includeUsage: true,

      stop: stop,

      user: user,

      messages: openaiMessages,

      // context: options.context,

      // sink: options.sink,

      ...(openaiFunctions?.length
        ? {
            functions: undefined,
            functionCalls: undefined,

            tools: openaiFunctions.map(({ name, description, parameters }) => {
              return {
                type: 'function',

                function: { name, description, parameters },
              }
            }),

            toolChoice: (():
              | 'auto'
              | { type: 'function'; function: { name: string } } => {
              // force the first start function if any remain

              if (startFunctions.length > 0) {
                return {
                  type: 'function',
                  function: {
                    name: startFunctions[0],
                  },
                }
              }

              return 'auto'
            })(),

            // @note disabled because it is expected to be the default and it is
            // causing issues with other models
            // parallelToolCalls: true,
          }
        : null),

      // Pass abort signal for timeout support
      ...(options.abortSignal ? { signal: options.abortSignal } : null),
    })

    let fullReasoning = ''

    let fullText = ''

    const runawayGuard = createRepetitionGuard({
      minChars: RUNAWAY_GUARD_MIN_CHARS,
    })

    let runawayDetected = false

    let finalFinishReason: Exclude<
      CreateChatCompletionStreamFinishReason,
      null
    > = 'stop'

    let finalFunctionCall: OpenAIFunctionCall | null = null
    let finalToolCalls: OpenAIToolCall[] | null = null

    for await (const {
      error,

      reasoning,

      completion: text,

      finishReason,

      usage,

      functionCall,
      toolCalls,
    } of stream) {
      hasStreamed = true

      // handle error

      if (error) {
        debug(`detected error`, { error }).log(
          'openai.conv.completeChatConversationStream'
        )

        // @todo the continuation must be applied based on the error type - not
        // all errors are the same

        if (currentContinuations <= maxContinuations) {
          // @note check iteration limit before recursing

          if (isIterationLimitReached()) {
            debug(`iteration limit reached, stopping`).log(
              'openai.conv.completeChatConversationStream'
            )

            yield {
              type: TAG_COMPLETE_END,
              data: {
                reason: 'iteration',
              },
            }

            return
          }

          debug(`retrying completion because of error`, {
            currentContinuations,
            maxContinuations,
          }).log('openai.conv.completeChatConversationStream')

          // @note close the current completion before recursing - the retry
          // emits its own completeBegin/completeEnd pair and without this the
          // outer completeBegin would never be balanced by an end

          yield {
            type: TAG_COMPLETE_END,
            data: {
              reason: 'error',
            },
          }

          return nextIterationOptions({
            currentContinuations: currentContinuations + 1,
          })
        } else {
          const { message, code } = error

          throw new SystemError(message, code)
        }
      }

      // handle reasoning

      if (reasoning) {
        outputTokensUsed += 1

        fullReasoning += reasoning

        yield {
          type: TAG_REASONING_TOKEN,
          data: {
            token: reasoning,
          },
        }
      }

      // handle text

      if (text) {
        outputTokensUsed += 1

        fullText += text

        yield {
          type: TAG_TOKEN,
          data: {
            token: text,
          },
        }
      }

      // @note guard against runaway in-message repetition. The guard is O(1) per
      // chunk so it runs on every token and trips within a few repeats of a
      // tight loop, before much garbage is streamed.
      //
      // @note only the user-visible answer text is guarded. The reasoning
      // (chain-of-thought) channel is deliberately exempt: it
      // is the model's scratchpad, where it legitimately drafts and re-verifies
      // repetitive structures - tables, ASCII grids, enumerations - that are
      // indistinguishable from a loop on lexical diversity alone; it is not shown
      // as the answer, and it is already bounded by maxTokens, so tripping there
      // only aborts otherwise-good turns mid-thought. Activity (tool-call) output
      // is never fed here either. A genuinely degenerate answer still trips.
      {
        if (text && runawayGuard.push(text)) {
          runawayDetected = true

          debug(`detected runaway in-message repetition, stopping stream`, {
            reasoningLength: fullReasoning.length,
            textLength: fullText.length,
          }).log('openai.conv.completeChatConversationStream')

          break
        }
      }

      // handle finish reason

      if (finishReason) {
        finalFinishReason = finishReason
      }

      // handle usage

      if (usage) {
        debug(`usage`, {
          inputTokensUsed,
          outputTokensUsed,

          usage,

          inputTokensDelta: usage.promptTokens - inputTokensUsed,
          outputTokensDelta: usage.completionTokens - outputTokensUsed,
        }).log('openai.conv.completeChatConversationStream.usage')

        // @todo measure drift

        inputTokensUsed = usage.promptTokens
        outputTokensUsed = usage.completionTokens
      }

      // handle function call

      if (functionCall) {
        // @todo find a better way to count the function call tokens

        outputTokensUsed += (
          await estimateMessageUsage({
            type: TMP_FUNCTIONS_MESSAGE_TYPE,
            text: '',
            meta: functionCall,
          })
        ).tokens

        finalFunctionCall = functionCall
      }

      // handle tool calls

      if (toolCalls) {
        // @todo find a better way to count the tool call tokens

        outputTokensUsed += (
          await estimateMessageUsage({
            type: TMP_FUNCTIONS_MESSAGE_TYPE,
            text: '',
            meta: toolCalls,
          })
        ).tokens

        finalToolCalls = toolCalls
      }
    }

    if (runawayDetected) {
      observeRunawayTextRun(
        'chat_completion_path',
        fullReasoning.length + fullText.length,
        modelName,
        {
          reason: runawayGuard.reason(),
          sample: `${fullReasoning}\n${fullText}`.slice(-1500),
          messages,
        }
      )

      yield {
        type: TAG_MESSAGE,
        data: {
          type: BOT_MESSAGE_TYPE,
          text: getRunawayStopMessage(options, runawayGuard.reason()),
          meta: {
            ...meta,

            cycleDetected: true,
            runawayTextDetected: true,
          },
        },
      }

      yield {
        type: TAG_COMPLETE_END,
        data: {
          reason: 'stop',
        },
      }

      return
    }

    let newMessages: Array<Message | MessageWithUsage> = messages
      // @note obtain a copy
      .slice()
      // @note we need to remove trigger activity messages if any
      .filter(
        (message) =>
          !(
            message.type === ACTIVITY_MESSAGE_TYPE &&
            message.meta?.activity?.type === TRIGGER_ACTIVITY_TYPE
          )
      )

    if (fullReasoning) {
      const botReasoningMessage: Message = {
        type: REASONING_MESSAGE_TYPE,
        text: fullReasoning,
        meta: {
          ...meta,
        },
      }

      yield {
        type: TAG_MESSAGE,
        data: botReasoningMessage,
      }

      newMessages.push({
        ...botReasoningMessage,

        usage: {
          tokens: outputTokensUsed,
        },
      })
    }

    if (fullText) {
      const botMessage: Message = {
        type: BOT_MESSAGE_TYPE,
        text: fullText,
        meta: {
          ...meta,
        },
      }

      yield {
        type: TAG_MESSAGE,
        data: botMessage,
      }

      newMessages.push({
        ...botMessage,

        usage: {
          tokens: outputTokensUsed,
        },
      })
    }

    yield {
      type: TAG_COMPLETE_END,
      data: {
        reason: mapFinishReasonToCompleteReason(finalFinishReason),
      },
    }

    // @todo finalFinishReason should be handled by the API, not this

    switch (finalFinishReason) {
      case 'error': {
        debug(`detected error finish reason`).log(
          'openai.conv.completeChatConversationStream'
        )

        // @note an `error` finish reason is a provider/stream failure that
        // arrived as a terminal reason instead of a mid-stream error event.
        // Recover the same way the mid-stream error path does: retry within the
        // continuation budget so a transient hiccup does not abandon the turn.
        // This matters most in settle mode, where the run is only "done" once the
        // model calls a terminal tool (`_success` / `_failure`) - a silent return
        // here would leave the run permanently unsettled (recorded `incomplete`).

        if (
          currentContinuations <= maxContinuations &&
          !isIterationLimitReached()
        ) {
          debug(`retrying completion because of error finish reason`, {
            currentContinuations,
            maxContinuations,
          }).log('openai.conv.completeChatConversationStream')

          return nextIterationOptions({
            currentContinuations: currentContinuations + 1,
          })
        }

        // @note retries exhausted - the catastrophic case. Surface it to Sentry
        // (a silent observation previously hid these incidents). The `error`
        // complete-end already emitted above stands, so the caller still sees a
        // non-abort reason and treats the run as incomplete.

        observeErrorFinishReasonExhausted('chat_completion_path', modelName, {
          currentIterations,
          currentContinuations,
          maxContinuations,
          callStats,
        })

        return
      }

      case 'stop': {
        debug(`detected stop reason`).log(
          'openai.conv.completeChatConversationStream'
        )

        // check if there are end functions to call

        if (endFunctions.length > 0) {
          debug(`calling end function`, {
            nextEndFunction: endFunctions[0],
          }).log('openai.conv.completeChatConversationStream')

          // @note check iteration limit before recursing

          if (isIterationLimitReached()) {
            debug(`iteration limit reached, stopping`).log(
              'openai.conv.completeChatConversationStream'
            )

            yield {
              type: TAG_COMPLETE_END,
              data: {
                reason: 'iteration',
              },
            }

            return
          }

          return nextIterationOptions({
            messages: newMessages,

            // force the first end function and pass remaining

            startFunctions: [endFunctions[0]],
            endFunctions: endFunctions.slice(1),

            currentContinuations: 0,
          })
        }

        // @note in settle mode a plain stop means the model ended its turn
        // without calling a terminal tool (`_success` / `_failure`, which exit
        // via abort). Nudge it and continue - bounded by the settle budget and,
        // when set, the iteration limit - so the run is driven to settlement.
        // Once the budget (or iteration limit) is spent, surface the turn as an
        // `iteration` so a caller loop continues instead of treating the
        // unsettled stop as a finished run.

        if (maxSettles > 0) {
          if (settleStats.nudges < maxSettles && !isIterationLimitReached()) {
            settleStats.nudges += 1

            debug(`settle nudge, continuing`, {
              nudges: settleStats.nudges,
              maxSettles,
            }).log('openai.conv.completeChatConversationStream')

            return nextIterationOptions({
              messages: addSettleNotice(newMessages),

              // @note carry the (mutated) settle counter into the recursion so
              // the budget accumulates across nudges, like callStats/cycleStats
              settleStats,
            })
          }

          // @note settle budget (or iteration limit) spent without the model
          // calling a terminal tool. Surface it to Sentry so an agent that never
          // completes is visible, then hand the caller `iteration` so the
          // unsettled run is handled rather than mistaken for a finished one.

          observeSettleExhausted('chat_completion_path', modelName, {
            nudges: settleStats.nudges,
            maxSettles,
            currentIterations,
          })

          yield {
            type: TAG_COMPLETE_END,
            data: {
              reason: 'iteration',
            },
          }

          return
        }

        if (!fullText && !options.background) {
          // @note a `stop` with neither answer text nor a tool call is an empty
          // turn. Retrying rarely recovers - a model that returns empty once
          // tends to repeat - so this tight guard bails well before the generic
          // continuation budget (mirrors the cyclic-behaviour guard). Unlike the
          // old silent return, exhaustion surfaces a Sentry observation and a
          // user-facing stop message so a turn that produces nothing is not left
          // blank and invisible.

          const emptyStats = options.emptyStats || { count: 0 }
          const maxEmpties = options.maxEmpties ?? DEFAULT_MAX_EMPTIES

          emptyStats.count += 1

          if (emptyStats.count >= maxEmpties) {
            observeEmptyExhausted('chat_completion_path', modelName, {
              empties: emptyStats.count,
              maxEmpties,
              currentContinuations,
              currentIterations,
            })

            yield {
              type: TAG_MESSAGE,
              data: {
                type: BOT_MESSAGE_TYPE,
                text: getLoopStopMessage(options),
                meta: {
                  ...meta,

                  emptyExhausted: true,
                },
              },
            }

            return
          }

          if (currentContinuations <= maxContinuations) {
            // @note check iteration limit before recursing

            if (isIterationLimitReached()) {
              debug(`iteration limit reached, stopping`).log(
                'openai.conv.completeChatConversationStream'
              )

              yield {
                type: TAG_COMPLETE_END,
                data: {
                  reason: 'iteration',
                },
              }

              return
            }

            debug(
              `retrying completion because of stop finish reason and no text was generated`,
              {
                empties: emptyStats.count,
                maxEmpties,
                currentContinuations,
                maxContinuations,
              }
            ).log('openai.conv.completeChatConversationStream')

            // @note retry with newMessages (not the pre-response snapshot) so
            // any reasoning the model just produced - and that was already
            // emitted to the consumer - stays part of the retry context

            return nextIterationOptions({
              messages: addEmptyNotice(newMessages),

              currentContinuations: currentContinuations + 1,

              // @note carry the (mutated) empty counter into the recursion so
              // the budget accumulates across empty turns, like settleStats
              emptyStats,
            })
          }
        }

        return
      }

      case 'length': {
        debug(`detected length reason`).log(
          'openai.conv.completeChatConversationStream'
        )

        if (currentContinuations <= maxContinuations) {
          // @note check iteration limit before recursing

          if (isIterationLimitReached()) {
            debug(`iteration limit reached, stopping`).log(
              'openai.conv.completeChatConversationStream'
            )

            yield {
              type: TAG_COMPLETE_END,
              data: {
                reason: 'iteration',
              },
            }

            return
          }

          debug(`retrying completion because of length finish reason`, {
            currentContinuations,
            maxContinuations,
          }).log('openai.conv.completeChatConversationStream')

          return nextIterationOptions({
            messages: messages.concat({
              type: BOT_MESSAGE_TYPE,
              text: fullText,
              usage: {
                tokens: outputTokensUsed,
              },
            }),

            currentContinuations: currentContinuations + 1,
          })
        }

        return
      }

      case 'contentFilter': {
        debug(`detected content filter reason`).log(
          'openai.conv.completeChatConversationStream'
        )

        // @note the provider's content filter is a deterministic safety refusal,
        // not a bug - it is not retried (the same content would just re-filter).
        // Surface it to Sentry at `info` level so a run dying to a filter is
        // visible without reading as an alert.

        observeContentFilter('chat_completion_path', modelName)

        // @todo should we continue

        return
      }

      case 'functionCall': {
        debug(`detected function call reason`, { finalFunctionCall }).log(
          'openai.conv.completeChatConversationStream'
        )

        if (finalFunctionCall) {
          let handleSubsequentChatCompletions = true

          callStats.calls += 1

          const functionName = getFunctionName(
            finalFunctionCall.name,
            openaiFunctions
          )

          const functionArguments = getFunctionArguments(
            finalFunctionCall.arguments,
            openaiFunctions
          )

          const requestActivityMessage = makeRequestActivityMessage(
            functionName,
            functionArguments,
            meta
          )

          yield {
            type: TAG_MESSAGE,

            data: requestActivityMessage,
          }

          newMessages.push({
            ...requestActivityMessage,

            usage: {
              tokens: -1, // negative value to indicate that the usage is not known
            },
          })

          if (finalFunctionCall.error) {
            // @note surface the parse error back to the model instead of
            // invoking the handler with empty arguments (see the tool_calls path)

            debug(`detected malformed function call arguments`, {
              functionName,
              error: finalFunctionCall.error,
            }).log('openai.conv.completeChatConversationStream')

            const responseActivityMessage = makeResponseActivityMessage(
              functionName,
              functionArguments,
              { error: finalFunctionCall.error },
              {
                ...meta,
              }
            )

            yield {
              type: TAG_MESSAGE,
              data: responseActivityMessage,
            }

            newMessages.push({
              ...responseActivityMessage,

              usage: {
                tokens: -1, // negative value to indicate that the usage is not known
              },
            })
          } else {
            const func =
              openaiFunctions?.find(({ name }) => name === functionName) ||
              internalFunctionStubs[functionName]

            if (func) {
              if (callStats.calls <= maxCalls) {
                if (func.handler) {
                  debug(`invoking function handler`, {
                    functionName,
                    functionArguments,
                  }).log('openai.conv.completeChatConversationStream')

                  const functionSpan = createSpan({
                    name: `function.${functionName}`,
                    op: 'function.call',
                  })

                  functionSpan.setAttribute('functionName', functionName)
                  functionSpan.setAttribute('iteration', currentIterations)

                  const functionStartTime = Date.now()

                  let result

                  try {
                    // @note hand the deadline/abort signal to the handler so a
                    // cooperative tool can cancel its own in-flight work, and stop
                    // waiting for it shortly after the deadline if it does not -
                    // recording a paired timeout result in its place
                    result = await awaitWithAbortGrace(
                      Promise.resolve(
                        func.handler(functionArguments, {
                          newMessages,
                          signal: options.abortSignal,
                        })
                      ),
                      options.abortSignal,
                      HANDLER_DEADLINE_GRACE_MS,
                      () => ({ error: HANDLER_DEADLINE_BYPASS_ERROR })
                    )
                  } catch (e) {
                    await captureException(e)

                    // @note we are deliberately hiding the error from the user
                    // because this is an internal issue

                    if (e instanceof SafeError) {
                      result = { error: e.message }
                    } else {
                      result = { error: 'Function invocation exception' }
                    }
                  } finally {
                    const functionDuration = Date.now() - functionStartTime

                    functionSpan.finish()

                    // Log slow function calls (over 30 seconds)
                    if (functionDuration > 30000) {
                      debug(`slow function call`, {
                        functionName,
                        duration: functionDuration,
                      }).log(
                        'openai.conv.completeChatConversationStream.slowFunction'
                      )

                      await captureObservation('Slow function call', {
                        functionName,
                        duration: functionDuration,
                        model: modelName,
                        currentIterations,
                      })
                    }
                  }

                  debug(`function handler result`, {
                    functionName,
                    result,
                  }).log('openai.conv.completeChatConversationStream')

                  if (result instanceof AbortSignal) {
                    if (result.aborted) {
                      debug(
                        `function handler returned aborted signal, aborting conversation`,
                        {
                          functionName,
                          reason: result.reason,
                        }
                      ).log('openai.conv.completeChatConversationStream')

                      const responseActivityMessage =
                        makeResponseActivityMessage(
                          functionName,
                          functionArguments,
                          result.reason || null,
                          {
                            ...meta,
                          }
                        )

                      yield {
                        type: TAG_MESSAGE,

                        data: responseActivityMessage,
                      }

                      newMessages.push({
                        ...responseActivityMessage,

                        usage: {
                          tokens: -1, // negative value to indicate that the usage is not known
                        },
                      })

                      yield {
                        type: TAG_ABORT,
                        data: {
                          reason: result.reason,
                          functionName,
                        },
                      }

                      yield {
                        type: TAG_COMPLETE_END,
                        data: {
                          reason: 'abort',
                        },
                      }

                      return // stop all subsequent operations
                    } else {
                      throw new Error(`Unexpected abort signal state`)
                    }
                  } else {
                    let thisMeta

                    if (result instanceof Result) {
                      thisMeta = result.meta
                      result = result.result
                    } else if (result instanceof Error) {
                      result = { error: result.message }
                    }

                    const functionResult =
                      tryStringifyJson(result) || 'no result'

                    const responseActivityMessage = makeResponseActivityMessage(
                      functionName,
                      functionArguments,
                      functionResult,
                      {
                        ...meta,
                        ...thisMeta,
                      }
                    )

                    yield {
                      type: TAG_MESSAGE,

                      data: responseActivityMessage,
                    }

                    newMessages.push({
                      ...responseActivityMessage,

                      usage: {
                        tokens: -1, // negative value to indicate that the usage is not known
                      },
                    })
                  }
                } else {
                  handleSubsequentChatCompletions = false

                  // @note this is expected

                  debug(`detected function call without function handler`).log(
                    'openai.conv.completeChatConversationStream'
                  )
                }
              } else {
                debug(`detected function call with too many calls`).log(
                  'openai.conv.completeChatConversationStream'
                )

                const responseActivityMessage = makeResponseActivityMessage(
                  functionName,
                  functionArguments,
                  { error: 'too many calls' },
                  {
                    ...meta,
                  }
                )

                yield {
                  type: TAG_MESSAGE,
                  data: responseActivityMessage,
                }

                newMessages.push({
                  ...responseActivityMessage,

                  usage: {
                    tokens: -1, // negative value to indicate that the usage is not known
                  },
                })
              }
            } else {
              debug(
                `detected function call without corresponding function definition`
              ).log('openai.conv.completeChatConversationStream')

              const responseActivityMessage = makeResponseActivityMessage(
                functionName,
                functionArguments,
                { error: 'function not found' },
                {
                  ...meta,
                }
              )

              yield {
                type: TAG_MESSAGE,
                data: responseActivityMessage,
              }

              newMessages.push({
                ...responseActivityMessage,

                usage: {
                  tokens: -1, // negative value to indicate that the usage is not known
                },
              })
            }
          }

          if (handleSubsequentChatCompletions) {
            // @note stop when the call budget was exhausted before this round
            // even started - the model already received the 'too many calls'
            // errors in the previous round and still keeps calling functions,
            // so recursing further would loop unboundedly

            if (callBudgetExhaustedBeforeRound) {
              debug(`stopping due to exhausted call budget`, {
                callStats,
                maxCalls,
              }).log('openai.conv.completeChatConversationStream')

              observeCallLimitReached(
                'function_call_path',
                callStats,
                maxCalls,
                newMessages,
                modelName
              )

              yield {
                type: TAG_MESSAGE,
                data: {
                  type: BOT_MESSAGE_TYPE,
                  text: getCallLimitStopMessage(options),
                  meta: {
                    ...meta,

                    callLimitReached: true,
                  },
                },
              }

              return
            }

            // @note check for cyclic behavior before recursing

            const cycleStats = options.cycleStats || { detected: 0 }
            const maxCycles = options.maxCycles ?? DEFAULT_MAX_CYCLES

            if (
              isThreadCyclic(withoutCallBudgetNotice(newMessages), {
                minRepetitions: 2,
                minPatternLength: 2,
              })
            ) {
              cycleStats.detected += 1

              debug(`detected cyclic behavior`, {
                cycleStats,
                maxCycles,
              }).log('openai.conv.completeChatConversationStream')

              if (cycleStats.detected >= maxCycles) {
                debug(`stopping due to repeated cyclic behavior`).log(
                  'openai.conv.completeChatConversationStream'
                )

                // @note temp logging for monitoring when we stop due to cycles
                // @todo remove after monitoring period (added 2026-01-14)
                observeThreadCycleMaxReached(
                  'function_call_path',
                  cycleStats,
                  maxCycles,
                  newMessages,
                  modelName,
                  describeThreadCycle(withoutCallBudgetNotice(newMessages), {
                    minRepetitions: 2,
                    minPatternLength: 2,
                  })
                )

                yield {
                  type: TAG_MESSAGE,
                  data: {
                    type: BOT_MESSAGE_TYPE,
                    text: getLoopStopMessage(options),
                    meta: {
                      ...meta,

                      cycleDetected: true,
                    },
                  },
                }

                return
              }

              // @note add a warning activity to give the model a chance to
              // recover from the cycle

              newMessages = addCycleNotice(newMessages)
            } else if (cycleStats.detected > 0) {
              // @note reset the cycle counter if the cycle was broken

              cycleStats.detected = 0

              debug(`cycle broken, resetting cycle counter`).log(
                'openai.conv.completeChatConversationStream'
              )

              // @note temp logging for monitoring cycle recovery
              // @todo remove after monitoring period (added 2026-01-14)
              observeThreadCycleBroken(
                'function_call_path',
                newMessages.length,
                modelName
              )
            }

            // @note check iteration limit before recursing

            if (isIterationLimitReached()) {
              debug(`iteration limit reached, stopping`).log(
                'openai.conv.completeChatConversationStream'
              )

              yield {
                type: TAG_COMPLETE_END,
                data: {
                  reason: 'iteration',
                },
              }

              return
            }

            // @note warn the model once when the call budget is running low so
            // it can wrap up before the hard stop instead of being cut off
            newMessages = maybeAddCallBudgetLowNotice(
              newMessages,
              callStats,
              maxCalls
            )

            debug(
              `handling subsequent chat completions due to function call`
            ).log('openai.conv.completeChatConversationStream')

            return nextIterationOptions({
              messages: newMessages,

              // remove the called function from startFunctions

              startFunctions: startFunctions.slice(1),

              callStats,
              cycleStats,
            })
          }
        } else {
          throw new Error(
            `Unexpected state: function call without function call`
          )
        }

        return
      }

      case 'toolCalls': {
        debug(`detected tool calls reason`, { finalToolCalls }).log(
          'openai.conv.completeChatConversationStream'
        )

        if (finalToolCalls) {
          let handleSubsequentChatCompletions = true

          let abortData

          const it = yieldSequentiallyFromParallel<
            Item | (() => Promise<void>)
          >(
            finalToolCalls.map<AsyncGenerator<Item | (() => Promise<void>)>>(
              async function* (finalToolCall) {
              if (
                finalToolCall.type === 'function' ||
                'function' in finalToolCall
              ) {
                callStats.calls += 1

                const functionName = getFunctionName(
                  finalToolCall.function.name,
                  openaiFunctions
                )

                const functionArguments = getFunctionArguments(
                  finalToolCall.function.arguments,
                  openaiFunctions
                )

                const requestActivityMessage = makeRequestActivityMessage(
                  functionName,
                  functionArguments,
                  meta
                )

                // @note internally stamp the provider thought signature
                // (Gemini-3 via Cloudflare) onto the request activity so the
                // follow-up request can replay it. Deliberately kept off the
                // public message constructor - this is conversation-layer
                // plumbing, not part of the activity message API.
                {
                  const thoughtSignature =
                    finalToolCall.extra_content?.google?.thought_signature

                  if (thoughtSignature) {
                    ;(
                      requestActivityMessage.meta.activity
                        .function as ActivityFunctionWithThoughtSignature
                    ).thoughtSignature = thoughtSignature
                  }
                }

                yield {
                  type: TAG_MESSAGE,

                  data: requestActivityMessage,
                }

                yield async () => {
                  newMessages.push({
                    ...requestActivityMessage,

                    usage: {
                      tokens: -1, // negative value to indicate that the usage is not known
                    },
                  })
                }

                // @note the provider could not parse the streamed arguments as
                // JSON. Surface the parse error back to the model as the tool
                // result so it re-emits a valid call, instead of invoking the
                // handler with empty arguments and reporting a misleading
                // "missing field" downstream.

                if (finalToolCall.function.error) {
                  debug(`detected malformed tool call arguments`, {
                    functionName,
                    error: finalToolCall.function.error,
                  }).log('openai.conv.completeChatConversationStream')

                  const responseActivityMessage = makeResponseActivityMessage(
                    functionName,
                    functionArguments,
                    { error: finalToolCall.function.error },
                    {
                      ...meta,
                    }
                  )

                  yield {
                    type: TAG_MESSAGE,

                    data: responseActivityMessage,
                  }

                  yield async () => {
                    newMessages.push({
                      ...responseActivityMessage,

                      usage: {
                        tokens: -1, // negative value to indicate that the usage is not known
                      },
                    })
                  }

                  return
                }

                const func =
                  openaiFunctions?.find(({ name }) => name === functionName) ||
                  internalFunctionStubs[functionName]

                if (func) {
                  if (callStats.calls <= maxCalls) {
                    if (func.handler) {
                      debug(`invoking function handler`, {
                        functionName,
                        functionArguments,
                      }).log('openai.conv.completeChatConversationStream')

                      const toolSpan = createSpan({
                        name: `tool.${functionName}`,
                        op: 'tool.call',
                      })

                      toolSpan.setAttribute('functionName', functionName)
                      toolSpan.setAttribute('iteration', currentIterations)

                      const toolStartTime = Date.now()

                      let result

                      try {
                        // @note hand the deadline/abort signal to the handler
                        // so a cooperative tool can cancel its own in-flight
                        // work, and stop waiting for it shortly after the
                        // deadline if it does not - recording a paired timeout
                        // result in its place
                        result = await awaitWithAbortGrace(
                          Promise.resolve(
                            func.handler(functionArguments, {
                              newMessages,
                              signal: options.abortSignal,
                            })
                          ),
                          options.abortSignal,
                          HANDLER_DEADLINE_GRACE_MS,
                          () => ({ error: HANDLER_DEADLINE_BYPASS_ERROR })
                        )
                      } catch (e) {
                        await captureException(e)

                        if (e instanceof SafeError) {
                          result = { error: e.message }
                        } else {
                          result = { error: 'Function invocation exception' }
                        }
                      } finally {
                        const toolDuration = Date.now() - toolStartTime

                        toolSpan.finish()

                        // Log slow tool calls (over 30 seconds)
                        if (toolDuration > 30000) {
                          debug(`slow tool call`, {
                            functionName,
                            duration: toolDuration,
                          }).log(
                            'openai.conv.completeChatConversationStream.slowTool'
                          )

                          await captureObservation('Slow tool call', {
                            functionName,
                            duration: toolDuration,
                            model: modelName,
                            currentIterations,
                          })
                        }
                      }

                      debug(`function handler result`, {
                        functionName,
                        result,
                      }).log('openai.conv.completeChatConversationStream')

                      if (result instanceof AbortSignal) {
                        if (result.aborted) {
                          debug(`detected abort signal from tool call`, {
                            functionName,
                            reason: result.reason,
                          }).log('openai.conv.completeChatConversationStream')

                          handleSubsequentChatCompletions = false

                          abortData = abortData || {
                            reason: result.reason,
                            functionName,
                          }

                          const responseActivityMessage =
                            makeResponseActivityMessage(
                              functionName,
                              functionArguments,
                              result.reason || null,
                              {
                                ...meta,
                              }
                            )

                          yield {
                            type: TAG_MESSAGE,

                            data: responseActivityMessage,
                          }

                          yield async () => {
                            newMessages.push({
                              ...responseActivityMessage,

                              usage: {
                                tokens: -1, // negative value to indicate that the usage is not known
                              },
                            })
                          }

                          yield {
                            type: TAG_ABORT,
                            data: {
                              reason: result.reason,
                              functionName,
                            },
                          }
                        } else {
                          throw new Error(`Unexpected abort signal state`)
                        }
                      } else {
                        let thisMeta

                        if (result instanceof Result) {
                          thisMeta = result.meta
                          result = result.result
                        }

                        const functionResult =
                          tryStringifyJson(result) || 'no result'

                        const responseActivityMessage =
                          makeResponseActivityMessage(
                            functionName,
                            functionArguments,
                            functionResult,
                            {
                              ...meta,
                              ...thisMeta,
                            }
                          )

                        yield {
                          type: TAG_MESSAGE,

                          data: responseActivityMessage,
                        }

                        yield async () => {
                          newMessages.push({
                            ...responseActivityMessage,

                            usage: {
                              tokens: -1, // negative value to indicate that the usage is not known
                            },
                          })
                        }
                      }
                    } else {
                      handleSubsequentChatCompletions = false

                      // @note this is expected

                      // @todo should we even support this - perhaps it will be
                      // better to only support function calls via channels

                      debug(`detected tool calls without function handler`).log(
                        'openai.conv.completeChatConversationStream'
                      )
                    }
                  } else {
                    debug(`detected tool calls with too many calls`).log(
                      'openai.conv.completeChatConversationStream'
                    )

                    const responseActivityMessage = makeResponseActivityMessage(
                      functionName,
                      functionArguments,
                      { error: 'too many calls' },
                      {
                        ...meta,
                      }
                    )

                    yield {
                      type: TAG_MESSAGE,
                      data: responseActivityMessage,
                    }

                    yield async () => {
                      newMessages.push({
                        ...responseActivityMessage,

                        usage: {
                          tokens: -1, // negative value to indicate that the usage is not known
                        },
                      })
                    }
                  }
                } else {
                  debug(
                    `detected tool calls without corresponding function definition`
                  ).log('openai.conv.completeChatConversationStream')

                  const responseActivityMessage = makeResponseActivityMessage(
                    functionName,
                    functionArguments,
                    {
                      // @note it is important to surface the function name in
                      // order to help the agent correct the issue

                      error: `Tool ${JSON.stringify(
                        finalToolCall.function.name
                      )} function not found - correct functions names include: ${
                        openaiFunctions?.map(({ name }) => name).join(', ') ||
                        'no functions defined'
                      }. Did you forget to load/install a tool package that provides this function?`,
                    },
                    {
                      ...meta,
                    }
                  )

                  yield {
                    type: TAG_MESSAGE,
                    data: responseActivityMessage,
                  }

                  yield async () => {
                    newMessages.push({
                      ...responseActivityMessage,

                      usage: {
                        tokens: -1, // negative value to indicate that the usage is not known
                      },
                    })
                  }
                }
              } else {
                await captureUnexpectedState(
                  `Unexpected tool call type`,
                  options
                )
              }
              }
            )
          )

          for await (const item of it) {
            if (typeof item === 'function') {
              await item()
            } else {
              yield item
            }
          }

          if (abortData) {
            yield {
              type: TAG_COMPLETE_END,
              data: {
                reason: 'abort',
              },
            }

            return
          }

          if (handleSubsequentChatCompletions) {
            // @note stop when the call budget was exhausted before this round
            // even started - the model already received the 'too many calls'
            // errors in the previous round and still keeps calling tools, so
            // recursing further would loop unboundedly

            if (callBudgetExhaustedBeforeRound) {
              debug(`stopping due to exhausted call budget`, {
                callStats,
                maxCalls,
              }).log('openai.conv.completeChatConversationStream')

              observeCallLimitReached(
                'tool_calls_path',
                callStats,
                maxCalls,
                newMessages,
                modelName
              )

              yield {
                type: TAG_MESSAGE,
                data: {
                  type: BOT_MESSAGE_TYPE,
                  text: getCallLimitStopMessage(options),
                  meta: {
                    ...meta,

                    callLimitReached: true,
                  },
                },
              }

              return
            }

            // @note check for cyclic behavior before recursing

            const cycleStats = options.cycleStats || { detected: 0 }
            const maxCycles = options.maxCycles ?? DEFAULT_MAX_CYCLES

            if (
              isThreadCyclic(withoutCallBudgetNotice(newMessages), {
                minRepetitions: 2,
                minPatternLength: 2,
              })
            ) {
              cycleStats.detected += 1

              debug(`detected cyclic behavior`, {
                cycleStats,
                maxCycles,
              }).log('openai.conv.completeChatConversationStream')

              if (cycleStats.detected >= maxCycles) {
                debug(`stopping due to repeated cyclic behavior`).log(
                  'openai.conv.completeChatConversationStream'
                )

                // @note temp logging for monitoring when we stop due to cycles
                // @todo remove after monitoring period (added 2026-01-14)
                observeThreadCycleMaxReached(
                  'tool_calls_path',
                  cycleStats,
                  maxCycles,
                  newMessages,
                  modelName,
                  describeThreadCycle(withoutCallBudgetNotice(newMessages), {
                    minRepetitions: 2,
                    minPatternLength: 2,
                  })
                )

                yield {
                  type: TAG_MESSAGE,
                  data: {
                    type: BOT_MESSAGE_TYPE,
                    text: getLoopStopMessage(options),
                    meta: {
                      ...meta,

                      cycleDetected: true,
                    },
                  },
                }

                return
              }

              // @note add a warning activity to give the model a chance to
              // recover from the cycle

              newMessages = addCycleNotice(newMessages)
            } else if (cycleStats.detected > 0) {
              // @note reset the cycle counter if the cycle was broken

              cycleStats.detected = 0

              debug(`cycle broken, resetting cycle counter`).log(
                'openai.conv.completeChatConversationStream'
              )

              // @note temp logging for monitoring cycle recovery
              // @todo remove after monitoring period (added 2026-01-14)

              observeThreadCycleBroken(
                'tool_calls_path',
                newMessages.length,
                modelName
              )
            }

            // @note check iteration limit before recursing

            if (isIterationLimitReached()) {
              debug(`iteration limit reached, stopping`).log(
                'openai.conv.completeChatConversationStream'
              )

              yield {
                type: TAG_COMPLETE_END,
                data: {
                  reason: 'iteration',
                },
              }

              return
            }

            // @note warn the model once when the call budget is running low so
            // it can wrap up before the hard stop instead of being cut off
            newMessages = maybeAddCallBudgetLowNotice(
              newMessages,
              callStats,
              maxCalls
            )

            debug(`handling subsequent chat completions due to tool calls`).log(
              'openai.conv.completeChatConversationStream'
            )

            return nextIterationOptions({
              messages: newMessages,

              // remove the called function from startFunctions

              startFunctions: startFunctions.slice(1),

              callStats,
              cycleStats,
            })
          }
        } else {
          throw new Error(`Unexpected state: tool calls without tool calls`)
        }

        return
      }

      default: {
        assertUnreachable(finalFinishReason)
      }
    }
  } catch (e) {
    if (isAbortError(e)) {
      // @note an abort error can be triggered by the user or by the system
      // (e.g. timeout) in fetch or some other component of the stack and it
      // has nothing to do with the interactivity of conversation

      const duration = Date.now() - startTime

      debug(`chat completion stream aborted`, {
        model: modelName,
        duration,
        currentIterations,
        currentContinuations,
      }).log('openai.conv.completeChatConversationStream.aborted')

      await captureObservation('Chat completion stream aborted', {
        model: modelName,
        duration,
        inputTokensUsed,
        outputTokensUsed,
        currentIterations,
        currentContinuations,
        callStats: callStats.calls,
      })

      throw e
    }

    // @note catch token limit errors during streaming

    const tokenLimitDetection = detectTokenLimitError(e.message || String(e))

    if (tokenLimitDetection.isTokenLimitError) {
      debug(
        `detected token limit error during streaming, retrying with reduced tokens`,
        {
          suggestedLimit: tokenLimitDetection.suggestedLimit,
          currentMaxTokens: totalTokens,
        }
      ).log('openai.conv.completeChatConversationStream')

      if (currentContinuations <= maxContinuations) {
        // @note check iteration limit before recursing

        if (isIterationLimitReached()) {
          debug(`iteration limit reached, stopping`).log(
            'openai.conv.completeChatConversationStream'
          )

          yield {
            type: TAG_COMPLETE_END,
            data: {
              reason: 'iteration',
            },
          }

          return
        }

        debug(`retrying completion with reduced tokens`, {
          suggestedLimit: tokenLimitDetection.suggestedLimit,
          currentMaxTokens: totalTokens,
        }).log('openai.conv.completeChatConversationStream')

        return nextIterationOptions({
          // @note reduce token limit to suggested amount - use in overrideMaxTokens for calculateMaxTokens

          // @todo does not work on small models as the maxTokens do not include the backstory or the functions :(

          overrideMaxTokens: tokenLimitDetection.suggestedLimit,

          currentContinuations: currentContinuations + 1,
        })
      }
    }

    // @note handle provider content moderation / safety-filter rejections. The
    // request never reached the model, so retrying it unchanged is futile - we
    // shrink the conversation and retry, bounded by the continuation budget.
    // When there is nothing left to drop, or the budget is exhausted, surface a
    // clean ContentModerationError rather than the opaque provider bad-request.

    if (isContentModerationError(e)) {
      hasError = true

      if (currentContinuations <= maxContinuations) {
        if (isIterationLimitReached()) {
          debug(`iteration limit reached, stopping`).log(
            'openai.conv.completeChatConversationStream'
          )

          yield {
            type: TAG_COMPLETE_END,
            data: {
              reason: 'iteration',
            },
          }

          return
        }

        const reducedMessages = reduceMessagesForModeration(options.messages)

        if (reducedMessages) {
          debug(`retrying completion after content moderation rejection`, {
            currentContinuations,
            maxContinuations,
            before: options.messages?.length,
            after: reducedMessages.length,
          }).log('openai.conv.completeChatConversationStream')

          return nextIterationOptions({
            messages: reducedMessages,

            currentContinuations: currentContinuations + 1,
          })
        }
      }

      throw e instanceof ContentModerationError
        ? e
        : new ContentModerationError(
            e?.message || 'Request blocked by content moderation'
          )
    }

    // @note a transient provider failure - a stalled request or an upstream 5xx
    // the adaptor could not outlast - is re-issued here, bounded by the same
    // iteration + continuation budget as the other recoverable errors (and by
    // the round-start deadline check). An AbortError - the hard deadline - is
    // re-thrown above and never reaches here. See isRecoverableProviderError.

    if (isRecoverableProviderError(e)) {
      if (currentContinuations <= maxContinuations) {
        if (isIterationLimitReached()) {
          debug(`iteration limit reached, stopping`).log(
            'openai.conv.completeChatConversationStream'
          )

          yield {
            type: TAG_COMPLETE_END,
            data: {
              reason: 'iteration',
            },
          }

          return
        }

        const cause = getRecoverableProviderErrorCause(e)

        debug(`retrying completion after recoverable provider error`, {
          model: modelName,
          cause,
          currentContinuations,
          maxContinuations,
        }).log('openai.conv.completeChatConversationStream')

        await captureObservation('Chat completion stream error retried', {
          model: modelName,
          cause,
          currentIterations,
          currentContinuations,
        })

        // @note close the current completion before recursing - the retry emits
        // its own completeBegin/completeEnd pair (mirrors the in-stream error path)

        yield {
          type: TAG_COMPLETE_END,
          data: {
            reason: 'error',
          },
        }

        return nextIterationOptions({
          currentContinuations: currentContinuations + 1,
        })
      }
    }

    // @note re-throw non-token-limit errors

    hasError = true

    throw e
  } finally {
    const duration = Date.now() - startTime

    span.setAttribute('inputTokensUsed', inputTokensUsed)
    span.setAttribute('outputTokensUsed', outputTokensUsed)
    span.setAttribute('currentIterations', currentIterations)
    span.setAttribute('callStats', callStats.calls)
    span.finish()

    // Log slow operations (over 30 seconds)
    if (duration > 30000) {
      debug(`slow chat completion stream`, {
        model: modelName,
        duration,
        inputTokensUsed,
        outputTokensUsed,
        currentIterations,
        callStats: callStats.calls,
      }).log('openai.conv.completeChatConversationStream.slow')

      await captureObservation('Slow chat completion stream', {
        model: modelName,
        duration,
        inputTokensUsed,
        outputTokensUsed,
        currentIterations,
        currentContinuations,
        callStats: callStats.calls,
        hasFunctions: Boolean(openaiFunctions?.length),
      })
    }

    // @note skip usage reporting when the request failed before streaming
    // started. If the provider started delivering chunks we still report
    // usage because input tokens were already consumed.

    if (!hasError || hasStreamed) {
      yield {
        type: TAG_USAGE,
        data: {
          model: modelName,
          inputTokensUsed: inputTokensUsed,
          outputTokensUsed: outputTokensUsed,
        },
      }
    }
  }
}

/**
 * Drives the chat agentic loop. Each round (completeChatConversationRound)
 * returns the options for the next round, or undefined to stop. Because a round
 * generator fully returns - and is popped off the call stack - before the next
 * round begins, stack depth stays O(1) regardless of how many iterations run.
 *
 * @note The previous form recursed via `yield* completeChatConversation(...)`,
 * which kept one generator-delegation layer on the stack per round and overflowed
 * the call stack on long agentic runs.
 */
export async function* completeChatConversationStream(
  options: CompleteChatConversationStreamOptions
): ConversationOutput {
  let next: CompleteChatConversationStreamOptions | undefined = options

  while (next !== undefined) {
    next = yield* completeChatConversationRound(next)
  }
}

type CompleteResponseConversationStreamOptions = {
  createResponseCompletionStream?: typeof createResponseCompletionStream
  startFunctions?: string[]
  endFunctions?: string[]
  overrideMaxTokens?: number
} & GetNameOptions &
  ConversationInput

async function* completeResponseConversationRound(
  options: CompleteResponseConversationStreamOptions
): AsyncGenerator<Item, CompleteResponseConversationStreamOptions | undefined> {
  debug(`completeResponseConversationStream`, {
    options: summarizeOptionsForDebug(options),
  }).log('openai.conv.completeResponseConversationStream')

  const meta = options.meta

  const model = options.model

  const { name: modelName, config: modelConfig } =
    parseAndRevealLanguageModel(model)

  const { inputTokens, totalTokens } = calculateMaxTokens(
    modelName,
    options.overrideMaxTokens || modelConfig.maxInputTokens,
    options.messages
  )

  const temperature = modelConfig.temperature

  const reasoningEffort = modelConfig.reasoningEffort

  const user = options.clientId

  const fn =
    options.createResponseCompletionStream || createResponseCompletionStream

  const openaiFunctions =
    typeof options.functions === 'function'
      ? await options.functions()
      : options.functions

  const { messages, usage } = await optimizeMessages(
    options.messages,
    openaiFunctions,

    inputTokens,

    options
  )

  const { instructions, input } = await convertMessagesToResponseInput(
    messages,
    model,
    options
  )

  const startFunctions = options.startFunctions || []
  const endFunctions = options.endFunctions || []

  const currentIterations = Math.max(options.currentIterations ?? 0, 0)
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS

  const currentContinuations = Math.max(options.currentContinuations || 0, 0)
  const maxContinuations = options.maxContinuations ?? DEFAULT_MAX_CONTINUATIONS

  const settleStats = options.settleStats || { nudges: 0 }

  settleStats.nudges = Math.max(settleStats.nudges ?? 0, 0)

  const maxSettles = options.maxSettles ?? 0

  const callStats = options.callStats || { calls: 0 }

  callStats.calls = Math.max(callStats.calls ?? 0, 0)

  const maxCalls = options.maxCalls ?? DEFAULT_MAX_CALLS

  // @note when the call budget was already exhausted before this round even
  // started, every call made in this round is rejected with 'too many calls'
  // and the model has already had a full round to see those errors and wrap
  // up - we use this to stop the recursion below as cycle detection alone
  // cannot catch a runaway model that varies its arguments on every call

  const callBudgetExhaustedBeforeRound = callStats.calls > maxCalls

  debug(`using`, {
    currentIterations,
    maxIterations,
    currentContinuations,
    maxContinuations,
    callStats,
    maxCalls,
    startFunctions,
    endFunctions,
  }).log('openai.conv.completeResponseConversationStream')

  let inputTokensUsed = usage.tokens
  let outputTokensUsed = 0

  let hasError = false
  let hasStreamed = false

  const span = createSpan({
    name: 'openai.completeResponseConversationStream',
    op: 'ai.completion',
  })

  span.setAttribute('model', modelName)
  span.setAttribute('hasFunctions', Boolean(openaiFunctions?.length))

  const startTime = Date.now()

  /**
   * Checks if the iteration limit has been reached and we should stop recursing.
   *
   * @note We check if the NEXT iteration would exceed the limit. Since
   * currentIterations is 0-indexed (first call = 0, second = 1, etc.),
   * we need to check if currentIterations + 1 >= maxIterations.
   *
   * Example: maxIterations = 2
   * - Call 1 (ci=0): check 0+1 >= 2? No → proceed
   * - Call 2 (ci=1): check 1+1 >= 2? Yes → stop (don't recurse)
   * Result: 2 calls made
   *
   * @returns {boolean} true if we should stop recursing due to iteration limit
   */
  const isIterationLimitReached = () =>
    iterationLimitReached({
      yieldSignal: options.yieldSignal,
      currentIterations,
      maxIterations,
    })

  /**
   * Creates options for the next recursive call with incremented iteration.
   *
   * @param {object} additionalOptions - additional options to merge
   * @returns {object} options for the next recursive call
   */
  const nextIterationOptions = (additionalOptions = {}) => ({
    ...options,

    currentIterations: currentIterations + 1,

    ...additionalOptions,
  })

  try {
    yield {
      type: TAG_COMPLETE_BEGIN,
      data: {},
    }

    const stream = fn({
      model: modelName,

      // @note metric label only - lets an observability dashboard break TTFT /
      // throughput down by provider (resolved here from the model config)
      provider: modelConfig.provider,

      // @note not specifying the max tokens will result in using all available
      // tokens in the model

      // maxTokens: maxOutputTokens,

      temperature: temperature,

      ...(reasoningEffort && reasoningEffort !== 'auto'
        ? { reasoning: { effort: reasoningEffort } }
        : null),

      user: user,

      input: input,

      ...(instructions ? { instructions } : null),

      ...(openaiFunctions?.length
        ? {
            tools: openaiFunctions.map(({ name, description, parameters }) => ({
              type: 'function' as const,

              name,
              description,
              parameters,

              strict: false,
            })),

            toolChoice:
              // force the first start function if any remain
              startFunctions.length > 0
                ? { type: 'function' as const, name: startFunctions[0] }
                : 'auto',
          }
        : null),

      // Pass abort signal for timeout support
      ...(options.abortSignal ? { signal: options.abortSignal } : null),
    })

    let fullReasoning = ''

    let fullText = ''

    const runawayGuard = createRepetitionGuard({
      minChars: RUNAWAY_GUARD_MIN_CHARS,
    })

    let runawayDetected = false

    let finalFinishReason: Exclude<
      CreateResponseCompletionStreamFinishReason,
      null
    > = 'stop'

    let finalToolCalls: OpenAIResponseToolCall[] | null = null

    for await (const {
      error,

      reasoning,

      completion: text,

      finishReason,

      usage,

      toolCalls,
    } of stream) {
      hasStreamed = true

      // handle error

      if (error) {
        debug(`detected error`, { error }).log(
          'openai.conv.completeResponseConversationStream'
        )

        // @todo the continuation must be applied based on the error type - not
        // all errors are the same

        if (currentContinuations <= maxContinuations) {
          // @note check iteration limit before recursing

          if (isIterationLimitReached()) {
            debug(`iteration limit reached, stopping`).log(
              'openai.conv.completeResponseConversationStream'
            )

            yield {
              type: TAG_COMPLETE_END,
              data: {
                reason: 'iteration',
              },
            }

            return
          }

          debug(`retrying completion because of error`, {
            currentContinuations,
            maxContinuations,
          }).log('openai.conv.completeResponseConversationStream')

          // @note close the current completion before recursing - the retry
          // emits its own completeBegin/completeEnd pair and without this the
          // outer completeBegin would never be balanced by an end

          yield {
            type: TAG_COMPLETE_END,
            data: {
              reason: 'error',
            },
          }

          return nextIterationOptions({
            currentContinuations: currentContinuations + 1,
          })
        } else {
          const { message, code } = error

          throw new SystemError(message, code)
        }
      }

      // handle reasoning

      if (reasoning) {
        outputTokensUsed += 1

        fullReasoning += reasoning

        yield {
          type: TAG_REASONING_TOKEN,
          data: {
            token: reasoning,
          },
        }
      }

      // handle text

      if (text) {
        outputTokensUsed += 1

        fullText += text

        yield {
          type: TAG_TOKEN,
          data: {
            token: text,
          },
        }
      }

      // @note guard against runaway in-message repetition. The guard is O(1) per
      // chunk so it runs on every token and trips within a few repeats of a
      // tight loop, before much garbage is streamed.
      //
      // @note only the user-visible answer text is guarded. The reasoning
      // (chain-of-thought) channel is deliberately exempt: it
      // is the model's scratchpad, where it legitimately drafts and re-verifies
      // repetitive structures - tables, ASCII grids, enumerations - that are
      // indistinguishable from a loop on lexical diversity alone; it is not shown
      // as the answer, and it is already bounded by maxTokens, so tripping there
      // only aborts otherwise-good turns mid-thought. Activity (tool-call) output
      // is never fed here either. A genuinely degenerate answer still trips.
      {
        if (text && runawayGuard.push(text)) {
          runawayDetected = true

          debug(`detected runaway in-message repetition, stopping stream`, {
            reasoningLength: fullReasoning.length,
            textLength: fullText.length,
          }).log('openai.conv.completeResponseConversationStream')

          break
        }
      }

      // handle finish reason

      if (finishReason) {
        finalFinishReason = finishReason
      }

      // handle usage

      if (usage) {
        debug(`usage`, {
          inputTokensUsed,
          outputTokensUsed,

          usage,

          inputTokensDelta: usage.promptTokens - inputTokensUsed,
          outputTokensDelta: usage.completionTokens - outputTokensUsed,
        }).log('openai.conv.completeResponseConversationStream.usage')

        // @todo measure drift

        inputTokensUsed = usage.promptTokens
        outputTokensUsed = usage.completionTokens
      }

      // handle tool calls

      if (toolCalls) {
        // @todo find a better way to count the tool call tokens

        outputTokensUsed += (
          await estimateMessageUsage({
            type: TMP_FUNCTIONS_MESSAGE_TYPE,
            text: '',
            meta: toolCalls,
          })
        ).tokens

        finalToolCalls = toolCalls
      }
    }

    if (runawayDetected) {
      observeRunawayTextRun(
        'chat_completion_path',
        fullReasoning.length + fullText.length,
        modelName,
        {
          reason: runawayGuard.reason(),
          sample: `${fullReasoning}\n${fullText}`.slice(-1500),
          messages,
        }
      )

      yield {
        type: TAG_MESSAGE,
        data: {
          type: BOT_MESSAGE_TYPE,
          text: getRunawayStopMessage(options, runawayGuard.reason()),
          meta: {
            ...meta,

            cycleDetected: true,
            runawayTextDetected: true,
          },
        },
      }

      yield {
        type: TAG_COMPLETE_END,
        data: {
          reason: 'stop',
        },
      }

      return
    }

    let newMessages: Array<Message | MessageWithUsage> = messages
      // @note obtain a copy
      .slice()
      // @note we need to remove trigger activity messages if any
      .filter(
        (message) =>
          !(
            message.type === ACTIVITY_MESSAGE_TYPE &&
            message.meta?.activity?.type === TRIGGER_ACTIVITY_TYPE
          )
      )

    if (fullReasoning) {
      const botReasoningMessage: Message = {
        type: REASONING_MESSAGE_TYPE,
        text: fullReasoning,
        meta: {
          ...meta,
        },
      }

      yield {
        type: TAG_MESSAGE,
        data: botReasoningMessage,
      }

      newMessages.push({
        ...botReasoningMessage,

        usage: {
          tokens: outputTokensUsed,
        },
      })
    }

    if (fullText) {
      const botMessage: Message = {
        type: BOT_MESSAGE_TYPE,
        text: fullText,
        meta: {
          ...meta,
        },
      }

      yield {
        type: TAG_MESSAGE,
        data: botMessage,
      }

      newMessages.push({
        ...botMessage,

        usage: {
          tokens: outputTokensUsed,
        },
      })
    }

    yield {
      type: TAG_COMPLETE_END,
      data: {
        reason: mapFinishReasonToCompleteReason(finalFinishReason),
      },
    }

    // @todo finalFinishReason should be handled by the API, not this

    switch (finalFinishReason) {
      case 'error': {
        debug(`detected error finish reason`).log(
          'openai.conv.completeResponseConversationStream'
        )

        // @note an `error` finish reason is a provider/stream failure that
        // arrived as a terminal reason instead of a mid-stream error event.
        // Recover the same way the mid-stream error path does: retry within the
        // continuation budget so a transient hiccup does not abandon the turn.
        // This matters most in settle mode, where the run is only "done" once the
        // model calls a terminal tool (`_success` / `_failure`) - a silent return
        // here would leave the run permanently unsettled (recorded `incomplete`).

        if (
          currentContinuations <= maxContinuations &&
          !isIterationLimitReached()
        ) {
          debug(`retrying completion because of error finish reason`, {
            currentContinuations,
            maxContinuations,
          }).log('openai.conv.completeResponseConversationStream')

          return nextIterationOptions({
            currentContinuations: currentContinuations + 1,
          })
        }

        // @note retries exhausted - the catastrophic case. Surface it to Sentry
        // (a silent observation previously hid these incidents). The `error`
        // complete-end already emitted above stands, so the caller still sees a
        // non-abort reason and treats the run as incomplete.

        observeErrorFinishReasonExhausted(
          'response_completion_path',
          modelName,
          {
            currentIterations,
            currentContinuations,
            maxContinuations,
            callStats,
          }
        )

        return
      }

      case 'stop': {
        debug(`detected stop reason`).log(
          'openai.conv.completeResponseConversationStream'
        )

        // check if there are end functions to call

        if (endFunctions.length > 0) {
          debug(`calling end function`, {
            nextEndFunction: endFunctions[0],
          }).log('openai.conv.completeResponseConversationStream')

          // @note check iteration limit before recursing

          if (isIterationLimitReached()) {
            debug(`iteration limit reached, stopping`).log(
              'openai.conv.completeResponseConversationStream'
            )

            yield {
              type: TAG_COMPLETE_END,
              data: {
                reason: 'iteration',
              },
            }

            return
          }

          return nextIterationOptions({
            messages: newMessages,

            // force the first end function and pass remaining

            startFunctions: [endFunctions[0]],
            endFunctions: endFunctions.slice(1),

            currentContinuations: 0,
          })
        }

        // @note in settle mode a plain stop means the model ended its turn
        // without calling a terminal tool (`_success` / `_failure`, which exit
        // via abort). Nudge it and continue - bounded by the settle budget and,
        // when set, the iteration limit - so the run is driven to settlement.
        // Once the budget (or iteration limit) is spent, surface the turn as an
        // `iteration` so a caller loop continues instead of treating the
        // unsettled stop as a finished run.

        if (maxSettles > 0) {
          if (settleStats.nudges < maxSettles && !isIterationLimitReached()) {
            settleStats.nudges += 1

            debug(`settle nudge, continuing`, {
              nudges: settleStats.nudges,
              maxSettles,
            }).log('openai.conv.completeResponseConversationStream')

            return nextIterationOptions({
              messages: addSettleNotice(newMessages),

              // @note carry the (mutated) settle counter into the recursion so
              // the budget accumulates across nudges, like callStats/cycleStats
              settleStats,
            })
          }

          // @note settle budget (or iteration limit) spent without the model
          // calling a terminal tool. Surface it to Sentry so an agent that never
          // completes is visible, then hand the caller `iteration` so the
          // unsettled run is handled rather than mistaken for a finished one.

          observeSettleExhausted('response_completion_path', modelName, {
            nudges: settleStats.nudges,
            maxSettles,
            currentIterations,
          })

          yield {
            type: TAG_COMPLETE_END,
            data: {
              reason: 'iteration',
            },
          }

          return
        }

        if (!fullText && !options.background) {
          // @note a `stop` with neither answer text nor a tool call is an empty
          // turn. Retrying rarely recovers - a model that returns empty once
          // tends to repeat - so this tight guard bails well before the generic
          // continuation budget (mirrors the cyclic-behaviour guard). Unlike the
          // old silent return, exhaustion surfaces a Sentry observation and a
          // user-facing stop message so a turn that produces nothing is not left
          // blank and invisible.

          const emptyStats = options.emptyStats || { count: 0 }
          const maxEmpties = options.maxEmpties ?? DEFAULT_MAX_EMPTIES

          emptyStats.count += 1

          if (emptyStats.count >= maxEmpties) {
            observeEmptyExhausted('response_completion_path', modelName, {
              empties: emptyStats.count,
              maxEmpties,
              currentContinuations,
              currentIterations,
            })

            yield {
              type: TAG_MESSAGE,
              data: {
                type: BOT_MESSAGE_TYPE,
                text: getLoopStopMessage(options),
                meta: {
                  ...meta,

                  emptyExhausted: true,
                },
              },
            }

            return
          }

          if (currentContinuations <= maxContinuations) {
            // @note check iteration limit before recursing

            if (isIterationLimitReached()) {
              debug(`iteration limit reached, stopping`).log(
                'openai.conv.completeResponseConversationStream'
              )

              yield {
                type: TAG_COMPLETE_END,
                data: {
                  reason: 'iteration',
                },
              }

              return
            }

            debug(
              `retrying completion because of stop finish reason and no text was generated`,
              {
                empties: emptyStats.count,
                maxEmpties,
                currentContinuations,
                maxContinuations,
              }
            ).log('openai.conv.completeResponseConversationStream')

            // @note retry with newMessages (not the pre-response snapshot) so
            // any reasoning the model just produced - and that was already
            // emitted to the consumer - stays part of the retry context

            return nextIterationOptions({
              messages: addEmptyNotice(newMessages),

              currentContinuations: currentContinuations + 1,

              // @note carry the (mutated) empty counter into the recursion so
              // the budget accumulates across empty turns, like settleStats
              emptyStats,
            })
          }
        }

        return
      }

      case 'length': {
        debug(`detected length reason`).log(
          'openai.conv.completeResponseConversationStream'
        )

        if (currentContinuations <= maxContinuations) {
          // @note check iteration limit before recursing

          if (isIterationLimitReached()) {
            debug(`iteration limit reached, stopping`).log(
              'openai.conv.completeResponseConversationStream'
            )

            yield {
              type: TAG_COMPLETE_END,
              data: {
                reason: 'iteration',
              },
            }

            return
          }

          debug(`retrying completion because of length finish reason`, {
            currentContinuations,
            maxContinuations,
          }).log('openai.conv.completeResponseConversationStream')

          return nextIterationOptions({
            messages: messages.concat({
              type: BOT_MESSAGE_TYPE,
              text: fullText,
              usage: {
                tokens: outputTokensUsed,
              },
            }),

            currentContinuations: currentContinuations + 1,
          })
        }

        return
      }

      case 'contentFilter': {
        debug(`detected content filter reason`).log(
          'openai.conv.completeResponseConversationStream'
        )

        // @note the provider's content filter is a deterministic safety refusal,
        // not a bug - it is not retried (the same content would just re-filter).
        // Surface it to Sentry at `info` level so a run dying to a filter is
        // visible without reading as an alert.

        observeContentFilter('response_completion_path', modelName)

        // @todo should we continue

        return
      }

      case 'toolCalls': {
        debug(`detected tool calls reason`, { finalToolCalls }).log(
          'openai.conv.completeResponseConversationStream'
        )

        if (finalToolCalls) {
          let handleSubsequentChatCompletions = true

          let abortData

          const it = yieldSequentiallyFromParallel<
            Item | (() => Promise<void>)
          >(
            finalToolCalls.map<AsyncGenerator<Item | (() => Promise<void>)>>(
              async function* (finalToolCall) {
              if (finalToolCall.type === 'function') {
                callStats.calls += 1

                const functionName = getFunctionName(
                  finalToolCall.name,
                  openaiFunctions
                )

                const functionArguments = getFunctionArguments(
                  finalToolCall.arguments,
                  openaiFunctions
                )

                const requestActivityMessage = makeRequestActivityMessage(
                  functionName,
                  functionArguments,
                  meta
                )

                yield {
                  type: TAG_MESSAGE,

                  data: requestActivityMessage,
                }

                yield async () => {
                  newMessages.push({
                    ...requestActivityMessage,

                    usage: {
                      tokens: -1, // negative value to indicate that the usage is not known
                    },
                  })
                }

                // @note the provider could not parse the streamed arguments as
                // JSON. Surface the parse error back to the model as the tool
                // result so it re-emits a valid call, instead of invoking the
                // handler with empty arguments and reporting a misleading
                // "missing field" downstream.

                if (finalToolCall.error) {
                  debug(`detected malformed tool call arguments`, {
                    functionName,
                    error: finalToolCall.error,
                  }).log('openai.conv.completeChatConversationStream')

                  const responseActivityMessage = makeResponseActivityMessage(
                    functionName,
                    functionArguments,
                    { error: finalToolCall.error },
                    {
                      ...meta,
                    }
                  )

                  yield {
                    type: TAG_MESSAGE,

                    data: responseActivityMessage,
                  }

                  yield async () => {
                    newMessages.push({
                      ...responseActivityMessage,

                      usage: {
                        tokens: -1, // negative value to indicate that the usage is not known
                      },
                    })
                  }

                  return
                }

                const func =
                  openaiFunctions?.find(({ name }) => name === functionName) ||
                  internalFunctionStubs[functionName]

                if (func) {
                  if (callStats.calls <= maxCalls) {
                    if (func.handler) {
                      debug(`invoking function handler`, {
                        functionName,
                        functionArguments,
                      }).log('openai.conv.completeResponseConversationStream')

                      const toolSpan = createSpan({
                        name: `tool.${functionName}`,
                        op: 'tool.call',
                      })

                      toolSpan.setAttribute('functionName', functionName)
                      toolSpan.setAttribute('iteration', currentIterations)

                      const toolStartTime = Date.now()

                      let result

                      try {
                        // @note hand the deadline/abort signal to the handler
                        // so a cooperative tool can cancel its own in-flight
                        // work, and stop waiting for it shortly after the
                        // deadline if it does not - recording a paired timeout
                        // result in its place
                        result = await awaitWithAbortGrace(
                          Promise.resolve(
                            func.handler(functionArguments, {
                              newMessages,
                              signal: options.abortSignal,
                            })
                          ),
                          options.abortSignal,
                          HANDLER_DEADLINE_GRACE_MS,
                          () => ({ error: HANDLER_DEADLINE_BYPASS_ERROR })
                        )
                      } catch (e) {
                        await captureException(e)

                        if (e instanceof SafeError) {
                          result = { error: e.message }
                        } else {
                          result = { error: 'Function invocation exception' }
                        }
                      } finally {
                        const toolDuration = Date.now() - toolStartTime

                        toolSpan.finish()

                        // Log slow tool calls (over 30 seconds)
                        if (toolDuration > 30000) {
                          debug(`slow tool call`, {
                            functionName,
                            duration: toolDuration,
                          }).log(
                            'openai.conv.completeResponseConversationStream.slowTool'
                          )

                          await captureObservation('Slow tool call', {
                            functionName,
                            duration: toolDuration,
                            model: modelName,
                            currentIterations,
                          })
                        }
                      }

                      debug(`function handler result`, {
                        functionName,
                        result,
                      }).log('openai.conv.completeResponseConversationStream')

                      if (result instanceof AbortSignal) {
                        if (result.aborted) {
                          debug(`detected abort signal from tool call`, {
                            functionName,
                            reason: result.reason,
                          }).log(
                            'openai.conv.completeResponseConversationStream'
                          )

                          handleSubsequentChatCompletions = false

                          abortData = abortData || {
                            reason: result.reason,
                            functionName,
                          }

                          const responseActivityMessage =
                            makeResponseActivityMessage(
                              functionName,
                              functionArguments,
                              result.reason || null,
                              {
                                ...meta,
                              }
                            )

                          yield {
                            type: TAG_MESSAGE,

                            data: responseActivityMessage,
                          }

                          yield async () => {
                            newMessages.push({
                              ...responseActivityMessage,

                              usage: {
                                tokens: -1, // negative value to indicate that the usage is not known
                              },
                            })
                          }

                          yield {
                            type: TAG_ABORT,
                            data: {
                              reason: result.reason,
                              functionName,
                            },
                          }
                        } else {
                          throw new Error(`Unexpected abort signal state`)
                        }
                      } else {
                        let thisMeta

                        if (result instanceof Result) {
                          thisMeta = result.meta
                          result = result.result
                        }

                        const functionResult =
                          tryStringifyJson(result) || 'no result'

                        const responseActivityMessage =
                          makeResponseActivityMessage(
                            functionName,
                            functionArguments,
                            functionResult,
                            {
                              ...meta,
                              ...thisMeta,
                            }
                          )

                        yield {
                          type: TAG_MESSAGE,

                          data: responseActivityMessage,
                        }

                        yield async () => {
                          newMessages.push({
                            ...responseActivityMessage,

                            usage: {
                              tokens: -1, // negative value to indicate that the usage is not known
                            },
                          })
                        }
                      }
                    } else {
                      handleSubsequentChatCompletions = false

                      // @note this is expected

                      // @todo should we even support this - perhaps it will be
                      // better to only support function calls via channels

                      debug(`detected tool calls without function handler`).log(
                        'openai.conv.completeResponseConversationStream'
                      )
                    }
                  } else {
                    debug(`detected tool calls with too many calls`).log(
                      'openai.conv.completeResponseConversationStream'
                    )

                    const responseActivityMessage = makeResponseActivityMessage(
                      functionName,
                      functionArguments,
                      { error: 'too many calls' },
                      {
                        ...meta,
                      }
                    )

                    yield {
                      type: TAG_MESSAGE,
                      data: responseActivityMessage,
                    }

                    yield async () => {
                      newMessages.push({
                        ...responseActivityMessage,

                        usage: {
                          tokens: -1, // negative value to indicate that the usage is not known
                        },
                      })
                    }
                  }
                } else {
                  debug(
                    `detected tool calls without corresponding function definition`
                  ).log('openai.conv.completeResponseConversationStream')

                  const responseActivityMessage = makeResponseActivityMessage(
                    functionName,
                    functionArguments,
                    {
                      // @note it is important to surface the function name in
                      // order to help the agent correct the issue

                      error: `Tool ${JSON.stringify(
                        finalToolCall.name
                      )} function not found - correct functions names include: ${
                        openaiFunctions?.map(({ name }) => name).join(', ') ||
                        'no functions defined'
                      }. Did you forget to load/install a tool package that provides this function?`,
                    },
                    {
                      ...meta,
                    }
                  )

                  yield {
                    type: TAG_MESSAGE,
                    data: responseActivityMessage,
                  }

                  yield async () => {
                    newMessages.push({
                      ...responseActivityMessage,

                      usage: {
                        tokens: -1, // negative value to indicate that the usage is not known
                      },
                    })
                  }
                }
              } else {
                await captureUnexpectedState(
                  `Unexpected tool call type`,
                  options
                )
              }
              }
            )
          )

          for await (const item of it) {
            if (typeof item === 'function') {
              await item()
            } else {
              yield item
            }
          }

          if (abortData) {
            yield {
              type: TAG_COMPLETE_END,
              data: {
                reason: 'abort',
              },
            }

            return
          }

          if (handleSubsequentChatCompletions) {
            // @note stop when the call budget was exhausted before this round
            // even started - the model already received the 'too many calls'
            // errors in the previous round and still keeps calling tools, so
            // recursing further would loop unboundedly

            if (callBudgetExhaustedBeforeRound) {
              debug(`stopping due to exhausted call budget`, {
                callStats,
                maxCalls,
              }).log('openai.conv.completeResponseConversationStream')

              observeCallLimitReached(
                'tool_calls_path',
                callStats,
                maxCalls,
                newMessages,
                modelName
              )

              yield {
                type: TAG_MESSAGE,
                data: {
                  type: BOT_MESSAGE_TYPE,
                  text: getCallLimitStopMessage(options),
                  meta: {
                    ...meta,

                    callLimitReached: true,
                  },
                },
              }

              return
            }

            // @note check for cyclic behavior before recursing

            const cycleStats = options.cycleStats || { detected: 0 }
            const maxCycles = options.maxCycles ?? DEFAULT_MAX_CYCLES

            if (
              isThreadCyclic(withoutCallBudgetNotice(newMessages), {
                minRepetitions: 2,
                minPatternLength: 2,
              })
            ) {
              cycleStats.detected += 1

              debug(`detected cyclic behavior`, {
                cycleStats,
                maxCycles,
              }).log('openai.conv.completeResponseConversationStream')

              if (cycleStats.detected >= maxCycles) {
                debug(`stopping due to repeated cyclic behavior`).log(
                  'openai.conv.completeResponseConversationStream'
                )

                // @note temp logging for monitoring when we stop due to cycles
                // @todo remove after monitoring period (added 2026-01-14)
                observeThreadCycleMaxReached(
                  'tool_calls_path',
                  cycleStats,
                  maxCycles,
                  newMessages,
                  modelName,
                  describeThreadCycle(withoutCallBudgetNotice(newMessages), {
                    minRepetitions: 2,
                    minPatternLength: 2,
                  })
                )

                yield {
                  type: TAG_MESSAGE,
                  data: {
                    type: BOT_MESSAGE_TYPE,
                    text: getLoopStopMessage(options),
                    meta: {
                      ...meta,

                      cycleDetected: true,
                    },
                  },
                }

                return
              }

              // @note add a warning activity to give the model a chance to
              // recover from the cycle

              newMessages = addCycleNotice(newMessages)
            } else if (cycleStats.detected > 0) {
              // @note reset the cycle counter if the cycle was broken

              cycleStats.detected = 0

              debug(`cycle broken, resetting cycle counter`).log(
                'openai.conv.completeResponseConversationStream'
              )

              // @note temp logging for monitoring cycle recovery
              // @todo remove after monitoring period (added 2026-01-14)

              observeThreadCycleBroken(
                'tool_calls_path',
                newMessages.length,
                modelName
              )
            }

            // @note check iteration limit before recursing

            if (isIterationLimitReached()) {
              debug(`iteration limit reached, stopping`).log(
                'openai.conv.completeResponseConversationStream'
              )

              yield {
                type: TAG_COMPLETE_END,
                data: {
                  reason: 'iteration',
                },
              }

              return
            }

            // @note warn the model once when the call budget is running low so
            // it can wrap up before the hard stop instead of being cut off
            newMessages = maybeAddCallBudgetLowNotice(
              newMessages,
              callStats,
              maxCalls
            )

            debug(`handling subsequent chat completions due to tool calls`).log(
              'openai.conv.completeResponseConversationStream'
            )

            return nextIterationOptions({
              messages: newMessages,

              // remove the called function from startFunctions

              startFunctions: startFunctions.slice(1),

              callStats,
              cycleStats,
            })
          }
        } else {
          throw new Error(`Unexpected state: tool calls without tool calls`)
        }

        return
      }

      default: {
        assertUnreachable(finalFinishReason)
      }
    }
  } catch (e) {
    if (isAbortError(e)) {
      // @note an abort error can be triggered by the user or by the system
      // (e.g. timeout) in fetch or some other component of the stack and it
      // has nothing to do with the interactivity of conversation

      const duration = Date.now() - startTime

      debug(`response completion stream aborted`, {
        model: modelName,
        duration,
        currentIterations,
        currentContinuations,
      }).log('openai.conv.completeResponseConversationStream.aborted')

      await captureObservation('Response completion stream aborted', {
        model: modelName,
        duration,
        inputTokensUsed,
        outputTokensUsed,
        currentIterations,
        currentContinuations,
        callStats: callStats.calls,
      })

      throw e
    }

    // @note catch token limit errors during streaming

    const tokenLimitDetection = detectTokenLimitError(e.message || String(e))

    if (tokenLimitDetection.isTokenLimitError) {
      debug(
        `detected token limit error during streaming, retrying with reduced tokens`,
        {
          suggestedLimit: tokenLimitDetection.suggestedLimit,
          currentMaxTokens: totalTokens,
        }
      ).log('openai.conv.completeResponseConversationStream')

      if (currentContinuations <= maxContinuations) {
        // @note check iteration limit before recursing

        if (isIterationLimitReached()) {
          debug(`iteration limit reached, stopping`).log(
            'openai.conv.completeResponseConversationStream'
          )

          yield {
            type: TAG_COMPLETE_END,
            data: {
              reason: 'iteration',
            },
          }

          return
        }

        debug(`retrying completion with reduced tokens`, {
          suggestedLimit: tokenLimitDetection.suggestedLimit,
          currentMaxTokens: totalTokens,
        }).log('openai.conv.completeResponseConversationStream')

        return nextIterationOptions({
          // @note reduce token limit to suggested amount - use in overrideMaxTokens for calculateMaxTokens

          // @todo does not work on small models as the maxTokens do not include the backstory or the functions :(

          overrideMaxTokens: tokenLimitDetection.suggestedLimit,

          currentContinuations: currentContinuations + 1,
        })
      }
    }

    // @note handle provider content moderation / safety-filter rejections. The
    // request never reached the model, so retrying it unchanged is futile - we
    // shrink the conversation and retry, bounded by the continuation budget.
    // When there is nothing left to drop, or the budget is exhausted, surface a
    // clean ContentModerationError rather than the opaque provider bad-request.

    if (isContentModerationError(e)) {
      hasError = true

      if (currentContinuations <= maxContinuations) {
        if (isIterationLimitReached()) {
          debug(`iteration limit reached, stopping`).log(
            'openai.conv.completeResponseConversationStream'
          )

          yield {
            type: TAG_COMPLETE_END,
            data: {
              reason: 'iteration',
            },
          }

          return
        }

        const reducedMessages = reduceMessagesForModeration(options.messages)

        if (reducedMessages) {
          debug(`retrying completion after content moderation rejection`, {
            currentContinuations,
            maxContinuations,
            before: options.messages?.length,
            after: reducedMessages.length,
          }).log('openai.conv.completeResponseConversationStream')

          return nextIterationOptions({
            messages: reducedMessages,

            currentContinuations: currentContinuations + 1,
          })
        }
      }

      throw e instanceof ContentModerationError
        ? e
        : new ContentModerationError(
            e?.message || 'Request blocked by content moderation'
          )
    }

    // @note a transient provider failure - a stalled request or an upstream 5xx
    // the adaptor could not outlast - is re-issued here, bounded by the same
    // iteration + continuation budget as the other recoverable errors (and by
    // the round-start deadline check). An AbortError - the hard deadline - is
    // re-thrown above and never reaches here. See isRecoverableProviderError.

    if (isRecoverableProviderError(e)) {
      if (currentContinuations <= maxContinuations) {
        if (isIterationLimitReached()) {
          debug(`iteration limit reached, stopping`).log(
            'openai.conv.completeResponseConversationStream'
          )

          yield {
            type: TAG_COMPLETE_END,
            data: {
              reason: 'iteration',
            },
          }

          return
        }

        const cause = getRecoverableProviderErrorCause(e)

        debug(`retrying completion after recoverable provider error`, {
          model: modelName,
          cause,
          currentContinuations,
          maxContinuations,
        }).log('openai.conv.completeResponseConversationStream')

        await captureObservation('Response completion stream error retried', {
          model: modelName,
          cause,
          currentIterations,
          currentContinuations,
        })

        // @note close the current completion before recursing - the retry emits
        // its own completeBegin/completeEnd pair (mirrors the in-stream error path)

        yield {
          type: TAG_COMPLETE_END,
          data: {
            reason: 'error',
          },
        }

        return nextIterationOptions({
          currentContinuations: currentContinuations + 1,
        })
      }
    }

    // @note re-throw non-token-limit errors

    hasError = true

    throw e
  } finally {
    const duration = Date.now() - startTime

    span.setAttribute('inputTokensUsed', inputTokensUsed)
    span.setAttribute('outputTokensUsed', outputTokensUsed)
    span.setAttribute('currentIterations', currentIterations)
    span.setAttribute('callStats', callStats.calls)
    span.finish()

    // Log slow operations (over 30 seconds)
    if (duration > 30000) {
      debug(`slow response completion stream`, {
        model: modelName,
        duration,
        inputTokensUsed,
        outputTokensUsed,
        currentIterations,
        callStats: callStats.calls,
      }).log('openai.conv.completeResponseConversationStream.slow')

      await captureObservation('Slow response completion stream', {
        model: modelName,
        duration,
        inputTokensUsed,
        outputTokensUsed,
        currentIterations,
        currentContinuations,
        callStats: callStats.calls,
        hasFunctions: Boolean(openaiFunctions?.length),
      })
    }

    // @note skip usage reporting when the request failed before streaming
    // started. If the provider started delivering chunks we still report
    // usage because input tokens were already consumed.

    if (!hasError || hasStreamed) {
      yield {
        type: TAG_USAGE,
        data: {
          model: modelName,
          inputTokensUsed: inputTokensUsed,
          outputTokensUsed: outputTokensUsed,
        },
      }
    }
  }
}

/**
 * Drives the response agentic loop. Each round (completeResponseConversationRound)
 * returns the options for the next round, or undefined to stop. Because a round
 * generator fully returns - and is popped off the call stack - before the next
 * round begins, stack depth stays O(1) regardless of how many iterations run.
 *
 * @note The previous form recursed via `yield* completeResponseConversation(...)`,
 * which kept one generator-delegation layer on the stack per round and overflowed
 * the call stack on long agentic runs.
 */
export async function* completeResponseConversationStream(
  options: CompleteResponseConversationStreamOptions
): ConversationOutput {
  let next: CompleteResponseConversationStreamOptions | undefined = options

  while (next !== undefined) {
    next = yield* completeResponseConversationRound(next)
  }
}

type CompleteRealtimeConversationStreamOptions = {
  createRealtimeSocket?: typeof createRealtimeSocket
  // startFunctions?: string[]
  // endFunctions?: string[]
} & GetNameOptions &
  ConversationInput

export async function* completeRealtimeConversationStream(
  options: CompleteRealtimeConversationStreamOptions
): ConversationOutput {
  debug(`completeRealtimeConversationStream`, {
    options: summarizeOptionsForDebug(options),
  }).log('openai.conv.completeRealtimeConversationStream')

  const model = options.model

  const { name: modelName, config: modelConfig } =
    parseAndRevealLanguageModel(model)

  const temperature = modelConfig.temperature

  const reasoningEffort = modelConfig.reasoningEffort

  const openaiFunctions =
    typeof options.functions === 'function'
      ? await options.functions()
      : options.functions

  const realtimeTools =
    openaiFunctions?.map(({ name, description, parameters }) => ({
      type: 'function' as const,
      name,
      description,
      parameters,
    })) || []

  const callStats = options.callStats || { calls: 0 }

  callStats.calls = Math.max(callStats.calls ?? 0, 0)

  const maxCalls = options.maxCalls ?? DEFAULT_MAX_CALLS

  const fn = options.createRealtimeSocket || createRealtimeSocket

  const socket = (() => {
    const context = options.context || {}

    if (!context.realtimeSocket) {
      context.realtimeSocket = fn({
        model: modelName,

        temperature,
        reasoningEffort,

        voice: modelConfig.voice,
      })
    }

    return context.realtimeSocket as RealtimeSocket
  })()

  yield* events(async (push) => {
    // open the socket

    await socket.open()

    if (options.stream || realtimeTools.length > 0) {
      socket.send({
        type: 'session.update',
        session: {
          type: 'realtime',
          ...(options.stream
            ? {
                audio: {
                  input: {
                    turn_detection: {
                      type: 'server_vad',
                      create_response: false,
                      interrupt_response: false,
                    },
                  },
                },
              }
            : null),
          ...(realtimeTools.length > 0
            ? {
                tools: realtimeTools,
                tool_choice: 'auto',
              }
            : null),
        },
      } as unknown as OpenAI.Realtime.SessionUpdateEvent)
    }

    // register tasks

    const tasks: AbortableTask[] = []

    // handle execution

    try {
      const newMessages: MessageWithUsage[] = []

      const input: NonNullable<
        OpenAI.Realtime.RealtimeResponseCreateParams['input']
      > = []

      const createResponse: (
        responseInput?: NonNullable<
          OpenAI.Realtime.RealtimeResponseCreateParams['input']
        >
      ) => void = (responseInput) => {
        const response: OpenAI.Realtime.RealtimeResponseCreateParams = {
          output_modalities: [options.modality === 'audio' ? 'audio' : 'text'],
        }

        if (responseInput?.length) {
          response.input = responseInput
        }

        if (realtimeTools.length > 0) {
          response.tools = realtimeTools
        }

        socket.send({
          type: 'response.create',
          response,
        } satisfies OpenAI.Realtime.ResponseCreateEvent)
      }

      // handle stream

      if (options.stream) {
        debug(`detected realtime stream in options, piping to socket`).log(
          'openai.conv.completeRealtimeConversationStream'
        )

        tasks.push(
          runAbortableTask(async (abortSignal) => {
            try {
              const stream = options.stream

              if (!stream) {
                return
              }

              for await (const chunk of cancelable(
                (async function* () {
                  yield* stream
                })(),
                abortSignal
              )) {
                socket.send({
                  type: 'input_audio_buffer.append',
                  audio: chunk.data.data,
                } satisfies OpenAI.Realtime.InputAudioBufferAppendEvent)
              }
            } catch (e) {
              await captureException(e)

              if (e instanceof SafeError) {
                push({
                  type: TAG_ERROR,
                  data: {
                    message: e.message,
                    code: e.code,
                  },
                })
              }
            }
          })
        )
      }

      // handle messages

      if (options.messages.length) {
        // @todo we seed the entire message history for now but soon we need to be
        // able to only partially seed only new messages

        const messageArray = await convertMessages(
          options.messages,
          model,
          options
        )

        for (const message of messageArray) {
          const text = Array.isArray(message.content)
            ? message.content
                .map((content) => {
                  if (typeof content === 'string') {
                    return content
                  }

                  if (content.type === 'text') {
                    return content.text
                  }

                  if (content.type === 'input_text') {
                    return content.text
                  }

                  if (content.type === 'output_text') {
                    return content.text
                  }

                  return ''
                })
                .join('\n')
                .trim()
            : typeof message.content === 'string'
              ? message.content
              : ''

          if (message.role === 'tool') {
            if (!message.tool_call_id || !text) {
              continue
            }

            input.push({
              type: 'function_call_output',
              call_id: message.tool_call_id,
              output: text,
            })

            continue
          }

          if (
            message.role !== 'system' &&
            message.role !== 'user' &&
            message.role !== 'assistant'
          ) {
            continue
          }

          if (message.role === 'assistant') {
            if (text) {
              input.push({
                type: 'message',
                role: 'assistant',
                content: [
                  {
                    type: 'output_text',
                    text,
                  },
                ],
              })
            }

            if ('tool_calls' in message && Array.isArray(message.tool_calls)) {
              for (const toolCall of message.tool_calls) {
                if (toolCall.type !== 'function') {
                  continue
                }

                input.push({
                  type: 'function_call',
                  call_id: toolCall.id,
                  name: toolCall.function.name,
                  arguments: toolCall.function.arguments,
                  status: 'completed',
                })
              }
            }

            continue
          }

          if (!text) {
            continue
          }

          input.push({
            type: 'message',
            role: message.role,
            content: [
              {
                type: 'input_text',
                text,
              },
            ],
          })
        }
      }

      // seed the prior items into the default conversation, then create a
      // response that runs against it

      // @note we must NOT pass these items as `response.input`. Providing
      // `input` to `response.create` builds a custom context "outside the
      // default conversation", so any function_call the model emits in that
      // response is never committed to the default conversation. The later
      // `conversation.item.create` for the `function_call_output` then fails
      // with `invalid_tool_call_id` ("Tool call ID ... not found in
      // conversation"). Seeding via `conversation.item.create` keeps the
      // function_call ids resolvable.

      if (input.length > 0 && !options.stream) {
        for (const item of input) {
          socket.send({
            type: 'conversation.item.create',
            item,
          })
        }

        createResponse()
      }

      // handle response events

      let responseId: string | null = null

      let streamedText = ''

      let streamedTextSource: 'output_text' | 'output_audio_transcript' | null =
        null

      const pendingFunctionCallOutputCallIds = new Set<string>()
      const handledFunctionCallCallIds = new Set<string>()

      let pendingResponseAfterFunctionCallOutputs = false
      let pendingResponseAfterAudioTranscript = false

      const maybeCreateResponseAfterFunctionCallOutputs = () => {
        if (
          !pendingResponseAfterFunctionCallOutputs ||
          pendingFunctionCallOutputCallIds.size > 0
        ) {
          return
        }

        pendingResponseAfterFunctionCallOutputs = false

        createResponse()
      }

      const maybeCreateResponseAfterAudioTranscript = () => {
        if (
          !pendingResponseAfterAudioTranscript ||
          pendingFunctionCallOutputCallIds.size > 0 ||
          responseId
        ) {
          return
        }

        pendingResponseAfterAudioTranscript = false

        createResponse()
      }

      let hasCompletionBegun = false
      let hasCompletionEnded = false

      const pushCompleteEnd = (
        reason: 'length' | 'stop' | 'activity' | 'abort' | 'error' | 'iteration'
      ) => {
        if (!hasCompletionBegun || hasCompletionEnded) {
          return
        }

        hasCompletionEnded = true

        push({
          type: TAG_COMPLETE_END,
          data: {
            reason,
          },
        })
      }

      const handleRealtimeFunctionCall = async (functionCall: {
        call_id: string
        name: string
        arguments?: unknown
      }) => {
        if (handledFunctionCallCallIds.has(functionCall.call_id)) {
          return false
        }

        handledFunctionCallCallIds.add(functionCall.call_id)

        callStats.calls += 1

        const functionName = getFunctionName(functionCall.name, openaiFunctions)

        const functionArguments = getFunctionArguments(
          functionCall.arguments,
          openaiFunctions
        )

        const requestActivityMessage = makeRequestActivityMessage(
          functionName,
          functionArguments
        )

        push({
          type: TAG_MESSAGE,
          data: requestActivityMessage,
        })

        newMessages[newMessages.length] = {
          ...requestActivityMessage,
          usage: {
            tokens: -1,
          },
        }

        const func =
          openaiFunctions?.find(({ name }) => name === functionName) ||
          internalFunctionStubs[functionName]

        let result

        if (func) {
          if (callStats.calls <= maxCalls) {
            if (func.handler) {
              try {
                result = await func.handler(functionArguments, {
                  newMessages,
                })
              } catch (e) {
                await captureException(e)

                if (e instanceof SafeError) {
                  result = { error: e.message }
                } else {
                  result = { error: 'Function invocation exception' }
                }
              }
            } else {
              result = { error: 'no handler' }
            }
          } else {
            result = { error: 'too many calls' }
          }
        } else {
          result = {
            error: `Tool ${JSON.stringify(
              functionCall.name
            )} function not found - correct functions names include: ${
              openaiFunctions?.map(({ name }) => name).join(', ') ||
              'no functions defined'
            }. Did you forget to load/install a tool package that provides this function?`,
          }
        }

        if (result instanceof AbortSignal) {
          if (result.aborted) {
            const responseActivityMessage = makeResponseActivityMessage(
              functionName,
              functionArguments,
              result.reason || null
            )

            push({
              type: TAG_MESSAGE,
              data: responseActivityMessage,
            })

            push({
              type: TAG_ABORT,
              data: {
                reason: result.reason,
                functionName,
              },
            })

            pushCompleteEnd('abort')

            return true
          }

          throw new Error(`Unexpected abort signal state`)
        }

        let thisMeta

        if (result instanceof Result) {
          thisMeta = result.meta
          result = result.result
        } else if (result instanceof Error) {
          result = { error: result.message }
        }

        const functionResult = tryStringifyJson(result) || 'no result'

        const responseActivityMessage = makeResponseActivityMessage(
          functionName,
          functionArguments,
          functionResult,
          thisMeta
        )

        push({
          type: TAG_MESSAGE,
          data: responseActivityMessage,
        })

        newMessages[newMessages.length] = {
          ...responseActivityMessage,
          usage: {
            tokens: -1,
          },
        }

        pendingFunctionCallOutputCallIds.add(functionCall.call_id)

        socket.send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: functionCall.call_id,
            output: functionResult,
          },
        })

        return true
      }

      const getRealtimeFunctionCalls = (
        data: OpenAI.Realtime.RealtimeServerEvent
      ) => {
        switch (data.type) {
          case 'response.function_call_arguments.done': {
            if (
              typeof data.call_id !== 'string' ||
              typeof data.name !== 'string'
            ) {
              return []
            }

            return [
              {
                call_id: data.call_id,
                name: data.name,
                arguments: data.arguments,
              },
            ]
          }

          case 'response.output_item.done': {
            const item = data.item

            if (
              item?.type !== 'function_call' ||
              typeof item.call_id !== 'string' ||
              typeof item.name !== 'string'
            ) {
              return []
            }

            return [
              {
                call_id: item.call_id,
                name: item.name,
                arguments: item.arguments,
              },
            ]
          }

          case 'response.done': {
            return (
              data.response?.output?.flatMap((item) => {
                if (
                  item.type !== 'function_call' ||
                  !('call_id' in item) ||
                  typeof item.call_id !== 'string' ||
                  !('name' in item) ||
                  typeof item.name !== 'string'
                ) {
                  return []
                }

                return [
                  {
                    call_id: item.call_id,
                    name: item.name,
                    arguments: 'arguments' in item ? item.arguments : undefined,
                  },
                ]
              }) || []
            )
          }

          default:
            return []
        }
      }

      const getRealtimeResponseText = (
        response: OpenAI.Realtime.RealtimeResponse | undefined
      ) => {
        const outputTextParts: string[] = []
        const outputAudioTranscriptParts: string[] = []

        for (const item of response?.output || []) {
          if (item.type !== 'message') {
            continue
          }

          for (const content of item.content || []) {
            if (content.type === 'output_text' && content.text) {
              outputTextParts.push(content.text)
            }

            if (content.type === 'output_audio' && content.transcript) {
              outputAudioTranscriptParts.push(content.transcript)
            }
          }
        }

        if (streamedTextSource === 'output_audio_transcript') {
          return (
            outputAudioTranscriptParts.join('\n') || outputTextParts.join('\n')
          )
        }

        if (streamedTextSource === 'output_text') {
          return (
            outputTextParts.join('\n') || outputAudioTranscriptParts.join('\n')
          )
        }

        return (
          outputAudioTranscriptParts.join('\n') || outputTextParts.join('\n')
        )
      }

      for await (const event of socket.receive()) {
        let errorEndedTurn = false

        const getEventResponseId = (
          data: OpenAI.Realtime.RealtimeServerEvent
        ): string | undefined => {
          if ('response_id' in data && typeof data.response_id === 'string') {
            return data.response_id
          }

          if ('response' in data && data.response) {
            const id = (data.response as { id?: unknown }).id

            if (typeof id === 'string') {
              return id
            }
          }

          return undefined
        }

        if (event.type === 'response.created') {
          const createdId = getEventResponseId(event)

          if (createdId && !responseId) {
            responseId = createdId
          }

          if (!hasCompletionBegun) {
            hasCompletionBegun = true

            push({
              type: TAG_COMPLETE_BEGIN,
              data: {},
            })
          }
        }

        const eventResponseId = getEventResponseId(event)

        if (responseId && eventResponseId && eventResponseId !== responseId) {
          continue
        }

        const getAcknowledgedFunctionCallOutputId = (
          data: OpenAI.Realtime.RealtimeServerEvent
        ): string | undefined => {
          const candidate = data as {
            type?: string
            item?: { type?: unknown; call_id?: unknown }
          }

          if (
            candidate.type !== 'conversation.item.created' &&
            candidate.type !== 'conversation.item.added' &&
            candidate.type !== 'conversation.item.done'
          ) {
            return undefined
          }

          if (
            candidate.item?.type !== 'function_call_output' ||
            typeof candidate.item.call_id !== 'string'
          ) {
            return undefined
          }

          return candidate.item.call_id
        }

        const acknowledgedFunctionCallOutputId =
          getAcknowledgedFunctionCallOutputId(event)

        if (
          acknowledgedFunctionCallOutputId &&
          pendingFunctionCallOutputCallIds.delete(
            acknowledgedFunctionCallOutputId
          )
        ) {
          maybeCreateResponseAfterFunctionCallOutputs()

          continue
        }

        switch (event.type) {
          // @note we deliberately do NOT handle function calls on
          // `response.function_call_arguments.done` or `response.output_item.done`.
          // Those events fire while the response is still in progress, and the
          // Realtime API only commits the `function_call` item to the
          // conversation once the response reaches `response.done`. Submitting a
          // `function_call_output` before then fails with
          // `invalid_tool_call_id` ("Tool call ID ... not found in
          // conversation"). We therefore only execute and submit tool outputs
          // from the `response.done` branch below.

          case 'conversation.item.input_audio_transcription.completed': {
            if (
              typeof event.transcript === 'string' &&
              event.transcript.trim()
            ) {
              push({
                type: TAG_MESSAGE,
                data: {
                  type: USER_MESSAGE_TYPE,
                  text: event.transcript.trim(),
                },
              })

              if (options.stream) {
                pendingResponseAfterAudioTranscript = true

                maybeCreateResponseAfterAudioTranscript()
              }
            }

            break
          }

          case 'response.output_text.delta':
          case 'response.output_audio_transcript.delta': {
            const nextStreamedTextSource =
              event.type === 'response.output_audio_transcript.delta'
                ? 'output_audio_transcript'
                : 'output_text'

            if (
              streamedTextSource &&
              streamedTextSource !== nextStreamedTextSource
            ) {
              break
            }

            streamedTextSource = nextStreamedTextSource
            streamedText += event.delta

            push({
              type: TAG_TOKEN,
              data: {
                token: event.delta,
              },
            })

            break
          }

          case 'response.output_audio.delta': {
            push({
              type: TAG_AUDIO,
              data: {
                data: event.delta,
                format: {
                  encoding: 'pcm16',
                  sampleRate: 24000,
                  channels: 1,
                },
              },
            })

            break
          }

          case 'response.done': {
            const response = event.response

            const functionCalls = getRealtimeFunctionCalls(event)

            const responseText = getRealtimeResponseText(response)

            const completion =
              responseText && !streamedText
                ? responseText
                : responseText.startsWith(streamedText)
                  ? responseText.slice(streamedText.length)
                  : ''

            if (completion) {
              push({
                type: TAG_TOKEN,
                data: {
                  token: completion,
                },
              })
            }

            const finalText = responseText || streamedText

            // @note a response can carry both a preamble message (e.g. "let me
            // check...") and a function_call. We must emit the bot message for
            // that text in BOTH paths - otherwise the preamble streams live as
            // tokens but is never recorded as a message when the response also
            // triggers a tool call.

            if (finalText) {
              push({
                type: TAG_MESSAGE,
                data: {
                  type: BOT_MESSAGE_TYPE,
                  text: finalText,
                },
              })
            }

            if (functionCalls.length > 0) {
              for (const functionCall of functionCalls) {
                const didHandle = await handleRealtimeFunctionCall(functionCall)

                if (hasCompletionEnded) {
                  return
                }

                if (!didHandle) {
                  continue
                }
              }

              responseId = null
              streamedText = ''

              pendingResponseAfterFunctionCallOutputs = true

              maybeCreateResponseAfterFunctionCallOutputs()
              maybeCreateResponseAfterAudioTranscript()

              break
            }

            const usage = response?.usage
              ? {
                  model: modelName,
                  inputTokensUsed: response.usage.input_tokens || 0,
                  outputTokensUsed: response.usage.output_tokens || 0,
                }
              : null

            if (usage) {
              push({
                type: TAG_USAGE,
                data: usage,
              })
            }

            const responseError =
              response?.status === 'failed'
                ? response.status_details?.error
                : undefined

            if (responseError) {
              const responseErrorMessage =
                responseError instanceof Error
                  ? responseError.message
                  : 'type' in responseError &&
                      typeof responseError.type === 'string'
                    ? responseError.type
                    : 'Unknown error'

              const responseErrorCode =
                'code' in responseError &&
                typeof responseError.code === 'string'
                  ? responseError.code
                  : 'error'

              push({
                type: TAG_ERROR,
                data: {
                  message: responseErrorMessage,
                  code: responseErrorCode,
                },
              })
            }

            pushCompleteEnd(responseError ? 'error' : 'stop')

            maybeCreateResponseAfterAudioTranscript()

            break
          }

          case 'error': {
            // @note Per the Realtime API contract most `error` events are
            // recoverable and the session stays open - the OpenAI docs
            // explicitly recommend logging them rather than tearing down. A
            // common case is a rejected `session.update` field (e.g. an
            // unsupported `reasoning.effort`). Treating every error as fatal
            // here ends the turn AND aborts the input-audio task in the
            // `finally` below, which silently kills the mic for the rest of the
            // session. We therefore only surface/end the turn for
            // non-recoverable errors, or when a response was actually in flight
            // (so it can never complete); recoverable errors are just logged.

            debug(`realtime error event`, { error: event.error }).log(
              'openai.conv.completeRealtimeConversationStream'
            )

            const recoverable =
              event.error?.type === 'invalid_request_error' &&
              !(hasCompletionBegun && !hasCompletionEnded)

            if (!recoverable) {
              push({
                type: TAG_ERROR,
                data: {
                  message: event.error.message || 'Unknown realtime error',
                  code: event.error.code || 'error',
                },
              })

              pushCompleteEnd('error')

              errorEndedTurn = true
            }

            break
          }

          default: {
            continue
          }
        }

        if (
          errorEndedTurn ||
          (event.type === 'response.done' && hasCompletionEnded)
        ) {
          break
        }
      }
    } finally {
      for (const task of tasks) {
        task.abort()
      }
    }
  })
}
// --- Public Functions ---

export type CompleteTextConversationOptions = {
  // @note add additional types
} & CompleteTextConversationStreamOptions

/**
 * A wrapper around the completeTextConversationStream function for extra
 * flexibility.
 */
export async function* completeTextConversation(
  options: CompleteTextConversationOptions
): ConversationOutput {
  options = { ...options }

  // @todo handle non-streaming text models

  yield* completeTextConversationStream(options)
}

export type CompleteChatConversationOptions = {
  // @note add additional types
} & CompleteChatConversationStreamOptions

/**
 * A wrapper around the completeChatConversationStream function for extra
 * flexibility.
 */
export async function* completeChatConversation(
  options: CompleteChatConversationOptions
): ConversationOutput {
  options = { ...options }

  yield* completeChatConversationStream(options)
}

export type CompleteResponseConversationOptions = {
  // @note add additional types
} & CompleteResponseConversationStreamOptions

/**
 * A wrapper around the completeResponseConversationStream function for extra
 * flexibility.
 */
export async function* completeResponseConversation(
  options: CompleteResponseConversationOptions
): ConversationOutput {
  options = { ...options }

  yield* completeResponseConversationStream(options)
}

export type CompleteRealtimeConversationOptions = {
  // @note add additional types
} & CompleteRealtimeConversationStreamOptions

/**
 * A wrapper around the completeRealtimeConversationStream function for extra
 * flexibility.
 */
export async function* completeRealtimeConversation(
  options: CompleteRealtimeConversationOptions
): ConversationOutput {
  options = { ...options }

  yield* completeRealtimeConversationStream(options)
}

/**
 * A high level conversation function that can handle text, chat, response and
 * realtime conversations based on the selected model.
 */
export async function* completeConversation(
  options: CompleteTextConversationOptions &
    CompleteChatConversationOptions &
    CompleteResponseConversationOptions &
    CompleteRealtimeConversationOptions
): ConversationOutput {
  if (modelSupportsRealtime(options.model)) {
    yield* completeRealtimeConversation(options)
  } else if (modelSupportsResponses(options.model)) {
    yield* completeResponseConversation(options)
  } else if (modelSupportsChat(options.model)) {
    yield* completeChatConversation(options)
  } else {
    yield* completeTextConversation(options)
  }
}
