import {
  CONTEXT_MODEL_TAG,
  FETCH_PHASE_RESPONSE_BODY,
  FETCH_PHASE_RESPONSE_HEADERS,
  FETCH_PHASE_TAG,
  FetchError,
  TIMEOUT_ERROR_NAME,
  anySignal,
  download,
  fetch,
  getFetchError,
  isBodyStallTimeout,
  jsonl,
  withBodyTimeout,
  withLimit,
  withRetry,
  withTimeout,
} from './index'

jest.mock('@chatbotkit-dev/http-codes', () => ({
  statusToMessageMap: {
    400: 'Bad Request',
    401: 'Unauthorized',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  },
  statusToCodeMap: {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    404: 'NOT_FOUND',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
  },
}))

describe('withTimeout', () => {
  it('must timeout', async () => {
    const fetch = withTimeout(
      async (url, { signal }) => {
        return new Promise((resolve, reject) => {
          // We expect to receive an abort event from the timeout handler, which
          // we use to reject the promise.

          signal.addEventListener('abort', () => {
            reject(new Error(signal.reason))
          })
        })
      },
      { timeout: 1000 }
    )

    await expect(async () => {
      await fetch()
    }).rejects.toThrow()
  })

  it('attaches diagnostics (model, url, timeout budget) to the TimeoutError', async () => {
    const fetch = withTimeout(
      async (url, { signal }) => {
        // @note mirror undici: a timed-out fetch rejects with the abort reason
        // (the TimeoutError we passed to abort), not a wrapped Error
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason))
        })
      },
      { timeout: 5 }
    )

    let error

    try {
      await fetch('https://gateway.example/v1/chat/completions', {
        meta: { model: 'test-model' },
      })
    } catch (e) {
      error = e
    }

    expect(error?.name).toBe(TIMEOUT_ERROR_NAME)
    expect(error?.data?.tags?.[CONTEXT_MODEL_TAG]).toBe('test-model')
    expect(error?.data?.tags?.[FETCH_PHASE_TAG]).toBe(
      FETCH_PHASE_RESPONSE_HEADERS
    )
    // @note a header-phase timeout is retried at the fetch layer, so the
    // streaming recogniser must NOT claim it as a (downstream) body stall
    expect(isBodyStallTimeout(error)).toBe(false)
    expect(error?.data?.extra?.fetch?.url).toBe(
      'https://gateway.example/v1/chat/completions'
    )
    expect(error?.data?.extra?.fetch?.timeoutMs).toBe(5)
    expect(error?.data?.extra?.fetch?.model).toBe('test-model')
  })

  if (process.env.SLOW_TESTS) {
    it('httpstat: must timeout', async () => {
      let error

      const f = withTimeout(fetch, { timeout: 5000 })

      try {
        await f('https://httpstat.us/504?sleep=60000')
      } catch (e) {
        error = e
      }

      expect(error).toBeTruthy()
    })
  }
})

