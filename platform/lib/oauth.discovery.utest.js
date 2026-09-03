import fetch from '@/lib/egress.fetch'
import {
  authorizationServerMetadataSchema,
  discoverOAuthConfig,
  fetchAuthorizationServerMetadata,
  fetchProtectedResourceMetadata,
  getAuthorizationServerMetadataUrls,
  getProtectedResourceMetadataUrl,
  oAuthConfigWithDiscoverySchema,
  protectedResourceMetadataSchema,
} from '@/lib/oauth.discovery'

jest.mock('@/lib/egress.fetch')
jest.mock('@/lib/cache', () => ({
  swrCache: jest.fn((key, ttl, fn) => fn()),
}))

const mockFetch = fetch

describe('getProtectedResourceMetadataUrl', () => {
  it('should construct well-known URL for root domain', () => {
    expect(getProtectedResourceMetadataUrl('https://example.com')).toBe(
      'https://example.com/.well-known/oauth-protected-resource'
    )
  })

  it('should construct well-known URL for root domain with trailing slash', () => {
    expect(getProtectedResourceMetadataUrl('https://example.com/')).toBe(
      'https://example.com/.well-known/oauth-protected-resource'
    )
  })

  it('should insert well-known between host and path', () => {
    expect(getProtectedResourceMetadataUrl('https://example.com/mcp')).toBe(
      'https://example.com/.well-known/oauth-protected-resource/mcp'
    )
  })

  it('should handle nested paths', () => {
    expect(
      getProtectedResourceMetadataUrl('https://example.com/api/v1/mcp')
    ).toBe(
      'https://example.com/.well-known/oauth-protected-resource/api/v1/mcp'
    )
  })

  it('should handle path with trailing slash', () => {
    expect(getProtectedResourceMetadataUrl('https://example.com/mcp/')).toBe(
      'https://example.com/.well-known/oauth-protected-resource/mcp'
    )
  })

  it('should return explicit well-known URL as-is', () => {
    const explicitUrl =
      'https://example.com/.well-known/oauth-protected-resource'

    expect(getProtectedResourceMetadataUrl(explicitUrl)).toBe(explicitUrl)
  })

  it('should return explicit well-known URL with path as-is', () => {
    const explicitUrl =
      'https://example.com/.well-known/oauth-protected-resource/mcp'

    expect(getProtectedResourceMetadataUrl(explicitUrl)).toBe(explicitUrl)
  })
})

describe('getAuthorizationServerMetadataUrls', () => {
  it('should return both standard locations for root domain', () => {
    const urls = getAuthorizationServerMetadataUrls('https://auth.example.com')

    expect(urls).toContain(
      'https://auth.example.com/.well-known/oauth-authorization-server'
    )
    expect(urls).toContain(
      'https://auth.example.com/.well-known/openid-configuration'
    )
  })

  it('should handle issuer with path', () => {
    const urls = getAuthorizationServerMetadataUrls(
      'https://auth.example.com/tenant1'
    )

    expect(urls).toContain(
      'https://auth.example.com/.well-known/oauth-authorization-server/tenant1'
    )
    expect(urls).toContain(
      'https://auth.example.com/.well-known/openid-configuration/tenant1'
    )
    expect(urls).toContain(
      'https://auth.example.com/tenant1/.well-known/openid-configuration'
    )
  })

  it('should handle trailing slash in issuer', () => {
    const urls = getAuthorizationServerMetadataUrls(
      'https://auth.example.com/tenant1/'
    )

    expect(urls).toContain(
      'https://auth.example.com/.well-known/oauth-authorization-server/tenant1'
    )
  })
})

