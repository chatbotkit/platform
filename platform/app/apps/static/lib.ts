import prisma from '@/prisma/client'
import { PortalConfig } from '@/prisma/zod'

import { getAppConfig, getShadowConfig } from '@/lib/app.config.helpers'
import { runInAppContext } from '@/lib/app.context'
import {
  getAppConfigBySlug,
  getAppGlobalBySlug,
  getAppSlugByHostname,
} from '@/lib/app.helpers'
import { encode } from '@/lib/b64'
import { setupRequestContext } from '@/lib/context.setup'
import {
  getContextFrontendHost,
  getContextRequestHost,
  runInContext,
} from '@/lib/context.store'
import { captureException } from '@/lib/error'
import fetch from '@/lib/fetch'
import { merge } from '@/lib/object'
import { getPortalGlobalConfig } from '@/lib/portal.config'
import { getPortalSlugFromHostname } from '@/lib/portal.hostname'
import {
  getStorageFileDownloadUrl,
  storageFileExists,
} from '@/lib/space.storage'

import ConfigSchema from './config'
import {
  LEGACY_APP_NAME as LEGACY_STATIC_APP_NAME,
  APP_NAME as STATIC_APP_NAME,
} from './const'

import type { z } from 'zod'

/**
 * The slug of the Static app. A portal that has this app configured is
 * treated as a static website: the root redirects to it (see the `(index)`
 * layout) and absolute resource paths resolve from the space root (see the
 * `/apps/[...path]` catch-all route).
 */
export const SPACE_SITE_APP_NAME = STATIC_APP_NAME

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

export interface SitePathOptions {
  path?: string
  prefix?: string
  index?: string
  notFound?: string
  directoryIndex?: boolean
  trailingSlash?: boolean
}

export interface SitePathCandidates {
  candidates: string[]
  notFoundPath: string | null
}

export interface SpaceSiteRouteContext {
  params: {
    path?: string[]
  }
}

// @note Next 15+ hands route handlers a promise for `params`; the route files
// await it and pass the resolved shape above down to the handler.
export interface SpaceSiteRouteProps {
  params: Promise<SpaceSiteRouteContext['params']>
}

export type SpaceSiteConfig = z.infer<typeof ConfigSchema>

/**
 * Normalizes a storage path, rejecting traversal and unsafe segments. Returns
 * an empty string for an empty input and `null` for unsafe input.
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

export function joinSiteStoragePath(...parts: Array<string | null>): string {
  return parts.filter(Boolean).join('/')
}

export function getDirectoryIndexStoragePath({
  path,
  prefix,
  index = DEFAULT_INDEX,
}: Pick<SitePathOptions, 'path' | 'prefix' | 'index'>): string | null {
  const normalizedPrefix = normalizeSiteStoragePath(prefix)
  const normalizedPath = normalizeSiteStoragePath(path)
  const normalizedIndex = normalizeSiteStoragePath(index)

  if (
    normalizedPrefix === null ||
    normalizedPath === null ||
    normalizedIndex === null
  ) {
    return null
  }

  if (!normalizedIndex) {
    return null
  }

  return joinSiteStoragePath(normalizedPrefix, normalizedPath, normalizedIndex)
}

export function getSitePathCandidates({
  path,
  prefix,
  index = DEFAULT_INDEX,
  notFound = DEFAULT_NOT_FOUND,
  directoryIndex = true,
  trailingSlash = false,
}: SitePathOptions): SitePathCandidates | null {
  const normalizedPrefix = normalizeSiteStoragePath(prefix)
  const normalizedPath = normalizeSiteStoragePath(path)
  const normalizedIndex = normalizeSiteStoragePath(index)
  const normalizedNotFound = normalizeSiteStoragePath(notFound)

  if (
    normalizedPrefix === null ||
    normalizedPath === null ||
    normalizedIndex === null ||
    normalizedNotFound === null
  ) {
    return null
  }

  if (!normalizedIndex) {
    return null
  }

  const candidates: string[] = []

  const appendCandidate = (candidate: string) => {
    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  if (!normalizedPath) {
    appendCandidate(
      getDirectoryIndexStoragePath({
        path: normalizedPath,
        prefix: normalizedPrefix,
        index: normalizedIndex,
      })!
    )
  } else if (trailingSlash) {
    appendCandidate(
      getDirectoryIndexStoragePath({
        path: normalizedPath,
        prefix: normalizedPrefix,
        index: normalizedIndex,
      })!
    )
  } else {
    appendCandidate(joinSiteStoragePath(normalizedPrefix, normalizedPath))

    if (directoryIndex) {
      appendCandidate(
        getDirectoryIndexStoragePath({
          path: normalizedPath,
          prefix: normalizedPrefix,
          index: normalizedIndex,
        })!
      )
    }
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

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

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

export function getSiteResponseHeaders({
  path,
  response,
}: {
  path: string
  response: Response
}): Headers {
  const headers = new Headers()

  const responseContentType = response.headers.get('Content-Type')
  const pathContentType = getContentTypeForPath(path)

  headers.set(
    'Content-Type',
    pathContentType ||
      (responseContentType && responseContentType !== 'application/octet-stream'
        ? responseContentType
        : 'application/octet-stream')
  )

  for (const key of ['ETag', 'Last-Modified', 'Content-Length']) {
    const value = response.headers.get(key)

    if (value) {
      headers.set(key, value)
    }
  }

  return headers
}

/**
 * Resolves the Static app configuration for the current request. This reads
 * the portal configuration directly (no authenticated session) because this
 * route publishes configured space storage as a public static site. When the
 * request is not for a portal the app's manifest config is used as a fallback,
 * which has no `spaceId` and therefore renders nothing.
 *
 * @note we intentionally do not use `getContextAppConfig` because its fallback
 * is authenticated user/app config.
 */
