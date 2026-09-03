/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    webhook: {
      create: jest.fn(),
    },
  },
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

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
}))

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('ab'.repeat(32), 'hex')),
}))

describe('POST /api/v1/webhook/create', () => {
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates webhook with unique comma-separated events and generated secret', async () => {
    prisma.webhook.create.mockResolvedValue({ id: 'wh-1' })

    const response = await handler({}, session, {
      name: 'Orders webhook',
      description: 'Tracks events',
      request: { url: 'https://example.com/webhook', method: 'POST' },
      events: ['order.created', 'order.updated', 'order.created'],
      meta: { source: 'unit-test' },
    })

    expect(prisma.webhook.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        name: 'Orders webhook',
        description: 'Tracks events',
        request: { url: 'https://example.com/webhook', method: 'POST' },
        events: 'order.created,order.updated',
        secret: `wk-${'ab'.repeat(32)}`,
        meta: { source: 'unit-test' },
      }),
      select: { id: true },
    })
    expect(response).toEqual({ status: 200, body: { id: 'wh-1' } })
  })

  it('stores undefined events when events is null', async () => {
    prisma.webhook.create.mockResolvedValue({ id: 'wh-2' })

    await handler({}, session, {
      name: 'No events webhook',
      description: 'No event list',
      request: { url: 'https://example.com/webhook', method: 'POST' },
      events: null,
      meta: {},
    })

    expect(prisma.webhook.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        events: undefined,
      }),
      select: { id: true },
    })
  })
})
