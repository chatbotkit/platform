/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from '@/prisma/client'

import handler, { withBot } from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    bot: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/cache', () => ({
  // @note bypassCache is mocked to call the factory directly without caching
  bypassCache: jest.fn((_key, _ttl, factory) => factory()),
}))

jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
  cacheUser: jest.fn(),
}))

jest.mock('@/lib/contact.create', () => ({
  ensureUntrustedContact: jest.fn(),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(() => ({ name: '', description: '' })),
}))

jest.mock(
  '@/pages/api/v1/conversation/[conversationId]/session/create',
  () => ({
    createConversationSessionToken: jest.fn(),
  })
)

jest.mock('@/lib/method', () => ({
  // @note withPost must handle errors since withBot throws (throwNotFound, etc.)
  // which are normally caught by the outer withRequestResponse middleware
  withPost:
    (fn) =>
    async (...args) => {
      try {
        return await fn(...args)
      } catch (e) {
        const { respondFromError } = jest.requireActual('@/lib/response')

        return respondFromError(e)
      }
    },
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
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureError: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(),
  assert: (val, msg) => {
    if (!val) {
      throw new Error(msg)
    }
  },
  createSpan: jest.fn(() => ({ finish: jest.fn() })),
}))

const { getSoftSession } = require('@/lib/session.get')
const { fastGetUserById, cacheUser } = require('@/lib/user.get')
const { createConversation } = require('@/lib/conversation.create')
const { ensureUntrustedContact } = require('@/lib/contact.create')
const {
  createConversationSessionToken,
} = require('@/pages/api/v1/conversation/[conversationId]/session/create')

// -------------------------------------------------------
// Shared test fixtures
// -------------------------------------------------------

const mockUser = { id: 'user_owner', name: 'Owner' }
const mockPublicBot = {
  id: 'bot_public',
  userId: 'user_owner',
  visibility: 'public',
}
const mockPrivateBot = {
  id: 'bot_private',
  userId: 'user_owner',
  visibility: 'private',
}
const mockConversation = { id: 'conv_123', messages: [] }

