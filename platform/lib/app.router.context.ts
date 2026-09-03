import '@/lib/scope.server'

import { headers } from 'next/headers'

import { setupHeadersContext } from '@/lib/context.setup'
import { runInContext } from '@/lib/context.store'

type AppRouterFunction = (...args: never[]) => unknown

/**
 * Runs one App Router entry point with the request metadata available to
 * Server Components. Next.js executes layouts and metadata functions
 * independently, so a parent layout's async context does not cover them.
 */
export function withAppRouterContext<Fn extends AppRouterFunction>(fn: Fn): Fn {
  const wrapped = async (...args: never[]) => {
    const requestHeaders = await headers()

    const execute = runInContext(
      async () => {
        // @note server components expose headers but not the complete request
        setupHeadersContext(requestHeaders)

        return await fn(...args)
      },
      { disableContextInheritance: true }
    )

    return await execute()
  }

  return wrapped as Fn
}
