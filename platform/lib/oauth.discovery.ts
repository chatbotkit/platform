import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import { swrCache } from '@/lib/cache'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import zod from '@/lib/zod.schema'

/**
 * Zod schema for OAuth Protected Resource Metadata as defined in RFC 9728.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 */
export const protectedResourceMetadataSchema = zod.object({
  resource: zod.string(),
  authorization_servers: zod.array(zod.string()).optional(),
  scopes_supported: zod.array(zod.string()).optional(),
  bearer_methods_supported: zod.array(zod.string()).optional(),
  resource_name: zod.string().optional(),
  resource_documentation: zod.string().optional(),
})

/**
 * Type for OAuth Protected Resource Metadata.
 */
export type ProtectedResourceMetadata = zod.infer<
  typeof protectedResourceMetadataSchema
>

// @note every endpoint the server names is a URL this platform will later
// connect to, so it must be an absolute http(s) URL here - schema validation
// is not a network boundary (the egress dispatcher is), but it stops
// relative paths, javascript: and data: schemes and other non-URLs from ever
// being stored as endpoints.
const endpointUrl = zod.string().refine(
  (value) => {
    try {
      return /^https?:$/.test(new URL(value).protocol)
    } catch {
      return false
    }
  },
  {
    message: 'endpoint must be an absolute http(s) URL',
  }
)

/**
 * Zod schema for OAuth Authorization Server Metadata as defined in RFC 8414.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8414
 */
export const authorizationServerMetadataSchema = zod.object({
  issuer: endpointUrl,
  authorization_endpoint: endpointUrl.optional(),
  token_endpoint: endpointUrl.optional(),
  revocation_endpoint: endpointUrl.optional(),
  introspection_endpoint: endpointUrl.optional(),
  userinfo_endpoint: endpointUrl.optional(),
  jwks_uri: endpointUrl.optional(),
  registration_endpoint: endpointUrl.optional(),
  scopes_supported: zod.array(zod.string()).optional(),
  response_types_supported: zod.array(zod.string()).optional(),
  grant_types_supported: zod.array(zod.string()).optional(),
  token_endpoint_auth_methods_supported: zod.array(zod.string()).optional(),
  code_challenge_methods_supported: zod.array(zod.string()).optional(),

  // MCP-specific extension

  client_id_metadata_document_supported: zod.boolean().optional(),
})

/**
 * Type for OAuth Authorization Server Metadata.
 */
export type AuthorizationServerMetadata = zod.infer<
  typeof authorizationServerMetadataSchema
>

/**
 * Discovered OAuth configuration from a protected resource.
 */
export interface DiscoveredOAuthConfig {
  authorizationUrl: string
  tokenUrl: string
  revokeUrl?: string
  scope?: string

  // Additional metadata for dynamic client registration or reference

  registrationEndpoint?: string
  clientIdMetadataDocumentSupported?: boolean
  codeChallengeMethodsSupported?: string[]
}

/**
 * Constructs the well-known URL for protected resource metadata.
 *
 * Per RFC 9728 Section 3.1:
 * - If resource URL has no path, use: `/.well-known/oauth-protected-resource`
 * - If resource URL has a path, insert `.well-known/oauth-protected-resource`
 *   between host and path
 *
 * If the resourceUrl already contains `/.well-known/oauth-protected-resource`,
 * it is returned as-is (explicit well-known URL).
 *
 * @param resourceUrl - The protected resource URL or explicit well-known URL
 * @returns The well-known metadata URL
 */
export function getProtectedResourceMetadataUrl(resourceUrl: string): string {
  const url = new URL(resourceUrl)

  // Remove trailing slash from pathname for consistent handling
  const pathname = url.pathname.replace(/\/$/, '')

  // If the URL already contains the well-known path, return as-is
  if (pathname.includes('/.well-known/oauth-protected-resource')) {
    return resourceUrl
  }

  if (!pathname || pathname === '/') {
    // @note No path component - use root well-known URL
    // Example: https://example.com -> https://example.com/.well-known/oauth-protected-resource

    return `${url.origin}/.well-known/oauth-protected-resource`
  }

  // @note RFC 9728 Section 3.1: When the resource identifier contains a path,
  // insert .well-known/oauth-protected-resource between the host and path.
  // This enables multi-tenant hosting where different paths have different
  // OAuth configurations.
  // Example: https://example.com/mcp -> https://example.com/.well-known/oauth-protected-resource/mcp

  return `${url.origin}/.well-known/oauth-protected-resource${pathname}`
}

