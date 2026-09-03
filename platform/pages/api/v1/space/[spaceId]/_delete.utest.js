/**
 * @jest-environment node
 */
import { deleteSpace } from '@/lib/space.delete'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    space: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/space.delete', () => ({
  deleteSpace: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const prisma = jest.requireMock('@/prisma/client').default

describe('POST /api/v1/space/[spaceId]/delete', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { spaceId: 'space-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when space does not exist', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(deleteSpace).not.toHaveBeenCalled()
  })

  it('returns 401 when space belongs to another user', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space-1',
      userId: 'user-2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
    expect(deleteSpace).not.toHaveBeenCalled()
  })

  it('deletes space for owner and returns id', async () => {
    const space = { id: 'space-1', userId: 'user-1' }

    prisma.space.findUniqueByIdentifier.mockResolvedValue(space)

    const result = await handler(req, session)

    expect(prisma.space.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'space-1',
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )
    expect(deleteSpace).toHaveBeenCalledWith(space)
    expect(result).toEqual({ status: 200, body: { id: 'space-1' } })
  })
})
