/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { refreshAccessToken } from '@/lib/oauth.authorization'
import { discoverOAuthConfig } from '@/lib/oauth.discovery'
import {
  needsSelfRegistration,
  registerOAuthClient,
} from '@/lib/oauth.registration'
import { revealSecretInstanceFromReferenceSecret } from '@/lib/secret.reference'
import { revealSecretInstanceFromTemplateSecret } from '@/lib/secret.template'
import { tryParse, tryStringify } from '@/lib/yaml'

import {
  getNewSecretOAuthValue,
  getSecretOAuthAccessToken,
  getSecretOAuthConfig,
  getSecretOAuthValue,
  isSecretOAuthTokenExpired,
  performClientRegistration,
  refreshSecretOAuthToken,
  setSecretOAuthValue,
  updateSecretOAuthConfig,
} from './secret.oauth'

jest.mock('@/lib/oauth.authorization', () => ({
  refreshAccessToken: jest.fn(),
}))

jest.mock('@/lib/oauth.discovery', () => ({
  discoverOAuthConfig: jest.fn(),
}))

jest.mock('@/lib/oauth.pkce', () => ({
  generatePkcePair: jest.fn(),
}))

jest.mock('@/lib/oauth.registration', () => ({
  needsSelfRegistration: jest.fn(),
  registerOAuthClient: jest.fn(),
}))

jest.mock('@/lib/secret.reference', () => ({
  revealSecretInstanceFromReferenceSecret: jest.fn(),
}))

