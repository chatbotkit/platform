import debug, { assert, fassert } from '@chatbotkit-dev/debug'
import { SystemError } from '@chatbotkit-dev/errors'
import type { Thrown } from '@chatbotkit-dev/errors'
import {
  FAILURE_CODE_HEADER_NAME,
  LIMITS_REACHED_CODE,
  statusToCodeMap,
  statusToMessageMap,
} from '@chatbotkit-dev/http-codes'

// @note `withNextCache` passes Next.js's `next` request option, which Next
// declares by augmenting RequestInit globally. Outside the application that
// augmentation is not in scope, so it is reproduced here - in the entry point,
// so consumers that type-check this package from source see it too.

declare global {
  interface RequestInit {
    next?: {
      tags?: string[]
      revalidate?: number | false
    }
  }
}

export const ABORT_ERROR_NAME = 'AbortError'
export const TIMEOUT_ERROR_NAME = 'TimeoutError'

export const FETCH_PHASE_TAG = 'fetch.phase'
export const FETCH_PHASE_RESPONSE_HEADERS = 'response-headers'
export const FETCH_PHASE_RESPONSE_BODY = 'response-body'

export const CONTEXT_MODEL_TAG = 'context.model'

export const DEFAULT_TIMEOUT = 30000

export const DEFAULT_RETRIES = 5
export const DEFAULT_RETRY_DELAY = 250
export const DEFAULT_RETRY_TIMEOUT = false

export const HEADER_CONTENT_TRUNCATED = 'x-content-truncated'
export const HEADER_CONTENT_ORIGINAL_SIZE = 'x-content-original-size'
export const HEADER_CONTENT_ORIGINAL_TYPE = 'x-content-original-type'

const globalObject = typeof global !== 'undefined' ? global : globalThis

// we need to polyfill the ReadableStream for chrome and Safari
{
  if (
    typeof globalObject !== 'undefined' &&
    typeof globalObject.ReadableStream === 'function' &&
    // @ts-ignore
    typeof globalObject.ReadableStream.prototype[Symbol.asyncIterator] !==
      'function'
  ) {
    // @ts-ignore
    globalObject.ReadableStream.prototype[Symbol.asyncIterator] = function () {
      const reader = this.getReader()

      return {
        next: () => reader.read(),
        return: () => {
          reader.releaseLock()

          return Promise.resolve({ done: true })
        },
      }
    }
  }
}

/**
 * Represents an error that occurs during a fetch operation.
 */
export class FetchError extends SystemError {
  constructor(message: string, code: string, meta?: Record<string, unknown>) {
    super(message, code)

    this.name = meta
      ? `FetchError(${JSON.stringify(meta || {})})`
      : 'FetchError'
  }
}

/**
 * Represents an error that occurs when a fetch operation is aborted.
 */
export class AbortError extends SystemError {
  constructor(message?: string) {
    super(message || ABORT_ERROR_NAME, ABORT_ERROR_NAME)

    this.name = ABORT_ERROR_NAME
  }
}

/**
 * Represents an error that occurs when a fetch operation times out.
 */
export class TimeoutError extends SystemError {
  /**
   * `data` is Sentry capture context (e.g. `{ tags, extra }`) carried through to
   * `captureError` so timeouts arrive with the url, timeout budget, model and
   * retry stats attached instead of a bare `TimeoutError`.
   */
  constructor(message?: string, data?: unknown) {
    super(message || TIMEOUT_ERROR_NAME, TIMEOUT_ERROR_NAME, data)

    this.name = TIMEOUT_ERROR_NAME
  }
}

/**
 * Merge Sentry capture context (`tags`/`extra`) into an error's `data` field
 * (read by `buildCaptureContext` in `@/lib/error`) without clobbering anything
 * already there. Used by the fetch wrappers to annotate the error they throw
 * with diagnostics (url, timeout budget, attempt count, elapsed time) so the
 * Sentry event explains *why* and *how hard* a request failed.
 */
