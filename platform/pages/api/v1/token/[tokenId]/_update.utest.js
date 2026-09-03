/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import handler from './update'

const prisma = require('@/prisma/client').default
const { getMeta } = require('@/lib/meta')

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

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/lib/session.handler', () => ({
  withUserSession: (fn) => fn,
}))

jest.mock(
  '@/lib/meta',
  () => ({
    getMeta: jest.fn((nextMeta, currentMeta) => ({
      ...currentMeta,
      ...nextMeta,
    })),
  }),
  { virtual: true }
)

describe('POST /api/v1/token/[tokenId]/update', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { tokenId: 'token_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when token does not exist', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {
      name: 'Name',
      description: 'Desc',
      config: { enabled: true },
      meta: { x: 1 },
    })

    expect(result).toEqual({ status: 404 })
    expect(prisma.token.update).not.toHaveBeenCalled()
  })

  it('returns 401 when token belongs to another user', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue({
      id: 'token_1',
      userId: 'user_2',
      meta: { keep: true },
    })

    const result = await handler(req, session, {
      name: 'Name',
      description: 'Desc',
      config: { enabled: true },
      meta: { x: 1 },
    })

    expect(result).toEqual({ status: 401 })
    expect(prisma.token.update).not.toHaveBeenCalled()
  })

  it('updates token and merges metadata for owner', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue({
      id: 'token_1',
      userId: 'user_1',
      meta: { keep: true },
    })

    const body = {
      name: 'Updated Name',
      description: 'Updated Desc',
      config: { enabled: false },
      meta: { added: 'yes' },
    }

    const result = await handler(req, session, body)

    expect(getMeta).toHaveBeenCalledWith({ added: 'yes' }, { keep: true })
    expect(prisma.token.update).toHaveBeenCalledWith({
      where: { id: 'token_1' },
      data: {
        name: 'Updated Name',
        description: 'Updated Desc',
        config: { enabled: false },
        meta: { keep: true, added: 'yes' },
      },
    })
    expect(result).toEqual({ status: 200, body: { id: 'token_1' } })
  })

  it('propagates update errors', async () => {
    prisma.token.findUniqueByIdentifier.mockResolvedValue({
      id: 'token_1',
      userId: 'user_1',
      meta: {},
    })
    prisma.token.update.mockRejectedValue(new Error('update failed'))

    await expect(
      handler(req, session, {
        name: 'Name',
        description: 'Desc',
        config: null,
        meta: {},
      })
    ).rejects.toThrow('update failed')
  })
})
