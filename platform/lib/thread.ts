import { debug } from '@/lib/debug'

// --- Types ---

/**
 * Represents a single message in a conversation thread.
 */
export interface Message {
  type: string
  text: string
  meta?: Record<string, unknown>
}

/**
 * Represents token usage information.
 */
export interface Usage {
  tokens: number
}

/**
 * Extends Message to include usage information.
 */
export interface MessageWithUsage extends Message {
  usage: Usage
}

/**
 * A function that estimates the token usage of a message.
 */
export type TokenEstimationFunction = (
  message: MessageWithUsage
) => Promise<Usage>

export type InclusiveFunction = (
  message: MessageWithUsage,
  trimTo: number
) => Promise<MessageWithUsage | false>

/**
 * Options for building a thread.
 */
export interface BuildThreadOptions {
  messages: Message[]
  tokenEstimationFunction: TokenEstimationFunction
  maxTokens: number
  minMessages?: number
  inclusive?: true | InclusiveFunction
}

/**
 * Result of building a thread.
 */
export interface BuildThreadResult {
  messages: MessageWithUsage[]
  usage: Usage
}

// --- Utilities ---

function normalizeTokenCount(tokens: number): number {
  return Number.isFinite(tokens) && tokens >= 0 ? tokens : 0
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '"[unserializable]"'
  }
}

// --- Thread Building ---

/**
 * A function that builds a thread of messages trimmed to fit within a
 * specified token limit.
 *
 * A thread is a list of messages that can be sent in a single transaction. It
 * is trimmed to fit as many messages as possible in a single request. This
 * function does not care about the order or the message types, it only cares
 * about the total number of tokens used.
 */
export async function buildThread({
  messages,

  tokenEstimationFunction,

  maxTokens,
  minMessages,

  inclusive,
}: BuildThreadOptions): Promise<BuildThreadResult> {
  debug(`buildThread`, {
    messages,
    tokenEstimationFunction,
    maxTokens,
    minMessages,
    inclusive,
  })

  // ensure that min messages makes sense

  const thisMinMessages = Math.abs(minMessages ?? 0)

  // we need to estimate the usage of each message

  const processedMessages = await Promise.all(
    messages.map(async (message) => {
      const { usage, ...rest } = message as MessageWithUsage

      const estimatedUsage =
        usage?.tokens >= 0
          ? usage
          : await tokenEstimationFunction(message as MessageWithUsage)

      const normalizedUsage: Usage = {
        tokens: normalizeTokenCount(estimatedUsage.tokens),
      }

      return { ...rest, usage: normalizedUsage }
    })
  )

  const trimmedMessages: MessageWithUsage[] = []

  let totalTokensUsed = 0

  // doing it in reverse order helps to calculate exactly how many of the
  // message we can fit in the maxTokens limit

  for (let i = processedMessages.length - 1; i >= 0; i--) {
    let message = processedMessages[i]

    let tokens = normalizeTokenCount(message.usage.tokens)

    // check if we're still within the minimum messages requirement

    const remainingMessages = processedMessages.length - i
    const isWithinMinimum = remainingMessages <= thisMinMessages

    if (totalTokensUsed + tokens > maxTokens && !isWithinMinimum) {
      if (inclusive) {
        if (typeof inclusive === 'function') {
          const trimTo = maxTokens - totalTokensUsed

          if (trimTo > 0) {
            const result = await inclusive(message, trimTo)

            if (result === false) {
              tokens = 0

              totalTokensUsed += tokens

              break
            }

            message = result

            tokens = normalizeTokenCount(message.usage.tokens)

            if (tokens > trimTo) {
              tokens = trimTo

              message = {
                ...message,
                usage: { ...message.usage, tokens },
              }
            }
          }
        }

        totalTokensUsed += tokens

        trimmedMessages.push(message)
      }

      break
    }

    totalTokensUsed += tokens

    trimmedMessages.push(message)

    if (totalTokensUsed >= maxTokens && !isWithinMinimum) {
      if (!inclusive) {
        break
      }
    }
  }

  // restore the order

  trimmedMessages.reverse()

  // build the usage

  const trimmedUsage: Usage = { tokens: totalTokensUsed }

  // return

  debug(`done`, {
    messages: trimmedMessages,
    usage: trimmedUsage,
  })

  return { messages: trimmedMessages, usage: trimmedUsage }
}

// --- Cycle Detection ---

/**
 * Options for configuring cycle detection in a thread.
 */