function annotateCaptureData(
  error: Thrown,
  {
    tags,
    extra,
  }: { tags?: Record<string, string>; extra?: Record<string, unknown> } = {}
): Thrown {
  if (!error || typeof error !== 'object') {
    return error
  }

  const existing =
    error.data && typeof error.data === 'object' && !Array.isArray(error.data)
      ? error.data
      : undefined

  // @note if the error already carried non-object `data` (e.g. a raw string),
  // preserve it under extra rather than dropping it

  const preserved =
    error.data !== undefined && !existing
      ? { originalData: error.data }
      : undefined

  error.data = {
    ...(existing || {}),

    tags: { ...(existing?.tags || {}), ...(tags || {}) },

    extra: { ...(existing?.extra || {}), ...preserved, ...(extra || {}) },
  }

  return error
}

/**
 * Fetches a resource from the network.
 *
 * @throws
 */
export function fetch(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  debug(`fetching`, { url, init }).log('fetch.fetch')

  fassert(() => {
    let href

    if (typeof url === 'object' && url !== null && 'href' in url) {
      href = url.href
    } else {
      href = url
    }

    return /^(?:https?:\/\/|data:|blob:|\/)/i.test(href || '')
  }, `url ${url} is not fetchable`)

  const nativeFetch =
    typeof globalObject !== 'undefined' ? globalObject.fetch : undefined

  if (!nativeFetch) {
    throw new Error(`No suitable fetch implementation found`)
  }

  return nativeFetch(url, init)
}

/**
 * Expose a JSONL stream as an async iterable.
 */
export async function* jsonl(
  body: ReadableStream<Uint8Array> & {
    [Symbol.asyncIterator](): AsyncIterator<Uint8Array>
  }
): AsyncGenerator<Record<string, unknown>> {
  try {
    const decoder = new TextDecoder()

    let previous = ''

    for await (const chunk of body) {
      previous += decoder.decode(chunk)

      while (true) {
        const eolIndex = previous.indexOf('\n')

        if (eolIndex < 0) {
          break
        }

        const line = previous.slice(0, eolIndex + 1)

        if (line) {
          yield JSON.parse(line)
        }

        previous = previous.slice(eolIndex + 1)
      }
    }

    if (previous.trim().length > 0) {
      yield JSON.parse(previous)
    }
  } catch (error: Thrown) {
    if (error?.name !== ABORT_ERROR_NAME) {
      throw error
    }
  }
}

/**
 * Downloads a response up to the specified size limit. Consumes the stream and
 * returns data up to maxSize bytes. * Does not throw on size limit - simply
 * stops reading at the limit.
 */
export async function download(
  response: Response,
  maxSize: number
): Promise<ArrayBuffer> {
  debug(`downloading with size limit`, { maxSize }).log('fetch.download')

  if (!response.body) {
    return new ArrayBuffer(0)
  }

  const reader = response.body.getReader()

  const chunks: Uint8Array[] = []

  let receivedLength = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      const remainingSpace = maxSize - receivedLength

      if (value.length > remainingSpace) {
        if (remainingSpace > 0) {
          chunks.push(value.slice(0, remainingSpace))

          receivedLength += remainingSpace

          debug(`chunk truncated to fit limit`, {
            chunkSize: value.length,
            taken: remainingSpace,
            receivedLength,
          }).log('fetch.download')
        }

        break
      }

      chunks.push(value)

      receivedLength += value.length

      debug(`received chunk`, { chunkSize: value.length, receivedLength }).log(
        'fetch.download'
      )
    }
  } finally {
    reader.releaseLock()
  }

  debug(`download complete`, { receivedLength }).log('fetch.download')

  const allChunks = new Uint8Array(receivedLength)

  let position = 0

  for (const chunk of chunks) {
    allChunks.set(chunk, position)

    position += chunk.length
  }

  return allChunks.buffer
}

