/**
 * @jest-environment node
 */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

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

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/filter', () => ({
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getMetaQueryFilter: jest.fn(() => []),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/oauth/connection/list', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  it('should list OAuth connections for the authenticated user', async () => {
    const mockConnections = [
      {
        id: 'oauth-1',
        name: 'Connection A',
        description: 'First connection',
        blueprintId: null,
        issuer: 'https://accounts.example.com',
        clientId: 'client-id-a',
        scopes: 'openid email profile',
        allowedDomains: null,
        requiredClaims: null,
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ]

    prisma.oAuthConnection.findMany.mockResolvedValue(mockConnections)

    const result = await handler(null, {}, null, mockSession)

    expect(prisma.oAuthConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ userId: 'user-123' }]),
        }),
      })
    )
    expect(result).toEqual({ items: mockConnections })
  })

  it('should return an empty list when no connections exist', async () => {
    prisma.oAuthConnection.findMany.mockResolvedValue([])

    const result = await handler(null, {}, null, mockSession)

    expect(result).toEqual({ items: [] })
  })

  it('should not expose clientSecret in the list response', async () => {
    prisma.oAuthConnection.findMany.mockResolvedValue([])

    await handler(null, {}, null, mockSession)

    expect(prisma.oAuthConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ clientSecret: true }),
      })
    )
  })
})
