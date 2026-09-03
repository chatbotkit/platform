/**
 * @jest-environment node
 */
import handler from './unblock'

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
  unblockBot: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
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

describe('POST /api/v1/bot/[botId]/access/unblock', () => {
  const prisma = jest.requireMock('@/prisma/client').default
  const { unblockBot } = jest.requireMock('@/lib/bot.block')

  const mockSession = { user: { id: 'user_123' } }
  const mockReq = { query: { botId: 'bot_abc' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('unblocks the bot and returns its id', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue({
      id: 'bot_abc',
      userId: 'user_123',
    })

    const result = await handler(mockReq, mockSession)

    expect(unblockBot).toHaveBeenCalledWith('bot_abc')
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ id: 'bot_abc' })
  })

  it('returns 404 and does not unblock when the bot is not found', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(mockReq, mockSession)

    expect(result.status).toBe(404)
    expect(unblockBot).not.toHaveBeenCalled()
  })

  it('returns 403 and does not unblock when the user does not own the bot', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue({
      id: 'bot_abc',
      userId: 'other_user',
    })

    const result = await handler(mockReq, mockSession)

    expect(result.status).toBe(403)
    expect(unblockBot).not.toHaveBeenCalled()
  })
})
