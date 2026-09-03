/**
 * @jest-environment node
 */
import { digestCredential } from '@/lib/credential.digest'

import handler from './create'

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'abcd1234'),
  })),
}))

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      token: {
        create: jest.fn(),
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

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/user.handler', () => ({
  withChildUserSession: (fn) => (req, session, body) => fn(req, session, body),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('POST /api/v1/user/[userId]/token/create', () => {
  const prisma = jest.requireMock('@/prisma/client').default
  const session = {
    user: { id: 'child-user-1' },
  }
  const body = {
    name: 'User Token',
    description: 'Token for user',
    config: { scope: 'read' },
    meta: { source: 'user-test' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a token for the user and returns id token and createdAt', async () => {
    const createdAt = new Date('2025-01-01T00:00:00.000Z')

    prisma.token.create.mockResolvedValue({
      id: 'token_1',
      token: 'sk-abcd1234',
      createdAt,
    })

    const result = await handler({}, session, body)

    expect(prisma.token.create).toHaveBeenCalledWith({
      data: {
        userId: 'child-user-1',
        name: 'User Token',
        description: 'Token for user',
        config: { scope: 'read' },
        meta: { source: 'user-test' },
        token: await digestCredential('sk-abcd1234'),
      },
      select: {
        id: true,
        createdAt: true,
      },
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      id: 'token_1',
      token: 'sk-abcd1234',
      createdAt,
    })
  })

  it('uses makeJsonSafe before responding', async () => {
    const { makeJsonSafe } = jest.requireMock('@/lib/struct')
    const { ok } = jest.requireMock('@/lib/response')
    const createdAt = new Date('2025-02-02T00:00:00.000Z')

    prisma.token.create.mockResolvedValue({
      id: 'token_2',
      token: 'sk-abcd1234',
      createdAt,
    })

    await handler({}, session, body)

    expect(makeJsonSafe).toHaveBeenCalledWith({
      id: 'token_2',
      token: 'sk-abcd1234',
      createdAt,
    })
    expect(ok).toHaveBeenCalled()
  })

  it('propagates prisma errors', async () => {
    prisma.token.create.mockRejectedValue(new Error('create failed'))

    await expect(handler({}, session, body)).rejects.toThrow('create failed')
  })
})
