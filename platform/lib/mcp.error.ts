import { FetchError } from '@/lib/fetch'

import { McpError } from '@modelcontextprotocol/sdk/types.js'

/**
 * Rethrows an error, converting McpError to FetchError so it's treated as an
 * upstream API error and not reported to Sentry.
 *
 * @param e - The error to rethrow
 * @throws FetchError if the original error is an McpError
 * @throws The original error if it's not an McpError
 */
export function rethrowMcpError(e: unknown): never {
  if (e instanceof McpError) {
    // @note the McpError message already includes the code prefix like
    // "MCP error -32603: ..." so we preserve the full context
    // @note e.data carries useful diagnostics; for SDK-side timeouts it is
    // `{ timeout }` (30000 connect vs 60000 request), while errors relayed from
    // the remote server have `data: undefined` - surfacing it as FetchError
    // meta lets us tell these cases apart in logs

    throw new FetchError(
      e.message,
      String(e.code),
      e.data && typeof e.data === 'object'
        ? (e.data as Record<string, unknown>)
        : undefined
    )
  }

  throw e
}
