/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Helpers ---

export interface Message {
  type: string
  text: string

  name?: string

  meta?: Record<string, any>
}

export interface Usage {
  tokens: number
}

export interface MessageWithUsage extends Message {
  usage: Usage
}

// --- Types ---

export const TAG_TOKEN = 'token'
export const TAG_REASONING_TOKEN = 'reasoningToken'
export const TAG_AUDIO = 'audio'
export const TAG_MESSAGE = 'message'
export const TAG_ABORT = 'abort'
export const TAG_COMPLETE_BEGIN = 'completeBegin'
export const TAG_COMPLETE_END = 'completeEnd'
export const TAG_USAGE = 'usage'
export const TAG_ERROR = 'error'

// --- Items ---

export interface TokenItem {
  type: typeof TAG_TOKEN
  data: { token: string }
}

export interface ReasoningTokenItem {
  type: typeof TAG_REASONING_TOKEN
  data: { token: string }
}

export interface AudioItem {
  type: typeof TAG_AUDIO
  data: {
    data: string
    format: {
      encoding: 'pcm16'
      sampleRate: number
      channels: number
    }
  }
}

export interface MessageItem {
  type: typeof TAG_MESSAGE
  data: Message
}

export interface AbortItem {
  type: typeof TAG_ABORT
  data: {
    /**
     * Optional abort reason surfaced by the model runtime or tool handler.
     */
    reason?: unknown
    /**
     * Optional function/tool name associated with the abort.
     */
    functionName?: string
  }
}

export interface CompleteBeginItem {
  type: typeof TAG_COMPLETE_BEGIN
  data: Record<string, never>
}

export interface CompleteEndItem {
  type: typeof TAG_COMPLETE_END
  data: {
    /**
     * The reason why the completion ended.
     *
     * - 'stop': Model finished naturally
     * - 'length': Output was truncated due to token limits
     * - 'activity': Model invoked a function or tool during processing
     * - 'abort': Completion stopped because execution was aborted
     * - 'error': An error occurred during completion
     * - 'iteration': Maximum iterations (model calls) reached
     */
    reason: 'length' | 'stop' | 'activity' | 'abort' | 'error' | 'iteration'
  }
}

export interface UsageItem {
  type: typeof TAG_USAGE
  data: {
    model: string
    inputTokensUsed: number
    outputTokensUsed: number
  }
}

export interface ErrorItem {
  type: typeof TAG_ERROR
  data: {
    message: string
    code: string
  }
}

export type Item =
  | TokenItem
  | ReasoningTokenItem
  | AudioItem
  | MessageItem
  | AbortItem
  | CompleteBeginItem
  | CompleteEndItem
  | UsageItem
  | ErrorItem

// --- Conversation Types ---

export interface ConversationFunctionContext {
  newMessages: Message[] // @todo remove this
}

export interface ConversationFunction {
  name: string
  description: string

  parameters: Record<string, any>

  handler?: (args: any, context: ConversationFunctionContext) => Promise<any>
}

export interface ConversationSink {
  push: <T extends Item>(type: T['type'], data: T['data']) => Promise<unknown>
}

export interface ConversationInput {
  /**
   * The list of messages in the conversation.
   */
  messages: Message[] // @todo consider also using a function

  /**
   * Optional provider of ephemeral, in-flight-only messages. It is re-read once
   * per round and the returned messages are appended to that round's prompt -
   * used to surface time-budget checkpoints to the model mid-run (see the
   * engine's `timeoutMarks` feature). The provider is expected to DRAIN what it
   * returns so the same messages are not re-inserted on later rounds (they are
   * carried forward by the loop), and these messages are never persisted.
   */
  liveMessages?: () => Message[] | Promise<Message[]>

  /**
   * An optional realtime input stream of items.
   */
  stream?: AsyncIterable<AudioItem> // @todo consider also using a function but also extending the items

  /**
   * Optional functions that can be called during the conversation.
   */
  functions?: ConversationFunction[] | (() => Promise<ConversationFunction[]>)

  /**
   * Functions that should be called at the start of the conversation (before
   * normal flow). These will be force-called in order.
   */
  startFunctions?: string[] // @todo consider also using a function

  /**
   * Functions that should be called at the end of the conversation (after
   * normal flow). These will be force-called in order.
   */
  endFunctions?: string[] // @todo consider also using a function

  /**
   * The model identifier to use for the conversation.
   */
  model: string

  /**
   * Optional requested output modality for providers that support realtime
   * audio responses.
   */
  modality?: 'text' | 'audio'

  /**
   * Optional stop sequences that will cause the model to stop generating.
   */
  stop?: string[]

  /**
   * Optional client identifier for tracking purposes.
   */
  clientId?: string

