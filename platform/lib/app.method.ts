import '@/lib/scope.server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import type { StoreSession } from '@/lib/app.context'
import {
  getContextAppConfig,
  getContextAppSession,
  runInAppContext,
} from '@/lib/app.context'
import { APP_AUDIENCE } from '@/lib/audience.consts'
import { setupHeadersContext } from '@/lib/context.setup'
import {
  getContextFrontendHost,
  getContextRequestHost,
  runInContext,
} from '@/lib/context.store'
import { captureException } from '@/lib/error'

import type { ZodSchema } from 'zod'
import schema from 'zod'

export const ANY_SCHEMA = schema.record(schema.any())

interface Context {
  host?: string
}

interface AppActionError {
  code: string
  message: string
}

interface AppActionErrorResponse {
  error: AppActionError
}

/**
 * This is a helper function that creates a method handler for an app with
 * session handling and input validation built-in. A method handler is a handler
 * that is not exposed as an action but it has the properties and behavior of an
 * action handler. This method must be used in without the 'use server'
 * directive.
 */
export function appMethodHandler<U, T, R>(
  app: string,
  configSchema: ZodSchema<U>,
  inputSchema: ZodSchema<T>,
  fn: (
    config: U,
    session: StoreSession,
    input: T,
    context: Context
  ) => Promise<R>,
  notExported?: boolean
): (input: T) => Promise<R | AppActionErrorResponse> {
  const handler = runInContext<R | AppActionErrorResponse>(
    runInAppContext<R | AppActionErrorResponse>(async function (
      input: T
    ): Promise<R | { error: { code: string; message: string } }> {
      const thisHeaders = await headers()

      if (!notExported) {
        if (thisHeaders.has('next-action')) {
          return {
            error: {
              code: 'method_not_allowed',
              message: 'This method is not allowed in this context.',
            },
          }
        }
      }

      setupHeadersContext(thisHeaders)

      const [config, session] = await Promise.all([
        getContextAppConfig(app),
        getContextAppSession(app),
      ])

      if (!session) {
        // @todo add the current pathname somehow
        // @todo or redirect to error

        return redirect(`/signin`)
      }

      // @note if the session is for an app, then the config must be present

      if (session.payload.aud === APP_AUDIENCE) {
        if (!config) {
          // @todo add the current pathname somehow
          // @todo or redirect to error

          return redirect(`/signin`)
        }
      }

      try {
        const it = await fn(
          await configSchema.parseAsync(config || {}),
          session,
          await inputSchema.parseAsync(input),
          {
            // @note authenticated frontend metadata takes precedence over the
            // ordinary request host captured at the request boundary

            host:
              getContextFrontendHost() || getContextRequestHost() || undefined,
          }
        )

        return it
      } catch (e) {
        await captureException(e)

        return {
          error: {
            code: e.code,
            message: e.message,
          },
        }
      }
    })
  )

  return handler
}