describe('withBodyTimeout', () => {
  const encoder = new TextEncoder()

  /**
   * Build an ok Response that streams the given chunks and closes immediately.
   *
   * @param {string[]} chunks
   * @param {{ status?: number }} [opts]
   * @returns {Response}
   */
  function makeStreamingResponse(chunks, { status = 200 } = {}) {
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }

        controller.close()
      },
    })

    return new Response(stream, { status })
  }

  /**
   * Build an ok Response whose headers are delivered but whose body never emits
   * a byte and never closes - a stalled upstream.
   *
   * @returns {Response}
   */
  function makeStallingResponse() {
    const stream = new ReadableStream({
      start() {
        // @note never enqueue, never close
      },
    })

    return new Response(stream, { status: 200 })
  }

  /**
   * @param {Response} response
   * @returns {Promise<string>}
   */
  async function readAll(response) {
    const decoder = new TextDecoder()

    let out = ''

    // @ts-ignore - body is async-iterable (polyfilled in @/lib/fetch)
    for await (const chunk of response.body) {
      out += decoder.decode(chunk)
    }

    return out
  }

  it('times out and attributes the stall when the body goes silent', async () => {
    jest.useFakeTimers()

    try {
      const fetch = withBodyTimeout(async () => makeStallingResponse(), {
        bodyTimeout: 1000,
      })

      const response = await fetch(
        'https://gateway.example/v1/chat/completions',
        { meta: { model: 'test-model' } }
      )

      let settled = false

      // @note consume in the background; it must reject once the idle timer fires
      const consume = (async () => {
        try {
          await readAll(response)

          return null
        } catch (e) {
          return e
        } finally {
          settled = true
        }
      })()

      // @note just shy of the deadline: still streaming, nothing settled
      await jest.advanceTimersByTimeAsync(999)

      expect(settled).toBe(false)

      // @note crossing the deadline fires the idle timer
      await jest.advanceTimersByTimeAsync(1)

      const error = await consume

      expect(settled).toBe(true)
      expect(error?.name).toBe(TIMEOUT_ERROR_NAME)
      expect(error?.data?.tags?.[FETCH_PHASE_TAG]).toBe(FETCH_PHASE_RESPONSE_BODY)
      expect(error?.data?.tags?.[CONTEXT_MODEL_TAG]).toBe('test-model')
      // @note the streaming layer keys its retry decision off exactly this
      // error shape, so assert the recogniser agrees - this ties the producer
      // (withBodyTimeout) to the consumer (isBodyStallTimeout) end to end
      expect(isBodyStallTimeout(error)).toBe(true)
      expect(error?.data?.extra?.fetch?.bodyTimeoutMs).toBe(1000)
      expect(error?.data?.extra?.fetch?.url).toBe(
        'https://gateway.example/v1/chat/completions'
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('resets the idle timer on each chunk so a steady stream outlives the timeout', async () => {
    jest.useFakeTimers()

    try {
      const gap = 800

      const bodyTimeout = 1000

      const count = 5

      let i = 0

      // @note deliver one chunk per pull, each `gap` (< bodyTimeout) after the
      // previous read. Total elapsed ((count + 1) * gap = 4800ms) far exceeds
      // bodyTimeout, so only a correct per-chunk reset keeps the stream alive; a
      // broken reset would fire at t=1000ms (mid second gap) and reject.
      // @note pull returns a promise that settles only after the delayed
      // delivery, so the stream waits between pulls instead of re-invoking pull
      // synchronously (which would schedule overlapping timers and double-close)
      const source = new ReadableStream({
        pull(controller) {
          return new Promise((resolve) => {
            if (i < count) {
              const value = String(i++)

              setTimeout(() => {
                controller.enqueue(encoder.encode(value))

                resolve()
              }, gap)
            } else {
              setTimeout(() => {
                controller.close()

                resolve()
              }, gap)
            }
          })
        },
      })

      const fetch = withBodyTimeout(
        async () => new Response(source, { status: 200 }),
        { bodyTimeout }
      )

      const response = await fetch('https://gateway.example')

      const collected = readAll(response)

      await jest.advanceTimersByTimeAsync((count + 1) * gap + 50)

      await expect(collected).resolves.toBe('01234')
    } finally {
      jest.useRealTimers()
    }
  })

  it('preserves status, statusText, and headers on the wrapped response', async () => {
    const original = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('hi'))

          controller.close()
        },
      }),
      {
        status: 206,
        statusText: 'Partial Content',
        headers: { 'content-type': 'text/event-stream', 'x-trace': 'abc' },
      }
    )

    const fetch = withBodyTimeout(async () => original, { bodyTimeout: 1000 })

    const response = await fetch('https://gateway.example')

    // @note an ok response IS wrapped (new object), but its metadata must carry
    // over verbatim - downstream relies on status and content-type
    expect(response).not.toBe(original)
    expect(response.status).toBe(206)
    expect(response.statusText).toBe('Partial Content')
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('x-trace')).toBe('abc')

    await expect(readAll(response)).resolves.toBe('hi')
  })

  it('does not wrap non-ok responses', async () => {
    const original = makeStreamingResponse(['boom'], { status: 500 })

    const fetch = withBodyTimeout(async () => original, { bodyTimeout: 10 })

    await expect(fetch('https://gateway.example')).resolves.toBe(original)
  })

  it('is a pass-through when the timeout is disabled', async () => {
    const original = makeStreamingResponse(['x'])

    const fetch = withBodyTimeout(async () => original, { bodyTimeout: 0 })

    await expect(fetch('https://gateway.example')).resolves.toBe(original)
  })

  it('lets a per-call bodyTimeout override the default', async () => {
    jest.useFakeTimers()

    try {
      // @note default disables the guard; the per-call option must re-enable it
      const fetch = withBodyTimeout(async () => makeStallingResponse(), {
        bodyTimeout: 0,
      })

      const response = await fetch('https://gateway.example', {
        bodyTimeout: 500,
      })

      const consume = (async () => {
        try {
          await readAll(response)

          return null
        } catch (e) {
          return e
        }
      })()

      await jest.advanceTimersByTimeAsync(500)

      const error = await consume

      expect(error?.name).toBe('TimeoutError')
      expect(error?.data?.extra?.fetch?.bodyTimeoutMs).toBe(500)
    } finally {
      jest.useRealTimers()
    }
  })

  it('cancels the upstream body when the consumer stops early', async () => {
    let cancelled = false

    const encoder = new TextEncoder()

    const source = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('one'))

        // @note never close - the consumer will break out before the end
      },

      cancel() {
        cancelled = true
      },
    })

    const fetch = withBodyTimeout(
      async () => new Response(source, { status: 200 }),
      { bodyTimeout: 1000 }
    )

    const response = await fetch('https://gateway.example')

    let first

    // @ts-ignore - body is async-iterable (polyfilled in @/lib/fetch)
    for await (const chunk of response.body) {
      first = new TextDecoder().decode(chunk)

      break
    }

    // @note let the cancel propagate through guarded -> source
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(first).toBe('one')
    expect(cancelled).toBe(true)
  })

  it('propagates a mid-stream source error unchanged (not masked as a timeout)', async () => {
    const encoder = new TextEncoder()

    let delivered = false

    // @note deliver one chunk, then error on the next pull. Erroring
    // synchronously right after enqueue would reset the queue (spec) and drop
    // the chunk, so we split it across two pulls to mimic a real mid-stream cut.
    const source = new ReadableStream({
      pull(controller) {
        if (!delivered) {
          controller.enqueue(encoder.encode('partial'))

          delivered = true

          return
        }

        controller.error(new Error('terminated-ish'))
      },
    })

    const fetch = withBodyTimeout(
      async () => new Response(source, { status: 200 }),
      { bodyTimeout: 1000 }
    )

    const response = await fetch('https://gateway.example')

    let collected = ''

    let error

    try {
      // @ts-ignore - body is async-iterable (polyfilled in @/lib/fetch)
      for await (const chunk of response.body) {
        collected += new TextDecoder().decode(chunk)
      }
    } catch (e) {
      error = e
    }

    expect(collected).toBe('partial')
    expect(error?.name).not.toBe(TIMEOUT_ERROR_NAME)
    expect(isBodyStallTimeout(error)).toBe(false)
    expect(error?.message).toBe('terminated-ish')
  })
})

