/**
 * @jest-environment node
 */
import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      token: {
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

jest.mock('@/lib/user.handler', () => ({
  withChildUserSession: (fn) => (req, session) => fn(req, session),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
  notFound: jest.fn(() => ({ status: 404 })),
  notAuthorized: jest.fn(() => ({ status: 401 })),
}))

describe('POST /api/v1/user/[userId]/token/[tokenId]/delete', () => {
  const prisma = jest.requireMock('@/prisma/client').default
  const req = { query: { tokenId: 'tok_1' } }
  const session = { user: { id: 'child-user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deletes token when it belongs to current user', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue({
      id: 'tok_1',
      userId: 'child-user-1',
    })

    const result = await handler(req, session)

    expect(prisma.token.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'tok_1',
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )
    expect(prisma.token.delete).toHaveBeenCalledWith({
      where: {
        id: 'tok_1',
      },
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ id: 'tok_1' })
  })

  it('returns 404 and does not delete when token does not exist', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result.status).toBe(404)
    expect(prisma.token.delete).not.toHaveBeenCalled()
  })

  it('returns 401 and does not delete when token belongs to different user', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue({
      id: 'tok_1',
      userId: 'child-user-2',
    })

    const result = await handler(req, session)

    expect(result.status).toBe(401)
    expect(prisma.token.delete).not.toHaveBeenCalled()
  })

  it('propagates errors from prisma lookups', async () => {
    prisma.token.findUniqueByIdentifier.mockRejectedValue(
      new Error('lookup failed')
    )

    await expect(handler(req, session)).rejects.toThrow('lookup failed')
  })
})
