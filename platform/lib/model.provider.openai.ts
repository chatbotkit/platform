/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-check
import { getTextTokensLength } from '@chatbotkit-dev/gpt'
import {
  FIVE_MINUTE_IN_MILLISECONDS,
  ONE_MINUTE_IN_MILLISECONDS,
} from '@chatbotkit-dev/time'

import { defaultSpeechToTextModel } from '@/config/models'

import { blobToDataUrl } from '@/lib/dataurl.blob'
import debug, { assert } from '@/lib/debug'
import { isTest } from '@/lib/env'
import {
  BotInputError,
  ContentModerationError,
  SystemError,
  UserConfigError,
  captureError,
} from '@/lib/error'
import _fetch, {
  isBodyStallTimeout,
  withBodyTimeout,
  withRetry,
  withTimeout,
} from '@/lib/fetch'
import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'
import { omit } from '@/lib/object'
import {
  statusToCodeMap,
  statusToMessageMap,
  throwBadRequest,
} from '@/lib/response'
import { reportTokenUsage } from '@/lib/system.metrics'

import { createParser } from 'eventsource-parser'
import type { OpenAI } from 'openai'
import WebSocket from 'ws'

/**
 * Gets the OpenAI API key from model store or environment.
 *
 * @throws {UserConfigError} if a custom URL is set but platform credentials are used
 */
export function getOpenAIKey(): string {
  const store = getSafeModelStore()

  return resolveProviderCredential({
    label: 'OpenAI',
    storeKey: store.openaiKey,
    storeUrl: store.openaiUrl,
    // @note OPENAI_MODELS_API_KEY is the canonical name (consistent with
    // every other provider); OPENAI_API_KEY - the vendor's standard name,
    // also read by the vector module for embeddings - is honoured as a
    // fallback so one key can drive both
    envKey: process.env.OPENAI_MODELS_API_KEY || process.env.OPENAI_API_KEY,
  })
}

/**
 * Gets the OpenAI API URL from model store or default.
 */
export function getOpenAIUrl(): string {
  const url = getSafeModelStore().openaiUrl

  if (url) {
    debug(`using custom openai url`, { url }).log('openai.getOpenAIUrl')
  }

  return url || 'https://api.openai.com/v1/chat/completions'
}

/**
 * Checks if custom credentials are being used instead of platform credentials.
 */
export function hasCustomCredentials(): boolean {
  const store = getSafeModelStore()

  return Object.keys(store).some((k) => k.endsWith('Key') && store[k])
}

// --- Fetchers ----

interface FetchOptions {
  timeout?: number
  retries?: number
  retryDelay?: number
  retryTimeout?: boolean
  signal?: AbortSignal
}

/**
 * fetch instance dedicating for fetching
 */
const fetchForFetching = withRetry(
  withTimeout(_fetch, { timeout: ONE_MINUTE_IN_MILLISECONDS }),
  {
    retries: 5,
    retryDelay: 250,
    retryTimeout: true,
  }
)

/**
 * fetch instance dedicated for streaming
 */
const fetchForStreaming = withRetry(
  withBodyTimeout(
    withTimeout(_fetch, { timeout: ONE_MINUTE_IN_MILLISECONDS }),
    {
      /**
       * @note how long a streaming response may stall - between chunks, or
       * before the first token - before we give up. Well below undici's ~300s
       * default body timeout so a gateway that returns headers and then goes
       * silent fails fast with an attributable error instead of hanging for ~5
       * minutes, producing 0 tokens and leaving the turn "incomplete" (seen in
       * prod as bare `TypeError: terminated` / UND_ERR_BODY_TIMEOUT). The timer
       * resets on every chunk, so a slow-but-steady stream is unaffected; this
       * only catches a genuinely stalled upstream.
       */
      bodyTimeout: 2 * ONE_MINUTE_IN_MILLISECONDS,
    }
  ),
  {
    retries: 5,
    retryDelay: 250,
    retryTimeout: true,
  }
)

/**
 * @note how many times we re-issue a streaming request that stalled in its body
 * phase (headers arrived, then the gateway went silent) *before* emitting a
 * single token. `withBodyTimeout` surfaces that stall as a `TimeoutError` during
 * stream consumption - which is downstream of `fetchForStreaming`'s own
 * `withRetry`, so the fetch layer never gets to retry it. These pre-token stalls
 * are transient (a flaky gateway route) and, crucially, safe to retry: nothing
 * has been yielded yet, so re-running cannot duplicate output. Once any token
 * has been emitted we never retry (see `withPreTokenStreamRetry`).
 */
const STREAM_PRE_TOKEN_STALL_RETRIES = 2

/**
 * @note delay before re-issuing a stalled pre-token streaming request.
 */
const STREAM_PRE_TOKEN_STALL_RETRY_DELAY = 250

/**
 * fetch instance dedicating for long tasks
 */
const fetchForLongTasks = withRetry(
  withTimeout(_fetch, { timeout: FIVE_MINUTE_IN_MILLISECONDS }),
  {
    retries: 5,
    retryDelay: 250,
    retryTimeout: true,
  }
)

/**
 * fetch instance dedicated for image creation
 */
const fetchForImage = withRetry(withTimeout(_fetch, { timeout: 0 }), {
  retries: 5,
  retryDelay: 250,
  retryTimeout: true,
})

// --- Error ---

/**
 * Detects whether a provider error message describes a content moderation /
 * safety-filter rejection rather than a genuinely malformed request. These come
 * back as 400s across providers but are policy blocks, not bugs. Known shapes:
 *
 * - Alibaba Model Studio: `data_inspection_failed` / "inappropriate content"
 * - OpenAI: "rejected as a result of our safety system" / "not allowed by our
 *   safety system" / "may violate our usage policies"
 * - Azure OpenAI: "triggering ... content management policy"
 * - generic: `content_filter`, "flagged"
 */
export function isContentModerationMessage(message: string): boolean {
  if (!message) {
    return false
  }

  return /inappropriate content|data[\s_]?inspection|content (?:management|moderation|policy|filter)|content_filter|safety (?:filter|systems?)|usage polic(?:y|ies)|\bflagged\b/i.test(
    message
  )
}

/**
 * Detects whether a provider error message describes an unsupported or malformed
 * input file (e.g. an SVG handed to an image-edit endpoint that only accepts
 * jpeg/png/webp) rather than a genuine system fault. These come back as 400s but
 * are caused by the bot/user supplying a file the provider won't accept, not by
 * a bug. Known shapes (OpenAI images endpoints):
 *
 * - "Invalid file 'image[0]': unsupported mimetype ('image/svg+xml')..."
 * - "...Supported file formats are 'image/jpeg', 'image/png', and 'image/webp'."
 */
export function isUnsupportedInputFileMessage(message: string): boolean {
  if (!message) {
    return false
  }

  return /unsupported (?:mimetype|file|image|format)|invalid (?:file|image)|supported (?:file )?formats? are/i.test(
    message
  )
}

/**
 * Gets a normalized error object from an OpenAI API error response, with
 * enhanced messages and error codes for better debugging and user feedback.
 */
export function getOpenAIError(
  error: any,
  options?: { errorPrefix?: string; body?: Record<string, any> }
): SystemError {
  debug(`getOpenAIError`, { error }).log('openai.getOpenAIError')

  let errorMessage = error.response?.data?.error?.message

  if (!errorMessage) {
    if (Array.isArray(error.response?.data)) {
      errorMessage = error.response.data
        .map(({ error }) => error.message)
        .join(', ')
    }
  }

  if (!errorMessage) {
    const { message } = error.toJSON?.() || {}

    errorMessage = message
  }

  if (!errorMessage) {
    errorMessage = error.message?.toString?.()
  }

  const status = error.response?.status || 500

  // @note use a human-readable message based on status code if no specific
  // message was provided

  if (!errorMessage) {
    errorMessage = statusToMessageMap[status] || 'Unknown error'
  }

  // @note enhance invalid model ID errors with the actual model name for better debugging

  if (
    errorMessage.toLowerCase().includes('invalid model') &&
    options?.body?.model &&
    errorMessage.includes(options.body.model) === false
  ) {
    errorMessage = `${errorMessage} - Model: ${options.body.model}`
  }

  errorMessage += ` (${status})`

  const errorPrefix = options?.errorPrefix || 'OI_'

  const errorCode = `${errorPrefix}${
    statusToCodeMap[status] || statusToCodeMap[500]
  }`

  // @note when custom (BYOK) credentials are in play the customer owns the
  // upstream endpoint, API key, and model name, so a 4xx that reflects their
  // configuration is their mistake, not a platform fault: authentication and
  // permission failures (401/403) and a missing model or endpoint (404, e.g. a
  // custom model whose name does not exist on the provider they pointed it at)
  // are surfaced as config errors rather than triggering Sentry alerts.
  //
  // @note the ownership is asymmetric and deliberately gated on
  // hasCustomCredentials() rather than status alone: the SAME 404 on PLATFORM
  // credentials means our own catalogue points at a providerModel the upstream
  // rejects - a real bug we want paged on - so it must fall through to the
  // SystemError below.

  if (status === 401 || status === 403 || status === 404) {
    if (hasCustomCredentials()) {
      return new UserConfigError(errorMessage)
    }
  }

  // @note 402 payment required always indicates an account balance issue and
  // should be surfaced to the user regardless of credential source

  if (status === 402) {
    return new UserConfigError(errorMessage)
  }

  // @note provider content moderation / safety-filter rejections come back as
  // 400s but are policy blocks, not malformed requests. Surface them as a
  // distinct, body-less error so callers can react (e.g. shrink the input and
  // retry, or fall back to another model) instead of treating them as opaque
  // bad requests - and so the request body is never attached to the error.

  if (status === 400 && isContentModerationMessage(errorMessage)) {
    return new ContentModerationError(errorMessage)
  }

  // @note unsupported / malformed input files (e.g. an SVG passed to an
  // image-edit endpoint) come back as 400s but are caused by the bot supplying
  // a file the provider won't accept, not by a bug. Surface them as a body-less
  // BotInputError so the message still reaches the model but Sentry is not
  // polluted with what is really bad input.

  if (status === 400 && isUnsupportedInputFileMessage(errorMessage)) {
    return new BotInputError(errorMessage)
  }

  return new SystemError(errorMessage, errorCode, { body: options?.body })
}

/**
 * Throws a normalized error based on an OpenAI API response, with enhanced
 * messages and error codes for better debugging and user feedback.
 *
 * @throws {SystemError}
 */
export async function throwOpenAIError(
  response: Response,
  options?: { errorPrefix?: string; body?: Record<string, any> }
): Promise<never> {
  let data

  try {
    data = await response.json()
  } catch {
    data = {}
  }

  const error = {
    response: {
      status: response.status,
      data: data,
    },
  }

  throw getOpenAIError(error, options)
}

// --- Helpers ---

/**
 * Gets a client user ID for OpenAI API calls, using the provided user string
 * or defaulting to 'test' in test environments.
 */
export function getClientUserId(user?: string): string | undefined {
  if (typeof user === 'string') {
    return user
  }

  if (isTest) {
    return 'test'
  }
}

// --- Completion Helper Types ---

export interface OpenAIFunctionCall {
  name: string
  arguments: any
  // @note set when the streamed arguments could not be parsed as JSON. The
  // conversation layer surfaces this back to the model as the tool result so it
  // can re-emit a valid call, instead of silently invoking with empty arguments.
  error?: string
}

