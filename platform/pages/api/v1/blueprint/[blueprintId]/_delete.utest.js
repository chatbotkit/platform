/**
 * @jest-environment node
 */
import { deleteBlueprint } from '@/lib/blueprint.delete'

import handler, { bodySchema } from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      blueprint: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/blueprint.delete', () => ({
  deleteBlueprint: jest.fn(),
}))

jest.mock('@/lib/joi.handler', () => {
  const mock = {
    optional: () => mock,
    default: () => mock,
  }

  return {
    __esModule: true,
    default: {
      object: jest.fn((fields) => fields),
      boolean: jest.fn(() => mock),
    },
    withSchema: (_schema, fn) => fn,
  }
})

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

const prisma = jest.requireMock('@/prisma/client').default

describe('POST /api/v1/blueprint/[blueprintId]/delete', () => {
  const req = { query: { blueprintId: 'bp-1' } }
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exports body schema', () => {
    expect(bodySchema).toBeDefined()
  })

  it('returns 404 when blueprint does not exist', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, { deleteResources: false })

    expect(result).toEqual({ status: 404 })
    expect(deleteBlueprint).not.toHaveBeenCalled()
  })

  it('returns 401 when blueprint belongs to different user', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-2',
    })

    const result = await handler(req, session, { deleteResources: false })

    expect(result).toEqual({ status: 401 })
    expect(deleteBlueprint).not.toHaveBeenCalled()
  })

  it('deletes owned blueprint without resources by default', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
    })

    const result = await handler(req, session, { deleteResources: false })

    expect(prisma.blueprint.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'bp-1',
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )
    expect(deleteBlueprint).toHaveBeenCalledWith(
      { id: 'bp-1', userId: 'user-1' },
      { deleteResources: false }
    )
    expect(result).toEqual({ status: 200, body: { id: 'bp-1' } })
  })

  it('passes deleteResources=true to deleteBlueprint', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-2',
      userId: 'user-1',
    })

    await handler(req, session, { deleteResources: true })

    expect(deleteBlueprint).toHaveBeenCalledWith(
      { id: 'bp-2', userId: 'user-1' },
      { deleteResources: true }
    )
  })
})
