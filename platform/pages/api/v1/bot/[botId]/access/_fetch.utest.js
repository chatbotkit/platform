/**
 * @jest-environment node
 */
import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      bot: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/bot.block', () => ({
  getBotBlock: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('GET /api/v1/bot/[botId]/access/fetch', () => {
  const prisma = jest.requireMock('@/prisma/client').default
  const { getBotBlock } = jest.requireMock('@/lib/bot.block')

  const mockSession = { user: { id: 'user_123' } }
  const mockReq = { query: { botId: 'bot_abc' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the block when the bot is blocked', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue({
      id: 'bot_abc',
      userId: 'user_123',
    })
    getBotBlock.mockResolvedValue({ reason: 'blocked', ttl: 120 })

    const result = await handler(mockReq, mockSession)

    expect(getBotBlock).toHaveBeenCalledWith('bot_abc')
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ block: { reason: 'blocked', ttl: 120 } })
  })

  it('returns a null block when the bot is not blocked', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue({
      id: 'bot_abc',
      userId: 'user_123',
    })
    getBotBlock.mockResolvedValue(null)

    const result = await handler(mockReq, mockSession)

    expect(result.body).toEqual({ block: null })
  })

  it('returns 404 when the bot is not found', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(mockReq, mockSession)

    expect(result.status).toBe(404)
    expect(getBotBlock).not.toHaveBeenCalled()
  })

  it('returns 403 when the user does not own the bot', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue({
      id: 'bot_abc',
      userId: 'other_user',
    })

    const result = await handler(mockReq, mockSession)

    expect(result.status).toBe(403)
    expect(getBotBlock).not.toHaveBeenCalled()
  })
})
