import type { AnyArgs } from '@chatbotkit-dev/typescript-utils/args'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { getContextRequestStartTime, getContextUser } from '@/lib/context.store'
import { createSpan, debug } from '@/lib/debug'
import { SystemError, errorToErrorResponse } from '@/lib/error'
import { getAcceptHeader } from '@/lib/header'
import { events } from '@/lib/it'
import { sleep } from '@/lib/promise'
import { getQuery } from '@/lib/query.get'
import {
  captureUnknownError,
  codeToStatusMap,
  throwBadRequest,
  throwLimitsReached,
} from '@/lib/response'

import { z } from 'zod'

export const MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS = 25 * 1000 // 25 seconds

export const MAX_WAIT_TIME_TO_NOP_IN_MILLISECONDS =
  MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS * (2 / 3) // ~16 seconds

export const MAX_WAIT_TIME_TO_STREAM_IN_MILLISECONDS =
  MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS * (3 / 4) // ~19 seconds

/**
 * Retrieves the remaining time in milliseconds for the current request.
 */
export function getRemainingWaitTime(): number {
  const startTime = getContextRequestStartTime() || Date.now()
  const elapsedTime = Date.now() - startTime

  return MAX_RESPONSE_WAIT_TIME_IN_MILLISECONDS - elapsedTime
}

export type StreamEvent =
  | { type: 'item'; data: Record<string, unknown> }
  | { type: 'result'; data: unknown }
  | { type: 'error'; data: { message: string; code: string } }
  | { type: 'nop'; data: Record<string, never> }
  | { type: 'ping'; data: Record<string, never> }
  | { type: string; data: unknown }

export interface Stream {
  push: (event: StreamEvent) => Promise<void>
  error: (error: Error) => Promise<void>
  result: (data: unknown) => Promise<void>
  nop: () => Promise<void>

  abortSignal: AbortSignal

  acceptFormat: 'json' | 'jsonl' | 'csv' | 'sse'

  hasResult: boolean
}

export type StreamHandler<TArgs extends AnyArgs = AnyArgs> = (
  req: Request,
  stream: Stream,
  ...args: TArgs
) => Promise<void>

export type StreamFunction<TArgs extends AnyArgs = AnyArgs> = (
  req: Request,
  ...args: TArgs
) => Promise<Response>

/**
 * This function takes a serverless function and converts it to a streaming
 * function that answers within the gateway's response-time limit. The handler ensures that
 * a response object is returned as soon as possible no matter if the response
 * should be streaming or not.
 */