/**
 * Constructs the well-known URL for authorization server metadata.
 *
 * Per RFC 8414, tries OAuth 2.0 Authorization Server Metadata first,
 * then falls back to OpenID Connect Discovery.
 *
 * @param issuerUrl - The authorization server issuer URL
 * @returns Array of well-known URLs to try in order
 */
export function getAuthorizationServerMetadataUrls(
  issuerUrl: string
): string[] {
  const url = new URL(issuerUrl)
  const pathname = url.pathname.replace(/\/$/, '')

  const urls: string[] = []

  if (!pathname || pathname === '/') {
    // @note No path - try both standard well-known locations at the root
    urls.push(`${url.origin}/.well-known/oauth-authorization-server`)
    urls.push(`${url.origin}/.well-known/openid-configuration`)
  } else {
    // @note RFC 8414: When issuer contains a path (multi-tenant), try multiple
    // well-known URL patterns. The path is appended as a suffix to support
    // different tenants with separate OAuth configurations.
    // Example for issuer https://auth.example.com/tenant1:
    //   1. https://auth.example.com/.well-known/oauth-authorization-server/tenant1
    //   2. https://auth.example.com/.well-known/openid-configuration/tenant1
    //   3. https://auth.example.com/tenant1/.well-known/openid-configuration (legacy)

    urls.push(`${url.origin}/.well-known/oauth-authorization-server${pathname}`)
    urls.push(`${url.origin}/.well-known/openid-configuration${pathname}`)
    urls.push(`${url.origin}${pathname}/.well-known/openid-configuration`)
  }

  return urls
}

/**
 * Fetches protected resource metadata from a resource URL.
 *
 * @param resourceUrl - The protected resource URL
 * @returns The protected resource metadata or null if not found
 */
export async function fetchProtectedResourceMetadata(
  resourceUrl: string
): Promise<ProtectedResourceMetadata | null> {
  debug(`fetchProtectedResourceMetadata`, { resourceUrl }).log(
    'oauth.discovery.fetchProtectedResourceMetadata'
  )

  const metadataUrl = getProtectedResourceMetadataUrl(resourceUrl)

  debug(`fetching from`, { metadataUrl }).log(
    'oauth.discovery.fetchProtectedResourceMetadata'
  )

  try {
    const response = await fetch(metadataUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      debug(`failed to fetch`, {
        status: response.status,
        statusText: response.statusText,
      }).log('oauth.discovery.fetchProtectedResourceMetadata')

      return null
    }

    const data = await response.json()

    debug(`received metadata`, { data }).log(
      'oauth.discovery.fetchProtectedResourceMetadata'
    )

    // Validate data structure with Zod

    const parsed = protectedResourceMetadataSchema.safeParse(data)

    if (!parsed.success) {
      debug(`invalid metadata structure`, {
        errors: parsed.error.errors,
      }).log('oauth.discovery.fetchProtectedResourceMetadata')

      return null
    }

    const metadata = parsed.data

    // Validate the resource field matches (per RFC 9728 Section 3.3)

    const expectedResource = new URL(resourceUrl)
    const actualResource = new URL(metadata.resource)

    // Compare origin and path (ignoring query/fragment)

    if (
      expectedResource.origin !== actualResource.origin ||
      expectedResource.pathname.replace(/\/$/, '') !==
        actualResource.pathname.replace(/\/$/, '')
    ) {
      debug(`resource mismatch - potential impersonation`, {
        expected: resourceUrl,
        actual: metadata.resource,
      }).log('oauth.discovery.fetchProtectedResourceMetadata')

      return null
    }

    return metadata
  } catch (error) {
    debug(`error fetching metadata`, { error }).log(
      'oauth.discovery.fetchProtectedResourceMetadata'
    )

    return null
  }
}