describe('isBodyStallTimeout', () => {
  it('matches a body-phase TimeoutError', () => {
    expect(
      isBodyStallTimeout({
        name: TIMEOUT_ERROR_NAME,
        data: { tags: { [FETCH_PHASE_TAG]: FETCH_PHASE_RESPONSE_BODY } },
      })
    ).toBe(true)
  })

  it('rejects a header-phase TimeoutError (retried at the fetch layer)', () => {
    expect(
      isBodyStallTimeout({
        name: TIMEOUT_ERROR_NAME,
        data: { tags: { [FETCH_PHASE_TAG]: FETCH_PHASE_RESPONSE_HEADERS } },
      })
    ).toBe(false)
  })

  it('rejects a non-timeout error that happens to carry the body-phase tag', () => {
    expect(
      isBodyStallTimeout({
        name: 'FetchError',
        data: { tags: { [FETCH_PHASE_TAG]: FETCH_PHASE_RESPONSE_BODY } },
      })
    ).toBe(false)
  })

  it('rejects a bare error, null, and undefined without throwing', () => {
    expect(isBodyStallTimeout(new Error('boom'))).toBe(false)
    expect(isBodyStallTimeout(null)).toBe(false)
    expect(isBodyStallTimeout(undefined)).toBe(false)
  })
})

describe('withRetry', () => {
  it('must retry without timeouts', async () => {
    let count = 0

    const fetch = withRetry(
      async () => {
        return new Promise((resolve, reject) => {
          count += 1

          reject(new Error(`Error`))
        })
      },
      { retries: 5, retryDelay: 1 }
    )

    await expect(async () => {
      await fetch()
    }).rejects.toThrow()

    expect(count).toEqual(6)
  })

  it('must retry timeouts', async () => {
    let count = 0

    const fetch = withRetry(
      withTimeout(
        async (url, { signal }) => {
          return new Promise((resolve, reject) => {
            count += 1

            // We expect to receive an abort event from the timeout handler,
            // which we use to reject the promise.

            signal.addEventListener('abort', () => {
              reject(new Error(signal.reason))
            })
          })
        },
        { timeout: 1 }
      ),
      { retries: 5, retryDelay: 1, retryTimeout: true }
    )

    await expect(async () => {
      await fetch()
    }).rejects.toThrow()

    expect(count).toEqual(6)
  })

  it('records attempt count and elapsed time after exhausting timeout retries', async () => {
    let count = 0

    const fetch = withRetry(
      withTimeout(
        async (url, { signal }) => {
          return new Promise((_resolve, reject) => {
            count += 1

            signal.addEventListener('abort', () => reject(signal.reason))
          })
        },
        { timeout: 1 }
      ),
      { retries: 3, retryDelay: 1, retryTimeout: true }
    )

    let error

    try {
      await fetch('https://gateway.example/v1/chat/completions', {
        meta: { model: 'test-model' },
      })
    } catch (e) {
      error = e
    }

    expect(count).toEqual(4) // 1 initial + 3 retries

    expect(error?.name).toBe('TimeoutError')
    expect(error?.data?.tags?.['fetch.outcome']).toBe('timeout')
    expect(error?.data?.tags?.['fetch.attempts']).toBe('4')
    expect(error?.data?.extra?.fetchRetry?.attempts).toBe(4)
    expect(error?.data?.extra?.fetchRetry?.maxAttempts).toBe(4)
    expect(typeof error?.data?.extra?.fetchRetry?.elapsedMs).toBe('number')

    // @note the model context set by withTimeout survives the retry annotation
    expect(error?.data?.tags?.['context.model']).toBe('test-model')
  })

  it('records a single attempt when retryTimeout is disabled', async () => {
    let count = 0

    const fetch = withRetry(
      withTimeout(
        async (url, { signal }) => {
          return new Promise((_resolve, reject) => {
            count += 1

            signal.addEventListener('abort', () => reject(signal.reason))
          })
        },
        { timeout: 1 }
      ),
      { retries: 5, retryDelay: 1, retryTimeout: false }
    )

    let error

    try {
      await fetch('https://gateway.example/v1/chat/completions')
    } catch (e) {
      error = e
    }

    expect(count).toEqual(1) // not retried because retryTimeout is false
    expect(error?.data?.tags?.['fetch.attempts']).toBe('1')
    expect(error?.data?.extra?.fetchRetry?.attempts).toBe(1)
  })

  if (process.env.SLOW_TESTS) {
    it('httpstat: must retry timeouts', async () => {
      const f = withRetry(withTimeout(fetch, { timeout: 5000 }), {
        retries: 5,
        retryDelay: 1,
        retryTimeout: true,
      })

      let error

      try {
        await f('https://httpstat.us/504?sleep=60000')
      } catch (e) {
        error = e
      }

      expect(error).toBeTruthy()
    })
  }
})

describe('jsonl', () => {
  it('should parse JSON lines correctly', async () => {
    const input = '{"name": "Alice"}\n{"name": "Bob"}\n{"name": "Charlie"}'

    const body = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode(input))
        controller.close()
      },
    })

    const result = []

    for await (const obj of jsonl(body)) {
      result.push(obj)
    }

    expect(result).toEqual([
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Charlie' },
    ])
  })

  it('should parse JSON lines correctly when last line does not end with newline character', async () => {
    const input =
      '{"name": "Alice"}\n{"name": "Bob"}\n{"name": "Charlie"}\n{"name": "Dave"}'

    const body = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode(input))
        controller.close()
      },
    })

    const result = []

    for await (const obj of jsonl(body)) {
      result.push(obj)
    }

    expect(result).toEqual([
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Charlie' },
      { name: 'Dave' },
    ])
  })
})

