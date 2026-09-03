import memcache from '@/lib/memcache'

import {
  consumeIdpOAuthAuthorizationRequest,
  deleteIdpOAuthAuthorizationRequest,
  deleteIdpOAuthPendingState,
  generateIdpOAuthCode,
  retrieveIdpOAuthAuthorizationRequest,
  retrieveIdpOAuthPendingState,
  storeIdpOAuthAuthorizationRequest,
  storeIdpOAuthPendingState,
} from './oauth.connection.idp'

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    getdel: jest.fn(),
  },
}))

jest.mock('@/lib/cuid', () => jest.fn(() => 'fixed-cuid'))
jest.mock('@/lib/debug', () =>
  jest.fn(() => ({
    log: jest.fn(),
  }))
)

describe('oauth.connection.idp', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should store and retrieve pending state with expected redis key and ttl', async () => {
    const pendingState = {
      oAuthConnectionId: 'oauth-1',
      clientId: 'client-1',
      redirectUri: 'https://app.example.com/callback',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      scope: 'openid profile',
      state: 'state-1',
      idpTokenEndpoint: 'https://idp.example.com/token',
      idpCallbackUrl: 'https://cbk.example.com/idp/callback',
      context: { integrationId: 'int-1' },
      createdAt: Date.now(),
    }

    await storeIdpOAuthPendingState('idp-state-1', pendingState)

    expect(memcache.set).toHaveBeenCalledWith(
      'oauth:idp:pending:idp-state-1',
      JSON.stringify(pendingState),
      { ex: 600 }
    )

    memcache.get.mockResolvedValue(JSON.stringify(pendingState))

    await expect(retrieveIdpOAuthPendingState('idp-state-1')).resolves.toEqual(
      pendingState
    )
  })

  it('should return null when pending state does not exist and handle object payload', async () => {
    memcache.get.mockResolvedValueOnce(null)

    await expect(
      retrieveIdpOAuthPendingState('missing-state')
    ).resolves.toBeNull()

    const pendingStateAsObject = {
      oAuthConnectionId: 'oauth-2',
      clientId: 'client-2',
      redirectUri: 'https://app.example.com/callback',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      scope: 'openid',
      idpTokenEndpoint: 'https://idp.example.com/token',
      idpCallbackUrl: 'https://cbk.example.com/idp/callback',
      context: {},
      createdAt: Date.now(),
    }

    memcache.get.mockResolvedValueOnce(pendingStateAsObject)

    await expect(retrieveIdpOAuthPendingState('object-state')).resolves.toEqual(
      pendingStateAsObject
    )
  })

  it('should delete pending state and return boolean', async () => {
    memcache.del.mockResolvedValueOnce(1).mockResolvedValueOnce(0)

    await expect(deleteIdpOAuthPendingState('state-a')).resolves.toBe(true)
    await expect(deleteIdpOAuthPendingState('state-b')).resolves.toBe(false)

    expect(memcache.del).toHaveBeenNthCalledWith(1, 'oauth:idp:pending:state-a')
    expect(memcache.del).toHaveBeenNthCalledWith(2, 'oauth:idp:pending:state-b')
  })

  it('should generate oauth code with cbk_idp prefix', () => {
    expect(generateIdpOAuthCode()).toBe('cbk_idp_fixed-cuid')
  })

  it('should store, retrieve, consume and delete authorization request', async () => {
    const request = {
      code: 'code-1',
      clientId: 'client-1',
      redirectUri: 'https://app.example.com/callback',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      scope: 'openid profile email',
      state: 'state-1',
      idpSub: 'idp-sub-1',
      idpEmail: 'user@example.com',
      context: { appId: 'app-1' },
      createdAt: Date.now(),
    }

    await storeIdpOAuthAuthorizationRequest(request)

    expect(memcache.set).toHaveBeenCalledWith(
      'oauth:idp:authcode:code-1',
      JSON.stringify(request),
      { ex: 600 }
    )

    memcache.get
      .mockResolvedValueOnce(JSON.stringify(request))
      .mockResolvedValueOnce(null)
    memcache.getdel
      .mockResolvedValueOnce(JSON.stringify(request))
      .mockResolvedValueOnce(null)
    memcache.del.mockResolvedValueOnce(1).mockResolvedValueOnce(0)

    await expect(
      retrieveIdpOAuthAuthorizationRequest('code-1')
    ).resolves.toEqual(request)
    await expect(
      retrieveIdpOAuthAuthorizationRequest('missing-code')
    ).resolves.toBeNull()
    await expect(
      consumeIdpOAuthAuthorizationRequest('code-1')
    ).resolves.toEqual(request)
    await expect(
      consumeIdpOAuthAuthorizationRequest('missing-code')
    ).resolves.toBeNull()
    await expect(deleteIdpOAuthAuthorizationRequest('code-1')).resolves.toBe(
      true
    )
    await expect(
      deleteIdpOAuthAuthorizationRequest('missing-code')
    ).resolves.toBe(false)
  })
})
