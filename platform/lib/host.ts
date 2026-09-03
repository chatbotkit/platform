import {
  apiHostname,
  apiUrl,
  siteHostname,
  staticHostname,
  staticUrl,
  widgetHostname,
  widgetUrl,
} from '@/config/site'

import {
  getContextAPIHost,
  getContextFrontendHost,
  getContextRequestHost,
  getContextStaticHost,
  getContextWidgetHost,
} from '@/lib/context.store'
import { isDevelopment, isTest } from '@/lib/env'

import { z } from 'zod'

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

  return getContextRequestHost() || siteHostname
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
  const url = new URL(path, `https://${host}`)

  if (url.hostname === 'localhost') {
    url.protocol = 'http:'
  }

  return url.toString()
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
    getContextRequestHost() || siteHostname
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
  const url = new URL(path, `https://${host}`)

  if (url.hostname === 'localhost') {
    url.protocol = 'http:'
  }

  return url.toString()
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
  host: string = getExternalFrontendHost()
): string {
  const url = new URL(path, `https://${host}`)

  if (url.hostname === 'localhost') {
    url.protocol = 'http:'
  }

  return url.toString()
}

/**
 * Gets the deployment's externally reachable static host.
 */
export function getExternalStaticHost(): string {
  return getContextStaticHost() || staticHostname
}

/**
 * Gets a URL on the deployment's externally reachable static host.
 */
export function getExternalStaticHostURL(path: string = '/'): string {
  const host = getExternalStaticHost()

  return new URL(
    path,
    host === staticHostname ? staticUrl : `https://${host}`
  ).toString()
}

/**
 * Gets the request-affine host for private MCP widget bundles.
 */
export function getExternalWidgetHost(): string {
  return getContextWidgetHost() || widgetHostname
}

/**
 * Gets a URL on the request-affine private MCP widget host.
 */
export function getExternalWidgetHostURL(path: string = '/'): string {
  const host = getExternalWidgetHost()

  return new URL(
    path,
    host === widgetHostname ? widgetUrl : `https://${host}`
  ).toString()
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

  const url = new URL(path, `https://${host}`)

  if (url.hostname === 'localhost') {
    url.protocol = 'http:'
  }

  return url.toString()
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

  const siteHost = siteHostname.startsWith('api.')
    ? siteHostname.slice(4)
    : siteHostname.startsWith('next.')
      ? siteHostname.slice(5)
      : siteHostname

  const bareHost = host.startsWith('api.')
    ? host.slice(4)
    : host.startsWith('next.')
      ? host.slice(5)
      : host

  return bareHost === siteHost ? apiHostname : host
}

/**
 * Get the API host URL based on the environment. It utilizes the getAPIHost
 * function to determine the host and then constructs the URL based on the
 * protocol.
 */
export function getExternalAPIHostURL(
  path: string = '/',
  host: string = getExternalAPIHost()
): string {
  if (
    !host.startsWith('api.') &&
    !path.startsWith('/api/') &&
    !path.startsWith('/.well-known') &&
    !path.startsWith('/oauth')
  ) {
    path = `/api${path.startsWith('/') ? '' : '/'}${path}`
  }

  const url = new URL(path, host === apiHostname ? apiUrl : `https://${host}`)

  if (url.hostname === 'localhost') {
    url.protocol = 'http:'
  }

  return url.toString()
}
