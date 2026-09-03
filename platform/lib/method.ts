import type { NextApiRequest, NextApiResponse } from 'next'

import { stream2buf } from '@chatbotkit-dev/buffer'

import { REQUEST_SOFT_ABORT_TIMEOUT_MS } from '@/config/server'

import { setupRequestContext } from '@/lib/context.setup'
import {
  getContextRequestHost,
  getContextRequestProtocol,
  runInContext,
  setContextNextApiRequest,
  setContextNextApiResponse,
} from '@/lib/context.store'
import debug, { assert } from '@/lib/debug'
import { runInDeferred } from '@/lib/defer'
import { getContentTypeHeader } from '@/lib/header'
import {
  badRequest,
  captureUnknownException,
  methodNotAllowed,
  ok,
  respondFromError,
  send,
} from '@/lib/response'

type RequestHandler<TArgs extends unknown[] = []> = (
  req: Request,
  ...args: TArgs
) => Promise<Response>

type NextApiRequestHandler<TArgs extends unknown[] = []> = (
  req: NextApiRequest | Request,
  ...args: TArgs
) => Promise<Response | undefined>

/**
 * A Request augmented with the separate hard and soft abort signals. The
 * built-in `signal` remains the convenience signal that fires on whichever of
 * the two aborts first; `hardSignal` and `softSignal` let callers distinguish
 * an immediate cancellation from an early "about to be cancelled" warning.
 */
export type RequestWithAbortSignals = Request & {
  hardSignal: AbortSignal
  softSignal: AbortSignal
}

/**
 * Mock response class for edge runtime compatibility
 */
class MockResponse {
  getHeader(): void {}
  setHeader(): void {}
}

type RequestAbortSignals = {
  /**
   * Convenience signal that aborts when whichever of the hard or soft signals
   * fires first, carrying that signal's reason. This is what the rest of the
   * codebase consumes today via `req.signal`.
   */
  signal: AbortSignal

  /** Aborts when the request is being cancelled right now. */
  hardSignal: AbortSignal

  /** Aborts early to warn that the request is about to be cancelled. */
  softSignal: AbortSignal

  /** Triggers a hard abort (e.g. on a detected client disconnect). */
  abortHard: (reason?: unknown) => void

  cleanup: () => void
}

/**
 * Builds the trio of abort signals for a request.
 *
 * - the hard signal fires on a real cancellation: the parent signal aborting
 *   (client disconnect / platform deadline) or an explicit `abortHard` call
 * - the soft signal fires on the early timeout, giving handlers a chance to
 *   wind down gracefully before the hard deadline
 * - the convenience signal forwards whichever of the two fires first, so
 *   existing single-signal consumers keep their current behaviour while future
 *   code can react to the hard and soft signals independently
 */
function createRequestAbortSignals(
  parentSignal?: AbortSignal | null
): RequestAbortSignals {
  const hard = new AbortController()
  const soft = new AbortController()
  const convenience = new AbortController()

  const abortHard = (reason?: unknown): void => {
    if (!hard.signal.aborted) {
      hard.abort(reason)
    }
  }

  const abortSoft = (reason?: unknown): void => {
    if (!soft.signal.aborted) {
      soft.abort(reason)
    }
  }

  const abortConvenience = (reason?: unknown): void => {
    if (!convenience.signal.aborted) {
      convenience.abort(reason)
    }
  }

  // @note forward whichever underlying signal fires first to the convenience
  // signal, preserving its reason so callers can still inspect why it aborted
  const onHard = (): void => abortConvenience(hard.signal.reason)
  const onSoft = (): void => abortConvenience(soft.signal.reason)

  hard.signal.addEventListener('abort', onHard, { once: true })
  soft.signal.addEventListener('abort', onSoft, { once: true })

  const abortHardFromParent = (): void => {
    debug(`request hard aborted by caller`).log('method.withRequestResponse')

    abortHard(parentSignal?.reason)
  }

  if (parentSignal?.aborted) {
    abortHardFromParent()
  } else {
    parentSignal?.addEventListener('abort', abortHardFromParent, { once: true })
  }

  const abortSoftFromTimeout = (): void => {
    debug(`request soft abort timeout reached`).log(
      'method.withRequestResponse'
    )

    abortSoft(
      new DOMException('Request soft abort timeout reached', 'TimeoutError')
    )
  }

  const timeout = setTimeout(
    abortSoftFromTimeout,
    REQUEST_SOFT_ABORT_TIMEOUT_MS
  )

  timeout.unref?.()

  const cleanup = (): void => {
    clearTimeout(timeout)

    parentSignal?.removeEventListener('abort', abortHardFromParent)

    hard.signal.removeEventListener('abort', onHard)
    soft.signal.removeEventListener('abort', onSoft)
  }

  return {
    signal: convenience.signal,
    hardSignal: hard.signal,
    softSignal: soft.signal,
    abortHard,
    cleanup,
  }
}