interface OpenAIToolFunctionCall {
  id: string
  type: 'function'
  function: OpenAIFunctionCall
  // @note some providers (Gemini-3 via the Cloudflare/Vertex OpenAI-compat
  // endpoint) attach a provider-specific "thought signature" to the tool call.
  // It rides through the streamed delta and must be replayed verbatim on the
  // follow-up request or the provider rejects the tool turn as invalid.
  extra_content?: {
    google?: {
      thought_signature?: string
    }
  }
}

export type OpenAIToolCall = OpenAIToolFunctionCall

type OpenAIResponseToolFunctionCall = {
  id: string
  type: 'function'
  name: string
  arguments: any
  // @note see OpenAIFunctionCall.error
  error?: string
}

export type OpenAIResponseToolCall = OpenAIResponseToolFunctionCall

export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam

export type ResponseMessage = OpenAI.Responses.EasyInputMessage

export type ResponseInputItem = OpenAI.Responses.ResponseInputItem

export type ResponseInput = OpenAI.Responses.ResponseInput

export interface ChatFunction {
  name: string
  description: string
  parameters: Record<string, any>
}
export interface ChatTool {
  type: 'function'
  function: ChatFunction
}

export type ResponseTool = OpenAI.Responses.FunctionTool

// --- Completion Helper Functions ---

/**
 * Normalizes reasoning effort values for OpenAI API calls, converting 'auto' to
 * undefined to let the API decide, and passing through valid values directly.
 */
function normalizeReasoningEffort(
  reasoningEffort?: 'auto' | 'low' | 'medium' | 'high'
): 'low' | 'medium' | 'high' | undefined {
  switch (reasoningEffort) {
    case 'low':
    case 'medium':
    case 'high':
      return reasoningEffort

    case 'auto':
    default:
      return undefined
  }
}

/**
 * Normalizes provider-specific finish reason variants into the internal enum.
 */
export function normalizeFinishReason(
  finishReason: string | null
): string | null {
  // @todo maybe use regex to be more flexible

  switch (finishReason) {
    case 'content_filter':
    case 'content-filter':
      return 'contentFilter'

    case 'other':
      return 'error'

    case 'function_call':
    case 'function-call':
      return 'functionCall'

    case 'tool_calls':
    case 'tool-calls':
      return 'toolCalls'

    default:
      return finishReason
  }
}

/**
 * Normalizes function definitions for OpenAI chat completions, ensuring that
 * required fields are present and truncating name and description to acceptable
 * lengths.
 */
export function normalizeChatFunctions(
  functions: ChatFunction[]
): ChatFunction[] {
  return functions.map(({ name, description, ...rest }) => {
    assert(!!name, 'function name is required')
    assert(!!description, 'function description is required')

    return {
      ...rest,

      name: name.slice(0, 512), // @todo research what is the actual max length
      description: description.slice(0, 512),

      // @todo maybe remove new lines
    }
  })
}

/**
 * Normalizes tool definitions for OpenAI chat completions, ensuring that
 * required fields are present and truncating name and description to acceptable
 * lengths.
 */
export function normalizeChatTools(tools: ChatTool[]): ChatTool[] {
  return tools.map(
    ({ function: { name, description, parameters, ...rest }, ...restTool }) => {
      assert(!!name, 'tool name is required')
      assert(!!description, 'tool description is required')

      return {
        ...restTool,

        function: {
          ...rest,

          name: name.slice(0, 512), // @todo research what is the actual max length
          description: description.slice(0, 512),

          parameters:
            parameters && Object.keys(parameters).length
              ? parameters
              : {
                  type: 'object',
                  properties: {},
                },

          // @todo maybe remove new lines
        },
      }
    }
  )
}

/**
 *
 * Normalizes tool definitions in OpenAI API responses, ensuring that required
 * fields are present and truncating name and description to acceptable lengths.
 */
export function normalizeResponseTools(tools: ResponseTool[]): ResponseTool[] {
  return tools.map(({ name, description, parameters, ...rest }) => {
    assert(!!name, 'tool name is required')
    assert(!!description, 'tool description is required')

    return {
      ...rest,

      type: /** @type {const} */ 'function',

      name: name.slice(0, 512),
      description: description!.slice(0, 512),

      parameters:
        parameters && Object.keys(parameters).length
          ? parameters
          : {
              type: 'object',
              properties: {},
            },
    }
  })
}

/**
 * Parse an accumulated tool-call argument string. On failure returns empty
 * arguments together with an error describing the malformation, so the
 * conversation layer can surface it back to the model as the tool result and
 * ask for a clean retry - instead of silently invoking the tool with `{}`.
 */
