/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/prisma/types', () => ({
  SkillsetVisibility: {
    public: 'public',
    private: 'private',
    protected: 'protected',
  },
  ResourceState: {
    enabled: 'enabled',
    disabled: 'disabled',
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
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
  getMeta: jest.fn((newMeta, _existing) => newMeta || {}),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/schemas/alias', () => ({}))
jest.mock('@/schemas/name', () => ({}))
jest.mock('@/schemas/description', () => ({}))
jest.mock('@/schemas/blueprintId', () => jest.fn(() => ({})))
jest.mock('@/schemas/meta', () => ({}))

describe('POST /api/v1/skillset/[skillsetId]/update', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { skillsetId: 'ss-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.skillset.update.mockResolvedValue({ id: 'ss-1' })
  })

  it('returns 404 when skillset is not found', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.skillset.update).not.toHaveBeenCalled()
  })

  it('returns 401 when skillset belongs to a different user', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-other',
      meta: null,
    })

    const result = await handler(req, session, { name: 'New Name' })

    expect(result).toEqual({ status: 401 })
    expect(prisma.skillset.update).not.toHaveBeenCalled()
  })

  it('updates the skillset and returns its id', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      meta: null,
    })

    const result = await handler(req, session, {
      name: 'Updated Skillset',
      description: 'Updated description',
      visibility: 'public',
    })

    expect(prisma.skillset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ss-1' },
        data: expect.objectContaining({
          name: 'Updated Skillset',
          description: 'Updated description',
          visibility: 'public',
        }),
      })
    )
    expect(result).toEqual({ status: 200, body: { id: 'ss-1' } })
  })

  it('resolves blueprintId from an object with id', async () => {
    prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ss-1',
      userId: 'user-1',
      meta: null,
    })

    await handler(req, session, { blueprintId: { id: 'bp-1' } })

    expect(prisma.skillset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ blueprintId: 'bp-1' }),
      })
    )
  })
})
