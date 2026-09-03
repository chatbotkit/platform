import { accountLimitsOk, rateLimitsOk } from '@/lib/limit.core'

import { complete } from '@/pages/api/v1/conversation/complete'
import {
  bodySchema,
  buildChatCompletion,
  default as handler,
  mapFinishReason,
  parseModelSelector,
  toCbkConversation,
  toCbkFunctions,
  toOpenAIError,
} from '@/pages/api/v1/openai/chat/completions'

/**
 * @jest-environment node
 */

// @note mock the framework wrappers so importing the route does not pull in the
// session/method machinery, and stub the heavy conversation engine + tag module

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/pages/api/v1/conversation/complete', () => ({
  complete: jest.fn(),
}))

jest.mock('@/lib/conversation.tag', () => ({
  TAG_ERROR: 'error',
  TAG_MESSAGE: 'message',
  TAG_RESULT: 'result',
  TAG_SEND_RESULT: 'sendResult',
  TAG_TOKEN: 'token',
  TAG_USAGE: 'usage',
}))

jest.mock('@/lib/string', () => ({
  getRandomId: (prefix = '') => `${prefix}fixed`,
}))

// @note stub the usage-limit primitives; the route now enforces them inline
// (default: allowed). Individual tests override the return to exercise the
// 429 rate-limit / quota paths.
jest.mock('@/lib/limit.core', () => ({
  rateLimitsOk: jest.fn(async () => true),
  accountLimitsOk: jest.fn(async () => true),
}))

describe('parseModelSelector', () => {
  it('resolves a model selector by name', () => {
    expect(parseModelSelector('model/name=gpt-4o')).toEqual({ model: 'gpt-4o' })
  })

  it('resolves a model selector by id', () => {
    expect(parseModelSelector('model/id=gpt-4o')).toEqual({ model: 'gpt-4o' })
  })

  it('resolves a bot selector', () => {
    expect(parseModelSelector('bot/id=abc123')).toEqual({ botId: 'abc123' })
  })

  it('rejects bare model names', () => {
    expect(() => parseModelSelector('gpt-4o')).toThrow()
  })

  it('rejects conversation selectors (reserved for future use)', () => {
    expect(() => parseModelSelector('conversation/id=xyz')).toThrow()
  })

  it('rejects an empty model selector value', () => {
    expect(() => parseModelSelector('model/name=')).toThrow()
  })
})

describe('toCbkConversation', () => {
  it('maps a system message into the backstory', () => {
    const { backstory, messages } = toCbkConversation([
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'hi' },
    ])

    expect(backstory).toBe('You are helpful')
    expect(messages).toEqual([{ type: 'user', text: 'hi' }])
  })

  it('joins multiple system messages', () => {
    const { backstory } = toCbkConversation([
      { role: 'system', content: 'A' },
      { role: 'system', content: 'B' },
      { role: 'user', content: 'hi' },
    ])

    expect(backstory).toBe('A\n\nB')
  })

  it('maps user and assistant roles to user and bot', () => {
    const { messages } = toCbkConversation([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])

    expect(messages).toEqual([
      { type: 'user', text: 'hi' },
      { type: 'bot', text: 'hello' },
    ])
  })

  it('flattens array content to text, ignoring non-text parts', () => {
    const { messages } = toCbkConversation([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hello ' },
          { type: 'image_url', image_url: { url: 'x' } },
          { type: 'text', text: 'world' },
        ],
      },
    ])

    expect(messages).toEqual([{ type: 'user', text: 'hello world' }])
  })

  it('maps assistant tool_calls to request activity messages', () => {
    const { messages } = toCbkConversation([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"city":"Tokyo"}' },
          },
        ],
      },
    ])

    expect(messages).toEqual([
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'request',
            function: { name: 'get_weather', arguments: { city: 'Tokyo' } },
          },
        },
      },
    ])
  })

  it('correlates a tool result back to its originating call', () => {
    const { messages } = toCbkConversation([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"city":"Tokyo"}' },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_1',
        content: '{"temp":18}',
      },
    ])

    expect(messages[1]).toEqual({
      type: 'activity',
      text: '',
      meta: {
        activity: {
          type: 'response',
          function: {
            name: 'get_weather',
            arguments: { city: 'Tokyo' },
            result: { temp: 18 },
          },
        },
      },
    })
  })

  it('supports the legacy function_call format', () => {
    const { messages } = toCbkConversation([
      {
        role: 'assistant',
        content: null,
        function_call: { name: 'do_thing', arguments: '{"a":1}' },
      },
    ])

    expect(messages[0].meta.activity.function).toEqual({
      name: 'do_thing',
      arguments: { a: 1 },
    })
  })
})