jest.mock('@/lib/secret.template', () => ({
  revealSecretInstanceFromTemplateSecret: jest.fn(),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,

  default: {
    secret: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  SecretType: {
    oauth: 'oauth',
    template: 'template',
    reference: 'reference',
  },
}))

describe('getSecretOAuthConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return OAuth config for oauth secret type', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        authorizationUrl: 'https://auth.example.com',
        tokenUrl: 'https://token.example.com',
        revokeUrl: 'https://revoke.example.com',
        validateUrl: 'https://validate.example.com',
        grantType: 'authorization_code',
        scope: 'read write',
      },
    }

    const result = await getSecretOAuthConfig(secret)

    expect(result).toEqual({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      authorizationUrl: 'https://auth.example.com',
      tokenUrl: 'https://token.example.com',
      revokeUrl: 'https://revoke.example.com',
      validateUrl: 'https://validate.example.com',
      grantType: 'authorization_code',
      scope: 'read write',
    })
  })

  it('should return empty config when oauth secret has no config', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: null,
    }

    const result = await getSecretOAuthConfig(secret)

    expect(result).toEqual({})
  })

  it('should return partial OAuth config for oauth secret', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        tokenUrl: 'https://token.example.com',
      },
    }

    const result = await getSecretOAuthConfig(secret)

    expect(result).toEqual({
      clientId: 'test-client-id',
      tokenUrl: 'https://token.example.com',
    })
  })

  it('should return OAuth config from template secret', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'template',
    }

    revealSecretInstanceFromTemplateSecret.mockResolvedValue({
      config: {
        clientId: 'template-client-id',
        clientSecret: 'template-client-secret',
      },
    })

    const result = await getSecretOAuthConfig(secret)

    expect(result).toEqual({
      clientId: 'template-client-id',
      clientSecret: 'template-client-secret',
    })
    expect(revealSecretInstanceFromTemplateSecret).toHaveBeenCalledWith(secret)
  })

  it('should return empty config when template instance is null', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'template',
    }

    revealSecretInstanceFromTemplateSecret.mockResolvedValue(null)

    const result = await getSecretOAuthConfig(secret)

    expect(result).toEqual({})
  })

  it('should return OAuth config from reference secret', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'reference',
    }

    revealSecretInstanceFromReferenceSecret.mockResolvedValue({
      config: {
        clientId: 'reference-client-id',
        scope: 'profile email',
      },
    })

    const result = await getSecretOAuthConfig(secret)

    expect(result).toEqual({
      clientId: 'reference-client-id',
      scope: 'profile email',
    })
    expect(revealSecretInstanceFromReferenceSecret).toHaveBeenCalledWith(secret)
  })

  it('should return empty config when reference instance is null', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'reference',
    }

    revealSecretInstanceFromReferenceSecret.mockResolvedValue(null)

    const result = await getSecretOAuthConfig(secret)

    expect(result).toEqual({})
  })

  it('should return empty config for unknown secret type', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'unknown',
    }

    const result = await getSecretOAuthConfig(secret)

    expect(result).toEqual({})
  })

  it('should handle invalid config data gracefully', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: 'invalid-config',
    }

    const result = await getSecretOAuthConfig(secret)

    expect(result).toEqual({})
  })

  it('should filter out invalid fields from config', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        invalidField: 'should-be-ignored',
        clientSecret: 123, // wrong type
      },
    }

    const result = await getSecretOAuthConfig(secret)

    expect(result).toEqual({
      clientId: 'test-client-id',
    })
    expect(result.invalidField).toBeUndefined()
  })

  describe('with resourceUrl discovery', () => {
    it('should perform discovery when resourceUrl present but endpoints missing', async () => {
      const secret = {
        id: 'test-secret-id',
        type: 'oauth',
        config: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          resourceUrl: 'https://mcp.example.com',
        },
      }

      discoverOAuthConfig.mockResolvedValue({
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        revokeUrl: 'https://auth.example.com/revoke',
        scope: 'read write',
        registrationEndpoint: 'https://auth.example.com/register',
        clientIdMetadataDocumentSupported: true,
        codeChallengeMethodsSupported: ['S256'],
      })

      const result = await getSecretOAuthConfig(secret)

      expect(discoverOAuthConfig).toHaveBeenCalledWith(
        'https://mcp.example.com'
      )
      expect(result).toEqual({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        revokeUrl: 'https://auth.example.com/revoke',
        scope: 'read write',
        resourceUrl: 'https://mcp.example.com',
        registrationEndpoint: 'https://auth.example.com/register',
        clientIdMetadataDocumentSupported: true,
        codeChallengeMethodsSupported: ['S256'],
      })
    })

    it('should not perform discovery when both endpoints are present', async () => {
      const secret = {
        id: 'test-secret-id',
        type: 'oauth',
        config: {
          clientId: 'test-client-id',
          authorizationUrl: 'https://explicit.example.com/authorize',
          tokenUrl: 'https://explicit.example.com/token',
          resourceUrl: 'https://mcp.example.com',
        },
      }

      const result = await getSecretOAuthConfig(secret)

      expect(discoverOAuthConfig).not.toHaveBeenCalled()
      expect(result).toEqual({
        clientId: 'test-client-id',
        authorizationUrl: 'https://explicit.example.com/authorize',
        tokenUrl: 'https://explicit.example.com/token',
        resourceUrl: 'https://mcp.example.com',
      })
    })

    it('should perform discovery when only authorizationUrl is present', async () => {
      const secret = {
        id: 'test-secret-id',
        type: 'oauth',
        config: {
          clientId: 'test-client-id',
          authorizationUrl: 'https://explicit.example.com/authorize',
          resourceUrl: 'https://mcp.example.com',
        },
      }

      discoverOAuthConfig.mockResolvedValue({
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
      })

      const result = await getSecretOAuthConfig(secret)

      expect(discoverOAuthConfig).toHaveBeenCalledWith(
        'https://mcp.example.com'
      )
      // Explicit authorizationUrl should take precedence
      expect(result.authorizationUrl).toBe(
        'https://explicit.example.com/authorize'
      )
      expect(result.tokenUrl).toBe('https://auth.example.com/token')
    })

    it('should perform discovery when only tokenUrl is present', async () => {
      const secret = {
        id: 'test-secret-id',
        type: 'oauth',
        config: {
          clientId: 'test-client-id',
          tokenUrl: 'https://explicit.example.com/token',
          resourceUrl: 'https://mcp.example.com',
        },
      }

      discoverOAuthConfig.mockResolvedValue({
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
      })

      const result = await getSecretOAuthConfig(secret)

      expect(discoverOAuthConfig).toHaveBeenCalledWith(
        'https://mcp.example.com'
      )
      // Explicit tokenUrl should take precedence
      expect(result.authorizationUrl).toBe('https://auth.example.com/authorize')
      expect(result.tokenUrl).toBe('https://explicit.example.com/token')
    })

    it('should return explicit config when discovery fails', async () => {
      const secret = {
        id: 'test-secret-id',
        type: 'oauth',
        config: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          resourceUrl: 'https://mcp.example.com',
        },
      }

      discoverOAuthConfig.mockResolvedValue(null)

      const result = await getSecretOAuthConfig(secret)

      expect(discoverOAuthConfig).toHaveBeenCalledWith(
        'https://mcp.example.com'
      )
      expect(result).toEqual({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        resourceUrl: 'https://mcp.example.com',
      })
    })

    it('should merge explicit scope over discovered scope', async () => {
      const secret = {
        id: 'test-secret-id',
        type: 'oauth',
        config: {
          clientId: 'test-client-id',
          scope: 'explicit-scope',
          resourceUrl: 'https://mcp.example.com',
        },
      }

      discoverOAuthConfig.mockResolvedValue({
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        scope: 'discovered-scope',
      })

      const result = await getSecretOAuthConfig(secret)

      expect(result.scope).toBe('explicit-scope')
    })

    it('should use discovered scope when explicit scope not provided', async () => {
      const secret = {
        id: 'test-secret-id',
        type: 'oauth',
        config: {
          clientId: 'test-client-id',
          resourceUrl: 'https://mcp.example.com',
        },
      }

      discoverOAuthConfig.mockResolvedValue({
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
        scope: 'discovered-scope',
      })

      const result = await getSecretOAuthConfig(secret)

      expect(result.scope).toBe('discovered-scope')
    })

    it('should work with template secrets that have resourceUrl', async () => {
      const secret = {
        id: 'test-secret-id',
        type: 'template',
      }

      revealSecretInstanceFromTemplateSecret.mockResolvedValue({
        config: {
          clientId: 'template-client-id',
          clientSecret: 'template-client-secret',
          resourceUrl: 'https://mcp.example.com',
        },
      })

      discoverOAuthConfig.mockResolvedValue({
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
      })

      const result = await getSecretOAuthConfig(secret)

      expect(discoverOAuthConfig).toHaveBeenCalledWith(
        'https://mcp.example.com'
      )
      expect(result.clientId).toBe('template-client-id')
      expect(result.authorizationUrl).toBe('https://auth.example.com/authorize')
    })

    it('should work with reference secrets that have resourceUrl', async () => {
      const secret = {
        id: 'test-secret-id',
        type: 'reference',
      }

      revealSecretInstanceFromReferenceSecret.mockResolvedValue({
        config: {
          clientId: 'reference-client-id',
          resourceUrl: 'https://mcp.example.com',
        },
      })

      discoverOAuthConfig.mockResolvedValue({
        authorizationUrl: 'https://auth.example.com/authorize',
        tokenUrl: 'https://auth.example.com/token',
      })

      const result = await getSecretOAuthConfig(secret)

      expect(discoverOAuthConfig).toHaveBeenCalledWith(
        'https://mcp.example.com'
      )
      expect(result.clientId).toBe('reference-client-id')
      expect(result.authorizationUrl).toBe('https://auth.example.com/authorize')
    })
  })
})