/**
 * Check if the response indicates an error and if so, create a FetchError.
 */
export async function getFetchError(
  response: Response,
  meta?: Record<string, unknown>
): Promise<FetchError> {
  assert(!response.ok, `Response ok`)

  const status = response.status
  const text = await response.text()

  debug(`fetch error`, { status, text }).log('fetch.getFetchError')

  let json

  try {
    json = JSON.parse(text)
  } catch {
    json = {
      message: statusToMessageMap[status],
      code: statusToCodeMap[status],
    }
  }

  // @note prefer string codes from statusToCodeMap over numeric codes from json bodies,
  // since numeric codes (e.g. google api returns 404 as a number) are not recognized
  // by isUnknownError() which checks against string codes only
  const codeFromJson =
    (typeof json?.error?.code === 'string' && json.error.code) ||
    (typeof json?.code === 'string' && json.code) ||
    null

  // @note surface upstream validation detail held in less common shapes (a
  // string `error`, or an `errors` array) so callers - e.g. agents - can see
  // exactly what was rejected and self-correct, instead of a generic status
  // message

  return new FetchError(
    json?.error?.message ||
      json?.message ||
      (typeof json?.error === 'string' ? json.error : undefined) ||
      (Array.isArray(json?.errors) && json.errors.length
        ? JSON.stringify(json.errors)
        : undefined) ||
      statusToMessageMap[status] ||
      statusToMessageMap[500],
    codeFromJson || statusToCodeMap[status] || statusToCodeMap[500],
    meta
  )
}

/**
 * Returns an AbortSignal that resolves when any of the provided signals abort.
 */
export function anySignal(
  signals: (AbortSignal | null | undefined)[]
): AbortSignal {
  const controller = new AbortController()

  for (const signal of signals) {
    if (!signal) {
      continue
    }

    if (signal.aborted) {
      controller.abort(signal.reason)

      return controller.signal
    }

    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      signal: controller.signal,
    })
  }

  return controller.signal
}

export type FetchFn<T> = (
  url: string | URL,
  options?: RequestInit & T
) => Promise<Response>

export type withDebugOptions = object

/**
 * @todo move to @chatbotkit/fetch sdk
 */
export function withDebug(
  fetch: FetchFn<object>,
  defaultOptions?: withDebugOptions
): FetchFn<withDebugOptions> {
  debug(`with debug`, { defaultOptions }).log('fetch.withDebug')

  return async function fetchWithDebug(
    url: string | URL,
    options?: RequestInit & withDebugOptions
  ): Promise<Response> {
    debug(`fetching`, { url, options }).log('fetch.withDebug.fetchWithDebug')

    const response = await fetch(url, { ...options })

    debug(`fetched`, { url, options, response }).log(
      'fetch.withDebug.fetchWithDebug'
    )

    return response
  }
}

export type withInitOptions = {
  duplex?: 'half'
}

/**
 * @todo move to @chatbotkit/fetch sdk
 */
export function withInit(
  fetch: FetchFn<object>,
  defaultOptions?: withInitOptions
): FetchFn<withInitOptions> {
  debug(`with init`, { defaultOptions }).log('fetch.withInit')

  return async function fetchWithInit(
    url: string | URL,
    options?: RequestInit & withInitOptions
  ): Promise<Response> {
    debug(`fetching`, { url, options, defaultOptions }).log(
      'fetch.withInit.fetchWithInit'
    )

    const response = await fetch(url, { ...options, ...defaultOptions })

    debug(`fetched`, { url, options, response }).log(
      'fetch.withInit.fetchWithInit'
    )

    return response
  }
}

export type withCacheOptions = {
  ttl?: number
}

/**
 * @todo move to @chatbotkit/fetch sdk
 */
