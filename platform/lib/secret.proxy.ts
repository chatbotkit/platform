import '@/lib/scope.server'

import type { Contact, Secret } from '@/prisma/types'
import { SecretKind } from '@/prisma/types'

import call from '@/lib/egress.call'
import debug from '@/lib/debug'
import { UserAuthError } from '@/lib/error'
import {
  authorizationRequiredResponse,
  jsonResponse,
} from '@/lib/secret.authorize'
import { swapSecrets } from '@/lib/secret.value'

/**
 * The shape of a proxied request as supplied by the caller. The caller may
 * reference the linked secret in any header value using the `${SECRET_DEFAULT}`
 * (or `${SECRET_NAME}` / `{{SECRET_NAME}}`) placeholder; if no header references
 * a secret and no `Authorization` header is present, the linked secret is
 * injected into `Authorization` automatically.
 */
export interface SecretProxyRequest {
  method?: string
  url: string
  headers?: Record<string, string>
  body?: string | null
}

/**
 * Hop-by-hop headers (RFC 7230 §6.1) plus a few we never want to forward back
 * to the caller. `authorization` is stripped from the response so the injected
 * credential is never echoed.
 */
const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
  'authorization',
])

const SECRET_PLACEHOLDER = /\$\{[^}]+\}|\{\{[^}]+\}\}/

/**
 * True only for a canonical dotted-quad IPv4 (four 0-255 octets, no leading
 * zeros). Pure string check - used to reject non-canonical numeric hosts
 * (bare-decimal, octal/leading-zero, short forms) that a resolver still expands
 * to an internal address. Intentionally avoids `node:net` so the module bundles
 * in non-Node targets.
 */
function isCanonicalDottedIPv4(host: string): boolean {
  const parts = host.split('.')

  if (parts.length !== 4) {
    return false
  }

  return parts.every((part) => {
    // 1-3 digits, no leading zeros (octal smuggling), in range 0-255
    return (
      /^\d{1,3}$/.test(part) &&
      part === String(Number(part)) &&
      Number(part) <= 255
    )
  })
}

/**
 * Best-effort SSRF guard. Rejects loopback, link-local, cloud-metadata and
 * RFC 1918 private ranges by hostname so a proxied request cannot reach CBK's
 * own network. Called internally by `executeSecretProxy`; exported for testing.
 *
 * @note this is a hostname check only and is NOT DNS-rebinding safe. The
 * stronger control - restricting the destination to the host(s) associated
 * with the secret - is the follow-up tracked in the RFC (§6.3). For
 * Pipedream-brokered platform secrets the destination is additionally bounded
 * by Pipedream's per-app `allowed_domains` in `call()`.
 */
export function isAllowedEgressUrl(rawUrl: string): boolean {
  let url: URL

  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false
  }

  // strip IPv6 brackets (`new URL('http://[::1]/').hostname` === '[::1]')
  const host = url.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')

  // IPv6: hosts are hex:colon, so prefix checks cannot collide with DNS names
  if (host.includes(':')) {
    // IPv4-mapped / -compatible IPv6 embeds a v4 address (e.g.
    // `::ffff:169.254.169.254`, `::ffff:7f00:1`) and routes to it - block it so
    // it cannot smuggle an internal v4 destination past the checks below
    if (host.includes('.') || host.startsWith('::ffff:')) {
      return false
    }

    return !(
      host === '::1' || // loopback
      host === '::' || // unspecified
      host.startsWith('fe80:') || // link-local
      host.startsWith('fc') || // unique-local fc00::/7
      host.startsWith('fd')
    )
  }

  // reject non-canonical IPv4 literals the platform resolver still expands to an
  // internal address but which slip past the textual prefix checks below: hex
  // (`0x7f000001`), bare-decimal (`2130706433`), octal/leading-zero
  // (`0177.0.0.1`) and short forms (`127.1`). Any all-numeric / dotted host must
  // be a canonical dotted-quad to proceed.
  if (/^0x[0-9a-f]+$/i.test(host)) {
    return false
  }

  if (/^[0-9.]+$/.test(host) && !isCanonicalDottedIPv4(host)) {
    return false
  }

  // IPv4 / DNS
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return false
  }

  return true
}

