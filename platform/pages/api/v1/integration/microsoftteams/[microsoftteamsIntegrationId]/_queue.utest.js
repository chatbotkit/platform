/**
 * @jest-environment node
 */
import messages from '@/config/messages'

import prisma from '@/prisma/client'

import { setContextUser } from '@/lib/context.store'
import { captureError } from '@/lib/error'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import memcache from '@/lib/memcache'
import { sendTeamsMessage, sendTeamsReply } from '@/lib/microsoftteams.api'
import queue from '@/lib/queue'
import { parseAsync } from '@/lib/zod.schema'

import {
  INITIATE_EVENT_TYPE,
  INTERACT_EVENT_TYPE,
  InitiatePayloadSchema,
  SETUP_EVENT_TYPE,
  getTeamsInitiateSessionKey,
  handleInitiateEvent,
  handleInteractEvent,
  handleSetupEvent,
  sendEvent,
} from '@/pages/api/v1/integration/microsoftteams/[microsoftteamsIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  microsoftteamsIntegration: { findUnique: jest.fn() },
}))

jest.mock('@/lib/limit.core', () => ({
  accountConversationalLimitsOk: jest.fn(),
}))

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(async () => 1),
  expire: jest.fn(),
}))

jest.mock('@/lib/channel.session', () => ({
  publishChannelMessage: jest.fn(async () => undefined),
  // @note default: an empty stream (no newer message) so the yield watcher
  // settles immediately and the turn runs to completion.
  streamChannelEvents: jest.fn(() => (async function* () {})()),
}))

jest.mock('@/lib/microsoftteams.api', () => ({
  DEFAULT_TEAMS_SERVICE_URL: 'https://smba.trafficmanager.net/teams/',
  sendTeamsMessage: jest.fn(),
  sendTeamsReply: jest.fn(),
}))

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return {
    ...actual,
    captureError: jest.fn(),
    captureInputError: jest.fn(),
    captureUnexpectedState: jest.fn(),
  }
})

jest.mock('@/lib/log', () => ({ logEvent: jest.fn() }))

jest.mock('@/lib/job', () => ({ runTasks: jest.fn(async () => undefined) }))

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
}))

jest.mock('@/lib/session.context', () => ({ updateSessionStore: jest.fn() }))

jest.mock('@/lib/zod.schema', () => {
  const actual = jest.requireActual('@/lib/zod.schema')

  return {
    ...actual,

    parseAsync: jest.fn(async () => undefined),
  }
})

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/conversation.find', () => ({
  hasConversation: jest.fn(async () => false),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(async () => ({
    send: jest.fn(async () => undefined),
    receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
    dispose: jest.fn(async () => undefined),
  })),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(() => ({})),
}))

jest.mock('@/lib/user.session', () => ({
  userToSessionUser: jest.fn((u) => u),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(async () => ({ id: 'conv-1' })),
}))

jest.mock('@/lib/integration.context', () => ({
  setupFrontendHostContext: jest.fn(async () => undefined),
}))

jest.mock('@/lib/integration.session', () => ({
  resolveSession: jest.fn(async () => null),
}))

jest.mock(
  '@/pages/api/v1/integration/microsoftteams/[microsoftteamsIntegrationId]/setup',
  () => ({ doSetup: jest.fn(async () => undefined) })
)

jest.mock('@/lib/debug', () => {
  const debug = () => ({ log: jest.fn() })

  return { __esModule: true, default: debug }
})