export function withCache(
  fetch: FetchFn<object>,
  defaultOptions?: withCacheOptions
): FetchFn<withCacheOptions> {
  debug(`with cache`, { defaultOptions }).log('fetch.withCache')

  const cache = new Map()

  return async function fetchWithCache(
    url: string | URL,
    options?: RequestInit & withCacheOptions
  ): Promise<Response> {
    const ttl = options?.ttl ?? defaultOptions?.ttl ?? 60000

    const key = JSON.stringify([url, options])

    const cachedEntry = cache.get(key)

    const currentTime = Date.now()

    if (cachedEntry && currentTime - cachedEntry.timestamp < ttl) {
      return cachedEntry.response.clone()
    }

    const response = await fetch(url, { ...options })

    if (response.ok) {
      // @todo make this work because it doesn't
      // cache.set(key, {
      //   timestamp: currentTime,
      //   response: response.clone(),
      // })
    }

    return response
  }
}

export type withNextCacheOptions = {
  tags?: string[]
  ttl?: number
}

/**
 * @todo move to @chatbotkit/fetch sdk
 */
export function withNextCache(
  fetch: FetchFn<object>,
  defaultOptions?: withNextCacheOptions
): FetchFn<withNextCacheOptions> {
  debug(`with next cache`, { defaultOptions }).log('fetch.withNextCache')

  return async function fetchWithNextCache(
    url: string | URL,
    options?: RequestInit & withNextCacheOptions
  ): Promise<Response> {
    const tags = options?.tags ?? defaultOptions?.tags ?? []
    const ttl = options?.ttl ?? defaultOptions?.ttl ?? 60000

    const response = await fetch(url, {
      ...options,

      cache: 'force-cache',

      next: {
        tags,

        revalidate: Math.round(ttl / 1000),
      },
    })

    return response
  }
}

/**
 * Diagnostic identifiers for a fetch (e.g. the model being called). Ignored by
 * the network layer; surfaced onto any `TimeoutError`'s Sentry context so the
 * event records which upstream stalled.
 */
export type FetchMeta = { model?: string } & Record<string, unknown>

export type withTimeoutOptions = {
  timeout?: number
  meta?: FetchMeta
}

/**
 * Add timeout capabilities to any fetch implementation.
 *
 * @todo move to @chatbotkit/fetch sdk
 */
export function withTimeout(
  fetch: FetchFn<object>,
  defaultOptions?: withTimeoutOptions
): FetchFn<withTimeoutOptions> {
  debug(`with timeout`, { defaultOptions }).log('fetch.withTimeout')

  return async function fetchWithTimeout(
    url: string | URL,
    options?: RequestInit & withTimeoutOptions
  ): Promise<Response> {
    const timeout =
      options?.timeout ?? defaultOptions?.timeout ?? DEFAULT_TIMEOUT

    debug(`fetching with timeout`, { url, timeout }).log(
      'fetch.withTimeout.fetchWithTimeout'
    )

    // @note the timeout only covers time-to-response-headers - `fetch()`
    // resolves once headers arrive and the body is streamed afterwards, outside
    // this guard. A `TimeoutError` here therefore means the upstream never
    // started responding within the budget (e.g. a stalled/overloaded gateway),
    // NOT that generation was slow. We attach that context so the Sentry event
    // says exactly what timed out instead of a bare `TimeoutError`.

    const meta = options?.meta

    const makeTimeoutError = () =>
      new TimeoutError(undefined, {
        tags: {
          [FETCH_PHASE_TAG]: FETCH_PHASE_RESPONSE_HEADERS,

          ...(meta?.model ? { [CONTEXT_MODEL_TAG]: String(meta.model) } : {}),
        },

        extra: {
          fetch: {
            url: typeof url === 'string' ? url : url?.toString?.(),

            timeoutMs: timeout,

            ...(meta || {}),
          },
        },
      })

    let signal
    let handler

    let isTimeOutAbort = false

    if (timeout > 0 && timeout !== Infinity) {
      const abortController = new AbortController()

      // @todo use AbortSignal.timeout(n) when widely supported, right now there
      // in fact little to no support with known bugs in Chrome

      handler = setTimeout(() => {
        debug(`aborting fetch`, { url }).log(
          'fetch.withTimeout.fetchWithTimeout'
        )

        isTimeOutAbort = true

        abortController.abort(makeTimeoutError())
      }, timeout)

      // @todo use AbortSignal.any([]) when widely supported, right now most
      // implementation simply do not have it

      signal = options?.signal
        ? anySignal([abortController.signal, options.signal])
        : abortController.signal
    } else {
      signal = options?.signal
    }

    let response

    try {
      response = await fetch(url, {
        ...options,

        signal,
      })
    } catch (error: Thrown) {
      // @note we have a problem because some implementation (Chrome) do not
      // correctly transfer the real reason for the abort i.e. the timeout
      // error, so we need to check if we have raised a timeout above and if so
      // we need to throw the correct error

      if ([error?.name, error?.message].includes(ABORT_ERROR_NAME)) {
        if (isTimeOutAbort) {
          throw makeTimeoutError()
        }
      }

      throw error
    } finally {
      clearTimeout(handler)
    }

    return response
  }
}

