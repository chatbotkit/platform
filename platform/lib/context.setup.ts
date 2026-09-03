import type { NextApiRequest } from 'next'

import { hostsConfig } from '@/config/hosts'

import {
  getContextFrontendHost,
  getContextRequestHost,
  setContextAPIHost,
  setContextFrontendHost,
  setContextRequest,
  setContextRequestHost,
  setContextRequestIpAddress,
  setContextRequestProtocol,
  setContextRequestQuery,
  setContextRequestStartTime,
  setContextRequestUserAgent,
  setContextStaticHost,
  setContextTimezone,
  setContextWidgetHost,
} from '@/lib/context.store'
import {
  type AnyRequest,
  getHeader,
  getTimezoneHeader,
  getUserAgentHeader,
} from '@/lib/header'
import { injectInternalAssertionContext } from '@/lib/header.assertion'
import { isIpAddress } from '@/lib/ip'
import { getQuery } from '@/lib/query.get'

/**
 * Resolves the untrusted request host at the request-normalization boundary.
 * Portal-originated URLs must prefer the separately authenticated frontend
 * host; this value remains ordinary request metadata.
 */
function normalizeRequestHost(value: string | null): string | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(`https://${value.trim()}`)

    if (
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null
    }

    return url.host
  } catch {
    return null
  }
}

function normalizeRequestProtocol(value: string | null): string | null {
  const protocol = value?.trim().toLowerCase()

  return protocol === 'http' || protocol === 'https' ? protocol : null
}

function shouldTrustProxyHeaders(): boolean {
  return process.env.TRUST_PROXY_HEADERS === 'true'
}

function injectMappedHosts(): void {
  const host = getContextFrontendHost() || getContextRequestHost()

  const mapping = host
    ? Object.values(hostsConfig).find(({ match }) => match.includes(host))
    : undefined

  setContextStaticHost(mapping?.static)
  setContextWidgetHost(mapping?.widgets)
  setContextAPIHost(mapping?.api)

  if (mapping) {
    setContextFrontendHost(mapping.site)
  }
}

/**
 * The client address as written by a trusted proxy: `x-real-ip`, else the
 * last `x-forwarded-for` hop, which is the one the proxy itself appended.
 * Earlier hops are whatever the client sent and are never used.
 */
function getRequestIpAddress(
  req: AnyRequest,
  trustProxy: boolean
): string | null {
  if (!trustProxy) {
    return null
  }

  const realIp = getHeader(req, 'x-real-ip')?.trim()

  if (realIp && isIpAddress(realIp)) {
    return realIp
  }

  const forwardedFor = getHeader(req, 'x-forwarded-for')

  if (forwardedFor) {
    const lastHop = forwardedFor.split(',').pop()?.trim()

    if (lastHop && isIpAddress(lastHop)) {
      return lastHop
    }
  }

  return null
}

function getRequestHost(req: AnyRequest, trustProxy: boolean): string | null {
  if (trustProxy) {
    const forwardedHost = normalizeRequestHost(
      getHeader(req, 'x-forwarded-host')
    )

    if (forwardedHost) {
      return forwardedHost
    }
  }

  return normalizeRequestHost(getHeader(req, 'host'))
}

function getRequestProtocol(
  req: AnyRequest,
  trustProxy: boolean
): string | null {
  if (trustProxy) {
    const forwardedProtocol = normalizeRequestProtocol(
      getHeader(req, 'x-forwarded-proto')
    )

    if (forwardedProtocol) {
      return forwardedProtocol
    }
  }

  if (!(req instanceof Headers) && typeof req.url === 'string') {
    try {
      return normalizeRequestProtocol(new URL(req.url).protocol.slice(0, -1))
    } catch {
      // @note Pages Router request URLs are normally relative
    }
  }

  return null
}

/**
 * Initializes every context value available from request headers.
 */
export function setupHeadersContext(req: AnyRequest): void {
  const trustProxy = shouldTrustProxyHeaders()

  setContextRequestHost(getRequestHost(req, trustProxy))
  setContextRequestProtocol(getRequestProtocol(req, trustProxy))

  setContextRequestUserAgent(getUserAgentHeader(req))

  setContextTimezone(getTimezoneHeader(req))

  const ipAddress = getRequestIpAddress(req, trustProxy)

  if (ipAddress) {
    setContextRequestIpAddress(ipAddress)
  }

  // @note verified portal assertions must be promoted after ordinary headers
  // so authenticated origin metadata takes precedence over proxy metadata

  injectInternalAssertionContext(req)

  injectMappedHosts()
}

/**
 * Initializes the complete context for a Web or Pages Router request.
 */
export function setupRequestContext(req: Request | NextApiRequest): void {
  setContextRequest(req)

  setContextRequestStartTime(Date.now())

  setContextRequestQuery(getQuery(req))

  setupHeadersContext(req)
}
