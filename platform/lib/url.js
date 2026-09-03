// @ts-check
import { siteUrl } from '@/config/site'

import { getRootDomain } from '@/lib/domain'

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isURL(url) {
  try {
    new URL(url)

    return true
  } catch {
    return false
  }
}

/**
 * @param {string|URL} url
 * @returns {boolean}
 */
export function isHTTPURL(url) {
  try {
    const u = new URL(url)

    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * @typedef {{
 *   query?: Record<string, string>,
 *   isDir?: boolean,
 *   noQuery?: boolean,
 *   noFragment?: boolean
 * }} UrlTransformationOptions
 *
 * @param {string|URL} input
 * @param {string|URL} [base]
 * @param {UrlTransformationOptions} [options]
 * @returns {string}
 * @throws {Error}
 */
export function url(input, base = siteUrl, options = {}) {
  const u = new URL(input, base)

  u.pathname = u.pathname.replace(/\/+/g, '/')

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      u.searchParams.set(key, value)
    }
  }

  if (options.isDir && !u.pathname.endsWith('/')) {
    u.pathname += '/'
  }

  if (options.noQuery) {
    u.search = ''
  }

  if (options.noFragment) {
    u.hash = ''
  }

  return u.toString()
}

/**
 * @param {string|URL} input
 * @param {string|URL} [base]
 * @param {UrlTransformationOptions} [options]
 * @returns {string|null}
 */
export function tryUrl(input, base = siteUrl, options) {
  try {
    return url(input, base, options)
  } catch {
    return null
  }
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string}
 * @throws {Error}
 */
export function hostname(url, base) {
  return new URL(url, base).hostname
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string|null}
 */
export function tryHostname(url, base) {
  try {
    return hostname(url, base)
  } catch {
    return null
  }
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string}
 * @throws {Error}
 * @todo rename the function to use the same naming convention as in domain.ts
 */
export function domain(url, base) {
  return getRootDomain(hostname(url, base))
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string|null}
 * @todo rename the function to use the same naming convention as in domain.ts
 */
export function tryDomain(url, base) {
  try {
    return domain(url, base)
  } catch {
    return null
  }
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string}
 */
export function pathname(url, base) {
  const u = new URL(url, base)

  return u.pathname
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string|null}
 */
export function tryPathname(url, base) {
  try {
    return pathname(url, base)
  } catch {
    return null
  }
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string}
 */
export function pathquery(url, base = siteUrl) {
  const u = new URL(url, base)

  return u.pathname + u.search
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string|null}
 */
export function tryPathquery(url, base = siteUrl) {
  try {
    return pathquery(url, base)
  } catch {
    return null
  }
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {URLSearchParams}
 */
export function query(url, base = siteUrl) {
  const u = new URL(url, base)

  return u.searchParams
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {URLSearchParams|null}
 */
export function tryQuery(url, base = siteUrl) {
  try {
    return query(url, base)
  } catch {
    return null
  }
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string}
 */
export function hash(url, base = siteUrl) {
  const u = new URL(url, base)

  return u.hash
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string|null}
 */
export function tryHash(url, base = siteUrl) {
  try {
    return hash(url, base)
  } catch {
    return null
  }
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {URLSearchParams}
 */
export function hashQuery(url, base = siteUrl) {
  const u = new URL(url, base)

  return new URLSearchParams(u.hash.slice(1))
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {URLSearchParams|null}
 */
export function tryHashQuery(url, base = siteUrl) {
  try {
    return hashQuery(url, base)
  } catch {
    return null
  }
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string|null}
 */
export function filename(url, base = siteUrl) {
  const u = new URL(url, base)

  let f = u.pathname.split('/').pop() || null

  if (f) {
    try {
      f = decodeURIComponent(f)
    } catch {
      // if decoding fails, fall back to the original value
    }
  }

  return f
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string|null}
 */
export function tryFilename(url, base = siteUrl) {
  try {
    return filename(url, base)
  } catch {
    return null
  }
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string|null}
 */
export function extname(url, base = siteUrl) {
  const u = new URL(url, base)

  const e = u.pathname
    .split('/')
    .pop()
    ?.match(/(\.[^.]+)$/)

  if (e) {
    return e[1]
  } else {
    return null
  }
}

/**
 * @param {string|URL} url
 * @param {string|URL} [base]
 * @returns {string|null}
 */
export function tryExtname(url, base = siteUrl) {
  try {
    return extname(url, base)
  } catch {
    return null
  }
}

/**
 * @param {string} url
 * @param {string} prefix
 * @returns {string}
 */
export function withPathnamePrefix(url, prefix) {
  const u = new URL(url, siteUrl)

  u.pathname = prefix + u.pathname

  return u.toString()
}

/**
 * @param {...string} paths
 * @returns {string}
 * @deprecated Use `join` from `@/lib/path` instead.
 */
export function joinPaths(...paths) {
  return paths
    .filter((p) => !!p)
    .map((p) => p.trim().replace(/\/+$/, ''))
    .join('/')
    .replace(/\/+/g, '/')
}

/**
 * Checks that both urls have a common root.
 *
 * @param {string|URL} urlA
 * @param {string|URL} urlB
 * @returns {boolean}
 */
export function sameRoot(urlA, urlB) {
  const a = new URL(url(urlA))
  const b = new URL(url(urlB))

  if (a.protocol !== b.protocol) {
    return false
  }

  if (a.hostname !== b.hostname) {
    return false
  }

  const pathA = a.pathname.split('/').filter((p) => !!p)
  const pathB = b.pathname.split('/').filter((p) => !!p)

  const length = Math.min(pathA.length, pathB.length)

  let common = false

  for (let i = 0; i < length; i++) {
    if (pathA[i] !== pathB[i]) {
      break
    }

    common = true
  }

  return common
}

/**
 * @param {...string} paths
 * @returns {string}
 * @deprecated
 */
export function joinPathsAndGetPathname(...paths) {
  const url = paths.filter((p) => !!p).join('/')

  return new URL(url, siteUrl).pathname.replace(/\/+/g, '/').replace(/\/$/, '')
}

/**
 * @param {...string} paths
 * @returns {string|null}
 * @deprecated
 */
export function tryJoinPathsAndGetPathname(...paths) {
  try {
    return joinPathsAndGetPathname(...paths)
  } catch {
    return null
  }
}

export default url