describe('protectedResourceMetadataSchema', () => {
  it('should validate minimal valid metadata', () => {
    const result = protectedResourceMetadataSchema.safeParse({
      resource: 'https://example.com/mcp',
    })

    expect(result.success).toBe(true)
    expect(result.data?.resource).toBe('https://example.com/mcp')
  })

  it('should validate full metadata', () => {
    const result = protectedResourceMetadataSchema.safeParse({
      resource: 'https://example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
      scopes_supported: ['read', 'write'],
      bearer_methods_supported: ['header'],
      resource_name: 'Example MCP Server',
      resource_documentation: 'https://docs.example.com',
    })

    expect(result.success).toBe(true)
    expect(result.data?.authorization_servers).toEqual([
      'https://auth.example.com',
    ])
    expect(result.data?.scopes_supported).toEqual(['read', 'write'])
  })

  it('should reject metadata without resource field', () => {
    const result = protectedResourceMetadataSchema.safeParse({
      authorization_servers: ['https://auth.example.com'],
    })

    expect(result.success).toBe(false)
  })

  it('should reject non-string resource', () => {
    const result = protectedResourceMetadataSchema.safeParse({
      resource: 123,
    })

    expect(result.success).toBe(false)
  })
})

describe('authorizationServerMetadataSchema', () => {
  it('should validate minimal valid metadata', () => {
    const result = authorizationServerMetadataSchema.safeParse({
      issuer: 'https://auth.example.com',
    })

    expect(result.success).toBe(true)
    expect(result.data?.issuer).toBe('https://auth.example.com')
  })

  it('should validate full metadata', () => {
    const result = authorizationServerMetadataSchema.safeParse({
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      revocation_endpoint: 'https://auth.example.com/revoke',
      registration_endpoint: 'https://auth.example.com/register',
      scopes_supported: ['openid', 'profile'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: true,
    })

    expect(result.success).toBe(true)
    expect(result.data?.authorization_endpoint).toBe(
      'https://auth.example.com/authorize'
    )
    expect(result.data?.client_id_metadata_document_supported).toBe(true)
  })

  it('should reject metadata without issuer field', () => {
    const result = authorizationServerMetadataSchema.safeParse({
      authorization_endpoint: 'https://auth.example.com/authorize',
    })

    expect(result.success).toBe(false)
  })

  it('should reject non-string issuer', () => {
    const result = authorizationServerMetadataSchema.safeParse({
      issuer: null,
    })

    expect(result.success).toBe(false)
  })
})

describe('fetchProtectedResourceMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch and return valid protected resource metadata', async () => {
    const metadata = {
      resource: 'https://example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
      scopes_supported: ['read', 'write'],
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => metadata,
    })

    const result = await fetchProtectedResourceMetadata(
      'https://example.com/mcp'
    )

    expect(result).toEqual(metadata)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/.well-known/oauth-protected-resource/mcp',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
    )
  })

  it('should return null when fetch response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const result = await fetchProtectedResourceMetadata(
      'https://example.com/mcp'
    )

    expect(result).toBeNull()
  })

  it('should return null when metadata structure is invalid', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: 'data' }),
    })

    const result = await fetchProtectedResourceMetadata(
      'https://example.com/mcp'
    )

    expect(result).toBeNull()
  })

  it('should return null when resource origin does not match', async () => {
    const metadata = {
      resource: 'https://other.com/mcp',
      authorization_servers: ['https://auth.example.com'],
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => metadata,
    })

    const result = await fetchProtectedResourceMetadata(
      'https://example.com/mcp'
    )

    expect(result).toBeNull()
  })

  it('should return null when resource pathname does not match', async () => {
    const metadata = {
      resource: 'https://example.com/other-path',
      authorization_servers: ['https://auth.example.com'],
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => metadata,
    })

    const result = await fetchProtectedResourceMetadata(
      'https://example.com/mcp'
    )

    expect(result).toBeNull()
  })

  it('should handle trailing slashes when comparing resource paths', async () => {
    const metadata = {
      resource: 'https://example.com/mcp/',
      authorization_servers: ['https://auth.example.com'],
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => metadata,
    })

    const result = await fetchProtectedResourceMetadata(
      'https://example.com/mcp'
    )

    expect(result).toEqual(metadata)
  })

  it('should return null when fetch throws an error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await fetchProtectedResourceMetadata(
      'https://example.com/mcp'
    )

    expect(result).toBeNull()
  })
})

