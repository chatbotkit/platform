/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

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
        delete: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

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
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('POST /api/v1/space/[spaceId]/site/[siteId]/delete', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { spaceId: 'space_1', siteId: 'site_1' } }

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_1',
    })
  })

  it('returns 404 when the site belongs to another space', async () => {
    prisma.spaceSite.findUniqueByIdentifier.mockResolvedValue({
      id: 'site_1',
      userId: 'user_1',
      spaceId: 'space_other',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(prisma.spaceSite.delete).not.toHaveBeenCalled()
  })

  it('deletes the site and returns its id', async () => {
    prisma.spaceSite.findUniqueByIdentifier.mockResolvedValue({
      id: 'site_1',
      userId: 'user_1',
      spaceId: 'space_1',
    })

    prisma.spaceSite.delete.mockResolvedValue({ id: 'site_1' })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 200, body: { id: 'site_1' } })
    expect(prisma.spaceSite.delete).toHaveBeenCalledWith({
      where: { id: 'site_1' },
    })
  })
})