/**
 * The canonical form of an issuer identifier for comparison.
 *
 * @note this is a deliberate deviation from RFC 8414 section 3.3, which
 * requires the `issuer` in the returned metadata to be identical to the
 * issuer identifier the metadata was requested for. Real-world IdPs disagree
 * on the incidental parts of that string - some publish the issuer with a
 * trailing slash and some without, some upper-case the host - so an exact
 * string comparison rejects otherwise valid servers. Only the parts of the
 * URL that carry no identity are normalised:
 *
 * - host case (URL hosts are case-insensitive)
 * - the default port for the scheme (`:443` on https, `:80` on http)
 * - trailing slashes
 *
 * Everything else must match exactly. In particular the path is NOT relaxed:
 * a multi-tenant server's tenants share an origin and differ only by path, so
 * `https://auth.example.com/tenant-a` must never accept metadata that names
 * `https://auth.example.com/tenant-b` as its issuer. Scheme, host, non-default
 * port, query and fragment differences are rejected as well.
 */
function normalizeIssuer(issuer: string): string {
  const url = new URL(issuer)

  return url.href.replace(/\/+$/, '')
}

/**
 * Fetches authorization server metadata from an issuer URL.
 *
 * Tries multiple well-known endpoints as per RFC 8414 and OpenID Connect
 * Discovery compatibility.
 *
 * @param issuerUrl - The authorization server issuer URL
 * @returns The authorization server metadata or null if not found
 */
export async function fetchAuthorizationServerMetadata(
  issuerUrl: string
): Promise<AuthorizationServerMetadata | null> {
  debug(`fetchAuthorizationServerMetadata`, { issuerUrl }).log(
    'oauth.discovery.fetchAuthorizationServerMetadata'
  )

  const metadataUrls = getAuthorizationServerMetadataUrls(issuerUrl)

  for (const metadataUrl of metadataUrls) {
    debug(`trying`, { metadataUrl }).log(
      'oauth.discovery.fetchAuthorizationServerMetadata'
    )

    try {
      const response = await fetch(metadataUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        debug(`failed to fetch`, {
          metadataUrl,
          status: response.status,
        }).log('oauth.discovery.fetchAuthorizationServerMetadata')

        continue
      }

      const data = await response.json()

      debug(`received metadata`, { metadataUrl, data }).log(
        'oauth.discovery.fetchAuthorizationServerMetadata'
      )

      // Validate data structure with Zod

      const parsed = authorizationServerMetadataSchema.safeParse(data)

      if (!parsed.success) {
        debug(`invalid metadata structure`, {
          metadataUrl,
          errors: parsed.error.errors,
        }).log('oauth.discovery.fetchAuthorizationServerMetadata')

        continue
      }

      const metadata = parsed.data

      // Validate issuer matches (per RFC 8414 section 3.3): the returned
      // issuer identifier must be identical to the one the metadata was
      // located for. The path is part of the identity - a multi-tenant
      // server's tenants share an origin - so origin-only matching would
      // accept one tenant's metadata for another. The comparison tolerates
      // host case, default port and trailing slash differences only - see
      // normalizeIssuer for why that deviation from exact-match is accepted.

      if (normalizeIssuer(metadata.issuer) !== normalizeIssuer(issuerUrl)) {
        debug(`issuer mismatch`, {
          expected: issuerUrl,
          actual: metadata.issuer,
        }).log('oauth.discovery.fetchAuthorizationServerMetadata')

        continue
      }

      return metadata
    } catch (error) {
      debug(`error fetching from`, { metadataUrl, error }).log(
        'oauth.discovery.fetchAuthorizationServerMetadata'
      )

      continue
    }
  }

  debug(`no valid metadata found for`, { issuerUrl }).log(
    'oauth.discovery.fetchAuthorizationServerMetadata'
  )

  return null
}

/**
 * Discovers OAuth configuration from a protected resource URL.
 *
 * This implements the full discovery flow as per RFC 9728 and RFC 8414:
 * 1. Fetch protected resource metadata from the resource URL
 * 2. Get the authorization server from the metadata
 * 3. Fetch authorization server metadata
 * 4. Extract OAuth endpoints
 *
 * If protected resource metadata is not available (RFC 9728), falls back to
 * direct authorization server metadata discovery (RFC 8414) using the resource
 * URL origin as the authorization server.
 *
 * Results are cached to avoid repeated discovery requests.
 *
 * @param resourceUrl - The protected resource URL (e.g., MCP server URL)
 * @returns The discovered OAuth configuration or null if discovery fails
 */
