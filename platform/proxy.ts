import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { apps } from '@/config/apps'

import { getPortalSlugFromHostname } from '@/lib/portal.hostname'
import { getSpaceSiteSlug } from '@/lib/space.site'

// @note host routing ignores ports, matching Next's former host conditions
const appsByHostname = new Map(
  apps.flatMap((app) =>
    app.host ? [[app.host.split(':')[0].toLowerCase(), app.slug]] : []
  )
)

/**
 * Selects space, portal and app hosts using the running deployment's settings.
 * Their Next configs own the path rewrites, exclusions and fallbacks.
 */
export function proxy(request: NextRequest): NextResponse {
  // @note match the actual Host header, as Next's host rewrites did; forwarded
  // and internal assertion headers remain subject to request-context validation
  const hostname = request.headers.get('host')?.split(':')[0].toLowerCase()
  const appSlug = hostname ? appsByHostname.get(hostname) : undefined
  const headers = new Headers(request.headers)

  // @note routing markers are always replaced, including on excluded paths;
  // client-supplied values must never select host-specific rewrites
  headers.delete('x-cbk-space-site')
  headers.delete('x-cbk-portal')
  headers.delete('x-cbk-app-shell')
  headers.delete('x-cbk-app')

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
      const { pathname } = request.nextUrl

      if (pathname === '/overview' || pathname === '/overview/') {
        const destination = request.nextUrl.clone()

        destination.pathname = '/'
        destination.host = request.headers.get('host') || destination.host

        return NextResponse.redirect(destination)
      }

      break
    }
  }

  return NextResponse.next({ request: { headers } })
}

export const config = {
  // @note run on every path to remove untrusted routing markers before both
  // the beforeFiles and fallback rewrite phases
  matcher: '/:path*',
}
