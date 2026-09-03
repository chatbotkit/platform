/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      supportIntegration: {
        create: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

describe('/api/v1/integration/support/create', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({})

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a support integration and returns id', async () => {
    prisma.supportIntegration.create.mockResolvedValue({ id: 'sup-1' })

    const response = await handler(makeReq(), mockSession, {
      name: 'Support Integration',
      description: 'Routes support conversations',
      blueprintId: { id: 'bp-1' },
      botId: { id: 'bot-1' },
      email: 'support@example.com',
      trigger: 'message',
      meta: { env: 'test' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'sup-1' })
    expect(prisma.supportIntegration.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-123',
        name: 'Support Integration',
        description: 'Routes support conversations',
        blueprintId: 'bp-1',
        botId: 'bot-1',
        email: 'support@example.com',
        trigger: 'message',
        meta: { env: 'test' },
      },
      select: { id: true },
    })
  })

  it('uses plain blueprint and bot ids when provided as strings', async () => {
    prisma.supportIntegration.create.mockResolvedValue({ id: 'sup-2' })

    await handler(makeReq(), mockSession, {
      blueprintId: 'bp-raw',
      botId: 'bot-raw',
    })

    expect(prisma.supportIntegration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: 'bp-raw',
          botId: 'bot-raw',
        }),
      })
    )
  })

  it('propagates database errors', async () => {
    prisma.supportIntegration.create.mockRejectedValue(new Error('db failed'))

    await expect(handler(makeReq(), mockSession, {})).rejects.toThrow(
      'db failed'
    )
  })
})