describe('toCbkFunctions', () => {
  it('returns undefined when neither functions nor tools are provided', () => {
    expect(toCbkFunctions(undefined, undefined)).toBeUndefined()
  })

  it('maps legacy functions', () => {
    expect(
      toCbkFunctions(
        [{ name: 'a', description: 'desc', parameters: { type: 'object' } }],
        undefined
      )
    ).toEqual([
      { name: 'a', description: 'desc', parameters: { type: 'object' } },
    ])
  })

  it('unwraps tools into function definitions', () => {
    expect(
      toCbkFunctions(undefined, [
        { type: 'function', function: { name: 'b', description: 'd' } },
      ])
    ).toEqual([{ name: 'b', description: 'd', parameters: {} }])
  })

  it('merges functions and tools and de-duplicates by name', () => {
    const result = toCbkFunctions(
      [{ name: 'a', description: 'first' }],
      [{ type: 'function', function: { name: 'a', description: 'second' } }]
    )

    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('first')
  })
})

describe('mapFinishReason', () => {
  it('maps activity to tool_calls', () => {
    expect(mapFinishReason('activity')).toBe('tool_calls')
  })

  it('maps length to length', () => {
    expect(mapFinishReason('length')).toBe('length')
  })

  it('collapses stop, iteration, error and abort to stop (OpenAI has no error reason)', () => {
    expect(mapFinishReason('stop')).toBe('stop')
    expect(mapFinishReason('iteration')).toBe('stop')
    expect(mapFinishReason('error')).toBe('stop')
    expect(mapFinishReason('abort')).toBe('stop')
    expect(mapFinishReason(undefined)).toBe('stop')
  })
})

describe('toOpenAIError', () => {
  it('wraps a CBK error payload in an OpenAI error envelope', () => {
    expect(
      toOpenAIError({ code: 'NOT_FOUND', message: 'Bot not found' })
    ).toEqual({
      error: {
        message: 'Bot not found',
        type: 'server_error',
        code: 'NOT_FOUND',
      },
    })
  })

  it('falls back to a generic message and null code', () => {
    expect(toOpenAIError(undefined)).toEqual({
      error: {
        message: 'Internal server error',
        type: 'server_error',
        code: null,
      },
    })
  })
})

describe('buildChatCompletion', () => {
  it('builds a text completion with aggregated usage', () => {
    const completion = buildChatCompletion({
      id: 'chatcmpl-1',
      created: 123,
      model: 'model/name=gpt-4o',
      text: 'hello',
      toolCalls: [],
      finishReason: 'stop',
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    })

    expect(completion).toMatchObject({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'hello' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })

    expect(completion.choices[0].message.tool_calls).toBeUndefined()
  })

  it('nulls content and includes tool_calls when present', () => {
    const completion = buildChatCompletion({
      id: 'chatcmpl-1',
      created: 123,
      model: 'model/name=gpt-4o',
      text: '',
      toolCalls: [
        {
          id: 'call_fixed',
          type: 'function',
          function: { name: 'a', arguments: '{}' },
        },
      ],
      finishReason: 'tool_calls',
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    })

    expect(completion.choices[0].message.content).toBeNull()
    expect(completion.choices[0].message.tool_calls).toHaveLength(1)
    expect(completion.choices[0].finish_reason).toBe('tool_calls')
  })
})

