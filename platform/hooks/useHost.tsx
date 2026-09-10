/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- the hostname seam itself - the constants seed first render and the data-* attributes overlay the runtime value */
import { useCallback, useState } from 'react'

import { portalApex, spaceApex } from '@/config/apexes'
import {
  BUILTIN_TYPE,
  LABS_TYPE,
  MAIN_TYPE,
  PORTAL_TYPE,
  appSlugToHostMap,
  appSlugs,
} from '@/config/apps'
import { HOST_COOKIE_NAME } from '@/config/cookie'
import {
  siteHost,
  siteHostname,
  siteUrl,
  staticHost,
  widgetHost,
} from '@/config/site'

import { parse } from '@/lib/cookie'
import { isProduction } from '@/lib/env'
import { getExternalAPIHost } from '@/lib/host'
import { isLocalhost } from '@/lib/localhost'
import { hostToHostname, normalizeRequestHost } from '@/lib/host.parse'

import useCookie from '@/hooks/useCookie'
import useHydrated from '@/hooks/useHydrated'
import useHydrationSafeLayoutEffect from '@/hooks/useHydrationSafeLayoutEffect'

// @note every value here is a host - hostname plus port when the deployment
// has one - matching the data-* attributes and the host cookie; reduce with
// hostToHostname where a hostname is wanted

export function useCookieHost(): string {
  const cookie = useCookie(HOST_COOKIE_NAME)

  // @note the cookie is client-held input: anything that is not a host is
  // ignored rather than handed to a URL builder that would throw in render
  return normalizeRequestHost(cookie) || ''
}

export function useAudienceHost(): string {
  // @note keep the initial render empty so hydration matches the server HTML,
  // then read the attribute in a layout effect - it lands before the browser
  // paints, so the resolved hostname is never visibly late
  const [htmlAudience, setHtmlAudience] = useState<string>('')

  useHydrationSafeLayoutEffect(() => {
    setHtmlAudience(document.documentElement.dataset.audience || '')
  }, [])

  return htmlAudience
}

export function useSiteHost(): string {
  const [host, setHost] = useState<string>(siteHost)

  useHydrationSafeLayoutEffect(() => {
    setHost(document.documentElement.dataset.siteHost || siteHost)
  }, [])

  return host
}

export function useStaticHost(): string {
  const [host, setHost] = useState<string>(staticHost)

  useHydrationSafeLayoutEffect(() => {
    setHost(document.documentElement.dataset.staticHost || staticHost)
  }, [])

  return host
}

export function useWidgetHost(): string {
  const [host, setHost] = useState<string>(widgetHost)

  useHydrationSafeLayoutEffect(() => {
    setHost(document.documentElement.dataset.widgetHost || widgetHost)
  }, [])

  return host
}