describe('getSecretOAuthValue', () => {
  it('should return parsed OAuth value', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'test-access-token',
        accessTokenExpiresAt: 1234567890,
        refreshToken: 'test-refresh-token',
        refreshTokenExpiresAt: 9876543210,
        additionalProperties: { customKey: 'customValue' },
      }),
    }

    const result = await getSecretOAuthValue(secret)

    expect(result).toEqual({
      accessToken: 'test-access-token',
      accessTokenExpiresAt: 1234567890,
      refreshToken: 'test-refresh-token',
      refreshTokenExpiresAt: 9876543210,
      additionalProperties: { customKey: 'customValue' },
    })
  })

  it('should return empty object for empty secret value', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: '',
    }

    const result = await getSecretOAuthValue(secret)

    expect(result).toEqual({
      accessToken: undefined,
      accessTokenExpiresAt: undefined,
      refreshToken: undefined,
      refreshTokenExpiresAt: undefined,
      additionalProperties: undefined,
    })
  })

  it('should handle null secret value', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: null,
    }

    const result = await getSecretOAuthValue(secret)

    expect(result).toEqual({
      accessToken: undefined,
      accessTokenExpiresAt: undefined,
      refreshToken: undefined,
      refreshTokenExpiresAt: undefined,
      additionalProperties: undefined,
    })
  })

  it('should coerce string expiration dates to numbers', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'test-access-token',
        accessTokenExpiresAt: '1234567890',
        refreshTokenExpiresAt: '9876543210',
      }),
    }

    const result = await getSecretOAuthValue(secret)

    expect(result.accessTokenExpiresAt).toBe(1234567890)
    expect(result.refreshTokenExpiresAt).toBe(9876543210)
    expect(typeof result.accessTokenExpiresAt).toBe('number')
    expect(typeof result.refreshTokenExpiresAt).toBe('number')
  })

  it('should handle partial OAuth values', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'test-access-token',
      }),
    }

    const result = await getSecretOAuthValue(secret)

    expect(result.accessToken).toBe('test-access-token')
    expect(result.accessTokenExpiresAt).toBeUndefined()
    expect(result.refreshToken).toBeUndefined()
    expect(result.refreshTokenExpiresAt).toBeUndefined()
  })

  it('should ignore invalid fields in value', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'test-access-token',
        invalidField: 'should-be-ignored',
      }),
    }

    const result = await getSecretOAuthValue(secret)

    expect(result.accessToken).toBe('test-access-token')
    expect(result.invalidField).toBeUndefined()
  })
})

describe('setSecretOAuthValue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should update secret value in database', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }

    prisma.secret.update.mockResolvedValue({})

    await setSecretOAuthValue(secret, newValue)

    expect(prisma.secret.update).toHaveBeenCalledWith({
      where: {
        id: 'test-secret-id',
      },
      data: {
        value: expect.any(String),
      },
    })

    const updateCall = prisma.secret.update.mock.calls[0][0]
    const updatedValue = tryParse(updateCall.data.value)

    expect(updatedValue.accessToken).toBe('new-access-token')
    expect(updatedValue.refreshToken).toBe('new-refresh-token')
  })

  it('should preserve existing tokens when not provided', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token',
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
    }

    prisma.secret.update.mockResolvedValue({})

    await setSecretOAuthValue(secret, newValue)

    const updateCall = prisma.secret.update.mock.calls[0][0]
    const updatedValue = tryParse(updateCall.data.value)

    expect(updatedValue.accessToken).toBe('new-access-token')
    expect(updatedValue.refreshToken).toBe('old-refresh-token')
  })

  it('should handle expiration dates', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    const expirationDate = new Date('2024-12-31')
    const newValue = {
      accessToken: 'new-access-token',
      accessTokenExpiresAt: expirationDate,
    }

    prisma.secret.update.mockResolvedValue({})

    await setSecretOAuthValue(secret, newValue)

    const updateCall = prisma.secret.update.mock.calls[0][0]
    const updatedValue = tryParse(updateCall.data.value)

    expect(updatedValue.accessTokenExpiresAt).toBe(expirationDate.getTime())
  })

  it('should handle additionalProperties', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
      additionalProperties: { customKey: 'customValue', foo: 'bar' },
    }

    prisma.secret.update.mockResolvedValue({})

    await setSecretOAuthValue(secret, newValue)

    const updateCall = prisma.secret.update.mock.calls[0][0]
    const updatedValue = tryParse(updateCall.data.value)

    expect(updatedValue.additionalProperties).toEqual({
      customKey: 'customValue',
      foo: 'bar',
    })
  })
})

