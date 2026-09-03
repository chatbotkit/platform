/**
 * @jest-environment node
 */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { USER_AUDIENCE } from '@/lib/audience.consts'

import handler from './fetch'

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((obj) => obj),
}))

jest.mock('@/lib/response', () => ({
  notAuthorized: () => ({ status: 403 }),
  notFound: () => ({ status: 404 }),
  ok: (data) => ({ status: 200, body: data }),
}))

describe('GET /api/v1/oauth/connection/[oAuthConnectionId]/fetch', () => {
  const baseConnection = {
    id: 'oauth-123',
    name: 'My OAuth',
    description: 'Description',
    userId: 'user-123',
    blueprintId: null,
    issuer: 'https://accounts.example.com',
    clientId: 'client-id',
    clientSecret: 'secret-value',
    scopes: 'openid email profile',
    allowedDomains: null,
    requiredClaims: null,
    meta: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  beforeEach(() => {
    mockReset(prisma)

    // Return a fresh copy each time so handler's `delete userId` doesn't
    // mutate across tests.
    prisma.oAuthConnection.findUniqueByIdentifier.mockResolvedValue({
      ...baseConnection,
    })
  })

  it('should return clientSecret as the mask sentinel for user audience sessions', async () => {
    const session = {
      user: { id: 'user-123' },
      payload: { aud: USER_AUDIENCE },
    }

    const result = await handler(
      { query: { oAuthConnectionId: 'oauth-123' } },
      session
    )

    expect(prisma.oAuthConnection.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'oauth-123',
      expect.objectContaining({
        select: expect.objectContaining({ clientSecret: true }),
      })
    )
    expect(result.status).toBe(200)
    expect(result.body.clientSecret).toBe('********')
    expect(result.body.clientId).toBe('client-id')
    expect(result.body).not.toHaveProperty('userId')
  })

  it('should return clientSecret as the mask sentinel for non-user audience sessions', async () => {
    const session = {
      user: { id: 'user-123' },
      payload: { aud: 'api-key' },
    }

    const result = await handler(
      { query: { oAuthConnectionId: 'oauth-123' } },
      session
    )

    expect(result.status).toBe(200)
    expect(result.body.clientSecret).toBe('********')
  })

  it('should return clientSecret as null when not configured', async () => {
    prisma.oAuthConnection.findUniqueByIdentifier.mockResolvedValue({
      ...baseConnection,
      clientSecret: null,
    })

    const result = await handler(
      { query: { oAuthConnectionId: 'oauth-123' } },
      { user: { id: 'user-123' }, payload: { aud: USER_AUDIENCE } }
    )

    expect(result.status).toBe(200)
    expect(result.body.clientSecret).toBeNull()
  })

  it('should return 404 when the connection does not exist', async () => {
    prisma.oAuthConnection.findUniqueByIdentifier.mockResolvedValue(null)

    const session = {
      user: { id: 'user-123' },
      payload: { aud: USER_AUDIENCE },
    }

    const result = await handler(
      { query: { oAuthConnectionId: 'missing-oauth' } },
      session
    )

    expect(result.status).toBe(404)
  })

  it('should return 403 when the connection belongs to a different user', async () => {
    prisma.oAuthConnection.findUniqueByIdentifier.mockResolvedValue({
      ...baseConnection,
      userId: 'other-user',
    })

    const session = {
      user: { id: 'user-123' },
      payload: { aud: USER_AUDIENCE },
    }

    const result = await handler(
      { query: { oAuthConnectionId: 'oauth-123' } },
      session
    )

    expect(result.status).toBe(403)
  })
})
