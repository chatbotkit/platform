import '@/lib/scope.server'

import { siteHostname } from '@/config/site'

import { isAppHostname } from '@/lib/app.helpers'
import { hostToHostname } from '@/lib/host.parse'
import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'

export function getAppManifestPath(app?: string): string | null {
  app // @note app is not used and only here for future-proofing

  // @note a mapped frontend may name the site while the request still routes
  // to an app shell, so check both identities as app configuration does
  const hostnames = [getContextFrontendHost(), getContextRequestHost()]
    .map(hostToHostname)
    .filter(Boolean)

  if (
    (hostnames.length ? hostnames : [siteHostname]).some((hostname) =>
      isAppHostname(hostname)
    )
  ) {
    return `/app.webmanifest`
  } else {
    return null
  }
}
