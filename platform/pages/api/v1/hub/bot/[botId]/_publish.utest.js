/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { detectContentAbuse } from '@/lib/moderation'
import { isVip } from '@/lib/user.type'

import handler from './publish'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      bot: {
        findUniqueByIdentifier: jest.fn(),
      },
      hubBotPage: {
        upsert: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

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
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
  badRequest: (msg) => ({ status: 400, body: msg }),
}))

jest.mock('@/lib/moderation', () => ({
  detectContentAbuse: jest.fn(),
}))

jest.mock('@/lib/user.type', () => ({
  isVip: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  joinTrimmedNotEmpty: jest.fn((...args) =>
    args[0].filter(Boolean).join('\n\n')
  ),
}))

describe('/api/v1/hub/bot/[botId]/publish', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { botId: 'bot_1' } }

  const bot = {
    id: 'bot_1',
    userId: 'user_1',
    name: 'My Bot',
    description: 'A helpful bot',
    backstory: 'You are a helpful assistant',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    detectContentAbuse.mockResolvedValue({ flagged: false, categories: [] })
    isVip.mockReturnValue(false)
  })

  it('returns 404 when bot does not exist', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.hubBotPage.upsert).not.toHaveBeenCalled()
  })

  it('returns 401 when bot belongs to a different user', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue({
      ...bot,
      userId: 'other_user',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.hubBotPage.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 when content moderation flags the content', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(bot)
    detectContentAbuse.mockResolvedValue({
      flagged: true,
      categories: ['hate', 'violence'],
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({
      status: 400,
      body: 'Improper entry violating categories: hate, violence',
    })
    expect(prisma.hubBotPage.upsert).not.toHaveBeenCalled()
  })

  it('publishes with rank 0 for a regular (non-VIP) user', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(bot)
    prisma.hubBotPage.upsert.mockResolvedValue({ id: 'hub_1' })
    isVip.mockReturnValue(false)

    const body = {
      name: 'Hub Name',
      description: 'Hub Desc',
      icon: null,
      meta: null,
      slug: null,
    }
    const result = await handler(req, session, body)

    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_1', botId: 'bot_1' },
    })

    const upsertCall = prisma.hubBotPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.rank).toBe(0)
    expect(upsertCall.update.rank).toBe(0)
  })

  it('publishes with rank 1000 for a VIP user', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(bot)
    prisma.hubBotPage.upsert.mockResolvedValue({ id: 'hub_1' })
    isVip.mockReturnValue(true)

    const body = {
      name: 'Hub Name',
      description: 'Hub Desc',
      icon: null,
      meta: null,
      slug: null,
    }
    const result = await handler(req, session, body)

    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_1', botId: 'bot_1' },
    })

    const upsertCall = prisma.hubBotPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.rank).toBe(1000)
    expect(upsertCall.update.rank).toBe(1000)
  })

  it('falls back to bot name and description when body fields are absent', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(bot)
    prisma.hubBotPage.upsert.mockResolvedValue({ id: 'hub_1' })

    const result = await handler(req, session, {})

    expect(result.status).toBe(200)

    const upsertCall = prisma.hubBotPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.name).toBe(bot.name)
    expect(upsertCall.create.description).toBe(bot.description)
    expect(upsertCall.update.name).toBe(bot.name)
    expect(upsertCall.update.description).toBe(bot.description)
  })

  it('uses body name and description when provided, overriding bot defaults', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(bot)
    prisma.hubBotPage.upsert.mockResolvedValue({ id: 'hub_1' })

    const body = { name: 'Custom Name', description: 'Custom Desc' }

    await handler(req, session, body)

    const upsertCall = prisma.hubBotPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.name).toBe('Custom Name')
    expect(upsertCall.create.description).toBe('Custom Desc')
  })

  it('includes bot backstory in content moderation check', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(bot)
    prisma.hubBotPage.upsert.mockResolvedValue({ id: 'hub_1' })

    await handler(req, session, {})

    expect(detectContentAbuse).toHaveBeenCalledWith(
      expect.stringContaining(bot.backstory)
    )
  })

  it('upserts with correct botId as the where condition', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(bot)
    prisma.hubBotPage.upsert.mockResolvedValue({ id: 'hub_1' })

    await handler(req, session, {})

    const upsertCall = prisma.hubBotPage.upsert.mock.calls[0][0]

    expect(upsertCall.where).toEqual({ botId: bot.id })
    expect(upsertCall.create.botId).toBe(bot.id)
    expect(upsertCall.create.userId).toBe(session.user.id)
  })

  it('propagates database lookup errors', async () => {
    prisma.bot.findUniqueByIdentifier.mockRejectedValue(new Error('db error'))

    await expect(handler(req, session, {})).rejects.toThrow('db error')
  })
})
