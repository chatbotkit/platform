import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getPortalSlugFromHostname } from '@/lib/portal.hostname'
import { getSpaceSiteSlug } from '@/lib/space.site'

/**
 * Selects space and portal hosts using the running deployment's apexes.
 * Their Next configs own the path rewrites, exclusions and fallbacks.
 */
export function proxy(request: NextRequest): NextResponse {
  // @note match the actual Host header, as Next's host rewrites did; forwarded
  // and internal assertion headers remain subject to request-context validation
  const hostname = request.headers.get('host')?.split(':')[0].toLowerCase()
  const headers = new Headers(request.headers)

  // @note routing markers are always replaced, including on excluded paths;
  // client-supplied values must never select space or portal rewrites
  headers.delete('x-cbk-space-site')
  headers.delete('x-cbk-portal')

  // @note a space host takes precedence if the configured apexes overlap;
  // assign only one marker so rewrite phases cannot route the request twice
  switch (true) {
    case !!hostname && !!getSpaceSiteSlug(hostname):
      headers.set('x-cbk-space-site', '1')

      break

    case !!hostname && !!getPortalSlugFromHostname(hostname):
      headers.set('x-cbk-portal', '1')

      break
  }

  return NextResponse.next({ request: { headers } })
}

export const config = {
  // @note run on every path to remove untrusted routing markers before both
  // the beforeFiles and fallback rewrite phases
  matcher: '/:path*',
}
