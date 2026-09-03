import '@/lib/scope.server'

import {
  CHATBOTKIT_ASSERTION_HEADER_PREFIX,
  CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME,
  CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME,
} from '@/config/headers'

import {
  setContextFrontendHost,
  setContextRequestIpAddress,
} from '@/lib/context.store'
import { warn } from '@/lib/debug'
import { type AnyRequest, toHeaders } from '@/lib/header'
import { isIpAddress } from '@/lib/ip'

import { createHmac, timingSafeEqual } from 'node:crypto'

const ASSERTION_VERSION = 'v1'
const MINIMUM_SECRET_LENGTH = 16

interface InternalAssertionValues {
  frontendHost?: string | null
  realIp?: string | null
}

function normalizeFrontendHost(value: string): string | null {
  try {
    const url = new URL(`https://${value}`)

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

function normalizeRealIp(value: string): string | null {
  const realIp = value.trim()

  return isIpAddress(realIp) ? realIp : null
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url')
}

function decodeBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    return null
  }

  try {
    const bytes = Buffer.from(value, 'base64url')

    if (bytes.toString('base64url') !== value) {
      return null
    }

    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

function getAssertionTag(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function isValidAssertionTag(
  payload: string,
  tag: string,
  secret: string
): boolean {
  if (!/^[a-f0-9]{64}$/.test(tag)) {
    return false
  }

  const actual = Buffer.from(tag, 'hex')
  const expected = Buffer.from(getAssertionTag(payload, secret), 'hex')

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function getRequestHeaders(req: AnyRequest): Headers | null {
  if (req instanceof Headers) {
    return req
  }

  if (!req.headers) {
    return null
  }

  return req.headers instanceof Headers ? req.headers : toHeaders(req.headers)
}

function getCanonicalValue(
  name: string,
  value: string | null | undefined
): string | null {
  if (!value) {
    return null
  }

  switch (name) {
    case CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME: {
      return normalizeFrontendHost(value)
    }

    case CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME: {
      return normalizeRealIp(value)
    }

    default: {
      return null
    }
  }
}

/**
 * Serializes internal context values under authenticated, non-canonical wire
 * names so an unverified consumer cannot accidentally read them.
 */
export function getInternalAssertionHeaders(
  values: InternalAssertionValues,
  secret: string | undefined = process.env.INTERNAL_HEADERS_SECRET
): { [key: string]: string } {
  const canonicalValues = [
    [CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME, values.frontendHost],
    [CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME, values.realIp],
  ] as const

  const presentValues = canonicalValues.filter(([, value]) => value)

  if (!presentValues.length) {
    return {}
  }

  if (!secret || secret.length < MINIMUM_SECRET_LENGTH) {
    warn(
      'INTERNAL_HEADERS_SECRET is missing or shorter than 16 characters; internal assertions will not be sent'
    )

    return {}
  }

  const headers: { [key: string]: string } = {}

  for (const [name, rawValue] of presentValues) {
    const value = getCanonicalValue(name, rawValue)

    if (!value) {
      continue
    }

    const payload = [
      ASSERTION_VERSION,
      encodeBase64Url(name),
      encodeBase64Url(value),
    ].join('.')

    headers[
      `${CHATBOTKIT_ASSERTION_HEADER_PREFIX}${getAssertionTag(payload, secret)}`
    ] = payload
  }

  return headers
}

/**
 * Extracts only valid, allowlisted internal assertions. Canonical internal
 * header names are deliberately ignored because clients can send them.
 */
export function getInternalAssertionValues(
  req: AnyRequest,
  secret: string | undefined = process.env.INTERNAL_HEADERS_SECRET
): InternalAssertionValues {
  const headers = getRequestHeaders(req)

  if (!headers) {
    return {}
  }

  const assertionHeaders = [...headers.entries()].filter(([name]) =>
    name.startsWith(CHATBOTKIT_ASSERTION_HEADER_PREFIX)
  )

  if (!assertionHeaders.length) {
    return {}
  }

  if (!secret || secret.length < MINIMUM_SECRET_LENGTH) {
    warn(
      'INTERNAL_HEADERS_SECRET is missing or shorter than 16 characters; incoming internal assertions will not be trusted'
    )

    return {}
  }

  const values = new Map<string, string>()
  const duplicates = new Set<string>()

  for (const [wireName, payload] of assertionHeaders) {
    const tag = wireName.slice(CHATBOTKIT_ASSERTION_HEADER_PREFIX.length)

    if (!isValidAssertionTag(payload, tag, secret)) {
      continue
    }

    const parts = payload.split('.')

    if (parts.length !== 3 || parts[0] !== ASSERTION_VERSION) {
      continue
    }

    const name = decodeBase64Url(parts[1])
    const rawValue = decodeBase64Url(parts[2])

    if (!name || rawValue === null) {
      continue
    }

    const value = getCanonicalValue(name, rawValue)

    if (!value) {
      continue
    }

    if (values.has(name)) {
      duplicates.add(name)

      continue
    }

    values.set(name, value)
  }

  for (const name of duplicates) {
    values.delete(name)
  }

  return {
    frontendHost: values.get(CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME),
    realIp: values.get(CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME),
  }
}

/**
 * Promotes authenticated internal assertions into the request context. Raw
 * canonical headers never enter context through this boundary.
 */
export function injectInternalAssertionContext(
  req: AnyRequest,
  secret: string | undefined = process.env.INTERNAL_HEADERS_SECRET
): InternalAssertionValues {
  const values = getInternalAssertionValues(req, secret)

  if (values.frontendHost) {
    setContextFrontendHost(values.frontendHost)
  }

  if (values.realIp) {
    setContextRequestIpAddress(values.realIp)
  }

  return values
}