describe('bodySchema', () => {
  it('validates a minimal request', () => {
    const { error } = bodySchema.validate({
      model: 'model/name=gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    })

    expect(error).toBeUndefined()
  })

  it('requires model and messages', () => {
    expect(bodySchema.validate({}).error).toBeDefined()
  })

  it('accepts (and ignores) unmapped OpenAI params instead of rejecting', () => {
    const { error } = bodySchema.validate({
      model: 'model/name=gpt-4o',
      messages: [{ role: 'user', content: 'hi', extra: 'ignored' }],
      temperature: 0.2,
      max_tokens: 16,
      top_p: 1,
      user: 'abc',
    })

    expect(error).toBeUndefined()
  })
})

// ============================================================================
// Handler integration: drives the default export with a mocked engine and
// asserts the actual HTTP Response (status, body, SSE framing). This is what
// guards real OpenAI client compatibility end-to-end.
// ============================================================================

// @note a scripted engine: yields the given events as the complete() generator
function engineYielding(events) {
  return (async function* () {
    for (const event of events) {
      yield event
    }
  })()
}

// @note parse an SSE body into its decoded payloads ('[DONE]' kept as a marker)
function parseSse(text) {
  return text
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const payload = block.replace(/^data: /, '')

      return payload === '[DONE]' ? '[DONE]' : JSON.parse(payload)
    })
}

const fakeReq = { signal: undefined }
const fakeSession = { id: 'sess', user: { id: 'user' } }

function callHandler(body, events) {
  complete.mockReturnValueOnce(engineYielding(events))

  return handler(fakeReq, fakeSession, { stream: false, ...body })
}

beforeEach(() => {
  complete.mockReset()

  // @note default to "within limits" so the handler proceeds to the engine;
  // limit-specific tests override these per case
  rateLimitsOk.mockReset().mockResolvedValue(true)
  accountLimitsOk.mockReset().mockResolvedValue(true)
})

