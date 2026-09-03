/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

describe('/api/v1/blueprint/[blueprintId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockReq = {
    query: {
      blueprintId: 'bpt_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  it('returns 404 when blueprint does not exist', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(mockReq, mockSession)

    expect(result).toEqual({ status: 404 })
  })

  it('returns 401 when user does not own blueprint', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bpt_123',
      userId: 'user_other',
    })

    const result = await handler(mockReq, mockSession)

    expect(result).toEqual({ status: 401 })
  })

  it('returns blueprint payload for owner and strips userId', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bpt_123',
      alias: 'blueprint-name',
      name: 'Blueprint name',
      description: 'Blueprint description',
      userId: 'user_123',
      config: { x: 1, y: 2 },
      visibility: 'private',
      meta: { source: 'test' },
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    })

    const result = await handler(mockReq, mockSession)

    expect(prisma.blueprint.findUniqueByIdentifier).toHaveBeenCalledWith(
      mockSession.user,
      'bpt_123',
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          alias: true,
          name: true,
          description: true,
          userId: true,
          config: true,
          visibility: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        }),
      })
    )

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      id: 'bpt_123',
      alias: 'blueprint-name',
      name: 'Blueprint name',
      visibility: 'private',
    })
    expect(result.body.userId).toBeUndefined()
  })
})
