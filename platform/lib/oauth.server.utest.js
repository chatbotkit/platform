/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { digestCredential } from '@/lib/credential.digest'
import memcache from '@/lib/memcache'

import {
  Request,
  Response,
  errorToResponse,
  getNextApiRequest,
  getNextApiResponse,
  getValidatedRedirectUri,
  oauth2,
  responseToResponse,
} from './oauth.server'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}))

describe('oauth.server', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('oauth2 model', () => {
    describe('generateAccessToken', () => {
      it('should generate access token with correct prefix', async () => {
        const token = await oauth2.options.model.generateAccessToken({}, {}, [])

        expect(token).toMatch(/^oaac-[a-f0-9]{64}$/)
      })

      it('should generate unique tokens', async () => {
        const token1 = await oauth2.options.model.generateAccessToken(
          {},
          {},
          []
        )
        const token2 = await oauth2.options.model.generateAccessToken(
          {},
          {},
          []
        )

        expect(token1).not.toBe(token2)
      })
    })

    describe('generateRefreshToken', () => {
      it('should generate refresh token with correct prefix', async () => {
        const token = await oauth2.options.model.generateRefreshToken(
          {},
          {},
          []
        )

        expect(token).toMatch(/^oart-[a-f0-9]{64}$/)
      })

      it('should generate unique tokens', async () => {
        const token1 = await oauth2.options.model.generateRefreshToken(
          {},
          {},
          []
        )
        const token2 = await oauth2.options.model.generateRefreshToken(
          {},
          {},
          []
        )

        expect(token1).not.toBe(token2)
      })
    })

    describe('getClient', () => {
      it('should return null for empty clientId', async () => {
        const result = await oauth2.options.model.getClient('')

        expect(result).toBeNull()
        expect(prisma.oAuthApplication.findUnique).not.toHaveBeenCalled()
      })

      it('should return null when application not found', async () => {
        prisma.oAuthApplication.findUnique.mockResolvedValue(null)

        const result = await oauth2.options.model.getClient('test-client')

        expect(result).toBeNull()
        expect(prisma.oAuthApplication.findUnique).toHaveBeenCalledWith({
          where: { clientId: 'test-client' },
        })
      })

      it('should return null when clientSecret does not match', async () => {
        prisma.oAuthApplication.findUnique.mockResolvedValue({
          clientId: 'test-client',
          clientSecret: 'correct-secret',
          redirectUris: ['https://example.com/callback'],
          grants: ['authorization_code'],
          accessTokenLifetime: 3600,
          refreshTokenLifetime: 86400,
        })

        const result = await oauth2.options.model.getClient(
          'test-client',
          'wrong-secret'
        )

        expect(result).toBeNull()
      })

      it('should return client when found without secret check', async () => {
        prisma.oAuthApplication.findUnique.mockResolvedValue({
          clientId: 'test-client',
          clientSecret: 'secret',
          redirectUris: ['https://example.com/callback'],
          grants: ['authorization_code'],
          accessTokenLifetime: 3600,
          refreshTokenLifetime: 86400,
        })

        const result = await oauth2.options.model.getClient('test-client')

        expect(result).toEqual({
          id: 'test-client',
          redirectUris: ['https://example.com/callback'],
          grants: ['authorization_code'],
          accessTokenLifetime: 3600,
          refreshTokenLifetime: 86400,
        })
      })

      it('should return client when secret matches', async () => {
        prisma.oAuthApplication.findUnique.mockResolvedValue({
          clientId: 'test-client',
          clientSecret: await digestCredential('correct-secret'),
          redirectUris: ['https://example.com/callback'],
          grants: ['authorization_code'],
          accessTokenLifetime: 3600,
          refreshTokenLifetime: 86400,
        })

        const result = await oauth2.options.model.getClient(
          'test-client',
          'correct-secret'
        )

        expect(result).toEqual({
          id: 'test-client',
          redirectUris: ['https://example.com/callback'],
          grants: ['authorization_code'],
          accessTokenLifetime: 3600,
          refreshTokenLifetime: 86400,
        })
      })

      it('should handle zero lifetime values', async () => {
        prisma.oAuthApplication.findUnique.mockResolvedValue({
          clientId: 'test-client',
          clientSecret: 'secret',
          redirectUris: ['https://example.com/callback'],
          grants: ['authorization_code'],
          accessTokenLifetime: 0,
          refreshTokenLifetime: 0,
        })

        const result = await oauth2.options.model.getClient('test-client')

        expect(result.accessTokenLifetime).toBeUndefined()
        expect(result.refreshTokenLifetime).toBeUndefined()
      })
    })

    describe('getUser', () => {
      it('should return null for password grant', async () => {
        const result = await oauth2.options.model.getUser('user', 'pass')

        expect(result).toBeNull()
      })
    })

    describe('getAccessToken', () => {
      it('should return null when token not found', async () => {
        prisma.oAuthApplicationToken.findUnique.mockResolvedValue(null)

        const result =
          await oauth2.options.model.getAccessToken('invalid-token')

        expect(result).toBeNull()
      })

      it('should return null when token has no accessToken field', async () => {
        prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
          id: 'token-id',
          accessToken: null,
          userId: 'user-id',
          application: {
            id: 'database-id',
            clientId: 'client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
        })

        const result = await oauth2.options.model.getAccessToken('token')

        expect(result).toBeNull()
      })

      it('should delete and return null when token expired', async () => {
        const expiredDate = new Date(Date.now() - 1000)

        prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
          id: 'token-id',
          accessToken: 'access-token',
          accessTokenExpiresAt: expiredDate,
          userId: 'user-id',
          application: {
            id: 'database-id',
            clientId: 'client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
        })

        const result = await oauth2.options.model.getAccessToken('access-token')

        expect(result).toBeNull()
        expect(prisma.oAuthApplicationToken.delete).toHaveBeenCalledWith({
          where: { id: 'token-id' },
        })
      })

      it('should return valid token', async () => {
        const futureDate = new Date(Date.now() + 3600000)

        prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
          id: 'token-id',
          accessToken: await digestCredential('access-token'),
          accessTokenExpiresAt: futureDate,
          refreshToken: await digestCredential('refresh-token'),
          refreshTokenExpiresAt: futureDate,
          userId: 'user-id',
          application: {
            id: 'database-id',
            clientId: 'client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
        })

        const result = await oauth2.options.model.getAccessToken('access-token')

        expect(result).toEqual({
          accessToken: 'access-token',
          accessTokenExpiresAt: futureDate,
          client: {
            id: 'client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
          user: {
            id: 'user-id',
          },
        })
        expect(prisma.oAuthApplicationToken.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              accessToken: await digestCredential('access-token'),
            },
          })
        )
      })

      it('should expose the public client id instead of the database id', async () => {
        prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
          id: 'token-id',
          accessToken: 'access-token',
          userId: 'user-id',
          scopes: ['read'],
          application: {
            id: 'database-id',
            clientId: 'public-client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
        })

        const result = await oauth2.options.model.getAccessToken('access-token')

        expect(result.client.id).toBe('public-client-id')
        expect(result.scope).toEqual(['read'])
      })
    })

    describe('getRefreshToken', () => {
      it('should return null when token not found', async () => {
        prisma.oAuthApplicationToken.findUnique.mockResolvedValue(null)

        const result =
          await oauth2.options.model.getRefreshToken('invalid-token')

        expect(result).toBeNull()
      })

      it('should return null when token has no refreshToken field', async () => {
        prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
          id: 'token-id',
          refreshToken: null,
          userId: 'user-id',
          application: {
            id: 'client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
        })

        const result = await oauth2.options.model.getRefreshToken('token')

        expect(result).toBeNull()
      })

      it('should delete and return null when refresh token expired', async () => {
        const expiredDate = new Date(Date.now() - 1000)

        prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
          id: 'token-id',
          refreshToken: 'refresh-token',
          refreshTokenExpiresAt: expiredDate,
          userId: 'user-id',
          application: {
            id: 'client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
        })

        const result =
          await oauth2.options.model.getRefreshToken('refresh-token')

        expect(result).toBeNull()
        expect(prisma.oAuthApplicationToken.delete).toHaveBeenCalledWith({
          where: { id: 'token-id' },
        })
      })

      it('should return valid refresh token', async () => {
        const futureDate = new Date(Date.now() + 3600000)

        prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
          id: 'token-id',
          refreshToken: await digestCredential('refresh-token'),
          refreshTokenExpiresAt: futureDate,
          userId: 'user-id',
          application: {
            id: 'database-id',
            clientId: 'client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
        })

        const result =
          await oauth2.options.model.getRefreshToken('refresh-token')

        expect(result).toEqual({
          refreshToken: 'refresh-token',
          client: {
            id: 'client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
          user: {
            id: 'user-id',
          },
        })
        expect(prisma.oAuthApplicationToken.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              refreshToken: await digestCredential('refresh-token'),
            },
          })
        )
      })

      it('should return the public client id and stored scope', async () => {
        prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
          id: 'token-id',
          refreshToken: 'refresh-token',
          userId: 'user-id',
          scopes: ['read', 'write'],
          application: {
            id: 'database-id',
            clientId: 'public-client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
        })

        const result =
          await oauth2.options.model.getRefreshToken('refresh-token')

        expect(result.client.id).toBe('public-client-id')
        expect(result.scope).toEqual(['read', 'write'])
      })
    })

    describe('revokeToken', () => {
      it('should rotate a refresh token by deleting its stored grant', async () => {
        prisma.oAuthApplicationToken.deleteMany.mockResolvedValue({ count: 1 })

        const result = await oauth2.options.model.revokeToken({
          refreshToken: 'refresh-token',
        })

        expect(result).toBe(true)
        expect(prisma.oAuthApplicationToken.deleteMany).toHaveBeenCalledWith({
          where: {
            refreshToken: await digestCredential('refresh-token'),
          },
        })
      })

      it('should reject a refresh token that no longer exists', async () => {
        prisma.oAuthApplicationToken.deleteMany.mockResolvedValue({ count: 0 })

        await expect(
          oauth2.options.model.revokeToken({ refreshToken: 'refresh-token' })
        ).resolves.toBe(false)
      })
    })

    describe('saveToken', () => {
      it('should save token and return result', async () => {
        const token = {
          accessToken: 'access-token',
          accessTokenExpiresAt: new Date(),
          refreshToken: 'refresh-token',
          refreshTokenExpiresAt: new Date(),
          scope: ['read', 'write'],
        }

        const client = {
          id: 'client-id',
          grants: ['authorization_code'],
          redirectUris: ['https://example.com/callback'],
        }

        const user = {
          id: 'user-id',
        }

        prisma.oAuthApplicationToken.create.mockResolvedValue({})

        const result = await oauth2.options.model.saveToken(token, client, user)

        expect(prisma.oAuthApplicationToken.create).toHaveBeenCalledWith({
          data: {
            accessToken: await digestCredential('access-token'),
            accessTokenExpiresAt: token.accessTokenExpiresAt,
            refreshToken: await digestCredential('refresh-token'),
            refreshTokenExpiresAt: token.refreshTokenExpiresAt,
            scopes: ['read', 'write'],
            user: {
              connect: { id: 'user-id' },
            },
            application: {
              connect: { clientId: 'client-id' },
            },
          },
        })

        expect(result).toEqual({
          accessToken: 'access-token',
          accessTokenExpiresAt: token.accessTokenExpiresAt,
          refreshToken: 'refresh-token',
          refreshTokenExpiresAt: token.refreshTokenExpiresAt,
          client: {
            id: 'client-id',
            grants: ['authorization_code'],
            redirectUris: ['https://example.com/callback'],
          },
          user: {
            id: 'user-id',
          },
        })
      })

      it('should handle string scope', async () => {
        const token = {
          accessToken: 'access-token',
          accessTokenExpiresAt: new Date(),
          scope: 'read',
        }

        const client = { id: 'client-id' }
        const user = { id: 'user-id' }

        prisma.oAuthApplicationToken.create.mockResolvedValue({})

        await oauth2.options.model.saveToken(token, client, user)

        expect(prisma.oAuthApplicationToken.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              scopes: ['read'],
            }),
          })
        )
      })

      it('should handle empty scope', async () => {
        const token = {
          accessToken: 'access-token',
          accessTokenExpiresAt: new Date(),
        }

        const client = { id: 'client-id' }
        const user = { id: 'user-id' }

        prisma.oAuthApplicationToken.create.mockResolvedValue({})

        await oauth2.options.model.saveToken(token, client, user)

        expect(prisma.oAuthApplicationToken.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              scopes: [],
            }),
          })
        )
      })
    })

    describe('getAuthorizationCode', () => {
      it('should return null for empty code', async () => {
        const result = await oauth2.options.model.getAuthorizationCode('')

        expect(result).toBeNull()
        expect(memcache.get).not.toHaveBeenCalled()
      })

      it('should return null when code not found in cache', async () => {
        memcache.get.mockResolvedValue(null)

        const result =
          await oauth2.options.model.getAuthorizationCode('test-code')

        expect(result).toBeNull()
        expect(memcache.get).toHaveBeenCalledWith(
          'oauth:authorization-code:test-code'
        )
      })

      it('should delete and return null when code expired', async () => {
        const expiredTime = Date.now() - 1000

        memcache.get.mockResolvedValue({
          token: 'test-code',
          redirectUri: 'https://example.com/callback',
          scope: ['read'],
          expiresAt: expiredTime,
          client: {
            id: 'client-id',
            grants: ['authorization_code'],
          },
          user: {
            id: 'user-id',
          },
        })

        memcache.del.mockResolvedValue(1)

        const result =
          await oauth2.options.model.getAuthorizationCode('test-code')

        expect(result).toBeNull()
        expect(memcache.del).toHaveBeenCalledWith(
          'oauth:authorization-code:test-code'
        )
      })

      it('should return valid authorization code', async () => {
        const futureTime = Date.now() + 300000

        memcache.get.mockResolvedValue({
          token: 'test-code',
          redirectUri: 'https://example.com/callback',
          scope: ['read', 'write'],
          expiresAt: futureTime,
          client: {
            id: 'client-id',
            grants: ['authorization_code'],
          },
          user: {
            id: 'user-id',
          },
        })

        const result =
          await oauth2.options.model.getAuthorizationCode('test-code')

        expect(result).toEqual({
          authorizationCode: 'test-code',
          redirectUri: 'https://example.com/callback',
          scope: ['read', 'write'],
          expiresAt: new Date(futureTime),
          client: {
            id: 'client-id',
            grants: ['authorization_code'],
          },
          user: {
            id: 'user-id',
          },
        })
      })
    })

    describe('saveAuthorizationCode', () => {
      it('should save authorization code to cache', async () => {
        const expiresAt = new Date(Date.now() + 300000)

        const authorizationCode = {
          authorizationCode: 'test-code',
          expiresAt,
          redirectUri: 'https://example.com/callback',
          scope: ['read', 'write'],
        }

        const client = {
          id: 'client-id',
          grants: ['authorization_code'],
        }

        const user = {
          id: 'user-id',
        }

        memcache.set.mockResolvedValue('OK')

        const result = await oauth2.options.model.saveAuthorizationCode(
          authorizationCode,
          client,
          user
        )

        expect(memcache.set).toHaveBeenCalledWith(
          'oauth:authorization-code:test-code',
          {
            token: 'test-code',
            redirectUri: 'https://example.com/callback',
            scope: ['read', 'write'],
            expiresAt: expiresAt.getTime(),
            user: { id: 'user-id' },
            client: { id: 'client-id', grants: ['authorization_code'] },
          },
          {
            ex: expect.any(Number),
          }
        )

        expect(result).toEqual({
          authorizationCode: 'test-code',
          expiresAt,
          redirectUri: 'https://example.com/callback',
          scope: ['read', 'write'],
          client: {
            id: 'client-id',
            grants: ['authorization_code'],
          },
          user: {
            id: 'user-id',
          },
        })
      })

      it('should handle string scope', async () => {
        const authorizationCode = {
          authorizationCode: 'test-code',
          expiresAt: new Date(Date.now() + 300000),
          redirectUri: 'https://example.com/callback',
          scope: 'read',
        }

        const client = { id: 'client-id', grants: ['authorization_code'] }
        const user = { id: 'user-id' }

        memcache.set.mockResolvedValue('OK')

        await oauth2.options.model.saveAuthorizationCode(
          authorizationCode,
          client,
          user
        )

        expect(memcache.set).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            scope: ['read'],
          }),
          expect.any(Object)
        )
      })

      it('should handle empty scope', async () => {
        const authorizationCode = {
          authorizationCode: 'test-code',
          expiresAt: new Date(Date.now() + 300000),
          redirectUri: 'https://example.com/callback',
        }

        const client = { id: 'client-id', grants: ['authorization_code'] }
        const user = { id: 'user-id' }

        memcache.set.mockResolvedValue('OK')

        await oauth2.options.model.saveAuthorizationCode(
          authorizationCode,
          client,
          user
        )

        expect(memcache.set).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            scope: [],
          }),
          expect.any(Object)
        )
      })
    })

    describe('revokeAuthorizationCode', () => {
      it('should delete code from cache and return true', async () => {
        memcache.del.mockResolvedValue(1)

        const result = await oauth2.options.model.revokeAuthorizationCode({
          authorizationCode: 'test-code',
        })

        expect(result).toBe(true)
        expect(memcache.del).toHaveBeenCalledWith(
          'oauth:authorization-code:test-code'
        )
      })

      it('should return false when code not found', async () => {
        memcache.del.mockResolvedValue(0)

        const result = await oauth2.options.model.revokeAuthorizationCode({
          authorizationCode: 'test-code',
        })

        expect(result).toBe(false)
      })
    })

    describe('validateScope', () => {
      it('should refuse any requested scope', async () => {
        const result = await oauth2.options.model.validateScope(
          { id: 'user' },
          { id: 'client' },
          ['read', 'write']
        )

        expect(result).toBe(false)
      })

      it('should return empty array for undefined scope', async () => {
        const result = await oauth2.options.model.validateScope(
          { id: 'user' },
          { id: 'client' },
          undefined
        )

        expect(result).toEqual([])
      })

      it('should return empty array for empty scope', async () => {
        const result = await oauth2.options.model.validateScope(
          { id: 'user' },
          { id: 'client' },
          []
        )

        expect(result).toEqual([])
      })
    })

    describe('verifyScope', () => {
      it('should always return true', async () => {
        const result = await oauth2.options.model.verifyScope(
          { accessToken: 'token' },
          ['read']
        )

        expect(result).toBe(true)
      })
    })
  })

  describe('refresh token grant', () => {
    it('should rotate a stored refresh token through the real OAuth library', async () => {
      prisma.oAuthApplication.findUnique.mockResolvedValue({
        id: 'database-id',
        clientId: 'public-client-id',
        clientSecret: await digestCredential('client-secret'),
        redirectUris: ['https://example.com/callback'],
        grants: ['authorization_code', 'refresh_token'],
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
      })
      prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
        id: 'old-token-id',
        refreshToken: await digestCredential('old-refresh-token'),
        refreshTokenExpiresAt: new Date(Date.now() + 3600000),
        userId: 'user-id',
        scopes: ['read'],
        application: {
          id: 'database-id',
          clientId: 'public-client-id',
          grants: ['authorization_code', 'refresh_token'],
          redirectUris: ['https://example.com/callback'],
        },
      })
      prisma.oAuthApplicationToken.deleteMany.mockResolvedValue({ count: 1 })
      prisma.oAuthApplicationToken.create.mockResolvedValue({})

      const request = new Request({
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': '1',
        },
        query: {},
        body: {
          grant_type: 'refresh_token',
          refresh_token: 'old-refresh-token',
          client_id: 'public-client-id',
        },
      })
      const response = new Response({})

      const result = await oauth2.token(request, response, {
        requireClientAuthentication: { refresh_token: false },
      })

      expect(result.accessToken).toMatch(/^oaac-/)
      expect(result.refreshToken).toMatch(/^oart-/)
      expect(prisma.oAuthApplicationToken.deleteMany).toHaveBeenCalledWith({
        where: {
          refreshToken: await digestCredential('old-refresh-token'),
        },
      })
      expect(prisma.oAuthApplicationToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scopes: ['read'],
          application: {
            connect: { clientId: 'public-client-id' },
          },
        }),
      })
    })
  })

  describe('authorization code grant', () => {
    it('exchanges a stored code through the real OAuth library', async () => {
      prisma.oAuthApplication.findUnique.mockResolvedValue({
        id: 'database-id',
        clientId: 'public-client-id',
        clientSecret: await digestCredential('client-secret'),
        redirectUris: ['https://example.com/callback'],
        grants: ['authorization_code', 'refresh_token'],
        accessTokenLifetime: 3600,
        refreshTokenLifetime: 86400,
      })
      memcache.get.mockResolvedValue({
        token: 'authorization-code',
        redirectUri: 'https://example.com/callback',
        scope: [],
        expiresAt: Date.now() + 300000,
        client: {
          id: 'public-client-id',
          grants: ['authorization_code', 'refresh_token'],
          redirectUris: ['https://example.com/callback'],
        },
        user: { id: 'user-id' },
      })
      memcache.del.mockResolvedValue(1)
      prisma.oAuthApplicationToken.create.mockResolvedValue({})

      const request = new Request({
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': '1',
        },
        query: {},
        body: {
          grant_type: 'authorization_code',
          code: 'authorization-code',
          client_id: 'public-client-id',
          client_secret: 'client-secret',
          redirect_uri: 'https://example.com/callback',
        },
      })
      const response = new Response({})

      const result = await oauth2.token(request, response)

      expect(result.accessToken).toMatch(/^oaac-/)
      expect(result.refreshToken).toMatch(/^oart-/)
      expect(memcache.del).toHaveBeenCalledWith(
        'oauth:authorization-code:authorization-code'
      )
      expect(prisma.oAuthApplicationToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scopes: [],
          application: {
            connect: { clientId: 'public-client-id' },
          },
        }),
      })
    })
  })

  describe('responseToResponse', () => {
    it('should convert OAuth2 response to Next.js response', async () => {
      const response = {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
        body: {
          access_token: 'token',
        },
      }

      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        end: jest.fn(),
      }

      await responseToResponse(response, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.setHeader).toHaveBeenCalledWith(
        'content-type',
        'application/json'
      )
      expect(res.setHeader).toHaveBeenCalledWith('cache-control', 'no-store')
      expect(res.end).toHaveBeenCalledWith(
        JSON.stringify({ access_token: 'token' })
      )
    })

    it('should handle response without body', async () => {
      const response = {
        status: 204,
        headers: {},
      }

      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        end: jest.fn(),
      }

      await responseToResponse(response, res)

      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.setHeader).toHaveBeenCalledWith('cache-control', 'no-store')
      expect(res.end).not.toHaveBeenCalled()
    })

    it('should use 200 as default status', async () => {
      const response = {
        headers: {},
        body: {},
      }

      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        end: jest.fn(),
      }

      await responseToResponse(response, res)

      expect(res.status).toHaveBeenCalledWith(200)
    })
  })

  describe('errorToResponse', () => {
    it('should handle redirect response', async () => {
      const error = new Error('Test error')

      error.name = 'TestError'

      const context = {
        response: {
          status: 302,
          headers: {
            location: 'https://example.com/callback',
          },
        },
        request: {
          query: {},
        },
      }

      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        end: jest.fn(),
      }

      await errorToResponse(error, res, context)

      expect(res.status).toHaveBeenCalledWith(302)
      expect(res.setHeader).toHaveBeenCalledWith('cache-control', 'no-store')
    })

    it('should redirect to a registered redirect_uri with error', async () => {
      const error = new Error('Invalid request')

      error.name = 'InvalidRequestError'

      prisma.oAuthApplication.findUnique.mockResolvedValue({
        clientId: 'client_123',
        redirectUris: ['https://example.com/callback'],
      })

      const context = {
        response: {
          status: 400,
        },
        request: {
          query: {
            client_id: 'client_123',
            redirect_uri: 'https://example.com/callback',
          },
        },
      }

      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        end: jest.fn(),
      }

      await errorToResponse(error, res, context)

      expect(res.status).toHaveBeenCalledWith(302)
      expect(res.setHeader).toHaveBeenCalledWith(
        'location',
        expect.stringContaining('https://example.com/callback')
      )
      expect(res.setHeader).toHaveBeenCalledWith(
        'location',
        expect.stringContaining('error=InvalidRequestError')
      )
      expect(res.setHeader).toHaveBeenCalledWith(
        'location',
        expect.stringContaining('error_description=Invalid+request')
      )
      expect(res.end).toHaveBeenCalled()
    })

    it('should return 400 for an unregistered redirect_uri', async () => {
      const error = new Error('Invalid request')

      prisma.oAuthApplication.findUnique.mockResolvedValue({
        clientId: 'client_123',
        redirectUris: ['https://example.com/callback'],
      })

      const context = {
        response: {
          status: 400,
        },
        request: {
          query: {
            client_id: 'client_123',
            redirect_uri: 'https://attacker.example.net/callback',
          },
        },
      }

      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        end: jest.fn(),
      }

      await errorToResponse(error, res, context)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.setHeader).not.toHaveBeenCalledWith(
        'location',
        expect.anything()
      )
      expect(res.end).toHaveBeenCalled()
    })

    it('should return 400 when the client is unknown', async () => {
      const error = new Error('Invalid request')

      prisma.oAuthApplication.findUnique.mockResolvedValue(null)

      const context = {
        response: {
          status: 400,
        },
        request: {
          query: {
            client_id: 'client_unknown',
            redirect_uri: 'https://example.com/callback',
          },
        },
      }

      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        end: jest.fn(),
      }

      await errorToResponse(error, res, context)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.setHeader).not.toHaveBeenCalledWith(
        'location',
        expect.anything()
      )
      expect(res.end).toHaveBeenCalled()
    })

    it('should return 400 when redirect_uri is present without client_id', async () => {
      const error = new Error('Invalid request')

      const context = {
        response: {
          status: 400,
        },
        request: {
          query: {
            redirect_uri: 'https://example.com/callback',
          },
        },
      }

      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        end: jest.fn(),
      }

      await errorToResponse(error, res, context)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(prisma.oAuthApplication.findUnique).not.toHaveBeenCalled()
      expect(res.end).toHaveBeenCalled()
    })

    it('should return 400 without redirect_uri', async () => {
      const error = new Error('Invalid request')

      const context = {
        response: {
          status: 400,
        },
        request: {
          query: {},
        },
      }

      const res = {
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        end: jest.fn(),
      }

      await errorToResponse(error, res, context)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.end).toHaveBeenCalled()
    })
  })

  describe('getValidatedRedirectUri', () => {
    it('should return the redirect uri when it is registered for the client', async () => {
      prisma.oAuthApplication.findUnique.mockResolvedValue({
        clientId: 'client_123',
        redirectUris: [
          'https://example.com/callback',
          'https://example.com/other',
        ],
      })

      const result = await getValidatedRedirectUri(
        'client_123',
        'https://example.com/callback'
      )

      expect(result).toBe('https://example.com/callback')
      expect(prisma.oAuthApplication.findUnique).toHaveBeenCalledWith({
        where: { clientId: 'client_123' },
      })
    })

    it('should return null for an unregistered redirect uri', async () => {
      prisma.oAuthApplication.findUnique.mockResolvedValue({
        clientId: 'client_123',
        redirectUris: ['https://example.com/callback'],
      })

      const result = await getValidatedRedirectUri(
        'client_123',
        'https://example.com/callback/extra'
      )

      expect(result).toBeNull()
    })

    it('should require an exact match rather than a prefix match', async () => {
      prisma.oAuthApplication.findUnique.mockResolvedValue({
        clientId: 'client_123',
        redirectUris: ['https://example.com/callback'],
      })

      const result = await getValidatedRedirectUri(
        'client_123',
        'https://example.com/callback?extra=1'
      )

      expect(result).toBeNull()
    })

    it('should return null when the client does not exist', async () => {
      prisma.oAuthApplication.findUnique.mockResolvedValue(null)

      const result = await getValidatedRedirectUri(
        'client_unknown',
        'https://example.com/callback'
      )

      expect(result).toBeNull()
    })

    it('should return null without touching the database when inputs are missing', async () => {
      expect(
        await getValidatedRedirectUri(undefined, 'https://example.com/callback')
      ).toBeNull()
      expect(await getValidatedRedirectUri('client_123', undefined)).toBeNull()
      expect(prisma.oAuthApplication.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('getNextApiRequest', () => {
    it('should create proxy with query from context', () => {
      const context = {
        req: {
          headers: { 'content-type': 'application/json' },
        },
        query: {
          code: 'test-code',
        },
      }

      const proxiedReq = getNextApiRequest(context)

      expect(proxiedReq.query).toEqual({ code: 'test-code' })
      expect(proxiedReq.headers).toEqual({
        'content-type': 'application/json',
      })
    })
  })

  describe('getNextApiResponse', () => {
    it('should create proxy with status method', () => {
      const context = {
        res: {
          statusCode: 200,
          setHeader: jest.fn(),
          end: jest.fn(),
        },
      }

      const proxiedRes = getNextApiResponse(context)

      const result = proxiedRes.status(201)

      expect(context.res.statusCode).toBe(201)
      expect(result).toBe(context.res)
    })

    it('should preserve original properties', () => {
      const context = {
        res: {
          statusCode: 200,
          setHeader: jest.fn(),
          end: jest.fn(),
        },
      }

      const proxiedRes = getNextApiResponse(context)

      expect(proxiedRes.setHeader).toBe(context.res.setHeader)
      expect(proxiedRes.end).toBe(context.res.end)
    })
  })
})
