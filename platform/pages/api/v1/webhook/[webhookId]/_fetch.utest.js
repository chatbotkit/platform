/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    webhook: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('GET /api/v1/webhook/[webhookId]/fetch', () => {
  const req = { query: { webhookId: 'wh-1' } }
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns webhook, strips userId, and parses events', async () => {
    prisma.webhook.findUniqueByIdentifier.mockResolvedValue({
      id: 'wh-1',
      userId: 'user-1',
      events: 'open,close',
      name: 'Webhook',
      description: '',
      request: {},
      meta: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await handler(req, session)

    expect(prisma.webhook.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'wh-1',
      expect.objectContaining({
        select: expect.objectContaining({ id: true, userId: true }),
      })
    )
    expect(result.status).toBe(200)
    expect(result.body.userId).toBeUndefined()
    expect(result.body.events).toEqual(['open', 'close'])
  })

  it('returns 404 when webhook is missing', async () => {
    prisma.webhook.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
  })

  it('returns 401 when session user does not own webhook', async () => {
    prisma.webhook.findUniqueByIdentifier.mockResolvedValue({
      id: 'wh-1',
      userId: 'user-2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
  })

  it('propagates lookup errors', async () => {
    prisma.webhook.findUniqueByIdentifier.mockRejectedValue(
      new Error('lookup failed')
    )

    await expect(handler(req, session)).rejects.toThrow('lookup failed')
  })
})
