/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      portal: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
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
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const { makeJsonSafe } = require('@/lib/struct')

describe('GET /api/v1/portal/[portalId]/fetch', () => {
  const req = { query: { portalId: 'portal-1' } }
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns portal when owner matches session user and strips userId', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue({
      id: 'portal-1',
      alias: 'portal-one',
      userId: 'user-1',
      name: 'Portal',
      description: 'desc',
      blueprintId: 'bp-1',
      slug: 'portal',
      config: { theme: 'dark' },
      meta: { tag: 'x' },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await handler(req, session)

    expect(prisma.portal.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'portal-1',
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          alias: true,
          userId: true,
        }),
      })
    )
    expect(result.status).toBe(200)
    expect(result.body.alias).toBe('portal-one')
    expect(makeJsonSafe).toHaveBeenCalledTimes(1)
    expect(makeJsonSafe.mock.calls[0][0].userId).toBeUndefined()
    expect(result.body.userId).toBeUndefined()
  })

  it('returns 404 when portal does not exist', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(makeJsonSafe).not.toHaveBeenCalled()
  })

  it('returns 401 when portal belongs to another user', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue({
      id: 'portal-1',
      userId: 'user-2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
    expect(makeJsonSafe).not.toHaveBeenCalled()
  })

  it('propagates lookup errors', async () => {
    prisma.portal.findUniqueByIdentifier.mockRejectedValue(
      new Error('lookup failed')
    )

    await expect(handler(req, session)).rejects.toThrow('lookup failed')
  })
})
