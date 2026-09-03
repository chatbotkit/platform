import type { NextApiRequest } from 'next'

import { CSRF_TOKEN_COOKIE_NAME } from '@/config/cookie'

import { parse as parseCookie } from '@/lib/cookie'
import { getHeader } from '@/lib/header'

/**
 * Gets the CSRF token from the URL query parameters.
 */
export function getUrlCsrfToken(req: NextApiRequest | Request): string | null {
  if ('query' in req) {
    return (
      (Array.isArray(req.query.csrfToken)
        ? req.query.csrfToken[0]
        : req.query.csrfToken) || null
    )
  }

  const url = new URL(req.url, 'http://localhost')

  return url.searchParams.get('csrfToken') || null
}

/**
 * Gets the CSRF token from the cookies.
 */
export function getCookieCsrfToken(
  req: NextApiRequest | Request
): string | null {
  const cookie = getHeader(req, 'cookie')

  const cookies = parseCookie(cookie || '')

  return cookies.get(CSRF_TOKEN_COOKIE_NAME)?.trim() || null
}

/**
 * Gets the CSRF token from the request body.
 */
export function getBodyCsrfToken(req: NextApiRequest | Request): string | null {
  if ('body' in req) {
    return (
      (Array.isArray(req.body?.csrfToken)
        ? req.body.csrfToken[0]
        : req.body.csrfToken) || null
    )
  }

  return null
}

/**
 * Determines if the request has a valid CSRF token.
 */
export function hasCsrfToken(req: NextApiRequest | Request): boolean {
  const cookieCsrfToken = getCookieCsrfToken(req)
  const reqCsrfToken = getBodyCsrfToken(req) || getUrlCsrfToken(req)

  return !!cookieCsrfToken && !!reqCsrfToken && cookieCsrfToken === reqCsrfToken
}

/**
 * Determines if the request has the X-Requested-With header set to XMLHttpRequest.
 */
export function hasXRequestedWithHeader(
  req: NextApiRequest | Request
): boolean {
  return getHeader(req, 'x-requested-with') === 'XMLHttpRequest'
}

export function hasProtection(req: NextApiRequest | Request): boolean {
  return hasCsrfToken(req) || hasXRequestedWithHeader(req)
}