describe('getFetchError', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('with valid JSON error response', () => {
    it('should create FetchError with nested error object', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              message: 'Custom error message',
              code: 'CUSTOM_ERROR_CODE',
            },
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result).toBeInstanceOf(FetchError)
      expect(result.message).toBe('Custom error message')
      expect(result.code).toBe('CUSTOM_ERROR_CODE')
      expect(result.meta).toBeUndefined()
    })

    it('should create FetchError with flat error object', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Resource not found',
            code: 'NOT_FOUND_RESOURCE',
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result).toBeInstanceOf(FetchError)
      expect(result.message).toBe('Resource not found')
      expect(result.code).toBe('NOT_FOUND_RESOURCE')
    })

    it('should prefer nested error over flat error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Flat message',
            code: 'FLAT_CODE',
            error: {
              message: 'Nested message',
              code: 'NESTED_CODE',
            },
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Nested message')
      expect(result.code).toBe('NESTED_CODE')
    })

    it('should handle partial nested error objects', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Flat message',
            code: 'FLAT_CODE',
            error: {
              message: 'Nested message only',
              // no code in nested error
            },
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Nested message only')
      expect(result.code).toBe('FLAT_CODE')
    })

    it('should surface a string `error` field', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest
          .fn()
          .mockResolvedValue(JSON.stringify({ error: 'The value is invalid' })),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('The value is invalid')
      expect(result.code).toBe('BAD_REQUEST')
    })

    it('should surface detail from an `errors` array', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            errors: ['person_seniorities: c_level not allowed'],
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toContain('c_level not allowed')
      expect(result.code).toBe('BAD_REQUEST')
    })

    it('should prefer a flat `message` over a string `error` and `errors` array', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Primary message',
            error: 'secondary error string',
            errors: ['secondary detail'],
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Primary message')
    })
  })

  describe('with invalid JSON response', () => {
    it('should fallback to status mappings when JSON parsing fails', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not Found - invalid JSON'),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Not Found')
      expect(result.code).toBe('NOT_FOUND')
    })

    it('should fallback to 500 mappings for unknown status codes', async () => {
      const mockResponse = {
        ok: false,
        status: 999, // unknown status
        text: jest.fn().mockResolvedValue('Unknown error'),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Internal Server Error')
      expect(result.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle empty response text', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue(''),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Internal Server Error')
      expect(result.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle null response text', async () => {
      const mockResponse = {
        ok: false,
        status: 502,
        text: jest.fn().mockResolvedValue(null),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Bad Gateway')
      expect(result.code).toBe('BAD_GATEWAY')
    })
  })

  describe('with meta parameter', () => {
    it('should pass meta parameter to FetchError constructor', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Test error',
            code: 'TEST_CODE',
          })
        ),
      }

      const meta = { url: 'https://api.example.com', requestId: 'req-123' }

      const result = await getFetchError(mockResponse, meta)

      expect(result.name).toBe(
        'FetchError({"url":"https://api.example.com","requestId":"req-123"})'
      )
    })

    it('should handle undefined meta parameter', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Test error',
            code: 'TEST_CODE',
          })
        ),
      }

      const result = await getFetchError(mockResponse, undefined)

      expect(result.name).toBe('FetchError')
    })

    it('should handle null meta parameter', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Test error',
            code: 'TEST_CODE',
          })
        ),
      }

      const result = await getFetchError(mockResponse, null)

      expect(result.name).toBe('FetchError')
    })
  })

  describe('fallback behavior', () => {
    it('should fallback through all message options correctly', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue(JSON.stringify({})), // empty JSON
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Unauthorized')
      expect(result.code).toBe('UNAUTHORIZED')
    })

    it('should fallback to 500 when all status lookups fail', async () => {
      const mockResponse = {
        ok: false,
        status: 999,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            // no message or code fields
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Internal Server Error')
      expect(result.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle null and undefined values in JSON gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: null,
            code: undefined,
            error: {
              message: undefined,
              code: null,
            },
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Bad Request')
      expect(result.code).toBe('BAD_REQUEST')
    })
  })

  describe('edge cases', () => {
    it('should handle response.text() throwing an error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockRejectedValue(new Error('Failed to read response')),
      }

      await expect(getFetchError(mockResponse)).rejects.toThrow(
        'Failed to read response'
      )
    })

    it('should handle very large JSON responses', async () => {
      const largeMessage = 'x'.repeat(10000)
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: largeMessage,
            code: 'LARGE_ERROR',
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe(largeMessage)
      expect(result.code).toBe('LARGE_ERROR')
    })

    it('should handle JSON with unexpected structure', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            error: 'not an object',
            message: ['array', 'instead', 'of', 'string'],
            code: 123,
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('array,instead,of,string')
      // @note numeric json codes are ignored in favor of string codes from statusToCodeMap
      expect(result.code).toBe('BAD_REQUEST')
    })

    it('should handle deeply nested error objects', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              nested: {
                message: 'Deep message',
                code: 'DEEP_CODE',
              },
              message: 'Shallow message',
              code: 'SHALLOW_CODE',
            },
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Shallow message')
      expect(result.code).toBe('SHALLOW_CODE')
    })

    it('should normalize google api numeric error codes to string codes', async () => {
      // google apis return numeric codes in the error body (e.g. {"error": {"code": 404, "message": "..."}})
      // these must map to string codes so isUnknownError() recognizes them as known errors
      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            error: {
              code: 404,
              message: 'Requested entity was not found.',
              status: 'NOT_FOUND',
            },
          })
        ),
      }

      const result = await getFetchError(mockResponse)

      expect(result.message).toBe('Requested entity was not found.')
      // @note must be the string 'NOT_FOUND', not the number 404, so isUnknownError() works
      expect(result.code).toBe('NOT_FOUND')
    })
  })

  describe('assertion behavior', () => {
    it('should assert that response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('{}'),
      }

      const result = await getFetchError(mockResponse)

      expect(result).toBeInstanceOf(FetchError)
      expect(result.message).toBe('Bad Request')
    })

    // @todo add test for when response.ok is true - should fail assertion
    test('should throw assertion error when response is ok', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}'),
      }

      await expect(getFetchError(mockResponse)).rejects.toThrow('Response ok')
    })
  })

  describe('function integration', () => {
    it('should work correctly with debug logging enabled', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('{"message":"Not found"}'),
      }

      const result = await getFetchError(mockResponse)

      expect(result).toBeInstanceOf(FetchError)
      expect(result.message).toBe('Not found')
      expect(result.code).toBe('NOT_FOUND')
    })
  })
})

