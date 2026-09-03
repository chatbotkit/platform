import {
  TAG_ERROR,
  TAG_MESSAGE,
  TAG_RESULT,
  TAG_SEND_RESULT,
  TAG_TOKEN,
  TAG_USAGE,
} from '@/lib/conversation.tag'
import schema, { withSchema } from '@/lib/joi.handler'
import { accountLimitsOk, rateLimitsOk } from '@/lib/limit.core'
import type { Message } from '@/lib/message'
import { withPost } from '@/lib/method'
import { ok, throwBadRequest } from '@/lib/response'
import { type Session, withSession } from '@/lib/session.handler'
import { getRandomId } from '@/lib/string'
import { parse as parseStructstr } from '@/lib/structstr'

import jsonSchema from '@/schemas/jsonSchema'

import { complete } from '@/pages/api/v1/conversation/complete'

import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageFunctionToolCall,
} from 'openai/resources/chat/completions'

// ============================================================================
// Request schema
// ============================================================================

// @note OpenAI-compatible function definition. We deliberately do not reuse
// @/schemas/functionsSchema here: its name pattern is stricter than OpenAI's
// ^[a-zA-Z0-9_-]{1,64}$ and it carries CBK-only `result`/`call` extensions. We
// do reuse jsonSchema for `parameters`, which maps directly to OpenAI's schema.

const functionDefinitionSchema = schema.object({
  name: schema
    .string()
    .pattern(/^[a-zA-Z0-9_-]{1,64}$/)
    .required(),

  description: schema.string().required(),

  parameters: jsonSchema,
})

export const bodySchema = schema
  .object({
    model: schema.string().required(),

    messages: schema
      .array()
      .items(
        schema
          .object({
            role: schema.string().required(),

            // @note content is optional and may be a string or an array of
            // content parts; it is absent on assistant tool-call turns

            content: schema.any(),

            name: schema.string(),

            tool_call_id: schema.string(),

            tool_calls: schema.array().items(schema.object().unknown(true)),

            function_call: schema.object().unknown(true),
          })
          .unknown(true)
      )
      .min(1)
      .required(),

    stream: schema.boolean().default(false),

    // @note legacy OpenAI function-calling format

    functions: schema.array().items(functionDefinitionSchema),

    // @note current OpenAI tool-calling format (a function wrapped in a typed
    // envelope)

    tools: schema.array().items(
      schema.object({
        type: schema.string().valid('function').required(),

        function: functionDefinitionSchema.required(),
      })
    ),

    // @note accept and ignore unmapped OpenAI params (temperature, max_tokens,
    // top_p, user, ...) so standard clients don't get a 400 for fields we don't
    // translate yet
  })
  .unknown(true)

// ============================================================================
// OpenAI types
// ============================================================================

interface OpenAIContentPart {
  type: string
  text?: string
}

interface OpenAIToolCall {
  id?: string
  type?: 'function'
  function: { name: string; arguments: string }
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | OpenAIContentPart[] | null
  name?: string
  tool_call_id?: string
  tool_calls?: OpenAIToolCall[]
  function_call?: { name: string; arguments: string }
}

interface OpenAIFunctionDefinition {
  name: string
  description?: string
  parameters?: Record<string, unknown>
}

interface ChatCompletionBody {
  model: string
  messages: OpenAIMessage[]
  stream: boolean
  functions?: OpenAIFunctionDefinition[]
  tools?: { type: 'function'; function: OpenAIFunctionDefinition }[]
}

// @note we only ever emit function tool calls, so we use the function-specific
// SDK type rather than the broader ChatCompletionMessageToolCall union
type OutboundToolCall = ChatCompletionMessageFunctionToolCall

// ============================================================================
// Inbound conversion (OpenAI -> CBK)
// ============================================================================

/**
 * Resolves the OpenAI `model` field, which we treat as a structstr selector
 * (e.g. `model/name=glm-5.2`, `bot/id=abc123`). Bare model names are not
 * supported and `conversation/*` selectors are reserved for a future version.
 */
