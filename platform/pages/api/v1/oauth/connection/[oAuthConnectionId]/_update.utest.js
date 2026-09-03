/**
 * @jest-environment node
 */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './update'

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((_meta, existingMeta) => existingMeta),
}))

jest.mock('@/lib/response', () => ({
  notAuthorized: () => ({ status: 403 }),
  notFound: () => ({ status: 404 }),
  ok: (data) => ({ status: 200, body: data }),
}))

describe('POST /api/v1/oauth/connection/[oAuthConnectionId]/update', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    prisma.oAuthConnection.findUniqueByIdentifier.mockResolvedValue({
      id: 'oauth-123',
      userId: 'user-123',
      meta: { existing: true },
    })
  })

  it('should accept blank configuration fields in the request body', async () => {
    await expect(
      bodySchema.validateAsync({
        issuer: '',
        clientId: '',
        clientSecret: '',
      })
    ).resolves.toBeDefined()
  })

  it('should normalize blank credential fields to null when updating the resource', async () => {
    const result = await handler(
      { query: { oAuthConnectionId: 'oauth-123' } },
      mockSession,
      {
        issuer: '',
        clientId: '',
        clientSecret: '',
      }
    )

    expect(result.status).toBe(200)
    expect(prisma.oAuthConnection.update).toHaveBeenCalledWith({
      where: {
        id: 'oauth-123',
      },
      data: expect.objectContaining({
        issuer: null,
        clientId: null,
        clientSecret: null,
      }),
    })
  })

  it('should leave clientSecret untouched when the mask sentinel is echoed back', async () => {
    const result = await handler(
      { query: { oAuthConnectionId: 'oauth-123' } },
      mockSession,
      {
        clientId: 'client-id',
        clientSecret: '********',
      }
    )

    expect(result.status).toBe(200)

    const { data } = prisma.oAuthConnection.update.mock.calls[0][0]

    // undefined means prisma will not update the column
    expect(data.clientSecret).toBeUndefined()
    expect(data.clientId).toBe('client-id')
  })

  it('should store a new clientSecret when a real value is provided', async () => {
    await handler({ query: { oAuthConnectionId: 'oauth-123' } }, mockSession, {
      clientSecret: 'rotated-secret',
    })

    expect(prisma.oAuthConnection.update.mock.calls[0][0].data.clientSecret).toBe(
      'rotated-secret'
    )
  })

  it('should return 404 when the connection does not exist', async () => {
    prisma.oAuthConnection.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      { query: { oAuthConnectionId: 'missing-oauth' } },
      mockSession,
      { name: 'Updated Name' }
    )

    expect(prisma.oAuthConnection.update).not.toHaveBeenCalled()
    expect(result.status).toBe(404)
  })

  it('should return 403 when the connection belongs to a different user', async () => {
    prisma.oAuthConnection.findUniqueByIdentifier.mockResolvedValue({
      id: 'oauth-123',
      userId: 'other-user',
      meta: {},
    })

    const result = await handler(
      { query: { oAuthConnectionId: 'oauth-123' } },
      mockSession,
      { name: 'Updated Name' }
    )

    expect(prisma.oAuthConnection.update).not.toHaveBeenCalled()
    expect(result.status).toBe(403)
  })

  it('should merge meta using getMeta and return the connection id', async () => {
    const { getMeta } = require('@/lib/meta')

    getMeta.mockReturnValue({ existing: true, new: true })

    prisma.oAuthConnection.update.mockResolvedValue({ id: 'oauth-123' })

    const result = await handler(
      { query: { oAuthConnectionId: 'oauth-123' } },
      mockSession,
      { meta: { new: true } }
    )

    expect(getMeta).toHaveBeenCalledWith({ new: true }, { existing: true })
    expect(prisma.oAuthConnection.update).toHaveBeenCalledWith({
      where: { id: 'oauth-123' },
      data: expect.objectContaining({
        meta: { existing: true, new: true },
      }),
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ id: 'oauth-123' })
  })
})