describe('getNewSecretOAuthValue', () => {
  it('should override the existing accessToken', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: new Date('2023-01-01').getTime(),
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
    }

    const result = await getNewSecretOAuthValue(secret, newValue)

    const parsedResult = tryParse(result)

    expect(parsedResult).toEqual({
      accessToken: 'new-access-token',
      accessTokenExpiresAt: new Date('2023-01-01').getTime(),
    })
  })

  it('should override the existing refreshToken', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: new Date('2023-01-01').getTime(),
        refreshToken: 'old-refresh-token',
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }

    const result = await getNewSecretOAuthValue(secret, newValue)

    const parsedResult = tryParse(result)

    expect(parsedResult).toEqual({
      accessToken: 'new-access-token',
      accessTokenExpiresAt: new Date('2023-01-01').getTime(),
      refreshToken: 'new-refresh-token',
    })
  })

  it('should not override the refreshToken if not provided', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: new Date('2023-01-01').getTime(),
        refreshToken: 'old-refresh-token',
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
    }

    const result = await getNewSecretOAuthValue(secret, newValue)

    const parsedResult = tryParse(result)

    expect(parsedResult).toEqual({
      accessToken: 'new-access-token',
      accessTokenExpiresAt: new Date('2023-01-01').getTime(),
      refreshToken: 'old-refresh-token',
    })
  })

  it('should handle date normalization for accessTokenExpiresAt', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
      accessTokenExpiresAt: '2024-01-01T00:00:00.000Z',
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.accessTokenExpiresAt).toBe(
      new Date('2024-01-01T00:00:00.000Z').getTime()
    )
  })

  it('should handle date normalization for refreshTokenExpiresAt', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    const newValue = {
      refreshToken: 'new-refresh-token',
      refreshTokenExpiresAt: new Date('2024-06-01'),
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.refreshTokenExpiresAt).toBe(
      new Date('2024-06-01').getTime()
    )
  })

  it('should handle empty secret value', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: '',
    }

    const newValue = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    })
  })

  it('should handle null/undefined expiration dates', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: new Date('2023-01-01').getTime(),
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: undefined,
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.accessTokenExpiresAt).toBeUndefined()
    expect(parsedResult.refreshTokenExpiresAt).toBeUndefined()
  })

  it('should preserve existing expiration dates when not provided', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: new Date('2023-01-01').getTime(),
        refreshToken: 'old-refresh-token',
        refreshTokenExpiresAt: new Date('2023-06-01').getTime(),
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.accessTokenExpiresAt).toBe(
      new Date('2023-01-01').getTime()
    )
    expect(parsedResult.refreshTokenExpiresAt).toBe(
      new Date('2023-06-01').getTime()
    )
  })

  it('should handle numeric timestamps', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    const timestamp = Date.now()

    const newValue = {
      accessToken: 'new-access-token',
      accessTokenExpiresAt: timestamp,
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.accessTokenExpiresAt).toBe(timestamp)
  })

  it('should handle additionalProperties update', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        additionalProperties: { oldKey: 'oldValue' },
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
      additionalProperties: { newKey: 'newValue', foo: 'bar' },
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.additionalProperties).toEqual({
      newKey: 'newValue',
      foo: 'bar',
    })
  })

  it('should preserve additionalProperties when not provided', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        additionalProperties: { existingKey: 'existingValue' },
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.additionalProperties).toEqual({
      existingKey: 'existingValue',
    })
  })

  it('should handle complete OAuth value replacement', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: new Date('2023-01-01').getTime(),
        refreshToken: 'old-refresh-token',
        refreshTokenExpiresAt: new Date('2023-06-01').getTime(),
        additionalProperties: { oldKey: 'oldValue' },
      }),
    }

    const newValue = {
      accessToken: 'new-access-token',
      accessTokenExpiresAt: new Date('2024-01-01'),
      refreshToken: 'new-refresh-token',
      refreshTokenExpiresAt: new Date('2024-06-01'),
      additionalProperties: { newKey: 'newValue' },
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult).toEqual({
      accessToken: 'new-access-token',
      accessTokenExpiresAt: new Date('2024-01-01').getTime(),
      refreshToken: 'new-refresh-token',
      refreshTokenExpiresAt: new Date('2024-06-01').getTime(),
      additionalProperties: { newKey: 'newValue' },
    })
  })

  it('should handle clearing tokens by setting to undefined', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token',
      }),
    }

    const newValue = {
      accessToken: undefined,
      refreshToken: undefined,
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.accessToken).toBe('old-access-token')
    expect(parsedResult.refreshToken).toBe('old-refresh-token')
  })

  it('should handle empty newValue object', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token',
      }),
    }

    const newValue = {}

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.accessToken).toBe('old-access-token')
    expect(parsedResult.refreshToken).toBe('old-refresh-token')
  })

  it('should handle date string for accessTokenExpiresAt', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    const dateString = '2025-12-31T23:59:59.999Z'
    const newValue = {
      accessToken: 'new-access-token',
      accessTokenExpiresAt: dateString,
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.accessTokenExpiresAt).toBe(
      new Date(dateString).getTime()
    )
  })

  it('should handle date string for refreshTokenExpiresAt', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        refreshToken: 'old-refresh-token',
      }),
    }

    const dateString = '2025-12-31'
    const newValue = {
      refreshToken: 'new-refresh-token',
      refreshTokenExpiresAt: dateString,
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.refreshTokenExpiresAt).toBe(
      new Date(dateString).getTime()
    )
  })

  it('should handle complex additionalProperties', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    const newValue = {
      additionalProperties: {
        nested: { object: { with: { deep: 'value' } } },
        array: [1, 2, 3],
        boolean: true,
        number: 42,
        string: 'test',
      },
    }

    const result = await getNewSecretOAuthValue(secret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.additionalProperties).toEqual({
      nested: { object: { with: { deep: 'value' } } },
      array: [1, 2, 3],
      boolean: true,
      number: 42,
      string: 'test',
    })
  })

  it('should resolve template secret before processing', async () => {
    const templateSecret = {
      id: 'template-secret-id',
      type: 'template',
      config: {
        template: 'google-mail',
      },
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    // @note revealSecretInstanceFromTemplateSecret returns a resolved secret
    // with the underlying oauth type and merged config
    revealSecretInstanceFromTemplateSecret.mockResolvedValue({
      ...templateSecret,
      type: 'oauth',
      config: {
        clientId: 'template-client-id',
        clientSecret: 'template-client-secret',
        tokenUrl: 'https://oauth2.googleapis.com/token',
      },
    })

    const newValue = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }

    const result = await getNewSecretOAuthValue(templateSecret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.accessToken).toBe('new-access-token')
    expect(parsedResult.refreshToken).toBe('new-refresh-token')
  })

  it('should resolve reference secret before processing', async () => {
    const referenceSecret = {
      id: 'reference-secret-id',
      type: 'reference',
      config: {
        secretId: 'referenced-secret-id',
      },
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    revealSecretInstanceFromReferenceSecret.mockResolvedValue({
      ...referenceSecret,
      type: 'oauth',
      config: {
        clientId: 'ref-client-id',
        tokenUrl: 'https://token.example.com',
      },
    })

    const newValue = {
      accessToken: 'new-access-token',
    }

    const result = await getNewSecretOAuthValue(referenceSecret, newValue)
    const parsedResult = tryParse(result)

    expect(parsedResult.accessToken).toBe('new-access-token')
  })
})