export function parseModelSelector(model: string): {
  model?: string
  botId?: string
} {
  const { name, config } = parseStructstr(model)

  switch (name) {
    case 'model': {
      const value = config.name ?? config.id

      if (!value) {
        return throwBadRequest('Model selector requires a `name` or `id`')
      }

      return { model: String(value) }
    }

    case 'bot': {
      if (!config.id) {
        return throwBadRequest('Bot selector requires an `id`')
      }

      return { botId: String(config.id) }
    }

    case 'conversation': {
      return throwBadRequest(
        'The `conversation/*` selector is not supported yet'
      )
    }

    default: {
      return throwBadRequest(
        `Unsupported model selector "${model}" - expected one of model/*, bot/*`
      )
    }
  }
}

/**
 * Flattens OpenAI message content (string or content-part array) to plain text.
 * Non-text parts (e.g. images) are ignored for now.
 */
function contentToText(content: OpenAIMessage['content']): string {
  if (content == null) {
    return ''
  }

  if (typeof content === 'string') {
    return content
  }

  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function stringifyArguments(args: unknown): string {
  if (typeof args === 'string') {
    return args
  }

  try {
    return JSON.stringify(args ?? {})
  } catch {
    return '{}'
  }
}

/**
 * Converts OpenAI chat messages into a CBK backstory + message history.
 *
 * - `system` messages are concatenated into the backstory
 * - `user` / `assistant` map to `user` / `bot`
 * - assistant `tool_calls` / `function_call` map to `request` activity messages
 * - `tool` results map to `response` activity messages, correlated back to the
 *   originating call via `tool_call_id`
 */
export function toCbkConversation(messages: OpenAIMessage[]): {
  backstory?: string
  messages: Message[]
} {
  const backstoryParts: string[] = []
  const cbkMessages: Message[] = []

  // @note maps an OpenAI tool_call_id to its originating call so we can attach
  // the function name/arguments when we later see the matching `tool` result
  const callsById = new Map<string, { name: string; arguments: unknown }>()

  for (const message of messages) {
    switch (message.role) {
      case 'system': {
        const text = contentToText(message.content)

        if (text) {
          backstoryParts.push(text)
        }

        break
      }

      case 'user': {
        cbkMessages.push({ type: 'user', text: contentToText(message.content) })

        break
      }

      case 'assistant': {
        const toolCalls =
          message.tool_calls ??
          (message.function_call
            ? [{ type: 'function' as const, function: message.function_call }]
            : [])

        for (const toolCall of toolCalls) {
          const args = safeJsonParse(toolCall.function.arguments)

          if (toolCall.id) {
            callsById.set(toolCall.id, {
              name: toolCall.function.name,
              arguments: args,
            })
          }

          cbkMessages.push({
            type: 'activity',
            text: '',
            meta: {
              activity: {
                type: 'request',
                function: { name: toolCall.function.name, arguments: args },
              },
            },
          })
        }

        const text = contentToText(message.content)

        if (text) {
          cbkMessages.push({ type: 'bot', text })
        }

        break
      }

      case 'tool': {
        const call = message.tool_call_id
          ? callsById.get(message.tool_call_id)
          : undefined

        cbkMessages.push({
          type: 'activity',
          text: '',
          meta: {
            activity: {
              type: 'response',
              function: {
                name: call?.name ?? message.name ?? 'unknown',
                arguments: call?.arguments,
                result: safeJsonParse(contentToText(message.content)),
              },
            },
          },
        })

        break
      }
    }
  }

  return {
    backstory: backstoryParts.length ? backstoryParts.join('\n\n') : undefined,
    messages: cbkMessages,
  }
}

/**
 * Merges OpenAI `functions` (legacy) and `tools` (current) into a single CBK
 * functions array. Declaration-only: no `result`, so the engine emits the tool
 * call and stops, leaving execution to the caller (stateless round-trip).
 */
export function toCbkFunctions(
  functions: ChatCompletionBody['functions'],
  tools: ChatCompletionBody['tools']
):
  | { name: string; description: string; parameters: Record<string, unknown> }[]
  | undefined {
  const definitions: OpenAIFunctionDefinition[] = [
    ...(functions ?? []),
    ...(tools ?? []).map((tool) => tool.function),
  ]

  const seen = new Set<string>()

  const result = definitions
    .filter((definition) => {
      if (seen.has(definition.name)) {
        return false
      }

      seen.add(definition.name)

      return true
    })
    .map((definition) => ({
      name: definition.name,
      description: definition.description ?? '',
      parameters: definition.parameters ?? {},
    }))

  return result.length ? result : undefined
}

// ============================================================================
// Outbound conversion (CBK -> OpenAI)
// ============================================================================

type CbkCompleteReason =
  | 'stop'
  | 'length'
  | 'activity'
  | 'iteration'
  | 'error'
  | 'abort'

/**
 * Maps a CBK completion end reason to an OpenAI `finish_reason`.
 */
// @note OpenAI's finish_reason is a closed union with no error/abort member;
// engine errors are surfaced out-of-band (HTTP 500 + envelope, or an inline
// streaming error payload) exactly as the real API does
type OpenAIFinishReason = 'stop' | 'length' | 'tool_calls'

export function mapFinishReason(
  reason: CbkCompleteReason | undefined
): OpenAIFinishReason {
  switch (reason) {
    case 'activity':
      return 'tool_calls'

    case 'length':
      return 'length'

    // @note stop, iteration, error and abort all collapse to a clean stop;
    // error/abort detail is carried by the error envelope, not finish_reason
    default:
      return 'stop'
  }
}

export function buildChatCompletion(args: {
  id: string
  created: number
  model: string
  text: string
  toolCalls: OutboundToolCall[]
  finishReason: OpenAIFinishReason
  usage: { prompt_tokens: number; completion_tokens: number }
}): ChatCompletion {
  const { id, created, model, text, toolCalls, finishReason, usage } = args

  return {
    id,
    object: 'chat.completion',
    created,
    model,
    choices: [
      {
        index: 0,
        logprobs: null,
        message: {
          role: 'assistant',
          refusal: null,
          content: text || (toolCalls.length ? null : ''),
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.prompt_tokens + usage.completion_tokens,
    },
  } satisfies ChatCompletion
}

// @note minimal view over the loosely-typed engine event payloads we read
interface RequestActivityData {
  type?: string
  meta?: {
    activity?: {
      type?: string
      function?: { name?: string; arguments?: unknown }
    }
  }
}

/**
 * Extracts a `request` activity (i.e. a tool call the engine wants the caller
 * to fulfil) from a TAG_MESSAGE payload, if that is what it carries.
 */
function toOutboundToolCall(data: unknown): OutboundToolCall | undefined {
  const message = data as RequestActivityData

  if (
    message?.type !== 'activity' ||
    message.meta?.activity?.type !== 'request'
  ) {
    return undefined
  }

  const fn = message.meta.activity.function

  return {
    id: getRandomId('call_'),
    type: 'function',
    function: {
      name: fn?.name ?? 'unknown',
      arguments: stringifyArguments(fn?.arguments),
    },
  }
}

interface OpenAIErrorEnvelope {
  error: { message: string; type: string; code: string | null }
}

/**
 * Maps a CBK engine error payload ({ code, message }) onto an OpenAI-style
 * error envelope. An optional `type` overrides the default `server_error` so
 * that non-server failures (e.g. rate limits, quota) carry the OpenAI error
 * type that clients branch on.
 */
export function toOpenAIError(data: unknown): OpenAIErrorEnvelope {
  const error = data as { code?: string; message?: string; type?: string }

  return {
    error: {
      message: error?.message ?? 'Internal server error',
      type: error?.type ?? 'server_error',
      code: error?.code ?? null,
    },
  }
}

// ============================================================================
// Engine invocation + response shaping
// ============================================================================

type EngineEvents = AsyncGenerator<{ type: string; data: unknown }>

function chatCompletionChunk(args: {
  id: string
  created: number
  model: string
  delta: ChatCompletionChunk['choices'][number]['delta']
  finishReason: ChatCompletionChunk['choices'][number]['finish_reason']
}): ChatCompletionChunk {
  const { id, created, model, delta, finishReason } = args

  return {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  } satisfies ChatCompletionChunk
}

async function buildStaticResponse(
  events: EngineEvents,
  meta: { id: string; created: number; model: string }
): Promise<Response> {
  let text = ''
  let finishReason: OpenAIFinishReason = 'stop'
  const toolCalls: OutboundToolCall[] = []
  let error: unknown

  // @note token accounting. The engine may emit a fine-grained input/output
  // split via TAG_USAGE, but the stateless complete() wrapper instead reports a
  // running total: on TAG_SEND_RESULT (the input/prompt side) and on TAG_RESULT
  // (the grand total). We prefer the split when present and otherwise derive
  // prompt/completion from the two totals so that total === prompt +
  // completion.

  let usageInput = 0
  let usageOutput = 0
  let sendToken = 0
  let resultToken = 0

  for await (const event of events) {
    switch (event.type) {
      case TAG_USAGE: {
        const data = event.data as {
          inputTokensUsed?: number
          outputTokensUsed?: number
        }

        usageInput += data.inputTokensUsed ?? 0
        usageOutput += data.outputTokensUsed ?? 0

        break
      }

      case TAG_SEND_RESULT: {
        const data = event.data as { usage?: { token?: number } }

        sendToken = data.usage?.token ?? sendToken

        break
      }

      case TAG_MESSAGE: {
        const toolCall = toOutboundToolCall(event.data)

        if (toolCall) {
          toolCalls.push(toolCall)
        }

        break
      }

      case TAG_RESULT: {
        const data = event.data as {
          text?: string
          usage?: { token?: number }
          end?: { reason?: CbkCompleteReason }
        }

        text = data.text ?? text
        resultToken = data.usage?.token ?? resultToken
        finishReason = mapFinishReason(data.end?.reason)

        break
      }

      case TAG_ERROR: {
        error = event.data

        break
      }
    }
  }

  if (error) {
    return new Response(JSON.stringify(toOpenAIError(error)), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // @note prefer the explicit input/output split; otherwise derive it from the
  // running totals (prompt = input side, completion = remainder of the total)

  const hasSplit = usageInput > 0 || usageOutput > 0

  const usage = hasSplit
    ? { prompt_tokens: usageInput, completion_tokens: usageOutput }
    : {
        prompt_tokens: sendToken,
        completion_tokens: Math.max(0, resultToken - sendToken),
      }

  return ok(
    buildChatCompletion({ ...meta, text, toolCalls, finishReason, usage })
  )
}

function buildStreamingResponse(
  events: EngineEvents,
  meta: { id: string; created: number; model: string }
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: object): void => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        )
      }

      let finishReason: OpenAIFinishReason = 'stop'

      // @note OpenAI reassembles streamed tool calls by their index, so each
      // distinct call must advance this counter (name in the first delta,
      // argument fragments in subsequent ones for the same index)

      let toolCallIndex = 0

      try {
        // @note OpenAI streams an opening chunk that establishes the role

        send(
          chatCompletionChunk({
            ...meta,
            delta: { role: 'assistant' },
            finishReason: null,
          })
        )

        for await (const event of events) {
          switch (event.type) {
            case TAG_TOKEN: {
              const { token } = event.data as { token: string }

              send(
                chatCompletionChunk({
                  ...meta,
                  delta: { content: token },
                  finishReason: null,
                })
              )

              break
            }

            case TAG_MESSAGE: {
              const toolCall = toOutboundToolCall(event.data)

              if (toolCall) {
                send(
                  chatCompletionChunk({
                    ...meta,
                    delta: {
                      tool_calls: [{ index: toolCallIndex++, ...toolCall }],
                    },
                    finishReason: null,
                  })
                )
              }

              break
            }

            case TAG_RESULT: {
              const data = event.data as {
                end?: { reason?: CbkCompleteReason }
              }

              finishReason = mapFinishReason(data.end?.reason)

              break
            }

            case TAG_ERROR: {
              // @note no status code can be set once streaming has begun, so we
              // surface the error inline; finish_reason stays within OpenAI's
              // union (the envelope is what signals the failure to the client)

              send(toOpenAIError(event.data))

              break
            }
          }
        }

        send(chatCompletionChunk({ ...meta, delta: {}, finishReason }))
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

/**
 * @swagger
 *
 * /openai/chat/completions:
 *   post:
 *     operationId: createChatCompletion
 *     summary: Create a chat completion (OpenAI-compatible)
 *     description: >-
 *       An OpenAI Chat Completions compatible endpoint. Point any OpenAI client
 *       at this base URL and set `model` to a selector such as `model/name=...`
 *       or `bot/id=...`. Supports streaming and tool calling.
 *     tags:
 *       - OpenAI Compatibility
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: The chat completion (or a text/event-stream when streaming)
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(
      bodySchema,
      async function (
        req: Request,
        session: Session,
        body: ChatCompletionBody
      ): Promise<Response> {
        const { model, messages, stream, functions, tools } = body

        // @note this OpenAI-compatible layer drives the engine directly via
        // complete(), bypassing the withSessionLimits wrapper that gates the
        // native conversation endpoints (see conversation/complete). We must
        // therefore enforce the same usage limits here ourselves. We do it
        // inline rather than via the wrapper so that a limit failure is shaped
        // as an OpenAI error envelope (429 + rate_limit_exceeded/
        // insufficient_quota) that standard OpenAI clients surface cleanly,
        // rather than CBK's own limits-reached envelope. The context is passed
        // through so nearly-exceeded warning notifications still fire; we branch
        // on the boolean results rather than reading it back.

        const limitContext = { exceededLimits: [], nearlyExceededLimits: [] }

        const [rateOk, accountOk] = await Promise.all([
          rateLimitsOk(session.user, ['rate/message'], limitContext),
          accountLimitsOk(session.user, ['message', 'token'], limitContext),
        ])

        if (!rateOk || !accountOk) {
          const payload = !rateOk
            ? {
                message: 'Rate limit reached for requests.',
                type: 'rate_limit_exceeded',
                code: 'rate_limit_exceeded',
              }
            : {
                message: 'You exceeded your current quota.',
                type: 'insufficient_quota',
                code: 'insufficient_quota',
              }

          return new Response(JSON.stringify(toOpenAIError(payload)), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const selector = parseModelSelector(model)

        const { backstory, messages: cbkMessages } = toCbkConversation(messages)

        const completeBody = {
          ...selector,

          messages: cbkMessages,

          functions: toCbkFunctions(functions, tools),

          // @note the OpenAI `system` prompt is applied as an extension so it
          // extends (rather than replaces) a bot's own backstory; for model/*
          // selectors with no base backstory it simply becomes the backstory.
          // API sessions are trusted, so the engine honours
          // extensions.backstory

          ...(backstory ? { extensions: { backstory } } : {}),
        }

        const meta = {
          id: getRandomId('chatcmpl-'),
          created: Math.floor(Date.now() / 1000),
          model,
        }

        const events = complete(session, completeBody, {
          abortSignal: req.signal,
        }) as EngineEvents

        if (stream) {
          return buildStreamingResponse(events, meta)
        }

        return buildStaticResponse(events, meta)
      }
    )
  )
)

/**
 * @manual OpenAI
 * @description OpenAI-compatible chat completions endpoint enabling seamless integration with OpenAI client libraries and tools
 * @category Integrations
 * @tags openai, chat, completions, compatibility
 * @index 1
 *
 * ChatBotKit provides an OpenAI-compatible chat completions endpoint that allows you to use standard OpenAI client libraries, tools, and frameworks with ChatBotKit's AI infrastructure. This endpoint implements the OpenAI Chat Completions API specification, enabling drop-in compatibility with existing OpenAI integrations.
 *
 * The compatibility layer translates OpenAI API requests into ChatBotKit conversation engine calls and converts the responses back to the expected OpenAI format. This means you can point any OpenAI-compatible client at the ChatBotKit base URL and immediately leverage ChatBotKit's capabilities including custom bots, knowledge bases, integrations, and advanced conversation management.
 *
 * ## Creating Chat Completions
 *
 * To create a chat completion, send a POST request to the OpenAI-compatible endpoint with your conversation messages. The endpoint accepts the standard OpenAI chat completions request format and returns responses in the same structure that OpenAI clients expect.
 *
 * ```http
 * POST /api/v1/openai/chat/completions
 * Content-Type: application/json
 * Authorization: Bearer YOUR_CHATBOTKIT_TOKEN
 *
 * {
 *   "model": "model/name=glm-5.2",
 *   "messages": [
 *     { "role": "system", "content": "You are a helpful assistant." },
 *     { "role": "user", "content": "What is the capital of France?" }
 *   ]
 * }
 * ```
 *
 * The response follows the standard OpenAI format, including the generated assistant message, token usage statistics, and completion metadata. Both streaming and non-streaming modes are fully supported.
 *
 * ## Model Selection with Selectors
 *
 * ChatBotKit extends the OpenAI model field with a flexible selector syntax that allows you to target specific ChatBotKit resources. Instead of using bare model names, you specify structured selectors that tell the platform exactly which resource to use for the completion.
 *
 * The `model/name=...` selector routes your request to a specific AI model available on the ChatBotKit platform. For example, `model/name=glm-5.2` uses GLM-5.2, while `model/name=claude-4.8-opus` uses Claude 4.8 Opus. This selector gives you direct access to any model in the ChatBotKit model catalog.
 *
 * The `bot/id=...` selector routes your request through a specific ChatBotKit bot configuration. When you use a bot selector like `bot/id=abc123`, the completion inherits the bot's backstory, skillsets, connected knowledge bases, privacy settings, and all other configured behaviors. This allows you to use the OpenAI API format while leveraging the full power of ChatBotKit's bot management system.
 *
 * ```http
 * POST /api/v1/openai/chat/completions
 * Content-Type: application/json
 *
 * {
 *   "model": "bot/id=abc123",
 *   "messages": [
 *     { "role": "user", "content": "Hello" }
 *   ]
 * }
 * ```
 *
 * Bare model names without the selector syntax are intentionally not supported. This design ensures explicit control over which ChatBotKit resources handle each request and prevents ambiguity about configuration sources.
 *
 * ## Message Roles and Conversation Mapping
 *
 * The endpoint automatically converts between OpenAI message formats and ChatBotKit's internal conversation structure. System messages are concatenated and applied as conversation backstory, extending any existing bot backstory rather than replacing it. User and assistant messages map directly to user and bot turns in the conversation history.
 *
 * When using the `bot/id=...` selector, system messages from your request extend the bot's configured backstory. This allows you to provide request-specific context while preserving the bot's core instructions. For `model/name=...` selectors without an underlying bot configuration, the system messages become the entire backstory for that completion.
 *
 * Assistant messages in the input conversation that contain function calls or tool calls are converted to request activity messages, preserving the function name and arguments. Tool role messages containing function results are converted to response activity messages, maintaining the correlation between calls and results through tool call IDs.
 *
 * The conversation mapping ensures that complex multi-turn interactions with tool usage work seamlessly across the OpenAI compatibility layer.
 *
 * ## Streaming Responses
 *
 * Set `stream: true` in your request body to receive the completion as a server-sent event stream instead of a single JSON response. The streaming format follows the OpenAI specification exactly, delivering tokens as they are generated and enabling real-time display of responses in your application.
 *
 * ```http
 * POST /api/v1/openai/chat/completions
 * Content-Type: application/json
 *
 * {
 *   "model": "model/name=glm-5.2",
 *   "messages": [
 *     { "role": "user", "content": "Write a short story" }
 *   ],
 *   "stream": true
 * }
 * ```
 *
 * The streaming response delivers a sequence of `data:` events, each containing a completion chunk. The first chunk establishes the assistant role, subsequent chunks contain content tokens or tool call deltas, and the final chunk includes the finish reason. The stream ends with a `data: [DONE]` marker.
 *
 * Token usage statistics are not available in streaming mode, as the response is generated incrementally without waiting for the complete token count.
 *
 * ## Tool Calling and Function Support
 *
 * The endpoint supports both the legacy `functions` parameter and the current `tools` parameter for declaring callable functions. Declared functions are presented to the AI model as available tools, and when the model decides to call one, the endpoint returns the tool call in the standard OpenAI format.
 *
 * Function declarations follow the OpenAI specification, with a name matching the pattern `^[a-zA-Z0-9_-]{1,64}$`, an optional description, and a JSON schema for parameters. The endpoint merges functions from both the `functions` and `tools` arrays, deduplicating by name if the same function appears in both.
 *
 * ```http
 * POST /api/v1/openai/chat/completions
 * Content-Type: application/json
 *
 * {
 *   "model": "model/name=glm-5.2",
 *   "messages": [
 *     { "role": "user", "content": "What's the weather in Paris?" }
 *   ],
 *   "tools": [
 *     {
 *       "type": "function",
 *       "function": {
 *         "name": "get_weather",
 *         "description": "Get current weather for a city",
 *         "parameters": {
 *           "type": "object",
 *           "properties": {
 *             "city": { "type": "string" }
 *           },
 *           "required": ["city"]
 *         }
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * When the model generates a tool call, the response includes the tool call details with a unique call ID, the function name, and the arguments as a JSON string. Your application is responsible for executing the function and submitting the result back in a follow-up completion request.
 *
 * The stateless round-trip model means the endpoint does not automatically execute functions. It declares them to the model and returns the tool calls for your code to handle, maintaining full control over function execution and side effects.
 *
 * ## Using Standard OpenAI Client Libraries
 *
 * You can use official OpenAI client libraries by configuring them to point at the ChatBotKit base URL. The authentication mechanism remains the same: your ChatBotKit API token is passed as a bearer token in the Authorization header.
 *
 * For the OpenAI Python client:
 *
 * ```python
 * from openai import OpenAI
 *
 * client = OpenAI(
 *     base_url="https://api.chatbotkit.com/api/v1/openai",
 *     api_key="YOUR_CHATBOTKIT_TOKEN"
 * )
 *
 * completion = client.chat.completions.create(
 *     model="bot/id=abc123",
 *     messages=[
 *         {"role": "user", "content": "Hello"}
 *     ]
 * )
 * ```
 *
 * For the OpenAI Node.js client:
 *
 * ```javascript
 * import OpenAI from 'openai'
 *
 * const client = new OpenAI({
 *   baseURL: 'https://api.chatbotkit.com/api/v1/openai',
 *   apiKey: 'YOUR_CHATBOTKIT_TOKEN'
 * })
 *
 * const completion = await client.chat.completions.create({
 *   model: 'bot/id=abc123',
 *   messages: [
 *     { role: 'user', content: 'Hello' }
 *   ]
 * })
 * ```
 *
 * This compatibility allows you to migrate existing OpenAI integrations to ChatBotKit with minimal code changes, or to use ChatBotKit as a backend for tools and frameworks built for the OpenAI API.
 */
