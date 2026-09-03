/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
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

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

describe('GET /api/v1/skillset/[skillsetId]/fetch', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { skillsetId: 'ss-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when skillset is not found', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
  })

  it('returns 401 when skillset belongs to a different user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-other',
      name: 'Skillset',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
  })

  it('returns skillset data without userId for the owner', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      alias: 'my-skillset',
      userId: 'user-1',
      name: 'My Skillset',
      description: 'A test skillset',
      visibility: 'private',
      blueprintId: null,
      meta: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    })

    const result = await handler(req, session)

    expect(result.status).toBe(200)
    // userId must be stripped from the response
    expect(result.body).not.toHaveProperty('userId')
    expect(result.body.id).toBe('ss-1')
    expect(result.body.alias).toBe('my-skillset')
    expect(result.body.name).toBe('My Skillset')
  })

  it('calls findUniqueByIdentifier with the session user and skillsetId', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    await handler(req, session)

    expect(prisma.skillset.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'ss-1',
      expect.any(Object)
    )
  })
})