describe('fetchAuthorizationServerMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch and return valid authorization server metadata', async () => {
    const metadata = {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => metadata,
    })

    const result = await fetchAuthorizationServerMetadata(
      'https://auth.example.com'
    )

    expect(result).toEqual(metadata)
  })

  it('should try multiple URLs and return first valid metadata', async () => {
    const metadata = {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => metadata,
      })

    const result = await fetchAuthorizationServerMetadata(
      'https://auth.example.com'
    )

    expect(result).toEqual(metadata)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should return null when metadata structure is invalid', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: 'data' }),
    })

    const result = await fetchAuthorizationServerMetadata(
      'https://auth.example.com'
    )

    expect(result).toBeNull()
  })

  it('should return null when issuer origin does not match', async () => {
    const metadata = {
      issuer: 'https://other-auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => metadata,
    })

    const result = await fetchAuthorizationServerMetadata(
      'https://auth.example.com'
    )

    expect(result).toBeNull()
  })

  it('should return null when all URLs fail', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    })

    const result = await fetchAuthorizationServerMetadata(
      'https://auth.example.com'
    )

    expect(result).toBeNull()
  })

  it('should continue to next URL when fetch throws an error', async () => {
    const metadata = {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
    }

    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => metadata,
      })

    const result = await fetchAuthorizationServerMetadata(
      'https://auth.example.com'
    )

    expect(result).toEqual(metadata)
  })

  it('should return null when all fetches throw errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await fetchAuthorizationServerMetadata(
      'https://auth.example.com'
    )

    expect(result).toBeNull()
  })
})

