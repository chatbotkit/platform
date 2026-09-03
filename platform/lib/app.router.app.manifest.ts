import '@/lib/scope.server'

import { siteHostname } from '@/config/site'

import { isAppHostname } from '@/lib/app.helpers'
import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'

export function getAppManifestPath(app?: string): string | null {
  app // @note app is not used and only here for future-proofing

  const host =
    getContextFrontendHost() || getContextRequestHost() || siteHostname

  if (isAppHostname(host)) {
    return `/app.webmanifest`
  } else {
    return null
  }
}