export type withBodyTimeoutOptions = {
  bodyTimeout?: number
  meta?: FetchMeta
}

/**
 * Guard the *body* (post-headers) phase of a streaming response against a
 * stalled upstream. {@link withTimeout} only covers time-to-response-headers -
 * once headers arrive the body is streamed afterwards, outside that guard, so a
 * gateway that returns headers and then goes silent (sends no tokens) hangs
 * until undici's ~300s default body timeout. That surfaces as a bare
 * `TypeError: terminated` (cause `UND_ERR_BODY_TIMEOUT`) with no model
 * attribution, burns the whole turn for 0 tokens, and leaves it "incomplete".
 *
 * This wrapper caps the gap between body chunks - including time-to-first-chunk.
 * If no chunk arrives within `bodyTimeout` ms it cancels the underlying body
 * (releasing the socket) and surfaces the same annotated {@link TimeoutError}
 * that {@link withTimeout} throws, so the stall is attributable in Sentry
 * (`context.model`, `fetch.phase: response-body`) instead of opaque. The timer
 * resets on every received chunk, so a slow-but-steady stream is never killed.
 *
 * @todo move to @chatbotkit/fetch sdk
 */
export function withBodyTimeout(
  fetch: FetchFn<object>,
  defaultOptions?: withBodyTimeoutOptions
): FetchFn<withBodyTimeoutOptions> {
  debug(`with body timeout`, { defaultOptions }).log('fetch.withBodyTimeout')

  return async function fetchWithBodyTimeout(
    url: string | URL,
    options?: RequestInit & withBodyTimeoutOptions
  ): Promise<Response> {
    const bodyTimeout = options?.bodyTimeout ?? defaultOptions?.bodyTimeout ?? 0

    const response = await fetch(url, options)

    // @note nothing to guard: disabled, no body, or an error response the caller
    // will read in full (e.g. to extract the upstream error message) rather than
    // stream. Wrapping a non-ok body would arm a timer on a stream the caller may
    // never iterate.

    if (
      !bodyTimeout ||
      bodyTimeout === Infinity ||
      !response.body ||
      !response.ok
    ) {
      return response
    }

    const meta = options?.meta ?? defaultOptions?.meta

    const makeTimeoutError = () =>
      new TimeoutError(undefined, {
        tags: {
          [FETCH_PHASE_TAG]: FETCH_PHASE_RESPONSE_BODY,

          ...(meta?.model ? { [CONTEXT_MODEL_TAG]: String(meta.model) } : {}),
        },

        extra: {
          fetch: {
            url: typeof url === 'string' ? url : url?.toString?.(),

            bodyTimeoutMs: bodyTimeout,

            ...(meta || {}),
          },
        },
      })

    const source = response.body

    // @note hoisted so `cancel` can tear down through the reader - `start`
    // locks `source` with this reader, and a locked stream cannot be cancelled
    // directly (it throws), so the cancel path must go through the reader.
    let reader

    const guarded = new ReadableStream({
      start(controller) {
        reader = source.getReader()

        let timer

        let settled = false

        // @note run every terminal controller transition exactly once, clearing
        // the idle timer first. Wrapped in try/catch because a consumer that
        // cancels mid-stream can move the controller to a closed state before we
        // observe it - closing/erroring it again would otherwise throw.

        const settle = (transition) => {
          if (settled) {
            return
          }

          settled = true

          if (timer) {
            clearTimeout(timer)

            timer = undefined
          }

          try {
            transition()
          } catch {
            // @note controller already closed/errored (e.g. consumer cancelled)
          }
        }

        const pump = async () => {
          try {
            while (true) {
              timer = setTimeout(() => {
                const error = makeTimeoutError()

                // @note release the upstream socket, then surface the timeout to
                // the consumer's read/`for await`

                void reader.cancel(error).catch(() => {})

                settle(() => controller.error(error))
              }, bodyTimeout)

              const { done, value } = await reader.read()

              if (timer) {
                clearTimeout(timer)

                timer = undefined
              }

              if (settled) {
                return
              }

              if (done) {
                settle(() => controller.close())

                return
              }

              controller.enqueue(value)
            }
          } catch (error: Thrown) {
            settle(() => controller.error(error))
          }
        }

        void pump()
      },

      cancel(reason) {
        // @note cancel through the reader (it holds the lock on `source`).
        // Swallow rejections: an already-errored/cancelled reader rejects here,
        // and a consumer that stopped early does not care about the outcome.
        return reader?.cancel(reason).catch(() => {})
      },
    })

    return new Response(guarded, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }
}

/**
 * Recognises the one error {@link withBodyTimeout} throws: a `TimeoutError`
 * tagged `fetch.phase: response-body`. Lives here, next to the wrapper that
 * produces it and keyed off the same {@link FETCH_PHASE_TAG} /
 * {@link FETCH_PHASE_RESPONSE_BODY} constants, so the producer and this
 * recogniser cannot drift.
 *
 * It exists because a body-phase stall is raised *while the streaming body is
 * being consumed* - downstream of {@link withRetry}, which has already returned
 * the (headers-ok) response and so never retries it. The streaming layer uses
 * this to decide a stall is safe to re-issue (header-phase timeouts, already
 * retried at the fetch layer, and real provider errors are deliberately
 * excluded).
 */
export function isBodyStallTimeout(error: Thrown): boolean {
  return (
    error?.name === TIMEOUT_ERROR_NAME &&
    error?.data?.tags?.[FETCH_PHASE_TAG] === FETCH_PHASE_RESPONSE_BODY
  )
}

export type withRetryOptions = {
  retries?: number
  retryDelay?: number
  retryTimeout?: boolean
  meta?: FetchMeta
}

/**
 * Add retry capabilities to any fetch implementation.
 *
 * @todo move to @chatbotkit/fetch sdk
 */
export function withRetry(
  fetch: FetchFn<object>,
  defaultOptions?: withRetryOptions
): FetchFn<withRetryOptions> {
  debug(`with retry`, { defaultOptions }).log('fetch.withRetry')

  return async function fetchWithRetry(
    url: string | URL,
    options?: RequestInit & withRetryOptions
  ): Promise<Response> {
    const maxRetries =
      options?.retries ?? defaultOptions?.retries ?? DEFAULT_RETRIES

    const retryTimeout =
      options?.retryTimeout ??
      defaultOptions?.retryTimeout ??
      DEFAULT_RETRY_TIMEOUT

    // @note attempts run in a loop rather than via recursion, so the stats we
    // report on a final failure (how many attempts, how long they took) live in
    // plain local state instead of being threaded through `options`. `attempt`
    // is the 1-based number of the attempt currently running; `retriesLeft`
    // counts down; `retryDelay` doubles each retry (exponential backoff).

    const startedAt = Date.now()

    let retriesLeft = maxRetries

    let retryDelay =
      options?.retryDelay ?? defaultOptions?.retryDelay ?? DEFAULT_RETRY_DELAY

    let attempt = 0

    /**
     * Annotate the about-to-be-thrown error with retry diagnostics for Sentry.
     */
    const annotateRetry = (error) =>
      annotateCaptureData(error, {
        tags: {
          'fetch.attempts': String(attempt),

          'fetch.outcome': [error?.name, error?.message].includes(
            TIMEOUT_ERROR_NAME
          )
            ? 'timeout'
            : 'error',
        },

        extra: {
          fetchRetry: {
            url: typeof url === 'string' ? url : url?.toString?.(),

            attempts: attempt,

            maxAttempts: maxRetries + 1,

            elapsedMs: Date.now() - startedAt,

            retryTimeout,
          },
        },
      })

    while (true) {
      attempt += 1

      debug(`fetching with retry`, {
        url,
        retries: retriesLeft,
        retryDelay,
        retryTimeout,
      }).log('fetch.withRetry.fetchWithRetry')

      let response

      try {
        response = await fetch(url, { ...options })

        if (!response.ok) {
          debug(`response not ok`, {
            url,
            status: response.status,
            statusText: response.statusText,
          }).log('fetch.withRetry.fetchWithRetry')

          switch (response.status) {
            // we always attempt to retry if it is one of the following error
            // codes as long as we do not also have a corner case

            case 429:
              // as a special case, we return 429 when we have exceeded account

              if (
                response.headers.get(FAILURE_CODE_HEADER_NAME) ===
                LIMITS_REACHED_CODE
              ) {
                return response
              }

            case 500:
            case 502:
            case 503:
            case 504:
              // Previously we were not retrying status code 503 which meant that
              // some OpenAI requests were failing due to 503 being treated
              // similar to 429 when the model is overloaded.

              // @note we don't use getFetchError here because we don't want to
              // read the response body, we just want to throw an error with the
              // status code and the URL

              throw new FetchError(
                `Fetch failed with status ${response.status} (${response.statusText})`,
                statusToCodeMap[response.status] || statusToCodeMap[500],
                {
                  url: new URL(url).href,
                  options: options,
                }
              )

            // by default we return the response as is

            default:
              return response
          }
        }

        return response
      } catch (error: Thrown) {
        debug(`fetch error`, { url, error }).log(
          'fetch.withRetry.fetchWithRetry'
        )

        // @note never retry a timeout when the caller opted out

        if (
          [error?.name, error?.message].includes(TIMEOUT_ERROR_NAME) &&
          !retryTimeout
        ) {
          debug(`not retrying timeout`, { url, error }).log(
            'fetch.withRetry.fetchWithRetry'
          )

          throw annotateRetry(error)
        }

        // @note out of retries - surface the last bad response if we have one,
        // otherwise throw the (annotated) error

        if (retriesLeft === 0) {
          debug(`no retries left`, { url, error, retries: retriesLeft }).log(
            'fetch.withRetry.fetchWithRetry'
          )

          if (response) {
            return response
          }

          throw annotateRetry(error)
        }

        debug(`sleeping`, { retryDelay }).log('fetch.withRetry.fetchWithRetry')

        await new Promise((resolve) => setTimeout(resolve, retryDelay))

        retriesLeft -= 1
        retryDelay *= 2

        debug(`retrying fetch`, { url, retries: retriesLeft, retryDelay }).log(
          'fetch.withRetry.fetchWithRetry'
        )
      }
    }
  }
}

export type withLimitOptions = {
  maxSize?: number
  contentTypeRemap?: Record<string, string | true>
}

/**
 * Add response size limiting to any fetch implementation. Downloads response up
 * to maxSize bytes and adds a header to indicate truncation.
 *
 * @todo move to @chatbotkit/fetch sdk
 */
export function withLimit(
  fetch: FetchFn<object>,
  defaultOptions?: withLimitOptions
): FetchFn<withLimitOptions> {
  debug(`with limit`, { defaultOptions }).log('fetch.withLimit')

  return async function fetchWithLimit(
    url: string | URL,
    options?: RequestInit & withLimitOptions
  ): Promise<Response> {
    const maxSize = options?.maxSize ?? defaultOptions?.maxSize

    if (!maxSize || maxSize <= 0 || maxSize === Infinity) {
      return await fetch(url, options)
    }

    const contentTypeRemap = options?.contentTypeRemap ??
      defaultOptions?.contentTypeRemap ?? {
        'application/json': 'text/plain',
        'application/yaml': 'text/plain',
        'application/xml': 'text/plain',
        'text/xml': 'text/plain',
        'text/html': false,
        'application/xhtml+xml': 'text/html',
        'text/csv': false,
      }

    debug(`fetching with size limit`, { url, maxSize, contentTypeRemap }).log(
      'fetch.withLimit.fetchWithLimit'
    )

    const response = await fetch(url, options)

    const contentLength = response.headers.get('content-length')

    const expectedSize = contentLength ? parseInt(contentLength, 10) : null

    const willTruncate =
      expectedSize !== null && !isNaN(expectedSize) && expectedSize > maxSize

    debug(`response received`, {
      contentLength,
      expectedSize,
      willTruncate,
    }).log('fetch.withLimit.fetchWithLimit')

    const buffer = await download(response, maxSize)

    debug(`download complete`, { bufferSize: buffer.byteLength }).log(
      'fetch.withLimit.fetchWithLimit'
    )

    const wasTruncated = buffer.byteLength >= maxSize

    const originalContentType =
      response.headers.get('content-type') || 'application/octet-stream'

    let contentType = originalContentType

    if (wasTruncated) {
      if (contentTypeRemap) {
        const mainType = originalContentType.split(';')[0].trim()

        switch (true) {
          case mainType in contentTypeRemap: {
            contentType =
              contentTypeRemap[mainType] === false
                ? mainType
                : contentTypeRemap[mainType]

            break
          }

          case originalContentType in contentTypeRemap: {
            contentType =
              contentTypeRemap[originalContentType] === false
                ? originalContentType
                : contentTypeRemap[originalContentType]

            break
          }
        }
      } else {
        contentType = 'application/octet-stream'
      }
    }

    const blob = new Blob([buffer], {
      type: contentType,
    })

    const newHeaders = new Headers(response.headers)

    if (wasTruncated) {
      newHeaders.set(HEADER_CONTENT_TRUNCATED, 'true')
      newHeaders.set(
        HEADER_CONTENT_ORIGINAL_SIZE,
        expectedSize?.toString() || 'unknown'
      )

      if (contentType !== originalContentType) {
        newHeaders.set('content-type', contentType)

        newHeaders.set(HEADER_CONTENT_ORIGINAL_TYPE, originalContentType)
      }
    }

    newHeaders.set('content-length', buffer.byteLength.toString())

    const responseBody = [204, 205, 304].includes(response.status) ? null : blob

    const limitedResponse = new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })

    debug(`response limited`, {
      originalSize: expectedSize,
      limitedSize: buffer.byteLength,
      truncated: wasTruncated,
      originalContentType,
      contentType,
    }).log('fetch.withLimit.fetchWithLimit')

    return limitedResponse
  }
}

// @note the composition erases the inner wrapper's options from the inferred
// type: withRetry only knows it returns a FetchFn<withRetryOptions>. The
// assertion restores what a caller can actually pass.

export const fetchPlusPlus = withRetry(withTimeout(fetch)) as FetchFn<
  withTimeoutOptions & withRetryOptions
>

export default fetch