function parseToolCallArguments(
  raw: string,
  name: string
): { arguments: any; error?: string } {
  // @note a tool that takes no parameters yields an empty (or whitespace-only,
  // or entirely absent) argument string. Feeding "" to JSON.parse throws
  // "Unexpected end of JSON input", which would wrongly reject a perfectly
  // valid zero-argument call (e.g. install_shell_tools) as malformed. An empty
  // payload is not malformed - it is the empty object - so return {} with no
  // error. Only a non-empty, unparseable payload is a genuine malformation.
  if (!raw || raw.trim() === '') {
    return { arguments: {} }
  }

  try {
    return { arguments: JSON.parse(raw) }
  } catch (e) {
    return {
      arguments: {},
      error: `Malformed arguments for tool call ${name}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    }
  }
}

/**
 * Turns the tool calls accumulated across streamed deltas into finished tool
 * calls, parsing each accumulated argument string.
 *
 * @note shared by the two points that can complete a streamed tool call: the
 * `tool_calls` finish-reason path, and the end-of-stream flush for providers
 * that never send a finish reason at all.
 */
function finalizeStreamedToolCalls(
  toolCalls: (OpenAIToolCall & { index?: number })[]
): OpenAIToolCall[] {
  return toolCalls.map((toolCall) => {
    const { arguments: args, error: err } = parseToolCallArguments(
      toolCall.function.arguments,
      toolCall.function.name
    )

    return {
      ...toolCall,

      ...(toolCall.function?.name
        ? {
            function: {
              ...toolCall.function,

              arguments: args,
              error: err,
            },
          }
        : null),
    }
  })
}

// --- Text Completion Functions ---

export type CreateTextCompletionFinishReason =
  | 'stop'
  | 'length'
  | 'contentFilter'
  | 'error'
  | null

export interface CreateTextCompletionOptions extends FetchOptions {
  model: string
  prompt: string
  suffix?: string
  maxTokens: number
  temperature?: number
  frequencyPenalty?: number
  presencePenalty?: number
  reasoningEffort?: 'auto' | 'low' | 'medium' | 'high'
  stop?: string[]
  user?: string
  url?: string
  authorization?: string
  headers?: Record<string, string>
  errorPrefix?: string
  extra?: Record<string, any>
  exclude?: string[]
}

/**
 * Creates a completion. Note that the prompt and suffix must fit perfectly
 * otherwise the function will fail.
 *
 * @deprecated
 */
export async function createTextCompletion(
  options: CreateTextCompletionOptions
): Promise<{
  error?: { message: string; code: string }
  finishReason: CreateTextCompletionFinishReason
  completion: string
  reasoning: string | null
  usage: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
  }
}> {
  const {
    model,

    prompt,
    suffix,

    maxTokens,

    temperature,

    frequencyPenalty,
    presencePenalty,

    reasoningEffort,

    stop,

    user,

    url = 'https://api.openai.com/v1/completions',
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    errorPrefix,

    extra = {},

    exclude = [],

    ...fetchOptions
  } = options

  const clientUserId = getClientUserId(user)

  debug(`createCompletion using`, {
    model,

    prompt,
    suffix,

    maxTokens,

    temperature,

    frequencyPenalty,
    presencePenalty,

    reasoningEffort,

    stop,

    user,
    clientUserId,

    url,

    errorPrefix,

    extra,

    exclude,

    ...fetchOptions,
  }).log('openai.createCompletion')

  debug(`createCompletion stats`, {
    prompt: prompt?.length || 0,

    suffix: suffix?.length || 0,
  }).log('openai.createCompletion.stats')

  if (prompt.length < 1) {
    return throwBadRequest(`Input required`) // @note keeping the message generic in case it ends up in the model
  }

  // @note by default this API max maxTokens set to 16, which is not enough for
  // most cases so we need to assert that the max tokens is provided

  assert(maxTokens, 'maxTokens is required for text completions')

  const body = omit(
    {
      model,

      prompt,
      suffix,

      max_tokens: maxTokens,

      temperature,

      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,

      reasoning_effort: normalizeReasoningEffort(reasoningEffort),

      stop,

      user: clientUserId,

      stream: false,

      // @note not accepted by the API
      // store: false,

      ...extra,
    } satisfies OpenAI.Completions.CompletionCreateParamsNonStreaming & {
      reasoning_effort?: ReturnType<typeof normalizeReasoningEffort>
    },
    exclude
  )

  const response = await fetchForFetching(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(body),

    ...fetchOptions,

    // @note carried through the fetch wrappers onto any TimeoutError so the
    // Sentry event records which model stalled (see `withTimeout` in @/lib/fetch)
    meta: { model },
  })

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix, body })
  }

  const data = await response.json()

  debug(`received data`, { data }).log('openai.createCompletion.received')

  const {
    choices: {
      // @note we default finishReason and completion just in case although the API should be fine

      0: {
        finish_reason: _finishReason = 'stop',
        text: completion = '',
        reasoning = null,
      } = {},
    } = [],
    usage: {
      total_tokens: totalTokens = 0,
      prompt_tokens: promptTokens = 0,
      completion_tokens: completionTokens = 0,
    } = {},
  } = data

  let finishReason = _finishReason

  debug(`extracted data`, {
    finishReason,
    completion,
    reasoning,
    totalTokens,
    promptTokens,
    completionTokens,
  }).log('openai.createCompletion.extracted')

  debug(`extracted usage`, {
    model,
    totalTokens,
    promptTokens,
    completionTokens,
  }).log('openai.createCompletion.usage')

  reportTokenUsage({
    model,
    totalTokens,
    promptTokens,
    completionTokens,
  })

  finishReason = normalizeFinishReason(finishReason)

  return {
    finishReason,

    completion,

    reasoning,

    usage: {
      totalTokens,
      promptTokens,
      completionTokens,
    },
  }
}

export type CreateTextCompletionStreamFinishReason =
  | 'stop'
  | 'length'
  | 'contentFilter'
  | 'error'
  | null

export interface CreateTextCompletionStreamOptions extends FetchOptions {
  model: string
  /** @note metric label only (TTFT/throughput); not sent to the provider */
  provider?: string
  prompt: string
  suffix?: string
  maxTokens: number
  temperature?: number
  frequencyPenalty?: number
  presencePenalty?: number
  reasoningEffort?: 'auto' | 'low' | 'medium' | 'high'
  includeUsage?: boolean
  stop?: string[]
  user?: string
  url?: string
  authorization?: string
  headers?: Record<string, string>
  errorPrefix?: string
  extra?: Record<string, any>
  exclude?: string[]
}

type CreateTextCompletionStreamEvent = {
  error?: { message: string; code: string }
  finishReason: CreateTextCompletionStreamFinishReason
  completion: string | null
  reasoning: string | null
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  } | null
}

/**
 * Wraps a model completion stream to measure latency and throughput. Every
 * provider runs over this OpenAI-compatible core, so wrapping the three stream
 * functions here is the single point that covers every provider and every
 * entrypoint (conversation engine, intl, etc.). Two metrics are emitted per
 * provider call:
 *
 *   - `metric.ttft` - request start to the first token (content or reasoning),
 *     in milliseconds. This is true time-to-first-token: it measures one
 *     provider round-trip, free of any agentic-loop / tool-execution time the
 *     caller may add around it.
 *   - `metric.generation` - the provider's reported output-token count together
 *     with the content-streaming window (first to last content token) in
 *     milliseconds. Emitted as raw numerator/denominator so Grafana divides
 *     them into a weighted tokens/sec. The window is content-only so throughput
 *     reflects generation speed and excludes the reasoning phase.
 *
 * Both lines are parsed by external log drains. Metric emission must
 * never disrupt streaming, hence the defensive try/catch around each.
 */
async function* withModelStreamMetrics<
  T extends {
    completion?: string | null
    reasoning?: string | null
    usage?: { completionTokens?: number } | null
  },
>(
  label: { model: string; provider?: string },
  stream: AsyncGenerator<T>
): AsyncGenerator<T> {
  // @note the model name is the real id sent to the API; provider is threaded
  // down from the caller (it is a model-config concept this layer cannot infer)
  // and defaults to 'unknown' for direct callers that do not pass one. Both are
  // required by log drains that drop events with an empty label.

  const model = label.model
  const provider = label.provider || 'unknown'

  const requestStartedAt = Date.now()

  let ttftRecorded = false
  let firstContentTokenAt = 0
  let lastContentTokenAt = 0
  let outputTokens = 0

  try {
    for await (const event of stream) {
      const now = Date.now()

      if (!ttftRecorded && (event.completion || event.reasoning)) {
        ttftRecorded = true

        try {
          debug(`recording ttft`, {
            model,
            provider,
            ttftMs: now - requestStartedAt,
          })
            .log('openai.createCompletionStream')
            .log('metric.ttft')
        } catch (error) {
          debug(`failed to record ttft`, { error }).log(
            'openai.createCompletionStream'
          )
        }
      }

      if (event.completion) {
        if (!firstContentTokenAt) {
          firstContentTokenAt = now
        }

        lastContentTokenAt = now
      }

      if (event.usage?.completionTokens) {
        outputTokens = event.usage.completionTokens
      }

      yield event
    }
  } finally {
    try {
      const genMs = lastContentTokenAt - firstContentTokenAt

      if (outputTokens && firstContentTokenAt && genMs > 0) {
        debug(`recording generation`, {
          model,
          provider,
          outputTokens,
          genMs,
        })
          .log('openai.createCompletionStream')
          .log('metric.generation')
      }
    } catch (error) {
      debug(`failed to record generation`, { error }).log(
        'openai.createCompletionStream'
      )
    }
  }
}

/**
 * Re-issues a streaming request that stalled in its body phase before producing
 * any output. `fetchForStreaming` resolves its response once headers arrive, so
 * a gateway that then goes silent is caught by {@link withBodyTimeout} as a
 * `TimeoutError` raised *while the body is being consumed* - downstream of the
 * fetch-layer `withRetry`, which therefore never sees it (confirmed in prod:
 * these events carry no `fetch.attempts`/`fetch.outcome` tags). Such stalls are
 * transient and, while no token has been emitted, safe to retry without
 * duplicating output.
 *
 * This wrapper takes a *factory* (not a live generator) so it can build a fresh
 * stream per attempt. It retries only when {@link isBodyStallTimeout} holds and
 * nothing has been yielded yet; the moment the first event passes through,
 * `yielded` latches and any later error propagates untouched.
 */
async function* withPreTokenStreamRetry<T>(
  label: { model: string },
  factory: () => AsyncGenerator<T>
): AsyncGenerator<T> {
  let attempt = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let yielded = false

    try {
      for await (const event of factory()) {
        yielded = true

        yield event
      }

      return
    } catch (error) {
      if (
        yielded ||
        attempt >= STREAM_PRE_TOKEN_STALL_RETRIES ||
        !isBodyStallTimeout(error)
      ) {
        throw error
      }

      attempt += 1

      debug(`retrying pre-token stream stall`, {
        model: label.model,
        attempt,
      }).log('openai.createCompletionStream.preTokenRetry')

      await new Promise((resolve) =>
        setTimeout(resolve, STREAM_PRE_TOKEN_STALL_RETRY_DELAY)
      )
    }
  }
}

/**
 * Creates a streaming completion. Note that prompt and suffix must fit
 * perfectly otherwise the function will fail.
 *
 * @deprecated
 */
export async function* createTextCompletionStream(
  options: CreateTextCompletionStreamOptions
): AsyncGenerator<CreateTextCompletionStreamEvent> {
  const { provider, ...rest } = options

  yield* withPreTokenStreamRetry({ model: rest.model }, () =>
    withModelStreamMetrics(
      { model: rest.model, provider },
      createTextCompletionStreamImpl(rest)
    )
  )
}

async function* createTextCompletionStreamImpl(
  options: CreateTextCompletionStreamOptions
): AsyncGenerator<CreateTextCompletionStreamEvent> {
  const {
    model,

    prompt,
    suffix,

    maxTokens,

    temperature,

    frequencyPenalty,
    presencePenalty,

    reasoningEffort,

    includeUsage,

    stop,

    user,

    url = 'https://api.openai.com/v1/completions',
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    errorPrefix,

    extra = {},

    exclude = [],

    ...fetchOptions
  } = options

  const clientUserId = getClientUserId(user)

  debug(`createCompletionStream using`, {
    model,

    prompt,
    suffix,

    maxTokens,

    temperature,

    frequencyPenalty,
    presencePenalty,

    reasoningEffort,

    includeUsage,

    stop,

    user,
    clientUserId,

    url,

    errorPrefix,

    extra,

    exclude,

    ...fetchOptions,
  }).log('openai.createCompletionStream')

  debug(`createCompletionStream stats`, {
    prompt: prompt?.length || 0,

    suffix: suffix?.length || 0,
  }).log('openai.createCompletionStream.stats')

  if (prompt.length < 1) {
    return throwBadRequest(`Input required`) // @note keeping the message generic in case it ends up in the model
  }

  // @note by default this API max maxTokens set to 16, which is not enough for
  // most cases so we need to assert that the max tokens is provided

  assert(maxTokens, 'maxTokens is required for text completions')

  const body = omit(
    {
      model,

      prompt,
      suffix,

      max_tokens: maxTokens,

      temperature,

      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,

      reasoning_effort: normalizeReasoningEffort(reasoningEffort),

      ...(includeUsage ? { stream_options: { include_usage: true } } : null),

      stop,

      user: clientUserId,

      stream: true,

      // @note not accepted by the API
      // store: false,

      ...extra,
    } satisfies OpenAI.Completions.CompletionCreateParamsStreaming & {
      reasoning_effort?: ReturnType<typeof normalizeReasoningEffort>
    },
    exclude
  )

  const response = await fetchForStreaming(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(body),

    ...fetchOptions,

    // @note carried through the fetch wrappers onto any TimeoutError so the
    // Sentry event records which model stalled (see `withTimeout` in @/lib/fetch)
    meta: { model },
  })

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix, body })
  }

  const decoder = new TextDecoder()

  let events: CreateTextCompletionStreamEvent[] = []

  const parser = createParser({
    onEvent: (event) => {
      debug(`received event`, { event }).log(
        'verbose:openai.createCompletionStream'
      )

      if (event.data !== '[DONE]') {
        debug(`received data`, { data: event.data }).log(
          'openai.createCompletionStream.received'
        )

        let parsed: any

        try {
          parsed = JSON.parse(event.data)
        } catch (e) {
          throw new Error(
            `Failed to parse stream event: ${e instanceof Error ? e.message : String(e)} (data: ${event.data.slice(0, 200)})`,
            { cause: e }
          )
        }

        const {
          error,

          choices: {
            // @note we default finishReason and completion just in case although the API should be fine

            0: {
              finish_reason: _finishReason = null,
              text: completion = null,
              reasoning = null,
            } = {},
          } = [],

          usage = null,
        } = parsed

        let finishReason = _finishReason

        debug(`extracted data`, {
          error,
          finishReason,
          completion,
          reasoning,
          usage,
        }).log('openai.createCompletionStream.extracted')

        if (usage) {
          debug(`extracted usage`, {
            model,
            usage,
          }).log('openai.createCompletionStream.usage')

          reportTokenUsage({
            model: model,
            totalTokens: usage.total_tokens,
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
          })
        }

        finishReason = normalizeFinishReason(finishReason)

        if (error || finishReason || completion || reasoning || usage) {
          events.push({
            error,

            finishReason,

            completion,

            reasoning,

            usage: usage
              ? {
                  promptTokens: usage.prompt_tokens,
                  completionTokens: usage.completion_tokens,
                  totalTokens: usage.total_tokens,
                }
              : null,
          })
        }
      }
    },

    onError: async (error) => {
      await captureError(error)
    },
  })

  if (!response.body) {
    return
  }

  // @ts-ignore
  for await (const chunk of response.body) {
    parser.feed(decoder.decode(chunk))

    if (events.length) {
      yield* events

      events = []
    }
  }

  if (events.length) {
    yield* events

    events = []
  }
}

// --- Chat Completion Functions ---

export type CreateChatCompletionFinishReason =
  | 'error'
  | 'stop'
  | 'length'
  | 'contentFilter'
  | 'functionCall'
  | 'toolCalls'

export interface CreateChatCompletionOptions extends FetchOptions {
  model: string
  messages: ChatMessage[]
  functions?: ChatFunction[]
  functionCall?: 'none' | 'auto' | { name: string }
  tools?: ChatTool[]
  toolChoice?:
    | 'none'
    | 'auto'
    | { type: 'function'; function: { name: string } }
  parallelToolCalls?: boolean
  maxTokens?: number
  temperature?: number
  frequencyPenalty?: number
  presencePenalty?: number
  reasoningEffort?: 'auto' | 'low' | 'medium' | 'high'
  stop?: string[]
  user?: string
  responseFormat?:
    | { type: 'text' }
    | { type: 'json_object' }
    | { type: 'json_schema'; json_schema: Record<string, any> }
  url?: string
  authorization?: string
  headers?: Record<string, string>
  errorPrefix?: string
  extra?: Record<string, any>
  exclude?: string[]
}

/**
 * Creates a chat completion. Note that the messages and functions must fit
 * perfectly otherwise the function will fail.
 */
export async function createChatCompletion(
  options: CreateChatCompletionOptions
): Promise<{
  error?: { message: string; code: string }
  finishReason: CreateChatCompletionFinishReason
  completion: string
  reasoning: string | null
  functionCall: OpenAIFunctionCall | null
  toolCalls: OpenAIToolCall[] | null
  usage: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
  }
}> {
  const {
    model,

    messages,

    functions,
    functionCall: function_call,

    tools,
    toolChoice: tool_choice,

    parallelToolCalls: parallel_tool_calls,

    maxTokens,

    temperature,

    frequencyPenalty,
    presencePenalty,

    reasoningEffort,

    stop,

    user,

    responseFormat,

    url = getOpenAIUrl(),
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    errorPrefix,

    extra = {},

    exclude = [],

    ...fetchOptions
  } = options

  const clientUserId = getClientUserId(user)

  debug(`createChatCompletion using`, {
    model,

    messages,

    functions,
    functionCall: function_call,

    tools,
    toolChoice: tool_choice,

    parallelToolCalls: parallel_tool_calls,

    maxTokens,

    temperature,

    frequencyPenalty,
    presencePenalty,

    reasoningEffort,

    stop,

    user,
    clientUserId,

    responseFormat,

    url,

    errorPrefix,

    extra,

    exclude,

    ...fetchOptions,
  }).log('openai.createChatCompletion')

  debug(`createChatCompletion stats`, {
    messages: messages.length,

    functions: functions?.length || 0,

    tools: tools?.length || 0,
  }).log('openai.createChatCompletion.stats')

  if (messages.length < 1) {
    return throwBadRequest(`Input required`) // @note keeping the message generic in case it ends up in the model
  }

  const body = omit(
    {
      model,

      messages,

      functions: functions?.length
        ? normalizeChatFunctions(functions)
        : undefined,
      function_call,

      tools: tools?.length ? normalizeChatTools(tools) : undefined,
      tool_choice,

      parallel_tool_calls,

      max_tokens: maxTokens,

      temperature,

      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,

      reasoning_effort: normalizeReasoningEffort(reasoningEffort),

      stop,

      user: clientUserId,

      response_format: responseFormat,

      stream: false,

      store: false,

      ...extra,
    } satisfies Omit<
      OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      'response_format'
    > & {
      response_format?: CreateChatCompletionOptions['responseFormat']
    },
    exclude
  )

  const response = await fetchForFetching(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(body),

    ...fetchOptions,

    // @note carried through the fetch wrappers onto any TimeoutError so the
    // Sentry event records which model stalled (see `withTimeout` in @/lib/fetch)
    meta: { model },
  })

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix, body })
  }

  const data = await response.json()

  debug(`received data`, { data }).log('openai.createChatCompletion.received')

  const {
    choices: {
      // @note we default finishReason, completion, functionCall and toolCalls just in case although the API should be fine

      0: {
        finish_reason: _finishReason = 'stop',
        message: {
          content: completion = '',
          reasoning: reasoning = null,
          reasoning_content: reasoningContent = null,
          function_call: _functionCall = null,
          tool_calls: _toolCalls = [],
        } = {},
      } = {},
    } = [],
    usage: {
      total_tokens: totalTokens = 0,
      prompt_tokens: promptTokens = 0,
      completion_tokens: completionTokens = 0,
    } = {},
  } = data

  let finishReason = _finishReason
  let functionCall = _functionCall
  let toolCalls = _toolCalls

  debug(`extracted data`, {
    finishReason,
    completion,
    reasoning,
    reasoningContent,
    functionCall,
    toolCalls,
    totalTokens,
    promptTokens,
    completionTokens,
  }).log('openai.createChatCompletion.extracted')

  debug(`extracted usage`, {
    model,
    totalTokens,
    promptTokens,
    completionTokens,
  }).log('openai.createChatCompletion.usage')

  reportTokenUsage({
    model,
    totalTokens,
    promptTokens,
    completionTokens,
  })

  finishReason = normalizeFinishReason(finishReason)

  // @note strangely when we force with functionCall/toolCalls then the finish reason is STOP so we need to fix this
  {
    if (
      finishReason === 'stop' &&
      ((typeof function_call === 'object' && function_call !== null) ||
        functionCall)
    ) {
      finishReason = 'functionCall'
    }

    if (
      finishReason === 'stop' &&
      ((typeof tool_choice === 'object' && tool_choice !== null) ||
        toolCalls?.length)
    ) {
      finishReason = 'toolCalls'
    }
  }

  if (finishReason === 'functionCall') {
    const { arguments: args, error: err } = parseToolCallArguments(
      functionCall.arguments,
      functionCall.name
    )

    functionCall.arguments = args
    functionCall.error = err
  } else {
    functionCall = null
  }

  if (finishReason === 'toolCalls') {
    toolCalls = toolCalls.map((toolCall) => {
      const { arguments: args, error } = parseToolCallArguments(
        toolCall.function.arguments,
        toolCall.function.name
      )

      toolCall.function.arguments = args
      toolCall.function.error = error

      return toolCall
    })
  } else {
    toolCalls = null
  }

  return {
    finishReason,

    completion,

    reasoning: reasoning || reasoningContent,

    functionCall,

    toolCalls,

    usage: {
      totalTokens,
      promptTokens,
      completionTokens,
    },
  }
}

export type CreateChatCompletionStreamFinishReason =
  | 'error'
  | 'stop'
  | 'length'
  | 'contentFilter'
  | 'functionCall'
  | 'toolCalls'
  | null

export type CreateChatCompletionStreamEvent = {
  error?: { message: string; code: string }
  finishReason: CreateChatCompletionStreamFinishReason
  completion: string | null
  reasoning: string | null
  functionCall: OpenAIFunctionCall | null
  toolCalls: OpenAIToolCall[] | null
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  } | null
}

export type CreateChatCompletionStreamSink = {
  push(event: CreateChatCompletionStreamEvent): Promise<unknown> | unknown
}

export interface CreateChatCompletionStreamOptions extends FetchOptions {
  model: string
  /** @note metric label only (TTFT/throughput); not sent to the provider */
  provider?: string
  messages: ChatMessage[]
  functions?: ChatFunction[]
  functionCall?: 'none' | 'auto' | { name: string }
  tools?: ChatTool[]
  toolChoice?:
    | 'none'
    | 'auto'
    | { type: 'function'; function: { name: string } }
  parallelToolCalls?: boolean
  maxTokens?: number
  temperature?: number
  frequencyPenalty?: number
  presencePenalty?: number
  reasoningEffort?: 'auto' | 'low' | 'medium' | 'high'
  includeUsage?: boolean
  stop?: string[]
  user?: string
  responseFormat?:
    | { type: 'text' }
    | { type: 'json_object' }
    | { type: 'json_schema'; json_schema: Record<string, any> }
  url?: string
  authorization?: string
  headers?: Record<string, string>
  errorPrefix?: string
  extra?: Record<string, any>
  exclude?: string[]
}

/**
 * Creates a streaming chat completion. Note that the messages and functions
 * must fit perfectly otherwise the function will fail.
 */
export async function* createChatCompletionStream(
  options: CreateChatCompletionStreamOptions
): AsyncGenerator<CreateChatCompletionStreamEvent> {
  const { provider, ...rest } = options

  yield* withPreTokenStreamRetry({ model: rest.model }, () =>
    withModelStreamMetrics(
      { model: rest.model, provider },
      createChatCompletionStreamImpl(rest)
    )
  )
}

async function* createChatCompletionStreamImpl(
  options: CreateChatCompletionStreamOptions
): AsyncGenerator<CreateChatCompletionStreamEvent> {
  const {
    model,

    messages,

    functions,
    functionCall: function_call,

    tools,
    toolChoice: tool_choice,

    parallelToolCalls: parallel_tool_calls,

    maxTokens,

    temperature,

    frequencyPenalty,
    presencePenalty,

    reasoningEffort,

    includeUsage,

    stop,

    user,

    responseFormat,

    url = getOpenAIUrl(),
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    errorPrefix,

    extra = {},

    exclude = [],

    ...fetchOptions
  } = options

  const clientUserId = getClientUserId(user)

  debug(`createChatCompletionStream using`, {
    model,

    messages,

    functions,
    functionCall: function_call,

    tools,
    toolChoice: tool_choice,

    parallelToolCalls: parallel_tool_calls,

    maxTokens,

    temperature,

    frequencyPenalty,
    presencePenalty,

    reasoningEffort,

    includeUsage,

    stop,

    user,
    clientUserId,

    responseFormat,

    url,

    errorPrefix,

    extra,

    exclude,

    ...fetchOptions,
  }).log('openai.createChatCompletionStream')

  debug(`createChatCompletionStream stats`, {
    messages: messages.length,

    functions: functions?.length || 0,

    tools: tools?.length || 0,
  }).log('openai.createChatCompletionStream.stats')

  if (messages.length < 1) {
    return throwBadRequest(`Input required`) // @note keeping the message generic in case it ends up in the model
  }

  const body = omit(
    {
      model,

      messages,

      functions: functions?.length
        ? normalizeChatFunctions(functions)
        : undefined,
      function_call,

      tools: tools?.length ? normalizeChatTools(tools) : undefined,
      tool_choice,

      parallel_tool_calls,

      max_tokens: maxTokens,

      temperature,

      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,

      reasoning_effort: normalizeReasoningEffort(reasoningEffort),

      ...(includeUsage ? { stream_options: { include_usage: true } } : null),

      stop,

      user: clientUserId,

      response_format: responseFormat,

      stream: true,

      store: false,

      ...extra,
    } satisfies Omit<
      OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      'response_format'
    > & {
      response_format?: CreateChatCompletionStreamOptions['responseFormat']
    },
    exclude
  )

  const response = await fetchForStreaming(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(body),

    ...fetchOptions,

    // @note carried through the fetch wrappers onto any TimeoutError so the
    // Sentry event records which model stalled (see `withTimeout` in @/lib/fetch)
    meta: { model },
  })

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix, body })
  }

  const decoder = new TextDecoder()

  let events: CreateChatCompletionStreamEvent[] = []

  let receivedFunctionCall = {
    name: '',
    arguments: '',
  }

  let receivedToolCalls: (OpenAIToolCall & { index?: number })[] = []

  // @note set the moment an event carrying a terminal finish reason is queued
  // - i.e. the turn is over from the consumer's point of view
  let emittedFinishReason = false

  const parser = createParser({
    onEvent: (event) => {
      debug(`received event`, { event }).log(
        'verbose:openai.createChatCompletionStream'
      )

      if (event.data !== '[DONE]') {
        debug(`received data`, { data: event.data }).log(
          'openai.createChatCompletionStream.received'
        )

        let parsed: any

        try {
          parsed = JSON.parse(event.data)
        } catch (e) {
          throw new Error(
            `Failed to parse stream event: ${e instanceof Error ? e.message : String(e)} (data: ${event.data.slice(0, 200)})`,
            { cause: e }
          )
        }

        const {
          error,

          choices: {
            // @note we default finishReason, completion, functionCall and
            // toolCalls just in case although the API should be fine

            0: {
              finish_reason: _finishReason = null,
              delta: {
                content: completion = null,
                reasoning: _reasoning = null,
                reasoning_content: reasoningContent = null,
                function_call: _functionCall = null,
                tool_calls: _toolCalls = null,
              } = {},
            } = {},
          } = [],

          usage = null,
        } = parsed

        let finishReason = _finishReason
        let reasoning = _reasoning
        let functionCall = _functionCall
        let toolCalls = _toolCalls

        debug(`extracted data`, {
          error,
          finishReason,
          completion,
          reasoning,
          reasoningContent,
          functionCall,
          toolCalls,
          usage,
        }).log('openai.createChatCompletionStream.extracted')

        reasoning = reasoning || reasoningContent

        if (usage) {
          debug(`extracted usage`, {
            model,
            usage,
          }).log('openai.createChatCompletionStream.usage')

          reportTokenUsage({
            model: model,
            totalTokens: usage.total_tokens,
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
          })
        }

        finishReason = normalizeFinishReason(finishReason)

        // @note we need to gradually build the function call name and arguments
        {
          if (functionCall) {
            if (functionCall.name) {
              if (receivedFunctionCall.name) {
                receivedFunctionCall.name += functionCall.name
              } else {
                receivedFunctionCall.name = functionCall.name
              }
            }

            if (functionCall.arguments) {
              if (receivedFunctionCall.arguments) {
                receivedFunctionCall.arguments += functionCall.arguments
              } else {
                receivedFunctionCall.arguments = functionCall.arguments
              }
            }
          }
        }

        // @note we need to gradually build the tool calls
        {
          if (Array.isArray(toolCalls)) {
            toolCalls.forEach((toolCall) => {
              const toolCallInstance = receivedToolCalls.find(
                ({ index }) => index === toolCall.index
              )

              if (toolCallInstance) {
                if (toolCall.function?.name) {
                  if (toolCallInstance.function.name) {
                    toolCallInstance.function.name += toolCall.function.name
                  } else {
                    toolCallInstance.function.name = toolCall.function.name
                  }
                }

                if (toolCall.function?.arguments) {
                  if (toolCallInstance.function.arguments) {
                    toolCallInstance.function.arguments +=
                      toolCall.function.arguments
                  } else {
                    toolCallInstance.function.arguments =
                      toolCall.function.arguments
                  }
                }
              } else {
                const nextToolCall: OpenAIToolCall & { index?: number } = {
                  ...toolCall,
                }

                receivedToolCalls.push(nextToolCall)
              }
            })
          }
        }

        // @note sometimes the reason is stop but we have functionCall or toolCalls
        {
          if (finishReason === 'stop' && receivedFunctionCall?.name) {
            finishReason = 'functionCall'
          }

          if (finishReason === 'stop' && receivedToolCalls?.length) {
            finishReason = 'toolCalls'
          }
        }

        switch (finishReason) {
          case 'functionCall': {
            // @note guard against duplicate emission when the provider sends
            // multiple chunks with the same finish_reason (e.g. OpenRouter
            // sends a second chunk carrying only usage data)

            if (!receivedFunctionCall.name) {
              functionCall = null

              break
            }

            {
              const { arguments: args, error: err } = parseToolCallArguments(
                receivedFunctionCall.arguments,
                receivedFunctionCall.name
              )

              functionCall = {
                name: receivedFunctionCall.name,
                arguments: args,
                error: err,
              }
            }

            receivedFunctionCall = { name: '', arguments: '' }

            break
          }

          case 'toolCalls': {
            // @note guard against duplicate emission when the provider sends
            // multiple chunks with the same finish_reason (e.g. OpenRouter
            // sends a second tool_calls chunk carrying only usage data)

            if (!receivedToolCalls.length) {
              toolCalls = null

              break
            }

            toolCalls = finalizeStreamedToolCalls(receivedToolCalls)

            receivedToolCalls = []

            break
          }

          default: {
            functionCall = null
            toolCalls = null

            break
          }
        }

        // @note the turn ends here - finalizeTurnAtEndOfStream must not speak
        // after the provider already has (the `default` branch above
        // deliberately leaves the buffers populated on a `length` or
        // `contentFilter` stop)
        if (finishReason) {
          emittedFinishReason = true
        }

        if (
          error ||
          finishReason ||
          completion ||
          reasoning ||
          usage ||
          functionCall ||
          toolCalls
        ) {
          events.push({
            error,

            finishReason,

            completion,

            reasoning,

            usage: usage
              ? {
                  promptTokens: usage.prompt_tokens,
                  completionTokens: usage.completion_tokens,
                  totalTokens: usage.total_tokens,
                }
              : null,

            functionCall,

            toolCalls,
          })
        }
      }
    },

    onError: async (error) => {
      await captureError(error)
    },
  })

  // @note a turn has exactly two possible terminators: the provider says so
  // in-band (a terminal `finish_reason`, handled in the parser above), or the
  // stream simply ends. Some OpenAI-compatible endpoints (Cloudflare's among
  // them) only ever provide the second - they stream a complete tool call with
  // `finish_reason` null throughout and then close. This is the single owner
  // of that second signal: if the provider already ended the turn it does
  // nothing, otherwise it promotes whatever call accumulated into the turn's
  // one terminal event. It must sit outside the parser because "no more
  // chunks" is only observable after the read loop - and it must not run
  // per-chunk, because a call streamed in fragments would emit half-built.
  const finalizeTurnAtEndOfStream = () => {
    if (emittedFinishReason) {
      return
    }

    // @note a silent end is ambiguous: it is how these providers normally
    // terminate, but it is also what a truncated stream looks like - a proxy
    // half-close arrives as a clean end, not an error. The two are told apart
    // by the accumulated call itself: a complete call has a name and arguments
    // that parse (a zero-argument call parses as the empty object), while a
    // stream cut mid-call leaves malformed JSON. Only complete calls are
    // promoted; a truncated one is dropped so the conversation layer sees an
    // empty turn (its default finish reason is `stop`) and retries the
    // completion - instead of being handed a phantom "malformed arguments"
    // mistake the model never made.

    if (receivedToolCalls.length) {
      const finalizedToolCalls = finalizeStreamedToolCalls(receivedToolCalls)

      receivedToolCalls = []

      if (
        finalizedToolCalls.every(
          (toolCall) => toolCall.function?.name && !toolCall.function?.error
        )
      ) {
        events.push({
          finishReason: 'toolCalls',

          completion: null,

          reasoning: null,

          usage: null,

          functionCall: null,

          toolCalls: finalizedToolCalls,
        })

        emittedFinishReason = true
      } else {
        debug(`discarding truncated tool calls at end of stream`, {
          toolCalls: finalizedToolCalls,
        }).log('openai.createChatCompletionStream.truncated')
      }
    } else if (receivedFunctionCall.name) {
      // @note the legacy `function_call` path accumulates in exactly the same
      // way and is dropped by the same silence, so it gets the same treatment
      const { name } = receivedFunctionCall

      const { arguments: args, error: err } = parseToolCallArguments(
        receivedFunctionCall.arguments,
        name
      )

      receivedFunctionCall = { name: '', arguments: '' }

      if (!err) {
        events.push({
          finishReason: 'functionCall',

          completion: null,

          reasoning: null,

          usage: null,

          functionCall: {
            name,
            arguments: args,
          },

          toolCalls: null,
        })

        emittedFinishReason = true
      } else {
        debug(`discarding truncated function call at end of stream`, {
          error: err,
        }).log('openai.createChatCompletionStream.truncated')
      }
    }
  }

  if (!response.body) {
    return
  }

  // @ts-ignore
  for await (const chunk of response.body) {
    parser.feed(decoder.decode(chunk))

    if (events.length) {
      yield* events

      events = []
    }
  }

  finalizeTurnAtEndOfStream()

  if (events.length) {
    yield* events

    events = []
  }
}

// --- Response Completion Functions ---

export type CreateResponseCompletionFinishReason =
  | 'error'
  | 'stop'
  | 'length'
  | 'contentFilter'
  | 'toolCalls'

export interface CreateResponseCompletionOptions extends FetchOptions {
  model: string
  input: string | ResponseInput
  instructions?: string
  tools?: ResponseTool[]
  toolChoice?: 'none' | 'auto' | 'required' | { type: 'function'; name: string }
  parallelToolCalls?: boolean
  maxOutputTokens?: number
  temperature?: number
  topP?: number
  truncation?: 'auto' | 'disabled'
  reasoning?: {
    effort?: 'low' | 'medium' | 'high'
    summary?: 'auto' | 'concise' | 'detailed'
  }
  user?: string
  text?: {
    format?:
      | { type: 'text' }
      | { type: 'json_object' }
      | { type: 'json_schema'; json_schema: Record<string, any> }
  }
  url?: string
  authorization?: string
  headers?: Record<string, string>
  errorPrefix?: string
  extra?: Record<string, any>
}

/**
 * Creates a model response using the OpenAI Responses API. This is a
 * lightweight wrapper that translates between JavaScript-style camelCase
 * options and the API's snake_case parameters, and normalizes the response into
 * a flat, easy-to-consume shape.
 */
export async function createResponseCompletion(
  options: CreateResponseCompletionOptions
): Promise<{
  id: string
  error?: { message: string; code: string }
  finishReason: CreateResponseCompletionFinishReason
  completion: string
  reasoning: string | null
  toolCalls:
    | { id: string; type: 'function'; name: string; arguments: any }[]
    | null
  usage: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
    reasoningTokens: number
  }
}> {
  const {
    model,

    input,

    instructions,

    tools,
    toolChoice,

    parallelToolCalls,

    maxOutputTokens,

    temperature,

    topP,

    truncation,

    reasoning: reasoningConfig,

    user,

    text,

    url = 'https://api.openai.com/v1/responses',
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    errorPrefix,

    extra = {},

    ...fetchOptions
  } = options

  const clientUserId = getClientUserId(user)

  debug(`createResponseCompletion using`, {
    model,

    input,

    instructions,

    tools,
    toolChoice,

    parallelToolCalls,

    maxOutputTokens,

    temperature,

    topP,

    truncation,

    reasoning: reasoningConfig,

    user,
    clientUserId,

    text,

    url,

    errorPrefix,

    extra,

    ...fetchOptions,
  }).log('openai.createResponseCompletion')

  const body = {
    model,

    input,

    ...(instructions ? { instructions } : null),

    ...(tools?.length ? { tools: normalizeResponseTools(tools) } : null),

    ...(toolChoice ? { tool_choice: toolChoice } : null),

    ...(parallelToolCalls !== undefined
      ? { parallel_tool_calls: parallelToolCalls }
      : null),

    ...(maxOutputTokens !== undefined
      ? { max_output_tokens: maxOutputTokens }
      : null),

    ...(temperature !== undefined ? { temperature } : null),

    ...(topP !== undefined ? { top_p: topP } : null),

    ...(truncation ? { truncation } : null),

    ...(reasoningConfig ? { reasoning: reasoningConfig } : null),

    ...(text ? { text } : null),

    user: clientUserId,

    stream: false,

    store: false,

    ...extra,
  } satisfies Omit<
    OpenAI.Responses.ResponseCreateParamsNonStreaming,
    'text'
  > & {
    text?: CreateResponseCompletionOptions['text']
  }

  const response = await fetchForFetching(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(body),

    ...fetchOptions,

    // @note carried through the fetch wrappers onto any TimeoutError so the
    // Sentry event records which model stalled (see `withTimeout` in @/lib/fetch)
    meta: { model },
  })

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix, body })
  }

  const data = (await response.json()) as OpenAI.Responses.Response

  debug(`received data`, { data }).log(
    'openai.createResponseCompletion.received'
  )

  const { id, status, output, usage, error: responseError } = data

  // @note extract completion text and tool calls from the output items

  let completionText = ''
  let reasoningText: string | null = null
  let toolCalls: OpenAIResponseToolCall[] | null = null

  for (const item of output) {
    if (item.type === 'message' && 'content' in item) {
      for (const part of item.content) {
        if (part.type === 'output_text') {
          completionText += part.text
        }
      }
    }

    if (item.type === 'reasoning' && 'summary' in item) {
      const isSummaryText = (
        summary: unknown
      ): summary is OpenAI.Responses.ResponseReasoningItem.Summary => {
        if (typeof summary !== 'object' || summary === null) {
          return false
        }

        const { type, text } = summary as Record<string, unknown>

        return type === 'summary_text' && typeof text === 'string'
      }

      if (Array.isArray(item.summary)) {
        reasoningText = item.summary
          .filter(isSummaryText)
          .map((s) => s.text)
          .join('')
      }
    }

    if (item.type === 'function_call') {
      if (!toolCalls) {
        toolCalls = []
      }

      const { arguments: parsedArguments, error: err } = parseToolCallArguments(
        item.arguments,
        item.name
      )

      toolCalls.push({
        id: item.id || '',
        type: 'function',
        name: item.name,
        arguments: parsedArguments,
        error: err,
      })
    }
  }

  // @note map OpenAI Responses API status to our finish reason

  /** @type {CreateResponseCompletionFinishReason} */
  let finishReason

  if (responseError) {
    finishReason = 'error'
  } else if (toolCalls) {
    finishReason = 'toolCalls'
  } else if (status === 'incomplete') {
    finishReason = 'length'
  } else {
    finishReason = 'stop'
  }

  const totalTokens = (usage?.input_tokens || 0) + (usage?.output_tokens || 0)
  const promptTokens = usage?.input_tokens || 0
  const completionTokens = usage?.output_tokens || 0
  const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens || 0

  debug(`extracted data`, {
    id,
    finishReason,
    completion: completionText,
    reasoning: reasoningText,
    toolCalls,
    totalTokens,
    promptTokens,
    completionTokens,
    reasoningTokens,
  }).log('openai.createResponseCompletion.extracted')

  reportTokenUsage({
    model,
    totalTokens,
    promptTokens,
    completionTokens,
  })

  return {
    id,

    ...(responseError
      ? { error: { message: responseError.message, code: responseError.code } }
      : null),

    finishReason,

    completion: completionText,

    reasoning: reasoningText,

    toolCalls,

    usage: {
      totalTokens,
      promptTokens,
      completionTokens,
      reasoningTokens,
    },
  }
}

export type CreateResponseCompletionStreamFinishReason =
  | 'error'
  | 'stop'
  | 'length'
  | 'contentFilter'
  | 'toolCalls'
  | null

export interface CreateResponseCompletionStreamOptions extends FetchOptions {
  model: string
  /** @note metric label only (TTFT/throughput); not sent to the provider */
  provider?: string
  input: string | ResponseInput
  instructions?: string
  tools?: ResponseTool[]
  toolChoice?: 'none' | 'auto' | 'required' | { type: 'function'; name: string }
  parallelToolCalls?: boolean
  maxOutputTokens?: number
  temperature?: number
  topP?: number
  truncation?: 'auto' | 'disabled'
  reasoning?: {
    effort?: 'low' | 'medium' | 'high'
    summary?: 'auto' | 'concise' | 'detailed'
  }
  user?: string
  text?: {
    format?:
      | { type: 'text' }
      | { type: 'json_object' }
      | { type: 'json_schema'; json_schema: Record<string, any> }
  }
  url?: string
  authorization?: string
  headers?: Record<string, string>
  errorPrefix?: string
  extra?: Record<string, any>
}

type CreateResponseCompletionStreamEvent = {
  error?: { message: string; code: string }
  finishReason: CreateResponseCompletionStreamFinishReason
  completion: string | null
  reasoning: string | null
  toolCalls: OpenAIResponseToolCall[] | null
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    reasoningTokens: number
  } | null
}

/**
 * Creates a streaming model response using the OpenAI Responses API. Emits
 * incremental chunks in the same shape as createChatCompletionStream so the
 * caller can consume both APIs with the same loop.
 */
export async function* createResponseCompletionStream(
  options: CreateResponseCompletionStreamOptions
): AsyncGenerator<CreateResponseCompletionStreamEvent> {
  const { provider, ...rest } = options

  yield* withPreTokenStreamRetry({ model: rest.model }, () =>
    withModelStreamMetrics(
      { model: rest.model, provider },
      createResponseCompletionStreamImpl(rest)
    )
  )
}

async function* createResponseCompletionStreamImpl(
  options: CreateResponseCompletionStreamOptions
): AsyncGenerator<CreateResponseCompletionStreamEvent> {
  const {
    model,

    input,

    instructions,

    tools,
    toolChoice,

    parallelToolCalls,

    maxOutputTokens,

    temperature,

    topP,

    truncation,

    reasoning: reasoningConfig,

    user,

    text,

    url = 'https://api.openai.com/v1/responses',
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    errorPrefix,

    extra = {},

    ...fetchOptions
  } = options

  const clientUserId = getClientUserId(user)

  debug(`createResponseCompletionStream using`, {
    model,

    input,

    instructions,

    tools,
    toolChoice,

    parallelToolCalls,

    maxOutputTokens,

    temperature,

    topP,

    truncation,

    reasoning: reasoningConfig,

    user,
    clientUserId,

    text,

    url,

    errorPrefix,

    extra,

    ...fetchOptions,
  }).log('openai.createResponseCompletionStream')

  const body = {
    model,

    input,

    ...(instructions ? { instructions } : null),

    ...(tools?.length ? { tools: normalizeResponseTools(tools) } : null),

    ...(toolChoice ? { tool_choice: toolChoice } : null),

    ...(parallelToolCalls !== undefined
      ? { parallel_tool_calls: parallelToolCalls }
      : null),

    ...(maxOutputTokens !== undefined
      ? { max_output_tokens: maxOutputTokens }
      : null),

    ...(temperature !== undefined ? { temperature } : null),

    ...(topP !== undefined ? { top_p: topP } : null),

    ...(truncation ? { truncation } : null),

    ...(reasoningConfig ? { reasoning: reasoningConfig } : null),

    ...(text ? { text } : null),

    user: clientUserId,

    stream: true,

    store: false,

    ...extra,
  } satisfies Omit<OpenAI.Responses.ResponseCreateParamsStreaming, 'text'> & {
    text?: CreateResponseCompletionStreamOptions['text']
  }

  const response = await fetchForStreaming(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(body),

    ...fetchOptions,

    // @note carried through the fetch wrappers onto any TimeoutError so the
    // Sentry event records which model stalled (see `withTimeout` in @/lib/fetch)
    meta: { model },
  })

  if (!response.ok) {
    return await throwOpenAIError(response, { errorPrefix, body })
  }

  const decoder = new TextDecoder()

  let events: CreateResponseCompletionStreamEvent[] = []

  // @note track in-progress function calls by output_index so we can
  // accumulate arguments across deltas and emit a completed tool call once
  // done

  /** @type {Map<number, {id: string, name: string, arguments: string}>} */
  const pendingToolCalls = new Map()

  const parser = createParser({
    onEvent: (event) => {
      debug(`received event`, { event }).log(
        'verbose:openai.createResponseCompletionStream'
      )

      if (event.data === '[DONE]') {
        return
      }

      let data: any

      try {
        data = JSON.parse(event.data)
      } catch (e) {
        throw new Error(
          `Failed to parse stream event: ${e instanceof Error ? e.message : String(e)} (data: ${event.data.slice(0, 200)})`,
          { cause: e }
        )
      }

      const type = data.type

      debug(`received data`, { type, data }).log(
        'openai.createResponseCompletionStream.received'
      )

      switch (type) {
        case 'response.output_text.delta': {
          events.push({
            finishReason: null,
            completion: data.delta,
            reasoning: null,
            toolCalls: null,
            usage: null,
          })

          break
        }

        case 'response.reasoning_summary_text.delta': {
          events.push({
            finishReason: null,
            completion: null,
            reasoning: data.delta,
            toolCalls: null,
            usage: null,
          })

          break
        }

        case 'response.output_item.added': {
          const item = data.item

          if (item.type === 'function_call') {
            pendingToolCalls.set(data.output_index, {
              id: item.id || '',
              name: item.name || '',
              arguments: '',
            })
          }

          break
        }

        case 'response.function_call_arguments.delta': {
          const pending = pendingToolCalls.get(data.output_index)

          if (pending) {
            pending.arguments += data.delta
          }

          break
        }

        case 'response.function_call_arguments.done': {
          const pending = pendingToolCalls.get(data.output_index)

          if (pending) {
            // @note update the name in case it was not available on the
            // initial output_item.added event
            if (data.name) {
              pending.name = data.name
            }

            pending.arguments = data.arguments || pending.arguments
          }

          break
        }

        case 'error': {
          events.push({
            error: {
              message: data.message || 'Unknown error',
              code: data.code || 'error',
            },
            finishReason: 'error',
            completion: null,
            reasoning: null,
            toolCalls: null,
            usage: null,
          })

          break
        }

        case 'response.completed':
        case 'response.failed':
        case 'response.incomplete': {
          const resp = data.response

          /** @type {CreateResponseCompletionStreamFinishReason} */
          let finishReason

          if (type === 'response.failed') {
            finishReason = 'error'
          } else if (type === 'response.incomplete') {
            finishReason = 'length'
          } else if (pendingToolCalls.size > 0) {
            finishReason = 'toolCalls'
          } else {
            finishReason = 'stop'
          }

          // @note collect completed tool calls

          let toolCalls: OpenAIResponseToolCall[] | null = null

          if (pendingToolCalls.size > 0) {
            toolCalls = []

            for (const [, tc] of pendingToolCalls) {
              const { arguments: parsedArguments, error: err } =
                parseToolCallArguments(tc.arguments, tc.name)

              toolCalls.push({
                id: tc.id,
                type: 'function',
                name: tc.name,
                arguments: parsedArguments,
                error: err,
              })
            }

            pendingToolCalls.clear()
          }

          // @note extract usage from the final response

          const usage = resp?.usage
            ? {
                promptTokens: resp.usage.input_tokens || 0,
                completionTokens: resp.usage.output_tokens || 0,
                totalTokens:
                  (resp.usage.input_tokens || 0) +
                  (resp.usage.output_tokens || 0),
                reasoningTokens:
                  resp.usage.output_tokens_details?.reasoning_tokens || 0,
              }
            : null

          if (usage) {
            debug(`extracted usage`, {
              model,
              usage,
            }).log('openai.createResponseCompletionStream.usage')

            reportTokenUsage({
              model,
              totalTokens: usage.totalTokens,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
            })
          }

          events.push({
            ...(resp?.error
              ? {
                  error: {
                    message: resp.error.message,
                    code: resp.error.code,
                  },
                }
              : null),

            finishReason,
            completion: null,
            reasoning: null,
            toolCalls,
            usage,
          })

          break
        }

        // @note all other event types (response.created, response.in_progress,
        // response.content_part.added, etc.) are intentionally ignored
      }
    },

    onError: async (error) => {
      await captureError(error)
    },
  })

  if (!response.body) {
    return
  }

  // @ts-ignore
  for await (const chunk of response.body) {
    parser.feed(decoder.decode(chunk))

    if (events.length) {
      yield* events

      events = []
    }
  }

  if (events.length) {
    yield* events

    events = []
  }
}

// --- Realtime Completion Functions ---

export type RealtimeSocketOptions = {
  model: string
  temperature?: number
  reasoningEffort?: 'auto' | 'low' | 'medium' | 'high'
  voice?: string
  url?: string
  authorization?: string
  headers?: Record<string, string>
  errorPrefix?: string
}

export class RealtimeSocket {
  #socket: WebSocket

  #errorPrefix: string

  #temperature?: number

  #reasoningEffort?: 'auto' | 'low' | 'medium' | 'high'

  #voice?: string

  #sessionInitialized = false

  readonly endpoint: string

  constructor({
    model,

    temperature,
    reasoningEffort,
    voice,

    url = 'wss://api.openai.com/v1/realtime',
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    errorPrefix,
  }: RealtimeSocketOptions) {
    this.endpoint = `${url}?model=${encodeURIComponent(model)}`

    this.#socket = new WebSocket(this.endpoint, {
      headers: {
        ...headers,

        Authorization: authorization,
      },
    })

    this.#temperature = temperature
    this.#reasoningEffort = reasoningEffort
    this.#voice = voice

    this.#errorPrefix = errorPrefix || 'OI_'
  }

  #initializeSession() {
    if (this.#sessionInitialized) {
      return
    }

    // @note the realtime API only accepts concrete effort levels and rejects
    // our 'auto' sentinel (which means "let the provider decide"). Normalize it
    // the same way the chat/text paths do so an 'auto' config doesn't trigger a
    // `session.reasoning.effort` invalid_value error that tears down the turn.
    const reasoningEffort = normalizeReasoningEffort(this.#reasoningEffort)

    this.send({
      type: 'session.update',
      session: {
        type: 'realtime',
        ...(typeof this.#temperature === 'number'
          ? { temperature: this.#temperature }
          : null),
        ...(reasoningEffort
          ? {
              reasoning: {
                effort: reasoningEffort,
              },
            }
          : null),
        audio: {
          input: {
            transcription: {
              model: defaultSpeechToTextModel,
            },
          },
          ...(this.#voice
            ? {
                output: {
                  voice: this.#voice,
                },
              }
            : null),
        },
      },
    } satisfies OpenAI.Realtime.SessionUpdateEvent)

    this.#sessionInitialized = true
  }

  async open(abortSignal?: AbortSignal) {
    if (this.#socket.readyState === WebSocket.OPEN) {
      this.#initializeSession()

      return
    }

    if (this.#socket.readyState !== WebSocket.CONNECTING) {
      throw new Error(`${this.#errorPrefix}Realtime socket is not open`)
    }

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        abortSignal?.removeEventListener('abort', handleAbort)

        this.#socket.off('open', handleOpen)
        this.#socket.off('error', handleError)
        this.#socket.off('close', handleClose)
      }

      const handleAbort = () => {
        cleanup()
        reject(new Error(`${this.#errorPrefix}Realtime socket aborted`))
      }

      const handleOpen = () => {
        cleanup()
        resolve()
      }

      const handleError = (error: Error) => {
        cleanup()
        reject(error)
      }

      const handleClose = () => {
        cleanup()
        reject(new Error(`${this.#errorPrefix}Realtime socket closed`))
      }

      abortSignal?.addEventListener('abort', handleAbort, { once: true })

      this.#socket.once('open', handleOpen)
      this.#socket.once('error', handleError)
      this.#socket.once('close', handleClose)
    })

    this.#initializeSession()
  }

  send(event: OpenAI.Realtime.RealtimeClientEvent) {
    this.#socket.send(JSON.stringify(event))
  }

  async *receive(): AsyncGenerator<OpenAI.Realtime.RealtimeServerEvent> {
    const queue: OpenAI.Realtime.RealtimeServerEvent[] = []

    let wake: (() => void) | null = null

    let finished =
      this.#socket.readyState === WebSocket.CLOSING ||
      this.#socket.readyState === WebSocket.CLOSED

    let terminalError: Error | null = null

    const notify = () => {
      wake?.()

      wake = null
    }

    const handleMessage = (raw: WebSocket.RawData) => {
      let data: OpenAI.Realtime.RealtimeServerEvent

      try {
        data = JSON.parse(raw.toString()) as OpenAI.Realtime.RealtimeServerEvent
      } catch (error) {
        void captureError(error)

        return
      }

      queue.push(data)

      notify()
    }

    const handleError = (error: Error) => {
      terminalError = error
      finished = true

      notify()
    }

    const handleClose = () => {
      finished = true

      notify()
    }

    this.#socket.on('message', handleMessage)
    this.#socket.on('error', handleError)
    this.#socket.on('close', handleClose)

    try {
      while (!finished || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift() as OpenAI.Realtime.RealtimeServerEvent

          continue
        }

        await new Promise<void>((resolve) => {
          wake = resolve
        })
      }

      if (terminalError) {
        throw terminalError
      }
    } finally {
      this.#socket.off('message', handleMessage)
      this.#socket.off('error', handleError)
      this.#socket.off('close', handleClose)
    }
  }
}