describe('download', () => {
  /**
   * Helper to create a mock ReadableStream
   * @param {Uint8Array[]} chunks
   */
  function createMockStream(chunks) {
    let index = 0

    return {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) {
            return { done: true, value: undefined }
          }

          return { done: false, value: chunks[index++] }
        },
        releaseLock: jest.fn(),
      }),
    }
  }

  describe('basic functionality', () => {
    it('should download response within size limit', async () => {
      const testData = new TextEncoder().encode('Hello, World!')
      const mockResponse = {
        body: createMockStream([testData]),
      }

      const maxSize = 100 // 100 bytes
      const result = await download(mockResponse, maxSize)

      expect(result).toHaveProperty('byteLength')
      expect(result.byteLength).toBe(testData.length)

      // Verify the content
      const decoder = new TextDecoder()

      expect(decoder.decode(result)).toBe('Hello, World!')
    })

    it('should handle multiple small chunks', async () => {
      const chunks = []

      for (let i = 0; i < 10; i++) {
        chunks.push(new TextEncoder().encode(`chunk${i}`))
      }

      const mockResponse = {
        body: createMockStream(chunks),
      }

      const maxSize = 1024
      const result = await download(mockResponse, maxSize)

      expect(result).toHaveProperty('byteLength')

      const decoder = new TextDecoder()
      const text = decoder.decode(result)

      expect(text).toBe(
        'chunk0chunk1chunk2chunk3chunk4chunk5chunk6chunk7chunk8chunk9'
      )
    })
  })

  describe('size limit enforcement', () => {
    it('should truncate when single chunk exceeds limit', async () => {
      const largeData = new TextEncoder().encode(
        'This is a very long string that exceeds the limit'
      )
      const mockResponse = {
        body: createMockStream([largeData]),
      }

      const maxSize = 10 // Only allow 10 bytes
      const result = await download(mockResponse, maxSize)

      expect(result).toHaveProperty('byteLength')
      expect(result.byteLength).toBe(maxSize)

      const decoder = new TextDecoder()

      expect(decoder.decode(result)).toBe('This is a ')
    })

    it('should stop reading when cumulative size exceeds limit', async () => {
      const chunk1 = new TextEncoder().encode('Hello, ') // 7 bytes
      const chunk2 = new TextEncoder().encode('World!') // 6 bytes
      const chunk3 = new TextEncoder().encode(' Extra data') // Should not be included
      const mockResponse = {
        body: createMockStream([chunk1, chunk2, chunk3]),
      }

      const maxSize = 10 // Only allow 10 bytes total
      const result = await download(mockResponse, maxSize)

      expect(result).toHaveProperty('byteLength')
      expect(result.byteLength).toBe(maxSize)

      const decoder = new TextDecoder()

      expect(decoder.decode(result)).toBe('Hello, Wor') // 7 + 3 = 10 bytes
    })

    it('should handle exact boundary match', async () => {
      const chunk1 = new Uint8Array(50)
      const chunk2 = new Uint8Array(50)
      const chunk3 = new Uint8Array(10) // Should not be included
      const mockResponse = {
        body: createMockStream([chunk1, chunk2, chunk3]),
      }

      const maxSize = 100
      const result = await download(mockResponse, maxSize)

      expect(result.byteLength).toBe(maxSize)
    })

    it('should handle chunk that partially exceeds limit', async () => {
      const chunk1 = new Uint8Array(300 * 1024) // 300 KB
      const chunk2 = new Uint8Array(300 * 1024) // 300 KB - will be truncated
      const mockResponse = {
        body: createMockStream([chunk1, chunk2]),
      }

      const maxSize = 0.5 * 1024 * 1024 // 0.5 MB (512 KB)
      const result = await download(mockResponse, maxSize)

      expect(result.byteLength).toBe(maxSize)
    })

    it('should release reader lock when stopping at limit', async () => {
      const chunk1 = new Uint8Array(60)
      const chunk2 = new Uint8Array(60) // Will be truncated
      const releaseLock = jest.fn()

      const mockResponse = {
        body: {
          getReader: () => {
            let index = 0
            const chunks = [chunk1, chunk2]

            return {
              read: async () => {
                if (index >= chunks.length) {
                  return { done: true, value: undefined }
                }

                return { done: false, value: chunks[index++] }
              },
              releaseLock,
            }
          },
        },
      }

      const maxSize = 100
      const result = await download(mockResponse, maxSize)

      expect(result.byteLength).toBe(maxSize)
      expect(releaseLock).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle empty response', async () => {
      const mockResponse = {
        body: createMockStream([]),
      }

      const maxSize = 100
      const result = await download(mockResponse, maxSize)

      expect(result).toHaveProperty('byteLength')
      expect(result.byteLength).toBe(0)
    })

    it('should return empty body when the response body is missing', async () => {
      const mockResponse = {
        body: null,
      }

      const maxSize = 100

      const result = await download(mockResponse, maxSize)

      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(result.byteLength).toBe(0)
    })

    it('should handle zero max size', async () => {
      const testData = new TextEncoder().encode('test')
      const mockResponse = {
        body: createMockStream([testData]),
      }

      const maxSize = 0
      const result = await download(mockResponse, maxSize)

      // With zero max size, should return empty buffer
      expect(result.byteLength).toBe(0)
    })

    it('should handle very large max size', async () => {
      const testData = new TextEncoder().encode('small data')
      const mockResponse = {
        body: createMockStream([testData]),
      }

      const maxSize = Number.MAX_SAFE_INTEGER
      const result = await download(mockResponse, maxSize)

      expect(result).toHaveProperty('byteLength')
      expect(result.byteLength).toBe(testData.length)
    })

    it('should properly combine chunks in correct order', async () => {
      const chunks = [
        new TextEncoder().encode('ABC'),
        new TextEncoder().encode('DEF'),
        new TextEncoder().encode('GHI'),
      ]

      const mockResponse = {
        body: createMockStream(chunks),
      }

      const maxSize = 100
      const result = await download(mockResponse, maxSize)

      const decoder = new TextDecoder()

      expect(decoder.decode(result)).toBe('ABCDEFGHI')
    })
  })
})