export async function discoverOAuthConfig(
  resourceUrl: string
): Promise<DiscoveredOAuthConfig | null> {
  debug(`discoverOAuthConfig`, { resourceUrl }).log(
    'oauth.discovery.discoverOAuthConfig'
  )

  // Use SWR cache to avoid repeated discovery requests

  return await swrCache(
    `oauth:discovery:${resourceUrl}`,
    ONE_HOUR_IN_SECONDS,
    async () => {
      // Step 1: Fetch protected resource metadata

      const resourceMetadata = await fetchProtectedResourceMetadata(resourceUrl)

      let authServerMetadata: AuthorizationServerMetadata | null = null
      let resourceScopesSupported: string[] | undefined

      if (resourceMetadata) {
        // Step 2: Get authorization server from resource metadata

        const authorizationServers = resourceMetadata.authorization_servers

        if (!authorizationServers || authorizationServers.length === 0) {
          debug(`no authorization servers in resource metadata`).log(
            'oauth.discovery.discoverOAuthConfig'
          )

          return null
        }

        // Use the first authorization server (per RFC 9728, client chooses)

        const authServerUrl = authorizationServers[0]

        debug(`using authorization server from resource metadata`, {
          authServerUrl,
        }).log('oauth.discovery.discoverOAuthConfig')

        // Step 3: Fetch authorization server metadata

        authServerMetadata =
          await fetchAuthorizationServerMetadata(authServerUrl)

        resourceScopesSupported = resourceMetadata.scopes_supported
      } else {
        // @note fallback for servers that don't implement RFC 9728 protected
        // resource metadata but do implement RFC 8414 authorization server
        // metadata (e.g., Sentry MCP at mcp.sentry.dev)

        debug(
          `no resource metadata found, falling back to direct auth server discovery`
        ).log('oauth.discovery.discoverOAuthConfig')

        // Use the resource URL origin as the authorization server

        const resourceOrigin = new URL(resourceUrl).origin

        authServerMetadata =
          await fetchAuthorizationServerMetadata(resourceOrigin)
      }

      if (!authServerMetadata) {
        debug(`no authorization server metadata found`).log(
          'oauth.discovery.discoverOAuthConfig'
        )

        return null
      }

      // Step 4: Extract OAuth endpoints

      const { authorization_endpoint, token_endpoint, revocation_endpoint } =
        authServerMetadata

      // @note no HTTPS scheme validation on endpoints - investigate if needed

      if (!authorization_endpoint || !token_endpoint) {
        debug(`missing required endpoints`, {
          authorization_endpoint,
          token_endpoint,
        }).log('oauth.discovery.discoverOAuthConfig')

        return null
      }

      // Build scope from resource metadata or auth server metadata

      const scopesSupported =
        resourceScopesSupported || authServerMetadata.scopes_supported

      const scope = scopesSupported ? scopesSupported.join(' ') : undefined

      const config: DiscoveredOAuthConfig = {
        authorizationUrl: authorization_endpoint,
        tokenUrl: token_endpoint,
        revokeUrl: revocation_endpoint,
        scope,
        registrationEndpoint: authServerMetadata.registration_endpoint,
        clientIdMetadataDocumentSupported:
          authServerMetadata.client_id_metadata_document_supported,
        codeChallengeMethodsSupported:
          authServerMetadata.code_challenge_methods_supported,
      }

      debug(`discovered config`, { config }).log(
        'oauth.discovery.discoverOAuthConfig'
      )

      return config
    }
  )
}

/**
 * Schema for validating OAuth config with optional resourceUrl for discovery.
 */
export const oAuthConfigWithDiscoverySchema = zod.object({
  // Traditional explicit config

  clientId: zod.string().optional(),
  clientSecret: zod.string().optional(),
  authorizationUrl: zod.string().optional(),
  tokenUrl: zod.string().optional(),
  revokeUrl: zod.string().optional(),
  validateUrl: zod.string().optional(),
  grantType: zod.string().optional(),
  scope: zod.string().optional(),

  // Discovery-based config (RFC 9728)

  resourceUrl: zod.string().url().optional(),
})

/**
 * Type for OAuth config with optional discovery.
 */
export type OAuthConfigWithDiscovery = zod.infer<
  typeof oAuthConfigWithDiscoverySchema
>
