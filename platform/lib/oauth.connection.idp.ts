import { TEN_MINUTES_IN_SECONDS } from '@chatbotkit-dev/time'

import cuid from '@/lib/cuid'
import debug from '@/lib/debug'
import memcache from '@/lib/memcache'

// ---
// Pending IdP Authorization State (step: authorize -> IdP callback)
// ---

/**
 * State stored in Redis while the end-user is being redirected to the IdP and
 * back. Keyed by a random `idpState` value that is forwarded as the OAuth
 * `state` parameter to the IdP so the callback can retrieve it.
 *
 * The `context` field is opaque to the callback route - it is stored by the
 * authorize endpoint and carried through verbatim to the authorization request
 * so the consuming token endpoint can recover caller-specific state (e.g. which
 * integration or application initiated the flow).
 */
export interface IdpOAuthPendingState<TContext = Record<string, unknown>> {
  oAuthConnectionId: string

  // The caller's original OAuth request parameters

  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
  scope: string
  state?: string

  // Pre-discovered IdP token endpoint so the callback does not need to
  // re-discover it

  idpTokenEndpoint: string

  // The exact redirect_uri sent to the IdP during authorize - must be reused
  // verbatim in the token exchange or the IdP will reject with redirect_uri_mismatch

  idpCallbackUrl: string

  // Caller-specific context - passed through verbatim by the callback without
  // inspection; recovered by the token endpoint

  context: TContext

  createdAt: number
}

function getIdpOAuthPendingStateRedisKey(idpState: string): string {
  return `oauth:idp:pending:${idpState}`
}

/**
 * Store an IdP OAuth pending state in Redis.
 */
export async function storeIdpOAuthPendingState<TContext>(
  idpState: string,
  state: IdpOAuthPendingState<TContext>,
  expirySeconds: number = TEN_MINUTES_IN_SECONDS
): Promise<void> {
  debug('storing idp oauth pending state', {
    idpState,
    oAuthConnectionId: state.oAuthConnectionId,
  }).log('oauth.connection.idp.store')

  const redisKey = getIdpOAuthPendingStateRedisKey(idpState)

  await memcache.set(redisKey, JSON.stringify(state), { ex: expirySeconds })
}

/**
 * Retrieve a pending IdP OAuth state from Redis.
 */
export async function retrieveIdpOAuthPendingState<TContext>(
  idpState: string
): Promise<IdpOAuthPendingState<TContext> | null> {
  debug('retrieving idp oauth pending state', { idpState }).log(
    'oauth.connection.idp.retrieve'
  )

  const redisKey = getIdpOAuthPendingStateRedisKey(idpState)

  const json = await memcache.get(redisKey)

  if (!json) {
    debug('idp oauth pending state not found', { idpState }).log(
      'oauth.connection.idp.retrieve'
    )

    return null
  }

  return (
    typeof json === 'string' ? JSON.parse(json) : json
  ) as IdpOAuthPendingState<TContext>
}

/**
 * Delete an IdP OAuth pending state from Redis. Called after the IdP callback
 * completes to prevent replay.
 */
export async function deleteIdpOAuthPendingState(
  idpState: string
): Promise<boolean> {
  debug('deleting idp oauth pending state', { idpState }).log(
    'oauth.connection.idp.delete'
  )

  const redisKey = getIdpOAuthPendingStateRedisKey(idpState)

  const deleted = await memcache.del(redisKey)

  return Boolean(deleted)
}

// ---
// IdP Authorization Code Storage (step: IdP callback -> caller token exchange)
// ---

/**
 * Data stored in Redis under a short-lived CBK-issued authorization code.
 * After the IdP callback succeeds this code is sent back to the caller, which
 * exchanges it at the token endpoint for an access token.
 *
 * The `context` field carries over the opaque caller context from the pending
 * state so the token endpoint can recover it without an extra database lookup.
 */
export interface IdpOAuthAuthorizationRequest<
  TContext = Record<string, unknown>,
> {
  code: string

  // The caller's OAuth parameters - needed for PKCE verification and redirect
  // validation during the token exchange

  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
  scope: string
  state?: string

  // IdP user identity - carried into the access token

  idpSub: string
  idpEmail?: string

  // Caller-specific context, carried over from the pending state verbatim

  context: TContext

  createdAt: number
}

function getIdpOAuthAuthorizationRequestRedisKey(code: string): string {
  return `oauth:idp:authcode:${code}`
}

/**
 * Generate a new CBK authorization code for an IdP OAuth flow.
 */
export function generateIdpOAuthCode(): string {
  return `cbk_idp_${cuid()}`
}

/**
 * Store an IdP OAuth authorization request in Redis.
 */
export async function storeIdpOAuthAuthorizationRequest<TContext>(
  request: IdpOAuthAuthorizationRequest<TContext>,
  expirySeconds: number = TEN_MINUTES_IN_SECONDS
): Promise<void> {
  debug('storing idp oauth authorization request', {
    code: request.code.substring(0, 12) + '...',
    clientId: request.clientId,
    idpSub: request.idpSub,
  }).log('oauth.connection.idp.store')

  const redisKey = getIdpOAuthAuthorizationRequestRedisKey(request.code)

  await memcache.set(redisKey, JSON.stringify(request), { ex: expirySeconds })
}

/**
 * Retrieve an IdP OAuth authorization request from Redis.
 */
export async function retrieveIdpOAuthAuthorizationRequest<TContext>(
  code: string
): Promise<IdpOAuthAuthorizationRequest<TContext> | null> {
  debug('retrieving idp oauth authorization request', {
    code: code.substring(0, 12) + '...',
  }).log('oauth.connection.idp.retrieve')

  const redisKey = getIdpOAuthAuthorizationRequestRedisKey(code)

  const json = await memcache.get(redisKey)

  if (!json) {
    debug('idp oauth authorization request not found').log(
      'oauth.connection.idp.retrieve'
    )

    return null
  }

  return (
    typeof json === 'string' ? JSON.parse(json) : json
  ) as IdpOAuthAuthorizationRequest<TContext>
}

/**
 * Atomically retrieve and delete an IdP OAuth authorization request from
 * Redis so the code can only be exchanged once.
 */
export async function consumeIdpOAuthAuthorizationRequest<TContext>(
  code: string
): Promise<IdpOAuthAuthorizationRequest<TContext> | null> {
  debug('consuming idp oauth authorization request', {
    code: code.substring(0, 12) + '...',
  }).log('oauth.connection.idp.consume')

  const redisKey = getIdpOAuthAuthorizationRequestRedisKey(code)

  const json = await memcache.getdel(redisKey)

  if (!json) {
    debug('idp oauth authorization request not found during consume').log(
      'oauth.connection.idp.consume'
    )

    return null
  }

  return (
    typeof json === 'string' ? JSON.parse(json) : json
  ) as IdpOAuthAuthorizationRequest<TContext>
}

/**
 * Delete an IdP OAuth authorization request from Redis.
 */
export async function deleteIdpOAuthAuthorizationRequest(
  code: string
): Promise<boolean> {
  debug('deleting idp oauth authorization request', {
    code: code.substring(0, 12) + '...',
  }).log('oauth.connection.idp.delete')

  const redisKey = getIdpOAuthAuthorizationRequestRedisKey(code)

  const deleted = await memcache.del(redisKey)

  return Boolean(deleted)
}