describe('handler - usage limits', () => {
  it('enforces limits before invoking the engine', async () => {
    await callHandler(
      {
        model: 'model/name=gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      },
      [{ type: 'result', data: { text: 'ok', end: { reason: 'stop' } } }]
    )

    // @note the engine must only run once the limit checks pass
    expect(rateLimitsOk).toHaveBeenCalledWith(
      fakeSession.user,
      ['rate/message'],
      expect.anything()
    )
    expect(accountLimitsOk).toHaveBeenCalledWith(
      fakeSession.user,
      ['message', 'token'],
      expect.anything()
    )
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('returns a 429 rate_limit_exceeded error when the rate limit is hit', async () => {
    rateLimitsOk.mockResolvedValue(false)

    const response = await handler(fakeReq, fakeSession, {
      stream: false,
      model: 'model/name=gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    })

    expect(response.status).toBe(429)

    const body = await response.json()

    expect(body).toEqual({
      error: {
        message: 'Rate limit reached for requests.',
        type: 'rate_limit_exceeded',
        code: 'rate_limit_exceeded',
      },
    })

    // @note the engine must never run when a limit is exceeded
    expect(complete).not.toHaveBeenCalled()
  })

  it('returns a 429 insufficient_quota error when an account limit is hit', async () => {
    accountLimitsOk.mockResolvedValue(false)

    const response = await handler(fakeReq, fakeSession, {
      stream: false,
      model: 'model/name=gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    })

    expect(response.status).toBe(429)

    const body = await response.json()

    expect(body).toEqual({
      error: {
        message: 'You exceeded your current quota.',
        type: 'insufficient_quota',
        code: 'insufficient_quota',
      },
    })

    expect(complete).not.toHaveBeenCalled()
  })

  it('prefers the rate-limit error when both limits are exceeded', async () => {
    rateLimitsOk.mockResolvedValue(false)
    accountLimitsOk.mockResolvedValue(false)

    const response = await handler(fakeReq, fakeSession, {
      stream: false,
      model: 'model/name=gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    })

    expect(response.status).toBe(429)

    const body = await response.json()

    expect(body.error.type).toBe('rate_limit_exceeded')
    expect(complete).not.toHaveBeenCalled()
  })
})

describe('handler - request mapping into the engine', () => {
  it('maps a bot selector, system->extensions.backstory and functions', async () => {
    await callHandler(
      {
        model: 'bot/id=abc123',
        messages: [
          { role: 'system', content: 'be nice' },
          { role: 'user', content: 'hi' },
        ],
        functions: [{ name: 'get_time', description: 'd', parameters: {} }],
      },
      [{ type: 'result', data: { text: 'ok', end: { reason: 'stop' } } }]
    )

    expect(complete).toHaveBeenCalledTimes(1)

    const [session, completeBody, options] = complete.mock.calls[0]

    expect(session).toBe(fakeSession)

    expect(completeBody).toMatchObject({
      botId: 'abc123',
      messages: [{ type: 'user', text: 'hi' }],
      functions: [{ name: 'get_time', description: 'd', parameters: {} }],
      // @note system prompt is applied as an extension so it extends the bot's
      // own backstory rather than replacing it
      extensions: { backstory: 'be nice' },
    })

    expect(completeBody.botId).toBe('abc123')
    expect(completeBody.model).toBeUndefined()
    expect(options).toHaveProperty('abortSignal')
  })

  it('maps a model selector and omits extensions when there is no system prompt', async () => {
    await callHandler(
      {
        model: 'model/name=gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      },
      [{ type: 'result', data: { text: 'ok', end: { reason: 'stop' } } }]
    )

    const [, completeBody] = complete.mock.calls[0]

    expect(completeBody.model).toBe('gpt-4o')
    expect(completeBody.botId).toBeUndefined()
    expect(completeBody.extensions).toBeUndefined()
  })
})

describe('handler - non-streaming response', () => {
  it('returns a chat.completion with aggregated usage and OpenAI-required fields', async () => {
    const response = await callHandler(
      {
        model: 'model/name=gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      },
      [
        { type: 'usage', data: { inputTokensUsed: 10, outputTokensUsed: 5 } },
        { type: 'usage', data: { inputTokensUsed: 3, outputTokensUsed: 2 } },
        {
          type: 'result',
          data: { text: 'Hello there', end: { reason: 'stop' } },
        },
      ]
    )

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.object).toBe('chat.completion')
    expect(body.id).toBe('chatcmpl-fixed')
    expect(typeof body.created).toBe('number')

    const choice = body.choices[0]

    expect(choice.index).toBe(0)
    expect(choice.finish_reason).toBe('stop')
    // @note OpenAI-required fields the SDK types forced us to emit
    expect(choice.logprobs).toBeNull()
    expect(choice.message).toMatchObject({
      role: 'assistant',
      content: 'Hello there',
      refusal: null,
    })

    // @note usage events are summed across the turn
    expect(body.usage).toEqual({
      prompt_tokens: 13,
      completion_tokens: 7,
      total_tokens: 20,
    })
  })

  it('derives prompt/completion from send + result totals when no usage split is emitted', async () => {
    const response = await callHandler(
      {
        model: 'model/name=gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      },
      [
        // @note the stateless wrapper reports running totals, not an input/output split
        { type: 'sendResult', data: { text: '', usage: { token: 12 } } },
        {
          type: 'result',
          data: {
            text: 'hello',
            usage: { token: 20 },
            end: { reason: 'stop' },
          },
        },
      ]
    )

    const body = await response.json()

    expect(body.usage).toEqual({
      prompt_tokens: 12,
      completion_tokens: 8,
      total_tokens: 20,
    })
  })

  it('surfaces tool calls and nulls content with finish_reason tool_calls', async () => {
    const response = await callHandler(
      {
        model: 'model/name=gpt-4o',
        messages: [{ role: 'user', content: 'weather in Tokyo?' }],
      },
      [
        {
          type: 'message',
          data: {
            type: 'activity',
            meta: {
              activity: {
                type: 'request',
                function: { name: 'get_weather', arguments: { city: 'Tokyo' } },
              },
            },
          },
        },
        { type: 'result', data: { text: '', end: { reason: 'activity' } } },
      ]
    )

    const body = await response.json()
    const choice = body.choices[0]

    expect(choice.finish_reason).toBe('tool_calls')
    expect(choice.message.content).toBeNull()
    expect(choice.message.tool_calls).toHaveLength(1)
    expect(choice.message.tool_calls[0]).toEqual({
      id: 'call_fixed',
      type: 'function',
      // @note arguments must be a JSON string per the OpenAI contract
      function: { name: 'get_weather', arguments: '{"city":"Tokyo"}' },
    })
  })

  it('returns a 500 OpenAI error envelope when the engine errors', async () => {
    const response = await callHandler(
      {
        model: 'bot/id=missing',
        messages: [{ role: 'user', content: 'hi' }],
      },
      [{ type: 'error', data: { code: 'NOT_FOUND', message: 'Bot not found' } }]
    )

    expect(response.status).toBe(500)

    const body = await response.json()

    expect(body).toEqual({
      error: {
        message: 'Bot not found',
        type: 'server_error',
        code: 'NOT_FOUND',
      },
    })
  })
})

describe('handler - streaming response', () => {
  it('streams role, content deltas, a final finish_reason chunk and [DONE]', async () => {
    const response = await callHandler(
      {
        model: 'model/name=gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      },
      [
        { type: 'token', data: { token: 'Hel' } },
        { type: 'token', data: { token: 'lo' } },
        { type: 'result', data: { end: { reason: 'stop' } } },
      ]
    )

    expect(response.headers.get('content-type')).toBe('text/event-stream')

    const events = parseSse(await response.text())

    // opening role chunk
    expect(events[0].object).toBe('chat.completion.chunk')
    expect(events[0].choices[0].delta).toEqual({ role: 'assistant' })

    // content deltas
    expect(events[1].choices[0].delta).toEqual({ content: 'Hel' })
    expect(events[2].choices[0].delta).toEqual({ content: 'lo' })

    // final chunk carries the finish reason and an empty delta
    const finalChunk = events[events.length - 2]

    expect(finalChunk.choices[0].finish_reason).toBe('stop')
    expect(finalChunk.choices[0].delta).toEqual({})

    // terminated by the SSE done marker
    expect(events[events.length - 1]).toBe('[DONE]')
  })

  it('assigns incrementing indices to parallel tool-call deltas', async () => {
    const activity = (name) => ({
      type: 'message',
      data: {
        type: 'activity',
        meta: {
          activity: { type: 'request', function: { name, arguments: {} } },
        },
      },
    })

    const response = await callHandler(
      {
        model: 'model/name=gpt-4o',
        messages: [{ role: 'user', content: 'do two things' }],
        stream: true,
      },
      [
        activity('first'),
        activity('second'),
        { type: 'result', data: { end: { reason: 'activity' } } },
      ]
    )

    const events = parseSse(await response.text())

    const toolDeltas = events
      .filter((event) => event !== '[DONE]')
      .map((event) => event.choices[0].delta.tool_calls)
      .filter(Boolean)
      .flat()

    expect(toolDeltas).toHaveLength(2)
    expect(toolDeltas[0]).toMatchObject({
      index: 0,
      function: { name: 'first' },
    })
    expect(toolDeltas[1]).toMatchObject({
      index: 1,
      function: { name: 'second' },
    })

    // @note the closing chunk maps the engine's `activity` reason to tool_calls
    const finalChunk = events[events.length - 2]

    expect(finalChunk.choices[0].finish_reason).toBe('tool_calls')
  })

  it('emits an inline error envelope when the engine errors mid-stream', async () => {
    const response = await callHandler(
      {
        model: 'model/name=gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      },
      [{ type: 'error', data: { code: 'BOOM', message: 'kaboom' } }]
    )

    // @note status cannot change after a stream starts; the error rides inline
    expect(response.status).toBe(200)

    const events = parseSse(await response.text())
    const errorEvent = events.find((event) => event !== '[DONE]' && event.error)

    expect(errorEvent.error).toEqual({
      message: 'kaboom',
      type: 'server_error',
      code: 'BOOM',
    })
    expect(events[events.length - 1]).toBe('[DONE]')
  })
})
