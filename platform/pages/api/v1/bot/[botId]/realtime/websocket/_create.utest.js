/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, {
  bodySchema,
  createBotRealtimeWebsocketSession,
  withBot,
} from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    bot: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(() => ({ name: 'Bot conversation' })),
}))

jest.mock('@/lib/cache', () => ({
  bypassCache: jest.fn((_key, _ttl, fn) => fn()),
}))

jest.mock('@/lib/contact.create', () => ({
  ensureUntrustedContact: jest.fn(),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    log: jest.fn(),
  })),
  assert: jest.fn((condition, message) => {
    if (!condition) {
      throw new Error(message)
    }
  }),
  createSpan: jest.fn(() => ({ finish: jest.fn() })),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureError: jest.fn(),
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  getRandomId: jest.fn(() => 'session-random'),
}))

jest.mock('@/lib/user.get', () => ({
  cacheUser: jest.fn(),
  fastGetUserById: jest.fn(),
}))

jest.mock(
  '@/pages/api/v1/conversation/[conversationId]/realtime/websocket/create',
  () => ({
    createRealtimeWebsocketConversation: jest.fn(),
  })
)

const { bypassCache } = require('@/lib/cache')
const { ensureUntrustedContact } = require('@/lib/contact.create')
const { createConversation } = require('@/lib/conversation.create')
const { getSoftSession } = require('@/lib/session.get')
const { cacheUser, fastGetUserById } = require('@/lib/user.get')
const {
  createRealtimeWebsocketConversation,
} = require('@/pages/api/v1/conversation/[conversationId]/realtime/websocket/create')

const publicBot = {
  id: 'bot-1',
  userId: 'owner-1',
  visibility: 'public',
}

const owner = {
  id: 'owner-1',
  email: 'owner@example.com',
}

describe('POST /api/v1/bot/[botId]/realtime/websocket/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    bypassCache.mockImplementation((_key, _ttl, fn) => fn())
    fastGetUserById.mockResolvedValue(owner)
  })

  it('validates body schema for duration and messages', () => {
    expect(
      bodySchema.validate({ durationInSeconds: 1800 }).error
    ).toBeUndefined()
    expect(bodySchema.validate({ durationInSeconds: 1799 }).error).toBeDefined()
    expect(
      bodySchema.validate({ messages: 'not-an-array' }).error
    ).toBeDefined()
  })

  it('resolves public bot sessions without a user session', async () => {
    prisma.bot.findUnique.mockResolvedValue(publicBot)

    const inner = jest.fn(async () => new Response(null, { status: 204 }))
    const wrapped = withBot(inner)
    const req = { query: { botId: 'bot-1' } }

    const response = await wrapped(req)

    expect(response.status).toBe(204)
    expect(getSoftSession).not.toHaveBeenCalled()
    expect(prisma.bot.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bot-1' },
      })
    )
    expect(cacheUser).toHaveBeenCalledWith(owner)
    expect(inner).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        id: 'session-random',
        user: owner,
      }),
      publicBot
    )
  })

  it('rejects private bot sessions for non-owners', async () => {
    prisma.bot.findUnique.mockResolvedValue({
      ...publicBot,
      visibility: 'private',
    })
    getSoftSession.mockResolvedValue({ user: { id: 'other-user' } })

    const wrapped = withBot(jest.fn())

    await expect(wrapped({ query: { botId: 'bot-1' } })).rejects.toMatchObject({
      code: 'NOT_AUTHORIZED',
    })
  })

  it('creates conversation and websocket session details', async () => {
    ensureUntrustedContact.mockResolvedValue({ id: 'contact-1' })
    createConversation.mockResolvedValue({
      id: 'conversation-1',
      messages: [{ id: 'message-1' }],
    })
    createRealtimeWebsocketConversation.mockResolvedValue({ token: 'ws-token' })

    const session = { user: { id: 'user-1' } }

    const result = await createBotRealtimeWebsocketSession({
      session,
      bot: publicBot,
      durationInSeconds: 1800,
      contact: {
        name: 'Ada',
        email: 'ada@example.com',
      },
      messages: [{ type: 'user', text: 'Hello' }],
      meta: { source: 'test' },
    })

    expect(ensureUntrustedContact).toHaveBeenCalledWith(
      { id: 'owner-1' },
      {
        name: 'Ada',
        email: 'ada@example.com',
      }
    )
    expect(createConversation).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        contactId: 'contact-1',
        messages: [{ type: 'user', text: 'Hello' }],
        meta: {
          source: 'test',
          app: 'bot',
          botId: 'bot-1',
        },
        resources: [{ type: 'bot', instance: publicBot }],
      })
    )
    expect(createRealtimeWebsocketConversation).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      userId: 'user-1',
      durationInSeconds: 1800,
      session,
    })
    expect(result).toEqual(
      expect.objectContaining({
        id: 'bot-1',
        conversationId: 'conversation-1',
        websocket: { token: 'ws-token' },
        messages: [{ id: 'message-1' }],
      })
    )
  })

  it('uses the default websocket duration through the route handler', async () => {
    prisma.bot.findUnique.mockResolvedValue(publicBot)
    createConversation.mockResolvedValue({
      id: 'conversation-1',
      messages: [],
    })
    createRealtimeWebsocketConversation.mockResolvedValue({ token: 'ws-token' })

    const response = await handler({ query: { botId: 'bot-1' } }, {})
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(createRealtimeWebsocketConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        durationInSeconds: 3600,
      })
    )
    expect(data).toEqual(
      expect.objectContaining({
        id: 'bot-1',
        conversationId: 'conversation-1',
        websocket: { token: 'ws-token' },
      })
    )
  })
})
