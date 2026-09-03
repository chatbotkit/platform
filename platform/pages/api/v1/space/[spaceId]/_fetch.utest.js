/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    space: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('/api/v1/space/[spaceId]/fetch', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { spaceId: 'space_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when space does not exist', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
  })

  it('returns 401 for non-owner access', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'other_user',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
  })

  it('returns space payload without userId for owner', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      alias: 'main-space',
      name: 'Main space',
      description: 'A space',
      userId: 'user_1',
      blueprintId: 'blueprint_1',
      contactId: 'contact_1',
      meta: { tag: 'x' },
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    })

    const result = await handler(req, session)

    expect(prisma.space.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'space_1',
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          alias: true,
          name: true,
          description: true,
          userId: true,
          blueprintId: true,
          contactId: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        }),
      })
    )
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      id: 'space_1',
      alias: 'main-space',
      name: 'Main space',
      blueprintId: 'blueprint_1',
      contactId: 'contact_1',
    })
    expect(result.body.userId).toBeUndefined()
  })

  it('propagates prisma errors', async () => {
    prisma.space.findUniqueByIdentifier.mockRejectedValue(new Error('db fail'))

    await expect(handler(req, session)).rejects.toThrow('db fail')
  })
})