describe('discoverOAuthConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should discover complete OAuth configuration', async () => {
    const resourceMetadata = {
      resource: 'https://example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
      scopes_supported: ['read', 'write'],
    }

    const authServerMetadata = {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      revocation_endpoint: 'https://auth.example.com/revoke',
      registration_endpoint: 'https://auth.example.com/register',
      client_id_metadata_document_supported: true,
      code_challenge_methods_supported: ['S256'],
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => resourceMetadata,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => authServerMetadata,
      })

    const result = await discoverOAuthConfig('https://example.com/mcp')

    expect(result).toEqual({
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      revokeUrl: 'https://auth.example.com/revoke',
      scope: 'read write',
      registrationEndpoint: 'https://auth.example.com/register',
      clientIdMetadataDocumentSupported: true,
      codeChallengeMethodsSupported: ['S256'],
    })
  })

  it('should fallback to direct auth server discovery when resource metadata not found', async () => {
    // @note tests RFC 8414 fallback when RFC 9728 protected resource metadata
    // is not available (e.g., Sentry MCP at mcp.sentry.dev)

    const authServerMetadata = {
      issuer: 'https://example.com',
      authorization_endpoint: 'https://example.com/oauth/authorize',
      token_endpoint: 'https://example.com/oauth/token',
      revocation_endpoint: 'https://example.com/oauth/revoke',
      registration_endpoint: 'https://example.com/oauth/register',
      scopes_supported: ['org:read', 'project:write'],
      code_challenge_methods_supported: ['S256'],
    }

    mockFetch
      // First call: protected resource metadata returns 404
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      // Second call: direct auth server metadata succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => authServerMetadata,
      })

    const result = await discoverOAuthConfig('https://example.com/mcp')

    expect(result).toEqual({
      authorizationUrl: 'https://example.com/oauth/authorize',
      tokenUrl: 'https://example.com/oauth/token',
      revokeUrl: 'https://example.com/oauth/revoke',
      scope: 'org:read project:write',
      registrationEndpoint: 'https://example.com/oauth/register',
      clientIdMetadataDocumentSupported: undefined,
      codeChallengeMethodsSupported: ['S256'],
    })

    // Verify it tried the protected resource URL first, then auth server URLs
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/.well-known/oauth-protected-resource/mcp',
      expect.any(Object)
    )
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/.well-known/oauth-authorization-server',
      expect.any(Object)
    )
  })

  it('should return null when both resource metadata and auth server discovery fail', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    })

    const result = await discoverOAuthConfig('https://example.com/mcp')

    expect(result).toBeNull()
  })

  it('should return null when no authorization servers in metadata', async () => {
    const resourceMetadata = {
      resource: 'https://example.com/mcp',
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => resourceMetadata,
    })

    const result = await discoverOAuthConfig('https://example.com/mcp')

    expect(result).toBeNull()
  })

  it('should return null when authorization_servers is empty array', async () => {
    const resourceMetadata = {
      resource: 'https://example.com/mcp',
      authorization_servers: [],
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => resourceMetadata,
    })

    const result = await discoverOAuthConfig('https://example.com/mcp')

    expect(result).toBeNull()
  })

  it('should return null when authorization server metadata is not found', async () => {
    const resourceMetadata = {
      resource: 'https://example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => resourceMetadata,
      })
      .mockResolvedValue({
        ok: false,
        status: 404,
      })

    const result = await discoverOAuthConfig('https://example.com/mcp')

    expect(result).toBeNull()
  })

  it('should return null when required endpoints are missing', async () => {
    const resourceMetadata = {
      resource: 'https://example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
    }

    const authServerMetadata = {
      issuer: 'https://auth.example.com',
      // Missing authorization_endpoint and token_endpoint
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => resourceMetadata,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => authServerMetadata,
      })

    const result = await discoverOAuthConfig('https://example.com/mcp')

    expect(result).toBeNull()
  })

  it('should use auth server scopes when resource scopes are not provided', async () => {
    const resourceMetadata = {
      resource: 'https://example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
    }

    const authServerMetadata = {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      scopes_supported: ['openid', 'profile'],
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => resourceMetadata,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => authServerMetadata,
      })

    const result = await discoverOAuthConfig('https://example.com/mcp')

    expect(result?.scope).toBe('openid profile')
  })

  it('should return undefined scope when no scopes are provided', async () => {
    const resourceMetadata = {
      resource: 'https://example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
    }

    const authServerMetadata = {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => resourceMetadata,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => authServerMetadata,
      })

    const result = await discoverOAuthConfig('https://example.com/mcp')

    expect(result?.scope).toBeUndefined()
  })
})

describe('oAuthConfigWithDiscoverySchema', () => {
  it('should validate config with all fields', () => {
    const result = oAuthConfigWithDiscoverySchema.safeParse({
      clientId: 'client-123',
      clientSecret: 'secret-456',
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      revokeUrl: 'https://auth.example.com/revoke',
      validateUrl: 'https://auth.example.com/validate',
      grantType: 'authorization_code',
      scope: 'read write',
      resourceUrl: 'https://example.com/mcp',
    })

    expect(result.success).toBe(true)
  })

  it('should validate minimal config', () => {
    const result = oAuthConfigWithDiscoverySchema.safeParse({})

    expect(result.success).toBe(true)
  })

  it('should validate discovery-only config', () => {
    const result = oAuthConfigWithDiscoverySchema.safeParse({
      resourceUrl: 'https://example.com/mcp',
    })

    expect(result.success).toBe(true)
  })

  it('should reject invalid resourceUrl', () => {
    const result = oAuthConfigWithDiscoverySchema.safeParse({
      resourceUrl: 'not-a-valid-url',
    })

    expect(result.success).toBe(false)
  })
})

