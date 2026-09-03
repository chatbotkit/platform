/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import fetch from '@/lib/egress.fetch'
import {
  deleteIdpOAuthPendingState,
  retrieveIdpOAuthPendingState,
  storeIdpOAuthAuthorizationRequest,
} from '@/lib/oauth.connection.idp'
import { fetchAuthorizationServerMetadata } from '@/lib/oauth.discovery'

import handler from './callback'

import * as jose from 'jose'

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    oAuthConnection: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

jest.mock('@/lib/egress.fetch', () => jest.fn())

jest.mock('@/lib/oauth.connection.idp', () => ({
  deleteIdpOAuthPendingState: jest.fn(),
  generateIdpOAuthCode: jest.fn(() => 'cbk-code-123'),
  retrieveIdpOAuthPendingState: jest.fn(),
  storeIdpOAuthAuthorizationRequest: jest.fn(),
}))

jest.mock('@/lib/oauth.discovery', () => ({
  fetchAuthorizationServerMetadata: jest.fn(),
}))

jest.mock('jose', () => ({
  createLocalJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}))

const JWKS = { keys: [{ kty: 'RSA', kid: 'key-1', n: 'n', e: 'AQAB' }] }

function respondToIdp(url) {
  const href = String(url)

  if (href === 'https://issuer.example.com/jwks') {
    return Promise.resolve({ ok: true, json: async () => JWKS })
  }

  return Promise.resolve({
    ok: true,
    json: async () => ({
      id_token: 'signed-id-token',
      access_token: 'access-token',
    }),
  })
}

// The real egress fetch, with the rejection captured so a test can assert on
// the boundary's reason rather than on the handler's generic redirect.
function realEgressFetch(onError) {
  return (...args) =>
    jest
      .requireActual('@/lib/egress.fetch')
      .default(...args)
      .catch((e) => {
        onError(e)

        throw e
      })
}

function makeRequest({ code, state, error } = {}) {
  const url = new URL(`https://localhost/api/oauth/connection/callback`)

  if (code !== undefined) {
    url.searchParams.set('code', code)
  }

  if (state !== undefined) {
    url.searchParams.set('state', state)
  }

  if (error !== undefined) {
    url.searchParams.set('error', error)
  }

  return new Request(url.toString())
}

