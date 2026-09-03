/**
 * Conversation Compaction Module
 *
 * Implements context-window compaction for long-running conversations.
 * When a conversation accumulates enough messages to approach a token
 * threshold, older messages are summarised into a single compact context
 * message while the most-recent messages are kept verbatim.
 *
 * The approach is inspired by two open-source projects:
 *
 * - opencode (anomalyco/opencode): triggers compaction when token usage
 *   exceeds the model context window, then uses an LLM to produce a
 *   structured "continuation prompt" that captures goal, discoveries,
 *   accomplished work, and relevant files.
 *
 * - openclaw (openclaw/openclaw): progressively drops the oldest message
 *   chunks until the history fits within a token budget, and summarises
 *   the dropped portion in stages for very long conversations.
 *
 * Our implementation combines both ideas:
 * 1. A configurable token threshold triggers compaction.
 * 2. Older messages (outside a protected "recent" tail) are collected for
 *    summarisation.
 * 3. The caller supplies a summary string (produced by an LLM) which is
 *    injected as a `context`-typed message, followed by the kept messages.
 *
 * All functions in this module are pure (no I/O) so they are fully
 * testable without mocking network or database layers.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Approximate number of characters per LLM token for English text.
 * Intentionally conservative to avoid underestimating context usage.
 */
export const CHARS_PER_TOKEN = 4

/**
 * Safety multiplier applied on top of the characters-per-token estimate.
 * Accounts for multi-byte characters, code tokens, and special tokens that
 * the simple heuristic misses.
 */
export const TOKEN_ESTIMATE_SAFETY_MARGIN = 1.25

/**
 * Minimum number of messages required before compaction is considered.
 * Below this count the overhead of summarisation outweighs its benefit.
 */
export const COMPACTION_MIN_MESSAGES = 4

/**
 * Default fraction of the message list preserved verbatim as the "recent"
 * tail. E.g. 0.25 keeps the newest 25 % of messages intact.
 */
export const COMPACTION_KEEP_RECENT_RATIO = 0.25

/**
 * Default fraction of maxTokens at which compaction is triggered.
 * E.g. 0.9 means: compact when estimated usage reaches 90 % of the limit.
 */
export const COMPACTION_TRIGGER_RATIO = 0.9

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A minimal structural interface that the compaction functions operate on.
 *
 * Using `type: string` keeps the module decoupled from the `MessageType` enum
 * so it can accept both the engine's typed `Message` objects (where
 * `type: MessageType`, a string enum) and plain objects in tests.
 *
 * @note The functions that accept/return `T extends CompactionMessage` will
 * preserve the caller's concrete message type through the operation.
 */
export interface CompactionMessage {
  id?: string
  type: string
  text: string
  meta?: Record<string, unknown>
}

export interface CompactionOptions {
  /** Upper token bound for the message list. Compaction fires near this value. */
  maxTokens: number
  /**
   * Number of messages to keep verbatim from the tail. When omitted the
   * value is derived from COMPACTION_KEEP_RECENT_RATIO.
   */
  keepRecentCount?: number
  /**
   * Fraction of maxTokens that triggers compaction (default
   * COMPACTION_TRIGGER_RATIO).
   */
  triggerRatio?: number
}

/**
 * Generic discriminated union returned by `checkCompaction`.
 *
 * Using a generic `T` preserves the caller's concrete message type
 * (e.g. the engine's `Message`) in both buckets so the results can be
 * used directly without unsafe widening casts.
 */
export type CompactionCheck<T extends CompactionMessage = CompactionMessage> =
  | {
      shouldCompact: true
      messagesToSummarize: T[]
      messagesToKeep: T[]
      estimatedTokens: number
    }
  | {
      shouldCompact: false
      estimatedTokens: number
    }

/** Generic split result - preserves the caller's concrete message type T. */
export interface CompactionSplit<
  T extends CompactionMessage = CompactionMessage,
