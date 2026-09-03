/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      space: {
        findUniqueByIdentifier: jest.fn(),
      },
      spaceSite: {
        findMany: jest.fn(),
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

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => fn,
}))

jest.mock('@/lib/filter', () => ({
  getCursorConstraints: () => ({}),
  getTakeConstraints: () => ({}),
  getMetaQueryFilter: () => [],
  getFieldQueryFilter: () => [],
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (value) => value,
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: () => {
    throw new Error('not found')
  },
  throwNotAuthorized: () => {
    throw new Error('not authorized')
  },
}))

describe('GET /api/v1/space/[spaceId]/site/list', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { spaceId: 'space_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws when the space does not exist', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

    await expect(handler(undefined, req, undefined, session)).rejects.toThrow(
      'not found'
    )
  })

  it('throws when the space owner differs', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_2',
    })

    await expect(handler(undefined, req, undefined, session)).rejects.toThrow(
      'not authorized'
    )
  })

  it('returns the sites scoped to the space and user', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_1',
    })

    const sites = [{ id: 'site_1', slug: 'acme' }]

    prisma.spaceSite.findMany.mockResolvedValue(sites)

    const result = await handler(undefined, req, undefined, session)

    expect(result).toEqual({ items: sites })

    expect(prisma.spaceSite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ userId: 'user_1' }, { spaceId: 'space_1' }],
        },
      })
    )
  })
})