export function createRealtimeSocket(
  options: RealtimeSocketOptions
): RealtimeSocket {
  return new RealtimeSocket(options)
}

// --- Images ---

/**
 *
 */
export async function createImage(
  options: FetchOptions & {
    prompt: string
    model: string
    n?: number
    responseFormat?: 'url' | 'b64_json'
    outputFormat?: 'png' | 'jpeg' | 'webp'
    size?:
      | 'auto'
      | '1024x1024'
      | '1536x1024'
      | '1024x1536'
      | '256x256'
      | '512x512'
    user?: string
    url?: string
    authorization?: string
    headers?: Record<string, string>
  }
): Promise<{
  urls: string[]
  usage: {
    model: string
    inputTokens: number
    outputTokens: number
  }
}> {
  const {
    prompt,

    model: _model,

    n = 1,

    responseFormat: _responseFormat = 'url',

    outputFormat: _outputFormat = 'png',

    size: _size,

    user,

    url = 'https://api.openai.com/v1/images/generations',
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    ...fetchOptions
  } = options

  const clientUserId = getClientUserId(user)

  debug(`createImage using`, {
    prompt,

    model: _model,

    n,

    responseFormat: _responseFormat,

    size: _size,

    user,
    clientUserId,

    ...fetchOptions,
  }).log('openai.createImage')

  // @note providerModel resolution is now handled by image.ts using the model
  // config - the model name passed here is already the provider-side identifier

  const modelNameToSizeMap = {
    'gpt-image-2': {
      '1024x1024': '1024x1024',
      '1024x1536': '1024x1536',
      '1536x1024': '1536x1024',
    },

    'gpt-image-1': {
      '1024x1024': '1024x1024',
      '1024x1536': '1024x1536',
      '1536x1024': '1536x1024',
    },

    'gpt-image-1-mini': {
      '1024x1024': '1024x1024',
      '1024x1536': '1024x1536',
      '1536x1024': '1536x1024',
    },

    'gpt-image-1.5': {
      '1024x1024': '1024x1024',
      '1024x1536': '1024x1536',
      '1536x1024': '1536x1024',
    },

    'dall-e-3': {
      '1024x1024': '1024x1024',
      '1024x1792': '1024x1792',
      '1792x1024': '1792x1024',
    },

    'dall-e-2': {
      '256x256': '256x256',
      '512x512': '512x512',
      '1024x1024': '1024x1024',
    },
  }

  const modelNameToResponseFormatMap = {
    'gpt-image-2': undefined,
    'gpt-image-1': undefined,
    'gpt-image-1.5': undefined,
    'gpt-image-1-mini': undefined,
  }

  const modelNameToOutputFormatMap = {
    'dall-e-3': undefined,
    'dall-e-2': undefined,
  }

  const model = _model || 'gpt-image-1'
  const size = (modelNameToSizeMap[model] || {})[_size || ''] || '1024x1024'

  // @note responseFormat is not supported by all models

  const responseFormat =
    model in modelNameToResponseFormatMap
      ? modelNameToResponseFormatMap[model]
      : _responseFormat

  // @note outputFormat is not supported by all models

  const outputFormat =
    model in modelNameToOutputFormatMap
      ? modelNameToOutputFormatMap[model]
      : _outputFormat

  debug(`using`, {
    model,
    size,
    responseFormat,
  }).log('openai.createImage')

  const body = {
    prompt,

    model,

    response_format: responseFormat,

    output_format: outputFormat,

    size,

    user: clientUserId,
  } satisfies OpenAI.Images.ImageGenerateParams

  const response = await fetchForImage(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(body),

    ...fetchOptions,

    // @note carried through the fetch wrappers onto any TimeoutError so the
    // Sentry event records which model stalled (see `withTimeout` in @/lib/fetch)
    meta: { model },
  })

  if (!response.ok) {
    return await throwOpenAIError(response)
  }

  const data = (await response.json()) as OpenAI.Images.ImagesResponse

  const { data: items = [] } = data

  // @note use a Set to avoid returning duplicate URLs

  const urls = /** @type {string[]} */ [
    ...new Set(
      (
        await Promise.all(
          items.map(async ({ url, b64_json }) => {
            if (url) {
              return url
            }

            if (b64_json) {
              const type = {
                png: 'image/png',
                jpeg: 'image/jpeg',
                webp: 'image/webp',
              }[outputFormat]

              if (type) {
                return `data:${type};base64,${b64_json}`
              } else {
                return `data:application/octet-stream;base64,${b64_json}`
              }
            }

            return null
          })
        )
      ).filter((url): url is string => !!url)
    ),
  ]

  let usage

  switch (model) {
    case 'dall-e-2': {
      usage = {
        model: 'dalle2',
        inputTokens: 0,
        outputTokens: urls.length || 1,
      }

      break
    }

    case 'dall-e-3': {
      usage = {
        model: 'dalle3',
        inputTokens: 0,
        outputTokens: urls.length || 1,
      }

      break
    }

    case 'gpt-image-2': {
      usage = {
        model: 'gpt-image-2',
        inputTokens: 0,
        outputTokens: urls.length || 1,
      }

      break
    }

    case 'gpt-image-1': {
      usage = {
        model: 'gpt-image-1',
        inputTokens: 0,
        outputTokens: urls.length || 1,
      }

      break
    }

    case 'gpt-image-1.5': {
      usage = {
        model: 'gpt-image-1.5',
        inputTokens: 0,
        outputTokens: urls.length || 1,
      }

      break
    }

    default: {
      usage = {
        model: 'gpt-image-1',
        inputTokens: 0,
        outputTokens: urls.length || 1,
      }
    }
  }

  return {
    urls,
    usage,
  }
}

