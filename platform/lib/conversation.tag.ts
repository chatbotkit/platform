// @ts-check
import type { Item as ConvItem, Message as ConvMessage } from '@/lib/conv'
import {
  TAG_ABORT as _TAG_ABORT,
  TAG_AUDIO as _TAG_AUDIO,
  TAG_COMPLETE_BEGIN as _TAG_COMPLETE_BEGIN,
  TAG_COMPLETE_END as _TAG_COMPLETE_END,
  TAG_MESSAGE as _TAG_MESSAGE,
  TAG_REASONING_TOKEN as _TAG_REASONING_TOKEN,
  TAG_TOKEN as _TAG_TOKEN,
  TAG_USAGE as _TAG_USAGE,
} from '@/lib/conv'

// ============================================================================
// Tag Constants
// ============================================================================

export const TAG_PING = 'ping'
export const TAG_ERROR = 'error'
export const TAG_USAGE = _TAG_USAGE
export const TAG_ABORT = _TAG_ABORT
export const TAG_INTENT_DETECTION_BEGIN = 'intentDetectionBegin'
export const TAG_INTENT_DETECTION_END = 'intentDetectionEnd'
export const TAG_OPERATION_BEGIN = 'operationBegin'
export const TAG_OPERATION_END = 'operationEnd'
export const TAG_COMPACTION_BEGIN = 'compactionBegin'
export const TAG_COMPACTION_END = 'compactionEnd'
export const TAG_PROGRESS_REPORT = 'progressReport'
export const TAG_TOKEN = _TAG_TOKEN
export const TAG_REASONING_TOKEN = _TAG_REASONING_TOKEN
export const TAG_AUDIO = _TAG_AUDIO
export const TAG_MESSAGE = _TAG_MESSAGE
export const TAG_COMPLETE_BEGIN = _TAG_COMPLETE_BEGIN
export const TAG_COMPLETE_END = _TAG_COMPLETE_END
export const TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN = 'waitForChannelMessageBegin'
export const TAG_WAIT_FOR_CHANNEL_MESSAGE_END = 'waitForChannelMessageEnd'
export const TAG_SEND_RESULT = 'sendResult'
export const TAG_RECEIVE_RESULT = 'receiveResult'
export const TAG_RESULT = 'result'

// ============================================================================
// Sink Data Types
// ============================================================================

/**
 * Token data pushed to the sink for streaming tokens.
 *
 * @note This has the same structure as ReasoningTokenData, but they are kept
 * separate intentionally as they represent semantically different events.
 */
export interface TokenData {
  token: string
}

/**
 * Reasoning token data pushed to the sink for streaming reasoning tokens.
 *
 * @note This has the same structure as TokenData, but they are kept
 * separate intentionally as they represent semantically different events.
 */
export interface ReasoningTokenData {
  token: string
}

/**
 * Audio data pushed to the sink for realtime audio streams.
 */
export interface AudioData {
  data: string
  format: {
    encoding: 'pcm16'
    sampleRate: number
    channels: number
  }
}

/**
 * Message data pushed to the sink. Re-uses the Message type from conv.ts.
 */
export type MessageData = ConvMessage

/**
 * Abort data pushed to the sink when a conversation or operation is aborted.
 */
export interface AbortData {
  instance: string
  iteration: string
  reason?: unknown
  functionName?: string
}

/**
 * Complete begin data pushed to the sink when a completion starts.
 */
export interface CompleteBeginData {
  instance: string
  iteration: string
}

/**
 * Complete end data pushed to the sink when a completion ends.
 */
export interface CompleteEndData {
  instance: string
  iteration: string
}

/**
 * Usage data pushed to the sink for token usage tracking.
 */
export interface UsageData {
  model: string
  inputTokensUsed: number
  outputTokensUsed: number
}

/**
 * Ping data pushed to the sink to keep the connection alive.
 */
export type PingData = Record<string, never>

/**
 * Error data pushed to the sink when an error occurs.
 */
export interface ErrorData {
  code: string
  message: string
}

/**
 * Common action info used in intent detection and operation events.
 */
export interface ActionInfo {
  id: string
  kind?: 'dataset' | 'skillset' | 'function'
  name?: string
  input?: unknown
  justification?: string
  icon?: string
}

/**
 * Intent detection begin data pushed when intent detection starts.
 */
export interface IntentDetectionBeginData {
  id: string
  action: {
    id: string
  }
}

/**
 * Intent detection end data pushed when intent detection completes.
 */
export interface IntentDetectionEndData {
  id: string
  action: {
    id: string
    name: string
  }
}

/**
 * Operation begin data pushed when an operation (function call) starts.
 */
