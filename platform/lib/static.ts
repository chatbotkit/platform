import type {
  GetStaticPathsResult,
  GetStaticPropsContext,
  GetStaticPropsResult,
} from 'next'

import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import { applyCacheHeaders } from '@/lib/cdn'
import { isProduction } from '@/lib/env'

import type { ServerResponse } from 'http'
import type { ParsedUrlQuery } from 'querystring'

/**
 * Extended context for ISR (Incremental Static Regeneration) requests.
 * Includes additional query parameters for preview mode detection.
 *
 * @note this extends GetStaticPropsContext with runtime properties available during ISR
 */
interface ExtendedStaticPropsContext extends GetStaticPropsContext {
  query?: ParsedUrlQuery & {
    preview?: string
  }
}

/**
 * Extended context for cache-enabled static props functions.
 * Includes response object for setting HTTP cache headers.
 *
 * @note res is available during ISR when the page is regenerated on-demand
 */
interface CacheableStaticPropsContext extends GetStaticPropsContext {
  res: ServerResponse
}

/**
 * Function signature for Next.js getStaticProps with ISR support.
 * Accepts an extended context object and returns a promise resolving to static props result.
 *
 * @template P - The type of props returned on success
 */
type GetStaticPropsFunction<P extends Record<string, unknown>> = (
  context: ExtendedStaticPropsContext
) => Promise<GetStaticPropsResult<P>>

/**
 * Function signature for cache-enabled getStaticProps.
 * Requires context with response object for setting cache headers.
 *
 * @template P - The type of props returned on success
 */
type CacheableGetStaticPropsFunction<P extends Record<string, unknown>> = (
  context: CacheableStaticPropsContext
) => Promise<GetStaticPropsResult<P>>

/**
 * Wraps a getStaticProps function to automatically add revalidation settings.
 * In production (unless preview mode or SKIP_STATIC_REVALIDATION is set),
 * adds a one-hour revalidation period. Otherwise, disables revalidation.
 *
 * @template P - The type of props returned by the wrapped function
 * @param fn - The getStaticProps function to wrap
 * @returns A wrapped function with automatic revalidation handling
 */
export function withRevalidation<P extends Record<string, unknown>>(
  fn: GetStaticPropsFunction<P>
): GetStaticPropsFunction<P> {
  return async function (
    context: ExtendedStaticPropsContext,
    ...args: unknown[]
  ): Promise<GetStaticPropsResult<P>> {
    // @note pass through additional arguments for backward compatibility

    const result = await (
      fn as (
        context: ExtendedStaticPropsContext,
        ...args: unknown[]
      ) => Promise<GetStaticPropsResult<P>>
    )(context, ...args)

    if (result && 'props' in result) {
      return {
        ...result,

        revalidate:
          isProduction &&
          context.query?.preview !== 'true' &&
          !process.env.SKIP_STATIC_REVALIDATION
            ? ONE_HOUR_IN_SECONDS
            : false,
      }
    } else {
      return result
    }
  }
}

/**
 * Represents route parameters for static path generation.
 * Keys are dynamic segment names, values are the segment values.
 */
type StaticPathParams = Record<string, string | string[]>

/**
 * Function signature for Next.js getStaticPaths.
 * Returns paths to pre-render and fallback behavior.
 */
type GetStaticPathsFunction = () => Promise<
  GetStaticPathsResult<StaticPathParams>
>

/**
 * Wraps a getStaticPaths function to control static generation behavior.
 * When SKIP_STATIC_GENERATION env var is set, returns empty paths with blocking fallback.
 * Otherwise, executes the wrapped function and forces blocking fallback.
 *
 * @param fn - The getStaticPaths function to wrap
 * @returns A wrapped function with controlled generation behavior
 */
export function withGeneration(
  fn: GetStaticPathsFunction
): GetStaticPathsFunction {
  return async function (): Promise<GetStaticPathsResult<StaticPathParams>> {
    if (process.env.SKIP_STATIC_GENERATION) {
      return {
        paths: [],

        fallback: 'blocking',
      }
    }

    const result = await fn()

    result.fallback = 'blocking'

    return result
  }
}

/**
 * Cache timing configuration as a tuple of three duration values in seconds.
 * [browserCacheDuration, cdnCacheDuration, vercelCacheDuration]
 */
type CacheTimingTuple = readonly [
  browserCacheSeconds: number,
  cdnCacheSeconds: number,
  vercelCacheSeconds: number,
]

/**
 * Configuration options for the withCache wrapper.
 */
interface WithCacheOptions {
  /**
   * Cache duration settings in seconds.
   * @default [10, 60, 3600] - 10s browser, 60s CDN, 3600s on Vercel
   */
  timing?: CacheTimingTuple
}

/**
 * Default cache timing values used when no custom timing is provided.
 */
const DEFAULT_CACHE_TIMING: CacheTimingTuple = [
  10, // browser caching for 10 seconds
  60, // CDN caching for 60 seconds
  3600, // Vercel caching for 3600 seconds when running there
] as const

/**
 * Default set of request headers that should be considered when varying cached
 * responses by host.
 */
const HOST_AWARE_VARY_HEADERS = [
  'host', // vary by host header to support multi-tenant scenarios
]

function appendVaryHeaders(res: ServerResponse, values: string[]) {
  const existing =
    typeof res.getHeader === 'function' ? res.getHeader('Vary') : undefined

  const currentValues = Array.isArray(existing)
    ? existing.join(',').split(',')
    : String(existing || '').split(',')

  const merged = [...currentValues, ...values]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter(
      (value, index, array) =>
        array.findIndex(
          (item) => item.toLowerCase() === value.toLowerCase()
        ) === index
    )

  if (merged.length > 0) {
    res.setHeader('Vary', merged.join(', '))
  }
}

/**
 * Wraps a getStaticProps function to set HTTP cache headers in production.
 * Sets generic cache headers when the result contains props, adds the
 * Vercel-specific header when the CDN helper detects Vercel, and
 * varies cached HTML by host-related request headers because `_document` can
 * render different partner metadata for the same route on different hosts.
 *
 * @template P - The type of props returned by the wrapped function
 * @param fn - The getStaticProps function to wrap
 * @param options - Optional cache configuration
 * @returns A wrapped function that sets cache headers
 */
export function withCache<P extends Record<string, unknown>>(
  fn: CacheableGetStaticPropsFunction<P>,
  options?: WithCacheOptions
): CacheableGetStaticPropsFunction<P> {
  const { timing = DEFAULT_CACHE_TIMING } = options || {}

  return async function (
    context: CacheableStaticPropsContext,
    ...args: unknown[]
  ): Promise<GetStaticPropsResult<P>> {
    // @note pass through additional arguments for backward compatibility

    const result = await (
      fn as (
        context: CacheableStaticPropsContext,
        ...args: unknown[]
      ) => Promise<GetStaticPropsResult<P>>
    )(context, ...args)

    if (result && 'props' in result) {
      if (isProduction) {
        applyCacheHeaders(context.res, {
          maxAge: timing[0],
          cdnMaxAge: timing[1],
          vercelMaxAge: timing[2],
        })

        appendVaryHeaders(context.res, HOST_AWARE_VARY_HEADERS)
      }
    }

    return result
  }
}