/**
 *
 */
export async function editImage(
  options: FetchOptions & {
    prompt: string
    images: Blob[]
    mask?: Blob
    model: string
    n?: number
    responseFormat?: 'url' | 'b64_json'
    outputFormat?: 'png' | 'jpeg' | 'webp'
    size?:
      | 'auto'
      | '1024x1024'
      | '1536x1024'
      | '1024x1536'
      | '256x256'
      | '512x512'
    user?: string
    url?: string
    authorization?: string
    headers?: Record<string, string>
  }
): Promise<{
  urls: string[]
  usage: {
    model: string
    inputTokens: number
    outputTokens: number
  }
}> {
  const {
    prompt,

    images,

    mask,

    model: _model,

    n = 1,

    responseFormat: _responseFormat = 'url',

    outputFormat: _outputFormat = 'png',

    size: _size,

    user,

    url = 'https://api.openai.com/v1/images/edits',
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    ...fetchOptions
  } = options

  const clientUserId = getClientUserId(user)

  debug(`createImage using`, {
    prompt,

    images,

    mask,

    model: _model,

    n,

    responseFormat: _responseFormat,

    size: _size,

    user,
    clientUserId,

    ...fetchOptions,
  }).log('openai.createImage')

  if (!images.length) {
    throw new Error('images is required for image edits')
  }

  // @note providerModel resolution is now handled by image.ts using the model
  // config - the model name passed here is already the provider-side identifier

  const modelNameToSizeMap = {
    'gpt-image-2': {
      '1024x1024': '1024x1024',
      '1024x1536': '1024x1536',
      '1536x1024': '1536x1024',
    },

    'gpt-image-1': {
      '1024x1024': '1024x1024',
      '1024x1536': '1024x1536',
      '1536x1024': '1536x1024',
    },

    'gpt-image-1-mini': {
      '1024x1024': '1024x1024',
      '1024x1536': '1024x1536',
      '1536x1024': '1536x1024',
    },

    'gpt-image-1.5': {
      '1024x1024': '1024x1024',
      '1024x1536': '1024x1536',
      '1536x1024': '1536x1024',
    },
  }

  const modelNameToResponseFormatMap = {
    'gpt-image-2': undefined,
    'gpt-image-1': undefined,
    'gpt-image-1.5': undefined,
    'gpt-image-1-mini': undefined,
  }

  const modelNameToOutputFormatMap = {}

  const model = _model || 'gpt-image-1'
  const size = (modelNameToSizeMap[model] || {})[_size || ''] || 'auto'

  // @note responseFormat is not supported by all models

  const responseFormat =
    model in modelNameToResponseFormatMap
      ? modelNameToResponseFormatMap[model]
      : _responseFormat

  // @note outputFormat is not supported by all models

  const outputFormat =
    model in modelNameToOutputFormatMap
      ? modelNameToOutputFormatMap[model]
      : _outputFormat

  debug(`using`, {
    model,
    size,
    responseFormat,
  }).log('openai.createImage')

  const form = new FormData()

  form.append('prompt', prompt)

  for (const image of images) {
    form.append('image[]', image)
  }

  if (mask) {
    form.append('mask', mask)
  }

  form.append('model', model)

  if (responseFormat) {
    form.append('response_format', responseFormat)
  }

  if (outputFormat) {
    form.append('output_format', outputFormat)
  }

  if (size) {
    form.append('size', size)
  }

  if (clientUserId) {
    form.append('user', clientUserId)
  }

  const response = await fetchForImage(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
    },

    body: form,

    ...fetchOptions,
  })

  if (!response.ok) {
    return await throwOpenAIError(response)
  }

  const data = (await response.json()) as OpenAI.Images.ImagesResponse

  const { data: items = [] } = data

  // @note use a Set to avoid returning duplicate URLs
  const urls = /** @type {string[]} */ [
    ...new Set(
      (
        await Promise.all(
          items.map(async ({ url, b64_json }) => {
            if (url) {
              return url
            }

            if (b64_json) {
              const type = {
                png: 'image/png',
                jpeg: 'image/jpeg',
                webp: 'image/webp',
              }[outputFormat]

              if (type) {
                return `data:${type};base64,${b64_json}`
              } else {
                return `data:application/octet-stream;base64,${b64_json}`
              }
            }

            return null
          })
        )
      ).filter((url): url is string => !!url)
    ),
  ]

  let usage

  switch (model) {
    case 'gpt-image-2': {
      usage = {
        model: 'gpt-image-2',
        inputTokens: images.length,
        outputTokens: urls.length || 1,
      }

      break
    }

    case 'gpt-image-1': {
      usage = {
        model: 'gpt-image-1',
        inputTokens: images.length,
        outputTokens: urls.length || 1,
      }

      break
    }

    case 'gpt-image-1.5': {
      usage = {
        model: 'gpt-image-1.5',
        inputTokens: images.length,
        outputTokens: urls.length || 1,
      }

      break
    }

    default: {
      usage = {
        model: 'gpt-image-1',
        inputTokens: images.length,
        outputTokens: urls.length || 1,
      }
    }
  }

  return {
    urls,
    usage,
  }
}

