import prisma from '@/prisma/client'

import { encode } from '@/lib/b64'
import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import { captureException } from '@/lib/error'
import fetch from '@/lib/fetch'
import { getSpaceSiteSlug } from '@/lib/space.site'
import {
  getStorageFileDownloadUrl,
  storageFileExists,
} from '@/lib/space.storage'

// @note SpaceSite static-website serving. A `<slug>.<space apex>` host is
// rewritten to `/api/v1/space/system/site/:path*` (see
// next.config.d/spaces.config.js); the request carries no spaceId, so the
// SpaceSite is resolved by the slug extracted from the request host and the backing
// space's storage is served.
//
// This is intentionally self-contained and shares no code with the portal
// Static app (`app/apps/static`) - the two are separate systems. The only
// dependencies are neutral platform infra: space storage, base64 keys, fetch.

// @note the internal route prefix the space-site host is rewritten to.
const MOUNT_PREFIX = '/api/v1/space/system/site'

const DEFAULT_INDEX = 'index.html'
const DEFAULT_NOT_FOUND = '404.html'

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  css: 'text/css; charset=utf-8',
  gif: 'image/gif',
  html: 'text/html; charset=utf-8',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  webmanifest: 'application/manifest+json; charset=utf-8',
  webp: 'image/webp',
  xml: 'application/xml; charset=utf-8',
}

export interface SpaceSiteServeConfig {
  spaceId?: string
  prefix?: string
  index?: string
  notFound?: string
}

function withTrailingSlash(pathname: string): string {
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}

/**
 * Extracts the request host as a bare domain (no port), lower-cased.
 */
export function getSpaceSiteHost(): string | null {
  const host = getContextFrontendHost() || getContextRequestHost()

  if (!host) {
    return null
  }

  return host.split(':')[0].trim().toLowerCase() || null
}

/**
 * Strips the internal mount prefix to recover the public root-relative path
 * (e.g. `/api/v1/space/system/site/blog/` -> `/blog/`, the bare mount -> `/`).
 */
function getPublicPathname(req: Request): string {
  const url = new URL(req.url)

  let pathname = url.pathname

  if (pathname === MOUNT_PREFIX || pathname.startsWith(`${MOUNT_PREFIX}/`)) {
    pathname = pathname.slice(MOUNT_PREFIX.length) || '/'
  }

  return pathname
}

/**
 * Computes the `<base href>` for a SpaceSite request. The SpaceSite host serves
 * from its root, so the public root-relative directory is used so relative
 * resources resolve correctly.
 */
export function getSpaceSiteMountBaseHref(req: Request): string {
  return withTrailingSlash(getPublicPathname(req))
}

/**
 * Resolves the serving config for a SpaceSite request by its host. The slug is
 * extracted from the configured space apex and used for a cached lookup. An
 * unknown host yields an empty config, which renders a 404.
 *
 * @note this is public (no session). It returns only the serving config and the
 * backing `spaceId` - never owner or other private fields.
 */
export async function resolveSpaceSiteConfigByHost(): Promise<SpaceSiteServeConfig> {
  const host = getSpaceSiteHost()

  if (!host) {
    return {}
  }

  const slug = getSpaceSiteSlug(host)

  if (!slug) {
    return {}
  }

  const site = await prisma.spaceSite.findUnique({
    where: {
      slug,
    },

    select: {
      spaceId: true,
      prefix: true,
      index: true,
      notFound: true,
    },

    cacheStrategy: {
      ttl: 60,
      swr: 60,
    },
  })

  if (!site) {
    return {}
  }

  return {
    spaceId: site.spaceId,
    prefix: site.prefix || undefined,
    index: site.index,
    notFound: site.notFound,
  }
}

/**
 * Normalizes a storage path, rejecting traversal and unsafe segments. Returns an
 * empty string for empty input and `null` for unsafe input.
 */
export function normalizeSiteStoragePath(input?: string | null): string | null {
  const value = (input || '').trim().replace(/^\/+|\/+$/g, '')

  if (!value) {
    return ''
  }

  const parts = value.split('/').filter(Boolean)

  for (const part of parts) {
    if (part === '.' || part === '..' || part.includes('\\')) {
      return null
    }

    if (part.includes('\0')) {
      return null
    }
  }

  return parts.join('/')
}

function joinSiteStoragePath(...parts: Array<string | null>): string {
  return parts.filter(Boolean).join('/')
}