export interface IsThreadCyclicOptions {
  /**
   * The minimum number of consecutive repetitions required to detect a cycle.
   *
   * For example, if set to 2 (the default), the pattern [A, B, A, B] would be
   * detected as cyclic because [A, B] repeats twice consecutively. If set to
   * 3, you would need [A, B, A, B, A, B] for detection.
   *
   * Higher values reduce false positives but may miss shorter loops.
   *
   * @default 2
   */
  minRepetitions?: number

  /**
   * The minimum pattern length (in messages) to check for cycles.
   *
   * For example, if set to 2 (the default), the algorithm checks for repeating
   * pairs of messages first, then triplets, etc. If set to 3, it would skip
   * checking for repeating pairs and start with triplets.
   *
   * A typical conversation loop might be: user asks → bot responds → user asks
   * same thing → bot responds same thing. This is a pattern of length 2.
   *
   * @default 2
   */
  minPatternLength?: number

  /**
   * The maximum pattern length (in messages) to check for cycles.
   *
   * Limits how long of a repeating sequence the algorithm will look for. If
   * not specified, defaults to `messages.length / minRepetitions`, which is
   * the theoretical maximum that could repeat the required number of times.
   *
   * Lower values improve performance but may miss longer cyclical patterns.
   */
  maxPatternLength?: number

  /**
   * The minimum number of consecutive identical tool results - same function
   * name, same arguments and same result - required before
   * {@link hasRepeatedResultRun} reports a loop.
   *
   * @default 3 ({@link DEFAULT_MIN_RESULT_REPETITIONS})
   */
  minResultRepetitions?: number
}

/**
 * A function that detects repeated suffixes in a thread of messages, which can
 * indicate cyclic conversation patterns.
 *
 *  For this heuristic, a thread is considered cyclic if it contains repeated
 * sequences of messages that indicate a loop in the conversation flow.
 */
export function hasRepeatedSuffix(
  messages: Message[],
  options: IsThreadCyclicOptions = {}
): boolean {
  const normalizedMinRepetitions = Number.isFinite(options.minRepetitions)
    ? Math.max(1, Math.floor(options.minRepetitions ?? 2))
    : 2

  const normalizedMinPatternLength = Number.isFinite(options.minPatternLength)
    ? Math.max(1, Math.floor(options.minPatternLength ?? 2))
    : 2

  const normalizedMaxPatternLengthOption = Number.isFinite(
    options.maxPatternLength
  )
    ? Math.max(
        normalizedMinPatternLength,
        Math.floor(options.maxPatternLength as number)
      )
    : undefined

  const {
    minRepetitions,
    minPatternLength,
    maxPatternLength: maxPatternLengthOption,
  } = {
    minRepetitions: normalizedMinRepetitions,
    minPatternLength: normalizedMinPatternLength,
    maxPatternLength: normalizedMaxPatternLengthOption,
  }

  // @note need at least minPatternLength * minRepetitions messages to detect a
  // cycle

  const minMessages = minPatternLength * minRepetitions

  if (messages.length < minMessages) {
    return false
  }

  // create a fingerprint for each message based on type, text and meta

  const fingerprints = messages.map((m) =>
    JSON.stringify([
      m.type,
      m.text,
      m.meta === undefined ? undefined : safeStringify(m.meta),
    ])
  )

  // check for repeated patterns of various lengths - start with smaller
  // patterns as they're more likely to indicate tight loops

  const maxPatternLength =
    maxPatternLengthOption ?? Math.floor(messages.length / minRepetitions)

  for (
    let patternLength = minPatternLength;
    patternLength <= maxPatternLength;
    patternLength++
  ) {
    // check if the last N messages match the previous N messages

    const windowSize = patternLength * minRepetitions

    if (messages.length < windowSize) {
      continue
    }

    // extract the pattern from the end of the messages

    const pattern = fingerprints.slice(-patternLength)

    // count how many times this pattern repeats consecutively at the end

    let repetitions = 0

    for (
      let i = fingerprints.length - patternLength;
      i >= 0;
      i -= patternLength
    ) {
      const segment = fingerprints.slice(i, i + patternLength)

      if (segment.length !== patternLength) {
        break
      }

      const matches = segment.every((fp, idx) => fp === pattern[idx])

      if (matches) {
        repetitions++
      } else {
        break
      }
    }

    // if the pattern repeats enough times consecutively, we have a cycle

    if (repetitions >= minRepetitions) {
      return true
    }
  }

  return false
}

/**
 * A function that detects repeated activity tails at the end of a thread.
 *
 * This heuristic only applies when the thread currently ends with activity
 * messages. It compresses the trailing activity tail down to tool names,
 * inputs, and outputs, then checks whether that tail repeats a relatively
 * small set of activity signatures.
 */
