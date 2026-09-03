// @ts-check

/**
 * Tests for the pre-token streaming retry (`withPreTokenStreamRetry`).
 *
 * A gateway that returns response headers and then goes silent is caught by
 * `withBodyTimeout` as a `TimeoutError` thrown *while the body is being
 * consumed* - downstream of `fetchForStreaming`'s own `withRetry`, which
 * therefore never retries it (: events carry no
 * `fetch.attempts`/`fetch.outcome` tags). These stalls are transient and, while
 * no token has been emitted, safe to re-issue. We assert that:
 *
 *   - a pre-token body stall is transparently retried and recovers,
 *   - a stall *after* the first token is never retried (would duplicate output),
 *   - non-body-stall errors (header-phase timeout, generic failure) pass
 *     straight through, and
 *   - retries are bounded.
 *
 * The fetch layer is mocked to identity wrappers (as in the sibling stream
 * test), so `fetchForStreaming` collapses to the bare `_fetch` mock and we drive
 * the response body directly.
 */
import _fetch, {
  FETCH_PHASE_RESPONSE_BODY,
  FETCH_PHASE_RESPONSE_HEADERS,
  FETCH_PHASE_TAG,
  TIMEOUT_ERROR_NAME,
} from '@/lib/fetch'
import { createChatCompletionStream } from '@/lib/model.provider.openai'

jest.mock('@/lib/fetch', () => {
  const actual = jest.requireActual('@/lib/fetch')

  const fetchFn = jest.fn()

  return {
    ...actual,
    __esModule: true,
    default: fetchFn,
    // @note collapse the composition wrappers to identity so `fetchForStreaming`
    // resolves to the bare `fetchFn` mock and we drive the body directly. The
    // real `isBodyStallTimeout` and tag constants flow through from `actual`, so
    // this exercises the production recogniser - not a duplicated literal.
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

// @note `_fetch` is a jest.fn under the mock above; cast once so the mock
// helpers type-check (mirrors the sibling stream test's `// @ts-ignore` usage).
const fetchMock = /** @type {jest.Mock} */ (/** @type {unknown} */ (_fetch))

const BASE_OPTIONS = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hello' }],
  url: 'https://test.example.com/v1/chat/completions',
  authorization: 'Bearer test-key',
}

/**
 * The annotated error `withBodyTimeout` throws when the body stalls: a
 * `TimeoutError` tagged `fetch.phase: response-body`. This is the one shape
 * `withPreTokenStreamRetry` treats as retryable.
 */
function bodyStallError() {
  return Object.assign(new Error(TIMEOUT_ERROR_NAME), {
    name: TIMEOUT_ERROR_NAME,
    data: { tags: { [FETCH_PHASE_TAG]: FETCH_PHASE_RESPONSE_BODY } },
  })
}

/**
 * A header-phase timeout - already retried at the fetch layer, so it must NOT be
 * retried again here.
 */
function headerTimeoutError() {
  return Object.assign(new Error(TIMEOUT_ERROR_NAME), {
    name: TIMEOUT_ERROR_NAME,
    data: { tags: { [FETCH_PHASE_TAG]: FETCH_PHASE_RESPONSE_HEADERS } },
  })
}

/**
 * A single SSE chunk in OpenAI shape.
 *
 * @param {{ content?: string|null, finishReason?: string|null }} [options]
 */
function chunk(options = {}) {
  const { content = null, finishReason = null } = options

  return {
    choices: [
      {
        finish_reason: finishReason,
        delta: { ...(content !== null ? { content } : {}) },
      },
    ],
  }
}

/**
 * A body that errors before producing any chunk (a pre-token stall).
 *
 * @param {any} error
 */
function stalledBody(error) {
  return new ReadableStream({
    start(controller) {
      controller.error(error)
    },
  })
}

/**
 * A body that emits the given SSE payloads and then errors (a stall *after* some
 * output has streamed).
 *
 * @param {any[]} payloads
 * @param {any} error
 */
function bodyThenError(payloads, error) {
  const encoder = new TextEncoder()

  const frames = payloads.map((p) => `data: ${JSON.stringify(p)}\n\n`)

  let index = 0

  return new ReadableStream({
    pull(controller) {
      if (index < frames.length) {
        controller.enqueue(encoder.encode(frames[index]))
        index++
      } else {
        controller.error(error)
      }
    },
  })
}

/**
 * A normal body that emits the given SSE payloads then `[DONE]`.
 *
 * @param {any[]} payloads
 */
function okBody(payloads) {
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
 * Build the chat stream from (untyped) options - keeps the strict
 * `CreateChatCompletionStreamOptions` shape out of these behavioural tests.
 *
 * @param {any} options
 */
function run(options) {
  return createChatCompletionStream(options)
}

/**
 * @param {AsyncGenerator<any>} stream
 */
async function collect(stream) {
  const events = []

  for await (const event of stream) {
    events.push(event)
  }

  return events
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('withPreTokenStreamRetry', () => {
  it('retries a pre-token body stall and recovers on the next attempt', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, body: stalledBody(bodyStallError()) })
      .mockResolvedValueOnce({
        ok: true,
        body: okBody([
          chunk({ content: 'hello' }),
          chunk({ finishReason: 'stop' }),
        ]),
      })

    const events = await collect(run(BASE_OPTIONS))

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const completions = events
      .filter((e) => e.completion)
      .map((e) => e.completion)

    expect(completions).toEqual(['hello'])
  })

  it('does NOT retry once a token has already been emitted', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: bodyThenError([chunk({ content: 'partial' })], bodyStallError()),
    })

    await expect(collect(run(BASE_OPTIONS))).rejects.toThrow()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry a header-phase timeout (already retried at the fetch layer)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: stalledBody(headerTimeoutError()),
    })

    await expect(collect(run(BASE_OPTIONS))).rejects.toThrow()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry a generic stream error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: stalledBody(new Error('boom')),
    })

    await expect(collect(run(BASE_OPTIONS))).rejects.toThrow('boom')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after the retry budget when the stall never clears', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: stalledBody(bodyStallError()),
    })

    await expect(collect(run(BASE_OPTIONS))).rejects.toThrow()

    // @note initial attempt + STREAM_PRE_TOKEN_STALL_RETRIES (2) = 3 total
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
