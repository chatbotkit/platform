/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        create: jest.fn(),
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

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
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

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/schemas/alias', () => ({}))
jest.mock('@/schemas/name', () => ({}))
jest.mock('@/schemas/description', () => ({}))
jest.mock('@/schemas/blueprintId', () => jest.fn(() => ({})))
jest.mock('@/schemas/meta', () => ({}))

describe('POST /api/v1/skillset/create', () => {
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.skillset.create.mockResolvedValue({ id: 'ss-new' })
  })

  it('creates a skillset and returns its id', async () => {
    const req = {}
    const body = { name: 'My Skillset', description: 'A test skillset' }

    const result = await handler(req, session, body)

    expect(prisma.skillset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'My Skillset',
          description: 'A test skillset',
        }),
        select: { id: true },
      })
    )
    expect(result).toEqual({ status: 200, body: { id: 'ss-new' } })
  })

  it('passes visibility to prisma create', async () => {
    const req = {}
    const body = { name: 'Public Skillset', visibility: 'public' }

    await handler(req, session, body)

    expect(prisma.skillset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ visibility: 'public' }),
      })
    )
  })

  it('resolves blueprintId from an object with id', async () => {
    const req = {}
    const body = { name: 'SS', blueprintId: { id: 'bp-1' } }

    await handler(req, session, body)

    expect(prisma.skillset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ blueprintId: 'bp-1' }),
      })
    )
  })

  it('passes a plain string blueprintId directly', async () => {
    const req = {}
    const body = { name: 'SS', blueprintId: 'bp-string' }

    await handler(req, session, body)

    expect(prisma.skillset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ blueprintId: 'bp-string' }),
      })
    )
  })

  it('passes meta to prisma create', async () => {
    const req = {}
    const body = { name: 'SS', meta: { custom: 'value' } }

    await handler(req, session, body)

    expect(prisma.skillset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ meta: { custom: 'value' } }),
      })
    )
  })
})