describe('withLimit', () => {
  /**
   * Helper to create a mock fetch that returns a response with the given data
   *
   * @param {string|Uint8Array} data
   * @param {number} [contentLength]
   */
  function createMockFetch(data, contentLength) {
    return async () => {
      const buffer =
        typeof data === 'string' ? new TextEncoder().encode(data) : data
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(buffer)
          controller.close()
        },
      })

      const headers = new Headers({
        'content-type': 'text/plain',
      })

      if (contentLength !== undefined) {
        headers.set('content-length', contentLength.toString())
      }

      return new Response(stream, {
        status: 200,
        statusText: 'OK',
        headers,
      })
    }
  }

  describe('basic functionality', () => {
    it('should pass through when no maxSize is specified', async () => {
      const mockFetch = createMockFetch('Hello, World!')
      const limitedFetch = withLimit(mockFetch)

      const response = await limitedFetch('http://example.com')
      const text = await response.text()

      expect(text).toBe('Hello, World!')
      expect(response.headers.has('X-Content-Truncated')).toBe(false)
    })

    it('should pass through when maxSize is 0', async () => {
      const mockFetch = createMockFetch('Hello, World!')
      const limitedFetch = withLimit(mockFetch, { maxSize: 0 })

      const response = await limitedFetch('http://example.com')
      const text = await response.text()

      expect(text).toBe('Hello, World!')
      expect(response.headers.has('X-Content-Truncated')).toBe(false)
    })

    it('should pass through when maxSize is Infinity', async () => {
      const mockFetch = createMockFetch('Hello, World!')
      const limitedFetch = withLimit(mockFetch, { maxSize: Infinity })

      const response = await limitedFetch('http://example.com')
      const text = await response.text()

      expect(text).toBe('Hello, World!')
      expect(response.headers.has('X-Content-Truncated')).toBe(false)
    })

    it('should not truncate when content is within limit', async () => {
      const mockFetch = createMockFetch('Hello!', 6)
      const limitedFetch = withLimit(mockFetch, { maxSize: 100 })

      const response = await limitedFetch('http://example.com')
      const text = await response.text()

      expect(text).toBe('Hello!')
      expect(response.headers.get('X-Content-Truncated')).toBe(null)
      expect(response.headers.get('content-length')).toBe('6')
    })

    it('should preserve bodyless response statuses', async () => {
      const limitedFetch = withLimit(
        async () => new Response(null, { status: 204 }),
        { maxSize: 100 }
      )

      const response = await limitedFetch('http://example.com')

      expect(response.status).toBe(204)
      await expect(response.text()).resolves.toBe('')
    })
  })

  describe('truncation behavior', () => {
    it('should truncate when content exceeds limit', async () => {
      const mockFetch = createMockFetch(
        'This is a long message that will be truncated',
        46
      )
      const limitedFetch = withLimit(mockFetch, { maxSize: 10 })

      const response = await limitedFetch('http://example.com')
      const text = await response.text()

      expect(text).toBe('This is a ')
      expect(text.length).toBe(10)
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
      expect(response.headers.get('X-Content-Original-Size')).toBe('46')
      expect(response.headers.get('content-length')).toBe('10')
    })

    it('should truncate large binary data', async () => {
      const largeData = new Uint8Array(1024 * 1024) // 1 MB
      const mockFetch = createMockFetch(largeData, 1024 * 1024)
      const limitedFetch = withLimit(mockFetch, { maxSize: 512 * 1024 }) // 512 KB

      const response = await limitedFetch('http://example.com')
      const buffer = await response.arrayBuffer()

      expect(buffer.byteLength).toBe(512 * 1024)
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
      expect(response.headers.get('X-Content-Original-Size')).toBe(
        (1024 * 1024).toString()
      )
      expect(response.headers.get('content-length')).toBe(
        (512 * 1024).toString()
      )
    })

    it('should handle exact boundary match', async () => {
      const mockFetch = createMockFetch('Exact!', 6)
      const limitedFetch = withLimit(mockFetch, { maxSize: 6 })

      const response = await limitedFetch('http://example.com')
      const text = await response.text()

      expect(text).toBe('Exact!')

      // @note at exact boundary, it's considered truncated because we reached
      // the limit

      expect(response.headers.get('X-Content-Truncated')).toBe('true')
      expect(response.headers.get('content-length')).toBe('6')
    })
  })

  describe('header handling', () => {
    it('should preserve original headers', async () => {
      const mockFetch = async () => {
        const headers = new Headers({
          'content-type': 'application/json',
          'x-custom-header': 'custom-value',
          'content-length': '50',
        })

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('Short'))
            controller.close()
          },
        })

        return new Response(stream, {
          status: 200,
          headers,
        })
      }

      const limitedFetch = withLimit(mockFetch, { maxSize: 100 })
      const response = await limitedFetch('http://example.com')

      expect(response.headers.get('content-type')).toBe('application/json')
      expect(response.headers.get('x-custom-header')).toBe('custom-value')
      expect(response.headers.get('content-length')).toBe('5')
    })

    it('should handle missing content-length in original response', async () => {
      const mockFetch = createMockFetch('Test data without content-length')
      const limitedFetch = withLimit(mockFetch, { maxSize: 10 })

      const response = await limitedFetch('http://example.com')
      const text = await response.text()

      expect(text).toBe('Test data ')
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
      expect(response.headers.get('X-Content-Original-Size')).toBe('unknown')
      expect(response.headers.get('content-length')).toBe('10')
    })

    it('should preserve response status and statusText', async () => {
      const mockFetch = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('Error message'))
            controller.close()
          },
        })

        return new Response(stream, {
          status: 404,
          statusText: 'Not Found',
          headers: new Headers({
            'content-type': 'text/plain',
            'content-length': '13',
          }),
        })
      }

      const limitedFetch = withLimit(mockFetch, { maxSize: 5 })
      const response = await limitedFetch('http://example.com')

      expect(response.status).toBe(404)
      expect(response.statusText).toBe('Not Found')
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
    })
  })

  describe('options handling', () => {
    it('should use default maxSize from decorator', async () => {
      const mockFetch = createMockFetch('This is a test message', 22)
      const limitedFetch = withLimit(mockFetch, { maxSize: 10 })

      const response = await limitedFetch('http://example.com')
      const text = await response.text()

      expect(text.length).toBe(10)
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
    })

    it('should override default maxSize with option', async () => {
      const mockFetch = createMockFetch('This is a test message', 22)
      const limitedFetch = withLimit(mockFetch, { maxSize: 100 })

      const response = await limitedFetch('http://example.com', { maxSize: 10 })
      const text = await response.text()

      expect(text.length).toBe(10)
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
    })

    it('should allow disabling limit with option', async () => {
      const mockFetch = createMockFetch('This is a test message', 22)
      const limitedFetch = withLimit(mockFetch, { maxSize: 10 })

      const response = await limitedFetch('http://example.com', {
        maxSize: Infinity,
      })
      const text = await response.text()

      expect(text).toBe('This is a test message')
      expect(response.headers.has('X-Content-Truncated')).toBe(false)
    })
  })

  describe('content-type handling', () => {
    it('should preserve content-type in blob', async () => {
      const mockFetch = async () => {
        const headers = new Headers({
          'content-type': 'application/pdf',
          'content-length': '100',
        })

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(50))
            controller.close()
          },
        })

        return new Response(stream, {
          status: 200,
          headers,
        })
      }

      const limitedFetch = withLimit(mockFetch, { maxSize: 20 })
      const response = await limitedFetch('http://example.com')

      expect(response.headers.get('content-type')).toBe('application/pdf')
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
    })

    it('should default to application/octet-stream when content-type is missing', async () => {
      const mockFetch = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('Data'))
            controller.close()
          },
        })

        return new Response(stream, {
          status: 200,
          headers: new Headers(),
        })
      }

      const limitedFetch = withLimit(mockFetch, { maxSize: 100 })
      const response = await limitedFetch('http://example.com')

      const blob = await response.blob()

      expect(blob.type).toBe('application/octet-stream')
    })
  })

  describe('content type remapping', () => {
    it('should remap content type when truncated with contentTypeRemap option', async () => {
      const mockFetch = createMockFetch(
        'This is a long JSON response that will be truncated',
        52
      )

      const jsonMockFetch = async () => {
        const response = await mockFetch()
        const headers = new Headers(response.headers)

        headers.set('content-type', 'application/json')

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })
      }

      const limitedFetch = withLimit(jsonMockFetch, {
        maxSize: 10,
        contentTypeRemap: {
          'application/json': 'text/plain',
        },
      })

      const response = await limitedFetch('http://example.com')

      expect(response.headers.get('content-type')).toBe('text/plain')
      expect(response.headers.get('X-Content-Original-Type')).toBe(
        'application/json'
      )
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
    })

    it('should remap PNG to octet-stream when truncated', async () => {
      const largeData = new Uint8Array(100)

      const mockFetch = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(largeData)
            controller.close()
          },
        })

        const headers = new Headers({
          'content-type': 'image/png',
          'content-length': '100',
        })

        return new Response(stream, {
          status: 200,
          statusText: 'OK',
          headers,
        })
      }

      const limitedFetch = withLimit(mockFetch, {
        maxSize: 10,
        contentTypeRemap: {
          'image/png': 'application/octet-stream',
        },
      })

      const response = await limitedFetch('http://example.com')

      expect(response.headers.get('content-type')).toBe(
        'application/octet-stream'
      )
      expect(response.headers.get('X-Content-Original-Type')).toBe('image/png')
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
    })

    it('should not remap content type when not truncated', async () => {
      const mockFetch = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('Short'))
            controller.close()
          },
        })

        const headers = new Headers({
          'content-type': 'application/json',
          'content-length': '5',
        })

        return new Response(stream, {
          status: 200,
          statusText: 'OK',
          headers,
        })
      }

      const limitedFetch = withLimit(mockFetch, {
        maxSize: 100,
        contentTypeRemap: {
          'application/json': 'text/plain',
        },
      })

      const response = await limitedFetch('http://example.com')

      expect(response.headers.get('content-type')).toBe('application/json')
      expect(response.headers.has('X-Content-Original-Type')).toBe(false)
      expect(response.headers.get('X-Content-Truncated')).toBe(null)
    })

    it('should keep original content type when no remap is provided', async () => {
      const mockFetch = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('This is a long message')
            )
            controller.close()
          },
        })

        const headers = new Headers({
          'content-type': 'application/x-random',
          'content-length': '22',
        })

        return new Response(stream, {
          status: 200,
          statusText: 'OK',
          headers,
        })
      }

      const limitedFetch = withLimit(mockFetch, {
        maxSize: 10,
      })

      const response = await limitedFetch('http://example.com')

      expect(response.headers.get('content-type')).toBe('application/x-random')
      expect(response.headers.has('X-Content-Original-Type')).toBe(false)
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
    })

    it('should keep original content type when truncated but not in remap', async () => {
      const mockFetch = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('This is a long message')
            )
            controller.close()
          },
        })

        const headers = new Headers({
          'content-type': 'application/xml',
          'content-length': '22',
        })

        return new Response(stream, {
          status: 200,
          statusText: 'OK',
          headers,
        })
      }

      const limitedFetch = withLimit(mockFetch, {
        maxSize: 10,
        contentTypeRemap: {
          'application/json': 'text/plain',
        },
      })

      const response = await limitedFetch('http://example.com')

      expect(response.headers.get('content-type')).toBe('application/xml')
      expect(response.headers.has('X-Content-Original-Type')).toBe(false)
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
    })

    it('should handle content type with charset parameters', async () => {
      const mockFetch = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('This is a long message')
            )
            controller.close()
          },
        })

        const headers = new Headers({
          'content-type': 'application/json; charset=utf-8',
          'content-length': '22',
        })

        return new Response(stream, {
          status: 200,
          statusText: 'OK',
          headers,
        })
      }

      const limitedFetch = withLimit(mockFetch, {
        maxSize: 10,
        contentTypeRemap: {
          'application/json': 'text/plain',
        },
      })

      const response = await limitedFetch('http://example.com')

      expect(response.headers.get('content-type')).toBe('text/plain')
      expect(response.headers.get('X-Content-Original-Type')).toBe(
        'application/json; charset=utf-8'
      )
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
    })

    it('should support option-level contentTypeRemap override', async () => {
      const mockFetch = async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('This is a long message')
            )
            controller.close()
          },
        })

        const headers = new Headers({
          'content-type': 'application/json',
          'content-length': '22',
        })

        return new Response(stream, {
          status: 200,
          statusText: 'OK',
          headers,
        })
      }

      const limitedFetch = withLimit(mockFetch, {
        maxSize: 10,
        contentTypeRemap: {
          'application/json': 'text/plain',
        },
      })

      const response = await limitedFetch('http://example.com', {
        contentTypeRemap: {
          'application/json': 'application/octet-stream',
        },
      })

      expect(response.headers.get('content-type')).toBe(
        'application/octet-stream'
      )
      expect(response.headers.get('X-Content-Original-Type')).toBe(
        'application/json'
      )
      expect(response.headers.get('X-Content-Truncated')).toBe('true')
    })
  })
})

