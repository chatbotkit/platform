import {
  consumeIdpOAuthAuthorizationRequest,
  deleteIdpOAuthAuthorizationRequest,
  deleteIdpOAuthPendingState,
  generateIdpOAuthCode,
  retrieveIdpOAuthAuthorizationRequest,
  retrieveIdpOAuthPendingState,
  storeIdpOAuthAuthorizationRequest,
  storeIdpOAuthPendingState,
} from '@/lib/oauth.connection.idp'

import {
  consumeMcpIdpOAuthAuthorizationRequest,
  deleteMcpIdpOAuthAuthorizationRequest,
  deleteMcpIdpOAuthPendingState,
  generateMcpIdpOAuthCode,
  retrieveMcpIdpOAuthAuthorizationRequest,
  retrieveMcpIdpOAuthPendingState,
  storeMcpIdpOAuthAuthorizationRequest,
  storeMcpIdpOAuthPendingState,
} from './mcp.oauth.idp'

jest.mock('@/lib/oauth.connection.idp', () => ({
  consumeIdpOAuthAuthorizationRequest: jest.fn(),
  deleteIdpOAuthAuthorizationRequest: jest.fn(),
  deleteIdpOAuthPendingState: jest.fn(),
  generateIdpOAuthCode: jest.fn(),
  retrieveIdpOAuthAuthorizationRequest: jest.fn(),
  retrieveIdpOAuthPendingState: jest.fn(),
  storeIdpOAuthAuthorizationRequest: jest.fn(),
  storeIdpOAuthPendingState: jest.fn(),
}))

describe('mcp.oauth.idp', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('delegates pending state operations', async () => {
    const pendingState = {
      context: { mcpserverIntegrationId: 'mcp-int-1' },
      oAuthConnectionId: 'oauth-1',
    }

    storeIdpOAuthPendingState.mockResolvedValueOnce(undefined)
    await expect(
      storeMcpIdpOAuthPendingState('state-1', pendingState, 120)
    ).resolves.toBeUndefined()
    expect(storeIdpOAuthPendingState).toHaveBeenCalledWith(
      'state-1',
      pendingState,
      120
    )

    retrieveIdpOAuthPendingState.mockResolvedValueOnce(pendingState)
    await expect(retrieveMcpIdpOAuthPendingState('state-1')).resolves.toEqual(
      pendingState
    )
    expect(retrieveIdpOAuthPendingState).toHaveBeenCalledWith('state-1')

    deleteIdpOAuthPendingState.mockResolvedValueOnce(true)
    await expect(deleteMcpIdpOAuthPendingState('state-1')).resolves.toBe(true)
    expect(deleteIdpOAuthPendingState).toHaveBeenCalledWith('state-1')
  })

  it('delegates code generation and authorization request operations', async () => {
    const request = {
      clientId: 'client-1',
      code: 'cbk_idp_abc',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      context: { mcpserverIntegrationId: 'mcp-int-1' },
      createdAt: Date.now(),
      idpSub: 'idp-user-1',
      redirectUri: 'https://app.example.com/callback',
      scope: 'mcp:tools',
    }

    generateIdpOAuthCode.mockReturnValueOnce('cbk_idp_generated')
    expect(generateMcpIdpOAuthCode()).toBe('cbk_idp_generated')
    expect(generateIdpOAuthCode).toHaveBeenCalledTimes(1)

    storeIdpOAuthAuthorizationRequest.mockResolvedValueOnce(undefined)
    await expect(
      storeMcpIdpOAuthAuthorizationRequest(request, 240)
    ).resolves.toBeUndefined()
    expect(storeIdpOAuthAuthorizationRequest).toHaveBeenCalledWith(request, 240)

    retrieveIdpOAuthAuthorizationRequest.mockResolvedValueOnce(request)
    await expect(
      retrieveMcpIdpOAuthAuthorizationRequest('cbk_idp_abc')
    ).resolves.toEqual(request)
    expect(retrieveIdpOAuthAuthorizationRequest).toHaveBeenCalledWith(
      'cbk_idp_abc'
    )

    consumeIdpOAuthAuthorizationRequest.mockResolvedValueOnce(request)
    await expect(
      consumeMcpIdpOAuthAuthorizationRequest('cbk_idp_abc')
    ).resolves.toEqual(request)
    expect(consumeIdpOAuthAuthorizationRequest).toHaveBeenCalledWith(
      'cbk_idp_abc'
    )

    deleteIdpOAuthAuthorizationRequest.mockResolvedValueOnce(true)
    await expect(
      deleteMcpIdpOAuthAuthorizationRequest('cbk_idp_abc')
    ).resolves.toBe(true)
    expect(deleteIdpOAuthAuthorizationRequest).toHaveBeenCalledWith(
      'cbk_idp_abc'
    )
  })
})
