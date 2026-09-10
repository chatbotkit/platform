import { portalApex } from '@/config/apexes'

import { getContextRequestHost } from '@/lib/context.store'

// @note without a configured portal apex no hostname is a portal hostname

export function isPortalRootHostname(hostname: string): boolean {
  return !!portalApex && hostname === portalApex
}

export function isPortalHostname(hostname: string): boolean {
  return !!portalApex && hostname.endsWith(`.${portalApex}`)
}

export function getPortalSlugFromHostname(hostname: string): string | null {
  if (!hostname) {
    return null
  }

  let cleanHostname = hostname

  // strip query parameters and paths that may be incorrectly included in
  // hostname

  cleanHostname = hostname.split(/[?/#]/)[0]

  // strip protocol if included in hostname

  cleanHostname = cleanHostname.replace(/^https?:\/\//, '')

  // strip port if included in hostname

  cleanHostname = cleanHostname.split(':')[0]

  if (!isPortalHostname(cleanHostname)) {
    return null
  }

  return cleanHostname.slice(0, -`.${portalApex}`.length) || null
}

export function getPortalSlug(): string | null {
  const host = getContextRequestHost()

  if (!host) {
    return null
  }

  // @note the slug helper reduces the host itself
  return getPortalSlugFromHostname(host)
}