describe('Teams queue module', () => {
  const microsoftteamsIntegrationId = 'ti-xyz'

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.microsoftteamsIntegration.findUnique.mockResolvedValue({
      id: microsoftteamsIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      botFrameworkAppId: 'app-id-123',
      botFrameworkAppSecret: 'secret-123',
      tenantId: 'tenant-123',
      sessionDuration: 86400000,
      allowFrom: '*',
    })

    accountConversationalLimitsOk.mockResolvedValue(true)

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)
    memcache.del.mockResolvedValue(undefined)

    sendTeamsReply.mockResolvedValue(undefined)
    sendTeamsMessage.mockResolvedValue(undefined)

    parseAsync.mockResolvedValue(undefined)
  })

  describe('sendEvent', () => {
    it('enqueues interact with deduplication id', async () => {
      const payload = {
        activityId: 'activity-1',
        conversationId: 'conv-123',
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
        fromId: 'user-teams-1',
        fromName: 'Test User',
        message: 'Hello bot!',
      }

      await sendEvent(microsoftteamsIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/microsoftteams/${microsoftteamsIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          deduplicationId: `microsoftteams-${microsoftteamsIntegrationId}-interact-activity-1`,
        })
      )
    })

    it('allocates a per-sender order, nudges, and serializes interact dispatch', async () => {
      const { publishChannelMessage } = await import('@/lib/channel.session')

      const sessionKey = `microsoftteams-session-${microsoftteamsIntegrationId}-user-teams-1`

      const payload = {
        activityId: 'activity-1',
        conversationId: 'conv-123',
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
        fromId: 'user-teams-1',
        fromName: 'Test User',
        message: 'Hello bot!',
      }

      await sendEvent(microsoftteamsIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      // @note order allocated onto the payload (incr mock returns 1) + nudge
      expect(payload.order).toBe(1)
      expect(memcache.incr).toHaveBeenCalledWith(`${sessionKey}-latest`)
      expect(publishChannelMessage).toHaveBeenCalledWith(
        { id: sessionKey },
        'inbound',
        { order: 1 }
      )

      // @note dispatch now serialized per sender (was dedup-only before)
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/microsoftteams/${microsoftteamsIntegrationId}/queue`,
        expect.objectContaining({ type: INTERACT_EVENT_TYPE }),
        expect.objectContaining({ flow: { key: sessionKey, parallel: 1 } })
      )
    })

    it('enqueues setup without deduplication id', async () => {
      await sendEvent(microsoftteamsIntegrationId, {
        type: SETUP_EVENT_TYPE,
        payload: {},
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/microsoftteams/${microsoftteamsIntegrationId}/queue`,
        { type: SETUP_EVENT_TYPE, payload: {} },
        {}
      )
    })

    it('enqueues initiate without deduplication id', async () => {
      const payload = {
        conversationId: 'conv-123',
        text: 'Hello from the bot',
      }

      await sendEvent(microsoftteamsIntegrationId, {
        type: INITIATE_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/microsoftteams/${microsoftteamsIntegrationId}/queue`,
        { type: INITIATE_EVENT_TYPE, payload },
        {}
      )
    })

    it('rejects when payload schema fails', async () => {
      parseAsync.mockRejectedValueOnce(new Error('invalid'))

      await expect(
        sendEvent(microsoftteamsIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: /** @type any */ ({}),
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })
  })

  describe('handleSetupEvent', () => {
    it('throws when integration is not found', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleSetupEvent(microsoftteamsIntegrationId, {})
      ).rejects.toThrow(/not found/i)
    })

    it('invokes doSetup when integration exists', async () => {
      const { doSetup } = await import(
        '@/pages/api/v1/integration/microsoftteams/[microsoftteamsIntegrationId]/setup'
      )

      await expect(
        handleSetupEvent(microsoftteamsIntegrationId, {})
      ).resolves.toBeUndefined()

      expect(doSetup).toHaveBeenCalled()
    })

    it('sets context user when integration has user', async () => {
      const { updateSessionStore } = await import('@/lib/session.context')

      await handleSetupEvent(microsoftteamsIntegrationId, {})

      expect(updateSessionStore).toHaveBeenCalled()
      expect(setContextUser).toHaveBeenCalled()
    })
  })

  describe('handleInteractEvent', () => {
    const basePayload = {
      activityId: 'activity-1',
      conversationId: 'conv-123',
      serviceUrl: 'https://smba.trafficmanager.net/teams/',
      fromId: 'user-teams-1',
      fromName: 'Test User',
      message: 'hello',
    }

    it('throws when integration is not found', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInteractEvent(microsoftteamsIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('skips the reply when superseded before generation', async () => {
      // @note default integration has sessionDuration 86400000 → persist true.
      // The supersede marker (…-latest) reports a newer order (5) than this
      // turn's (3); other lookups return an existing conversation.
      memcache.get.mockImplementation(async (key) =>
        typeof key === 'string' && key.endsWith('-latest') ? '5' : 'conv-abc'
      )

      await handleInteractEvent(microsoftteamsIntegrationId, {
        ...basePayload,
        order: 3,
      })

      expect(sendTeamsReply).not.toHaveBeenCalled()
    })

    it('posts a pre-canned reply and does not throw when conversational limits are exceeded', async () => {
      // @note the base integration carries botFrameworkAppId/botFrameworkAppSecret
      // so the reply path is taken: over-limit posts a visible message via the
      // Bot Framework connector instead of throwing.
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInteractEvent(microsoftteamsIntegrationId, basePayload)
      ).resolves.toBeUndefined()

      expect(sendTeamsReply).toHaveBeenCalledWith(
        expect.objectContaining({ id: microsoftteamsIntegrationId }),
        'https://smba.trafficmanager.net/teams/',
        expect.objectContaining({
          conversationId: 'conv-123',
          activityId: 'activity-1',
          text: messages.limitsReachedReply,
        })
      )
    })

    it('skips processing when no bot configured', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: null,
        botFrameworkAppId: 'app-id-123',
        sessionDuration: 0,
        allowFrom: '*',
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(sendTeamsReply).not.toHaveBeenCalled()
    })

    it('creates new conversation when no existing session', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'microsoftteams',
            microsoftteams: expect.objectContaining({
              integrationId: microsoftteamsIntegrationId,
            }),
          }),
        })
      )
    })

    it('stores session in redis after creating conversation', async () => {
      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `microsoftteams-session-${microsoftteamsIntegrationId}-user-teams-1`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('reuses existing conversation from redis session', async () => {
      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(true)
      memcache.get.mockResolvedValueOnce('existing-conv-id')

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('resolves initiated conversation from conversation fallback key', async () => {
      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')
      const { resolveSession } = await import('@/lib/integration.session')

      hasConversation.mockResolvedValueOnce(true)
      memcache.get.mockResolvedValueOnce(null)
      resolveSession.mockResolvedValueOnce({
        key: `microsoftteams-session-conversation-${microsoftteamsIntegrationId}-conv-123`,
        value: 'existing-conv-id',
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(createConversation).not.toHaveBeenCalled()
      expect(memcache.set).toHaveBeenCalledWith(
        `microsoftteams-session-${microsoftteamsIntegrationId}-user-teams-1`,
        'existing-conv-id',
        expect.objectContaining({ ex: 86400 })
      )
    })

    it('creates new conversation when redis session exists but conversation does not', async () => {
      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(false)
      memcache.get.mockResolvedValueOnce('stale-conv-id')

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalled()
    })

    it('sends message to conversation engine and replies via Teams API', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const mockSend = jest.fn()
      const mockReceive = jest.fn(async () => ({
        text: 'Bot response',
        messages: [],
      }))

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: mockSend,
        receive: mockReceive,
        dispose: jest.fn(async () => undefined),
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(mockSend).toHaveBeenCalledWith('hello')
      expect(mockReceive).toHaveBeenCalled()

      expect(sendTeamsReply).toHaveBeenCalledWith(
        expect.objectContaining({ id: microsoftteamsIntegrationId }),
        'https://smba.trafficmanager.net/teams/',
        expect.objectContaining({
          conversationId: 'conv-123',
          activityId: 'activity-1',
          text: 'Bot response',
        })
      )
    })

    it('sets untrusted flag on conversation engine', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          untrusted: true,
        })
      )
    })

    it('enables attachments feature when integration.attachments is true', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        tenantId: 'tenant-1',
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
        allowFrom: '*',
        sessionDuration: 0,
        attachments: true,
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            features: [
              {
                name: 'userInfo',
                options: {
                  name: 'Test User',
                  externalId: 'user-teams-1',
                  source: 'microsoftteams',
                },
              },
              { name: 'timeoutMarks' },
              { name: 'auth' },
              { name: 'time' },
              { name: 'attachments' },
            ],
          }),
        })
      )
    })

    it('handles Teams API errors gracefully', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { logEvent } = await import('@/lib/log')

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: jest.fn(),
        receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
        dispose: jest.fn(async () => undefined),
      })

      sendTeamsReply.mockRejectedValueOnce(new Error('Teams API error'))

      // @note replaceMessage catches errors via captureError -
      // the handler should not throw
      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(captureError).toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.microsoftteams.api.error',
          name: 'Microsoft Teams Reply Error',
          meta: expect.objectContaining({
            operation: 'activities.reply',
            error: expect.objectContaining({
              message: 'Teams API error',
            }),
          }),
        })
      )
    })

    it('skips empty messages', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const mockSend = jest.fn()

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: mockSend,
        receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
        dispose: jest.fn(async () => undefined),
      })

      await handleInteractEvent(microsoftteamsIntegrationId, {
        ...basePayload,
        message: '   ',
      })

      expect(mockSend).not.toHaveBeenCalled()
    })

    it('uses custom session duration when configured', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botFrameworkAppId: 'app-id-123',
        sessionDuration: 3600000, // 1 hour in ms
        allowFrom: '*',
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ ex: 3600 })
      )
    })

    it('sets up frontend host context', async () => {
      const { setupFrontendHostContext } = await import(
        '@/lib/integration.context'
      )

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(setupFrontendHostContext).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' })
      )
    })
  })

  describe('handleInitiateEvent', () => {
    const basePayload = {
      conversationId: 'conv-123;messageid=abc',
      text: 'Hello from the bot',
    }

    it('sends proactive message and creates a session-backed conversation', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(microsoftteamsIntegrationId, basePayload)

      expect(sendTeamsMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: microsoftteamsIntegrationId }),
        'https://smba.trafficmanager.net/teams/',
        'conv-123',
        'Hello from the bot'
      )
      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              type: 'bot',
              text: 'Hello from the bot',
            }),
          ]),
          meta: expect.objectContaining({
            app: 'microsoftteams',
            microsoftteams: expect.objectContaining({
              integrationId: microsoftteamsIntegrationId,
              conversationId: 'conv-123',
              serviceUrl: 'https://smba.trafficmanager.net/teams/',
              initiated: true,
            }),
          }),
        })
      )
      expect(memcache.set).toHaveBeenCalledWith(
        `microsoftteams-session-conversation-${microsoftteamsIntegrationId}-conv-123`,
        'conv-1',
        expect.objectContaining({ ex: 86400 })
      )
    })

    it('captures unexpected state when bot is missing', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: null,
        botFrameworkAppId: 'app-id-123',
        botFrameworkAppSecret: 'secret-123',
      })

      const { captureUnexpectedState } = await import('@/lib/error')

      await handleInitiateEvent(microsoftteamsIntegrationId, basePayload)

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        expect.stringContaining('no bot configured'),
        expect.objectContaining({ microsoftteamsIntegrationId })
      )
      expect(sendTeamsMessage).not.toHaveBeenCalled()
    })

    it('captures unexpected state when credentials are missing', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botFrameworkAppId: null,
        botFrameworkAppSecret: 'secret-123',
      })

      const { captureUnexpectedState } = await import('@/lib/error')

      await handleInitiateEvent(microsoftteamsIntegrationId, basePayload)

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        expect.stringContaining('missing Bot Framework credentials'),
        expect.objectContaining({ microsoftteamsIntegrationId })
      )
      expect(sendTeamsMessage).not.toHaveBeenCalled()
    })

    it('captures send failures without creating a conversation', async () => {
      const { createConversation } = await import('@/lib/conversation.create')
      const { captureUnexpectedState } = await import('@/lib/error')

      sendTeamsMessage.mockRejectedValueOnce(new Error('Teams API failed'))

      await handleInitiateEvent(microsoftteamsIntegrationId, basePayload)

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        expect.stringContaining('initiate message failed'),
        expect.objectContaining({
          microsoftteamsIntegrationId,
          conversationId: 'conv-123',
        })
      )
      expect(createConversation).not.toHaveBeenCalled()
    })
  })

  describe('InitiatePayloadSchema', () => {
    it('validates a complete initiate payload', () => {
      const result = InitiatePayloadSchema.safeParse({
        conversationId: 'conv-123',
        text: 'Hello from the bot',
      })

      expect(result.success).toBe(true)
    })

    it('fails when required fields are missing', () => {
      const result = InitiatePayloadSchema.safeParse({
        text: 'missing conversation',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('getTeamsInitiateSessionKey', () => {
    it('uses normalized conversation id', () => {
      expect(
        getTeamsInitiateSessionKey(microsoftteamsIntegrationId, {
          conversationId: 'conv-123;messageid=abc',
        })
      ).toBe(
        `microsoftteams-session-conversation-${microsoftteamsIntegrationId}-conv-123`
      )
    })
  })

  describe('session management', () => {
    const basePayload = {
      activityId: 'activity-1',
      conversationId: 'conv-123',
      serviceUrl: 'https://smba.trafficmanager.net/teams/',
      fromId: 'user-teams-1',
      fromName: 'Test User',
      message: 'hello',
    }

    it('uses correct redis key format', async () => {
      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `microsoftteams-session-${microsoftteamsIntegrationId}-user-teams-1`,
        expect.any(String),
        expect.any(Object)
      )
    })

    it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botFrameworkAppId: 'app-id-123',
        botFrameworkAppSecret: 'secret-123',
        tenantId: 'tenant-123',
        sessionDuration: 0,
        allowFrom: '*',
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      // no session: every event starts a fresh conversation
      expect(memcache.get).not.toHaveBeenCalled()
      expect(memcache.set).not.toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalled()
    })

    it('handles ///restart command by deleting session', async () => {
      await handleInteractEvent(microsoftteamsIntegrationId, {
        ...basePayload,
        message: '///restart',
      })

      expect(memcache.del).toHaveBeenCalledWith(
        `microsoftteams-session-${microsoftteamsIntegrationId}-user-teams-1`
      )
    })

    it('handles ///reset command by deleting session', async () => {
      await handleInteractEvent(microsoftteamsIntegrationId, {
        ...basePayload,
        message: '///reset',
      })

      expect(memcache.del).toHaveBeenCalledWith(
        `microsoftteams-session-${microsoftteamsIntegrationId}-user-teams-1`
      )
    })

    it('handles ///new command by deleting session', async () => {
      await handleInteractEvent(microsoftteamsIntegrationId, {
        ...basePayload,
        message: '///new',
      })

      expect(memcache.del).toHaveBeenCalledWith(
        `microsoftteams-session-${microsoftteamsIntegrationId}-user-teams-1`
      )
    })
  })

  describe('sink behavior', () => {
    const basePayload = {
      activityId: 'activity-1',
      conversationId: 'conv-123',
      serviceUrl: 'https://smba.trafficmanager.net/teams/',
      fromId: 'user-teams-1',
      fromName: 'Test User',
      message: 'hello',
    }

    it('does not send intermediate messages while the engine generates tokens', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      let capturedSink

      // @note the engine still pushes tokens to the sink, but Teams does not
      // stream - the reply is only delivered once, after generation finishes
      getStatefulConversationEngine.mockImplementationOnce(async (opts) => {
        capturedSink = opts.options.sink

        return {
          send: jest.fn(async () => {
            for (let i = 0; i < 30; i++) {
              await capturedSink.push('token', { token: `t${i}` })
            }
          }),
          receive: jest.fn(async () => ({
            text: 'final response',
            messages: [],
          })),
          dispose: jest.fn(async () => undefined),
        }
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      // a single, short final reply means exactly one Teams call
      expect(sendTeamsReply).toHaveBeenCalledTimes(1)
    })

    it('does not re-capture errors pushed to the sink (engine captures at source)', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      let capturedSink

      getStatefulConversationEngine.mockImplementationOnce(async (opts) => {
        capturedSink = opts.options.sink

        return {
          send: jest.fn(async () => {
            // @note the engine normalizes errors to {code, message} before
            // pushing TAG_ERROR, having already reported the raw error (with
            // its cause chain) to Sentry at the throw site. The sink must NOT
            // re-capture - doing so produces a duplicate, stack-less,
            // cause-less event (the regression pattern).

            await capturedSink.push('error', {
              code: 'GENERIC_ERROR',
              message: 'boom',
            })
          }),
          receive: jest.fn(async () => ({
            text: 'response',
            messages: [],
          })),
          dispose: jest.fn(async () => undefined),
        }
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(captureError).not.toHaveBeenCalled()
    })
  })

  describe('allowFrom gate', () => {
    const basePayload = {
      activityId: 'activity-1',
      conversationId: 'conv-123',
      serviceUrl: 'https://smba.trafficmanager.net/teams/',
      fromId: '29:1AbcDefGhi',
      fromName: 'Test User',
      message: 'hello',
    }

    it('allows sender when allowFrom is wildcard', async () => {
      // @note base mock already has allowFrom: '*'
      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(sendTeamsReply).toHaveBeenCalled()
    })

    it('allows sender when fromId is explicitly listed', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botFrameworkAppId: 'app-id-123',
        sessionDuration: 0,
        allowFrom: '29:1AbcDefGhi',
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(sendTeamsReply).toHaveBeenCalled()
    })

    it('blocks sender not in the allowFrom list and logs event', async () => {
      const { logEvent } = await import('@/lib/log')

      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botFrameworkAppId: 'app-id-123',
        sessionDuration: 0,
        allowFrom: '29:1OtherUser',
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(sendTeamsReply).not.toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.microsoftteams.blocked',
          relations: expect.objectContaining({ microsoftteamsIntegrationId }),
        })
      )
    })

    it('blocks all senders when allowFrom is empty string', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botFrameworkAppId: 'app-id-123',
        sessionDuration: 0,
        allowFrom: '',
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(sendTeamsReply).not.toHaveBeenCalled()
    })

    it('blocks all senders when allowFrom is null', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botFrameworkAppId: 'app-id-123',
        sessionDuration: 0,
        allowFrom: null,
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(sendTeamsReply).not.toHaveBeenCalled()
    })

    it('matching is case-insensitive', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botFrameworkAppId: 'app-id-123',
        sessionDuration: 0,
        allowFrom: '29:1ABCDEFGHI', // uppercase in config
      })

      // @note payload delivers lowercase - must still match
      await handleInteractEvent(microsoftteamsIntegrationId, {
        ...basePayload,
        fromId: '29:1abcdefghi',
      })

      expect(sendTeamsReply).toHaveBeenCalled()
    })

    it('allows any of multiple listed IDs', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botFrameworkAppId: 'app-id-123',
        sessionDuration: 0,
        allowFrom: '29:1Alice\n29:1AbcDefGhi',
      })

      await handleInteractEvent(microsoftteamsIntegrationId, basePayload)

      expect(sendTeamsReply).toHaveBeenCalled()
    })

    it('does not block when fromId is missing from payload', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValueOnce({
        id: microsoftteamsIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botFrameworkAppId: 'app-id-123',
        sessionDuration: 0,
        allowFrom: '29:1SpecificUser',
      })

      // @note if fromId is empty string (falsy), the gate is skipped
      await handleInteractEvent(microsoftteamsIntegrationId, {
        ...basePayload,
        fromId: '',
      })

      // @note should proceed past the gate (no block)
      expect(sendTeamsReply).toHaveBeenCalled()
    })
  })
})
