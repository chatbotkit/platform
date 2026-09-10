import {
  APP_TYPES,
  BUILTIN_TYPE,
  CUSTOM_TYPE,
  appSlugToHostMap,
  appSlugToUrlMap,
  apps,
} from '@/config/apps'
import { siteUrl } from '@/config/site'

import { hostToHostname } from '@/lib/host.parse'
import { tryHostname, tryPathname, tryUrl } from '@/lib/url'

// @note the tables hold hosts; lookups take a hostname and reduce the table
// entries to hostnames, so a port never takes part in the comparison

export function isAppHostname(
  hostname: string | { hostname: string },
  hostMap: Readonly<Record<string, string>> = appSlugToHostMap
): boolean {
  const _hostname =
    typeof hostname === 'object' && hostname !== null
      ? hostname.hostname
      : hostname

  if (!_hostname || typeof _hostname !== 'string') {
    return false
  }

  const normalizedHostname = _hostname.toLowerCase()

  return Object.values(hostMap).some((host) => {
    const appHostname = hostToHostname(host)

    return (
      appHostname === normalizedHostname ||
      normalizedHostname.endsWith(`.${appHostname}`)
    )
  })
}

export function isAppPathname(
  pathname: string | { pathname: string }
): boolean {
  const _pathname =
    typeof pathname === 'object' && pathname !== null
      ? pathname.pathname
      : pathname

  if (!_pathname || typeof _pathname !== 'string') {
    return false
  }

  const baseHref = tryUrl(_pathname, siteUrl)

  return (
    !!baseHref &&
    Object.entries(appSlugToUrlMap)
      .filter(([key]) => !key.startsWith(':'))
      .some(([, url]) => baseHref.startsWith(url))
  )
}

export function isAppUrl(url: string | URL): boolean {
  if (!url) {
    return false
  }

  const hostname = tryHostname(url, siteUrl)

  if (hostname) {
    if (isAppHostname(hostname)) {
      return true
    }
  }

  const pathname = tryPathname(url, siteUrl)

  if (pathname) {
    if (isAppPathname(pathname)) {
      return true
    }
  }

  return false
}

export function getAppSlugByHostname(
  hostname: string | { hostname: string },
  hostMap: Readonly<Record<string, string>> = appSlugToHostMap
): string | null {
  const _hostname =
    typeof hostname === 'object' && hostname !== null
      ? hostname.hostname
      : hostname

  if (!_hostname || typeof _hostname !== 'string') {
    return null
  }

  const normalizedHostname = _hostname.toLowerCase()

  return (
    Object.entries(hostMap).find(([, host]) => {
      const appHostname = hostToHostname(host)

      return (
        appHostname === normalizedHostname ||
        normalizedHostname.endsWith(`.${appHostname}`)
      )
    })?.[0] || null
  )
}

export function getAppTypeByHostname(
  hostname: string | { hostname: string }
): (typeof APP_TYPES)[number] | ':unknown' {
  const _hostname =
    typeof hostname === 'object' && hostname !== null
      ? hostname.hostname
      : hostname

  if (!_hostname || typeof _hostname !== 'string') {
    return ':unknown'
  }

  const slug = getAppSlugByHostname(_hostname)

  if (slug) {
    if (APP_TYPES.includes(slug as (typeof APP_TYPES)[number])) {
      return slug as (typeof APP_TYPES)[number]
    } else {
      return BUILTIN_TYPE
    }
  }

  return CUSTOM_TYPE
}

export function getAppManifestByHostname(
  hostname: string | { hostname: string }
): (typeof apps)[number] | null {
  const _hostname =
    typeof hostname === 'object' && hostname !== null
      ? hostname.hostname
      : hostname

  if (!_hostname || typeof _hostname !== 'string') {
    return null
  }

  const normalizedHostname = _hostname.toLowerCase()

  return (
    apps.find(
      (app) => !!app.host && hostToHostname(app.host) === normalizedHostname
    ) || null
  )
}

export function getAppConfigByHostname(
  hostname: string | { hostname: string }
): (typeof apps)[number]['config'] | null {
  return getAppManifestByHostname(hostname)?.config || null
}

export function getAppGlobalByHostname(
  hostname: string | { hostname: string }
): (typeof apps)[number]['config'] | null {
  return getAppManifestByHostname(hostname)?.global || null
}

export function getAppManifestBySlug(
  slug: string
): (typeof apps)[number] | null {
  return apps.find((app) => app.slug === slug) || null
}

export function getAppConfigBySlug(
  slug: string
): (typeof apps)[number]['config'] | null {
  return getAppManifestBySlug(slug)?.config || null
}

export function getAppGlobalBySlug(
  slug: string
): (typeof apps)[number]['global'] | null {
  return getAppManifestBySlug(slug)?.global || null
}
