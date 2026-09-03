import '@/lib/scope.server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import type { UnwrapPromise } from '@chatbotkit-dev/typescript-utils/promise'

import { ensureContact } from '@/lib/app.contact'
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
import type { ZodSchema } from '@/lib/zod.schema'
import schema from '@/lib/zod.schema'

export const ANY_SCHEMA = schema.record(schema.any())

interface Context {
  host?: string
  portalId?: string
}

interface AppActionError {
  code: string
  message: string
}

interface AppActionErrorResponse {
  error: AppActionError
}

/**
 * This is a helper function that creates an action handler for an app with
 * session handling and input validation built-in.
 *
 * @note we explicitly return `null` as a valid response type because it seems
 * that next.js sometimes does that for whatever reason, so we need to handle
 * that case
 */
export function appActionHandler<U, T, R>(
  app: string,
  configSchema: ZodSchema<U>,
  inputSchema: ZodSchema<T>,
  fn: (
    config: U,
    session: StoreSession,
    input: T,
    context: Context
  ) => Promise<R>
): (input: T) => Promise<R | AppActionErrorResponse | null> {
  const handler = runInContext<R | AppActionErrorResponse>(
    runInAppContext<R | AppActionErrorResponse>(async function (
      input: T
    ): Promise<R | { error: { code: string; message: string } }> {
      const thisHeaders = await headers()

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

            portalId: session.options?.portalId || undefined,
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

/**
 * This is a helper function that creates an action handler for an app with
 * session handling, contact ensuring and input validation built-in.
 */
export function appContactActionHandler<U, T, R>(
  app: string,
  namespace: string,
  configSchema: ZodSchema<U>,
  inputSchema: ZodSchema<T>,
  fn: (
    config: U,
    session: StoreSession,
    contact: UnwrapPromise<ReturnType<typeof ensureContact>>,
    input: T
  ) => Promise<R>
): (input: T) => Promise<R | AppActionErrorResponse | null> {
  return appActionHandler<U, T, R>(
    app,
    configSchema,
    inputSchema,
    async (config, session, input) => {
      const contact = await ensureContact({
        namespace: namespace,
        session: session,
        app: app,
      })

      return fn(config, session, contact, input)
    }
  )
}