describe('POST /api/v1/bot/[botId]/session/create', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    fastGetUserById.mockResolvedValue(mockUser)
    cacheUser.mockResolvedValue(undefined)
    createConversation.mockResolvedValue(mockConversation)
    createConversationSessionToken.mockResolvedValue('tok_abc')
  })

  // -------------------------------------------------------
  // withBot middleware
  // -------------------------------------------------------

  describe('withBot middleware', () => {
    it('should return 404 when bot does not exist', async () => {
      prisma.bot.findUnique.mockResolvedValue(null)

      const req = { query: { botId: 'bot_missing' } }
      const result = await handler(req, {}, {})

      expect(result.status).toBe(404)
    })

    it('should allow anyone to create sessions for a public bot', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)

      const req = { query: { botId: 'bot_public' } }
      const result = await handler(req, {}, {})

      // getSoftSession should not be called for public bots
      expect(getSoftSession).not.toHaveBeenCalled()
      expect(result.status).toBe(200)
    })

    it('should return 401 when private bot and no session', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPrivateBot)
      getSoftSession.mockResolvedValue(null)

      const req = { query: { botId: 'bot_private' } }
      const result = await handler(req, {}, {})

      expect(result.status).toBe(401)
    })

    it('should return 403 when private bot and wrong user', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPrivateBot)
      getSoftSession.mockResolvedValue({ user: { id: 'user_other' } })

      const req = { query: { botId: 'bot_private' } }
      const result = await handler(req, {}, {})

      expect(result.status).toBe(403)
    })

    it('should allow owner to create sessions for a private bot', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPrivateBot)
      getSoftSession.mockResolvedValue({ user: { id: 'user_owner' } })

      const req = { query: { botId: 'bot_private' } }
      const result = await handler(req, {}, {})

      expect(result.status).toBe(200)
    })

    it('should return 500 when user lookup fails (assert throws)', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)
      fastGetUserById.mockResolvedValue(null)

      const req = { query: { botId: 'bot_public' } }
      const result = await handler(req, {}, {})

      // @note assert(user, 'user not found') throws AssertionError which respondFromError
      // treats as a generic 500 - the outer `if (!user) return notFound()` never fires
      expect(result.status).toBe(500)
    })
  })

  // -------------------------------------------------------
  // Session creation - response shape
  // -------------------------------------------------------

  describe('session creation', () => {
    it('should return session id, conversationId, token, expiresAt and messages', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)
      createConversation.mockResolvedValue({ id: 'conv_abc', messages: [] })
      createConversationSessionToken.mockResolvedValue('tok_xyz')

      const req = { query: { botId: 'bot_public' } }
      const result = await handler(req, {})

      expect(result.status).toBe(200)

      const body = await result.json()

      expect(body.id).toBe('bot_public') // bot id
      expect(body.conversationId).toBe('conv_abc')
      expect(body.token).toBe('tok_xyz')
      expect(typeof body.expiresAt).toBe('number')
      expect(Array.isArray(body.messages)).toBe(true)
    })

    it('should use ONE_HOUR_IN_SECONDS as default duration when durationInSeconds is null', async () => {
      const { ONE_HOUR_IN_SECONDS } = require('@chatbotkit-dev/time')

      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)
      createConversation.mockResolvedValue({ id: 'conv_abc', messages: [] })
      createConversationSessionToken.mockResolvedValue('tok_xyz')

      const req = { query: { botId: 'bot_public' } }
      const result = await handler(req, { durationInSeconds: null })

      const body = await result.json()

      expect(createConversationSessionToken).toHaveBeenCalledWith(
        expect.objectContaining({ durationInSeconds: ONE_HOUR_IN_SECONDS })
      )
      // expiresAt should be approximately now + 1 hour
      expect(body.expiresAt).toBeGreaterThan(
        Date.now() + ONE_HOUR_IN_SECONDS * 900
      )
    })

    it('should use custom durationInSeconds when provided', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)
      createConversation.mockResolvedValue({ id: 'conv_abc', messages: [] })
      createConversationSessionToken.mockResolvedValue('tok_xyz')

      const req = { query: { botId: 'bot_public' } }
      const result = await handler(req, { durationInSeconds: 7200 })

      expect(createConversationSessionToken).toHaveBeenCalledWith(
        expect.objectContaining({ durationInSeconds: 7200 })
      )
      expect(result.status).toBe(200)
    })
  })

  // -------------------------------------------------------
  // Contact creation
  // -------------------------------------------------------

  describe('contact creation', () => {
    it('should create contact when email is provided', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)
      ensureUntrustedContact.mockResolvedValue({ id: 'contact_abc' })
      createConversation.mockResolvedValue({ id: 'conv_abc', messages: [] })
      createConversationSessionToken.mockResolvedValue('tok_xyz')

      const req = { query: { botId: 'bot_public' } }

      await handler(req, { contact: { email: 'user@example.com' } })

      expect(ensureUntrustedContact).toHaveBeenCalledWith(
        { id: 'user_owner' },
        expect.objectContaining({ email: 'user@example.com' })
      )
    })

    it('should not create contact when contact has no email or phone', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)
      createConversation.mockResolvedValue({ id: 'conv_abc', messages: [] })
      createConversationSessionToken.mockResolvedValue('tok_xyz')

      const req = { query: { botId: 'bot_public' } }

      await handler(req, { contact: { name: 'Anonymous' } })

      expect(ensureUntrustedContact).not.toHaveBeenCalled()
    })

    it('should not create contact when no contact provided', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)
      createConversation.mockResolvedValue({ id: 'conv_abc', messages: [] })
      createConversationSessionToken.mockResolvedValue('tok_xyz')

      const req = { query: { botId: 'bot_public' } }

      await handler(req, {})

      expect(ensureUntrustedContact).not.toHaveBeenCalled()
    })

    it('should pass contactId to createConversation when contact is created', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)
      ensureUntrustedContact.mockResolvedValue({ id: 'contact_xyz' })
      createConversation.mockResolvedValue({ id: 'conv_abc', messages: [] })
      createConversationSessionToken.mockResolvedValue('tok_xyz')

      const req = { query: { botId: 'bot_public' } }

      await handler(req, { contact: { phone: '+15555550100' } })

      expect(createConversation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ contactId: 'contact_xyz' })
      )
    })
  })

  // -------------------------------------------------------
  // Error handling
  // -------------------------------------------------------

  describe('error handling', () => {
    it('should return error response when createConversation throws', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)
      createConversation.mockRejectedValue(new Error('Database error'))

      const req = { query: { botId: 'bot_public' } }
      const result = await handler(req, {})

      // respondFromError should handle the thrown error
      expect(result.status).toBeGreaterThanOrEqual(400)
    })
  })

  // -------------------------------------------------------
  // withBot export - direct unit tests
  // -------------------------------------------------------

  describe('withBot helper', () => {
    it('should create a pseudoSession with bot owner user', async () => {
      prisma.bot.findUnique.mockResolvedValue(mockPublicBot)
      fastGetUserById.mockResolvedValue(mockUser)

      const capturedArgs = []
      const wrapped = withBot(async (_req, session, bot) => {
        capturedArgs.push({ session, bot })

        return new Response(JSON.stringify({ ok: true }))
      })

      const req = { query: { botId: 'bot_public' } }

      await wrapped(req)

      expect(capturedArgs[0].session.user).toEqual(mockUser)
      expect(capturedArgs[0].bot).toEqual(mockPublicBot)
    })
  })
})
