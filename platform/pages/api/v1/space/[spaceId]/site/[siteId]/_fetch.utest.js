/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      space: {
        findUniqueByIdentifier: jest.fn(),
      },
      spaceSite: {
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
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (value) => value,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('GET /api/v1/space/[spaceId]/site/[siteId]/fetch', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { spaceId: 'space_1', siteId: 'site_1' } }

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_1',
    })
  })

  it('returns 404 when the space does not exist', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

    expect(await handler(req, session)).toEqual({ status: 404 })
  })

  it('returns 404 when the site does not exist', async () => {
    prisma.spaceSite.findUniqueByIdentifier.mockResolvedValue(null)

    expect(await handler(req, session)).toEqual({ status: 404 })
  })

  it('returns 404 when the site belongs to another space', async () => {
    prisma.spaceSite.findUniqueByIdentifier.mockResolvedValue({
      id: 'site_1',
      userId: 'user_1',
      spaceId: 'space_other',
    })

    expect(await handler(req, session)).toEqual({ status: 404 })
  })

  it('returns the site without leaking the owner id', async () => {
    prisma.spaceSite.findUniqueByIdentifier.mockResolvedValue({
      id: 'site_1',
      userId: 'user_1',
      spaceId: 'space_1',
      slug: 'acme',
    })

    const result = await handler(req, session)

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      id: 'site_1',
      spaceId: 'space_1',
      slug: 'acme',
    })
    expect(result.body.userId).toBeUndefined()
  })
})
