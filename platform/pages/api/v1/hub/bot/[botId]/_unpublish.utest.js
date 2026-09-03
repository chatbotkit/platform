/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './unpublish'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      bot: {
        findUniqueByIdentifier: jest.fn(),
      },
      hubBotPage: {
        delete: jest.fn(),
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
}))

describe('/api/v1/hub/bot/[botId]/unpublish', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { botId: 'bot_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 and deleted hub page id for owner', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue({
      id: 'bot_1',
      userId: 'user_1',
    })
    prisma.hubBotPage.delete.mockResolvedValue({ id: 'hub_page_1' })

    const result = await handler(req, session, {})

    expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'bot_1'
    )
    expect(prisma.hubBotPage.delete).toHaveBeenCalledWith({
      where: { botId: 'bot_1' },
      select: { id: true },
    })
    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_page_1', botId: 'bot_1' },
    })
  })

  it('returns 404 when bot is missing', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.hubBotPage.delete).not.toHaveBeenCalled()
  })

  it('returns 401 for non-owner user', async () => {
    prisma.bot.findUniqueByIdentifier.mockResolvedValue({
      id: 'bot_1',
      userId: 'owner_2',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.hubBotPage.delete).not.toHaveBeenCalled()
  })

  it('propagates prisma lookup errors', async () => {
    prisma.bot.findUniqueByIdentifier.mockRejectedValue(new Error('db failed'))

    await expect(handler(req, session, {})).rejects.toThrow('db failed')
  })

  it('validates empty body schema', () => {
    expect(bodySchema.validate({}).error).toBeUndefined()
  })
})