> {
  messagesToSummarize: T[]
  messagesToKeep: T[]
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Estimates the token count for a single message using a character-count
 * heuristic: `ceil((chars / CHARS_PER_TOKEN) * TOKEN_ESTIMATE_SAFETY_MARGIN)`.
 *
 * The estimate intentionally errs on the side of over-counting to reduce the
 * risk of exceeding model context limits.
 */
export function estimateMessageTokens(message: CompactionMessage): number {
  const text = message.text || ''

  return Math.ceil(
    (text.length / CHARS_PER_TOKEN) * TOKEN_ESTIMATE_SAFETY_MARGIN
  )
}

/**
 * Estimates the total token count for a list of messages by summing the
 * individual estimates.
 */
export function estimateMessagesTokens(messages: CompactionMessage[]): number {
  return messages.reduce(
    (total, message) => total + estimateMessageTokens(message),
    0
  )
}

// ---------------------------------------------------------------------------
// Compaction decision
// ---------------------------------------------------------------------------

/**
 * Determines whether compaction should be triggered for the given message
 * list given the supplied options.
 *
 * Returns a discriminated union:
 * - `{ shouldCompact: false, estimatedTokens }` when no action is needed.
 * - `{ shouldCompact: true, messagesToSummarize, messagesToKeep, estimatedTokens }`
 *   when the token estimate exceeds the trigger threshold and there are
 *   enough messages to produce a meaningful split.
 */
export function checkCompaction<T extends CompactionMessage>(
  messages: T[],
  options: CompactionOptions
): CompactionCheck<T> {
  const { maxTokens, triggerRatio = COMPACTION_TRIGGER_RATIO } = options
  const estimatedTokens = estimateMessagesTokens(messages)
  const triggerThreshold = Math.floor(maxTokens * triggerRatio)

  if (
    estimatedTokens < triggerThreshold ||
    messages.length < COMPACTION_MIN_MESSAGES
  ) {
    return { shouldCompact: false, estimatedTokens }
  }

  const { messagesToSummarize, messagesToKeep } = splitMessagesForCompaction(
    messages,
    options
  )

  if (messagesToSummarize.length === 0) {
    return { shouldCompact: false, estimatedTokens }
  }

  return {
    shouldCompact: true,
    messagesToSummarize: messagesToSummarize as T[],
    messagesToKeep: messagesToKeep as T[],
    estimatedTokens,
  }
}

// ---------------------------------------------------------------------------
// Message splitting
// ---------------------------------------------------------------------------

/**
 * Splits a message list into two groups:
 *
 * - **messagesToSummarize** - older messages at the head of the list that
 *   will be condensed into an LLM-generated summary.
 * - **messagesToKeep** - recent messages at the tail that are preserved
 *   verbatim.
 *
 * The split point is determined by `keepRecentCount` (explicit) or derived
 * as `max(2, ceil(messages.length * COMPACTION_KEEP_RECENT_RATIO))`.
 *
 * `backstory`-typed messages are never placed in the summarise bucket.
 * If moving the split point to avoid backstory messages would leave nothing
 * to summarise, the function returns an empty summarise bucket and the full
 * list as keepMessages.
 */
export function splitMessagesForCompaction<T extends CompactionMessage>(
  messages: T[],
  options: CompactionOptions
): CompactionSplit<T> {
  const { keepRecentCount } = options

  if (messages.length < COMPACTION_MIN_MESSAGES) {
    return { messagesToSummarize: [], messagesToKeep: messages }
  }

  const computed =
    keepRecentCount != null
      ? keepRecentCount
      : Math.max(2, Math.ceil(messages.length * COMPACTION_KEEP_RECENT_RATIO))

  const splitIndex = Math.max(0, messages.length - computed)

  if (splitIndex === 0) {
    return { messagesToSummarize: [], messagesToKeep: messages }
  }

  const candidateSummarize = messages.slice(0, splitIndex)
  const candidateKeep = messages.slice(splitIndex)

  // backstory messages must never appear in the summarise bucket - they
  // contain system context that the LLM should never lose. Any backstory
  // messages found anywhere in the candidate summarize slice are moved to the
  // front of the keep slice so they are always passed through verbatim.
  const backstoryMessages = candidateSummarize.filter(
    (m) => m.type === 'backstory'
  )
  const summarizable = candidateSummarize.filter((m) => m.type !== 'backstory')

  if (summarizable.length === 0) {
    return { messagesToSummarize: [], messagesToKeep: messages }
  }

  // backstory messages are prepended to messagesToKeep so they remain ahead
  // of the recent tail and can be placed before the compaction summary by
  // applyCompactionSummary.
  return {
    messagesToSummarize: summarizable as T[],
    messagesToKeep: [...backstoryMessages, ...candidateKeep] as T[],
  }
}

// ---------------------------------------------------------------------------
// Summary prompt construction
// ---------------------------------------------------------------------------

/**
 * Message types that carry substantive conversation content. Only these types
 * are rendered inside the `<conversation>` block of the summary prompt.
 * System/infrastructure messages (backstory, activity) are excluded because
 * they add noise without adding conversational value to the summary.
 */
const SUMMARISABLE_TYPES = new Set([
  'user',
  'bot',
  'context',
  'instruction',
  'reasoning',
])

/**
 * Renders a single message as a labelled line for the summary prompt.
 * The label makes it easy for the LLM to understand speaker attribution.
 */
function renderMessageForPrompt(message: CompactionMessage): string {
  const label = String(message.type).toUpperCase()

  return `[${label}]: ${message.text}`
}

/**
 * Builds the prompt text that is sent to the LLM to produce a compaction
 * summary.
 *
 * The structure is adapted from the opencode compaction prompt template:
 * - What was discussed
 * - What was accomplished
 * - Important details to remember (IDs, values, preferences, constraints)
 * - Ongoing / open state
 *
 * Only messages with types in SUMMARISABLE_TYPES are included in the
 * `<conversation>` block - this excludes backstory and activity messages.
 *
 * @returns The full prompt string to send as a user message to the LLM.
 */
export function buildCompactionSummaryPrompt(
  messagesToSummarize: CompactionMessage[]
): string {
  const summarisable = messagesToSummarize.filter((m) =>
    SUMMARISABLE_TYPES.has(m.type as string)
  )

  const conversationBlock = summarisable.map(renderMessageForPrompt).join('\n')

  return `You are summarising a conversation that has grown too long for the context window.

Produce a concise but comprehensive summary structured as follows:

---
## Context Summary

### What was discussed
[Key topics, questions, and information exchanged]

### What was accomplished
[Tasks completed, decisions made, or solutions provided]

### Important details to remember
[Specific facts, preferences, constraints, or values that must persist:
names, IDs, dates, URLs, file paths, numeric values, user preferences, etc.
Preserve opaque identifiers exactly - do NOT shorten or reconstruct them.]

### Ongoing state
[Pending questions, open tasks, or items the user is waiting on]
---

Do not respond to the conversation; only output the summary in the format above.

<conversation>
${conversationBlock}
</conversation>`
}

// ---------------------------------------------------------------------------
// Applying the summary
// ---------------------------------------------------------------------------

/**
 * Merges a generated summary back into the message list.
 *
 * The summarised messages are replaced by a single `context`-typed message.
 * The final order is:
 *
 * 1. **backstory messages** extracted from `messagesToKeep` - the system
 *    prompt must always appear first so the model is properly oriented.
 * 2. **summary message** - the LLM-generated condensation of older history.
 * 3. **remaining kept messages** - recent conversation tail preserved verbatim.
 *
 * The summary message's `meta.summarizedIds` field lists the `id` values of
 * every message that was condensed (only IDs that are non-empty strings are
 * included). Downstream consumers can use this to filter the now-redundant
 * original messages from subsequent `getMessages()` calls so the conversation
 * is not re-compacted on the next turn.
 *
 * @param messagesToKeep     Messages preserved verbatim (recent tail + backstories).
 * @param summaryText        LLM-generated summary text.
 * @param messagesToSummarize The messages that were condensed into the summary.
 * @returns The merged message list ready to be used in a new LLM request.
 */
export function applyCompactionSummary<T extends CompactionMessage>(
  messagesToKeep: T[],
  summaryText: string,
  messagesToSummarize: CompactionMessage[]
): Array<T | CompactionMessage> {
  const droppedCount = messagesToSummarize.length

  // collect IDs of messages being condensed so future getMessages() calls can
  // filter them out once the summary marker is persisted to the database.
  const summarizedIds = messagesToSummarize
    .map((m) => m.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  // backstory messages must remain at the very front so the model always sees
  // the system context before any other content, including the summary.
  const backstoryMessages = messagesToKeep.filter((m) => m.type === 'backstory')
  const nonBackstoryKept = messagesToKeep.filter((m) => m.type !== 'backstory')

  const summaryMessage: CompactionMessage = {
    type: 'context',
    text: `[Conversation summary - ${droppedCount} earlier message(s) condensed]\n\n${summaryText.trim()}`,
    meta: {
      compacted: true,
      droppedCount,
      ...(summarizedIds.length > 0 ? { summarizedIds } : {}),
    },
  }

  return [...backstoryMessages, summaryMessage, ...nonBackstoryKept]
}