describe('GET /api/oauth/connection/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    retrieveIdpOAuthPendingState.mockResolvedValue({
      oAuthConnectionId: 'oauth-123',
      clientId: 'cbk-client-123',
      redirectUri: 'https://app.example.com/callback',
      idpCallbackUrl: 'https://chatbotkit.com/oauth/connection/callback',
      codeChallenge: 'challenge-123',
      codeChallengeMethod: 'S256',
      scope: 'mcp:tools',
      state: 'state-123',
      idpTokenEndpoint: 'https://issuer.example.com/token',
      context: { mcpserverIntegrationId: 'integration-123' },
      createdAt: Date.now(),
    })

    prisma.oAuthConnection.findUnique.mockResolvedValue({
      id: 'oauth-123',
      issuer: 'https://issuer.example.com',
      clientId: 'idp-client-123',
      clientSecret: 'idp-secret-123',
      allowedDomains: null,
      requiredClaims: null,
    })

    fetch.mockImplementation(respondToIdp)

    fetchAuthorizationServerMetadata.mockResolvedValue({
      issuer: 'https://issuer.example.com',
      jwks_uri: 'https://issuer.example.com/jwks',
    })

    jose.createLocalJWKSet.mockReturnValue('local-jwks')
    jose.jwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-123',
        email: 'user@example.com',
      },
    })
  })

  it('should verify the returned id_token against the issuer JWKS before issuing a CBK code', async () => {
    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(fetchAuthorizationServerMetadata).toHaveBeenCalledWith(
      'https://issuer.example.com'
    )
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://issuer.example.com/jwks'),
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    )
    expect(jose.createLocalJWKSet).toHaveBeenCalledWith(JWKS)
    expect(jose.jwtVerify).toHaveBeenCalledWith(
      'signed-id-token',
      'local-jwks',
      {
        issuer: 'https://issuer.example.com',
        audience: 'idp-client-123',
      }
    )
    expect(storeIdpOAuthAuthorizationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        idpSub: 'user-123',
        idpEmail: 'user@example.com',
      })
    )
    expect(response.status).toBe(302)
  })

  it('should redirect with a server error when the OAuth connection is not fully configured', async () => {
    prisma.oAuthConnection.findUnique.mockResolvedValue({
      id: 'oauth-123',
      issuer: null,
      clientId: 'idp-client-123',
      clientSecret: null,
      allowedDomains: null,
      requiredClaims: null,
    })

    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(fetch).not.toHaveBeenCalled()
    expect(fetchAuthorizationServerMetadata).not.toHaveBeenCalled()
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=server_error')
    expect(response.headers.get('location')).toContain(
      'error_description=OAuth+connection+is+not+fully+configured'
    )
    expect(deleteIdpOAuthPendingState).not.toHaveBeenCalled()
  })

  it('should complete the full callback flow and redirect to Claude with a CBK code', async () => {
    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)

    const redirectUrl = new URL(response.headers.get('location'))

    expect(redirectUrl.origin).toBe('https://app.example.com')
    expect(redirectUrl.pathname).toBe('/callback')
    expect(redirectUrl.searchParams.get('code')).toBe('cbk-code-123')
    expect(redirectUrl.searchParams.get('state')).toBe('state-123')

    expect(deleteIdpOAuthPendingState).toHaveBeenCalledWith('idp-state-123')
    expect(storeIdpOAuthAuthorizationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'cbk-code-123',
        context: { mcpserverIntegrationId: 'integration-123' },
        clientId: 'cbk-client-123',
        redirectUri: 'https://app.example.com/callback',
        codeChallenge: 'challenge-123',
        scope: 'mcp:tools',
        idpSub: 'user-123',
        idpEmail: 'user@example.com',
      })
    )
  })

  it('should return error when IdP reports an error parameter', async () => {
    const req = makeRequest({
      error: 'access_denied',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'access_denied',
      error_description: 'IdP returned error: access_denied',
    })
    expect(retrieveIdpOAuthPendingState).not.toHaveBeenCalled()
  })

  it('should return error when code or state parameter is missing', async () => {
    const req = makeRequest()

    const response = await handler(req)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Missing code or state parameter',
    })
  })

  it('should return error when pending state is not found', async () => {
    retrieveIdpOAuthPendingState.mockResolvedValue(null)

    const req = makeRequest({
      code: 'idp-code-123',
      state: 'unknown-state',
    })

    const response = await handler(req)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'invalid_request',
      error_description: 'Authorization request not found or expired',
    })
  })

  it('should redirect with access_denied when email domain is not allowed', async () => {
    prisma.oAuthConnection.findUnique.mockResolvedValue({
      id: 'oauth-123',
      issuer: 'https://issuer.example.com',
      clientId: 'idp-client-123',
      clientSecret: 'idp-secret-123',
      allowedDomains: 'allowed.com',
      requiredClaims: null,
    })

    jose.jwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-123',
        email: 'user@blocked.com',
      },
    })

    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=access_denied')
    expect(response.headers.get('location')).toContain(
      'error_description=Email+domain+not+allowed'
    )
  })

  it('should redirect with access_denied when required claims are not satisfied', async () => {
    prisma.oAuthConnection.findUnique.mockResolvedValue({
      id: 'oauth-123',
      issuer: 'https://issuer.example.com',
      clientId: 'idp-client-123',
      clientSecret: 'idp-secret-123',
      allowedDomains: null,
      requiredClaims: { department: 'engineering' },
    })

    jose.jwtVerify.mockResolvedValue({
      payload: {
        sub: 'user-123',
        email: 'user@example.com',
        department: 'marketing',
      },
    })

    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=access_denied')
    expect(response.headers.get('location')).toContain('department')
  })

  it('should redirect with error when IdP token exchange fails', async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Code expired',
      }),
    })

    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=access_denied')
    expect(response.headers.get('location')).toContain('Code+expired')
  })

  it('should redirect with server_error when the JWKS document cannot be fetched', async () => {
    fetch.mockImplementation((url) => {
      if (String(url) === 'https://issuer.example.com/jwks') {
        return Promise.resolve({ ok: false, status: 503, json: async () => ({}) })
      }

      return respondToIdp(url)
    })

    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(jose.jwtVerify).not.toHaveBeenCalled()
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=server_error')
    expect(response.headers.get('location')).toContain(
      'error_description=Failed+to+verify+IdP+id_token'
    )
  })

  it('refuses a private-IP literal token endpoint before any connection is attempted', async () => {
    retrieveIdpOAuthPendingState.mockResolvedValue({
      ...(await retrieveIdpOAuthPendingState()),
      idpTokenEndpoint: 'http://127.0.0.1/token',
    })

    let captured

    fetch.mockImplementation(
      realEgressFetch((e) => {
        captured = e
      })
    )

    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1/token',
      expect.objectContaining({ method: 'POST' })
    )
    expect(String(captured?.cause?.message)).toMatch(
      /egress to 127\.0\.0\.1 is not allowed: not a public address/
    )
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain(
      'error_description=Failed+to+contact+IdP+token+endpoint'
    )
    expect(jose.jwtVerify).not.toHaveBeenCalled()
  })

  it('refuses a private-IP literal jwks_uri before any connection is attempted', async () => {
    fetchAuthorizationServerMetadata.mockResolvedValue({
      issuer: 'https://issuer.example.com',
      jwks_uri: 'http://10.0.0.1/jwks',
    })

    let captured

    const guarded = realEgressFetch((e) => {
      captured = e
    })

    fetch.mockImplementation((url, init) =>
      String(url) === 'http://10.0.0.1/jwks'
        ? guarded(url, init)
        : respondToIdp(url)
    )

    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(fetch).toHaveBeenCalledWith(
      new URL('http://10.0.0.1/jwks'),
      expect.anything()
    )
    expect(String(captured?.cause?.message)).toMatch(
      /egress to 10\.0\.0\.1 is not allowed: not a public address/
    )
    expect(jose.createLocalJWKSet).not.toHaveBeenCalled()
    expect(jose.jwtVerify).not.toHaveBeenCalled()
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain(
      'error_description=Failed+to+verify+IdP+id_token'
    )
    expect(storeIdpOAuthAuthorizationRequest).not.toHaveBeenCalled()
  })

  it('should keep pending state when contacting the IdP token endpoint fails', async () => {
    fetch.mockRejectedValue(new Error('network error'))

    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=server_error')
    expect(response.headers.get('location')).toContain(
      'error_description=Failed+to+contact+IdP+token+endpoint'
    )
    expect(deleteIdpOAuthPendingState).not.toHaveBeenCalled()
  })

  it('should redirect with server_error to Claude when the OAuth connection record is missing', async () => {
    prisma.oAuthConnection.findUnique.mockResolvedValue(null)

    const req = makeRequest({
      code: 'idp-code-123',
      state: 'idp-state-123',
    })

    const response = await handler(req)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toContain('error=server_error')
    expect(response.headers.get('location')).toContain('state=state-123')
    expect(fetch).not.toHaveBeenCalled()
  })
})
