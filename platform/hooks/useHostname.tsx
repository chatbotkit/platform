/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- the hostname seam itself - the constants seed first render and the data-* attributes overlay the runtime value */
import { useState } from 'react'

import { portalApex, spaceApex } from '@/config/apexes'
import {
  BUILTIN_TYPE,
  MAIN_TYPE,
  PORTAL_TYPE,
  appSlugToHostnameMap,
  appSlugs,
} from '@/config/apps'
import { HOST_COOKIE_NAME } from '@/config/cookie'
import {
  siteHostname,
  siteUrl,
  staticHostname,
  widgetHostname,
} from '@/config/site'

import { parse } from '@/lib/cookie'
import { isProduction } from '@/lib/env'
import { getExternalAPIHost } from '@/lib/host'
import { isLocalhost } from '@/lib/localhost'

import useCookie from '@/hooks/useCookie'
import useHydrated from '@/hooks/useHydrated'
import useHydrationSafeLayoutEffect from '@/hooks/useHydrationSafeLayoutEffect'

export function useCookieHostname(): string {
  const cookie = useCookie(HOST_COOKIE_NAME)

  return cookie || ''
}

export function useAudienceHostname(): string {
  // @note keep the initial render empty so hydration matches the server HTML,
  // then read the attribute in a layout effect - it lands before the browser
  // paints, so the resolved hostname is never visibly late
  const [htmlAudience, setHtmlAudience] = useState<string>('')

  useHydrationSafeLayoutEffect(() => {
    setHtmlAudience(document.documentElement.dataset.audience || '')
  }, [])

  return htmlAudience
}

export function useSiteHostname(): string {
  const [hostname, setHostname] = useState<string>(siteHostname)

  useHydrationSafeLayoutEffect(() => {
    setHostname(document.documentElement.dataset.siteHost || siteHostname)
  }, [])

  return hostname
}

export function useStaticHostname(): string {
  const [hostname, setHostname] = useState<string>(staticHostname)

  useHydrationSafeLayoutEffect(() => {
    setHostname(document.documentElement.dataset.staticHost || staticHostname)
  }, [])

  return hostname
}

export function useWidgetHostname(): string {
  const [hostname, setHostname] = useState<string>(widgetHostname)

  useHydrationSafeLayoutEffect(() => {
    setHostname(document.documentElement.dataset.widgetHost || widgetHostname)
  }, [])

  return hostname
}

export function useAPIHostname(): string {
  const fallbackHostname = getExternalAPIHost(siteHostname)

  const [hostname, setHostname] = useState<string>(fallbackHostname)

  useHydrationSafeLayoutEffect(() => {
    setHostname(document.documentElement.dataset.apiHost || fallbackHostname)
  }, [fallbackHostname])

  return hostname
}

export function usePortalApex(): string {
  const [apex, setApex] = useState<string>(portalApex || '')

  useHydrationSafeLayoutEffect(() => {
    setApex(document.documentElement.dataset.portalApex || portalApex || '')
  }, [])

  return apex
}

export function useSpaceApex(): string {
  const [apex, setApex] = useState<string>(spaceApex || '')

  useHydrationSafeLayoutEffect(() => {
    setApex(document.documentElement.dataset.spaceApex || spaceApex || '')
  }, [])

  return apex
}

/**
 * The app slug to hostname table with the runtime deployment hosts overlaid.
 * The build-time constants carry no apex values in the browser - they read
 * server-only environment - so href resolution keyed off the constants alone
 * stops recognising app and portal hosts after hydration. The data-*
 * attributes are the runtime source, mirroring how the constants table is
 * built server-side.
 */
export function useAppSlugToHostnameMap(): Readonly<Record<string, string>> {
  const [map, setMap] =
    useState<Readonly<Record<string, string>>>(appSlugToHostnameMap)

  useHydrationSafeLayoutEffect(() => {
    const dataset = document.documentElement.dataset

    const runtimeAppApex = dataset.appApex || ''
    const runtimePortalApex = dataset.portalApex || ''
    const runtimeAppMainHost = dataset.appMainHost || ''

    const overlay: Record<string, string> = { ...appSlugToHostnameMap }

    if (runtimeAppApex) {
      for (const slug of appSlugs) {
        overlay[slug] = `${slug}.${runtimeAppApex}`
      }

      overlay[BUILTIN_TYPE] = runtimeAppApex
    }

    if (runtimePortalApex) {
      overlay[PORTAL_TYPE] = runtimePortalApex
    }

    if (runtimeAppMainHost) {
      overlay[MAIN_TYPE] = runtimeAppMainHost
    }

    setMap(Object.freeze(overlay))
  }, [])

  return map
}

// @note data-audience is set by the server on <html> and reflects the
// request host more accurately than the cookie, which may be stale

function resolveHostname(
  htmlAudience: string,
  cookie: string,
  fallbackHostname: string
): string {
  let hostname = htmlAudience || cookie

  if (hostname === siteHostname) {
    hostname = cookie
  }

  if (isProduction) {
    if (isLocalhost(hostname || siteHostname)) {
      hostname = siteHostname
    }
  }

  if (!hostname) {
    hostname = fallbackHostname
  }

  return hostname
}

/**
 * This is a hacky solution to get the current host no matter where the app is
 * running. This is not the same as the `window.location.host` because it is
 * dependent on intermediary proxy servers.
 *
 * This is the literal hostname not the site.
 */
export default function useHostname(): string {
  const cookie = useCookieHostname()

  const htmlAudience = useAudienceHostname()

  // @note neither source is readable while the server renders: the document
  // does not exist and useCookie reads the request cookie through Next's
  // incremental cache, which the client has no equivalent of. Both are
  // therefore ignored until hydration so the first client render reproduces
  // the server HTML exactly - the layout effects then resolve the real
  // hostname before the browser paints

  const hydrated = useHydrated()

  return resolveHostname(
    hydrated ? htmlAudience : '',
    hydrated ? cookie : '',
    new URL(siteUrl).hostname
  )
}

/**
 * Plain (non-hook) variant of useHostname for code that runs outside the
 * React render cycle, such as template tasks. The host cookie and the
 * data-audience attribute are set by the server and reflect the real request
 * host behind intermediary proxies - window.location is only a fallback.
 */
export function getDocumentHostname(): string {
  if (typeof document === 'undefined') {
    return new URL(siteUrl).hostname
  }

  const cookie = parse(document.cookie || '').get(HOST_COOKIE_NAME) || ''

  const htmlAudience = document.documentElement.dataset.audience || ''

  return resolveHostname(htmlAudience, cookie, window.location.hostname)
}
