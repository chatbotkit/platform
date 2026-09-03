import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import { getCallbackURL } from '@/lib/oauth.authorization'
import zod from '@/lib/zod.schema'

/**
 * OAuth 2.0 Dynamic Client Registration for client self-registration.
 *
 * Implements RFC 7591 - OAuth 2.0 Dynamic Client Registration Protocol.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7591
 */

/**
 * Zod schema for client registration request (RFC 7591 Section 2).
 */
export const clientRegistrationRequestSchema = zod.object({
  redirect_uris: zod.array(zod.string().url()),
  client_name: zod.string().optional(),
  client_uri: zod.string().url().optional(),
  logo_uri: zod.string().url().optional(),
  contacts: zod.array(zod.string()).optional(),
  tos_uri: zod.string().url().optional(),
  policy_uri: zod.string().url().optional(),
  software_id: zod.string().optional(),
  software_version: zod.string().optional(),
  grant_types: zod.array(zod.string()).optional(),
  response_types: zod.array(zod.string()).optional(),
  token_endpoint_auth_method: zod.string().optional(),
  scope: zod.string().optional(),
})

/**
 * Type for client registration request.
 */
export type ClientRegistrationRequest = zod.infer<
  typeof clientRegistrationRequestSchema
>

/**
 * Zod schema for client registration response (RFC 7591 Section 3.2.1).
 */
export const clientRegistrationResponseSchema = zod.object({
  client_id: zod.string(),
  client_secret: zod.string().optional(),
  client_id_issued_at: zod.number().optional(),
  client_secret_expires_at: zod.number().optional(),

  // Echo back the request fields

  redirect_uris: zod.array(zod.string()).optional(),
  client_name: zod.string().optional(),
  grant_types: zod.array(zod.string()).optional(),
  response_types: zod.array(zod.string()).optional(),
  token_endpoint_auth_method: zod.string().optional(),
  scope: zod.string().optional(),
})

/**
 * Type for client registration response.
 */
export type ClientRegistrationResponse = zod.infer<
  typeof clientRegistrationResponseSchema
>

/**
 * Zod schema for client registration error response (RFC 7591 Section 3.2.2).
 */
export const clientRegistrationErrorSchema = zod.object({
  error: zod.string(),
  error_description: zod.string().optional(),
})

/**
 * Type for client registration error response.
 */
export type ClientRegistrationError = zod.infer<
  typeof clientRegistrationErrorSchema
>

/**
 * Result of a client registration attempt.
 */
export interface ClientRegistrationResult {
  success: boolean
  clientId?: string
  clientSecret?: string
  clientIdIssuedAt?: number
  clientSecretExpiresAt?: number
  error?: string
  errorDescription?: string
}

/**
 * Options for client registration.
 */
export interface ClientRegistrationOptions {
  /**
   * The registration endpoint URL.
   */
  registrationEndpoint: string
  /**
   * Custom redirect URIs. Defaults to the standard OAuth callback URL.
   */
  redirectUris?: string[]
  /**
   * Client name to register. Defaults to 'ChatBotKit'.
   */
  clientName?: string
  /**
   * Requested scopes (space-separated).
   */
  scope?: string
}

/**
 * Registers a client with an OAuth authorization server using dynamic
 * client registration (RFC 7591).
 *
 * This is used when the secret has a `resourceUrl` but no `clientId` -
 * indicating we need to self-register with the remote MCP server.
 *
 * @param options - Registration options
 * @returns Registration result with clientId if successful
 */
export async function registerOAuthClient(
  options: ClientRegistrationOptions
): Promise<ClientRegistrationResult> {
  debug(`registerOAuthClient`, {
    registrationEndpoint: options.registrationEndpoint,
  }).log('oauth.registration.registerOAuthClient')

  const redirectUris = options.redirectUris || [await getCallbackURL()]

  const registrationRequest: ClientRegistrationRequest = {
    redirect_uris: redirectUris,
    client_name: options.clientName || 'ChatBotKit',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none', // Public client with PKCE
    scope: options.scope,
  }

  debug(`sending registration request`, { registrationRequest }).log(
    'oauth.registration.registerOAuthClient'
  )

  try {
    const response = await fetch(options.registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(registrationRequest),
    })

    const responseText = await response.text()

    debug(`received response`, {
      status: response.status,
      responseText:
        responseText.length > 500
          ? responseText.substring(0, 500) + '...'
          : responseText,
    }).log('oauth.registration.registerOAuthClient')

    let responseData: unknown

    try {
      responseData = JSON.parse(responseText)
    } catch {
      debug(`failed to parse response as JSON`).log(
        'oauth.registration.registerOAuthClient'
      )

      return {
        success: false,
        error: 'invalid_response',
        errorDescription: 'Registration endpoint returned non-JSON response',
      }
    }

    if (!response.ok) {
      const errorParsed = clientRegistrationErrorSchema.safeParse(responseData)

      if (errorParsed.success) {
        debug(`registration error`, { error: errorParsed.data }).log(
          'oauth.registration.registerOAuthClient'
        )

        return {
          success: false,
          error: errorParsed.data.error,
          errorDescription: errorParsed.data.error_description,
        }
      }

      return {
        success: false,
        error: 'registration_failed',
        errorDescription: `Registration failed with status ${response.status}`,
      }
    }

    const parsed = clientRegistrationResponseSchema.safeParse(responseData)

    if (!parsed.success) {
      debug(`invalid registration response`, {
        errors: parsed.error.errors,
      }).log('oauth.registration.registerOAuthClient')

      return {
        success: false,
        error: 'invalid_response',
        errorDescription: 'Registration response missing required fields',
      }
    }

    const registrationResponse = parsed.data

    debug(`registration successful`, {
      clientId: registrationResponse.client_id,
      hasClientSecret: !!registrationResponse.client_secret,
    }).log('oauth.registration.registerOAuthClient')

    return {
      success: true,
      clientId: registrationResponse.client_id,
      clientSecret: registrationResponse.client_secret,
      clientIdIssuedAt: registrationResponse.client_id_issued_at,
      clientSecretExpiresAt: registrationResponse.client_secret_expires_at,
    }
  } catch (error) {
    debug(`registration request failed`, { error }).log(
      'oauth.registration.registerOAuthClient'
    )

    return {
      success: false,
      error: 'network_error',
      errorDescription:
        error instanceof Error ? error.message : 'Network request failed',
    }
  }
}

/**
 * Checks if self-registration is needed based on the OAuth config.
 *
 * Self-registration is needed when:
 * - resourceUrl is present (discovery-based config)
 * - clientId is NOT present (not yet registered)
 * - registrationEndpoint is available (server supports dynamic registration)
 *
 * @param config - The OAuth configuration
 * @returns True if self-registration should be attempted
 */
export function needsSelfRegistration(config: {
  resourceUrl?: string
  clientId?: string
  registrationEndpoint?: string
}): boolean {
  const needed = !!(
    config.resourceUrl &&
    !config.clientId &&
    config.registrationEndpoint
  )

  debug(`needsSelfRegistration`, {
    resourceUrl: !!config.resourceUrl,
    clientId: !!config.clientId,
    registrationEndpoint: !!config.registrationEndpoint,
    needed,
  }).log('oauth.registration.needsSelfRegistration')

  return needed
}
