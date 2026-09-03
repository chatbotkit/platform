import '@/lib/scope.server'

import type { StoreConfig, StoreSession } from '@/lib/app.context'
import {
  getContextAppConfig,
  getContextAppSession,
  runInAppContext,
} from '@/lib/app.context'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import {
  getContextFrontendHost,
  getContextRequestHost,
  runInContext,
} from '@/lib/context.store'
import type { Stream, StreamEvent } from '@/lib/stream'
import { withStream } from '@/lib/stream'
import { captureException } from '@/lib/error'
import { withAny } from '@/lib/method'
import { parseRequestSchema } from '@/lib/request'
import { throwNotAuthenticated, throwNotAuthorized } from '@/lib/response'

import type { ZodSchema } from 'zod'

interface Context {
  host?: string
}

/**
 * This is a helper function that creates an route handler for an app with
 * session handling and input validation built-in.
 */
export function appRouteHandler<T, R extends StreamEvent = StreamEvent>(
  app: string,
  schema: ZodSchema<T>,
  fn: (
    config: StoreConfig,
    session: StoreSession,
    input: T,
    context: Context
  ) => Promise<R> | AsyncGenerator<R>
): (req: Request) => Promise<Response> {
  return withAny(
    withStream(async (req, stream) => {
      const handler = runInContext<void>(
        runInAppContext<void>(async function (
          req: Request,
          stream: Stream
        ): Promise<void> {
          const body = await parseRequestSchema(req, schema)

          // @note withAny initializes the request context before this callback
          // runs, so request metadata must be read from context rather than
          // from req headers

          const [config, session] = await Promise.all([
            getContextAppConfig(app),
            getContextAppSession(app, req),
          ])

          if (!session) {
            throwNotAuthenticated()
          }

          // @note if the session is for an app, then the config must be present

          if (session.payload.aud === APP_AUDIENCE) {
            if (!config) {
              throwNotAuthorized()
            }
          }

          try {
            let it: unknown

            it = fn(config || {}, session, body, {
              // @note authenticated frontend metadata takes precedence over
              // the ordinary request host captured at the request boundary

              host:
                getContextFrontendHost() ||
                getContextRequestHost() ||
                undefined,
            })

            if (it instanceof Promise) {
              it = await it
            }

            if (
              it &&
              typeof it === 'object' &&
              it !== null &&
              (Symbol.asyncIterator in it || Symbol.iterator in it)
            ) {
              for await (const item of it as AsyncIterable<R> | Iterable<R>) {
                await stream.push(item)
              }
            } else {
              if (it) {
                await stream.result(it)
              }
            }
          } catch (e) {
            await captureException(e)

            await stream.error(e instanceof Error ? e : new Error(String(e)))
          }
        })
      )

      await handler(req, stream)
    })
  ) as (req: Request) => Promise<Response>
}
