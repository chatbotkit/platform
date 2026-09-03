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
    user: {
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
  withoutUserRunasCookies: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

const ownerSession = { user: { id: 'owner-1', email: 'owner@example.com' } }

describe('POST /api/me/user/[userId]/switch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authorization', () => {
    it('returns 404 when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      const response = await handler(
        { query: { userId: 'user-999' } },
        ownerSession
      )

      expect(response.status).toBe(404)
    })

    it('returns 403 when non-admin tries to switch to a user not their child', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-other',
        parentId: 'someone-else',
        name: 'Other User',
        email: 'other@example.com',
      })

      const response = await handler(
        { query: { userId: 'user-other' } },
        ownerSession
      )

      expect(response.status).toBe(403)
    })

    it('allows non-admin to switch to their own child user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'child-1',
        parentId: 'owner-1',
        name: 'Child User',
        email: 'child@example.com',
      })

      const response = await handler(
        { query: { userId: 'child-1' } },
        ownerSession
      )

      expect(response.status).toBe(200)
    })
  })

  describe('cookie management', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'child-1',
        parentId: 'owner-1',
        name: 'Child User',
        email: 'child@example.com',
      })
    })

    it('sets RUNAS_USERID cookie on success', async () => {
      const response = await handler(
        { query: { userId: 'child-1' } },
        ownerSession
      )

      const setCookies = response.headers.getSetCookie()

      expect(
        setCookies.some((c) =>
          c.includes(`${RUNAS_USERID_COOKIE_NAME}=child-1`)
        )
      ).toBe(true)
    })

    it('sets RUNAS_USERNAME cookie on success', async () => {
      const response = await handler(
        { query: { userId: 'child-1' } },
        ownerSession
      )

      const setCookies = response.headers.getSetCookie()

      expect(
        setCookies.some((c) => c.includes(`${RUNAS_USERNAME_COOKIE_NAME}=`))
      ).toBe(true)
    })

    it('does not clear RUNAS_TEAMID cookie on success', async () => {
      const response = await handler(
        { query: { userId: 'child-1' } },
        ownerSession
      )

      const setCookies = response.headers.getSetCookie()

      expect(
        setCookies.some(
          (c) =>
            c.startsWith(`${RUNAS_TEAMID_COOKIE_NAME}=;`) &&
            c.toLowerCase().includes('expires=')
        )
      ).toBe(false)
    })

    it('does not clear RUNAS_TEAMNAME cookie on success', async () => {
      const response = await handler(
        { query: { userId: 'child-1' } },
        ownerSession
      )

      const setCookies = response.headers.getSetCookie()

      expect(
        setCookies.some(
          (c) =>
            c.startsWith(`${RUNAS_TEAMNAME_COOKIE_NAME}=;`) &&
            c.toLowerCase().includes('expires=')
        )
      ).toBe(false)
    })
  })
})