// --- Audio ---

interface SpeechUsage {
  totalTokens: number
  promptTokens: number
  completionTokens: number
}

/**
 *
 */
export function getSpeechUsage(input: string, model: string): SpeechUsage {
  const promptTokens = getTextTokensLength(input, model)

  return {
    totalTokens: promptTokens,
    promptTokens,
    completionTokens: 0,
  }
}

/**
 *
 */
export async function createSpeech(
  options: FetchOptions & {
    input: string
    model: string
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
    responseFormat?: 'mp3'
    speed?: number
    user?: string
    url?: string
    authorization?: string
    headers?: Record<string, string>
  }
): Promise<{
  data: ArrayBuffer
  usage: SpeechUsage
}> {
  const {
    input,

    model,

    voice,

    responseFormat = 'mp3',

    speed,

    url = 'https://api.openai.com/v1/audio/speech',
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    ...fetchOptions
  } = options

  debug(`createSpeech using`, {
    input,

    voice,

    responseFormat,

    speed,

    ...fetchOptions,
  }).log('openai.createSpeech')

  const body = {
    input,

    model,

    voice,

    response_format: responseFormat,

    speed,
  } satisfies OpenAI.Audio.Speech.SpeechCreateParams

  const response = await fetchForLongTasks(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(body),

    ...fetchOptions,

    // @note carried through the fetch wrappers onto any TimeoutError so the
    // Sentry event records which model stalled (see `withTimeout` in @/lib/fetch)
    meta: { model },
  })

  if (!response.ok) {
    return await throwOpenAIError(response)
  }

  const data = await response.arrayBuffer()

  return {
    data,
    usage: getSpeechUsage(input, model),
  }
}

