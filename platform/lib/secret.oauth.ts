import prisma from '@/prisma/client'
import type { Secret } from '@/prisma/types'
import { SecretType } from '@/prisma/types'

import debug, { assert } from '@/lib/debug'
import { refreshAccessToken } from '@/lib/oauth.authorization'
import { discoverOAuthConfig } from '@/lib/oauth.discovery'
import {
  needsSelfRegistration,
  registerOAuthClient,
} from '@/lib/oauth.registration'
import { revealSecretInstanceFromReferenceSecret } from '@/lib/secret.reference'
import { revealSecretInstanceFromTemplateSecret } from '@/lib/secret.template'
import { tryParse, tryStringify } from '@/lib/yaml'
import zod, { partialObjectParse } from '@/lib/zod.schema'

/**
 * Result type for getSecretOAuthConfig, including both traditional OAuth
 * fields and discovery-related fields.
 */
export interface SecretOAuthConfig {
  /**
   * Client ID for OAuth authentication.
   */
  clientId?: string
  /**
   * Client secret for OAuth authentication.
   */
  clientSecret?: string
  /**
   * Authorization endpoint URL.
   */
  authorizationUrl?: string
  /**
   * Token endpoint URL.
   */
  tokenUrl?: string
  /**
   * Revocation endpoint URL.
   */
  revokeUrl?: string
  /**
   * Validation endpoint URL.
   */
  validateUrl?: string
  /**
   * Grant type for OAuth (e.g., 'authorization_code', 'client_credentials').
   */
  grantType?: string
  /**
   * Requested scopes (space-separated).
   */
  scope?: string
  /**
   * Protected resource URL for OAuth discovery (RFC 9728).
   * When present, endpoints can be discovered automatically.
   */
  resourceUrl?: string
  /**
   * Dynamic client registration endpoint (discovered from auth server).
   */
  registrationEndpoint?: string
  /**
   * Whether the auth server supports client_id metadata document (MCP).
   */
  clientIdMetadataDocumentSupported?: boolean
  /**
   * Supported PKCE code challenge methods (e.g., ['S256']).
   */
  codeChallengeMethodsSupported?: string[]
  /**
   * Whether this config requires PKCE (public client without client_secret).
   */
  requiresPkce?: boolean
}

/**
 * Get the OAuth configuration for a secret. The method is agnostic to the
 * secret type - i.e. no matter if it is oauth or template it will return the
 * OAuth configuration.
 *
 * When a `resourceUrl` is present in the config but no explicit OAuth
 * endpoints, this function will perform OAuth discovery as per RFC 9728
 * (Protected Resource Metadata) and RFC 8414 (Authorization Server Metadata).
 *
 * @param secret - The secret to get OAuth config from
 * @returns OAuth configuration with discovered endpoints if applicable
 */