describe('getSecretOAuthValue with template/reference secrets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should resolve template secret before getting value', async () => {
    const templateSecret = {
      id: 'template-secret-id',
      type: 'template',
      config: {
        template: 'google-mail',
      },
      value: tryStringify({
        accessToken: 'template-access-token',
        refreshToken: 'template-refresh-token',
      }),
    }

    revealSecretInstanceFromTemplateSecret.mockResolvedValue({
      ...templateSecret,
      type: 'oauth',
    })

    const result = await getSecretOAuthValue(templateSecret)

    expect(result.accessToken).toBe('template-access-token')
    expect(result.refreshToken).toBe('template-refresh-token')
  })

  it('should resolve reference secret before getting value', async () => {
    const referenceSecret = {
      id: 'reference-secret-id',
      type: 'reference',
      config: {
        secretId: 'referenced-secret-id',
      },
      value: tryStringify({
        accessToken: 'reference-access-token',
      }),
    }

    revealSecretInstanceFromReferenceSecret.mockResolvedValue({
      ...referenceSecret,
      type: 'oauth',
    })

    const result = await getSecretOAuthValue(referenceSecret)

    expect(result.accessToken).toBe('reference-access-token')
  })
})

describe('setSecretOAuthValue with template/reference secrets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should update the template secret ID, not the resolved template definition', async () => {
    const templateSecret = {
      id: 'user-template-secret-id',
      type: 'template',
      config: {
        template: 'google-mail',
      },
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    // @note the resolved secret has the same ID as the template secret
    // because revealSecretInstanceFromTemplateSecret spreads templateSecret first
    revealSecretInstanceFromTemplateSecret.mockResolvedValue({
      ...templateSecret,
      type: 'oauth',
      config: {
        clientId: 'template-client-id',
        tokenUrl: 'https://oauth2.googleapis.com/token',
      },
    })

    prisma.secret.update.mockResolvedValue({})

    await setSecretOAuthValue(templateSecret, {
      accessToken: 'new-access-token',
    })

    // @note verify we update the original template secret, not some other ID
    expect(prisma.secret.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-template-secret-id' },
      })
    )
  })

  it('should update the reference secret ID, not the referenced secret', async () => {
    const referenceSecret = {
      id: 'user-reference-secret-id',
      type: 'reference',
      config: {
        secretId: 'some-other-secret-id',
      },
      value: tryStringify({
        accessToken: 'old-access-token',
      }),
    }

    revealSecretInstanceFromReferenceSecret.mockResolvedValue({
      ...referenceSecret,
      type: 'oauth',
    })

    prisma.secret.update.mockResolvedValue({})

    await setSecretOAuthValue(referenceSecret, {
      accessToken: 'new-access-token',
    })

    // @note verify we update the original reference secret, not the referenced one
    expect(prisma.secret.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-reference-secret-id' },
      })
    )
  })
})