export function hasRepeatedActivityTail(
  messages: Message[],
  _options: IsThreadCyclicOptions = {}
): boolean {
  type ActivityTailEntry = {
    type: string
    name: string
    inputHash?: string
    outputHash?: string
  }

  const trailingActivityTail: ActivityTailEntry[] = []

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]

    if (message.type !== 'activity') {
      break
    }

    const activity = (message.meta as { activity?: unknown } | undefined)
      ?.activity

    if (!activity || typeof activity !== 'object') {
      break
    }

    const activityType = (activity as { type?: unknown }).type
    const activityFunction = (activity as { function?: unknown }).function

    if (typeof activityType !== 'string') {
      break
    }

    if (!activityFunction || typeof activityFunction !== 'object') {
      break
    }

    const name = (activityFunction as { name?: unknown }).name

    if (typeof name !== 'string') {
      break
    }

    trailingActivityTail.push({
      type: activityType,
      name,
      inputHash: Object.prototype.hasOwnProperty.call(
        activityFunction,
        'arguments'
      )
        ? safeStringify((activityFunction as { arguments?: unknown }).arguments)
        : undefined,
      outputHash: Object.prototype.hasOwnProperty.call(
        activityFunction,
        'result'
      )
        ? safeStringify((activityFunction as { result?: unknown }).result)
        : undefined,
    })
  }

  trailingActivityTail.reverse()

  if (trailingActivityTail.length < 8) {
    return false
  }

  const requestInputs = trailingActivityTail
    .filter(
      (entry) => entry.type === 'request' && entry.inputHash !== undefined
    )
    .map((entry) => entry.inputHash as string)

  const responseOutputs = trailingActivityTail
    .filter(
      (entry) => entry.type === 'response' && entry.outputHash !== undefined
    )
    .map((entry) => entry.outputHash as string)

  if (requestInputs.length < 4 || responseOutputs.length < 4) {
    return false
  }

  const uniqueNames = new Set(trailingActivityTail.map((entry) => entry.name))
  const uniqueInputs = new Set(requestInputs)
  const uniqueOutputs = new Set(responseOutputs)
  const uniqueSignatures = new Set(
    trailingActivityTail.map((entry) =>
      safeStringify([entry.type, entry.name, entry.inputHash, entry.outputHash])
    )
  )
  const requestOutputSets = new Map<string, Set<string>>()
  const requestOutputCounts = new Map<string, number>()

  for (let index = 0; index < trailingActivityTail.length - 1; index++) {
    const requestEntry = trailingActivityTail[index]
    const responseEntry = trailingActivityTail[index + 1]

    if (requestEntry.type !== 'request' || responseEntry.type !== 'response') {
      continue
    }

    if (
      requestEntry.name !== responseEntry.name ||
      requestEntry.inputHash === undefined ||
      responseEntry.outputHash === undefined
    ) {
      continue
    }

    const requestKey = safeStringify([
      requestEntry.name,
      requestEntry.inputHash,
    ])

    const outputSet = requestOutputSets.get(requestKey) ?? new Set<string>()

    outputSet.add(responseEntry.outputHash)

    requestOutputSets.set(requestKey, outputSet)

    requestOutputCounts.set(
      requestKey,
      (requestOutputCounts.get(requestKey) ?? 0) + 1
    )
  }

  const hasRepeatedNames = uniqueNames.size < trailingActivityTail.length
  const hasRepeatedInputs = uniqueInputs.size < requestInputs.length
  const hasRepeatedOutputs = uniqueOutputs.size < responseOutputs.length

  const hasCompressedSignatureSet =
    uniqueSignatures.size * 2 <= trailingActivityTail.length

  const hasProgressingRepeatedRequest = Array.from(
    requestOutputSets.entries()
  ).some(([requestKey, outputSet]) => {
    const outputCount = requestOutputCounts.get(requestKey) ?? 0

    return outputCount >= 3 && outputSet.size === outputCount
  })

  return (
    hasCompressedSignatureSet &&
    hasRepeatedNames &&
    hasRepeatedInputs &&
    hasRepeatedOutputs &&
    !hasProgressingRepeatedRequest
  )
}

/**
 * The default number of consecutive identical tool results required before
 * {@link hasRepeatedResultRun} reports a loop.
 */
export const DEFAULT_MIN_RESULT_REPETITIONS = 3