export function useAPIHost(): string {
  const fallbackHost = getExternalAPIHost(siteHost)

  const [host, setHost] = useState<string>(fallbackHost)

  useHydrationSafeLayoutEffect(() => {
    setHost(document.documentElement.dataset.apiHost || fallbackHost)
  }, [fallbackHost])

  return host
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
 * Builds the URL of a deployment-issued `<slug>.<apex>` host. Apex hosts are
 * served by the same server as the page, so the scheme and port follow the
 * document location once hydrated - a Compose stack serves them over plain
 * http on the site port - and the site URL before.
 */
export function useApexHostURL(): (slug: string, apex: string) => string {
  const [{ protocol, port }, setLocation] = useState<{
    protocol: string
    port: string
  }>(() => {
    const url = new URL(siteUrl)

    return { protocol: url.protocol, port: url.port }
  })

  useHydrationSafeLayoutEffect(() => {
    setLocation({
      protocol: window.location.protocol,
      port: window.location.port,
    })
  }, [])

  return useCallback(
    (slug: string, apex: string) =>
      `${protocol}//${slug}.${apex}${port ? `:${port}` : ''}`,
    [protocol, port]
  )
}

/**
 * The app slug to host table with the runtime deployment hosts overlaid.
 * The build-time constants carry no apex values in the browser - they read
 * server-only environment - so href resolution keyed off the constants alone
 * stops recognising app and portal hosts after hydration. The data-*
 * attributes are the runtime source, mirroring how the constants table is
 * built server-side.
 */
export function useAppSlugToHostMap(): Readonly<Record<string, string>> {
  const [map, setMap] =
    useState<Readonly<Record<string, string>>>(appSlugToHostMap)

  useHydrationSafeLayoutEffect(() => {
    const dataset = document.documentElement.dataset

    const runtimeAppApex = dataset.appApex || ''
    const runtimePortalApex = dataset.portalApex || ''
    const runtimeAppMainHost = dataset.appMainHost || ''
    const runtimeAppLabsHost = dataset.appLabsHost || ''

    const overlay: Record<string, string> = { ...appSlugToHostMap }

    if (runtimeAppApex) {
      // @note shell slugs (`:main`, `:labs`) answer on their own origins
      for (const slug of appSlugs) {
        if (slug.startsWith(':')) {
          continue
        }

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

    if (runtimeAppLabsHost) {
      overlay[LABS_TYPE] = runtimeAppLabsHost
    }

    setMap(Object.freeze(overlay))
  }, [])

  return map
}

// @note data-audience is set by the server on <html> and reflects the
// request host more accurately than the cookie, which may be stale

function resolveHost(
  htmlAudience: string,
  cookie: string,
  fallbackHost: string
): string {
  let host = htmlAudience || cookie

  // @note an audience that is exactly the bare site hostname carries no
  // deployment identity, so the cookie may know better; an audience with the
  // deployment's port is the public host and always wins over the cookie,
  // which behind a proxy may hold an internal upstream
  if (host === siteHostname) {
    host = cookie
  }

  // @note a loopback host (localhost, 127.x) in production is a misconfigured
  // request, so the site host stands in - unless the site itself is loopback
  // (a local stack reached as localhost instead of 127.0.0.1), where the
  // swap would send every link to a different origin with its own cookie jar
  if (isProduction && !isLocalhost(siteHost)) {
    if (isLocalhost(host || siteHost)) {
      host = siteHost
    }
  }

  if (!host) {
    host = fallbackHost
  }

  return host
}

/**
 * This is a hacky solution to get the current host no matter where the app is
 * running. This is not the same as the `window.location.host` because it is
 * dependent on intermediary proxy servers.
 *
 * This is the literal host - port included - not the site.
 */
export default function useHost(): string {
  const cookie = useCookieHost()

  const htmlAudience = useAudienceHost()

  // @note neither source is readable while the server renders: the document
  // does not exist and useCookie reads the request cookie through Next's
  // incremental cache, which the client has no equivalent of. Both are
  // therefore ignored until hydration so the first client render reproduces
  // the server HTML exactly - the layout effects then resolve the real
  // hostname before the browser paints

  const hydrated = useHydrated()

  return resolveHost(
    hydrated ? htmlAudience : '',
    hydrated ? cookie : '',
    new URL(siteUrl).host
  )
}

/**
 * The hostname of the current host - see useHost.
 */
export function useHostname(): string {
  return hostToHostname(useHost())
}

/**
 * Plain (non-hook) variant of useHost for code that runs outside the
 * React render cycle, such as template tasks. The host cookie and the
 * data-audience attribute are set by the server and reflect the real request
 * host behind intermediary proxies - window.location is only a fallback.
 */
export function getDocumentHost(): string {
  if (typeof document === 'undefined') {
    return new URL(siteUrl).host
  }

  const cookie =
    normalizeRequestHost(parse(document.cookie || '').get(HOST_COOKIE_NAME)) ||
    ''

  const htmlAudience = document.documentElement.dataset.audience || ''

  return resolveHost(htmlAudience, cookie, window.location.host)
}