describe('getSecretOAuthValue reads from original secret value', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should read value from original template secret, not template definition', async () => {
    const templateSecret = {
      id: 'user-template-secret-id',
      type: 'template',
      config: {
        template: 'google-mail',
      },
      // @note this is the user's token stored on their secret
      value: tryStringify({
        accessToken: 'user-specific-token',
        refreshToken: 'user-specific-refresh',
      }),
    }

    // @note revealSecretInstanceFromTemplateSecret preserves templateSecret.value
    revealSecretInstanceFromTemplateSecret.mockResolvedValue({
      ...templateSecret,
      type: 'oauth',
      config: {
        clientId: 'template-client-id',
      },
      // @note value comes from templateSecret, not from template definition
      value: templateSecret.value,
    })

    const result = await getSecretOAuthValue(templateSecret)

    // @note verify we get the user's token, not some template default
    expect(result.accessToken).toBe('user-specific-token')
    expect(result.refreshToken).toBe('user-specific-refresh')
  })

  it('should preserve original value when resolved instance has different value field', async () => {
    const templateSecret = {
      id: 'user-template-secret-id',
      type: 'template',
      config: {
        template: 'google-mail',
      },
      value: tryStringify({
        accessToken: 'user-token',
      }),
    }

    // @note if resolved instance somehow had a different value, we should still
    // use what revealSecretInstanceFromTemplateSecret returns (which should be
    // templateSecret.value per the implementation)
    revealSecretInstanceFromTemplateSecret.mockResolvedValue({
      ...templateSecret,
      type: 'oauth',
      value: templateSecret.value,
    })

    const result = await getSecretOAuthValue(templateSecret)

    expect(result.accessToken).toBe('user-token')
  })
})

describe('getNewSecretOAuthValue merges with original secret value', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should merge new values with existing template secret values', async () => {
    const templateSecret = {
      id: 'user-template-secret-id',
      type: 'template',
      config: {
        template: 'google-mail',
      },
      value: tryStringify({
        accessToken: 'old-access-token',
        refreshToken: 'existing-refresh-token',
        accessTokenExpiresAt: 1000000,
      }),
    }

    revealSecretInstanceFromTemplateSecret.mockResolvedValue({
      ...templateSecret,
      type: 'oauth',
      value: templateSecret.value,
    })

    const result = await getNewSecretOAuthValue(templateSecret, {
      accessToken: 'new-access-token',
      accessTokenExpiresAt: 2000000,
    })

    const parsed = tryParse(result)

    // @note new values should override
    expect(parsed.accessToken).toBe('new-access-token')
    expect(parsed.accessTokenExpiresAt).toBe(2000000)

    // @note existing values should be preserved
    expect(parsed.refreshToken).toBe('existing-refresh-token')
  })
})

describe('updateSecretOAuthConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should update secret config in database', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'old-client-id',
        scope: 'read',
      },
    }

    const configUpdate = {
      clientId: 'new-client-id',
      clientSecret: 'new-client-secret',
    }

    prisma.secret.update.mockResolvedValue({})

    await updateSecretOAuthConfig(secret, configUpdate)

    expect(prisma.secret.update).toHaveBeenCalledWith({
      where: {
        id: 'test-secret-id',
      },
      data: {
        config: {
          clientId: 'new-client-id',
          scope: 'read',
          clientSecret: 'new-client-secret',
        },
      },
    })
  })

  it('should handle null config', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: null,
    }

    const configUpdate = {
      clientId: 'new-client-id',
    }

    prisma.secret.update.mockResolvedValue({})

    await updateSecretOAuthConfig(secret, configUpdate)

    expect(prisma.secret.update).toHaveBeenCalledWith({
      where: {
        id: 'test-secret-id',
      },
      data: {
        config: {
          clientId: 'new-client-id',
        },
      },
    })
  })
})

describe('performClientRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return config unchanged when self-registration not needed', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {},
    }

    const config = {
      clientId: 'existing-client-id',
      authorizationUrl: 'https://auth.example.com',
    }

    needsSelfRegistration.mockReturnValue(false)

    const result = await performClientRegistration(secret, config)

    expect(result).toEqual(config)
    expect(registerOAuthClient).not.toHaveBeenCalled()
  })

  it('should return config unchanged when no registration endpoint', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {},
    }

    const config = {
      resourceUrl: 'https://mcp.example.com',
    }

    needsSelfRegistration.mockReturnValue(true)

    const result = await performClientRegistration(secret, config)

    expect(result).toEqual(config)
    expect(registerOAuthClient).not.toHaveBeenCalled()
  })

  it('should register client and update secret config', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {},
    }

    const config = {
      resourceUrl: 'https://mcp.example.com',
      registrationEndpoint: 'https://auth.example.com/register',
      scope: 'read write',
    }

    needsSelfRegistration.mockReturnValue(true)
    registerOAuthClient.mockResolvedValue({
      success: true,
      clientId: 'registered-client-id',
      clientSecret: 'registered-client-secret',
    })
    prisma.secret.update.mockResolvedValue({})

    const result = await performClientRegistration(secret, config)

    expect(registerOAuthClient).toHaveBeenCalledWith({
      registrationEndpoint: 'https://auth.example.com/register',
      scope: 'read write',
    })
    expect(result.clientId).toBe('registered-client-id')
    expect(result.clientSecret).toBe('registered-client-secret')
    expect(result.requiresPkce).toBe(false)
  })

  it('should set requiresPkce when no client secret returned', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {},
    }

    const config = {
      registrationEndpoint: 'https://auth.example.com/register',
    }

    needsSelfRegistration.mockReturnValue(true)
    registerOAuthClient.mockResolvedValue({
      success: true,
      clientId: 'public-client-id',
    })
    prisma.secret.update.mockResolvedValue({})

    const result = await performClientRegistration(secret, config)

    expect(result.clientId).toBe('public-client-id')
    expect(result.clientSecret).toBeUndefined()
    expect(result.requiresPkce).toBe(true)
  })

  it('should throw error when registration fails', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {},
    }

    const config = {
      registrationEndpoint: 'https://auth.example.com/register',
    }

    needsSelfRegistration.mockReturnValue(true)
    registerOAuthClient.mockResolvedValue({
      success: false,
      error: 'invalid_request',
      errorDescription: 'Invalid registration request',
    })

    await expect(performClientRegistration(secret, config)).rejects.toThrow(
      'Invalid registration request'
    )
  })
})

