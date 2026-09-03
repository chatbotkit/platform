import fetch from '@/lib/fetch'
import { getCallbackURL } from '@/lib/oauth.authorization'
import {
  clientRegistrationRequestSchema,
  clientRegistrationResponseSchema,
  needsSelfRegistration,
  registerOAuthClient,
} from '@/lib/oauth.registration'

// Mock the fetch module
jest.mock('@/lib/fetch', () => {
  return jest.fn()
})

jest.mock('@/lib/oauth.authorization', () => ({
  getCallbackURL: jest.fn(),
}))

const mockFetch = fetch
const mockGetCallbackURL = getCallbackURL

beforeEach(() => {
  mockFetch.mockReset()
  mockGetCallbackURL.mockReset()
  mockGetCallbackURL.mockResolvedValue(
    'https://chatbotkit.com/secrets/oauth/callback'
  )
})

describe('clientRegistrationRequestSchema', () => {
  it('should accept valid minimal request', () => {
    const result = clientRegistrationRequestSchema.safeParse({
      redirect_uris: ['https://example.com/callback'],
    })

    expect(result.success).toBe(true)
  })

  it('should accept request with all optional fields', () => {
    const result = clientRegistrationRequestSchema.safeParse({
      redirect_uris: ['https://example.com/callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: 'Test App',
      client_uri: 'https://example.com',
      scope: 'openid profile',
    })

    expect(result.success).toBe(true)
  })

  it('should reject request without redirect_uris', () => {
    const result = clientRegistrationRequestSchema.safeParse({
      client_name: 'Test App',
    })

    expect(result.success).toBe(false)
  })

  it('should accept request with empty redirect_uris array', () => {
    // Schema allows empty arrays; server validation may reject
    const result = clientRegistrationRequestSchema.safeParse({
      redirect_uris: [],
    })

    expect(result.success).toBe(true)
  })
})

describe('clientRegistrationResponseSchema', () => {
  it('should accept valid response with client_id', () => {
    const result = clientRegistrationResponseSchema.safeParse({
      client_id: 'abc123',
    })

    expect(result.success).toBe(true)
  })

  it('should accept response with optional fields', () => {
    const result = clientRegistrationResponseSchema.safeParse({
      client_id: 'abc123',
      client_secret: 'secret',
      client_id_issued_at: 1234567890,
      client_secret_expires_at: 1234567890,
      registration_access_token: 'token',
      registration_client_uri: 'https://example.com/register/abc123',
    })

    expect(result.success).toBe(true)
    expect(result.data.client_secret).toBe('secret')
  })

  it('should reject response without client_id', () => {
    const result = clientRegistrationResponseSchema.safeParse({
      client_secret: 'secret',
    })

    expect(result.success).toBe(false)
  })
})

describe('registerOAuthClient', () => {
  const registrationEndpoint = 'https://auth.example.com/register'
  const redirectUris = ['https://example.com/callback']

  it('should register a client successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
          client_id_issued_at: 1234567890,
        }),
    })

    const result = await registerOAuthClient({
      registrationEndpoint,
      redirectUris,
    })

    expect(result.success).toBe(true)
    expect(result.clientId).toBe('new-client-id')
    expect(mockFetch).toHaveBeenCalledWith(
      registrationEndpoint,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('should include client_name if provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
        }),
    })

    await registerOAuthClient({
      registrationEndpoint,
      redirectUris,
      clientName: 'My App',
    })

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(requestBody.client_name).toBe('My App')
  })

  it('should request authorization_code and refresh_token grants by default', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
        }),
    })

    await registerOAuthClient({
      registrationEndpoint,
      redirectUris,
    })

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(requestBody.grant_types).toContain('authorization_code')
    expect(requestBody.grant_types).toContain('refresh_token')
  })

  it('should request public client auth method (none)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
        }),
    })

    await registerOAuthClient({
      registrationEndpoint,
      redirectUris,
    })

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(requestBody.token_endpoint_auth_method).toBe('none')
  })

  it('should return client_secret if provided by server', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
          client_secret: 'server-secret',
        }),
    })

    const result = await registerOAuthClient({
      registrationEndpoint,
      redirectUris,
    })

    expect(result.success).toBe(true)
    expect(result.clientSecret).toBe('server-secret')
  })

  it('should return error result on HTTP failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: 'invalid_request',
          error_description: 'Invalid redirect URI',
        }),
    })

    const result = await registerOAuthClient({
      registrationEndpoint,
      redirectUris,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid_request')
    expect(result.errorDescription).toBe('Invalid redirect URI')
  })

  it('should return error result on invalid response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          // Missing client_id
          client_secret: 'secret',
        }),
    })

    const result = await registerOAuthClient({
      registrationEndpoint,
      redirectUris,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid_response')
  })

  it('should use default client name if not provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
        }),
    })

    await registerOAuthClient({
      registrationEndpoint,
      redirectUris,
    })

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(requestBody.client_name).toBe('ChatBotKit')
  })
})

