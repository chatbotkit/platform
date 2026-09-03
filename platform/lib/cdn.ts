/**
 * CDN and cache control utilities
 */
import type { ServerResponse } from 'http'

const isOnVercel =
  !!process.env.VERCEL_URL || !!process.env.NEXT_PUBLIC_VERCEL_URL

/**
 * Options for cache control headers
 */
export interface CacheControlOptions {
  /**
   * Cache duration in seconds (default: 86400 = 24 hours)
   */
  maxAge?: number

  /**
   * CDN cache duration in seconds (default: same as maxAge)
   */
  cdnMaxAge?: number

  /**
   * Vercel CDN cache duration in seconds (default: same as cdnMaxAge)
   */
  vercelMaxAge?: number

  /**
   * Browser stale-while-revalidate duration in seconds
   */
  swr?: number

  /**
   * CDN stale-while-revalidate duration in seconds
   */
  cdnSwr?: number

  /**
   * Vercel CDN stale-while-revalidate duration in seconds
   */
  vercelSwr?: number

  /**
   * Cache visibility (default: 'public')
   */
  visibility?: 'public' | 'private'

  /**
   * Whether to append the immutable directive to cache headers
   */
  immutable?: boolean
}

/**
 * Common cache duration presets
 */
export const CACHE_PRESETS = {
  /** No caching */
  NONE: { maxAge: 0, cdnMaxAge: 0, vercelMaxAge: 0 },
  /** Hub HTML pages: 10s browser, 1m CDN, 1h Vercel */
  HUB_PAGE: { maxAge: 10, cdnMaxAge: 60, vercelMaxAge: 3600 },
  /** RSS feeds: 10s browser, 1m CDN, 1h Vercel */
  RSS: { maxAge: 10, cdnMaxAge: 60, vercelMaxAge: 3600 },
  /** URL operations: 10s browser, 1m CDN, 10m Vercel */
  URL: { maxAge: 10, cdnMaxAge: 60, vercelMaxAge: 600 },
  /** Cards/Images: 10s browser, 1m CDN, 1h Vercel */
  CARD: { maxAge: 10, cdnMaxAge: 60, vercelMaxAge: 3600 },
  /**
   * Widget frame (opt-in embed caching): short freshness so a widget config
   * change propagates within ~1 minute, paired with generous
   * stale-while-revalidate so every request is served instantly (stale served +
   * async background refresh) and no visitor ever blocks on the origin.
   */
  WIDGET_FRAME: {
    maxAge: 30,
    swr: 300,
    cdnMaxAge: 60,
    cdnSwr: 3600,
    vercelMaxAge: 60,
    vercelSwr: 86400,
  },
  /** Static assets: 24h everywhere */
  STATIC: { maxAge: 86400, cdnMaxAge: 86400, vercelMaxAge: 86400 },
  /** Long-term: 1 year everywhere */
  IMMUTABLE: { maxAge: 31536000, cdnMaxAge: 31536000, vercelMaxAge: 31536000 },
} as const

/**
 * Get cache control headers for browser and CDN caching
 *
 * @note Uses max-age (not s-maxage) to ensure both browsers and CDNs cache
 * @see https://vercel.com/docs/edge-network/caching
 *
 * @param options Cache control options
 * @returns Generic cache headers plus the Vercel cache header on Vercel
 *
 * @example
 * ```ts
 * // Cache for 24 hours everywhere
 * const headers = getCacheHeaders()
 *
 * // Cache for 1 hour in browser, 24 hours in CDN
 * const headers = getCacheHeaders({ maxAge: 3600, cdnMaxAge: 86400 })
 *
 * // Private cache for 10 minutes
 * const headers = getCacheHeaders({ maxAge: 600, visibility: 'private' })
 * ```
 */
export function getCacheHeaders(
  options: CacheControlOptions = {}
): Record<string, string> {
  const {
    maxAge = 86400, // 24 hours default
    cdnMaxAge = maxAge,
    vercelMaxAge = cdnMaxAge,
    swr,
    cdnSwr = swr,
    vercelSwr = cdnSwr,
    visibility = 'public',
    immutable = false,
  } = options

  const withDirectives = (value: string, swrValue?: number) => {
    const directives = [value]

    if (swrValue != null) {
      directives.push(`stale-while-revalidate=${swrValue}`)
    }

    if (immutable) {
      directives.push('immutable')
    }

    return directives.join(', ')
  }

  const headers: Record<string, string> = {
    'Cache-Control': withDirectives(`${visibility}, max-age=${maxAge}`, swr),
    'CDN-Cache-Control': withDirectives(
      `${visibility}, max-age=${cdnMaxAge}`,
      cdnSwr
    ),
  }

  if (isOnVercel) {
    headers['Vercel-CDN-Cache-Control'] = withDirectives(
      `${visibility}, max-age=${vercelMaxAge}`,
      vercelSwr
    )
  }

  return headers
}

/**
 * Get no-cache headers to prevent any caching
 *
 * @returns Headers object that prevents caching
 */
export function getNoCacheHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'CDN-Cache-Control': 'no-store',
  }

  if (isOnVercel) {
    headers['Vercel-CDN-Cache-Control'] = 'no-store'
  }

  return headers
}

/**
 * Apply cache headers to a ServerResponse object
 *
 * @note Only applies headers in production environment
 * @param res The ServerResponse object
 * @param options Cache control options
 *
 * @example
 * ```ts
 * // In getServerSideProps
 * applyCacheHeaders(context.res, CACHE_PRESETS.RSS)
 *
 * // Custom timing
 * applyCacheHeaders(context.res, { maxAge: 3600, cdnMaxAge: 86400 })
 * ```
 */
export function applyCacheHeaders(
  res: ServerResponse,
  options: CacheControlOptions = {}
): void {
  const headers = getCacheHeaders(options)

  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
}