describe('anySignal', () => {
  it('should return a signal that is not any of the input signals when one is pre-aborted', () => {
    const ac = new AbortController()

    ac.abort('already done')

    const result = anySignal([ac.signal])

    // @note the bug: anySignal returns the original input signal instead of
    // controller.signal when given a pre-aborted signal
    expect(result).not.toBe(ac.signal)
    expect(result.aborted).toBe(true)
    expect(result.reason).toBe('already done')
  })

  it('should return a consistent signal type regardless of pre-aborted input position', () => {
    const ac1 = new AbortController()
    const ac2 = new AbortController()

    ac2.abort('reason2')

    const result = anySignal([ac1.signal, ac2.signal])

    expect(result).not.toBe(ac1.signal)
    expect(result).not.toBe(ac2.signal)
    expect(result.aborted).toBe(true)
    expect(result.reason).toBe('reason2')
  })

  it('should return a non-aborted signal for empty array', () => {
    const result = anySignal([])

    expect(result.aborted).toBe(false)
  })

  it('should skip null and undefined entries', () => {
    const result = anySignal([null, undefined, null])

    expect(result.aborted).toBe(false)
  })

  it('should abort when any input signal aborts later', () => {
    const ac1 = new AbortController()
    const ac2 = new AbortController()

    const result = anySignal([ac1.signal, ac2.signal])

    expect(result.aborted).toBe(false)

    ac1.abort('reason1')

    expect(result.aborted).toBe(true)
    expect(result.reason).toBe('reason1')
  })

  it('should propagate abort reason from the second signal', () => {
    const ac1 = new AbortController()
    const ac2 = new AbortController()

    const result = anySignal([ac1.signal, ac2.signal])

    ac2.abort('reason2')

    expect(result.aborted).toBe(true)
    expect(result.reason).toBe('reason2')
  })
})