/**
 * Canonical file extension for each audio content type OpenAI's transcription
 * endpoint accepts.
 *
 * @note OpenAI keys the audio format off the uploaded filename's *extension* and
 * trusts it over the part's Content-Type and over content sniffing. The mime
 * registry maps some types to non-canonical variants (audio/mpeg -> "mpga",
 * audio/webm -> "weba") that OpenAI's decoder for that extension rejects even
 * for valid input - e.g. an ID3-tagged MP3 sent as `audio.mpga` comes back as
 * "Audio file might be corrupted or unsupported". So map explicitly to the
 * extension OpenAI handles best; anything not listed here is left unmapped so
 * the caller omits the filename and lets OpenAI sniff the content (the original,
 * working behaviour).
 */
const AUDIO_TYPE_TO_EXTENSION: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/vnd.wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/webm': 'webm',
}

/**
 * Derive the filename to send to OpenAI's transcription endpoint, or `undefined`
 * when the format cannot be confidently determined.
 *
 * A bare Blob is multipart-encoded as `filename="blob"` (no extension); OpenAI
 * sniffs the content in that case. Giving it a filename with a canonical
 * extension makes format detection explicit for the formats we recognise (e.g.
 * a Telegram voice note, `audio/ogg` -> `audio.ogg`). We return `undefined` for
 * unrecognised types rather than guessing a possibly-wrong extension, because a
 * wrong extension overrides sniffing and gets the file rejected.
 *
 * @param audio - the audio blob or file being transcribed
 * @returns a filename with a format-carrying extension, or `undefined`
 */
