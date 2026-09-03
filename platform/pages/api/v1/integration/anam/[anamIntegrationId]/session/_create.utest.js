/**
 * @jest-environment node
 */
import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { canUseAnamIntegration } from '@/lib/anam.access'
import { signAnamSession } from '@/lib/anam.session'
import { createConversation } from '@/lib/conversation.create'
import fetch from '@/lib/fetch'
import { checkLimits } from '@/lib/limit.core'
import { getSession } from '@/lib/session.get'
import { fastGetUserById } from '@/lib/user.get'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'

import handler, { createAnamIntegrationSession } from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    anamIntegration: {
      findUnique: jest.fn(),
    },
    bot: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/anam.access', () => ({
  canUseAnamIntegration: jest.fn(),
}))

jest.mock('@/lib/anam.session', () => ({
  signAnamSession: jest.fn(),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(),
}))

jest.mock('@/lib/fetch', () => jest.fn())

jest.mock('@/lib/limit.core', () => ({
  checkLimits: jest.fn(),
}))

jest.mock('@/lib/session.get', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
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
  '@/pages/api/v1/conversation/[conversationId]/session/create',
  () => ({
    createConversationSessionToken: jest.fn(),
  })
)

describe('POST /api/v1/integration/anam/[anamIntegrationId]/session/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    canUseAnamIntegration.mockResolvedValue(true)
    getSession.mockResolvedValue({
      user: {
        id: 'user-1',
      },
    })
    checkLimits.mockResolvedValue(undefined)
    fastGetUserById.mockResolvedValue({
      id: 'user-1',
    })
    prisma.bot.findUnique.mockResolvedValue({
      id: 'bot-1',
      userId: 'user-1',
    })
    signAnamSession.mockResolvedValue('signed-anam-session')
    createConversation.mockResolvedValue({
      id: 'conversation-1',
    })
    createConversationSessionToken.mockResolvedValue('conversation-token')
    fetch
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            name: 'Persona',
            avatar: { id: 'avatar-123' },
            voice: { id: 'voice-123' },
          })
        ),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            sessionToken: 'anam-session-token',
          })
        ),
      })
  })

  function makeIntegration(overrides = {}) {
    return {
      id: 'anam-1',
      userId: 'user-1',
      botId: 'bot-1',
      apiKey: 'api-key',
      personaId: 'persona-1',
      visibility: 'public',
      ...overrides,
    }
  }

  it('returns 404 when the integration does not exist', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(null)

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
      })
    ).resolves.toEqual({ status: 404 })
  })

  it('returns 401 for a non-public integration when no request is provided', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(
      makeIntegration({ visibility: 'private' })
    )

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
      })
    ).resolves.toEqual({ status: 401 })
  })

  it('returns 403 when the authenticated user cannot use the integration', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(
      makeIntegration({ visibility: 'private' })
    )
    canUseAnamIntegration.mockResolvedValue(false)

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
        req: {},
      })
    ).resolves.toEqual({ status: 403 })
  })

  it('returns 409 when the integration is missing an api key', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(
      makeIntegration({ apiKey: null })
    )

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 409,
      body: {
        message: 'Anam integration requires an API key',
      },
    })
  })

  it('returns 409 when the integration is missing a persona', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(
      makeIntegration({ personaId: null })
    )

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 409,
      body: {
        message: 'Anam integration requires a persona',
      },
    })
  })

  it('returns 409 when the integration is missing a bot', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(
      makeIntegration({ botId: null })
    )

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 409,
      body: {
        message: 'Anam integration requires a bot',
      },
    })
  })

  it('returns 400 when the persona fetch fails', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(makeIntegration())
    fetch.mockReset()
    fetch.mockResolvedValue({
      ok: false,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          message: 'persona failed',
        })
      ),
    })

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 400,
      body: {
        message: 'persona failed',
        code: 'ANAM_PERSONA_FETCH_FAILED',
      },
    })
  })

  it('returns 409 when the persona is missing an avatar or voice', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(makeIntegration())
    fetch.mockReset()
    fetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          name: 'Persona',
          avatar: { id: 'avatar-123' },
        })
      ),
    })

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 409,
      body: {
        message: 'Anam persona requires an avatar and voice',
      },
    })
  })

  it('returns 400 when the upstream session token response is unsuccessful', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(makeIntegration())
    fetch.mockReset()
    fetch
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            name: 'Persona',
            avatar: { id: 'avatar-123' },
            voice: { id: 'voice-123' },
          })
        ),
      })
      .mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            message: 'session failed',
          })
        ),
      })

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 400,
      body: {
        message: 'session failed',
        code: 'ANAM_SESSION_TOKEN_FAILED',
      },
    })
  })

  it('returns 400 when the upstream session token is missing from an otherwise successful response', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(makeIntegration())
    fetch.mockReset()
    fetch
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            name: 'Persona',
            avatar: { id: 'avatar-123' },
            voice: { id: 'voice-123' },
          })
        ),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            notSessionToken: true,
          })
        ),
      })

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 400,
      body: {
        message: 'Failed to create Anam session token',
        code: 'ANAM_SESSION_TOKEN_FAILED',
      },
    })
  })

  it('returns a signed frame session for a public integration', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(makeIntegration())

    const result = await createAnamIntegrationSession({
      anamIntegrationId: 'anam-1',
      req: {},
    })

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      anamIntegrationId: 'anam-1',
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
      session: 'signed-anam-session',
    })
    expect(result.body).not.toHaveProperty('id')
    expect(result.body).not.toHaveProperty('expiresAt')

    expect(createConversation).toHaveBeenCalledWith('user-1', {
      botId: 'bot-1',
      meta: {
        app: 'anam',
        anam: {
          integrationId: 'anam-1',
        },
      },
    })

    expect(createConversationSessionToken).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      userId: 'user-1',
      durationInSeconds: ONE_HOUR_IN_SECONDS,
      extra: {
        options: {
          engine: {
            features: [],
          },
        },
      },
    })

    expect(signAnamSession).toHaveBeenCalledWith(
      expect.objectContaining({
        anamIntegrationId: 'anam-1',
        conversationId: 'conversation-1',
        token: 'conversation-token',
        anamSessionToken: 'anam-session-token',
      }),
      ONE_HOUR_IN_SECONDS
    )
  })

  it('returns 400 when the integration owner cannot be found', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(makeIntegration())
    fastGetUserById.mockResolvedValue(null)

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 400,
      body: {
        message: 'Anam integration owner not found',
        code: 'ANAM_INTEGRATION_USER_NOT_FOUND',
      },
    })
  })

  it('returns 409 when the bot does not belong to the integration owner', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(makeIntegration())
    prisma.bot.findUnique.mockResolvedValue({
      id: 'bot-1',
      userId: 'user-2',
    })

    await expect(
      createAnamIntegrationSession({
        anamIntegrationId: 'anam-1',
        req: {},
      })
    ).resolves.toEqual({
      status: 409,
      body: {
        message: 'Anam integration requires a valid bot',
      },
    })
  })

  it('rate limits against the owner and skips the upstream calls when limits are reached', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(makeIntegration())
    checkLimits.mockRejectedValue(new Error('limits reached'))

    const result = await createAnamIntegrationSession({
      anamIntegrationId: 'anam-1',
      req: {},
    })

    expect(result.status).toBe(500)
    expect(checkLimits).toHaveBeenCalledWith(
      ['rate/conversation', 'conversation', 'message'],
      { id: 'user-1' }
    )
    expect(fetch).not.toHaveBeenCalled()
    expect(createConversation).not.toHaveBeenCalled()
  })

  it('uses the route handler to resolve the integration id from the query', async () => {
    prisma.anamIntegration.findUnique.mockResolvedValue(makeIntegration())

    await expect(
      handler({
        query: {
          anamIntegrationId: 'anam-1',
        },
      })
    ).resolves.toMatchObject({
      status: 200,
      body: {
        anamIntegrationId: 'anam-1',
        session: 'signed-anam-session',
      },
    })
  })
})
