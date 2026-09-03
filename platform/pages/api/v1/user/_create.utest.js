/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { revealUserPlan } from '@/lib/user.plan'
import { isUserIdentityEmail } from '@/lib/user.identity'

import handler from './create'
jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/zod', () => ({
  UserLimits: { parse: jest.fn((v) => v) },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const schemaMock = {
    object: jest.fn().mockReturnThis(),
    string: jest.fn().mockReturnThis(),
    email: jest.fn().mockReturnThis(),
    allow: jest.fn().mockReturnThis(),
    external: jest.fn().mockReturnThis(),
    zodSchema: jest.fn().mockReturnThis(),
  }

  return {
    __esModule: true,
    default: schemaMock,
    withSchema: (_schema, fn) => fn,
  }
})

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notAuthorized: (msg) => ({ status: 401, body: { message: msg } }),
}))

jest.mock('@/lib/user.plan', () => ({
  revealUserPlan: jest.fn(),
}))

jest.mock('@/lib/cuid', () => ({
  cuid: jest.fn(() => 'child_user_id'),
}))

jest.mock('@/schemas/alias', () => ({}))
jest.mock('@/schemas/description', () => ({}))
jest.mock('@/schemas/meta', () => ({}))
jest.mock('@/schemas/name', () => ({}))

describe('POST /api/v1/user/create', () => {
  const session = { user: { id: 'parent-user-1' } }

  const validBody = {
    name: 'Acme Corporation',
    description: 'Test user',
    email: 'contact@acme.example.com',
    image: null,
    limits: null,
    meta: null,
    alias: null,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authorization', () => {
    it('returns 401 when the session user is not the effective (parent) user', async () => {
      // @note only the parent user may create users;
      // this prevents impersonated or secondary sessions from doing so
      revealUserPlan.mockResolvedValue({
        effectiveUser: { id: 'some-other-user-id' },
      })

      const result = await handler(null, session, validBody)

      expect(result.status).toBe(401)
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('allows creation when session user matches effective user', async () => {
      revealUserPlan.mockResolvedValue({
        effectiveUser: { id: 'parent-user-1' },
      })

      prisma.user.create.mockResolvedValue({ id: 'new-user-id' })

      const result = await handler(null, session, validBody)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('new-user-id')
    })
  })

  describe('user creation', () => {
    beforeEach(() => {
      revealUserPlan.mockResolvedValue({
        effectiveUser: { id: 'parent-user-1' },
      })
    })

    it('sets parentId to the session user id', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-id' })

      await handler(null, session, validBody)

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentId: 'parent-user-1',
          }),
        })
      )
    })

    it('uses inherit values for the billing columns so the user shares parent billing', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-id' })

      await handler(null, session, validBody)

      const { data } = prisma.user.create.mock.calls[0][0]

      expect(data.billingSubscriptionId).toBe('inherit')
      expect(data.billingSubscriptionStatus).toBe('inherit')
      expect(data.billingCustomerId).toMatch(/^inherit@/)
    })

    it('stores the contact email in parentContextEmail (not email field)', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-id' })

      const body = { ...validBody, email: 'customer@company.com' }

      await handler(null, session, body)

      const { data } = prisma.user.create.mock.calls[0][0]

      // @note email gets a stable database-only identity; the customer-facing
      // address is stored as parentContextEmail for display and communication
      expect(data.parentContextEmail).toBe('customer@company.com')
      expect(data.email).not.toBe('customer@company.com')
      expect(data.id).toBe('child_user_id')
      expect(data.email).toMatch(/^child_user_id@/)
      expect(isUserIdentityEmail(data.email)).toBe(true)
    })

    it('sets parentContextName from the name field', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-id' })

      const body = { ...validBody, name: 'Widget Co' }

      await handler(null, session, body)

      const { data } = prisma.user.create.mock.calls[0][0]

      expect(data.parentContextName).toBe('Widget Co')
    })

    it('sets billingSubscriptionStartedAt and billingSubscriptionTrialedAt to now', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-id' })

      const before = Date.now()

      await handler(null, session, validBody)

      const after = Date.now()
      const { data } = prisma.user.create.mock.calls[0][0]

      expect(data.billingSubscriptionStartedAt.getTime()).toBeGreaterThanOrEqual(
        before
      )
      expect(data.billingSubscriptionStartedAt.getTime()).toBeLessThanOrEqual(
        after
      )
      expect(data.billingSubscriptionTrialedAt.getTime()).toBeGreaterThanOrEqual(
        before
      )
      expect(data.billingSubscriptionTrialedAt.getTime()).toBeLessThanOrEqual(
        after
      )
    })

    it('passes optional limits to the user create call', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-id' })

      const limits = { database: { datasets: 10 } }
      const body = { ...validBody, limits }

      await handler(null, session, body)

      const { data } = prisma.user.create.mock.calls[0][0]

      expect(data.limits).toEqual(limits)
    })

    it('passes null limits when not provided', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-id' })

      await handler(null, session, { ...validBody, limits: null })

      const { data } = prisma.user.create.mock.calls[0][0]

      expect(data.limits).toBeNull()
    })

    it('returns only the id of the created user', async () => {
      prisma.user.create.mockResolvedValue({ id: 'created-user-xyz' })

      const result = await handler(null, session, validBody)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'created-user-xyz' })
    })

    it('selects only id from the create result', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-id' })

      await handler(null, session, validBody)

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true },
        })
      )
    })
  })
})