describe('needsSelfRegistration', () => {
  it('should return true when resourceUrl present and clientId missing with registrationEndpoint', () => {
    const result = needsSelfRegistration({
      resourceUrl: 'https://api.example.com',
      registrationEndpoint: 'https://auth.example.com/register',
    })

    expect(result).toBe(true)
  })

  it('should return false when clientId is present', () => {
    const result = needsSelfRegistration({
      resourceUrl: 'https://api.example.com',
      clientId: 'existing-client',
      registrationEndpoint: 'https://auth.example.com/register',
    })

    expect(result).toBe(false)
  })

  it('should return false when resourceUrl is missing', () => {
    const result = needsSelfRegistration({
      registrationEndpoint: 'https://auth.example.com/register',
    })

    expect(result).toBe(false)
  })

  it('should return false when registrationEndpoint is missing', () => {
    const result = needsSelfRegistration({
      resourceUrl: 'https://api.example.com',
    })

    expect(result).toBe(false)
  })

  it('should return false when all parameters are missing', () => {
    const result = needsSelfRegistration({})

    expect(result).toBe(false)
  })
})

describe('registerOAuthClient additional coverage', () => {
  const registrationEndpoint = 'https://auth.example.com/register'

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('should use custom redirectUris when provided', async () => {
    const customRedirectUris = [
      'https://custom.example.com/callback',
      'https://another.example.com/oauth',
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
        }),
    })

    await registerOAuthClient({
      registrationEndpoint,
      redirectUris: customRedirectUris,
    })

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(requestBody.redirect_uris).toEqual(customRedirectUris)
  })

  it('should include scope when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
        }),
    })

    await registerOAuthClient({
      registrationEndpoint,
      redirectUris: ['https://example.com/callback'],
      scope: 'openid profile email',
    })

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(requestBody.scope).toBe('openid profile email')
  })

  it('should return error when response is not valid JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'not valid json',
    })

    const result = await registerOAuthClient({
      registrationEndpoint,
      redirectUris: ['https://example.com/callback'],
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('invalid_response')
    expect(result.errorDescription).toBe(
      'Registration endpoint returned non-JSON response'
    )
  })

  it('should return generic error when HTTP failure has non-standard error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () =>
        JSON.stringify({
          message: 'Internal server error',
          // Missing 'error' field expected by clientRegistrationErrorSchema
        }),
    })

    const result = await registerOAuthClient({
      registrationEndpoint,
      redirectUris: ['https://example.com/callback'],
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('registration_failed')
    expect(result.errorDescription).toBe('Registration failed with status 500')
  })

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await registerOAuthClient({
      registrationEndpoint,
      redirectUris: ['https://example.com/callback'],
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('network_error')
    expect(result.errorDescription).toBe('Connection refused')
  })

  it('should handle non-Error thrown values gracefully', async () => {
    mockFetch.mockRejectedValueOnce('string error')

    const result = await registerOAuthClient({
      registrationEndpoint,
      redirectUris: ['https://example.com/callback'],
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('network_error')
    expect(result.errorDescription).toBe('Network request failed')
  })

  it('should return clientIdIssuedAt and clientSecretExpiresAt when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
          client_secret: 'new-secret',
          client_id_issued_at: 1704067200,
          client_secret_expires_at: 1735689600,
        }),
    })

    const result = await registerOAuthClient({
      registrationEndpoint,
      redirectUris: ['https://example.com/callback'],
    })

    expect(result.success).toBe(true)
    expect(result.clientIdIssuedAt).toBe(1704067200)
    expect(result.clientSecretExpiresAt).toBe(1735689600)
  })

  it('should send Accept header with application/json', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
        }),
    })

    await registerOAuthClient({
      registrationEndpoint,
      redirectUris: ['https://example.com/callback'],
    })

    expect(mockFetch).toHaveBeenCalledWith(
      registrationEndpoint,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    )
  })

  it('should include response_types as code by default', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
        }),
    })

    await registerOAuthClient({
      registrationEndpoint,
      redirectUris: ['https://example.com/callback'],
    })

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(requestBody.response_types).toEqual(['code'])
  })

  it('should use default redirect URI from getCallbackURL when redirectUris not provided', async () => {
    mockGetCallbackURL.mockResolvedValue(
      'https://chatbotkit.com/secrets/oauth/callback'
    )

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          client_id: 'new-client-id',
        }),
    })

    await registerOAuthClient({
      registrationEndpoint,
      // redirectUris not provided - should use default
    })

    expect(mockGetCallbackURL).toHaveBeenCalled()

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(requestBody.redirect_uris).toEqual([
      'https://chatbotkit.com/secrets/oauth/callback',
    ])
  })
})