export function getTranscriptionAudioFilename(audio: Blob): string | undefined {
  if (audio instanceof File && audio.name) {
    return audio.name
  }

  const ext = AUDIO_TYPE_TO_EXTENSION[(audio.type || '').toLowerCase()]

  return ext ? `audio.${ext}` : undefined
}

/**
 *
 */
export async function createTranscriptionResponse(
  options: FetchOptions & {
    audio: Blob
    model: string
    instructions?: string
    user?: string
    url?: string
    authorization?: string
    headers?: Record<string, string>
  }
): Promise<{
  text: string
  usage: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
  }
}> {
  // @todo migrate to the responses API as soon as it becomes possible to use
  // audio files - review after 2025/08/01

  const {
    audio,

    model,

    instructions = '',

    user,

    url = 'https://api.openai.com/v1/audio/transcriptions',
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    ...fetchOptions
  } = options

  const clientUserId = getClientUserId(user)

  debug(`createTranscriptionResponse using`, {
    audio,

    model,

    instructions,

    user,
    clientUserId,

    ...fetchOptions,
  }).log('openai.createTranscriptionResponse')

  const body = new FormData()

  // @note give the upload a filename with a format-carrying extension when we
  // recognise the audio type so OpenAI detects the format explicitly; otherwise
  // append the bare Blob and let OpenAI sniff the content (see
  // getTranscriptionAudioFilename).
  const filename = getTranscriptionAudioFilename(audio)

  if (filename) {
    body.append('file', audio, filename)
  } else {
    body.append('file', audio)
  }

  body.append('model', model)

  if (instructions) {
    body.append('prompt', instructions)
  }

  body.append('response_format', 'json')

  const response = await fetchForLongTasks(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
    },

    body,

    ...fetchOptions,
  })

  if (!response.ok) {
    return await throwOpenAIError(response)
  }

  const data =
    (await response.json()) as OpenAI.Audio.Transcriptions.Transcription

  const { text } = data

  return {
    text,

    usage: {
      // @todo figure out how to get the usage from the response

      totalTokens: 2000,
      promptTokens: 1000,
      completionTokens: 1000,
    },
  }
}

/**
 *
 */
export async function createAnnotationResponse(
  options: FetchOptions & {
    image: Blob
    model: string
    instructions?: string
    user?: string
    url?: string
    authorization?: string
    headers?: Record<string, string>
  }
): Promise<{
  text: string
  usage: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
  }
}> {
  const {
    image,

    model,

    instructions,

    user,

    url = 'https://api.openai.com/v1/responses',
    authorization = `Bearer ${getOpenAIKey()}`,
    headers,

    ...fetchOptions
  } = options

  const clientUserId = getClientUserId(user)

  debug(`createAnnotationResponse using`, {
    image,

    model,

    instructions,

    user,
    clientUserId,

    ...fetchOptions,
  }).log('openai.createAnnotationResponse')

  const body = {
    model,

    instructions,

    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_image',
            image_url: await blobToDataUrl(image),
          },
        ],
      },
    ],

    user: clientUserId,

    stream: false,

    store: false,
  } satisfies Omit<OpenAI.Responses.ResponseCreateParams, 'input'> & {
    input: Array<{
      role: 'user'
      content: Array<{
        type: 'input_image'
        image_url: string
      }>
    }>
  }

  const response = await fetchForLongTasks(url, {
    method: 'POST',

    headers: {
      ...headers,

      Authorization: authorization,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(body),

    ...fetchOptions,

    // @note carried through the fetch wrappers onto any TimeoutError so the
    // Sentry event records which model stalled (see `withTimeout` in @/lib/fetch)
    meta: { model },
  })

  if (!response.ok) {
    return await throwOpenAIError(response)
  }

  const data = (await response.json()) as OpenAI.Responses.Response

  const { output, usage } = data

  const items: string[] = []

  for (const outputItem of output) {
    if ('role' in outputItem && outputItem.role === 'assistant') {
      for (const contentItem of outputItem.content) {
        if ('type' in contentItem && contentItem.type === 'output_text') {
          items.push(contentItem.text)
        }
      }
    }
  }

  return {
    text: items.join(' '),

    usage: {
      totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
      promptTokens: usage?.input_tokens || 0,
      completionTokens: usage?.output_tokens || 0,
    },
  }
}

// --- Models ---

/**
 *
 */
export async function listModels(
  options: { headers?: Record<string, string> } = {}
): Promise<{ id: string; created: Date }[]> {
  const { headers } = options

  const response = await fetchForFetching('https://api.openai.com/v1/models', {
    method: 'GET',

    headers: {
      ...headers,

      Authorization: `Bearer ${getOpenAIKey()}`,
    },
  })

  if (!response.ok) {
    return await throwOpenAIError(response)
  }

  const { data } = (await response.json()) as { data: OpenAI.Models.Model[] }

  return data
    .filter(({ owned_by }) => ['openai', 'system'].includes(owned_by))
    .map(({ id, created }) => ({
      id,
      created: new Date(created * 1000),
    }))
}

// --- Embeddings ---

/**
 *
 */
export async function createEmbedding(
  input: string,
  options: { model: string; headers?: Record<string, string> }
): Promise<number[]> {
  // the assumption is that the caller always prepares the input such that for
  // text-embedding-ada-002 and perhaps other models OpenAI recommends stripping
  // new lines, etc.

  const { headers } = options

  const body = {
    model: options.model,
    input: input,
  } satisfies OpenAI.Embeddings.EmbeddingCreateParams

  const response = await fetchForFetching(
    'https://api.openai.com/v1/embeddings',
    {
      method: 'POST',

      headers: {
        ...headers,

        Authorization: `Bearer ${getOpenAIKey()}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    return await throwOpenAIError(response)
  }

  const data =
    (await response.json()) as OpenAI.Embeddings.CreateEmbeddingResponse

  const embedding = data.data[0].embedding

  return embedding
}

// --- Moderation ---

/**
 *
 */
export async function createModeration(
  input: string,
  options: { headers?: Record<string, string> } = {}
): Promise<{ flagged: boolean; categories: string[] }> {
  const { headers } = options

  const body = {
    model: 'omni-moderation-latest',
    input: input,
  } satisfies OpenAI.Moderations.ModerationCreateParams

  const response = await fetchForFetching(
    'https://api.openai.com/v1/moderations',
    {
      method: 'POST',

      headers: {
        ...headers,

        Authorization: `Bearer ${getOpenAIKey()}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    return await throwOpenAIError(response)
  }

  const data =
    (await response.json()) as OpenAI.Moderations.ModerationCreateResponse

  const { flagged = false, categories = {} } = data.results[0] || {}

  return {
    flagged,

    categories: Object.entries(categories)
      .filter(([, f]) => f)
      .map(([n]) => n),
  }
}
