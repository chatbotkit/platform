import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import partnersConfig from '@chatbotkit-dev/partners'

import { partnersApex } from '@/config/apexes'
import { apps } from '@/config/apps'
import { HOST_COOKIE_NAME } from '@/config/cookie'
import { hosts } from '@/config/hosts'
import {
  apiHostname,
  siteHostname,
  siteUrl,
  staticHostname,
} from '@/config/site'

import { getPortalSlugFromHostname } from '@/lib/portal.hostname'
import { getSecurityHeaders } from '@/lib/security.headers'
import { getSpaceSiteSlug } from '@/lib/space.site'
import { hostToHostname, normalizeRequestHost } from '@/lib/host.parse'

import { apiCorsHeaders } from '@/next.config.d/api.config'

// @note host routing ignores ports, matching Next's former host conditions

// @note whether forwarded headers are trusted is deployment configuration,
// read once at startup like the host tables
const trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === 'true'

const appsByHostname = new Map(
  apps.flatMap((app) =>
    app.host ? [[hostToHostname(app.host), app.slug]] : []
  )
)

const partnersByHostname = new Map(
  Object.entries(partnersConfig).flatMap(([slug, partner]) =>
    partner.domain ? [[partner.domain.toLowerCase(), slug]] : []
  )
)

const partnerSuffix = partnersApex
  ? `.${partnersApex.toLowerCase()}`
  : undefined

// @note API and static targets that also serve the site must not capture its
// pages; the configured targets are hosts, routing compares hostnames
const siteHostnames = new Set([
  siteHostname,
  ...hosts.site.map(hostToHostname),
])
const apiHostnames = new Set(
  [...hosts.api.map(hostToHostname), apiHostname].filter(
    (hostname) => !siteHostnames.has(hostname)
  )
)
const staticHostnames = new Set(
  [...hosts.static.map(hostToHostname), staticHostname].filter(
    (hostname) => !siteHostnames.has(hostname)
  )
)

/**
 * Selects host routing using the deployment's runtime settings.
 * Their Next configs own the path rewrites, exclusions and fallbacks.
 */