export interface OperationBeginData {
  id: string
  action: ActionInfo
}

/**
 * Operation end data pushed when an operation (function call) completes.
 */
export interface OperationEndData {
  id: string
  action: ActionInfo
}

/**
 * Compaction begin data pushed when context compaction starts.
 */
export interface CompactionBeginData {
  /** Number of messages being condensed into the summary. */
  messagesToSummarize: number
  /** Number of messages being kept verbatim. */
  messagesToKeep: number
  /** Estimated token count that triggered compaction. */
  estimatedTokens: number
}

/**
 * Compaction end data pushed when context compaction completes.
 */
export interface CompactionEndData {
  /** Whether the summary was successfully generated and applied. */
  success: boolean
}

/**
 * Progress report data pushed to report progress on multi-step operations.
 */
export interface ProgressReportData {
  id: string
  step: number
  total: number
  eta: number | null
}

/**
 * Wait for channel message begin data.
 */
export interface WaitForChannelMessageBeginData {
  channel: string
  function: {
    name: string
    args: unknown
  }
}

/**
 * Wait for channel message end data.
 */
export interface WaitForChannelMessageEndData {
  channel: string
  function: {
    name: string
    args: unknown
  }
  message: unknown
}

/**
 * Complete reason type for result events.
 */
export type CompleteReason =
  | 'length'
  | 'stop'
  | 'activity'
  | 'abort'
  | 'error'
  | 'iteration'

/**
 * Send result data pushed after sending a message.
 */
export interface SendResultData {
  text: string
  entities?: unknown[]
  usage: {
    token: number
  }
}

/**
 * Receive result data pushed after receiving a response.
 */
export interface ReceiveResultData {
  text: string
  usage: {
    token: number
  }
  end: {
    reason: CompleteReason
  }
}

/**
 * Result data pushed as the final result of a completed conversation turn.
 */
export interface CompleteResultData {
  text: string
  usage: {
    token: number
  }
  end: {
    reason: CompleteReason
  }
}

/**
 * Result data pushed as the final result of an applied conversation function.
 */
export interface ApplyResultData {
  result: unknown
  messages: unknown[]
  usage: {
    token: number
  }
}

/**
 * Result data pushed as the final result of a conversation operation.
 */
export type ResultData = CompleteResultData | ApplyResultData

// ============================================================================
// Sink Type
// ============================================================================

export interface PingItem {
  type: typeof TAG_PING
  data: PingData
}

export interface ErrorItem {
  type: typeof TAG_ERROR
  data: ErrorData
}

export interface TokenItem {
  type: typeof TAG_TOKEN
  data: TokenData
}

export interface ReasoningTokenItem {
  type: typeof TAG_REASONING_TOKEN
  data: ReasoningTokenData
}

export interface AudioItem {
  type: typeof TAG_AUDIO
  data: AudioData
}

export interface MessageItem {
  type: typeof TAG_MESSAGE
  data: MessageData
}

export interface AbortItem {
  type: typeof TAG_ABORT
  data: AbortData
}

export interface CompleteBeginItem {
  type: typeof TAG_COMPLETE_BEGIN
  data: CompleteBeginData
}

export interface CompleteEndItem {
  type: typeof TAG_COMPLETE_END
  data: CompleteEndData
}

export interface UsageItem {
  type: typeof TAG_USAGE
  data: UsageData
}

export interface IntentDetectionBeginItem {
  type: typeof TAG_INTENT_DETECTION_BEGIN
  data: IntentDetectionBeginData
}

export interface IntentDetectionEndItem {
  type: typeof TAG_INTENT_DETECTION_END
  data: IntentDetectionEndData
}

export interface OperationBeginItem {
  type: typeof TAG_OPERATION_BEGIN
  data: OperationBeginData
}

export interface OperationEndItem {
  type: typeof TAG_OPERATION_END
  data: OperationEndData
}

export interface CompactionBeginItem {
  type: typeof TAG_COMPACTION_BEGIN
  data: CompactionBeginData
}

export interface CompactionEndItem {
  type: typeof TAG_COMPACTION_END
  data: CompactionEndData
}

export interface ProgressReportItem {
  type: typeof TAG_PROGRESS_REPORT
  data: ProgressReportData
}

export interface WaitForChannelMessageBeginItem {
  type: typeof TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN
  data: WaitForChannelMessageBeginData
}

export interface WaitForChannelMessageEndItem {
  type: typeof TAG_WAIT_FOR_CHANNEL_MESSAGE_END
  data: WaitForChannelMessageEndData
}

export interface SendResultItem {
  type: typeof TAG_SEND_RESULT
  data: SendResultData
}

