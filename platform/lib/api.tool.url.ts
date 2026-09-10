import { getExternalAPIHost } from '@/lib/host'

/**
 * Resolves the URL an in-app HTTP tool may call. Requests to the deployment's
 * API host and same-origin requests are folded onto the page origin under
 * /api, so they stay same-origin and carry the session; anything else is
 * left as is for the caller to refuse.
 */
export function resolvePlatformApiUrl(
  url: string,
  location: { origin: string; host: string } = window.location
): URL {
  const u = new URL(url, location.origin)

  // @note the page knows its request-affine API host from the document; the
  // configured one is the fallback. Hosts carry their port on either side
  const apiHost =
    (typeof document !== 'undefined' &&
      document.documentElement.dataset.apiHost) ||
    getExternalAPIHost()

  // @note URL.host omits a default port, while a mapping may spell it out
  const normalizedAPIHost = apiHost
    ? new URL(`${u.protocol}//${apiHost}`).host
    : undefined

  if (u.host === normalizedAPIHost || u.host === location.host) {
    const localOrigin = new URL(location.origin)

    u.protocol = localOrigin.protocol
    // @note assigning host alone retains the API port when the page uses its
    // scheme's default port, so replace the hostname and port separately
    u.hostname = localOrigin.hostname
    u.port = localOrigin.port
    u.pathname = u.pathname.startsWith('/api/')
      ? u.pathname
      : `/api${u.pathname}`
  }

  return u
}