describe('authorizationServerMetadataSchema endpoint invariants', () => {
  it.each([
    ['relative path', '/oauth/token'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/plain,x'],
    ['not a url', 'token endpoint'],
  ])('rejects a %s as an endpoint', (_label, value) => {
    const result = authorizationServerMetadataSchema.safeParse({
      issuer: 'https://auth.example.com',
      token_endpoint: value,
    })

    expect(result.success).toBe(false)
  })

  it('rejects a non-http(s) issuer', () => {
    expect(
      authorizationServerMetadataSchema.safeParse({ issuer: 'ftp://auth.example.com' })
        .success
    ).toBe(false)
  })

  const endpointFields = [
    'issuer',
    'authorization_endpoint',
    'token_endpoint',
    'revocation_endpoint',
    'introspection_endpoint',
    'userinfo_endpoint',
    'jwks_uri',
    'registration_endpoint',
  ]

  it.each(
    endpointFields.flatMap((field) => [
      [field, 'relative path', '/oauth/endpoint'],
      [field, 'non-http scheme', 'ftp://auth.example.com/endpoint'],
    ])
  )('rejects %s when it is a %s', (field, _label, value) => {
    const result = authorizationServerMetadataSchema.safeParse({
      issuer: 'https://auth.example.com',
      [field]: value,
    })

    expect(result.success).toBe(false)
  })
})

describe('fetchAuthorizationServerMetadata issuer comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const serveIssuer = (issuer) => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        issuer,
        token_endpoint: 'https://auth.example.com/token',
      }),
    })
  }

  // @note deliberate deviation from RFC 8414 section 3.3 exact-match - see
  // normalizeIssuer in lib/oauth.discovery.ts

  it.each([
    ['trailing slash only', 'https://auth.example.com/tenant1', 'https://auth.example.com/tenant1/'],
    ['host case', 'https://auth.example.com/tenant1', 'https://AUTH.Example.COM/tenant1'],
    ['default port', 'https://auth.example.com/tenant1', 'https://auth.example.com:443/tenant1'],
  ])('accepts an issuer differing by %s', async (_label, requested, returned) => {
    serveIssuer(returned)

    const result = await fetchAuthorizationServerMetadata(requested)

    expect(result).not.toBeNull()
    expect(result.issuer).toBe(returned)
  })

  it.each([
    ['same origin, different path', 'https://auth.example.com/tenant1', 'https://auth.example.com/tenant2'],
    ['same origin, path stripped', 'https://auth.example.com/tenant1', 'https://auth.example.com'],
    ['different host', 'https://auth.example.com/tenant1', 'https://other.example.com/tenant1'],
    ['non-default port', 'https://auth.example.com/tenant1', 'https://auth.example.com:8443/tenant1'],
  ])('rejects an issuer differing by %s', async (_label, requested, returned) => {
    serveIssuer(returned)

    await expect(fetchAuthorizationServerMetadata(requested)).resolves.toBeNull()
  })
})

