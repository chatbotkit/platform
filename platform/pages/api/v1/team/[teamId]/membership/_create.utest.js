/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import { captureException } from '@/lib/error'
import { logAudit } from '@/lib/log'
import { notifyTeamInvitation } from '@/lib/notify'

import handler, { bodySchema } from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      team: {
        findUniqueByIdentifier: jest.fn(),
      },
      teamMembership: {
        upsert: jest.fn(),
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

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
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

jest.mock('@/lib/log', () => ({
  logAudit: jest.fn(),
}))

jest.mock('@/lib/notify', () => ({
  notifyTeamInvitation: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/partner.helpers', () => ({
  getPartnerByHostname: jest.fn(),
  partnerToEmailBranding: jest.fn(),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

const prisma = require('@/prisma/client').default

describe('/api/v1/team/[teamId]/membership/create', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { teamId: 'team_1' }, headers: {} }
  const body = {
    name: 'Member Name',
    description: 'Member Description',
    email: 'member@example.com',
    meta: { source: 'test' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('upserts team membership and returns id for team owner', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_1',
      name: 'My Team',
      description: 'desc',
    })
    prisma.teamMembership.upsert.mockResolvedValue({ id: 'tm_1' })

    const result = await handler(req, session, body)

    expect(prisma.teamMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId_email: {
            teamId: 'team_1',
            email: 'member@example.com',
          },
        },
      })
    )
    expect(logAudit).toHaveBeenCalled()
    expect(notifyTeamInvitation).toHaveBeenCalled()
    expect(result).toEqual({ status: 200, body: { id: 'tm_1' } })
  })

  it('returns 404 when team is not found', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, body)

    expect(result).toEqual({ status: 404 })
    expect(prisma.teamMembership.upsert).not.toHaveBeenCalled()
  })

  it('returns 401 when requester is not team owner', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_2',
    })

    const result = await handler(req, session, body)

    expect(result).toEqual({ status: 401 })
    expect(prisma.teamMembership.upsert).not.toHaveBeenCalled()
  })

  it('captures invitation errors and still succeeds', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team_1',
      userId: 'user_1',
      name: 'My Team',
      description: 'desc',
    })
    prisma.teamMembership.upsert.mockResolvedValue({ id: 'tm_1' })
    notifyTeamInvitation.mockRejectedValue(new Error('mail failed'))

    const result = await handler(req, session, body)

    expect(captureException).toHaveBeenCalled()
    expect(result).toEqual({ status: 200, body: { id: 'tm_1' } })
  })

  it('validates body schema email requirement', async () => {
    await expect(
      bodySchema.validateAsync({ ...body, email: 'not-an-email' })
    ).rejects.toThrow('"email" must be a valid email')
  })
})