describe('refreshSecretOAuthToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return false when no refresh token available', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        tokenUrl: 'https://auth.example.com/token',
      },
      value: tryStringify({
        accessToken: 'test-access-token',
      }),
    }

    const result = await refreshSecretOAuthToken(secret)

    expect(result).toBe(false)
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('should return false when missing required config', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {},
      value: tryStringify({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      }),
    }

    const result = await refreshSecretOAuthToken(secret)

    expect(result).toBe(false)
  })

  it('should refresh token and update secret value', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenUrl: 'https://auth.example.com/token',
      },
      value: tryStringify({
        accessToken: 'old-access-token',
        refreshToken: 'test-refresh-token',
      }),
    }

    refreshAccessToken.mockResolvedValue({
      accessToken: 'new-access-token',
      accessTokenExpiresAt: new Date('2024-12-31'),
      refreshToken: 'new-refresh-token',
    })
    prisma.secret.update.mockResolvedValue({})

    const result = await refreshSecretOAuthToken(secret)

    expect(result).toBe(true)
    expect(refreshAccessToken).toHaveBeenCalledWith('test-refresh-token', {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tokenUrl: 'https://auth.example.com/token',
    })
    expect(prisma.secret.update).toHaveBeenCalled()
  })

  it('should preserve old refresh token if new one not provided', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        tokenUrl: 'https://auth.example.com/token',
      },
      value: tryStringify({
        accessToken: 'old-access-token',
        refreshToken: 'old-refresh-token',
      }),
    }

    refreshAccessToken.mockResolvedValue({
      accessToken: 'new-access-token',
    })
    prisma.secret.update.mockResolvedValue({})

    const result = await refreshSecretOAuthToken(secret)

    expect(result).toBe(true)

    const updateCall = prisma.secret.update.mock.calls[0][0]
    const updatedValue = tryParse(updateCall.data.value)

    expect(updatedValue.refreshToken).toBe('old-refresh-token')
  })

  it('should return false when refresh fails', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        tokenUrl: 'https://auth.example.com/token',
      },
      value: tryStringify({
        refreshToken: 'test-refresh-token',
      }),
    }

    refreshAccessToken.mockRejectedValue(new Error('Token refresh failed'))

    const result = await refreshSecretOAuthToken(secret)

    expect(result).toBe(false)
  })

  it('should refresh token using discovered tokenUrl from resourceUrl', async () => {
    // @note this mimics the Sentry MCP scenario where config only has clientId and resourceUrl
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        resourceUrl: 'https://mcp.sentry.dev/',
      },
      value: tryStringify({
        accessToken: 'expired-access-token',
        accessTokenExpiresAt: Date.now() - 1000,
        refreshToken: 'test-refresh-token',
      }),
    }

    // mock OAuth discovery to return token URL
    discoverOAuthConfig.mockResolvedValue({
      authorizationUrl: 'https://mcp.sentry.dev/oauth/authorize',
      tokenUrl: 'https://mcp.sentry.dev/oauth/token',
      revokeUrl: 'https://mcp.sentry.dev/oauth/revoke',
    })

    refreshAccessToken.mockResolvedValue({
      accessToken: 'new-access-token',
      accessTokenExpiresAt: new Date(Date.now() + 3600000),
    })
    prisma.secret.update.mockResolvedValue({})

    const result = await refreshSecretOAuthToken(secret)

    expect(result).toBe(true)
    expect(discoverOAuthConfig).toHaveBeenCalledWith('https://mcp.sentry.dev/')
    expect(refreshAccessToken).toHaveBeenCalledWith('test-refresh-token', {
      clientId: 'test-client-id',
      clientSecret: undefined,
      tokenUrl: 'https://mcp.sentry.dev/oauth/token',
    })
  })
})

describe('isSecretOAuthTokenExpired', () => {
  it('should return true when no access token', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({}),
    }

    const result = await isSecretOAuthTokenExpired(secret)

    expect(result).toBe(true)
  })

  it('should return false when no expiration info', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'test-access-token',
      }),
    }

    const result = await isSecretOAuthTokenExpired(secret)

    expect(result).toBe(false)
  })

  it('should return true when token is expired', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'test-access-token',
        accessTokenExpiresAt: Date.now() - 1000,
      }),
    }

    const result = await isSecretOAuthTokenExpired(secret)

    expect(result).toBe(true)
  })

  it('should return true when token expires within buffer', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'test-access-token',
        accessTokenExpiresAt: Date.now() + 30000,
      }),
    }

    const result = await isSecretOAuthTokenExpired(secret, 60)

    expect(result).toBe(true)
  })

  it('should return false when token is valid', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: tryStringify({
        accessToken: 'test-access-token',
        accessTokenExpiresAt: Date.now() + 3600000,
      }),
    }

    const result = await isSecretOAuthTokenExpired(secret)

    expect(result).toBe(false)
  })
})

