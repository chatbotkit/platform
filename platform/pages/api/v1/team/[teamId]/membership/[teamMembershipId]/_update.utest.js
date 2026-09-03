/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    team: {
      findUniqueByIdentifier: jest.fn(),
    },
    teamMembership: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}))

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
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((value) => ({ ...value, normalized: true })),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((value) => value),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const { getMeta } = require('@/lib/meta')
const { makeJsonSafe } = require('@/lib/struct')

describe('/api/v1/team/[teamId]/membership/[teamMembershipId]/update', () => {
  const session = { user: { id: 'user-1' } }
  const req = {
    query: {
      teamId: 'team-1',
      teamMembershipId: 'tm-1',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns not found when team does not exist', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(req, session, {})

    expect(response).toEqual({ status: 404 })
    expect(prisma.teamMembership.findFirst).not.toHaveBeenCalled()
  })

  it('returns not authorized when team belongs to another user', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team-1',
      userId: 'other-user',
    })

    const response = await handler(req, session, {})

    expect(response).toEqual({ status: 401 })
    expect(prisma.teamMembership.findFirst).not.toHaveBeenCalled()
  })

  it('updates membership and returns id when request is valid', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team-1',
      userId: 'user-1',
    })
    prisma.teamMembership.findFirst.mockResolvedValue({
      id: 'tm-1',
      teamId: 'team-1',
    })

    const response = await handler(req, session, {
      name: 'Alice',
      description: 'Owner',
      email: 'alice@example.com',
      meta: { color: 'blue' },
    })

    expect(getMeta).toHaveBeenCalledWith({ color: 'blue' })
    expect(prisma.teamMembership.update).toHaveBeenCalledWith({
      where: { id: 'tm-1' },
      data: {
        name: 'Alice',
        description: 'Owner',
        email: 'alice@example.com',
        meta: { color: 'blue', normalized: true },
      },
    })
    expect(makeJsonSafe).toHaveBeenCalledWith({ id: 'tm-1' })
    expect(response).toEqual({ status: 200, body: { id: 'tm-1' } })
  })

  it('returns not found when membership does not exist', async () => {
    prisma.team.findUniqueByIdentifier.mockResolvedValue({
      id: 'team-1',
      userId: 'user-1',
    })
    prisma.teamMembership.findFirst.mockResolvedValue(null)

    const response = await handler(req, session, {
      name: 'Alice',
      description: 'Owner',
      email: 'alice@example.com',
      meta: {},
    })

    expect(response).toEqual({ status: 404 })
    expect(prisma.teamMembership.update).not.toHaveBeenCalled()
  })

  it('validates body schema for required fields', async () => {
    await expect(
      bodySchema.validateAsync({
        name: 'Alice',
        description: 'Owner',
        email: 'alice@example.com',
        meta: {},
      })
    ).resolves.toBeDefined()
  })
})