/**
 * Exposes the hard and soft abort signals on the request alongside the
 * built-in convenience `signal`.
 */
function attachAbortSignals(
  request: Request,
  signals: RequestAbortSignals
): RequestWithAbortSignals {
  Object.defineProperty(request, 'hardSignal', {
    value: signals.hardSignal,
    enumerable: false,
  })

  Object.defineProperty(request, 'softSignal', {
    value: signals.softSignal,
    enumerable: false,
  })

  return request as RequestWithAbortSignals
}

function withResponseCleanup(
  response: Response,
  cleanup: (() => void) | undefined
): Response {
  if (!cleanup) {
    return response
  }

  if (!response.body) {
    cleanup()

    return response
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

  const body = new ReadableStream({
    start() {
      reader = response.body?.getReader()
    },

    async pull(controller) {
      if (!reader) {
        controller.close()

        cleanup()

        return
      }

      try {
        const { done, value } = await reader.read()

        if (done) {
          controller.close()

          cleanup()

          return
        }

        controller.enqueue(value)
      } catch (error) {
        cleanup()

        throw error
      }
    },

    async cancel(reason) {
      cleanup()

      await reader?.cancel(reason)
    },
  })

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

/**
 * Wraps a request handler to work with both Next.js API routes and Edge runtime
 */
function withRequestResponse<TArgs extends unknown[]>(
  fn: RequestHandler<TArgs>
): NextApiRequestHandler<TArgs> {
  return runInContext(
    async function (
      incomingRequest: Request | NextApiRequest,
      ...args: TArgs
    ): Promise<Response | undefined> {
      debug(`request received`).log('method.withRequestResponse')

      let req: Request
      let res: NextApiResponse | MockResponse

      let cleanupAbortListeners: (() => void) | undefined
      let cleanupRequestAbortController: (() => void) | undefined

      // @note a standard Request object (App Router) carries a Headers
      // instance; a Pages Router NextApiRequest carries a plain object

      const isStandardRequest = incomingRequest.headers instanceof Headers

      // @note initialize the complete context from the original request once.
      // The normalized Web Request below must consume the resolved values rather
      // than parse security-sensitive proxy headers a second time.

      setupRequestContext(incomingRequest)

      const requestHost = getContextRequestHost() || 'localhost'
      const requestProtocol = getContextRequestProtocol() || 'https'

      if (isStandardRequest) {
        const thisRequest = incomingRequest as Request

        const url = new URL(
          thisRequest.url || '/',
          `${requestProtocol}://${requestHost}`
        )

        const method = thisRequest.method || 'GET'

        const headers = new Headers()

        for (const [key, value] of thisRequest.headers) {
          headers.set(key, value)
        }

        const body = ['HEAD', 'OPTIONS', 'GET'].includes(method)
          ? undefined
          : thisRequest.body || null

        const requestAbortSignals = createRequestAbortSignals(
          thisRequest.signal
        )

        cleanupRequestAbortController = requestAbortSignals.cleanup

        req = new Request(url, {
          method: method,

          headers: headers,

          body: body,

          signal: requestAbortSignals.signal,

          // @ts-ignore - duplex is not yet in TypeScript types
          ...(body ? { duplex: 'half' } : {}),
        })

        attachAbortSignals(req, requestAbortSignals)

        res = new MockResponse()

        // @note the first arg for edge is the NextFetchEvent which we don't need
        const [, ...restArgs] = args

        args = restArgs as TArgs
      } else {
        const thisRequest = incomingRequest as NextApiRequest

        const url = new URL(
          thisRequest.url || '/',
          `${requestProtocol}://${requestHost}`
        )

        for (const [key, value] of Object.entries(thisRequest.query)) {
          if (value === undefined) {
            continue
          }

          const values = Array.isArray(value) ? value : [value]

          for (const v of values) {
            url.searchParams.append(key, v)
          }
        }

        const method = thisRequest.method || 'GET'

        // @note extract the response early so we can subscribe to its close event
        // for streaming disconnect detection (res close fires when the client
        // disconnects mid-stream; req close fires only when the request body
        // socket closes which may not coincide with streaming disconnect)

        const [nextApiResponseEarly, ...restArgsEarly] = args

        const thisResponse = nextApiResponseEarly as NextApiResponse

        args = restArgsEarly as TArgs

        const requestAbortSignals = createRequestAbortSignals()

        cleanupRequestAbortController = requestAbortSignals.cleanup

        const abortRequest = (): void => {
          if (!requestAbortSignals.hardSignal.aborted) {
            debug(`request hard aborted by caller`).log(
              'method.withRequestResponse'
            )

            requestAbortSignals.abortHard()
          }
        }

        if (thisRequest.aborted) {
          abortRequest()
        }

        // @note NextApiRequest can emit either aborted or close depending on
        // runtime/proxy behavior so we subscribe to both to reliably propagate
        // client disconnects to the wrapped Request signal
        thisRequest.on('aborted', abortRequest)
        thisRequest.on('close', abortRequest)

        // @note also subscribe to the response close event which reliably fires
        // when the client disconnects during a streaming response
        thisResponse.on('close', abortRequest)

        cleanupAbortListeners = (): void => {
          thisRequest.removeListener('aborted', abortRequest)
          thisRequest.removeListener('close', abortRequest)
          thisResponse.removeListener('close', abortRequest)
        }

        const headers = new Headers()

        for (const [key, value] of Object.entries(thisRequest.headers)) {
          if (value === undefined) {
            continue
          }

          const values = Array.isArray(value) ? value : [value]

          for (const v of values) {
            headers.append(key, v)
          }
        }

        const methodsWithoutBody = ['HEAD', 'OPTIONS', 'GET']

        let body: BodyInit | undefined

        if (thisRequest.body) {
          body = methodsWithoutBody.includes(method)
            ? undefined
            : JSON.stringify(thisRequest.body)
        } else {
          body = methodsWithoutBody.includes(method)
            ? undefined
            : await stream2buf(
                // @ts-ignore - NextApiRequest can be used as a readable stream
                thisRequest
              )
        }

        req = new Request(url, {
          method: method,

          headers: headers,

          body: body,

          signal: requestAbortSignals.signal,

          // @ts-ignore - duplex is not yet in TypeScript types
          ...(body ? { duplex: 'half' } : {}),
        })

        attachAbortSignals(req, requestAbortSignals)

        // @note the first arg for non-edge is the NextApiResponse object;
        // already extracted above as thisResponse for abort signal wiring
        res = thisResponse

        setContextNextApiRequest(thisRequest)
        setContextNextApiResponse(res)
      }

      let response: Response

      try {
        response = await fn(req, ...args)
      } catch (e) {
        await captureUnknownException(e)

        response = respondFromError(e)
      }

      assert(response instanceof Response, 'Response expected')

      if (isStandardRequest) {
        return withResponseCleanup(response, cleanupRequestAbortController)
      } else {
        if (response.status === 599 && response.statusText === 'DO_NOT_USE') {
          cleanupAbortListeners?.()
          cleanupRequestAbortController?.()
          // pass
        } else {
          const thisResponse = res as NextApiResponse

          const status = response.status

          thisResponse.status(status)

          const headers = response.headers

          for (const [key, value] of headers) {
            // @note skip set-cookie here; handled separately below to preserve
            // multiple Set-Cookie headers (the Headers iterator collapses them
            // into a single comma-separated value)
            if (key.toLowerCase() === 'set-cookie') {
              continue
            }

            thisResponse.setHeader(key, value)
          }

          // @note use getSetCookie() to correctly forward multiple Set-Cookie
          // headers which the Headers iterator merges incorrectly
          const setCookieHeaders = headers.getSetCookie()

          if (setCookieHeaders.length > 0) {
            thisResponse.setHeader('Set-Cookie', setCookieHeaders)
          }

          const body = response.body

          if (body instanceof ReadableStream) {
            const reader = body.getReader()

            try {
              while (true) {
                const { done, value } = await reader.read()

                if (done) {
                  break
                }

                thisResponse.write(value)
              }
            } finally {
              cleanupAbortListeners?.()
              cleanupRequestAbortController?.()
            }

            thisResponse.end()
          } else {
            cleanupAbortListeners?.()
            cleanupRequestAbortController?.()

            thisResponse.end()
          }
        }

        return undefined // @note required to return undefined
      }
    },
    { disableContextInheritance: true }
  )
}

/**
 * Handles preflight requests (HEAD and OPTIONS)
 */
function withPreflight<TArgs extends unknown[]>(
  fn: RequestHandler<TArgs>
): RequestHandler<TArgs> {
  return async function (req: Request, ...args: TArgs): Promise<Response> {
    switch (req.method) {
      case 'HEAD': {
        return send(null) // no body
      }

      case 'OPTIONS': {
        return ok() // with json body
      }
    }

    const result = await fn(req, ...args)

    return result
  }
}

/**
 * Base request handler with deferred execution
 */
function withBase<TArgs extends unknown[]>(
  fn: RequestHandler<TArgs>
): RequestHandler<TArgs> {
  return runInDeferred(async function (
    req: Request,
    ...args: TArgs
  ): Promise<Response> {
    const result = await fn(req, ...args)

    return result
  })
}

/**
 * Generic request handler that accepts any HTTP method
 */
export function withAny<TArgs extends unknown[] = []>(
  fn: RequestHandler<TArgs>
): NextApiRequestHandler<TArgs> {
  return withRequestResponse(
    withPreflight(
      withBase(async function (
        req: Request,
        ...args: TArgs
      ): Promise<Response> {
        const result = await fn(req, ...args)

        return result
      })
    )
  )
}

/**
 * Request handler that only accepts GET requests
 */
export function withGet<TArgs extends unknown[] = []>(
  fn: RequestHandler<TArgs>
): NextApiRequestHandler<TArgs> {
  return withAny(async function (
    req: Request,
    ...args: TArgs
  ): Promise<Response> {
    if (req.method !== 'GET') {
      return methodNotAllowed()
    }

    const result = await fn(req, ...args)

    return result
  })
}

/**
 * Request handler that only accepts POST requests with JSON content
 */
export function withPost<TArgs extends unknown[] = []>(
  fn: RequestHandler<TArgs>
): NextApiRequestHandler<TArgs> {
  return withAny(async function (
    req: Request,
    ...args: TArgs
  ): Promise<Response> {
    if (req.method !== 'POST') {
      return methodNotAllowed()
    }

    if (getContentTypeHeader(req) !== 'application/json') {
      return badRequest()
    }

    const result = await fn(req, ...args)

    return result
  })
}

/**
 * Request handler that only accepts POST requests with multipart/form-data
 * content
 */
export function withFormDataPost<TArgs extends unknown[] = []>(
  fn: RequestHandler<TArgs>
): NextApiRequestHandler<TArgs> {
  return withAny(async function (
    req: Request,
    ...args: TArgs
  ): Promise<Response> {
    if (req.method !== 'POST') {
      return methodNotAllowed()
    }

    if (getContentTypeHeader(req) !== 'multipart/form-data') {
      return badRequest()
    }

    const result = await fn(req, ...args)

    return result
  })
}

/**
 * Request handler that only accepts POST requests with
 * application/x-www-form-urlencoded content - used for OAuth token and
 * revocation endpoints per RFC 6749 Section 3.2 and RFC 7009 Section 2.1
 */
export function withFormUrlencodedPost<TArgs extends unknown[] = []>(
  fn: RequestHandler<TArgs>
): NextApiRequestHandler<TArgs> {
  return withAny(async function (
    req: Request,
    ...args: TArgs
  ): Promise<Response> {
    if (req.method !== 'POST') {
      return methodNotAllowed()
    }

    if (getContentTypeHeader(req) !== 'application/x-www-form-urlencoded') {
      return badRequest()
    }

    const result = await fn(req, ...args)

    return result
  })
}