export async function getSecretOAuthConfig(
  secret: Secret
): Promise<Partial<SecretOAuthConfig>> {
  debug(`getSecretOAuthConfig`, { secretId: secret.id })

  let config: unknown

  switch (secret.type) {
    case SecretType.oauth: {
      config = secret.config || {}

      break
    }

    case SecretType.template: {
      const instance = await revealSecretInstanceFromTemplateSecret(secret)

      config = instance?.config || {}

      break
    }

    case SecretType.reference: {
      const instance = await revealSecretInstanceFromReferenceSecret(secret)

      config = instance?.config || {}

      break
    }

    default: {
      // @todo throw error?

      config = {}
    }
  }

  if (!config || typeof config !== 'object') {
    config = {}
  }

  // Parse the explicit configuration including resourceUrl

  const explicitConfig = partialObjectParse(
    zod.object({
      clientId: zod.string().optional(),
      clientSecret: zod.string().optional(),
      authorizationUrl: zod.string().optional(),
      tokenUrl: zod.string().optional(),
      revokeUrl: zod.string().optional(),
      validateUrl: zod.string().optional(),
      grantType: zod.string().optional(),
      scope: zod.string().optional(),
      resourceUrl: zod.string().optional(),
    }),
    config as Record<string, unknown>
  )

  // If we have resourceUrl but missing OAuth endpoints, perform discovery

  if (
    explicitConfig.resourceUrl &&
    (!explicitConfig.authorizationUrl || !explicitConfig.tokenUrl)
  ) {
    debug(`performing OAuth discovery`, {
      resourceUrl: explicitConfig.resourceUrl,
    })

    const discoveredConfig = await discoverOAuthConfig(
      explicitConfig.resourceUrl
    )

    if (discoveredConfig) {
      debug(`discovered OAuth config`, { discoveredConfig })

      // Merge: explicit config takes precedence over discovered config

      return {
        // Use explicit values if provided, otherwise use discovered

        authorizationUrl:
          explicitConfig.authorizationUrl || discoveredConfig.authorizationUrl,
        tokenUrl: explicitConfig.tokenUrl || discoveredConfig.tokenUrl,
        revokeUrl: explicitConfig.revokeUrl || discoveredConfig.revokeUrl,
        scope: explicitConfig.scope || discoveredConfig.scope,

        // These are always from explicit config (not discoverable)

        clientId: explicitConfig.clientId,
        clientSecret: explicitConfig.clientSecret,
        validateUrl: explicitConfig.validateUrl,
        grantType: explicitConfig.grantType,

        // Pass through discovery-specific fields

        resourceUrl: explicitConfig.resourceUrl,
        registrationEndpoint: discoveredConfig.registrationEndpoint,
        clientIdMetadataDocumentSupported:
          discoveredConfig.clientIdMetadataDocumentSupported,
        codeChallengeMethodsSupported:
          discoveredConfig.codeChallengeMethodsSupported,
      }
    }

    // Discovery failed - log but continue with explicit config

    debug(`OAuth discovery failed, using explicit config`)
  }

  return explicitConfig
}

/**
 * Resolves a secret to its underlying OAuth secret. For template and reference
 * secrets, this resolves to the underlying instance. For oauth secrets, returns
 * the secret as-is.
 *
 * @param secret - The secret to resolve
 * @returns The resolved secret with type 'oauth', or null if resolution fails
 */
async function resolveToOAuthSecret(secret: Secret): Promise<Secret | null> {
  switch (secret.type) {
    case SecretType.oauth: {
      return secret
    }

    case SecretType.template: {
      return await revealSecretInstanceFromTemplateSecret(secret)
    }

    case SecretType.reference: {
      return await revealSecretInstanceFromReferenceSecret(secret)
    }

    default: {
      return null
    }
  }
}

/**
 * Get the OAuth value for a secret.
 *
 * @param secret
 * @returns
 */
export async function getSecretOAuthValue(secret: Secret): Promise<
  Partial<{
    accessToken: string
    accessTokenExpiresAt: number
    refreshToken: string
    refreshTokenExpiresAt: number
    additionalProperties: {
      [key: string]: unknown
    }
  }>
> {
  debug(`getSecretOAuthValue`, { secretId: secret.id })

  // @note resolve template/reference secrets to their underlying oauth secret

  const resolvedSecret = await resolveToOAuthSecret(secret)

  assert(
    resolvedSecret?.type === SecretType.oauth,
    `Expected secret type 'oauth', got '${secret.type}'`
  )

  // @note this check is redundant with the assert above but helps TypeScript
  // narrow the type

  if (!resolvedSecret) {
    throw new Error('Secret resolution failed')
  }

  const value = partialObjectParse(
    zod.object({
      accessToken: zod.string().optional(),
      accessTokenExpiresAt: zod.coerce.number().optional(),
      refreshToken: zod.string().optional(),
      refreshTokenExpiresAt: zod.coerce.number().optional(),
      additionalProperties: zod.record(zod.unknown()).optional(),
    }),
    (tryParse(resolvedSecret.value || '') || {}) as Record<string, unknown>
  )

  const {
    accessToken,
    accessTokenExpiresAt,
    refreshToken,
    refreshTokenExpiresAt,
    additionalProperties,
  } = value

  return {
    accessToken,
    accessTokenExpiresAt,

    refreshToken,
    refreshTokenExpiresAt,

    additionalProperties,
  }
}

/**
 * Get the new OAuth value for a secret by merging the existing value with
 * the provided updates.
 *
 * @param secret
 * @param value
 * @returns
 */
