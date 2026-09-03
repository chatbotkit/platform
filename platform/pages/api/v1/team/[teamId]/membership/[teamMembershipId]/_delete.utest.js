/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler, { bodySchema } from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      team: {
        findUniqueByIdentifier: jest.fn(),
      },
      teamMembership: {
        findFirst: jest.fn(),
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
  withUserSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const prisma = require('@/prisma/client').default

describe('/api/v1/team/[teamId]/membership/[teamMembershipId]/delete', () => {
  const session = { user: { id: 'user_1' } }
  const req = {
    query: { teamId: 'team_1', teamMembershipId: 'membership_1' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 and deleted team membership id for owner', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_1',
    })
    prisma.teamMembership.findFirst.mockResolvedValue({
      id: 'membership_1',
      teamId: 'team_1',
    })

    const result = await handler(req, session, {})

    expect(prisma.team.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'team_1'
    )
    expect(prisma.teamMembership.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'membership_1',
        teamId: 'team_1',
      },
    })
    expect(prisma.teamMembership.delete).toHaveBeenCalledWith({
      where: { id: 'membership_1' },
    })
    expect(result).toEqual({
      status: 200,
      body: { id: 'membership_1' },
    })
  })

  it('returns 404 when team is missing', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.teamMembership.findFirst).not.toHaveBeenCalled()
    expect(prisma.teamMembership.delete).not.toHaveBeenCalled()
  })

  it('returns 401 for non-owner user', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'owner_2',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.teamMembership.findFirst).not.toHaveBeenCalled()
    expect(prisma.teamMembership.delete).not.toHaveBeenCalled()
  })

  it('returns 404 when team membership is missing', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_1',
    })
    prisma.teamMembership.findFirst.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.teamMembership.delete).not.toHaveBeenCalled()
  })

  it('propagates prisma deletion errors', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_1',
    })
    prisma.teamMembership.findFirst.mockResolvedValue({
      id: 'membership_1',
      teamId: 'team_1',
    })
    prisma.teamMembership.delete.mockRejectedValue(new Error('delete failed'))

    await expect(handler(req, session, {})).rejects.toThrow('delete failed')
  })

  it('validates empty body schema', () => {
    expect(bodySchema.validate({}).error).toBeUndefined()
  })
})