export function withStream<TArgs extends AnyArgs = AnyArgs>(
  fn: StreamHandler<TArgs>
): StreamFunction<TArgs> {
  return async function (req: Request, ...args: TArgs): Promise<Response> {
    const span = createSpan({ name: 'withStream' })

    try {
      // setup some utility functions

      const encoder = new TextEncoder()

      // extract the accept header

      const accept = getAcceptHeader(req, 'application/json')

      // define a function that will handle the events

      const subFn = async (
        send: (event: StreamEvent) => void
      ): Promise<void> => {
        const abortController = new AbortController()

        const abortStream = (): void => {
          debug('aborting stream').log(
            'lib.stream.withStream.subFn.abortStream'
          )

          if (!abortController.signal.aborted) {
            abortController.abort(req.signal.reason)
          }
        }

        if (req.signal.aborted) {
          abortStream()
        } else {
          req.signal.addEventListener('abort', abortStream, { once: true })
        }

        const timeout = setTimeout(() => {
          send({ type: 'nop', data: {} })
        }, MAX_WAIT_TIME_TO_NOP_IN_MILLISECONDS)

        function subSend(event: StreamEvent): void {
          clearTimeout(timeout)

          return send(event)
        }

        const stream: Stream = new (class implements Stream {
          acceptFormat: 'json' | 'jsonl' | 'csv' | 'sse'

          hasResult: boolean

          abortSignal: AbortSignal

          constructor() {
            this.acceptFormat =
              {
                'application/jsonl': 'jsonl' as const,
                'text/csv': 'csv' as const,
                'text/event-stream': 'sse' as const,
              }[accept] || 'json'

            this.hasResult = false

            this.abortSignal = abortController.signal
          }

          async push(event: StreamEvent): Promise<void> {
            if (event.type === 'result' || event.type === 'error') {
              this.hasResult = true
            }

            subSend(event)
          }

          async error(error: Error): Promise<void> {
            if (this.hasResult) {
              return
            }

            this.hasResult = true

            subSend({ type: 'error', data: errorToErrorResponse(error) })
          }

          async result(data: unknown): Promise<void> {
            if (this.hasResult) {
              return
            }

            this.hasResult = true

            subSend({ type: 'result', data })
          }

          async nop(): Promise<void> {
            subSend({ type: 'nop', data: {} })
          }
        })()

        const span = createSpan({ name: 'withStream.fn' })

        try {
          return await fn(req, stream, ...args)
        } finally {
          req.signal.removeEventListener('abort', abortStream)

          span.finish()
        }
      }

      // create an event generator

      const gen = events(subFn)

      // decide how to respond based on the accept header

      if (false) {
      } else if (['application/json'].includes(accept)) {
        // the client is expecting a json response, which is non-streaming

        // get a promise to the result

        const result = (async (): Promise<unknown> => {
          for await (const event of gen) {
            switch (event.type) {
              case 'result': {
                return event.data
              }

              case 'error': {
                // @todo the original error type (e.g. FetchError) is lost here
                // because we only serialize message/code - this causes upstream
                // API errors to be reported to Sentry even when the handler
                // intentionally skipped capture

                const errorData = event.data as {
                  message: string
                  code: string
                }

                throw new SystemError(errorData.message, errorData.code)
              }
            }
          }
        })()

        // start a race to switch between non-streaming and streaming response
        // as a fallback mechanism for long-running functions

        return await Promise.race([
          // non-streaming response

          (async (): Promise<Response> => {
            try {
              // await for the result data

              const data = await result

              // return the data as a json response

              return new Response(JSON.stringify(data), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              })
            } catch (e) {
              // capture the error

              await captureUnknownError(e)

              // convert the error

              const error = errorToErrorResponse(e)

              // return the error as a json response

              return new Response(JSON.stringify(error), {
                status: codeToStatusMap[error.code] || 500,
                headers: { 'content-type': 'application/json' },
              })
            }
          })(),

          // streaming response

          (async (): Promise<Response> => {
            // sleep to allow the non-streaming response to be returned first

            await sleep(
              Math.min(
                MAX_WAIT_TIME_TO_STREAM_IN_MILLISECONDS,
                getRemainingWaitTime()
              )
            )

            // return a streaming response

            return new Response(
              new ReadableStream({
                async start(controller) {
                  try {
                    // await for the result data

                    const data = await result

                    // enqueue the data

                    controller.enqueue(encoder.encode(JSON.stringify(data)))
                  } catch (e) {
                    // @note this is not perfect because the status code is
                    // always 200 but it is better than nothing

                    // capture the error

                    await captureUnknownError(e)

                    // convert the error

                    const error = errorToErrorResponse(e)

                    // enqueue the error

                    controller.enqueue(encoder.encode(JSON.stringify(error)))
                  }

                  controller.close()

                  return
                },
              }),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              }
            )
          })(),
        ])
      } else if (
        ['application/jsonl', 'text/csv', 'text/event-stream'].includes(accept)
      ) {
        // the client is expecting a streaming response

        const first = await gen.next()

        // check if the generator is done, then there are no values

        if (first.done) {
          return new Response(
            new ReadableStream({
              async start(controller) {
                controller.close()
              },
            }),
            { status: 200, headers: { 'content-type': accept } }
          )
        }

        // return a streaming response

        return new Response(
          new ReadableStream({
            async start(controller) {
              let enqueue:
                | ((value: StreamEvent, index: number) => Promise<void>)
                | undefined

              // determine the enqueue function based on the accept header

              switch (true) {
                case accept === 'application/jsonl': {
                  enqueue = async (value: StreamEvent): Promise<void> => {
                    controller.enqueue(
                      encoder.encode(JSON.stringify(value) + '\n')
                    )
                  }

                  break
                }

                case accept === 'text/csv': {
                  enqueue = async (
                    value: StreamEvent,
                    index: number
                  ): Promise<void> => {
                    const { type, data } = value

                    if (type !== 'item') {
                      return
                    }

                    const itemData = data as Record<string, unknown>

                    if (index === 0) {
                      const header: string[] = []

                      for (const field in itemData) {
                        header.push(field)
                      }

                      controller.enqueue(
                        encoder.encode(header.join(',') + '\n')
                      )
                    }

                    const row: string[] = []

                    for (const field in itemData) {
                      row.push(
                        `"${
                          itemData[field]?.toString().replace(/"/g, '""') || ''
                        }"`
                      )
                    }

                    controller.enqueue(encoder.encode(row.join(',') + '\n'))
                  }

                  break
                }

                case accept === 'text/event-stream': {
                  enqueue = async (value: StreamEvent): Promise<void> => {
                    const { type, data } = value

                    const sseMessage = `event: ${type}\ndata: ${JSON.stringify(
                      data
                    )}\n\n`

                    controller.enqueue(encoder.encode(sseMessage))

                    // @todo add stream closure event
                  }

                  break
                }

                default: {
                  throwBadRequest('Unsupported accept header')
                }
              }

              // throw an error if the enqueue function is not defined

              if (!enqueue) {
                throwBadRequest('Unsupported accept header')
              }

              // set index

              let index = 0

              // enqueue the first value

              await enqueue(first.value, index++)

              try {
                // enqueue the rest of the values

                for await (const value of gen) {
                  await enqueue(value, index++)
                }
              } catch (e) {
                // capture the error

                await captureUnknownError(e)

                // convert the error

                const error = errorToErrorResponse(e)

                // enqueue the error

                await enqueue({ type: 'error', data: error }, index++)
              }

              // close the controller

              await controller.close()

              return
            },
          }),
          { status: 200, headers: { 'content-type': accept } }
        )
      } else {
        // the accept header is not supported

        throwBadRequest('Unsupported accept header')
      }
    } catch (e) {
      // capture the error

      await captureUnknownError(e)

      // convert the error

      const error = errorToErrorResponse(e)

      // return the error as a json response

      return new Response(JSON.stringify(error), {
        status: codeToStatusMap[error.code] || 500,
        headers: { 'content-type': 'application/json' },
      })
    } finally {
      span.finish()
    }
  }
}

