import { hosts } from '@/config/hosts'
import {
  apiHost,
  apiUrl,
  siteHost,
  siteHostname,
  siteUrl,
  staticHost,
  staticUrl,
  widgetHost,
  widgetUrl,
} from '@/config/site'

import {
  getContextAPIHost,
  getContextFrontendHost,
  getContextRequestHost,
  getContextRequestProtocol,
  getContextStaticHost,
  getContextWidgetHost,
} from '@/lib/context.store'
import { isDevelopment, isTest } from '@/lib/env'
import { hostToHostname } from '@/lib/host.parse'
import { isLocalhost } from '@/lib/localhost'

import { z } from 'zod'

// @note callbacks outside a request need the port from SITE_URL; hostname alone
// sends the community stack's background clock to port 80 instead of 3000
const configuredSite = new URL(siteUrl)

// @note these variables are hosts, not URLs - the URL builders below prepend
// the scheme themselves, so a value like `https://api.example.com` would
// produce `https://https/...` targets. Normalise rather than reject: strip any
// scheme and trailing slashes so a URL-shaped value still resolves to its host.

const host = z
  .string()
  .transform((value) => value.replace(/^https?:\/\//, '').replace(/\/+$/, ''))
  .optional()

const env = z
  .object({
    NGROK_HOST: host,
    LOCAL_HOST: host,
    EXTERNAL_HOST: host,
    _ITEST_CHATBOTKIT_BASE_URL: z.string().optional(),
  })
  .parse({
    NGROK_HOST: process.env.NGROK_HOST,
    LOCAL_HOST: process.env.LOCAL_HOST,
    EXTERNAL_HOST: process.env.EXTERNAL_HOST,
    _ITEST_CHATBOTKIT_BASE_URL: process.env._ITEST_CHATBOTKIT_BASE_URL,
  })

/**
 * The host a URL has under a given scheme - a default port for that scheme
 * (`:80` for http, `:443` for https) is dropped, as the browser drops it.
 */
function hostUnder(url: URL, protocol: string): string {
  const candidate = new URL(url)

  candidate.protocol = protocol

  return candidate.host
}

type HostURLOptions = {
  // @note hydration uses configured schemes until the client takes over
  useRequestProtocol?: boolean
}

/**
 * Builds a URL using the configured scheme or the scheme of its request.
 * Loopback and `*.localhost` hosts use plain HTTP.
 */
function buildHostURL(
  path: string,
  base: string,
  { useRequestProtocol = true }: HostURLOptions = {}
): string {
  const url = new URL(path, base)

  if (
    isLocalhost(url.hostname) ||
    url.hostname === '[::1]' ||
    url.hostname.endsWith('.localhost')
  ) {
    url.protocol = 'http:'
  } else if (
    useRequestProtocol &&
    typeof window !== 'undefined' &&
    hostUnder(url, window.location.protocol) === window.location.host
  ) {
    // @note in the browser the page itself is the request; its own host -
    // an alternate port or address of the site, a LAN address - keeps the
    // scheme it was reached on, ahead of what the site url would say
    url.protocol = window.location.protocol
  } else if (hostUnder(url, new URL(siteUrl).protocol) === siteHost) {
    url.protocol = new URL(siteUrl).protocol
  } else {
    const requestHost = useRequestProtocol ? getContextRequestHost() : undefined
    const requestProtocol = requestHost
      ? `${getContextRequestProtocol() || 'https'}:`
      : undefined

    if (
      requestHost &&
      requestProtocol &&
      hostUnder(url, requestProtocol) ===
        new URL(`${requestProtocol}//${requestHost}`).host
    ) {
      // @note compare both hosts under the request scheme, which drops :80 on
      // http even when only the mapping explicitly names that default port
      url.protocol = requestProtocol
    } else if (url.hostname === siteHostname) {
      url.protocol = new URL(siteUrl).protocol
    }
  }

  return url.toString()
}

/**
 * The frontend host the deployment resolved for this request: the request
 * context on the server, the value it stamped on the document in the browser.
 */
function getResolvedFrontendHost(): string | undefined {
  return (
    getContextFrontendHost() ||
    (typeof document !== 'undefined'
      ? document.documentElement.dataset.siteHost
      : undefined) ||
    getExternalFrontendHost()
  )
}

/**
 * Gets the local host based on the environment. When in development, it will
 * use the NGROK_HOST or LOCAL_HOST environment variables. Otherwise, it will
 * use the request host and fallback to the default host.
 */
export function getLocalHost(): string {
  // If running locally, the localhost is either one of the environment
  // variables or the default localhost.

  if (isTest) {
    if (env._ITEST_CHATBOTKIT_BASE_URL) {
      return new URL(env._ITEST_CHATBOTKIT_BASE_URL).host
    }

    return 'localhost:8080'
  }

  if (isDevelopment) {
    return env.NGROK_HOST || env.LOCAL_HOST || 'localhost:8080'
  }

  // When running remotely, the localhost is the host of the incoming request,
  // or the default host configured by the site URL.

  return getContextRequestHost() || configuredSite.host
}

/**
 * Gets the local host URL based on the environment. It utilizes the
 * getLocalHost function to determine the host and then constructs the URL
 * based on the protocol.
 */
export function getLocalHostURL(
  path: string = '/',
  host: string = getLocalHost()
): string {
  return buildHostURL(path, `https://${host}`)
}

/**
 * Gets the external host is the host that is reachable from the Internet. It
 * is determined by the NGROK_HOST or LOCAL_HOST environment variables when in
 * development. Otherwise, it uses the request host and falls back to the site
 * URL.
 */
export function getExternalHost(): string {
  if (isTest) {
    if (env._ITEST_CHATBOTKIT_BASE_URL) {
      return new URL(env._ITEST_CHATBOTKIT_BASE_URL).host
    }

    return 'localhost:8080'
  }

  if (isDevelopment) {
    return (
      env.NGROK_HOST ||
      env.EXTERNAL_HOST ||
      // getContextFrontendHost() || // @note causes issues with infinite redirect in fetch
      getContextRequestHost() ||
      'localhost:8080'
    )
  }

  return (
    // getContextFrontendHost() || // @note causes issues with infinite redirect in fetch
    getContextRequestHost() || configuredSite.host
  )
}

/**
 * Get the external host URL based on the environment. It utilizes the
 * getExternalHost function to determine the host and then constructs the URL
 * based on the protocol.
 */
export function getExternalHostURL(
  path: string = '/',
  host: string = getExternalHost()
): string {
  return buildHostURL(path, `https://${host}`)
}

/**
 * Gets the external frontend host based on the environment. It utilizes the
 * getContextFrontendHost function to determine the host and falls back to
 * the external host if not found.
 */
export function getExternalFrontendHost(): string {
  return getContextFrontendHost() || getExternalHost()
}

/**
 * Gets the external frontend host URL based on the environment. It utilizes the
 * getExternalFrontendHost function to determine the host and then constructs
 * the URL based on the protocol.
 */
export function getExternalFrontendHostURL(
  path: string = '/',
  host: string = getExternalFrontendHost(),
  options?: HostURLOptions
): string {
  return buildHostURL(path, `https://${host}`, options)
}

/**
 * Gets the deployment's externally reachable static host.
 */
export function getExternalStaticHost(): string {
  return getContextStaticHost() || staticHost
}

/**
 * Gets a URL on the deployment's externally reachable static host.
 */
export function getExternalStaticHostURL(
  path: string = '/',
  host: string = getExternalStaticHost()
): string {
  // @note a configured origin is used verbatim - its scheme is explicit;
  // a mapped host has none, so it goes through the scheme inference
  return host === staticHost
    ? new URL(path, staticUrl).toString()
    : buildHostURL(path, `https://${host}`)
}

/**
 * Gets the request-affine host for private MCP widget bundles.
 */
export function getExternalWidgetHost(): string {
  return getContextWidgetHost() || widgetHost
}

/**
 * Gets a URL on the request-affine private MCP widget host.
 */
export function getExternalWidgetHostURL(path: string = '/'): string {
  const host = getExternalWidgetHost()

  return host === widgetHost
    ? new URL(path, widgetUrl).toString()
    : buildHostURL(path, `https://${host}`)
}

/**
 * Gets the API host based on the environment. In this case we simply use the
 * local host.
 */
export function getLocalAPIHost(): string {
  return getLocalHost()
}

/**
 * Get the API host URL based on the environment. It utilizes the getAPIHost
 * function to determine the host and then constructs the URL based on the
 * protocol.
 */
export function getLocalAPIHostURL(
  path: string = '/',
  host: string = getLocalAPIHost()
): string {
  if (!path.startsWith('/api/')) {
    path = `/api${path.startsWith('/') ? '' : '/'}${path}`
  }

  return buildHostURL(path, `https://${host}`)
}

/**
 * Gets the API host based on the environment. In development, it uses the
 * external host. Otherwise, a per-request mapping wins, then hosts in the
 * site's own domain family (the site host and its api./next. variants)
 * resolve to the configured API origin - API_URL, else the site URL itself,
 * where the API answers under /api. Foreign hosts (portals, partner domains,
 * custom domains) pass through untouched.
 *
 * @param host Optional host to use instead of the default external host.
 */
export function getExternalAPIHost(host?: string): string {
  if (isDevelopment) {
    return host ?? getExternalHost()
  }

  if (!host) {
    const contextAPIHost = getContextAPIHost()

    if (contextAPIHost) {
      return contextAPIHost
    }
  }

  host = host ?? getExternalHost()

  // @note site-family membership is a hostname question: the request may
  // arrive on any port, the API is still the configured one
  const stripFamilyPrefix = (hostname: string): string =>
    hostname.startsWith('api.')
      ? hostname.slice(4)
      : hostname.startsWith('next.')
        ? hostname.slice(5)
        : hostname

  return stripFamilyPrefix(hostToHostname(host)) ===
    stripFamilyPrefix(siteHostname)
    ? apiHost
    : host
}

/**
 * Whether an API host serves the API at its root (`/v1`) rather than under
 * `/api`. api.* hosts do by convention, except when the API hostname is also
 * a site hostname - configured (API_URL on SITE_URL's hostname), mapped (a
 * HOSTS_CONFIG site target) or the resolved frontend host - in which case
 * the API still lives under /api. The proxy makes the same call by hostname,
 * ports aside, so the two must agree.
 *
 * @note the mapping table is server-only, so the server stamps its decision
 * for the resolved API host on the document and the browser reads it back
 */
export function servesCleanAPIRoutes(host: string): boolean {
  if (typeof document !== 'undefined') {
    const { apiHost: stampedHost, apiCleanRoutes } =
      document.documentElement.dataset

    if (
      stampedHost === host &&
      (apiCleanRoutes === '1' || apiCleanRoutes === '0')
    ) {
      return apiCleanRoutes === '1'
    }
  }

  const hostname = hostToHostname(host)

  const isSiteHostname =
    hostname === siteHostname ||
    hosts.site.some((site) => hostToHostname(site) === hostname) ||
    hostname === hostToHostname(getResolvedFrontendHost())

  // @note api.* is the spelling convention for clean routes; the browser
  // knows the configured hosts from the document and no mappings, which is
  // why the server stamps its decision for the resolved host
  return host.startsWith('api.') && !isSiteHostname
}

/**
 * Get the API host URL based on the environment. It utilizes the getAPIHost
 * function to determine the host and then constructs the URL based on the
 * protocol.
 */
export function getExternalAPIHostURL(
  path: string = '/',
  host: string = getExternalAPIHost(),
  options?: HostURLOptions
): string {
  if (
    !servesCleanAPIRoutes(host) &&
    !path.startsWith('/api/') &&
    !path.startsWith('/.well-known') &&
    !path.startsWith('/oauth')
  ) {
    path = `/api${path.startsWith('/') ? '' : '/'}${path}`
  }

  // @note a separate API origin has an explicit scheme, like static and
  // widget origins; the site fallback still follows its request after hydration
  if (host === apiHost && apiUrl !== siteUrl) {
    return new URL(path, apiUrl).toString()
  }

  return buildHostURL(
    path,
    host === apiHost ? apiUrl : `https://${host}`,
    options
  )
}