export async function resolveSpaceSiteConfig(): Promise<
  Record<string, unknown>
> {
  const host = getContextFrontendHost() || getContextRequestHost()
  const portalSlug = host ? getPortalSlugFromHostname(host) : null

  if (!portalSlug) {
    return merge(
      getAppGlobalBySlug(STATIC_APP_NAME) || {},
      getAppConfigBySlug(STATIC_APP_NAME) || {}
    )
  }

  const portal = await prisma.portal.findUnique({
    where: {
      slug: portalSlug,
    },
    select: {
      config: true,
      slug: true,
      userId: true,
    },
  })

  if (!portal) {
    return {}
  }

  const portalConfigResult = await PortalConfig.safeParseAsync(portal.config)

  if (!portalConfigResult.success) {
    return {}
  }

  const portalConfig = portalConfigResult.data
  const portalGlobalConfig =
    (await getPortalGlobalConfig(portal)) || {}

  const combinedPortalConfig = merge(
    getShadowConfig(portalGlobalConfig as Record<string, unknown>) || {},
    portalGlobalConfig,
    getShadowConfig(portalConfig as Record<string, unknown>) || {},
    portalConfig
  )

  const staticAppConfig =
    getAppConfig(combinedPortalConfig, STATIC_APP_NAME) ||
    getAppConfig(combinedPortalConfig, LEGACY_STATIC_APP_NAME) ||
    {}

  return merge(getAppGlobalBySlug(STATIC_APP_NAME) || {}, staticAppConfig)
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

function withTrailingSlash(pathname: string): string {
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}

/**
 * Computes the `<base href>` for the Static app when it is mounted under its own
 * app route (`/apps/static/...`, or the bare root on the app's own hostname).
 * This keeps relative resource resolution correct for the app-prefixed mount.
 */
export function getAppMountBaseHref(
  req: Request,
  context: SpaceSiteRouteContext
): string {
  const host = getContextFrontendHost() || getContextRequestHost()
  const url = new URL(req.url)
  const sitePath = context.params.path?.join('/') || ''

  if (host && getAppSlugByHostname(host) === SPACE_SITE_APP_NAME) {
    return withTrailingSlash(sitePath ? `/${sitePath}` : '/')
  }

  const appRoutePrefix = `/apps/${SPACE_SITE_APP_NAME}`
  let pathname = url.pathname

  if (
    pathname === appRoutePrefix ||
    pathname.startsWith(`${appRoutePrefix}/`)
  ) {
    pathname = pathname.slice('/apps'.length) || `/${SPACE_SITE_APP_NAME}`
  }

  return withTrailingSlash(pathname)
}

/**
 * Computes the `<base href>` for the Static app when it is mounted at a portal
 * root (served by the `/apps/[...path]` catch-all). The internal request path is
 * `/apps/<site path>`; stripping the `/apps` prefix yields the root-relative
 * directory so relative resources resolve against the real portal root.
 */
export function getRootMountBaseHref(req: Request): string {
  const url = new URL(req.url)

  let pathname = url.pathname

  if (pathname === '/apps' || pathname.startsWith('/apps/')) {
    pathname = pathname.slice('/apps'.length) || '/'
  }

  return withTrailingSlash(pathname)
}

const NOT_FOUND_REDIRECT_PATH = '/404'

/**
 * Determines whether the request is a top-level navigation (a document) rather
 * than a sub-resource (stylesheet, script, image, ...). Document requests get a
 * branded not-found experience via a client-side redirect; sub-resources get a
 * bare 404 so a missing asset never resolves to an HTML body.
 */
export function isDocumentRequest(req: Request): boolean {
  const dest = req.headers.get('sec-fetch-dest')

  if (dest) {
    return dest === 'document'
  }

  return (req.headers.get('accept') || '').includes('text/html')
}

/**
 * Builds the not-found response when there is nothing to serve (the space is not
 * configured, or no candidate and no site `404.html` matched). The HTTP status
 * is always 404 - so crawlers and monitors see a real not-found - but a document
 * navigation additionally carries a tiny HTML body that bounces to the host's
 * branded `/404` page client-side. HEAD and sub-resource requests get a bodyless
 * 404 (an HTML body would be wrong for a missing stylesheet/image).
 *
 * @note the client redirect is suppressed on the app's own hostname only, where
 * `/404` is served by this same handler and a redirect would loop. On every
 * other host (portal-apex hosts, custom domains, and the builtin app
 * hosts) `/404` resolves to the branded not-found page.
 */
export function getNotFoundResponse({
  head,
  isDocument,
  isOwnAppHost,
}: {
  head: boolean
  isDocument: boolean
  isOwnAppHost: boolean
}): Response {
  if (head || !isDocument || isOwnAppHost) {
    return new Response(null, { status: 404 })
  }

  return new Response(
    `<!doctype html><meta charset="utf-8">` +
      `<script>location.replace(${JSON.stringify(
        NOT_FOUND_REDIRECT_PATH
      )})</script>` +
      `<meta http-equiv="refresh" content="0;url=${NOT_FOUND_REDIRECT_PATH}">`,
    {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  )
}

async function serveSpaceSite({
  config,
  sitePath,
  trailingSlash,
  baseHref,
  isDocument,
  isOwnAppHost,
  head = false,
}: {
  config: SpaceSiteConfig
  sitePath: string
  trailingSlash: boolean
  baseHref: string
  isDocument: boolean
  isOwnAppHost: boolean
  head?: boolean
}): Promise<Response> {
  if (!config.spaceId) {
    return getNotFoundResponse({ head, isDocument, isOwnAppHost })
  }

  const paths = getSitePathCandidates({
    path: sitePath,
    prefix: config.prefix,
    index: config.index,
    notFound: config.notFound,
    directoryIndex: config.directoryIndex,
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
    // @note only the directory index needs a `<base href>` because a directory
    // request without a trailing slash (e.g. `/about`) would otherwise resolve
    // relative resources against the parent. A directly requested file already
    // carries the correct directory in its own URL.
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

  return getNotFoundResponse({ head, isDocument, isOwnAppHost })
}

type SpaceSiteHandler = (
  req: Request,
  context: SpaceSiteRouteContext,
  head?: boolean
) => Promise<Response>

/**
 * Creates a Static app request handler. The `getBaseHref` strategy determines
 * how relative resources resolve depending on where the site is mounted:
 * - {@link getAppMountBaseHref} for the app-prefixed `/apps/static` route, and
 * - {@link getRootMountBaseHref} for the portal root catch-all.
 *
 * @note adapted from `appRouteHandler` in `@/lib/app.route`: it initializes the
 * same request/app context before resolving config.
 */
export function createSpaceSiteHandler({
  getBaseHref,
}: {
  getBaseHref: (req: Request, context: SpaceSiteRouteContext) => string
}): SpaceSiteHandler {
  return runInContext<Response>(
    runInAppContext<Response>(async function (
      req: Request,
      context: SpaceSiteRouteContext,
      head: boolean = false
    ): Promise<Response> {
      setupRequestContext(req)

      const config = await ConfigSchema.parseAsync(
        await resolveSpaceSiteConfig()
      )

      try {
        const url = new URL(req.url)
        const sitePath = context.params.path?.join('/') || ''
        const host = getContextFrontendHost() || getContextRequestHost()

        return await serveSpaceSite({
          config,
          sitePath,
          trailingSlash: url.pathname.endsWith('/'),
          baseHref: getBaseHref(req, context),
          isDocument: isDocumentRequest(req),
          isOwnAppHost:
            getAppSlugByHostname(host || '') === SPACE_SITE_APP_NAME,
          head,
        })
      } catch (e) {
        await captureException(e)

        return new Response('Internal Server Error', { status: 500 })
      }
    })
  ) as SpaceSiteHandler
}
