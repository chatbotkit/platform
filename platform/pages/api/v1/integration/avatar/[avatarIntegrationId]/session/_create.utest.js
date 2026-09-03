/**
 * @jest-environment node
 */
import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { canUseAvatarIntegration } from '@/lib/avatar.access'
import { signAvatarSession } from '@/lib/avatar.session'
import { checkLimits } from '@/lib/limit.core'
import { getSession } from '@/lib/session.get'
import { fastGetUserById } from '@/lib/user.get'

import { createBotRealtimeWebsocketSession } from '@/pages/api/v1/bot/[botId]/realtime/websocket/create'

import handler, { createAvatarIntegrationRealtimeSession } from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    avatarIntegration: {
      findUnique: jest.fn(),
    },
    bot: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/avatar.access', () => ({
  canUseAvatarIntegration: jest.fn(),
}))

jest.mock('@/lib/avatar.session', () => ({
  signAvatarSession: jest.fn(),
}))

jest.mock('@/lib/session.get', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => ({
  checkLimits: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  getRandomId: jest.fn(() => 'session-1'),
}))

jest.mock('@/lib/debug', () => ({
  createSpan: jest.fn(() => ({
    finish: jest.fn(),
  })),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query?.[key]),
}))

jest.mock('@/lib/response', () => ({
  badRequest: (data) => ({ status: 400, body: data }),
  conflict: (message) => ({ status: 409, body: { message } }),
  notAuthenticated: () => ({ status: 401 }),
  notAuthorized: () => ({ status: 403 }),
  notFound: () => ({ status: 404 }),
  ok: (data) => ({ status: 200, body: data }),
  respondFromError: (error) => ({ status: 500, error }),
}))

jest.mock(
  '@/pages/api/v1/bot/[botId]/realtime/websocket/create',
  () => ({
    createBotRealtimeWebsocketSession: jest.fn(),
  })
)

describe('POST /api/v1/integration/avatar/[avatarIntegrationId]/session/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    signAvatarSession.mockResolvedValue('signed-avatar-session')
    createBotRealtimeWebsocketSession.mockResolvedValue({
      websocket: 'wss://example.test/avatar',
    })
    fastGetUserById.mockResolvedValue({
      id: 'user-1',
    })
    prisma.bot.findUnique.mockResolvedValue({
      id: 'bot-1',
      userId: 'user-1',
    })
    canUseAvatarIntegration.mockResolvedValue(true)
    getSession.mockResolvedValue({
      user: {
        id: 'user-1',
      },
    })
    checkLimits.mockResolvedValue(undefined)
  })

  it('returns 404 when the integration does not exist', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue(null)

    await expect(
      createAvatarIntegrationRealtimeSession({
        avatarIntegrationId: 'avatar-1',
      })
    ).resolves.toEqual({ status: 404 })
  })

  it('returns 401 for a non-public integration when no request is provided', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'private',
    })

    await expect(
      createAvatarIntegrationRealtimeSession({
        avatarIntegrationId: 'avatar-1',
      })
    ).resolves.toEqual({ status: 401 })
  })

  it('returns 403 when the authenticated user cannot use the integration', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'private',
    })

    canUseAvatarIntegration.mockResolvedValue(false)

    await expect(
      createAvatarIntegrationRealtimeSession({
        avatarIntegrationId: 'avatar-1',
        req: {},
      })
    ).resolves.toEqual({ status: 403 })
  })

  it('returns 409 when the integration is missing a bot', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: null,
      visibility: 'public',
    })

    await expect(
      createAvatarIntegrationRealtimeSession({
        avatarIntegrationId: 'avatar-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 409,
      body: {
        message: 'Avatar integration requires a bot',
      },
    })
  })

  it('returns 400 when the integration owner cannot be found', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'public',
    })

    fastGetUserById.mockResolvedValue(null)

    await expect(
      createAvatarIntegrationRealtimeSession({
        avatarIntegrationId: 'avatar-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 400,
      body: {
        message: 'Avatar integration owner not found',
        code: 'AVATAR_INTEGRATION_USER_NOT_FOUND',
      },
    })
  })

  it('returns 409 when the bot does not belong to the integration owner', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'public',
    })

    prisma.bot.findUnique.mockResolvedValue({
      id: 'bot-1',
      userId: 'user-2',
    })

    await expect(
      createAvatarIntegrationRealtimeSession({
        avatarIntegrationId: 'avatar-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 409,
      body: {
        message: 'Avatar integration requires a valid bot',
      },
    })
  })

  it('returns a signed frame session for a public integration', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'public',
    })

    await expect(
      createAvatarIntegrationRealtimeSession({
        avatarIntegrationId: 'avatar-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 200,
      body: {
        avatarIntegrationId: 'avatar-1',
        websocket: 'wss://example.test/avatar',
        session: 'signed-avatar-session',
      },
    })

    expect(createBotRealtimeWebsocketSession).toHaveBeenCalledWith({
      session: expect.objectContaining({
        id: 'session-1',
      }),
      bot: {
        id: 'bot-1',
        userId: 'user-1',
      },
      durationInSeconds: ONE_HOUR_IN_SECONDS,
      meta: {
        app: 'avatar',
        avatarIntegrationId: 'avatar-1',
      },
    })

    expect(signAvatarSession).toHaveBeenCalledWith(
      {
        avatarIntegrationId: 'avatar-1',
        websocket: 'wss://example.test/avatar',
      },
      ONE_HOUR_IN_SECONDS
    )
  })

  it('rate limits against the owner and skips the realtime session when limits are reached', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'public',
    })

    checkLimits.mockRejectedValue(new Error('limits reached'))

    const result = await createAvatarIntegrationRealtimeSession({
      avatarIntegrationId: 'avatar-1',
      req: {},
    })

    expect(result.status).toBe(500)
    expect(checkLimits).toHaveBeenCalledWith(
      ['rate/conversation', 'conversation', 'message'],
      { id: 'user-1' }
    )
    expect(createBotRealtimeWebsocketSession).not.toHaveBeenCalled()
  })

  it('uses the route handler to resolve the integration id from the query', async () => {
    prisma.avatarIntegration.findUnique.mockResolvedValue({
      id: 'avatar-1',
      userId: 'user-1',
      botId: 'bot-1',
      visibility: 'public',
    })

    await expect(
      handler({
        query: {
          avatarIntegrationId: 'avatar-1',
        },
      })
    ).resolves.toEqual({
      status: 200,
      body: {
        avatarIntegrationId: 'avatar-1',
        websocket: 'wss://example.test/avatar',
        session: 'signed-avatar-session',
      },
    })
  })
})
