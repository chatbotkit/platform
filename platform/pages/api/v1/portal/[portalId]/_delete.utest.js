/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      portal: {
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

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('POST /api/v1/portal/[portalId]/delete', () => {
  const req = { query: { portalId: 'portal-1' } }
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deletes portal when owner matches session user', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue({
      id: 'portal-1',
      userId: 'user-1',
    })
    prisma.portal.delete.mockResolvedValue({ id: 'portal-1' })

    const result = await handler(req, session)

    expect(prisma.portal.delete).toHaveBeenCalledWith({
      where: { id: 'portal-1' },
    })
    expect(result).toEqual({ status: 200, body: { id: 'portal-1' } })
  })

  it('returns 404 when portal is missing', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(prisma.portal.delete).not.toHaveBeenCalled()
  })

  it('returns 401 when portal belongs to another user', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue({
      id: 'portal-1',
      userId: 'user-2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
    expect(prisma.portal.delete).not.toHaveBeenCalled()
  })

  it('propagates delete errors', async () => {
    prisma.portal.findUniqueByIdentifier.mockResolvedValue({
      id: 'portal-1',
      userId: 'user-1',
    })
    prisma.portal.delete.mockRejectedValue(new Error('delete failed'))

    await expect(handler(req, session)).rejects.toThrow('delete failed')
  })
})
