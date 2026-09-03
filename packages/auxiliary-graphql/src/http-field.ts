/**
 * HTTP Field Helper for Pothos GraphQL
 *
 * This module provides utilities for creating GraphQL fields that automatically
 * make HTTP requests and handle responses.
 */

/**
 * HTTP request configuration for automatic resolver generation
 */
export interface HttpFieldConfig<TArgs = Record<string, unknown>> {
  // @note http method to use
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

  // @note url template (can use {arg} placeholders) or function
  url: string | ((args: TArgs) => string)

  // @note optional headers
  headers?: Record<string, string> | ((args: TArgs) => Record<string, string>)

  // @note optional body transformer (for POST/PUT/PATCH)
  body?: (args: TArgs) => unknown

  // @note optional response transformer
  transform?: (response: unknown) => unknown

  // @note optional error handler
  onError?: (error: Error) => unknown
}

/**
 * Creates an HTTP field resolver that automatically handles requests
 *
 * @example
 * ```typescript
 * search: t.field({
 *   type: SearchResult,
 *   args: { query: t.arg.string({ required: true }) },
 *   ...createHttpField({
 *     method: 'GET',
 *     url: (args) => `https://api.example.com/search?q=${args.query}`,
 *     headers: { 'Authorization': 'Bearer token' },
 *     transform: (data) => ({ items: data.results, total: data.count })
 *   })
 * })
 * ```
 */
export function createHttpField<TArgs = Record<string, unknown>>(
  config: HttpFieldConfig<TArgs>
) {
  return {
    resolve: async (_parent: unknown, args: TArgs) => {
      try {
        // @note build url from template or function
        const url =
          typeof config.url === 'function'
            ? config.url(args)
            : config.url.replace(/\{(\w+)\}/g, (_, key) =>
                encodeURIComponent(
                  String((args as Record<string, unknown>)[key] || '')
                )
              )

        // @note build headers
        const headers =
          typeof config.headers === 'function'
            ? config.headers(args)
            : config.headers || {}

        // @note build request body if applicable
        const body =
          config.body && ['POST', 'PUT', 'PATCH'].includes(config.method)
            ? JSON.stringify(config.body(args))
            : undefined

        // @note make http request using native fetch (this is a runtime-agnostic library package)
        // eslint-disable-next-line no-restricted-globals
        const response = await fetch(url, {
          method: config.method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        // @note transform response if transformer provided
        return config.transform ? config.transform(data) : data
      } catch (error) {
        // @note handle error if handler provided
        if (config.onError) {
          return config.onError(
            error instanceof Error ? error : new Error(String(error))
          )
        }

        throw error
      }
    },
  }
}
