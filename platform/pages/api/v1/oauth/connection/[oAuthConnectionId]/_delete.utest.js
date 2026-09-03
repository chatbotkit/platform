/**
 * @jest-environment node
 */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './delete'

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

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  notAuthorized: () => ({ status: 403 }),
  notFound: () => ({ status: 404 }),
  ok: (data) => ({ status: 200, body: data }),
}))

describe('POST /api/v1/oauth/connection/[oAuthConnectionId]/delete', () => {
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
    })

    prisma.oAuthConnection.delete.mockResolvedValue({ id: 'oauth-123' })
  })

  it('should delete the connection and return its id', async () => {
    const result = await handler(
      { query: { oAuthConnectionId: 'oauth-123' } },
      mockSession
    )

    expect(prisma.oAuthConnection.delete).toHaveBeenCalledWith({
      where: { id: 'oauth-123' },
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ id: 'oauth-123' })
  })

  it('should return 404 when the connection does not exist', async () => {
    prisma.oAuthConnection.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      { query: { oAuthConnectionId: 'missing-oauth' } },
      mockSession
    )

    expect(prisma.oAuthConnection.delete).not.toHaveBeenCalled()
    expect(result.status).toBe(404)
  })

  it('should return 403 when the connection belongs to a different user', async () => {
    prisma.oAuthConnection.findUniqueByIdentifier.mockResolvedValue({
      id: 'oauth-123',
      userId: 'other-user',
    })

    const result = await handler(
      { query: { oAuthConnectionId: 'oauth-123' } },
      mockSession
    )

    expect(prisma.oAuthConnection.delete).not.toHaveBeenCalled()
    expect(result.status).toBe(403)
  })
})