describe('fetchAuthorizationServerMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const serve = (byUrl) => {
    mockFetch.mockImplementation(async (url) => {
      const body = byUrl[url]

      return body
        ? { ok: true, json: async () => body }
        : { ok: false, status: 404 }
    })
  }

  it('returns metadata whose issuer matches the requested issuer exactly', async () => {
    const metadata = {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
    }

    serve({
      'https://auth.example.com/.well-known/oauth-authorization-server': metadata,
    })

    await expect(
      fetchAuthorizationServerMetadata('https://auth.example.com')
    ).resolves.toEqual(metadata)
  })

  it('treats a trailing slash as the same issuer', async () => {
    const metadata = {
      issuer: 'https://auth.example.com/',
      token_endpoint: 'https://auth.example.com/token',
    }

    mockFetch.mockResolvedValue({ ok: true, json: async () => metadata })

    await expect(
      fetchAuthorizationServerMetadata('https://auth.example.com')
    ).resolves.toEqual(metadata)
  })

  it('rejects a same-origin issuer for a different tenant path', async () => {
    // @note the path is part of the issuer identity: tenant2's metadata must
    // not be accepted for tenant1
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        issuer: 'https://auth.example.com/tenant2',
        token_endpoint: 'https://auth.example.com/tenant2/token',
      }),
    })

    await expect(
      fetchAuthorizationServerMetadata('https://auth.example.com/tenant1')
    ).resolves.toBeNull()
  })

  it('rejects an issuer on another origin', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ issuer: 'https://evil.example.com' }),
    })

    await expect(
      fetchAuthorizationServerMetadata('https://auth.example.com')
    ).resolves.toBeNull()
  })

  it('rejects metadata whose endpoints are not absolute http(s) URLs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        issuer: 'https://auth.example.com',
        token_endpoint: '/token',
      }),
    })

    await expect(
      fetchAuthorizationServerMetadata('https://auth.example.com')
    ).resolves.toBeNull()
  })

  it('falls through the candidate well-known locations', async () => {
    const urls = getAuthorizationServerMetadataUrls('https://auth.example.com/tenant1')
    const metadata = {
      issuer: 'https://auth.example.com/tenant1',
      token_endpoint: 'https://auth.example.com/tenant1/token',
    }

    serve({ [urls[urls.length - 1]]: metadata })

    await expect(
      fetchAuthorizationServerMetadata('https://auth.example.com/tenant1')
    ).resolves.toEqual(metadata)
    expect(mockFetch).toHaveBeenCalledTimes(urls.length)
  })

  it('returns null when every location fails or throws', async () => {
    mockFetch.mockRejectedValue(new Error('network'))

    await expect(
      fetchAuthorizationServerMetadata('https://auth.example.com')
    ).resolves.toBeNull()
  })
})

describe('discoverOAuthConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('discovers through the protected resource metadata', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url === 'https://example.com/.well-known/oauth-protected-resource/mcp') {
        return {
          ok: true,
          json: async () => ({
            resource: 'https://example.com/mcp',
            authorization_servers: ['https://auth.example.com'],
            scopes_supported: ['read', 'write'],
          }),
        }
      }

      if (url === 'https://auth.example.com/.well-known/oauth-authorization-server') {
        return {
          ok: true,
          json: async () => ({
            issuer: 'https://auth.example.com',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            revocation_endpoint: 'https://auth.example.com/revoke',
            registration_endpoint: 'https://auth.example.com/register',
            code_challenge_methods_supported: ['S256'],
          }),
        }
      }

      return { ok: false, status: 404 }
    })

    await expect(discoverOAuthConfig('https://example.com/mcp')).resolves.toEqual({
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
      revokeUrl: 'https://auth.example.com/revoke',
      scope: 'read write',
      registrationEndpoint: 'https://auth.example.com/register',
      clientIdMetadataDocumentSupported: undefined,
      codeChallengeMethodsSupported: ['S256'],
    })
  })

  it('falls back to the resource origin as the authorization server', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url === 'https://example.com/.well-known/oauth-authorization-server') {
        return {
          ok: true,
          json: async () => ({
            issuer: 'https://example.com',
            authorization_endpoint: 'https://example.com/authorize',
            token_endpoint: 'https://example.com/token',
          }),
        }
      }

      return { ok: false, status: 404 }
    })

    const config = await discoverOAuthConfig('https://example.com/mcp')

    expect(config?.tokenUrl).toBe('https://example.com/token')
  })

  it('returns null when the server metadata lacks the required endpoints', async () => {
    mockFetch.mockImplementation(async (url) =>
      url === 'https://example.com/.well-known/oauth-authorization-server'
        ? { ok: true, json: async () => ({ issuer: 'https://example.com' }) }
        : { ok: false, status: 404 }
    )

    await expect(discoverOAuthConfig('https://example.com/mcp')).resolves.toBeNull()
  })
})