export interface ReceiveResultItem {
  type: typeof TAG_RECEIVE_RESULT
  data: ReceiveResultData
}

export interface ResultItem {
  type: typeof TAG_RESULT
  data: ResultData
}

/**
 * Engine-specific sink items that extend the basic conversation items. These
 * include additional context like operation tracking, intent detection, etc.
 */
export type EngineSinkItem =
  | PingItem
  | ErrorItem
  | TokenItem
  | ReasoningTokenItem
  | AudioItem
  | MessageItem
  | AbortItem
  | CompleteBeginItem
  | CompleteEndItem
  | UsageItem
  | IntentDetectionBeginItem
  | IntentDetectionEndItem
  | OperationBeginItem
  | OperationEndItem
  | CompactionBeginItem
  | CompactionEndItem
  | ProgressReportItem
  | WaitForChannelMessageBeginItem
  | WaitForChannelMessageEndItem
  | SendResultItem
  | ReceiveResultItem
  | ResultItem

/**
 * Metadata added by a sink when an item becomes an emitted event.
 */
export interface SinkItemMeta {
  createdAt: number
}

/**
 * Engine-specific sink events that extend the basic conversation items. These
 * include additional context like operation tracking, intent detection, etc.
 */
export type EngineSinkEvent<T extends EngineSinkItem = EngineSinkItem> = T &
  SinkItemMeta

// ============================================================================
// Sink Helpers
// ============================================================================

export function createSinkEvent<T extends EngineSinkItem>(
  item: T,
  createdAt = Date.now()
): EngineSinkEvent<T> {
  return {
    ...item,
    createdAt,
  }
}

// ============================================================================
// Sink Interface
// ============================================================================

/**
 * Helper type to extract data type from SinkItem based on the type string.
 * First checks EngineSinkItem, then falls back to ConvItem types.
 */
export type SinkDataForType<T extends string> =
  Extract<EngineSinkItem, { type: T }> extends { data: infer D }
    ? D
    : Extract<ConvItem, { type: T }> extends { data: infer D }
      ? D
      : unknown

export type SinkItemForType<T extends string> =
  Extract<EngineSinkItem, { type: T }> extends never
    ? { type: T; data: SinkDataForType<T> }
    : Extract<EngineSinkItem, { type: T }>

export type SinkEventForType<T extends string> = SinkItemForType<T> &
  SinkItemMeta

/**
 * The Sink interface for pushing typed events to consumers.
 *
 * Extends ConversationSink from conv.ts with additional engine-specific events
 * like operation tracking, intent detection, progress reports, etc.
 *
 * @example
 * ```typescript
 * // Type-safe calls - data type is inferred and enforced:
 * sink.push('token', { token: 'hello' })
 * sink.push('message', { type: 'bot', text: 'Hello!' })
 * sink.push('operationBegin', { id: 'op-1', action: { id: 'a-1' } })
 * ```
 */
export interface Sink {
  // Overload for ConvItem types (compatible with ConversationSink)
  push<T extends ConvItem>(
    type: T['type'],
    data: T['data']
  ): Promise<SinkEventForType<T['type']>>
  // Overload for engine-specific types
  push<T extends string>(
    type: T,
    data: SinkDataForType<T>
  ): Promise<SinkEventForType<T>>
}

/**
 * Combine multiple sinks into a single sink.
 *
 * The first (primary) sink preserves the original behavior: it is awaited and
 * its returned event is what the caller receives. Any remaining sinks are
 * treated as best-effort observers (e.g. live monitoring) - they are dispatched
 * fire-and-forget and can never block the primary path nor surface their errors
 * into it.
 *
 * Returns `undefined` when no sinks are active and the single sink unchanged
 * when only one is active, so call sites that pass no extra sink are unaffected.
 */
export function combineSinks(
  sinks: (Sink | undefined | null)[]
): Sink | undefined {
  const active = sinks.filter((sink): sink is Sink => Boolean(sink))

  if (active.length === 0) {
    return undefined
  }

  if (active.length === 1) {
    return active[0]
  }

  const [primary, ...rest] = active

  const push = (async (type: string, data: unknown) => {
    // @note the primary sink drives the result and is awaited so existing
    // behavior (ordering, return value) is preserved exactly
    const event = await primary.push(type, data as never)

    // @note secondary sinks are best-effort observers - never block the primary
    // path and never let their failures escape into the completion
    for (const sink of rest) {
      try {
        void Promise.resolve(sink.push(type, data as never)).catch(() => {})
      } catch {
        // @note ignore synchronous throws from a misbehaving secondary sink
      }
    }

    return event
  }) as Sink['push']

  return { push }
}