/**
 * A function that detects a tool being called the same way over and over while
 * returning the same result - the model making the exact same call and getting
 * the exact same answer, learning nothing, until something external stops it
 * (for example, a dataset `search` for the same term returning `records: []`
 * forever).
 *
 * It keys on each response activity's (name, arguments, result) but - unlike the
 * other heuristics - looks ONLY at the tool-result stream, skipping every
 * message in between. That is the gap it fills: `hasRepeatedSuffix` needs the
 * surrounding messages (reasoning, assistant text) to repeat byte-for-byte and
 * `hasRepeatedActivityTail` needs a long *contiguous* run of activity messages,
 * so a single interleaved reasoning message (as a reasoning model emits between
 * tool calls) defeats both. This one walks the response results from newest
 * backwards and trips when the last `minResultRepetitions` share the same
 * (name, arguments, result).
 *
 * Arguments ARE part of the signature on purpose: a model issuing *different*
 * calls that happen to return the same trivial result - several distinct shell
 * commands each producing empty output, infrastructure polling - is making
 * progress, not looping, and must not be flagged. Only the identical call
 * repeated is a loop.
 *
 * Synthetic internal activities - the `_`-prefixed notices such as
 * `_cycleDetected` that are injected to nudge the model out of a loop - are
 * skipped, so a single injected notice cannot break the run and mask an ongoing
 * loop. Responses still streaming (no `result` yet) are skipped for the same
 * reason: they are not a settled outcome to compare.
 */
export function hasRepeatedResultRun(
  messages: Message[],
  options: IsThreadCyclicOptions = {}
): boolean {
  const minResultRepetitions = Number.isFinite(options.minResultRepetitions)
    ? Math.max(2, Math.floor(options.minResultRepetitions as number))
    : DEFAULT_MIN_RESULT_REPETITIONS

  // @note collect, newest-first, the (name, result) signature of each genuine
  // tool result. Non-tool-result messages (plain text, reasoning, request
  // halves, internal `_`-prefixed notices, results-in-progress) are skipped
  // rather than treated as breaks, so interleaved reasoning and a single
  // recovery notice never hide a loop. A genuinely different tool result still
  // breaks the run because it lands in the window with a different signature.

  const signatures: string[] = []

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]

    if (message.type !== 'activity') {
      continue
    }

    const activity = (message.meta as { activity?: unknown } | undefined)
      ?.activity

    if (!activity || typeof activity !== 'object') {
      continue
    }

    if ((activity as { type?: unknown }).type !== 'response') {
      continue
    }

    const activityFunction = (activity as { function?: unknown }).function

    if (!activityFunction || typeof activityFunction !== 'object') {
      continue
    }

    const name = (activityFunction as { name?: unknown }).name

    if (
      typeof name !== 'string' ||
      name.startsWith('_') ||
      !Object.prototype.hasOwnProperty.call(activityFunction, 'result')
    ) {
      continue
    }

    signatures.push(
      safeStringify([
        name,
        safeStringify((activityFunction as { arguments?: unknown }).arguments),
        safeStringify((activityFunction as { result?: unknown }).result),
      ])
    )

    // @note the run is measured from the newest result backwards, so once we
    // have the required number of trailing results we have all we need to decide

    if (signatures.length >= minResultRepetitions) {
      break
    }
  }

  if (signatures.length < minResultRepetitions) {
    return false
  }

  const newest = signatures[0]

  return signatures.every((signature) => signature === newest)
}

/**
 * A heuristic that reports a cycle when any of the trailing messages in the
 * thread contains a runaway in-message text repetition. This is the
 * thread-level adapter around `hasRepeatedTextRun`; it acts as a safety net for
 * degenerate messages that get committed to the thread (the live stream is
 * guarded separately and earlier).
 */
function hasRepeatedMessageTextRun(
  messages: Message[],
  _options: IsThreadCyclicOptions = {}
): boolean {
  return messages.slice(-5).some(
    (message) =>
      // @note internal working channels are exempt: the
      // reasoning channel is the model's scratchpad and activity carries
      // tool-call output, both legitimately repetitive (enumerations, grids,
      // table rows) and neither is the user-facing answer. Only answer messages
      // are scanned, matching what the live stream guard now does.
      message.type !== 'reasoning' &&
      message.type !== 'activity' &&
      typeof message.text === 'string' &&
      hasRepeatedTextRun(message.text)
  )
}

/**
 * A function that determines if a thread of messages is cyclic based on a
 * number of heuristics.
 */
const THREAD_CYCLE_HEURISTICS: Array<
  [string, (messages: Message[], options: IsThreadCyclicOptions) => boolean]
> = [
  ['repeated_suffix', hasRepeatedSuffix],
  ['repeated_activity_tail', hasRepeatedActivityTail],
  ['repeated_result_run', hasRepeatedResultRun],
  ['repeated_message_text_run', hasRepeatedMessageTextRun],
]

