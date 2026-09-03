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
      team: {
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
    getMeta: jest.fn((meta) => ({ ...meta, normalized: true })),
  }),
  { virtual: true }
)

describe('POST /api/v1/team/[teamId]/update', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { teamId: 'team_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when team does not exist', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {
      name: 'Team',
      description: 'Desc',
      meta: { a: 1 },
    })

    expect(result).toEqual({ status: 404 })
    expect(prisma.team.update).not.toHaveBeenCalled()
  })

  it('returns 401 when team belongs to another user', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_2',
    })

    const result = await handler(req, session, {
      name: 'Team',
      description: 'Desc',
      meta: { a: 1 },
    })

    expect(result).toEqual({ status: 401 })
    expect(prisma.team.update).not.toHaveBeenCalled()
  })

  it('updates team and returns id when owner is authorized', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_1',
    })

    const body = {
      name: 'Updated Team',
      description: 'Updated Desc',
      meta: { tier: 'pro' },
    }

    const result = await handler(req, session, body)

    expect(getMeta).toHaveBeenCalledWith({ tier: 'pro' })
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team_1' },
      data: {
        name: 'Updated Team',
        description: 'Updated Desc',
        meta: { tier: 'pro', normalized: true },
      },
    })
    expect(result).toEqual({ status: 200, body: { id: 'team_1' } })
  })

  it('propagates update errors', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_1',
    })
    prisma.team.update.mockRejectedValue(new Error('team update failed'))

    await expect(
      handler(req, session, {
        name: 'Team',
        description: 'Desc',
        meta: {},
      })
    ).rejects.toThrow('team update failed')
  })
})