export async function getNewSecretOAuthValue(
  secret: Secret,
  value: Partial<{
    accessToken: string
    accessTokenExpiresAt: Date | number | string
    refreshToken: string
    refreshTokenExpiresAt: Date | number | string
    additionalProperties: {
      [key: string]: unknown
    }
  }>
): Promise<string> {
  debug(`getNewSecretOAuthValue`, { secretId: secret.id })

  // @note resolve template/reference secrets to their underlying oauth secret

  const resolvedSecret = await resolveToOAuthSecret(secret)

  assert(
    resolvedSecret?.type === SecretType.oauth,
    `Expected secret type 'oauth', got '${secret.type}'`
  )

  // @note this check is redundant with the assert above but helps TypeScript
  // narrow the type

  if (!resolvedSecret) {
    throw new Error('Secret resolution failed')
  }

  const originalValue = await getSecretOAuthValue(resolvedSecret)

  const normalizeDate = (dateValue?: Date | number | string) => {
    return dateValue ? new Date(dateValue).getTime() : undefined
  }

  return tryStringify({
    ...originalValue,

    accessToken: value.accessToken ?? originalValue.accessToken,
    accessTokenExpiresAt:
      value.accessTokenExpiresAt !== undefined
        ? normalizeDate(value.accessTokenExpiresAt)
        : normalizeDate(originalValue.accessTokenExpiresAt),

    refreshToken: value.refreshToken ?? originalValue.refreshToken,
    refreshTokenExpiresAt:
      value.refreshTokenExpiresAt !== undefined
        ? normalizeDate(value.refreshTokenExpiresAt)
        : normalizeDate(originalValue.refreshTokenExpiresAt),

    additionalProperties:
      value.additionalProperties ?? originalValue.additionalProperties,
  })
}

/**
 * Set the OAuth value for a secret.
 *
 * @param secret
 * @param value
 */
export async function setSecretOAuthValue(
  secret: Secret,
  value: Partial<{
    accessToken: string
    accessTokenExpiresAt: Date | number | string
    refreshToken: string
    refreshTokenExpiresAt: Date | number | string
    additionalProperties: {
      [key: string]: unknown
    }
  }>
): Promise<void> {
  debug(`setSecretOAuthValue`, { secretId: secret.id })

  // @note resolve template/reference secrets to their underlying oauth secret

  const resolvedSecret = await resolveToOAuthSecret(secret)

  assert(
    resolvedSecret?.type === SecretType.oauth,
    `Expected secret type 'oauth', got '${secret.type}'`
  )

  await prisma.secret.update({
    where: {
      id: secret.id,
    },
    data: {
      value: await getNewSecretOAuthValue(secret, value),
    },
  })
}

/**
 * Updates the secret config with new values (e.g., after client registration).
 *
 * @param secret - The secret to update
 * @param configUpdate - The config fields to update
 */
export async function updateSecretOAuthConfig(
  secret: Secret,
  configUpdate: Partial<SecretOAuthConfig>
): Promise<void> {
  debug(`updateSecretOAuthConfig`, {
    secretId: secret.id,
    updateKeys: Object.keys(configUpdate),
  })

  const currentConfig = (secret.config as Record<string, unknown> | null) || {}

  await prisma.secret.update({
    where: {
      id: secret.id,
    },
    data: {
      config: {
        ...currentConfig,
        ...configUpdate,
      },
    },
  })
}

/**
 * Performs client self-registration for a secret with resourceUrl but no
 * clientId.
 *
 * This is used when connecting to MCP servers that support dynamic client
 * registration (RFC 7591). The obtained clientId is persisted back to the
 * secret config for subsequent authentications.
 *
 * @param secret - The secret to register
 * @param config - The OAuth config (must include registrationEndpoint)
 * @returns Updated config with clientId if registration succeeded
 */
export async function performClientRegistration(
  secret: Secret,
  config: Partial<SecretOAuthConfig>
): Promise<Partial<SecretOAuthConfig>> {
  debug(`performClientRegistration`, {
    secretId: secret.id,
    registrationEndpoint: config.registrationEndpoint,
  })

  if (!needsSelfRegistration(config)) {
    debug(`self-registration not needed`)

    return config
  }

  if (!config.registrationEndpoint) {
    debug(`no registration endpoint available`)

    return config
  }

  const result = await registerOAuthClient({
    registrationEndpoint: config.registrationEndpoint,
    scope: config.scope,
  })

  if (!result.success || !result.clientId) {
    debug(`client registration failed`, {
      error: result.error,
      errorDescription: result.errorDescription,
    })

    throw new Error(
      result.errorDescription || result.error || 'Client registration failed'
    )
  }

  debug(`client registration successful`, {
    clientId: result.clientId,
    hasClientSecret: !!result.clientSecret,
  })

  // Persist the clientId (and optionally clientSecret) back to the secret
  await updateSecretOAuthConfig(secret, {
    clientId: result.clientId,
    clientSecret: result.clientSecret,
  })

  // Return the updated config
  return {
    ...config,
    clientId: result.clientId,
    clientSecret: result.clientSecret,
    // Public clients registered via dynamic registration require PKCE
    requiresPkce: !result.clientSecret,
  }
}