describe('getSecretOAuthAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return undefined when secret not found', async () => {
    prisma.secret.findUnique.mockResolvedValue(null)

    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      value: '',
    }

    const result = await getSecretOAuthAccessToken(secret)

    expect(result).toBeUndefined()
  })

  it('should return access token when not expired', async () => {
    const secret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {},
      value: tryStringify({
        accessToken: 'test-access-token',
        accessTokenExpiresAt: Date.now() + 3600000,
      }),
    }

    prisma.secret.findUnique.mockResolvedValue(secret)

    const result = await getSecretOAuthAccessToken(secret)

    expect(result).toBe('test-access-token')
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('should refresh and return new token when expired', async () => {
    const expiredSecret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        tokenUrl: 'https://auth.example.com/token',
      },
      value: tryStringify({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: Date.now() - 1000,
        refreshToken: 'test-refresh-token',
      }),
    }

    const refreshedSecret = {
      ...expiredSecret,
      value: tryStringify({
        accessToken: 'new-access-token',
        accessTokenExpiresAt: Date.now() + 3600000,
        refreshToken: 'test-refresh-token',
      }),
    }

    prisma.secret.findUnique
      .mockResolvedValueOnce(expiredSecret)
      .mockResolvedValueOnce(refreshedSecret)

    refreshAccessToken.mockResolvedValue({
      accessToken: 'new-access-token',
      accessTokenExpiresAt: new Date(Date.now() + 3600000),
    })
    prisma.secret.update.mockResolvedValue({})

    const result = await getSecretOAuthAccessToken(expiredSecret)

    expect(result).toBe('new-access-token')
    expect(refreshAccessToken).toHaveBeenCalled()
  })

  it('should return undefined when refresh fails', async () => {
    const expiredSecret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        tokenUrl: 'https://auth.example.com/token',
      },
      value: tryStringify({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: Date.now() - 1000,
        refreshToken: 'test-refresh-token',
      }),
    }

    prisma.secret.findUnique.mockResolvedValue(expiredSecret)
    refreshAccessToken.mockRejectedValue(new Error('Refresh failed'))

    const result = await getSecretOAuthAccessToken(expiredSecret)

    expect(result).toBeUndefined()
  })
})

/**
 * Secret Type Validation Tests
 *
 * These tests verify that OAuth functions properly validate the secret type
 * before processing. Invalid secret types should throw AssertionError.
 */
describe('Secret Type Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getSecretOAuthValue', () => {
    it('throws error when secret type is not oauth', async () => {
      const plainSecret = {
        id: 'test-secret-id',
        type: 'plain',
        value: '',
      }

      await expect(getSecretOAuthValue(plainSecret)).rejects.toThrow(
        /Expected secret type 'oauth', got 'plain'/
      )
    })

    it('accepts oauth secret type', async () => {
      const oauthSecret = {
        id: 'test-secret-id',
        type: 'oauth',
        value: tryStringify({ accessToken: 'test-token' }),
      }

      const result = await getSecretOAuthValue(oauthSecret)

      expect(result.accessToken).toBe('test-token')
    })
  })

  describe('getNewSecretOAuthValue', () => {
    it('throws error when secret type is not oauth', async () => {
      const plainSecret = {
        id: 'test-secret-id',
        type: 'plain',
        value: '',
      }

      await expect(
        getNewSecretOAuthValue(plainSecret, { accessToken: 'new-token' })
      ).rejects.toThrow(/Expected secret type 'oauth', got 'plain'/)
    })
  })

  describe('setSecretOAuthValue', () => {
    it('throws error when secret type is not oauth', async () => {
      const plainSecret = {
        id: 'test-secret-id',
        type: 'plain',
        value: '',
      }

      await expect(
        setSecretOAuthValue(plainSecret, { accessToken: 'new-token' })
      ).rejects.toThrow(/Expected secret type 'oauth', got 'plain'/)
    })
  })
})

describe.skip('Race Condition in Token Refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // @todo add locking to prevent concurrent refresh operations

  it('should prevent concurrent refreshes', async () => {
    const expiredSecret = {
      id: 'test-secret-id',
      type: 'oauth',
      config: {
        clientId: 'test-client-id',
        tokenUrl: 'https://auth.example.com/token',
      },
      value: tryStringify({
        accessToken: 'old-access-token',
        accessTokenExpiresAt: Date.now() - 1000,
        refreshToken: 'test-refresh-token',
      }),
    }

    let refreshCallCount = 0

    prisma.secret.findUnique.mockResolvedValue(expiredSecret)
    refreshAccessToken.mockImplementation(async () => {
      refreshCallCount++
      // Simulate delay
      await new Promise((resolve) => setTimeout(resolve, 10))

      return {
        accessToken: `new-access-token-${refreshCallCount}`,
        accessTokenExpiresAt: new Date(Date.now() + 3600000),
      }
    })
    prisma.secret.update.mockResolvedValue({})

    // Simulate concurrent calls

    const [result1, result2] = await Promise.all([
      getSecretOAuthAccessToken(expiredSecret),
      getSecretOAuthAccessToken(expiredSecret),
    ])

    // WEAKNESS: Both calls trigger refresh, increasing refreshCallCount > 1
    // This test documents the weakness - ideally only 1 refresh should occur

    expect(refreshCallCount).toBeGreaterThan(1)
  })
})
