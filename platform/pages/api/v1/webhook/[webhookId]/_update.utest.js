/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getMeta } from '@/lib/meta'

import handler from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      webhook: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta) => ({ ...meta, merged: true })),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('POST /api/v1/webhook/[webhookId]/update', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { webhookId: 'wh-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when webhook does not exist', async () => {
    prisma.webhook.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(req, session, {
      name: 'Webhook',
      description: 'desc',
      request: { url: 'https://example.com' },
      events: ['a'],
      meta: {},
    })

    expect(response).toEqual({ status: 404 })
    expect(prisma.webhook.update).not.toHaveBeenCalled()
  })

  it('returns 401 when webhook belongs to another user', async () => {
    prisma.webhook.findUniqueByIdentifier.mockResolvedValue({
      id: 'wh-1',
      userId: 'user-2',
      meta: {},
    })

    const response = await handler(req, session, {
      name: 'Webhook',
      description: 'desc',
      request: { url: 'https://example.com' },
      events: ['a'],
      meta: {},
    })

    expect(response).toEqual({ status: 401 })
    expect(prisma.webhook.update).not.toHaveBeenCalled()
  })

  it('updates webhook, deduplicates events, and merges meta', async () => {
    prisma.webhook.findUniqueByIdentifier.mockResolvedValue({
      id: 'wh-1',
      userId: 'user-1',
      meta: { prev: true },
    })

    const response = await handler(req, session, {
      name: 'Webhook',
      description: 'desc',
      request: { url: 'https://example.com' },
      events: ['event.a', 'event.b', 'event.a'],
      meta: { next: true },
    })

    expect(getMeta).toHaveBeenCalledWith({ next: true }, { prev: true })
    expect(prisma.webhook.update).toHaveBeenCalledWith({
      where: { id: 'wh-1' },
      data: {
        name: 'Webhook',
        description: 'desc',
        request: { url: 'https://example.com' },
        events: 'event.a,event.b',
        meta: { next: true, merged: true },
      },
    })
    expect(response).toEqual({ status: 200, body: { id: 'wh-1' } })
  })

  it('stores undefined events when events is null', async () => {
    prisma.webhook.findUniqueByIdentifier.mockResolvedValue({
      id: 'wh-1',
      userId: 'user-1',
      meta: {},
    })

    await handler(req, session, {
      name: 'Webhook',
      description: 'desc',
      request: { url: 'https://example.com' },
      events: null,
      meta: {},
    })

    expect(prisma.webhook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          events: undefined,
        }),
      })
    )
  })
})
