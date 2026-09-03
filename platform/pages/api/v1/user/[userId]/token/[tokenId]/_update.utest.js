/**
 * @jest-environment node
 */
import handler from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      token: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((nextMeta, currentMeta) => ({
    ...currentMeta,
    ...nextMeta,
  })),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/user.handler', () => ({
  withChildUserSession: (fn) => (req, session, body) => fn(req, session, body),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
  notFound: jest.fn(() => ({ status: 404 })),
  notAuthorized: jest.fn(() => ({ status: 401 })),
}))

describe('POST /api/v1/user/[userId]/token/[tokenId]/update', () => {
  const prisma = jest.requireMock('@/prisma/client').default
  const { getMeta } = jest.requireMock('@/lib/meta')
  const req = { query: { tokenId: 'tok_1' } }
  const session = { user: { id: 'child-user-1' } }
  const body = {
    name: 'Updated User Token',
    description: 'Updated description',
    config: { enabled: false },
    meta: { source: 'user-update' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when token does not exist', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, body)

    expect(result).toEqual({ status: 404 })
    expect(prisma.token.update).not.toHaveBeenCalled()
  })

  it('returns 401 when token belongs to another user', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue({
      id: 'tok_1',
      userId: 'child-user-2',
      meta: { keep: true },
    })

    const result = await handler(req, session, body)

    expect(result).toEqual({ status: 401 })
    expect(prisma.token.update).not.toHaveBeenCalled()
  })

  it('updates token and merges metadata for the user', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue({
      id: 'tok_1',
      userId: 'child-user-1',
      meta: { keep: true },
    })

    const result = await handler(req, session, body)

    expect(getMeta).toHaveBeenCalledWith(
      { source: 'user-update' },
      { keep: true }
    )
    expect(prisma.token.update).toHaveBeenCalledWith({
      where: { id: 'tok_1' },
      data: {
        name: 'Updated User Token',
        description: 'Updated description',
        config: { enabled: false },
        meta: { keep: true, source: 'user-update' },
      },
    })
    expect(result).toEqual({ status: 200, body: { id: 'tok_1' } })
  })

  it('propagates prisma update errors', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue({
      id: 'tok_1',
      userId: 'child-user-1',
      meta: {},
    })
    prisma.token.update.mockRejectedValue(new Error('update failed'))

    await expect(handler(req, session, body)).rejects.toThrow('update failed')
  })
})
