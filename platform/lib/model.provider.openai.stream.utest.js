// @ts-check

/**
 * Isolated unit tests for the SSE streaming parser in createChatCompletionStream.
 *
 * These tests mock the fetch layer to inject exact SSE event sequences,
 * verifying the parser logic without hitting real APIs.
 */
import _fetch from '@/lib/fetch'
import { createChatCompletionStream } from '@/lib/model.provider.openai'

jest.mock('@/lib/fetch', () => {
  const actual = jest.requireActual('@/lib/fetch')

  const fetchFn = jest.fn()

  return {
    ...actual,
    __esModule: true,
    default: fetchFn,
    // @note collapse the composition wrappers to identity so `fetchForStreaming`
    // resolves to the bare `fetchFn` mock; everything else (constants, the
    // `isBodyStallTimeout` recogniser) flows through from the real module.
    withRetry: jest.fn((fn) => fn),
    withTimeout: jest.fn((fn) => fn),
    withBodyTimeout: jest.fn((fn) => fn),
  }
})

jest.mock('@/lib/model.context', () => ({
  getSafeModelStore: () => ({}),
}))

jest.mock('@/lib/system.metrics', () => ({
  reportTokenUsage: jest.fn(),
}))

/**
 * Build a ReadableStream that emits SSE-formatted data events from an array of
 * JSON payloads. Each payload becomes one `data: ...\n\n` SSE frame. A final
 * `data: [DONE]\n\n` is appended automatically.
 */
function buildSSEStream(payloads) {
  const encoder = new TextEncoder()

  const frames = payloads
    .map((p) => `data: ${JSON.stringify(p)}\n\n`)
    .concat('data: [DONE]\n\n')

  let index = 0

  return new ReadableStream({
    pull(controller) {
      if (index < frames.length) {
        controller.enqueue(encoder.encode(frames[index]))
        index++
      } else {
        controller.close()
      }
    },
  })
}

/**
 * Helper: make a single SSE chunk with the standard OpenAI shape.
 *
 * @param {{
 *   finishReason?: string|null,
 *   content?: string|null,
 *   reasoning?: string|null,
 *   reasoningContent?: string|null,
 *   functionCall?: Record<string, any>|null,
 *   toolCalls?: any[]|null,
 *   usage?: Record<string, any>|null,
 *   error?: any,
 * }} [options]
 */
function chunk(options = {}) {
  const {
    finishReason = null,
    content = null,
    reasoning = null,
    reasoningContent = null,
    functionCall = null,
    toolCalls = null,
    usage = null,
    error = undefined,
  } = options

  return {
    ...(error !== undefined ? { error } : {}),
    choices: [
      {
        finish_reason: finishReason,
        delta: {
          ...(content !== null ? { content } : {}),
          ...(reasoning !== null ? { reasoning } : {}),
          ...(reasoningContent !== null
            ? { reasoning_content: reasoningContent }
            : {}),
          ...(functionCall !== null ? { function_call: functionCall } : {}),
          ...(toolCalls !== null ? { tool_calls: toolCalls } : {}),
        },
      },
    ],
    ...(usage !== null ? { usage } : {}),
  }
}

/**
 * Collect all yielded events from the stream generator.
 */
async function collectStream(options) {
  const events = []

  for await (const event of createChatCompletionStream(options)) {
    events.push(event)
  }

  return events
}

describe('reasoning_content compatibility', () => {
  it('should normalize reasoning_content deltas as reasoning', async () => {
    mockFetchWithPayloads([
      chunk({ reasoningContent: 'thinking...' }),
      chunk({ finishReason: 'stop', content: 'done' }),
    ])

    const events = await collectStream(BASE_OPTIONS)

    expect(events).toEqual([
      {
        error: undefined,
        finishReason: null,
        completion: null,
        reasoning: 'thinking...',
        usage: null,
        functionCall: null,
        toolCalls: null,
      },
      {
        error: undefined,
        finishReason: 'stop',
        completion: 'done',
        reasoning: null,
        usage: null,
        functionCall: null,
        toolCalls: null,
      },
    ])
  })
})

const BASE_OPTIONS = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hello' }],
  url: 'https://test.example.com/v1/chat/completions',
  authorization: 'Bearer test-key',
}

const BASE_AUDIO = {
  data: 'base64-audio',
  format: {
    encoding: /** @type {'pcm16'} */ ('pcm16'),
    sampleRate: 24000,
    channels: 1,
  },
}

