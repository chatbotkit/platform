/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler, { bodySchema } from './update'

const prisma = require('@/prisma/client').default
const { getMeta } = require('@/lib/meta')

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      portal: {
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
  withSession: (fn) => fn,
}))

jest.mock(
  '@/lib/meta',
  () => ({
    getMeta: jest.fn((meta, previous) => ({ ...previous, ...meta })),
  }),
  { virtual: true }
)

describe('POST /api/v1/portal/[portalId]/update', () => {
  const req = { query: { portalId: 'portal-1' } }
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when portal does not exist', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.portal.update).not.toHaveBeenCalled()
  })

  it('returns 401 when portal belongs to another user', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue({
      id: 'portal-1',
      userId: 'user-2',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.portal.update).not.toHaveBeenCalled()
  })

  it('updates portal and maps blueprint + merged meta', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue({
      id: 'portal-1',
      userId: 'user-1',
      meta: { previous: true },
    })

    const body = {
      alias: 'alias',
      name: 'Portal',
      description: 'Updated',
      blueprintId: { id: 'bp-1' },
      slug: 'portal',
      config: { color: 'blue' },
      meta: { extra: true },
    }

    const result = await handler(req, session, body)

    expect(getMeta).toHaveBeenCalledWith({ extra: true }, { previous: true })
    expect(prisma.portal.update).toHaveBeenCalledWith({
      where: { id: 'portal-1' },
      data: {
        alias: 'alias',
        name: 'Portal',
        description: 'Updated',
        blueprintId: 'bp-1',
        slug: 'portal',
        config: { color: 'blue' },
        meta: { previous: true, extra: true },
      },
    })
    expect(result).toEqual({ status: 200, body: { id: 'portal-1' } })
  })

  it('supports primitive blueprintId and propagates update errors', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue({
      id: 'portal-1',
      userId: 'user-1',
      meta: {},
    })
    prisma.portal.update.mockRejectedValue(new Error('update failed'))

    await expect(
      handler(req, session, {
        blueprintId: 'bp-2',
        meta: {},
      })
    ).rejects.toThrow('update failed')

    expect(prisma.portal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: 'bp-2',
        }),
      })
    )
  })

  it('validates body schema for basic accepted fields', async () => {
    const result = await bodySchema.validateAsync({
      name: 'Portal Name',
      description: 'Portal description',
      slug: 'workspace-home',
      config: null,
      meta: {},
    })

    expect(result).toEqual(
      expect.objectContaining({
        name: 'Portal Name',
        description: 'Portal description',
        slug: 'workspace-home',
      })
    )
  })
})
