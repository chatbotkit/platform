/**
 * @jest-environment node
 */
import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    memory: {
      findUniqueByIdentifier: jest.fn(),
      delete: jest.fn(),
    },
  },
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

describe('POST /api/v1/memory/[memoryId]/delete', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { memoryId: 'memory-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when memory is not found', async () => {
    prisma.memory.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(prisma.memory.delete).not.toHaveBeenCalled()
  })

  it('returns 401 when memory belongs to another user', async () => {
    prisma.memory.findUniqueByIdentifier.mockResolvedValue({
      id: 'memory-1',
      userId: 'user-2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
    expect(prisma.memory.delete).not.toHaveBeenCalled()
  })

  it('deletes memory for owner and returns id', async () => {
    prisma.memory.findUniqueByIdentifier.mockResolvedValue({
      id: 'memory-1',
      userId: 'user-1',
    })

    const result = await handler(req, session)

    expect(prisma.memory.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'memory-1',
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )
    expect(prisma.memory.delete).toHaveBeenCalledWith({
      where: {
        id: 'memory-1',
      },
    })
    expect(result).toEqual({ status: 200, body: { id: 'memory-1' } })
  })
})