export function isThreadCyclic(
  messages: Message[],
  options: IsThreadCyclicOptions = {}
): boolean {
  return THREAD_CYCLE_HEURISTICS.some(([, heuristic]) =>
    heuristic(messages, options)
  )
}

/**
 * Returns the name of the first cycle heuristic that fires for the given thread,
 * or null when the thread is not cyclic. Mirrors `isThreadCyclic` but reports
 * *which* heuristic tripped, so a stuck run can be attributed and troubleshooted
 * rather than just flagged. Cheap enough to call at the (rare) stop point.
 */
export function describeThreadCycle(
  messages: Message[],
  options: IsThreadCyclicOptions = {}
): string | null {
  for (const [name, heuristic] of THREAD_CYCLE_HEURISTICS) {
    if (heuristic(messages, options)) {
      return name
    }
  }

  return null
}

// --- Runaway Repetition Detection ---

/**
 * Options for configuring runaway text-run detection within a single message.
 */
export interface HasRepeatedTextRunOptions {
  /**
   * The minimum number of trailing sentence-like units required before the
   * heuristic will consider reporting a runaway. Short, naturally repetitive
   * snippets stay below this floor and are ignored.
   *
   * @default 8
   */
  minUnits?: number

  /**
   * The maximum number of trailing units to inspect. This bounds the cost of
   * the check and lets a degenerate tail still be caught after a long, healthy
   * prefix (these loops almost always degenerate towards the end of the
   * stream).
   *
   * @default 64
   */
  window?: number

  /**
   * The maximum ratio of unique units to inspected units, at or below which the
   * text is considered a runaway loop. The default of 0.5 means the unique set
   * must collapse to at most half of the inspected units - a healthy paragraph
   * virtually never repeats whole normalized sentences that densely.
   *
   * @default 0.5
   */
  maxUniqueRatio?: number
}

/**
 * Splits a block of text into normalized, sentence-like units suitable for
 * runaway detection. Normalization lowercases, strips punctuation and collapses
 * whitespace so that phrases that differ only in punctuation or spacing (for
 * example "Let me call lint()." and "Let me call lint().  ") collapse to the
 * same key, while genuinely distinct sentences stay distinct.
 */