/**
 * Executes a proxied request on behalf of a secret. The secret value is
 * injected into the outbound headers at egress (via `swapSecrets`) and the
 * request is performed through the standard egress path (`call`, which handles
 * the Pipedream Connect rewrite, retries and timeouts). The plaintext credential
 * is never returned to the caller.
 *
 * Returns:
 * - `400` if the destination URL is not an allowed egress target.
 * - `409 { error: 'authorization_required', url }` if the secret is not yet
 *   authenticated - `url` is where the user must go to authorize (omitted when
 *   the secret cannot be authenticated in this context).
 * - otherwise the upstream response, streamed back verbatim with the injected
 *   `Authorization` and hop-by-hop headers stripped.
 *
 * @note the caller MUST have already loaded the secret and verified access
 * (`canUseSecret`). This function does not re-check authorization beyond what
 * `swapSecrets` enforces internally.
 */
export async function executeSecretProxy(
  userId: string,
  secret: Secret,
  request: SecretProxyRequest,
  options?: { contact?: Contact | null; namespace?: string | null }
): Promise<Response> {
  const { method = 'GET', url, headers: requestHeaders, body } = request

  debug(`executeSecretProxy`, { userId, secretId: secret.id, method, url }).log(
    'secret.proxy.executeSecretProxy'
  )

  // a contact-scoped proxy may only use that contact's own *personal* secret. A
  // shared (app-level) credential resolves identically with or without a contact
  // (DirectSecretManager ignores it), so addressing it through a contact context
  // is redundant - and this keeps the contact-scoped surface uniformly "the
  // contact's own secret", mirroring the mint guard. Shared secrets go through
  // the unscoped /secret/{secretId}/proxy endpoint.
  if (options?.contact && secret.kind !== SecretKind.personal) {
    return jsonResponse(403, {
      error: 'forbidden_secret_kind',
      message:
        'Shared secrets cannot be used through a contact context; use the unscoped /secret/{secretId}/proxy endpoint.',
    })
  }

  if (!isAllowedEgressUrl(url)) {
    return jsonResponse(400, {
      error: 'invalid_destination',
      message: 'Destination host is not allowed',
    })
  }

  const headers = new Headers()

  for (const [key, value] of Object.entries(requestHeaders || {})) {
    if (typeof value === 'string') {
      headers.set(key, value)
    }
  }

  // if the caller did not reference the secret anywhere, default the
  // Authorization header to the linked secret

  const referencesSecret = [...headers.values()].some((value) =>
    SECRET_PLACEHOLDER.test(value)
  )

  if (!headers.has('authorization') && !referencesSecret) {
    headers.set('authorization', '${SECRET_DEFAULT}')
  }

  let outboundHeaders: Headers

  try {
    outboundHeaders = await swapSecrets(headers, {
      userId,
      secretId: secret.id,
      abilityId: null,
      contact: options?.contact || undefined,
      namespace: options?.namespace || undefined,
    })
  } catch (error) {
    // an unauthenticated (or otherwise unresolvable) secret surfaces as a
    // UserAuthError - turn it into an actionable authorization_required
    // response carrying the URL the user must visit to authenticate

    if (error instanceof UserAuthError) {
      return authorizationRequiredResponse(secret, options, error.message)
    }

    throw error
  }

  const upstream = await call(url, {
    method,
    headers: outboundHeaders,
    body: body ?? undefined,
    // do NOT follow redirects: the destination is only validated for the initial
    // URL, so a 3xx pointing at an internal host (e.g. cloud metadata) must not
    // be auto-followed. `manual` yields an opaque-redirect (status 0) we reject
    // below rather than chasing the unvalidated Location (SSRF).
    redirect: 'manual',
  })

  if (upstream.status === 0 || upstream.type === 'opaqueredirect') {
    return jsonResponse(502, {
      error: 'redirect_blocked',
      message:
        'The destination returned a redirect, which is not followed by the proxy.',
    })
  }

  // stream the upstream response back, stripping hop-by-hop headers and never
  // echoing the injected Authorization header

  const responseHeaders = new Headers()

  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value)
    }
  })

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}
