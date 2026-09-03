/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { isBillingConfigured } from '@/lib/billing.core'
import { deleteUser } from '@/lib/user.delete'

import handler, { bodySchema } from './delete'

import { createMocks } from 'node-mocks-http'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
    },
  },
}))

jest.mock('@/lib/admin', () => ({
  withAdminSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const actual = jest.requireActual('@/lib/joi.handler')

  return {
    __esModule: true,
    ...actual,
    withSchema: (schema, fn) => {
      return async function (req, ...rest) {
        try {
          const body =
            (await schema.validateAsync(req.body, {
              context: { session: rest[0] },
            })) || {}

          return await fn(req, ...rest, body)
        } catch {
          return { status: 400 }
        }
      }
    },
  }
})

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  badRequest: (message) => ({ status: 400, body: { message } }),
  notFound: () => ({ status: 404 }),
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/lib/user.delete', () => ({
  deleteUser: jest.fn(),
}))

jest.mock('@/lib/billing.core', () => ({
  isBillingConfigured: jest.fn(() => true),
}))

describe('POST /api/admin/user/[userId]/delete', () => {
  const session = {
    user: {
      id: 'admin-123',
      role: 'admin',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should default deleteBillingCustomer to false', async () => {
    expect(await bodySchema.validateAsync({})).toEqual({
      deleteBillingCustomer: false,
      sendDeletionEmail: true,
    })
  })

  it('should pass delete options from the validated body', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-123',
      billingSubscriptionId: null,
    })

    const { req } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
      body: { deleteBillingCustomer: true, sendDeletionEmail: false },
    })

    const result = await handler(req, session)

    expect(result.status).toBe(200)
    expect(deleteUser).toHaveBeenCalledWith('user-123', {
      deleteBillingCustomer: true,
      sendDeletionEmail: false,
    })
  })

  it('should reject deleteBillingCustomer when billing is not configured', async () => {
    isBillingConfigured.mockReturnValueOnce(false)

    const { req } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
      body: { deleteBillingCustomer: true },
    })

    const result = await handler(req, session)

    expect(result.status).toBe(400)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('should reject invalid delete options', async () => {
    const { req } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
      body: { deleteBillingCustomer: 'yes', sendDeletionEmail: 'no' },
    })

    const result = await handler(req, session)

    expect(result.status).toBe(400)
    expect(deleteUser).not.toHaveBeenCalled()
  })
})