/**
 * A simple stream wrapper that will continue to ping until the wrapped
 * function finish execution. We deliberately choose a default interval of
 * 10,000 because lower values are likely to submit the ping event before any
 * potentially erroring methods push into the stream.
 */
export function withStreamPing<TArgs extends AnyArgs = AnyArgs>(
  fn: StreamHandler<TArgs>,
  interval: number = 10_000
): StreamFunction<TArgs> {
  return withStream<TArgs>(async function (
    req: Request,
    stream: Stream,
    ...args: TArgs
  ): Promise<void> {
    const pingInterval = setInterval(async () => {
      await stream.push({ type: 'ping', data: {} })
    }, interval)

    try {
      await fn(req, stream, ...args)
    } catch (e) {
      await stream.error(e instanceof Error ? e : new Error(String(e)))
    } finally {
      clearInterval(pingInterval)
    }

    await stream.result({ ping: true })
  })
}

/**
 * A simple stream wrapper that offers a basic continuity mechanism for work
 * that exceeds the gateway's response-time limit.
 */
export function withStreamContinuity<TArgs extends AnyArgs = AnyArgs>(
  fn: StreamHandler<TArgs>
): StreamFunction<TArgs> {
  return withStreamPing<TArgs>(async function (
    req: Request,
    stream: Stream,
    ...args: TArgs
  ): Promise<void> {
    try {
      await fn(req, stream, ...args)
    } catch (e) {
      await stream.error(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

export type StreamCursorHandlerResult = {
  items: Record<string, unknown>[]
  /**
   * Optional cursor for fetching the next page. When provided, this value
   * will be used instead of the last item's ID for pagination.
   *
   * @note This is required for vector stores (like Qdrant) that use
   * store-specific cursor formats (UUIDs) instead of record IDs (CUIDs).
   *
   * @note Set to `null` to explicitly signal that there are no more pages.
   * This is required for vector stores that return a null/undefined cursor
   * when there are no more records to paginate, as falling back to the last
   * item's CUID would cause an invalid point ID error in Qdrant.
   */
  cursor?: string | null
}

export type StreamCursorHandler<TArgs extends AnyArgs = AnyArgs> = (
  cursor: string | undefined,
  req: Request,
  stream: Stream,
  ...args: TArgs
) => Promise<StreamCursorHandlerResult>

/**
 * A simple stream wrapper that offers a basic pagination mechanism for
 * function that return list of items. The function maintains the cursor and
 * the results.
 */
export function withStreamCursor<TArgs extends AnyArgs = AnyArgs>(
  fn: StreamCursorHandler<TArgs>
): StreamFunction<TArgs> {
  return withStream<TArgs>(async function (
    req: Request,
    stream: Stream,
    ...args: TArgs
  ): Promise<void> {
    let query: { cursor?: string; take?: string }

    try {
      query = z
        .object({
          cursor: z.string().optional(),
          take: z.string().optional(),
        })
        .parse(Object.fromEntries(getQuery(req)))
    } catch {
      throwBadRequest()
    }

    let cursor = query.cursor || undefined
    let take = query.take ? parseInt(query.take, 10) || Infinity : Infinity

    debug(`starting stream cursor`, { cursor, take })

    // check rate limits
    {
      const pathname = new URL(req.url, 'https://chatbotkit.com').pathname

      if (pathname.endsWith('/list')) {
        const user = getContextUser()

        if (user?.id) {
          const context = { exceededLimits: [] }

          const { constructExceededRateLimitsMessage, rateLimitsOk } =
            await import('@/lib/limit.core')

          if (!(await rateLimitsOk(user, ['rate/poll'], context))) {
            throwLimitsReached(
              constructExceededRateLimitsMessage(context.exceededLimits)
            )
          }
        }
      }
    }

    for (;;) {
      // We do not catch error as the assumption is that any errors thrown will
      // be handled by other wrappers

      const { items, cursor: resultCursor } = await fn(
        cursor,
        req,
        stream,
        ...args
      )

      if (false) {
        // The reason we do not use a switch statement, which is the preferred
        // way to handle multiple conditions, is because we need to use the
        // `break` statement to exit the loop.
      } else if (stream.acceptFormat === 'jsonl') {
        if (!items.length) {
          break
        }

        for (const item of items) {
          await stream.push({ type: 'item', data: item })
        }

        // @note use result cursor when provided (required for vector stores
        // that use UUIDs), otherwise fall back to last item's ID for backwards
        // compatibility with database-backed pagination

        // @note null cursor means explicit end-of-pages from the handler
        if (resultCursor === null) {
          break
        }

        cursor = resultCursor ?? (items[items.length - 1].id as string)
      } else if (stream.acceptFormat === 'csv') {
        if (!items.length) {
          break
        }

        for (const item of items) {
          await stream.push({ type: 'item', data: item })
        }

        // @note null cursor means explicit end-of-pages from the handler
        if (resultCursor === null) {
          break
        }

        cursor = resultCursor ?? (items[items.length - 1].id as string)
      } else if (stream.acceptFormat === 'sse') {
        if (!items.length) {
          break
        }

        for (const item of items) {
          await stream.push({ type: 'item', data: item })
        }

        // @note null cursor means explicit end-of-pages from the handler
        if (resultCursor === null) {
          break
        }

        cursor = resultCursor ?? (items[items.length - 1].id as string)
      } else if (stream.acceptFormat === 'json') {
        // @note include cursor in response for manual pagination support

        const nextCursor =
          resultCursor !== undefined
            ? resultCursor // explicit cursor (string) or null (end of pages)
            : items.length
            ? (items[items.length - 1].id as string)
            : undefined

        await stream.result({ items, cursor: nextCursor })

        // @note it is super important that we break here because we do not want
        // to continue the loop if the function is not streaming, the code that
        // follows is only for streaming and irrelevant for this condition

        break
      } else {
        assertUnreachable(stream.acceptFormat)
      }

      take -= items.length

      if (take <= 0) {
        break
      }
    }
  })
}

/**
 * @manual Streaming
 * @description Learn how to use streaming responses with the ChatBotKit API to efficiently handle large datasets, long-running operations, and real-time updates by controlling the Accept header in your requests.
 * @category API
 * @tags streaming, api, jsonl, sse, csv, response-formats
 *
 * ## Overview
 *
 * ChatBotKit API endpoints support both streaming and non-streaming responses,
 * allowing you to receive data incrementally as it becomes available or wait
 * for a complete response. Streaming is particularly useful for large datasets,
 * long-running operations, and real-time updates.
 *
 * ## How Streaming Works
 *
 * The API determines whether to stream responses based on the `Accept` header
 * you send with your request:
 *
 * - **Non-streaming (default)**: Set `Accept: application/json` to receive
 *   a complete JSON response once the operation finishes
 * - **Streaming**: Set `Accept` to a streaming format (`application/jsonl`,
 *   `text/event-stream`, or `text/csv`) to receive data incrementally
 *
 * For non-streaming requests that take longer than expected, the API
 * automatically falls back to streaming mode to ensure you receive data
 * before any timeout limits.
 *
 * ## Supported Response Formats
 *
 * ### JSON (Non-Streaming)
 *
 * **Accept Header**: `application/json`
 *
 * Returns a complete JSON response when the operation finishes. This is the
 * default format and is ideal for most API calls that return small amounts
 * of data quickly.
 *
 * **Example Request**:
 *
 * ```http
 * GET /api/v1/bot/list HTTP/1.1
 * Accept: application/json
 * Authorization: Bearer YOUR_API_KEY
 * ```
 *
 * **Example Response**:
 *
 * ```json
 * {
 *   "items": [
 *     {"id": "bot1", "name": "My Bot"},
 *     {"id": "bot2", "name": "Another Bot"}
 *   ],
 *   "cursor": "bot2"
 * }
 * ```
 *
 * The `cursor` value can be passed as a query parameter to fetch the next page
 * of results: `GET /api/v1/bot/list?cursor=bot2`
 *
 * ### JSON Lines (Streaming)
 *
 * **Accept Header**: `application/jsonl`
 *
 * Returns newline-delimited JSON objects, with each line representing a
 * separate event. This format is ideal for processing large datasets or
 * receiving real-time updates as they occur.
 *
 * **Example Request**:
 *
 * ```http
 * GET /api/v1/bot/list HTTP/1.1
 * Accept: application/jsonl
 * Authorization: Bearer YOUR_API_KEY
 * ```
 *
 * **Example Response**:
 *
 * ```json
 * {"type":"item","data":{"id":"bot1","name":"My Bot"}}
 * {"type":"item","data":{"id":"bot2","name":"Another Bot"}}
 * {"type":"result","data":{"complete":true}}
 * ```
 *
 * ### Server-Sent Events (Streaming)
 *
 * **Accept Header**: `text/event-stream`
 *
 * Returns data using the Server-Sent Events (SSE) protocol, which is designed
 * for real-time server-to-client communication. This format works seamlessly
 * with the browser's built-in `EventSource` API.
 *
 * **Example Request**:
 *
 * ```http
 * GET /api/v1/bot/list HTTP/1.1
 * Accept: text/event-stream
 * Authorization: Bearer YOUR_API_KEY
 * ```
 *
 * **Example Response**:
 *
 * ```http
 * event: item
 * data: {"id":"bot1","name":"My Bot"}
 *
 * event: item
 * data: {"id":"bot2","name":"Another Bot"}
 *
 * event: result
 * data: {"complete":true}
 * ```
 *
 * ### CSV (Streaming)
 *
 * **Accept Header**: `text/csv`
 *
 * Returns data in CSV (Comma-Separated Values) format with headers automatically
 * generated from the first data item. This format is ideal for data exports and
 * spreadsheet applications.
 *
 * **Example Request**:
 *
 * ```http
 * GET /api/v1/bot/list HTTP/1.1
 * Accept: text/csv
 * Authorization: Bearer YOUR_API_KEY
 * ```
 *
 * **Example Response**:
 *
 * ```csv
 * id,name
 * "bot1","My Bot"
 * "bot2","Another Bot"
 * ```
 *
 * ## Stream Event Types
 *
 * When using streaming formats (JSON Lines or Server-Sent Events), the API
 * sends different types of events:
 *
 * - **`item`**: Individual data records (e.g., each bot, conversation, or file)
 * - **`result`**: Final result indicating the operation is complete
 * - **`error`**: Error information if something goes wrong
 * - **`nop`**: Keep-alive signal sent during long operations to maintain the connection
 * - **`ping`**: Periodic heartbeat to ensure the connection stays active
 *
 * ## When to Use Streaming
 *
 * Choose streaming when you need:
 *
 * - **Large datasets**: Listing hundreds or thousands of items
 * - **Long-running operations**: Tasks that may take more than a few seconds
 * - **Real-time updates**: Progress notifications or live event feeds
 * - **Data exports**: Downloading data for backup or analysis
 * - **Better user experience**: Show data as it arrives instead of waiting
 *
 * Choose non-streaming (JSON) when you need:
 *
 * - **Small responses**: Single records or small lists
 * - **Fast operations**: Quick lookups or updates
 * - **Simpler code**: Standard REST API patterns without streaming complexity
 *
 * ## Best Practices
 *
 * 1. **Handle connection interruptions**: Implement retry logic for streaming
 *    connections that may be interrupted
 * 2. **Process events incrementally**: Don't wait for the entire stream to complete
 *    before processing data
 * 3. **Use appropriate timeouts**: Set reasonable timeout values for both streaming
 *    and non-streaming requests
 * 4. **Monitor keep-alive events**: Watch for `nop` and `ping` events to detect
 *    connection health
 * 5. **Close connections properly**: Always close streaming connections when done
 *    to free up resources
 */
