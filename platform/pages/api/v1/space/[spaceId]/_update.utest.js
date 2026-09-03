/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      space: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
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

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta, prev) => ({ ...prev, ...meta })),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const { getMeta } = require('@/lib/meta')

describe('POST /api/v1/space/[spaceId]/update', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { spaceId: 'space_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when space does not exist', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.space.update).not.toHaveBeenCalled()
  })

  it('returns 401 when space owner differs from session user', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_2',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.space.update).not.toHaveBeenCalled()
  })

  it('updates space with normalized relation fields and merged meta', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_1',
      meta: { previous: true },
    })

    const body = {
      alias: 'space-alias',
      name: 'New Space',
      description: 'New Description',
      blueprintId: { id: 'blueprint_1' },
      contactId: { id: 'contact_1' },
      meta: { next: true },
    }

    const result = await handler(req, session, body)

    expect(getMeta).toHaveBeenCalledWith({ next: true }, { previous: true })
    expect(prisma.space.update).toHaveBeenCalledWith({
      where: { id: 'space_1' },
      data: {
        alias: 'space-alias',
        name: 'New Space',
        description: 'New Description',
        blueprintId: 'blueprint_1',
        contactId: 'contact_1',
        meta: { previous: true, next: true },
      },
    })
    expect(result).toEqual({ status: 200, body: { id: 'space_1' } })
  })

  it('supports primitive blueprintId and empty contact linkage', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_1',
      meta: {},
    })

    await handler(req, session, {
      blueprintId: 'blueprint_2',
      contactId: undefined,
      meta: {},
    })

    expect(prisma.space.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: 'blueprint_2',
          contactId: undefined,
        }),
      })
    )
  })

  it('validates body schema for invalid alias', async () => {
    await expect(bodySchema.validateAsync({ alias: '/' })).rejects.toThrow()
  })
})