/**
 * Refreshes the OAuth tokens for a secret using its refresh token.
 *
 * If successful, updates the secret value with the new tokens.
 *
 * @param secret - The secret to refresh tokens for
 * @returns True if refresh succeeded, false otherwise
 */
export async function refreshSecretOAuthToken(
  secret: Secret
): Promise<boolean> {
  debug(`refreshSecretOAuthToken`, { secretId: secret.id })

  const config = await getSecretOAuthConfig(secret)
  const value = await getSecretOAuthValue(secret)

  if (!value.refreshToken) {
    debug(`no refresh token available`)

    return false
  }

  if (!config.tokenUrl || !config.clientId) {
    debug(`missing required config for refresh`, {
      hasTokenUrl: !!config.tokenUrl,
      hasClientId: !!config.clientId,
    })

    return false
  }

  try {
    const credentials = await refreshAccessToken(value.refreshToken, {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      tokenUrl: config.tokenUrl,
    })

    await setSecretOAuthValue(secret, {
      accessToken: credentials.accessToken,
      accessTokenExpiresAt: credentials.accessTokenExpiresAt,
      // Only update refresh token if a new one was provided (token rotation)
      refreshToken: credentials.refreshToken || value.refreshToken,
      refreshTokenExpiresAt:
        credentials.refreshTokenExpiresAt || value.refreshTokenExpiresAt,
      additionalProperties: credentials.additionalProperties,
    })

    debug(`token refresh successful`)

    return true
  } catch (error) {
    debug(`token refresh failed`, { error })

    return false
  }
}

/**
 * Checks if the secret's access token is expired or about to expire.
 *
 * @param secret - The secret to check
 * @param bufferSeconds - Grace period in seconds before expiration (default: 60)
 * @returns True if the token is expired or will expire within the buffer
 */
export async function isSecretOAuthTokenExpired(
  secret: Secret,
  bufferSeconds: number = 60
): Promise<boolean> {
  const value = await getSecretOAuthValue(secret)

  if (!value.accessToken) {
    return true
  }

  if (!value.accessTokenExpiresAt) {
    // No expiration info - assume not expired
    return false
  }

  const expiresAt = value.accessTokenExpiresAt
  const now = Date.now()
  const bufferMs = bufferSeconds * 1000

  return now >= expiresAt - bufferMs
}

/**
 * Gets a valid access token for a secret, refreshing if necessary.
 *
 * This is the main entry point for getting an access token - it handles
 * checking expiration and refreshing automatically.
 *
 * @param secret - The secret to get the access token for
 * @returns The access token, or undefined if unavailable
 */
export async function getSecretOAuthAccessToken(
  secret: Secret
): Promise<string | undefined> {
  // @todo add locking to prevent concurrent refresh operations

  debug(`getSecretOAuthAccessToken`, { secretId: secret.id })

  // Reload secret to get fresh value

  const freshSecret = await prisma.secret.findUnique({
    where: { id: secret.id },
  })

  if (!freshSecret) {
    debug(`secret not found`)

    return undefined
  }

  const isExpired = await isSecretOAuthTokenExpired(freshSecret)

  if (isExpired) {
    debug(`token expired, attempting refresh`)

    const refreshed = await refreshSecretOAuthToken(freshSecret)

    if (!refreshed) {
      debug(`token refresh failed, returning undefined`)

      return undefined
    }

    // Reload after refresh

    const refreshedSecret = await prisma.secret.findUnique({
      where: { id: secret.id },
    })

    if (!refreshedSecret) {
      return undefined
    }

    const value = await getSecretOAuthValue(refreshedSecret)

    return value.accessToken
  }

  const value = await getSecretOAuthValue(freshSecret)

  return value.accessToken
}