  /**
   * The current iteration count (used internally to track recursion depth).
   *
   * @note This is incremented on EVERY recursive call to the completion
   * function, regardless of the reason (tool calls, length continuation,
   * error retry, etc.).
   */
  currentIterations?: number

  /**
   * The maximum number of iterations (model API calls) allowed during the
   * conversation. When this limit is reached, the conversation stops with
   * reason 'iteration'.
   *
   * @note Use this to control total runtime in time-constrained environments
   * like background workers. Unlike maxContinuations which only limits retry
   * attempts, maxIterations limits ALL recursive calls including normal
   * tool-call loops.
   *
   * @note This parameter is intentionally not exposed in the public API
   * endpoints. It is for internal/programmatic use only, such as background
   * workers and queue processors.
   *
   * @example
   * // Single-step mode for background workers with 15-minute limits:
   * // Process one model call + its tools, then return so caller can
   * // save state and queue another job.
   * { maxIterations: 1 }
   *
   * @example
   * // Allow up to 10 model calls before forcing stop:
   * { maxIterations: 10 }
   */
  maxIterations?: number

  /**
   * The current number of continuation attempts (used internally for retry
   * logic).
   *
   * @note This is ONLY incremented on recovery scenarios:
   * - Output truncation (finishReason: 'length')
   * - Empty response with stop (finishReason: 'stop' but no text)
   * - Stream errors that are retryable
   *
   * It is NOT incremented on normal tool-call recursion. For limiting total
   * model calls including tool loops, use maxIterations instead.
   */
  currentContinuations?: number

  /**
   * The maximum number of continuation attempts allowed for recovery scenarios.
   *
   * @note This only limits RETRY attempts when the model output is truncated,
   * empty, or errors occur. It does NOT limit normal tool-call recursion.
   * For limiting total model calls including tool loops, use maxIterations.
   */
  maxContinuations?: number

  /**
   * Tracks the number of function calls made during the conversation.
   * `budgetWarned` records whether the "approaching call limit" heads-up has
   * already been injected into the thread, so it fires at most once per run.
   */
  callStats?: { calls: number; budgetWarned?: boolean }

  /**
   * The maximum number of function calls allowed during the conversation.
   */
  maxCalls?: number

  /**
   * Tracks the number of cyclic behavior detections during the conversation.
   */
  cycleStats?: { detected: number }

  /**
   * The maximum number of cycle detections before stopping the conversation.
   */
  maxCycles?: number

  /**
   * Tracks the number of empty turns (a `stop` with neither answer text nor a
   * tool call) issued during the run, used internally to bound the empty-retry
   * loop.
   */
  emptyStats?: { count: number }

  /**
   * The maximum number of empty turns before the run gives up and surfaces a
   * user-facing stop message plus a Sentry observation. Kept far tighter than
   * `maxContinuations` because retrying an empty turn rarely recovers - mirrors
   * `cycleStats`/`maxCycles`.
   */
  maxEmpties?: number

  /**
   * Tracks the number of settle nudges issued during the run (used internally
   * to bound the settle loop).
   *
   * @note Settle mode is enabled by `maxSettles` (a positive value), not a
   * separate flag - mirroring `callStats`/`maxCalls` and `cycleStats`/
   * `maxCycles`. In settle mode the run is only considered finished once the
   * model settles it by calling a terminal tool (e.g. `_success` / `_failure`,
   * which exit via an abort). A turn that ends with a plain `stop` is treated as
   * unsettled: the loop nudges the model and continues, bounded by `maxSettles`
   * and, when set, by `maxIterations`.
   */
  settleStats?: { nudges: number }

  /**
   * The maximum number of settle nudges before an unsettled turn is surfaced as
   * an `iteration` for the caller to handle. A positive value enables settle
   * mode; unset or zero disables it.
   */
  maxSettles?: number

  /**
   * Optional metadata to attach to the conversation.
   */
  meta?: Record<string, any>

  /**
   * Mutable runtime context shared across provider calls in the same engine.
   */
  context?: Record<string, any>

  /**
   * Optional engine-owned sink for asynchronous conversation items.
   */
  sink?: ConversationSink

  /**
   * Indicates whether this conversation is running in the background - i.e. it
   * is not an interactive completion.
   */
  background?: boolean

  /**
   * Optional abort signal for cancelling the conversation request.
   */
  abortSignal?: AbortSignal

  /**
   * Optional cooperative soft-yield signal. Unlike `abortSignal` (which
   * interrupts the in-flight model stream immediately), this is consulted only
   * at iteration boundaries: when set, the agentic loop finishes the current
   * round - leaving the conversation in a valid state, with no dangling tool
   * calls - and then stops with reason `'iteration'`. Lets a caller bow out
   * gracefully (e.g. a newer message superseded this turn) without cutting a
   * live generation.
   */
  yieldSignal?: AbortSignal
}

export type ConversationOutput = AsyncGenerator<Item>
