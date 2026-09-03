/**
 * @jest-environment node
 */
import { getMeta } from '@/lib/meta'

import handler, { bodySchema } from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      blueprint: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/prisma/types', () => ({
  BlueprintVisibility: {
    private: 'private',
    public: 'public',
    protected: 'protected',
  },
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: {
    object: jest.fn().mockReturnThis(),
    string: jest.fn().mockReturnThis(),
    valid: jest.fn().mockReturnThis(),
  },
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((next, prev) => (next === undefined ? prev : next)),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/schemas/alias', () => ({}))
jest.mock('@/schemas/blueprintConfig', () => ({}))
jest.mock('@/schemas/description', () => ({}))
jest.mock('@/schemas/meta', () => ({}))
jest.mock('@/schemas/name', () => ({}))

const prisma = jest.requireMock('@/prisma/client').default

describe('POST /api/v1/blueprint/[blueprintId]/update', () => {
  const req = { query: { blueprintId: 'bp-1' } }
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.blueprint.update.mockResolvedValue({ id: 'bp-1' })
  })

  it('exports body schema', () => {
    expect(bodySchema).toBeDefined()
  })

  it('returns 404 when blueprint does not exist', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, { name: 'Updated' })

    expect(result).toEqual({ status: 404 })
    expect(prisma.blueprint.update).not.toHaveBeenCalled()
  })

  it('returns 401 when blueprint belongs to a different user', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-2',
      config: { prev: true },
      meta: { tag: 'x' },
    })

    const result = await handler(req, session, { name: 'Updated' })

    expect(result).toEqual({ status: 401 })
    expect(prisma.blueprint.update).not.toHaveBeenCalled()
  })

  it('updates blueprint fields and returns id', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
      config: { old: 1 },
      meta: { old: true },
    })

    const body = {
      alias: 'new-alias',
      name: 'Blueprint v2',
      description: 'Updated',
      visibility: 'public',
      config: { layout: 'new' },
      meta: { source: 'test' },
    }

    const result = await handler(req, session, body)

    expect(getMeta).toHaveBeenNthCalledWith(1, body.config, { old: 1 })
    expect(getMeta).toHaveBeenNthCalledWith(2, body.meta, { old: true })
    expect(prisma.blueprint.update).toHaveBeenCalledWith({
      where: { id: 'bp-1' },
      data: {
        alias: 'new-alias',
        name: 'Blueprint v2',
        description: 'Updated',
        visibility: 'public',
        config: { layout: 'new' },
        meta: { source: 'test' },
      },
    })
    expect(result).toEqual({ status: 200, body: { id: 'bp-1' } })
  })

  it('preserves previous config/meta when request omits them', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
      config: { keep: 'config' },
      meta: { keep: 'meta' },
    })

    await handler(req, session, { name: 'Only name' })

    expect(prisma.blueprint.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Only name',
          config: { keep: 'config' },
          meta: { keep: 'meta' },
        }),
      })
    )
  })
})