function getDirectoryIndexStoragePath({
  path,
  prefix,
  index = DEFAULT_INDEX,
}: {
  path?: string
  prefix?: string
  index?: string
}): string | null {
  const normalizedPrefix = normalizeSiteStoragePath(prefix)
  const normalizedPath = normalizeSiteStoragePath(path)
  const normalizedIndex = normalizeSiteStoragePath(index)

  if (
    normalizedPrefix === null ||
    normalizedPath === null ||
    normalizedIndex === null ||
    !normalizedIndex
  ) {
    return null
  }

  return joinSiteStoragePath(normalizedPrefix, normalizedPath, normalizedIndex)
}

interface SitePathCandidates {
  candidates: string[]
  notFoundPath: string | null
}

/**
 * Resolves the ordered list of storage keys to try for a request path, plus the
 * not-found key. Returns `null` when any input is unsafe.
 */
export function getSitePathCandidates({
  path,
  prefix,
  index = DEFAULT_INDEX,
  notFound = DEFAULT_NOT_FOUND,
  trailingSlash = false,
}: {
  path?: string
  prefix?: string
  index?: string
  notFound?: string
  trailingSlash?: boolean
}): SitePathCandidates | null {
  const normalizedPrefix = normalizeSiteStoragePath(prefix)
  const normalizedPath = normalizeSiteStoragePath(path)
  const normalizedIndex = normalizeSiteStoragePath(index)
  const normalizedNotFound = normalizeSiteStoragePath(notFound)

  if (
    normalizedPrefix === null ||
    normalizedPath === null ||
    normalizedIndex === null ||
    normalizedNotFound === null ||
    !normalizedIndex
  ) {
    return null
  }

  const candidates: string[] = []

  const appendCandidate = (candidate: string | null) => {
    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  if (!normalizedPath || trailingSlash) {
    appendCandidate(
      getDirectoryIndexStoragePath({
        path: normalizedPath,
        prefix: normalizedPrefix,
        index: normalizedIndex,
      })
    )
  } else {
    // @note try the exact file first, then fall back to the directory index
    // (e.g. `/about` -> `about` then `about/index.html`).
    appendCandidate(joinSiteStoragePath(normalizedPrefix, normalizedPath))

    appendCandidate(
      getDirectoryIndexStoragePath({
        path: normalizedPath,
        prefix: normalizedPrefix,
        index: normalizedIndex,
      })
    )
  }

  return {
    candidates,
    notFoundPath: normalizedNotFound
      ? joinSiteStoragePath(normalizedPrefix, normalizedNotFound)
      : null,
  }
}

export function getContentTypeForPath(path: string): string | null {
  const extension = path.split('/').pop()?.split('.').pop()?.toLowerCase()

  if (!extension) {
    return null
  }

  return CONTENT_TYPES_BY_EXTENSION[extension] || null
}

/**
 * Appends `charset=utf-8` to a textual content type that lacks an explicit
 * charset. Storage returns textual files (e.g. markdown served as `text/plain`)
 * with no charset; a browser - especially under `X-Content-Type-Options:
 * nosniff` - then decodes the UTF-8 bytes as Latin-1 and mangles non-ASCII
 * characters (an em dash `-` renders as `â€"`). Binary types are left untouched.
 */
export function ensureCharset(contentType: string): string {
  if (!/^text\//i.test(contentType) || /;\s*charset=/i.test(contentType)) {
    return contentType
  }

  return `${contentType}; charset=utf-8`
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Injects a `<base href>` into the document head so a site authored for a root
 * deployment resolves relative resources correctly when its directory index is
 * served without a trailing slash. Leaves a document that already has a `<base>`
 * untouched.
 */
export function injectHtmlBase(html: string, href: string): string {
  if (/<base(?:\s|>|\/)/i.test(html)) {
    return html
  }

  const base = `<base href="${escapeHtmlAttribute(href)}">`
  const headMatch = html.match(/<head(?:\s[^>]*)?>/i)

  if (!headMatch || headMatch.index === undefined) {
    return `${base}${html}`
  }

  const insertAt = headMatch.index + headMatch[0].length

  return `${html.slice(0, insertAt)}\n  ${base}${html.slice(insertAt)}`
}

function getSiteResponseHeaders({
  path,
  response,
}: {
  path: string
  response: Response
}): Headers {
  const headers = new Headers()

  const responseContentType = response.headers.get('Content-Type')
  const pathContentType = getContentTypeForPath(path)

  const contentType =
    pathContentType ||
    (responseContentType && responseContentType !== 'application/octet-stream'
      ? responseContentType
      : 'application/octet-stream')

  headers.set('Content-Type', ensureCharset(contentType))

  for (const key of ['ETag', 'Last-Modified', 'Content-Length']) {
    const value = response.headers.get(key)

    if (value) {
      headers.set(key, value)
    }
  }

  return headers
}

async function findStorageResponse({
  spaceId,
  paths,
}: {
  spaceId: string
  paths: string[]
}): Promise<{ path: string; response: Response } | null> {
  for (const path of paths) {
    const pathId = encode(path, true)

    if (!(await storageFileExists({ spaceId, pathId }))) {
      continue
    }

    const url = await getStorageFileDownloadUrl({ spaceId, pathId })
    const response = await fetch(url)

    if (response.ok) {
      return { path, response }
    }
  }

  return null
}

/**
 * Serves a request from a SpaceSite's backing storage. A missing page is a bare
 * 404 (or the site's own `notFound` file when present) - a SpaceSite host owns
 * its root and has no branded `/404` to bounce to.
 */
async function serveSpaceSite({
  config,
  sitePath,
  trailingSlash,
  baseHref,
  head = false,
}: {
  config: SpaceSiteServeConfig
  sitePath: string
  trailingSlash: boolean
  baseHref: string
  head?: boolean
}): Promise<Response> {
  if (!config.spaceId) {
    return new Response(null, { status: 404 })
  }

  const paths = getSitePathCandidates({
    path: sitePath,
    prefix: config.prefix,
    index: config.index,
    notFound: config.notFound,
    trailingSlash,
  })

  if (!paths) {
    return new Response('Invalid site path', { status: 400 })
  }

  const found = await findStorageResponse({
    spaceId: config.spaceId,
    paths: paths.candidates,
  })

  if (found) {
    // @note only the directory index needs a `<base href>`: a directory request
    // without a trailing slash (e.g. `/about`) would otherwise resolve relative
    // resources against the parent. A directly requested file already carries
    // its directory in its own URL.
    const directoryIndexPath = getDirectoryIndexStoragePath({
      path: sitePath,
      prefix: config.prefix,
      index: config.index,
    })

    const headers = getSiteResponseHeaders({
      path: found.path,
      response: found.response,
    })

    if (
      !head &&
      found.path === directoryIndexPath &&
      headers.get('Content-Type')?.startsWith('text/html')
    ) {
      headers.delete('Content-Length')

      return new Response(
        injectHtmlBase(await found.response.text(), baseHref),
        {
          status: 200,
          headers,
        }
      )
    }

    return new Response(head ? null : found.response.body, {
      status: 200,
      headers,
    })
  }

  if (paths.notFoundPath) {
    const notFound = await findStorageResponse({
      spaceId: config.spaceId,
      paths: [paths.notFoundPath],
    })

    if (notFound) {
      const headers = getSiteResponseHeaders({
        path: notFound.path,
        response: notFound.response,
      })

      if (!head && headers.get('Content-Type')?.startsWith('text/html')) {
        headers.delete('Content-Length')

        return new Response(
          injectHtmlBase(await notFound.response.text(), baseHref),
          {
            status: 404,
            headers,
          }
        )
      }

      return new Response(head ? null : notFound.response.body, {
        status: 404,
        headers,
      })
    }
  }

  return new Response(null, { status: 404 })
}

/**
 * Handles a SpaceSite request: resolves the site by its host, then serves the
 * matching storage file (or a 404). The request path is recovered from the URL
 * by stripping the internal mount prefix.
 */
export async function handleSpaceSiteRequest(
  req: Request,
  head = false
): Promise<Response> {
  try {
    const config = await resolveSpaceSiteConfigByHost()

    const url = new URL(req.url)
    const sitePath = getPublicPathname(req).replace(/^\/+/, '')

    return await serveSpaceSite({
      config,
      sitePath,
      trailingSlash: url.pathname.endsWith('/'),
      baseHref: getSpaceSiteMountBaseHref(req),
      head,
    })
  } catch (e) {
    await captureException(e)

    return new Response('Internal Server Error', { status: 500 })
  }
}