function segmentNormalizedUnits(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((unit) =>
      unit
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((unit) => unit.length > 0)
}

// @note the backstop detector only inspects this many trailing characters of a
// committed message so its cost does not grow with message length
const RUNAWAY_TEXT_RUN_TAIL_LIMIT = 4000

/**
 * A function that detects a runaway repetition within a single block of text -
 * for example a model getting stuck repeating the same handful of sentences in
 * its reasoning or output ("Let me call lint(). I'll do it now. Let me call
 * lint(). ..." repeated dozens of times).
 *
 * Unlike `hasRepeatedSuffix` and `hasRepeatedActivityTail`, which operate across
 * message boundaries, this heuristic works inside a single message's text. It is
 * intended to run incrementally against the in-flight stream so a degenerate
 * turn can be cut short before it burns the whole token budget - the
 * thread-level checks never see it because such a turn loops in reasoning
 * without ever emitting a tool call.
 *
 * The heuristic segments the trailing text into normalized sentence-like units
 * and reports a runaway when that set is churned densely - that is, when the
 * number of unique units collapses to at most `maxUniqueRatio` of the inspected
 * units. This mirrors the compression idea used by `hasRepeatedActivityTail` but
 * at the granularity of sentences rather than tool-call signatures, so it
 * tolerates the small phrase-level variation typical of these loops instead of
 * requiring byte-exact repeats.
 */
export function hasRepeatedTextRun(
  text: string,
  options: HasRepeatedTextRunOptions = {}
): boolean {
  if (typeof text !== 'string' || text.length === 0) {
    return false
  }

  const minUnits = Number.isFinite(options.minUnits)
    ? Math.max(2, Math.floor(options.minUnits as number))
    : 8

  const window = Number.isFinite(options.window)
    ? Math.max(minUnits, Math.floor(options.window as number))
    : Math.max(minUnits, 64)

  const maxUniqueRatio =
    Number.isFinite(options.maxUniqueRatio) &&
    (options.maxUniqueRatio as number) > 0 &&
    (options.maxUniqueRatio as number) <= 1
      ? (options.maxUniqueRatio as number)
      : 0.5

  // this is a backstop that runs on already-committed messages, so bound the
  // work to the tail - cost stays flat regardless of how long the message is

  const boundedText =
    text.length > RUNAWAY_TEXT_RUN_TAIL_LIMIT
      ? text.slice(-RUNAWAY_TEXT_RUN_TAIL_LIMIT)
      : text

  const units = segmentNormalizedUnits(boundedText)

  if (units.length < minUnits) {
    return false
  }

  // only inspect the trailing window so a degenerate tail is still caught after
  // a long healthy prefix, and so the cost stays bounded during streaming

  const considered = units.slice(-window)

  if (considered.length < minUnits) {
    return false
  }

  const unique = new Set(considered)

  return unique.size <= considered.length * maxUniqueRatio
}

/**
 * Options for the incremental repetition guard.
 */
export interface RepetitionGuardOptions {
  /**
   * The number of consecutive words that make up a tracked phrase. Longer
   * phrases are less likely to recur by chance, which reduces false positives.
   *
   * @default 4
   */
  ngram?: number

  /**
   * The maximum number of recent words kept in the rolling window. The guard
   * only ever sees this many trailing words, which keeps its cost flat and
   * bounds how far apart repeats can be while still counting as a loop.
   *
   * @default 48
   */
  window?: number

  /**
   * The number of times a single phrase must recur within the window before the
   * guard reports a runaway loop.
   *
   * @default 4
   */
  maxRepeats?: number

  /**
   * The maximum ratio of unique words to total words in the window at or below
   * which a recurring phrase is treated as a genuine runaway. This is the
   * lexical-diversity gate: a truly stuck loop churns the same handful of words
   * (low ratio), whereas a model that is *progressing* - for example triaging a
   * list where every line ends with the same short verdict but names a distinct
   * item - keeps the window diverse (high ratio) and is left alone. Mirrors the
   * idea behind `hasRepeatedTextRun`'s own `maxUniqueRatio`.
   *
   * @note the default was lowered from 0.5 to 0.4 for a real
   * progressing investor list whose later, terser lines shared a short tail
   * ("... active in AI. Not in CRM.") landed at a window ratio of 0.449 and was
   * cut off mid-work. Genuinely low-information templating loops (the case we do
   * want to catch) sit at <= 0.347, so 0.4 splits the two with margin on both
   * sides. See the "regression recurrence" and "progress vs stuck" tests.
   *
   * @default 0.4
   */
  maxUniqueRatio?: number

  /**
   * The minimum number of characters the model must have produced in the turn
   * before the guard is allowed to trip. Below this the output is too short to be
   * worth interrupting - a brief repetitive burst (a small list, a few identical
   * lines) ends on its own - so it is left alone. A genuine runaway is unbounded
   * and crosses any floor, so this only delays the catch by `minChars` of output.
   * Counts every character pushed (reasoning + text), matching the `bufferLength`
   * reported with each trip.
   *
   * @default 0 (no minimum; the guard may trip as soon as a phrase recurs)
   */
  minChars?: number
}

/**
 * A stateful, incremental guard that detects a runaway repetition as text is
 * streamed in, in O(1) per chunk, so it can be run on every token without the
 * cost of re-scanning the whole turn.
 */
export interface RepetitionGuard {
  /**
   * Feeds a chunk of streamed text into the guard and returns whether a runaway
   * repetition has been detected. Once tripped it stays tripped.
   */
  push(text: string): boolean

  /**
   * Returns the phrase that tripped the guard and how many times it recurred
   * within the window, or null while the guard has not tripped. This is the
   * "why" behind a runaway stop and is meant to be attached to the observation
   * so the loop can be reconstructed when troubleshooting.
   *
   * `phrase` is the normalized form (lower-cased, punctuation stripped) used for
   * matching and stable Sentry grouping; `text` is the original token span as the
   * model actually emitted it, suitable for showing back to the user or the model
   * ("I kept repeating ...") instead of a cryptic loop notice.
   *
   * `uniqueRatio` and `hapaxRatio` are the window's lexical-diversity and novelty
   * ratios at the trip - the signals that separate a stuck loop (both low) from a
   * wrongly-flagged progressing list (both higher). They are reported so each
   * stop can be triaged from telemetry rather than re-derived by hand.
   */
  reason(): {
    phrase: string
    count: number
    text: string
    uniqueRatio: number
    hapaxRatio: number
  } | null
}

/**
 * Creates an incremental repetition guard.
 *
 * Unlike `hasRepeatedTextRun`, which re-scans a whole block of text, this guard
 * maintains a rolling window of the last `window` normalized words together with
 * a running count of every `ngram`-word phrase currently in that window. Each
 * pushed chunk costs O(1) amortized, so the guard can run on every streamed
 * token and trip within a few repeats of a tight loop - long before the heavier
 * `hasRepeatedTextRun` backstop would accumulate enough to react.
 *
 * When any phrase recurs `maxRepeats` times the guard latches on and `push`
 * returns true from then on; the caller is expected to stop the stream.
 */
export function createRepetitionGuard(
  options: RepetitionGuardOptions = {}
): RepetitionGuard {
  const ngram = Number.isFinite(options.ngram)
    ? Math.max(2, Math.floor(options.ngram as number))
    : 4

  const window = Number.isFinite(options.window)
    ? Math.max(ngram, Math.floor(options.window as number))
    : Math.max(ngram, 48)

  const maxRepeats = Number.isFinite(options.maxRepeats)
    ? Math.max(2, Math.floor(options.maxRepeats as number))
    : 4

  const maxUniqueRatio = Number.isFinite(options.maxUniqueRatio)
    ? Math.min(1, Math.max(0, options.maxUniqueRatio as number))
    : 0.4

  // @note minimum output length before the guard may trip (see the minChars
  // option). Short repetitive output is harmless - it ends on its own - and was
  // the bulk of loop-detection false positives; a genuine runaway is
  // unbounded and crosses any floor. Defaults to 0 so the bare guard is
  // unchanged; production sets it at the call site.
  const minChars = Number.isFinite(options.minChars)
    ? Math.max(0, Math.floor(options.minChars as number))
    : 0

  // @note structural-enumeration exemption (from production-like inputs). A
  // recurring phrase inside a multi-line list or table whose lines still carry
  // distinct content - a timetable, a JSON sheet, a changelog - is legitimate
  // progress, not a runaway, and must not be cut off mid-stream. Production trips
  // were dominated by exactly this shape. A genuine loop is still caught because
  // it introduces almost no novel tokens (hapax ~ 0). The exemption is part of the
  // default conservative posture; a caller that raises maxUniqueRatio to or above
  // STRUCTURE_AGGRESSIVE_GATE has explicitly opted into aggressive detection, so
  // the exemption is lifted there.
  const STRUCTURE_AGGRESSIVE_GATE = 0.5
  const MIN_STRUCTURE_NEWLINES = 2
  const STRUCTURE_HAPAX_FLOOR = 0.1
  // @note the hapax ratio is measured over the whole window, so a long shared
  // line suffix (e.g. a repeated "(uso off-label devido à ...)" annotation) can
  // drag it below the floor even when each line clearly starts with a distinct
  // key. The distinct-line-lead count is the complementary signal: a real list
  // starts each line with a different token (a time, an index, a device name),
  // whereas a loop repeats the same line start. Either signal clears the gate.
  const MIN_DISTINCT_LINE_LEADS = 3

  const words: string[] = []
  const counts = new Map<string, number>()

  // @note the original (un-normalized) tokens, kept in lockstep with `words` so
  // the phrase that tripped the guard can be reported as the model actually wrote
  // it - readable enough to show the user - rather than the normalized form
  const originals: string[] = []

  // @note per-word occurrence counts over the same rolling window, kept in sync
  // with `words`, so the lexical diversity of the window is available in O(1)
  const wordCounts = new Map<string, number>()

  // @note newline count immediately preceding each word, kept in lockstep with
  // `words`, plus its running total over the window - so "is this a multi-line
  // block?" is available in O(1) for the structural-enumeration exemption
  const newlinesBefore: number[] = []
  let windowNewlines = 0

  let pending = ''
  // @note newlines seen in a trailing separator but not yet attributed to a word
  // (the next word may arrive in a later chunk); carried across push calls
  let carryNewlines = 0
  // @note total characters pushed so far (reasoning + text); gates the trip on
  // minChars so short repetitive output is never interrupted
  let totalChars = 0
  let tripped = false
  let trippedPhrase = ''
  let trippedText = ''
  let trippedCount = 0

  // @note the two diagnostics that distinguish a stuck loop from a progressing
  // list, captured at the trip so each stop carries the "why": the window's
  // lexical-diversity ratio (the gate's own metric) and its novelty ratio (the
  // fraction of the window seen exactly once). A real loop is low on both; a
  // wrongly-flagged list runs high. Surfaced for monitoring, not yet for gating.
  let trippedUniqueRatio = 0
  let trippedHapaxRatio = 0

  // @note fraction of the window seen exactly once - the novelty signal that
  // separates a progressing list (many distinct keys, higher hapax) from a stuck
  // loop (the same few words, hapax ~ 0). Only ever called at a candidate trip,
  // never on the per-token hot path.
  function computeHapaxRatio(): number {
    let hapax = 0

    for (const wordCount of wordCounts.values()) {
      if (wordCount === 1) {
        hapax++
      }
    }

    return hapax / words.length
  }

  // @note number of DISTINCT line-leading tokens in the window - a word counts as
  // a line lead when at least one newline immediately precedes it. A stuck loop
  // repeats the same line, so it has only one or two distinct leads; a
  // progressing enumerated list keeps starting lines with new keys. This rescues
  // lists whose long shared suffix sinks the hapax ratio. Like
  // computeHapaxRatio, only ever called at a candidate trip.
  function countDistinctLineLeads(): number {
    const leads = new Set<string>()

    for (let i = 0; i < words.length; i++) {
      if (newlinesBefore[i] >= 1) {
        leads.add(words[i])
      }
    }

    return leads.size
  }

  function addWord(word: string, original: string, nlBefore: number): void {
    words.push(word)

    originals.push(original)

    newlinesBefore.push(nlBefore)

    windowNewlines += nlBefore

    wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1)

    // count the phrase that now ends at the back of the window

    if (words.length >= ngram) {
      const gram = words.slice(words.length - ngram).join(' ')
      const next = (counts.get(gram) ?? 0) + 1

      counts.set(gram, next)

      // @note a phrase recurring often enough is necessary but not sufficient:
      // only treat it as a runaway when the surrounding window also lacks
      // lexical diversity. A genuinely stuck loop churns the same few words
      // (low ratio); a progressing list keeps introducing novel ones (high
      // ratio) and must not be cut off mid-work.

      const uniqueRatio = wordCounts.size / words.length

      if (
        totalChars >= minChars &&
        next >= maxRepeats &&
        uniqueRatio <= maxUniqueRatio
      ) {
        // @note structural-enumeration exemption (see the constants above): a
        // recurring phrase that sits inside a multi-line block still introducing
        // novel tokens is a progressing list/table, not a stuck loop. The cheap
        // newline check short-circuits the hapax scan, so a genuine single-line
        // loop never pays for it.
        const enumerated =
          maxUniqueRatio < STRUCTURE_AGGRESSIVE_GATE &&
          windowNewlines >= MIN_STRUCTURE_NEWLINES &&
          (computeHapaxRatio() >= STRUCTURE_HAPAX_FLOOR ||
            countDistinctLineLeads() >= MIN_DISTINCT_LINE_LEADS)

        if (!enumerated) {
          tripped = true

          // @note remember the phrase that first tripped the guard so the caller
          // can report *what* the model got stuck repeating

          if (!trippedPhrase) {
            trippedPhrase = gram
            trippedText = originals.slice(originals.length - ngram).join(' ')
            trippedCount = next
            trippedUniqueRatio = uniqueRatio
            trippedHapaxRatio = computeHapaxRatio()
          }
        }
      }
    }

    // evict the oldest word and drop the phrase that leaves the window

    if (words.length > window) {
      const leaving = words.slice(0, ngram).join(' ')
      const next = (counts.get(leaving) ?? 0) - 1

      if (next <= 0) {
        counts.delete(leaving)
      } else {
        counts.set(leaving, next)
      }

      const leavingWord = words[0]
      const leavingWordCount = (wordCounts.get(leavingWord) ?? 0) - 1

      if (leavingWordCount <= 0) {
        wordCounts.delete(leavingWord)
      } else {
        wordCounts.set(leavingWord, leavingWordCount)
      }

      windowNewlines -= newlinesBefore[0]

      newlinesBefore.shift()

      words.shift()
      originals.shift()
    }
  }

  return {
    push(text: string): boolean {
      if (tripped) {
        return true
      }

      if (typeof text !== 'string' || text.length === 0) {
        return false
      }

      totalChars += text.length

      pending += text

      // @note split while keeping the whitespace separators (captured group) so
      // the newlines between words survive - they feed the structural-enumeration
      // exemption. Parts alternate word, separator, word, separator, ...
      const parts = pending.split(/(\s+)/)

      // the final part may be an incomplete word still being streamed, so hold
      // it back until a whitespace boundary completes it

      pending = parts.pop() ?? ''

      for (let index = 0; index < parts.length; index++) {
        if (index % 2 === 1) {
          // @note a separator: tally its newlines against the next word

          carryNewlines += (parts[index].match(/\n/g) ?? []).length

          continue
        }

        const raw = parts[index]
        const word = raw.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

        if (word) {
          addWord(word, raw, carryNewlines)

          carryNewlines = 0
        }

        if (tripped) {
          return true
        }
      }

      return tripped
    },

    reason(): {
      phrase: string
      count: number
      text: string
      uniqueRatio: number
      hapaxRatio: number
    } | null {
      return tripped
        ? {
            phrase: trippedPhrase,
            count: trippedCount,
            text: trippedText || trippedPhrase,
            uniqueRatio: trippedUniqueRatio,
            hapaxRatio: trippedHapaxRatio,
          }
        : null
    },
  }
}