function mockFetchWithPayloads(payloads) {
  // @ts-ignore
  _fetch.mockResolvedValue({
    ok: true,
    body: buildSSEStream(payloads),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('finish reason normalization', () => {
  it('should normalize kebab-case content-filter finish reason from the provider', async () => {
    mockFetchWithPayloads([
      chunk({ finishReason: 'content-filter', content: '' }),
    ])

    const events = await collectStream(BASE_OPTIONS)

    expect(events).toEqual([
      {
        error: undefined,
        finishReason: 'contentFilter',
        completion: '',
        reasoning: null,
        usage: null,
        functionCall: null,
        toolCalls: null,
      },
    ])
  })

  it('should normalize other finish reason from the provider', async () => {
    mockFetchWithPayloads([chunk({ finishReason: 'other', content: '' })])

    const events = await collectStream(BASE_OPTIONS)

    expect(events).toEqual([
      {
        error: undefined,
        finishReason: 'error',
        completion: '',
        reasoning: null,
        usage: null,
        functionCall: null,
        toolCalls: null,
      },
    ])
  })
})

// ---------------------------------------------------------------------------
// H1: Duplicate tool_calls finish_reason (the original bug)
// ---------------------------------------------------------------------------
describe('H1: duplicate tool_calls finish_reason must not duplicate emissions', () => {
  it('should emit tool calls exactly once when provider sends two tool_calls finish chunks', async () => {
    mockFetchWithPayloads([
      // content chunks
      // @ts-ignore
      chunk({ content: "I'll help" }),
      // tool call build-up
      chunk({
        // @ts-ignore
        toolCalls: [
          {
            index: 0,
            id: 'call_1',
            type: 'function',
            function: { name: 'book_meeting', arguments: '' },
          },
        ],
      }),
      chunk({
        // @ts-ignore
        toolCalls: [
          { index: 0, function: { arguments: '{"when":"tonight"}' } },
        ],
      }),
      // first finish chunk with tool_calls
      // @ts-ignore
      chunk({ finishReason: 'tool_calls', content: '' }),
      // second finish chunk with tool_calls + usage (OpenRouter pattern)
      chunk({
        // @ts-ignore
        finishReason: 'tool_calls',
        // @ts-ignore
        content: '',
        // @ts-ignore
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      tools: [
        {
          type: 'function',
          function: {
            name: 'book_meeting',
            description: 'Book a meeting',
            parameters: {
              type: 'object',
              properties: { when: { type: 'string' } },
            },
          },
        },
      ],
    })

    const toolCallEvents = events.filter((e) => e.toolCalls)

    expect(toolCallEvents).toHaveLength(1)
    expect(toolCallEvents[0].toolCalls).toHaveLength(1)
    // @ts-ignore
    expect(toolCallEvents[0].toolCalls[0].function).toEqual({
      name: 'book_meeting',
      arguments: { when: 'tonight' },
    })

    // usage from the second chunk should still be emitted
    const usageEvents = events.filter((e) => e.usage)

    expect(usageEvents.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// H2: Duplicate function_call finish_reason
// ---------------------------------------------------------------------------
describe('H2: duplicate function_call finish_reason must not duplicate emissions', () => {
  it('should emit function call exactly once when provider sends two function_call finish chunks', async () => {
    mockFetchWithPayloads([
      chunk({
        // @ts-ignore
        functionCall: { name: 'book_meeting', arguments: '' },
      }),
      chunk({
        // @ts-ignore
        functionCall: { arguments: '{"when":"tonight"}' },
      }),
      // first finish
      // @ts-ignore
      chunk({ finishReason: 'function_call', content: '' }),
      // second finish with usage
      chunk({
        // @ts-ignore
        finishReason: 'function_call',
        // @ts-ignore
        content: '',
        // @ts-ignore
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      functions: [
        {
          name: 'book_meeting',
          description: 'Book a meeting',
          parameters: {
            type: 'object',
            properties: { when: { type: 'string' } },
          },
        },
      ],
    })

    const fnCallEvents = events.filter((e) => e.functionCall)

    expect(fnCallEvents).toHaveLength(1)
    expect(fnCallEvents[0].functionCall).toEqual({
      name: 'book_meeting',
      arguments: { when: 'tonight' },
    })
  })
})

// ---------------------------------------------------------------------------
// H3: finish_reason "stop" with accumulated tool calls
// ---------------------------------------------------------------------------
describe('H3: finish_reason "stop" with accumulated tool calls', () => {
  it('should correct finish_reason to toolCalls when stop arrives but tool calls were accumulated', async () => {
    mockFetchWithPayloads([
      chunk({
        // @ts-ignore
        toolCalls: [
          {
            index: 0,
            id: 'call_1',
            type: 'function',
            function: { name: 'get_weather', arguments: '' },
          },
        ],
      }),
      chunk({
        // @ts-ignore
        toolCalls: [{ index: 0, function: { arguments: '{"city":"NYC"}' } }],
      }),
      // provider incorrectly sends "stop" instead of "tool_calls"
      // @ts-ignore
      chunk({ finishReason: 'stop', content: '' }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string' } },
            },
          },
        },
      ],
    })

    const toolCallEvents = events.filter((e) => e.toolCalls)

    expect(toolCallEvents).toHaveLength(1)
    expect(toolCallEvents[0].finishReason).toEqual('toolCalls')
    // @ts-ignore
    expect(toolCallEvents[0].toolCalls[0].function).toEqual({
      name: 'get_weather',
      arguments: { city: 'NYC' },
    })
  })

  it('should correct finish_reason to functionCall when stop arrives but function call was accumulated', async () => {
    mockFetchWithPayloads([
      chunk({
        // @ts-ignore
        functionCall: { name: 'get_weather', arguments: '{"city":"NYC"}' },
      }),
      // provider incorrectly sends "stop"
      // @ts-ignore
      chunk({ finishReason: 'stop', content: '' }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      functions: [
        {
          name: 'get_weather',
          description: 'Get weather',
          parameters: {
            type: 'object',
            properties: { city: { type: 'string' } },
          },
        },
      ],
    })

    const fnCallEvents = events.filter((e) => e.functionCall)

    expect(fnCallEvents).toHaveLength(1)
    expect(fnCallEvents[0].finishReason).toEqual('functionCall')
    expect(fnCallEvents[0].functionCall).toEqual({
      name: 'get_weather',
      arguments: { city: 'NYC' },
    })
  })
})

// ---------------------------------------------------------------------------
// H4: Multiple parallel tool calls (index 0 and 1)
// ---------------------------------------------------------------------------
describe('H4: multiple parallel tool calls', () => {
  it('should correctly accumulate and emit two parallel tool calls', async () => {
    mockFetchWithPayloads([
      // first tool call starts
      chunk({
        // @ts-ignore
        toolCalls: [
          {
            index: 0,
            id: 'call_1',
            type: 'function',
            function: { name: 'get_weather', arguments: '' },
          },
        ],
      }),
      // second tool call starts
      chunk({
        // @ts-ignore
        toolCalls: [
          {
            index: 1,
            id: 'call_2',
            type: 'function',
            function: { name: 'get_time', arguments: '' },
          },
        ],
      }),
      // arguments for first
      chunk({
        // @ts-ignore
        toolCalls: [{ index: 0, function: { arguments: '{"city":"NYC"}' } }],
      }),
      // arguments for second
      chunk({
        // @ts-ignore
        toolCalls: [{ index: 1, function: { arguments: '{"tz":"EST"}' } }],
      }),
      // @ts-ignore
      chunk({ finishReason: 'tool_calls', content: '' }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string' } },
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'get_time',
            description: 'Get time',
            parameters: {
              type: 'object',
              properties: { tz: { type: 'string' } },
            },
          },
        },
      ],
    })

    const toolCallEvents = events.filter((e) => e.toolCalls)

    expect(toolCallEvents).toHaveLength(1)
    expect(toolCallEvents[0].toolCalls).toHaveLength(2)

    // @ts-ignore
    const sorted = [...toolCallEvents[0].toolCalls].sort(
      (a, b) => a.index - b.index
    )

    expect(sorted[0].function).toEqual({
      name: 'get_weather',
      arguments: { city: 'NYC' },
    })
    expect(sorted[1].function).toEqual({
      name: 'get_time',
      arguments: { tz: 'EST' },
    })
  })
})

// ---------------------------------------------------------------------------
// H5: Malformed JSON arguments in tool calls
// ---------------------------------------------------------------------------
describe('H5: malformed JSON arguments', () => {
  it('should expose an error and empty object when tool call arguments are not valid JSON', async () => {
    mockFetchWithPayloads([
      chunk({
        // @ts-ignore
        toolCalls: [
          {
            index: 0,
            id: 'call_1',
            type: 'function',
            function: { name: 'do_something', arguments: '' },
          },
        ],
      }),
      chunk({
        // @ts-ignore
        toolCalls: [{ index: 0, function: { arguments: '{broken json' } }],
      }),
      // @ts-ignore
      chunk({ finishReason: 'tool_calls', content: '' }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      tools: [
        {
          type: 'function',
          function: {
            name: 'do_something',
            description: 'Do something',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    })

    const toolCallEvents = events.filter((e) => e.toolCalls)

    expect(toolCallEvents).toHaveLength(1)
    // @ts-ignore
    expect(toolCallEvents[0].toolCalls[0].function.name).toEqual('do_something')
    // @ts-ignore
    expect(toolCallEvents[0].toolCalls[0].function.arguments).toEqual({})
    // @note malformed arguments now carry an error so the conversation layer can
    // surface it back to the model instead of silently calling with {}
    // @ts-ignore
    expect(toolCallEvents[0].toolCalls[0].function.error).toMatch(
      /Malformed arguments/
    )
  })

  it('should expose an error and empty object when function call arguments are not valid JSON', async () => {
    mockFetchWithPayloads([
      chunk({
        // @ts-ignore
        functionCall: { name: 'do_something', arguments: '{not valid' },
      }),
      // @ts-ignore
      chunk({ finishReason: 'function_call', content: '' }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      functions: [
        {
          name: 'do_something',
          description: 'Do something',
          parameters: { type: 'object', properties: {} },
        },
      ],
    })

    const fnCallEvents = events.filter((e) => e.functionCall)

    expect(fnCallEvents).toHaveLength(1)
    expect(fnCallEvents[0].functionCall?.name).toEqual('do_something')
    expect(fnCallEvents[0].functionCall?.arguments).toEqual({})
    // @note malformed arguments now carry an error so the conversation layer can
    // surface it back to the model instead of silently calling with {}
    expect(fnCallEvents[0].functionCall?.error).toMatch(/Malformed arguments/)
  })

  it('should treat an empty argument string from a zero-parameter tool as {} without an error', async () => {
    // @note a tool that takes no parameters (e.g. install_shell_tools) streams
    // an empty argument string and never sends any argument deltas. This is a
    // valid empty call, NOT malformed - it must not be rejected with the
    // "Unexpected end of JSON input" that JSON.parse("") throws.
    mockFetchWithPayloads([
      chunk({
        // @ts-ignore
        toolCalls: [
          {
            index: 0,
            id: 'call_1',
            type: 'function',
            function: { name: 'install_shell_tools', arguments: '' },
          },
        ],
      }),
      // @ts-ignore
      chunk({ finishReason: 'tool_calls', content: '' }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      tools: [
        {
          type: 'function',
          function: {
            name: 'install_shell_tools',
            description: 'Install shell tools',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
    })

    const toolCallEvents = events.filter((e) => e.toolCalls)

    expect(toolCallEvents).toHaveLength(1)
    // @ts-ignore
    expect(toolCallEvents[0].toolCalls[0].function.name).toEqual(
      'install_shell_tools'
    )
    // @ts-ignore
    expect(toolCallEvents[0].toolCalls[0].function.arguments).toEqual({})
    // @ts-ignore
    expect(toolCallEvents[0].toolCalls[0].function.error).toBeUndefined()
  })

  it('should treat an empty argument string from a zero-parameter function as {} without an error', async () => {
    mockFetchWithPayloads([
      chunk({
        // @ts-ignore
        functionCall: { name: 'install_shell_tools', arguments: '' },
      }),
      // @ts-ignore
      chunk({ finishReason: 'function_call', content: '' }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      functions: [
        {
          name: 'install_shell_tools',
          description: 'Install shell tools',
          parameters: { type: 'object', properties: {} },
        },
      ],
    })

    const fnCallEvents = events.filter((e) => e.functionCall)

    expect(fnCallEvents).toHaveLength(1)
    expect(fnCallEvents[0].functionCall?.name).toEqual('install_shell_tools')
    expect(fnCallEvents[0].functionCall?.arguments).toEqual({})
    expect(fnCallEvents[0].functionCall?.error).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// H6: Usage-only chunk after "stop"
// ---------------------------------------------------------------------------
describe('H6: usage-only final chunk after stop', () => {
  it('should emit usage from a trailing chunk that has no finish_reason', async () => {
    mockFetchWithPayloads([
      // @ts-ignore
      chunk({ content: 'Hello!' }),
      // @ts-ignore
      chunk({ finishReason: 'stop', content: '' }),
      // trailing usage-only chunk (OpenAI stream_options pattern)
      chunk({
        // @ts-ignore
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      includeUsage: true,
    })

    const usageEvents = events.filter((e) => e.usage)

    expect(usageEvents).toHaveLength(1)
    expect(usageEvents[0].usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    })
  })
})

// ---------------------------------------------------------------------------
// H7: Tool call function name split across chunks
// ---------------------------------------------------------------------------
describe('H7: function name split across chunks', () => {
  it('should concatenate tool call function name fragments correctly', async () => {
    mockFetchWithPayloads([
      chunk({
        // @ts-ignore
        toolCalls: [
          {
            index: 0,
            id: 'call_1',
            type: 'function',
            function: { name: 'book_', arguments: '' },
          },
        ],
      }),
      // name continuation
      chunk({
        // @ts-ignore
        toolCalls: [{ index: 0, function: { name: 'meeting' } }],
      }),
      chunk({
        // @ts-ignore
        toolCalls: [{ index: 0, function: { arguments: '{"when":"now"}' } }],
      }),
      // @ts-ignore
      chunk({ finishReason: 'tool_calls', content: '' }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      tools: [
        {
          type: 'function',
          function: {
            name: 'book_meeting',
            description: 'Book a meeting',
            parameters: {
              type: 'object',
              properties: { when: { type: 'string' } },
            },
          },
        },
      ],
    })

    const toolCallEvents = events.filter((e) => e.toolCalls)

    expect(toolCallEvents).toHaveLength(1)
    // @ts-ignore
    expect(toolCallEvents[0].toolCalls[0].function.name).toEqual('book_meeting')
    // @ts-ignore
    expect(toolCallEvents[0].toolCalls[0].function.arguments).toEqual({
      when: 'now',
    })
  })

  it('should concatenate function call name fragments correctly', async () => {
    mockFetchWithPayloads([
      chunk({
        // @ts-ignore
        functionCall: { name: 'book_', arguments: '' },
      }),
      chunk({
        // @ts-ignore
        functionCall: { name: 'meeting' },
      }),
      chunk({
        // @ts-ignore
        functionCall: { arguments: '{"when":"now"}' },
      }),
      // @ts-ignore
      chunk({ finishReason: 'function_call', content: '' }),
    ])

    const events = await collectStream({
      ...BASE_OPTIONS,
      functions: [
        {
          name: 'book_meeting',
          description: 'Book a meeting',
          parameters: {
            type: 'object',
            properties: { when: { type: 'string' } },
          },
        },
      ],
    })

    const fnCallEvents = events.filter((e) => e.functionCall)

    expect(fnCallEvents).toHaveLength(1)
    // @ts-ignore
    expect(fnCallEvents[0].functionCall.name).toEqual('book_meeting')
    // @ts-ignore
    expect(fnCallEvents[0].functionCall.arguments).toEqual({ when: 'now' })
  })
})

describe('malformed stream JSON error handling', () => {
  it('should capture malformed JSON in SSE stream', async () => {
    const encoder = new TextEncoder()

    // Mock a response with malformed JSON in one of the SSE frames. This can't
    // go through buildSSEStream/mockFetchWithPayloads because those JSON encode
    // every payload, so we hand-build the raw frames here.
    const frames = [
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
      'data: {invalid json here}\n\n', // malformed
      'data: [DONE]\n\n',
    ]

    // @ts-ignore
    _fetch.mockResolvedValueOnce({
      ok: true,
      body: {
        async *[Symbol.asyncIterator]() {
          for (const frame of frames) {
            yield encoder.encode(frame)
          }
        },
      },
    })

    /** @type {Error|null} */
    let caughtError = null

    try {
      await collectStream(BASE_OPTIONS)
    } catch (error) {
      caughtError = error
    }

    // Should have caught the error and thrown it
    expect(caughtError).toBeDefined()

    if (!(caughtError instanceof Error)) {
      throw new Error('Expected malformed stream processing to throw an Error')
    }

    expect(caughtError.message).toMatch(/Failed to parse stream event/)
    // the offending frame's raw data is included (truncated) for diagnostics
    expect(caughtError.message).toContain('{invalid json here}')
  })
})
