/**
 * @jest-environment node
 */
import {
  RUNAS_TEAMID_COOKIE_NAME,
  RUNAS_TEAMNAME_COOKIE_NAME,
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

import prisma from '@/prisma/client'

import handler from './switch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    team: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/runas', () => ({
  withoutTeamAndUserRunasCookies: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

const ownerSession = { user: { id: 'owner-1', email: 'owner@example.com' } }

const mockTeam = {
  id: 'team-1',
  userId: 'owner-1',
  name: 'Test Team',
  memberships: [],
}

describe('POST /api/me/team/[teamId]/switch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authorization', () => {
    it('returns 404 when team not found', async () => {
      prisma.team.findUnique.mockResolvedValue(null)

      const response = await handler(
        { query: { teamId: 'team-999' } },
        ownerSession
      )

      expect(response.status).toBe(404)
    })

    it('returns 403 when user is neither owner nor member', async () => {
      prisma.team.findUnique.mockResolvedValue({
        ...mockTeam,
        userId: 'owner-1',
        memberships: [{ email: 'member@example.com' }],
      })

      const strangerSession = {
        user: { id: 'stranger-1', email: 'stranger@example.com' },
      }

      const response = await handler(
        { query: { teamId: 'team-1' } },
        strangerSession
      )

      expect(response.status).toBe(403)
    })

    it('allows team owner to switch', async () => {
      prisma.team.findUnique.mockResolvedValue(mockTeam)

      const response = await handler(
        { query: { teamId: 'team-1' } },
        ownerSession
      )

      expect(response.status).toBe(200)
    })

    it('allows team member to switch', async () => {
      prisma.team.findUnique.mockResolvedValue({
        ...mockTeam,
        userId: 'owner-1',
        memberships: [{ email: 'member@example.com' }],
      })

      const memberSession = {
        user: { id: 'member-1', email: 'member@example.com' },
      }

      const response = await handler(
        { query: { teamId: 'team-1' } },
        memberSession
      )

      expect(response.status).toBe(200)
    })
  })

  describe('cookie management', () => {
    beforeEach(() => {
      prisma.team.findUnique.mockResolvedValue(mockTeam)
    })

    it('sets RUNAS_TEAMID cookie on success', async () => {
      const response = await handler(
        { query: { teamId: 'team-1' } },
        ownerSession
      )

      const setCookies = response.headers.getSetCookie()

      expect(
        setCookies.some((c) => c.includes(`${RUNAS_TEAMID_COOKIE_NAME}=team-1`))
      ).toBe(true)
    })

    it('sets RUNAS_TEAMNAME cookie on success', async () => {
      const response = await handler(
        { query: { teamId: 'team-1' } },
        ownerSession
      )

      const setCookies = response.headers.getSetCookie()

      expect(
        setCookies.some((c) => c.includes(`${RUNAS_TEAMNAME_COOKIE_NAME}=`))
      ).toBe(true)
    })

    it('clears RUNAS_USERID cookie on success', async () => {
      const response = await handler(
        { query: { teamId: 'team-1' } },
        ownerSession
      )

      const setCookies = response.headers.getSetCookie()

      expect(
        setCookies.some(
          (c) =>
            c.startsWith(`${RUNAS_USERID_COOKIE_NAME}=;`) &&
            c.toLowerCase().includes('expires=')
        )
      ).toBe(true)
    })

    it('clears RUNAS_USERNAME cookie on success', async () => {
      const response = await handler(
        { query: { teamId: 'team-1' } },
        ownerSession
      )

      const setCookies = response.headers.getSetCookie()

      expect(
        setCookies.some(
          (c) =>
            c.startsWith(`${RUNAS_USERNAME_COOKIE_NAME}=;`) &&
            c.toLowerCase().includes('expires=')
        )
      ).toBe(true)
    })
  })
})
