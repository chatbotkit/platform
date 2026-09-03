/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import { getConversationDetails } from '@/lib/bot.conversation'
import { createConversation } from '@/lib/conversation.create'
import { captureError } from '@/lib/error'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      hubBotPage: {
        findUnique: jest.fn(),
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

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
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
  throwNotFound: () => ({ status: 404 }),
  respondFromError: (error) => ({
    status: 500,
    body: { message: error.message },
  }),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureError: jest.fn(),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(),
}))

jest.mock(
  '@/pages/api/v1/conversation/[conversationId]/session/create',
  () => ({
    createConversationSessionToken: jest.fn(),
  })
)

const prisma = require('@/prisma/client').default

describe('POST /api/v1/hub/bot/[botId]/session/create', () => {
  const req = { query: { botId: 'hub-bot-1' } }
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getConversationDetails.mockReturnValue({ backstory: 'bot backstory' })
    createConversation.mockResolvedValue({ id: 'conv-1' })
    createConversationSessionToken.mockResolvedValue('token-1')
  })

  it('returns 404 when hub bot page is missing', async () => {
    prisma.hubBotPage.findUnique.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
  })

  it('returns 404 when hub bot page has no bot relation', async () => {
    prisma.hubBotPage.findUnique.mockResolvedValue({
      id: 'hub-bot-1',
      bot: null,
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
  })

  it('creates conversation and token when bot exists', async () => {
    prisma.hubBotPage.findUnique.mockResolvedValue({
      id: 'hub-bot-1',
      bot: { id: 'bot-1', userId: 'owner-1' },
    })

    const result = await handler(req, session, {})

    expect(getConversationDetails).toHaveBeenCalledWith({
      bot: { id: 'bot-1', userId: 'owner-1' },
    })
    expect(createConversation).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        backstory: 'bot backstory',
        meta: { app: 'hub' },
      }),
      { bpacc: true }
    )
    expect(createConversationSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        userId: 'user-1',
      })
    )
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      id: 'conv-1',
      token: 'token-1',
      expiresAt: expect.any(Number),
    })
  })

  it('captures and returns an error when conversation creation fails', async () => {
    const error = new Error('conversation failed')

    prisma.hubBotPage.findUnique.mockResolvedValue({
      id: 'hub-bot-1',
      bot: { id: 'bot-1', userId: 'owner-1' },
    })
    createConversation.mockRejectedValue(error)

    const result = await handler(req, session, {})

    expect(captureError).toHaveBeenCalledWith(error)
    expect(result).toEqual({
      status: 500,
      body: { message: 'conversation failed' },
    })
  })
})