export function proxy(request: NextRequest): NextResponse {
  // @note match the actual Host header, as Next's host rewrites did; forwarded
  // and internal assertion headers remain subject to request-context validation

  const host = request.headers.get('host')?.toLowerCase()
  const hostname = host ? hostToHostname(host) : undefined

  const appSlug = hostname ? appsByHostname.get(hostname) : undefined
  const isApiHost = !!hostname && apiHostnames.has(hostname)

  // @note preserve wildcard partner sign-in routing, including unknown slugs;
  // the partner page validates the catalogue entry before allowing sign-in

  const partnerSlug =
    hostname && partnerSuffix && hostname.endsWith(partnerSuffix)
      ? hostname.slice(0, -partnerSuffix.length)
      : hostname
        ? partnersByHostname.get(hostname)
        : undefined

  const headers = new Headers(request.headers)

  const originalUrl = new URL(request.url)
  const routeUrl = request.nextUrl.clone()

  // @note retaining the original URL also retains page-data paths; normalize
  // those for host routing while leaving Next's request URL unchanged

  if (routeUrl.buildId) {
    let pagePath = request.nextUrl.pathname
      .replace(/^\/_next\/data\/[^/]+/, '')
      .replace(/\.json$/, '')

    if (routeUrl.locale && pagePath.startsWith(`/${routeUrl.locale}/`)) {
      pagePath = pagePath.slice(routeUrl.locale.length + 1)
    }

    routeUrl.pathname = pagePath === '/index' ? '/' : pagePath
    routeUrl.buildId = ''
  }

  const { pathname } = routeUrl

  let redirectPath: string | undefined

  // @note routing markers are always replaced, including on excluded paths;
  // client-supplied values must never select host-specific rewrites
  headers.delete('x-cbk-space-site')
  headers.delete('x-cbk-portal')
  headers.delete('x-cbk-app-shell')
  headers.delete('x-cbk-app')
  headers.delete('x-cbk-partner')
  headers.delete('x-cbk-static')
  headers.delete('x-cbk-api')

  // @note API rules run first and retain their exclusions on overlapping hosts
  if (isApiHost) {
    headers.set('x-cbk-api', '1')
  }

  // @note static restrictions compose with other surfaces in rewrite order,
  // preserving the path exclusions when configured hostnames overlap
  if (hostname && staticHostnames.has(hostname)) {
    headers.set('x-cbk-static', '1')
  }

  // @note partner sign-in and branding can coexist with another host surface
  if (partnerSlug) {
    headers.set('x-cbk-partner', partnerSlug)

    if (pathname === '/') {
      redirectPath = '/overview'
    }
  }

  // @note a space host takes precedence if the configured apexes overlap;
  // assign only one marker so rewrite phases cannot route the request twice
  switch (true) {
    case !!hostname && !!getSpaceSiteSlug(hostname):
      headers.set('x-cbk-space-site', '1')

      break

    case !!hostname && !!getPortalSlugFromHostname(hostname):
      headers.set('x-cbk-portal', '1')

      break

    // @note shell slugs start with a colon and are never routable app slugs
    case !!appSlug && appSlug.startsWith(':'):
      headers.set('x-cbk-app-shell', '1')

      break

    case !!appSlug: {
      headers.set('x-cbk-app', appSlug)

      // @note configured redirects run before the proxy, so this host-based
      // redirect must use the same runtime classification as app rewrites
      // @note partner roots lead to overview; reversing that redirect here
      // would loop when a partner custom domain is also a registered app host

      if (
        !partnerSlug &&
        (pathname === '/overview' || pathname === '/overview/')
      ) {
        redirectPath = '/'
      }

      break
    }
  }

  let response: NextResponse

  // @note canonical redirects previously ran before host redirects and
  // rewrites; retain the platform's paths without trailing slashes and their
  // precedence while attaching the runtime policy
  let permanentDestination: URL | undefined

  if (
    originalUrl.pathname !== '/' &&
    originalUrl.pathname.endsWith('/') &&
    !(
      routeUrl.locale &&
      routeUrl.locale === routeUrl.defaultLocale &&
      pathname === '/'
    )
  ) {
    permanentDestination = new URL(originalUrl)
    // @note Next's canonical redirects omit the default locale and leave
    // its root alone, including a root served under a base path
    permanentDestination.pathname =
      routeUrl.locale && routeUrl.locale === routeUrl.defaultLocale
        ? `${routeUrl.basePath}${pathname.slice(0, -1)}`
        : originalUrl.pathname.slice(0, -1)
  }

  if (permanentDestination || redirectPath) {
    const destination = permanentDestination || routeUrl.clone()

    if (!permanentDestination && redirectPath) {
      destination.pathname = redirectPath
    }

    const publicHost = request.headers.get('host')

    if (publicHost) {
      const { hostname, port } = new URL(
        `${destination.protocol}//${publicHost}`
      )

      // @note assigning host alone retains an internal port when the public
      // host has none; replace both parts for reverse-proxied deployments
      destination.hostname = hostname
      destination.port = port
    }

    const redirectUrl = new URL(destination)

    // @note host redirects previously received an already normalized URL,
    // including default-locale roots that do not need a separate redirect
    if (!permanentDestination) {
      redirectUrl.pathname = redirectUrl.pathname.replace(/\/$/, '') || '/'
    }

    response = NextResponse.redirect(
      redirectUrl,
      permanentDestination ? 308 : 307
    )
  } else {
    response = NextResponse.next({ request: { headers } })
  }

  if (!isApiHost) {
    for (const { key, value } of getSecurityHeaders(pathname)) {
      response.headers.set(key, value)
    }
  }

  // @note the browser reads the request host back from this cookie; it
  // records the same host the request context trusts - the forwarded host
  // behind a trusted proxy, the Host header otherwise - so the two never
  // disagree. `Secure` only on a TLS site, or plain-http deployments never
  // receive it. Written raw: the cookie API percent-encodes the port separator
  const cookieHost =
    (trustProxyHeaders
      ? normalizeRequestHost(request.headers.get('x-forwarded-host'))
      : null) || normalizeRequestHost(host)

  if (cookieHost) {
    response.headers.append(
      'set-cookie',
      `${HOST_COOKIE_NAME}=${cookieHost}; Path=/; SameSite=Lax${
        siteUrl.startsWith('https://') ? '; Secure' : ''
      }`
    )
  }

  if (partnerSlug && Object.hasOwn(partnersConfig, partnerSlug)) {
    const partner = partnersConfig[partnerSlug]
    // @note expose only public branding, never the partner's auth or transport
    const branding = Buffer.from(
      JSON.stringify({
        name: partner.name,
        logo: partner.logo,
        icon: partner.icon,
        whitelabel: !!partner.whitelabel,
        experience: partner.experience,
      }),
      'utf8'
    ).toString('base64')

    response.headers.append('Server-Timing', `partner;desc="${branding}"`)
  }

  // @note configured headers run before the proxy, so clean API paths need
  // runtime CORS selection here; /api/v1 keeps its unconditional config rule
  if (isApiHost && /^\/v1(?:\/|$)/i.test(pathname)) {
    for (const { key, value } of apiCorsHeaders) {
      response.headers.set(key, value)
    }
  }

  return response
}

export const config = {
  // @note run on every path to remove untrusted routing markers before both
  // the beforeFiles and fallback rewrite phases
  matcher: '/:path*',
}
