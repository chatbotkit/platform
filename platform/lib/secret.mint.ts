import '@/lib/scope.server'

import type { Contact, Secret } from '@/prisma/types'
import { SecretKind, SecretType } from '@/prisma/types'

import debug from '@/lib/debug'
import { UserAuthError } from '@/lib/error'
import { tryVerify } from '@/lib/jwt'
import {
  authorizationRequiredResponse,
  jsonResponse,
} from '@/lib/secret.authorize'
import { getSecretValueAndType } from '@/lib/secret.value'

// @note kept in sync with pages/api/auxiliary/secret/oauth/pipedream/token.ts;
// the const is not yet centralised (see the @todo in lib/call.ts)
const PIPEDREAM_ACCESS_TOKEN = 'pipedream_access_token'

/**
 * Secret types whose value is a freshly *minted* token that may be handed back
 * to the caller (RFC §7.3 convention): `oauth` (a refreshed access token) and
 * `jwt` (freshly signed). Static stored values - `bearer`, `basic`, `plain` -
 * are deliberately excluded; they never leave the server, use the proxy.
 */
const MINTABLE_BASE_TYPES = new Set([SecretType.oauth, SecretType.jwt])

/** Splits a formatted header value (`"<scheme> <token>"`) into its parts. */
function splitSchemeAndToken(value: string): {
  scheme: string | null
  token: string
} {
  const trimmed = value.trim()
  const index = trimmed.indexOf(' ')

  if (index === -1) {
    return { scheme: null, token: trimmed }
  }

  return {
    scheme: trimmed.slice(0, index),
    token: trimmed.slice(index + 1).trim(),
  }
}

/**
 * Detects a Pipedream-brokered (platform) token: an inert CBK-signed JWT that is
 * only redeemable through `call()`, never a usable provider credential. Such
 * tokens must never be handed back.
 */
async function isPipedreamBrokeredToken(token: string): Promise<boolean> {
  try {
    const payload = await tryVerify(token)

    return (
      !!payload &&
      typeof payload === 'object' &&
      'type' in payload &&
      payload.type === PIPEDREAM_ACCESS_TOKEN
    )
  } catch {
    return false
  }
}

/**
 * Mints a secret for a usable token, returned to the caller (the one path
 * where the credential leaves the server). Modelled on Vercel Connect's token
 * response.
 *
 * Returns:
 * - `200 { token, expiresAt }` on success - the usable token and its expiry
 *   (unix ms, or null). No other metadata is exposed.
 * - `409 { error: 'not_mintable' }` for `bearer`/`basic`/`plain` (static
 *   values - use the proxy) or platform/Pipedream-brokered secrets.
 * - `409 { error: 'authorization_required', url }` if the secret is not yet
 *   authenticated.
 *
 * @note the caller MUST have already loaded the secret and verified OWNERSHIP
 * (`canManipulateSecret`) - mint is owner-only by convention (RFC §7.3).
 */
export async function mintSecret(
  secret: Secret,
  options?: { contact?: Contact | null; namespace?: string | null }
): Promise<Response> {
  debug(`mintSecret`, { secretId: secret.id }).log(
    'secret.mint.mintSecret'
  )

  // a contact-scoped mint may only mint that contact's own *personal* secret -
  // never a shared (app-level) credential. Otherwise a per-contact mint would
  // hand back the owner's shared token to a contact context. Shared secrets are
  // minted only via the unscoped /secret/{secretId}/mint endpoint. This guard
  // runs before any value resolution so a shared token is never even read here.
  if (options?.contact && secret.kind !== SecretKind.personal) {
    return jsonResponse(403, {
      error: 'not_mintable',
      message:
        'Shared secrets cannot be minted in a contact context; use the unscoped /secret/{secretId}/mint endpoint.',
    })
  }

  let resolved

  try {
    resolved = await getSecretValueAndType(secret, {
      contact: options?.contact || undefined,
      namespace: options?.namespace || undefined,
    })
  } catch (error) {
    if (error instanceof UserAuthError) {
      return authorizationRequiredResponse(secret, options, error.message)
    }

    throw error
  }

  if (!resolved) {
    return authorizationRequiredResponse(
      secret,
      options,
      'The secret has no value; authenticate it first.'
    )
  }

  const { value, baseType, expiresAt } = resolved

  // convention: only oauth / jwt (freshly minted tokens) are mintable

  if (!MINTABLE_BASE_TYPES.has(baseType)) {
    return jsonResponse(409, {
      error: 'not_mintable',
      message: `Secrets of type '${baseType}' cannot be minted for a token; use the egress proxy instead.`,
    })
  }

  const { token } = splitSchemeAndToken(value)

  // platform/Pipedream-brokered secrets resolve to an inert CBK JWT, never a
  // usable provider token - refuse them

  if (await isPipedreamBrokeredToken(token)) {
    return jsonResponse(409, {
      error: 'not_mintable',
      message:
        'Platform-managed secrets cannot be minted for a token; use the egress proxy instead.',
    })
  }

  // @note return the token and its expiry only - no other metadata is exposed
  return jsonResponse(200, { token, expiresAt: expiresAt ?? null })
}
