/**
 * @jest-environment node
 */
import messages from '@/config/messages'

import prisma from '@/prisma/client'

import { setContextUser } from '@/lib/context.store'
import { captureError } from '@/lib/error'
import fetch from '@/lib/fetch'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import memcache from '@/lib/memcache'
import queue from '@/lib/queue'
import { parseAsync } from '@/lib/zod.schema'

import {
  INITIATE_EVENT_TYPE,
  INTERACT_EVENT_TYPE,
  SETUP_EVENT_TYPE,
  handleInitiateEvent,
  handleInteractEvent,
  handleSetupEvent,
  sendEvent,
} from '@/pages/api/v1/integration/discord/[discordIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  discordIntegration: { findUnique: jest.fn() },
}))

jest.mock('@/lib/limit.core', () => ({
  accountConversationalLimitsOk: jest.fn(),
}))

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
}))

jest.mock('@/lib/fetch', () => {
  const fetch = jest.fn()

  return {
    __esModule: true,
    default: fetch,
    getFetchError: jest.fn(async (res) => new Error(`status ${res.status}`)),
    withTimeout: jest.fn((f) => f),
    withBodyTimeout: jest.fn((f) => f),
    withRetry: jest.fn((f) => f),
  }
})

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

jest.mock(
  '@/pages/api/v1/integration/discord/[discordIntegrationId]/setup',
  () => ({ doSetup: jest.fn(async () => undefined) })
)

describe('Discord queue module', () => {
  const discordIntegrationId = 'int-xyz'

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.discordIntegration.findUnique.mockResolvedValue({
      id: discordIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      botToken: 'x',
      allowFrom: '*',
      sessionDuration: 86400000,
      ephemeral: false,
    })

    accountConversationalLimitsOk.mockResolvedValue(true)

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)
    memcache.del.mockResolvedValue(undefined)

    fetch.mockReset()

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => '',
      status: 200,
    })

    parseAsync.mockResolvedValue(undefined)
  })

  describe('sendEvent', () => {
    it('enqueues interact with deduplication id', async () => {
      const payload = {
        interactionId: 'interaction-1',
        applicationId: 'app-123',
        userId: 'discord-user-1',
        token: 'token-abc',
        message: 'Hello bot!',
      }

      await sendEvent(discordIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/discord/${discordIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.objectContaining({
          deduplicationId: `discord-${discordIntegrationId}-interact-interaction-1`,
        })
      )
    })

    it('enqueues setup without deduplication id', async () => {
      await sendEvent(discordIntegrationId, {
        type: SETUP_EVENT_TYPE,
        payload: {},
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/discord/${discordIntegrationId}/queue`,
        { type: SETUP_EVENT_TYPE, payload: {} },
        {}
      )
    })

    it('rejects when payload schema fails', async () => {
      parseAsync.mockRejectedValueOnce(new Error('invalid'))

      await expect(
        sendEvent(discordIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: /** @type any */ ({}),
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })
  })

  describe('handleSetupEvent', () => {
    it('throws when integration is not found', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(handleSetupEvent(discordIntegrationId, {})).rejects.toThrow(
        /not found/i
      )
    })

    it('invokes doSetup when integration exists', async () => {
      const { doSetup } = await import(
        '@/pages/api/v1/integration/discord/[discordIntegrationId]/setup'
      )

      await expect(
        handleSetupEvent(discordIntegrationId, {})
      ).resolves.toBeUndefined()

      expect(doSetup).toHaveBeenCalled()
    })

    it('sets context user when integration has user', async () => {
      const { updateSessionStore } = await import('@/lib/session.context')

      await handleSetupEvent(discordIntegrationId, {})

      expect(updateSessionStore).toHaveBeenCalled()
      expect(setContextUser).toHaveBeenCalled()
    })
  })

  describe('handleInteractEvent', () => {
    const basePayload = {
      interactionId: 'interaction-1',
      applicationId: 'app-123',
      userId: 'discord-user-1',
      token: 'token-abc',
      message: 'hello',
    }

    it('throws when integration is not found', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInteractEvent(discordIntegrationId, basePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('posts the pre-canned limits reply and does not throw when over limit', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      // @note over-limit no longer throws - it edits the original interaction
      // response with a pre-canned reply so the user gets a visible signal
      await expect(
        handleInteractEvent(discordIntegrationId, basePayload)
      ).resolves.toBeUndefined()

      const limitReplyCall = fetch.mock.calls.find(
        ([url, init]) =>
          url ===
            'https://discord.com/api/v10/webhooks/app-123/token-abc/messages/@original' &&
          init.method === 'PATCH'
      )

      expect(limitReplyCall).toBeDefined()
      expect(JSON.parse(limitReplyCall[1].body).content).toBe(
        messages.limitsReachedReply
      )
    })

    describe('allowFrom restrictions', () => {
      it('allows message when allowFrom is wildcard (*)', async () => {
        prisma.discordIntegration.findUnique.mockResolvedValueOnce({
          id: discordIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'x',
          allowFrom: '*',
          sessionDuration: 0,
          ephemeral: false,
        })

        await handleInteractEvent(discordIntegrationId, basePayload)

        const { logEvent } = await import('@/lib/log')

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.discord.blocked' })
        )
      })

      it('blocks message and logs event when allowFrom is empty (deny all)', async () => {
        const { logEvent } = await import('@/lib/log')

        prisma.discordIntegration.findUnique.mockResolvedValueOnce({
          id: discordIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'x',
          allowFrom: '',
          sessionDuration: 0,
          ephemeral: false,
        })

        await handleInteractEvent(discordIntegrationId, basePayload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.discord.blocked',
            meta: expect.objectContaining({
              userId: basePayload.userId,
            }),
          })
        )
      })

      it('blocks message and logs event when allowFrom is null (deny all)', async () => {
        const { logEvent } = await import('@/lib/log')

        prisma.discordIntegration.findUnique.mockResolvedValueOnce({
          id: discordIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'x',
          allowFrom: null,
          sessionDuration: 0,
          ephemeral: false,
        })

        await handleInteractEvent(discordIntegrationId, basePayload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.discord.blocked' })
        )
      })

      it('allows message when userId matches allowFrom entry', async () => {
        prisma.discordIntegration.findUnique.mockResolvedValueOnce({
          id: discordIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'x',
          allowFrom: '123456789012345678',
          sessionDuration: 0,
          ephemeral: false,
        })

        const payload = { ...basePayload, userId: '123456789012345678' }

        await handleInteractEvent(discordIntegrationId, payload)

        const { logEvent } = await import('@/lib/log')

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.discord.blocked' })
        )
      })

      it('blocks message when userId does not match allowFrom entry', async () => {
        const { logEvent } = await import('@/lib/log')

        prisma.discordIntegration.findUnique.mockResolvedValueOnce({
          id: discordIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'x',
          allowFrom: '999999999999999999',
          sessionDuration: 0,
          ephemeral: false,
        })

        const payload = { ...basePayload, userId: '123456789012345678' }

        await handleInteractEvent(discordIntegrationId, payload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.discord.blocked' })
        )
      })

      it('allows message when username matches allowFrom entry', async () => {
        prisma.discordIntegration.findUnique.mockResolvedValueOnce({
          id: discordIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'x',
          allowFrom: '@testuser',
          sessionDuration: 0,
          ephemeral: false,
        })

        const payload = { ...basePayload, username: 'testuser' }

        await handleInteractEvent(discordIntegrationId, payload)

        const { logEvent } = await import('@/lib/log')

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.discord.blocked' })
        )
      })

      it('blocks message when username does not match allowFrom entry', async () => {
        const { logEvent } = await import('@/lib/log')

        prisma.discordIntegration.findUnique.mockResolvedValueOnce({
          id: discordIntegrationId,
          userId: 'user-1',
          user: { id: 'user-1', name: 'Test' },
          bot: { id: 'bot-1' },
          botToken: 'x',
          allowFrom: '@otheruser',
          sessionDuration: 0,
          ephemeral: false,
        })

        const payload = { ...basePayload, username: 'testuser' }

        await handleInteractEvent(discordIntegrationId, payload)

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.discord.blocked' })
        )
      })
    })

    it('creates new conversation when no existing session', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'discord',
            discord: expect.objectContaining({
              integrationId: discordIntegrationId,
            }),
          }),
        })
      )
    })

    it('stores session in redis after creating conversation', async () => {
      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `discord-session-${discordIntegrationId}-discord-user-1`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('reuses existing conversation from redis session', async () => {
      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(true)
      memcache.get.mockResolvedValueOnce('existing-conv-id')

      await handleInteractEvent(discordIntegrationId, basePayload)

      // Should not create new conversation when one exists
      expect(createConversation).not.toHaveBeenCalled()
    })

    it('creates new conversation when redis session exists but conversation does not', async () => {
      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(false)
      memcache.get.mockResolvedValueOnce('stale-conv-id')

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalled()
    })

    it('sends message to conversation engine and calls replaceMessage', async () => {
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

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(mockSend).toHaveBeenCalledWith('hello')
      expect(mockReceive).toHaveBeenCalled()

      // Should call Discord API to replace message
      expect(fetch).toHaveBeenCalledWith(
        `https://discord.com/api/v10/webhooks/app-123/token-abc/messages/@original`,
        expect.objectContaining({
          method: 'PATCH',
        })
      )
    })

    it('splits an over-limit reply across the original response and follow-ups', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      // @note a reply well over Discord's 2000 character per-message limit
      const longReply = Array.from(
        { length: 60 },
        (_, i) => `Paragraph ${i} ${'x'.repeat(80)}`
      ).join('\n\n')

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: jest.fn(),
        receive: jest.fn(async () => ({ text: longReply, messages: [] })),
        dispose: jest.fn(async () => undefined),
      })

      await handleInteractEvent(discordIntegrationId, basePayload)

      const patchCalls = fetch.mock.calls.filter(
        ([url, init]) =>
          url.endsWith('/messages/@original') && init.method === 'PATCH'
      )

      const followupCalls = fetch.mock.calls.filter(
        ([url, init]) =>
          url === 'https://discord.com/api/v10/webhooks/app-123/token-abc' &&
          init.method === 'POST'
      )

      // exactly one edit of the original interaction response...
      expect(patchCalls).toHaveLength(1)

      // ...and at least one follow-up for the overflow
      expect(followupCalls.length).toBeGreaterThanOrEqual(1)

      // every delivered message must stay within Discord's per-message limit
      for (const [, init] of [...patchCalls, ...followupCalls]) {
        const { content } = JSON.parse(init.body)

        expect(content.length).toBeLessThanOrEqual(2000)
      }
    })

    it('marks follow-ups ephemeral when the integration is ephemeral', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      prisma.discordIntegration.findUnique.mockResolvedValueOnce({
        id: discordIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'x',
        allowFrom: '*',
        sessionDuration: 0,
        ephemeral: true,
      })

      const longReply = `${'a'.repeat(1900)}\n\n${'b'.repeat(1900)}`

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: jest.fn(),
        receive: jest.fn(async () => ({ text: longReply, messages: [] })),
        dispose: jest.fn(async () => undefined),
      })

      await handleInteractEvent(discordIntegrationId, basePayload)

      const followupCalls = fetch.mock.calls.filter(
        ([url, init]) =>
          url === 'https://discord.com/api/v10/webhooks/app-123/token-abc' &&
          init.method === 'POST'
      )

      expect(followupCalls.length).toBeGreaterThanOrEqual(1)

      for (const [, init] of followupCalls) {
        expect(JSON.parse(init.body).flags).toBe(1 << 6)
      }
    })

    it('handles Discord API 404 error gracefully', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: jest.fn(),
        receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
        dispose: jest.fn(async () => undefined),
      })

      const { logEvent } = await import('@/lib/log')

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'Unknown Webhook' }),
      })

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(captureError).toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.discord.api.error',
          name: 'Discord Interaction Reply Error',
          meta: expect.objectContaining({
            operation: 'webhooks.messages.update',
            interactionId: 'interaction-1',
            error: expect.objectContaining({
              message: 'Unknown Webhook',
            }),
          }),
        })
      )
    })

    it('throws for non-404 Discord API errors', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: jest.fn(),
        receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
        dispose: jest.fn(async () => undefined),
      })

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ message: 'Internal Server Error' }),
      })

      await expect(
        handleInteractEvent(discordIntegrationId, basePayload)
      ).rejects.toThrow('Internal Server Error')
    })

    it('handles Discord API error with empty response', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: jest.fn(),
        receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
        dispose: jest.fn(async () => undefined),
      })

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => '',
      })

      await expect(
        handleInteractEvent(discordIntegrationId, basePayload)
      ).rejects.toThrow('Unexpected Discord API response')
    })

    it('throws when Discord API response cannot be parsed', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: jest.fn(),
        receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
        dispose: jest.fn(async () => undefined),
      })

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'not-json',
      })

      await expect(
        handleInteractEvent(discordIntegrationId, basePayload)
      ).rejects.toThrow('Cannot parse Discord API response')
    })

    it('sets untrusted flag when ephemeral is false', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      prisma.discordIntegration.findUnique.mockResolvedValueOnce({
        id: discordIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'x',
        allowFrom: '*',
        sessionDuration: 0,
        ephemeral: false,
      })

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          untrusted: true,
        })
      )
    })

    it('sets untrusted to false when ephemeral is true', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      prisma.discordIntegration.findUnique.mockResolvedValueOnce({
        id: discordIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'x',
        allowFrom: '*',
        sessionDuration: 0,
        ephemeral: true,
      })

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          untrusted: false,
        })
      )
    })

    it('enables attachments feature when integration.attachments is true', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      prisma.discordIntegration.findUnique.mockResolvedValueOnce({
        id: discordIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'x',
        allowFrom: '*',
        sessionDuration: 0,
        ephemeral: true,
        attachments: true,
      })

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            features: [
              {
                name: 'userInfo',
                options: {
                  externalId: 'discord-user-1',
                  source: 'discord',
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

    it('does not send empty messages to engine', async () => {
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

      await handleInteractEvent(discordIntegrationId, {
        ...basePayload,
        message: '   ',
      })

      expect(mockSend).not.toHaveBeenCalled()
      expect(mockReceive).toHaveBeenCalled()
    })

    it('uses custom session duration when specified', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValueOnce({
        id: discordIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'x',
        allowFrom: '*',
        sessionDuration: 3600000, // 1 hour in ms
        ephemeral: false,
      })

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({
          ex: 3600, // 1 hour in seconds
        })
      )
    })

    it('sets up frontend host context when user exists', async () => {
      const { setupFrontendHostContext } = await import(
        '@/lib/integration.context'
      )

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(setupFrontendHostContext).toHaveBeenCalledWith({
        id: 'user-1',
        name: 'Test',
      })
    })
  })

  describe('sink behavior', () => {
    const basePayload = {
      interactionId: 'interaction-1',
      applicationId: 'app-123',
      userId: 'discord-user-1',
      token: 'token-abc',
      message: 'hello',
    }

    it('does not send intermediate messages while the engine generates tokens', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { TAG_TOKEN } = await import('@/lib/conversation.tag')

      // @note the engine still pushes tokens to the sink, but Discord does not
      // stream - the reply is only delivered once, after generation finishes
      getStatefulConversationEngine.mockImplementationOnce(
        async ({ options: { sink } }) => {
          for (let i = 0; i < 30; i++) {
            await sink.push(TAG_TOKEN, { token: 't' })
          }

          return {
            send: jest.fn(async () => undefined),
            receive: jest.fn(async () => ({
              text: 'final reply',
              messages: [],
            })),
            dispose: jest.fn(async () => undefined),
          }
        }
      )

      await handleInteractEvent(discordIntegrationId, basePayload)

      // a single, short final reply means exactly one Discord call
      expect(fetch.mock.calls.length).toBe(1)
    })

    it('does not re-capture errors pushed to the sink (engine captures at source)', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { TAG_ERROR } = await import('@/lib/conversation.tag')

      getStatefulConversationEngine.mockImplementationOnce(
        async ({ options: { sink } }) => {
          // @note the engine normalizes errors to {code, message} before
          // pushing TAG_ERROR, having already reported the raw error (with its
          // cause chain) to Sentry at the throw site. The sink must NOT
          // re-capture - doing so produces a duplicate, stack-less, cause-less
          // event (the regression pattern).

          await sink.push(TAG_ERROR, { code: 'GENERIC_ERROR', message: 'boom' })

          return {
            send: jest.fn(async () => undefined),
            receive: jest.fn(async () => ({ text: 'reply', messages: [] })),
            dispose: jest.fn(async () => undefined),
          }
        }
      )

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(captureError).not.toHaveBeenCalled()
    })
  })

  describe('session management', () => {
    const basePayload = {
      interactionId: 'interaction-1',
      applicationId: 'app-123',
      userId: 'discord-user-1',
      token: 'token-abc',
      message: 'hello',
    }

    it('builds session key using integration id and user id', async () => {
      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(memcache.get).toHaveBeenCalledWith(
        `discord-session-${discordIntegrationId}-discord-user-1`
      )
    })

    it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.discordIntegration.findUnique.mockResolvedValueOnce({
        id: discordIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'x',
        allowFrom: '*',
        sessionDuration: 0,
        ephemeral: false,
      })

      await handleInteractEvent(discordIntegrationId, basePayload)

      // no session: every event starts a fresh conversation
      expect(memcache.get).not.toHaveBeenCalled()
      expect(memcache.set).not.toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalled()
    })

    it('uses default ONE_DAY_IN_SECONDS when sessionDuration is null', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValueOnce({
        id: discordIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'x',
        allowFrom: '*',
        sessionDuration: null,
        ephemeral: false,
      })

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 86400 }) // 1 day in seconds
      )
    })

    it('uses custom session duration from integration config', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValueOnce({
        id: discordIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: 'x',
        allowFrom: '*',
        sessionDuration: 7200000, // 2 hours in ms
        ephemeral: false,
      })

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'conv-1',
        expect.objectContaining({ ex: 7200 }) // 2 hours in seconds
      )
    })

    it('reuses existing valid conversation from redis session', async () => {
      memcache.get.mockResolvedValueOnce('existing-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(true)

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(createConversation).not.toHaveBeenCalled()
    })

    it('creates new conversation when session exists but conversation is gone', async () => {
      memcache.get.mockResolvedValueOnce('stale-conv-id')

      const { hasConversation } = await import('@/lib/conversation.find')
      const { createConversation } = await import('@/lib/conversation.create')

      hasConversation.mockResolvedValueOnce(false)

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalled()
    })

    it('creates new conversation when no session exists in redis', async () => {
      memcache.get.mockResolvedValueOnce(null)

      const { createConversation } = await import('@/lib/conversation.create')

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'discord',
            discord: expect.objectContaining({
              integrationId: discordIntegrationId,
            }),
          }),
        })
      )
    })

    it('stores session in redis after creating conversation', async () => {
      memcache.get.mockResolvedValueOnce(null)

      await handleInteractEvent(discordIntegrationId, basePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `discord-session-${discordIntegrationId}-discord-user-1`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    describe('session reset commands', () => {
      it('resets session for ///restart command', async () => {
        const payload = {
          ...basePayload,
          message: '///restart',
        }

        await handleInteractEvent(discordIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `discord-session-${discordIntegrationId}-discord-user-1`
        )
      })

      it('resets session for ///reset command', async () => {
        const payload = {
          ...basePayload,
          message: '///reset',
        }

        await handleInteractEvent(discordIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `discord-session-${discordIntegrationId}-discord-user-1`
        )
      })

      it('resets session for ///new command', async () => {
        const payload = {
          ...basePayload,
          message: '///new',
        }

        await handleInteractEvent(discordIntegrationId, payload)

        expect(memcache.del).toHaveBeenCalledWith(
          `discord-session-${discordIntegrationId}-discord-user-1`
        )
      })
    })
  })

  describe('handleInitiateEvent', () => {
    const baseInitiatePayload = {
      channelId: '1234567890',
      text: 'Hello from bot!',
    }

    it('throws when integration is not found', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInitiateEvent(discordIntegrationId, baseInitiatePayload)
      ).rejects.toThrow(/not found/i)
    })

    it('skips when integration has no bot token', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValueOnce({
        id: discordIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botToken: null,
        sessionDuration: 0,
        ephemeral: false,
      })

      await handleInitiateEvent(discordIntegrationId, baseInitiatePayload)

      // @note should not call Discord API when no bot token
      expect(fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('discord.com/api'),
        expect.anything()
      )
    })

    it('throws when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInitiateEvent(discordIntegrationId, baseInitiatePayload)
      ).rejects.toThrow(/Limits exceeded/i)
    })

    it('sends message to Discord API and creates conversation', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(discordIntegrationId, baseInitiatePayload)

      expect(fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/1234567890/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bot x',
            'Content-Type': 'application/json',
          }),
        })
      )

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          meta: expect.objectContaining({
            app: 'discord',
            discord: expect.objectContaining({
              integrationId: discordIntegrationId,
              channelId: '1234567890',
              initiated: true,
            }),
          }),
        })
      )
    })

    it('stores session under channel-based key', async () => {
      await handleInitiateEvent(discordIntegrationId, baseInitiatePayload)

      expect(memcache.set).toHaveBeenCalledWith(
        `discord-session-${discordIntegrationId}-1234567890`,
        'conv-1',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('does not create conversation when Discord API returns error', async () => {
      const { createConversation } = await import('@/lib/conversation.create')
      const { captureUnexpectedState } = await import('@/lib/error')

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'Missing Access' }),
      })

      await handleInitiateEvent(discordIntegrationId, baseInitiatePayload)

      expect(captureUnexpectedState).toHaveBeenCalled()
      expect(createConversation).not.toHaveBeenCalled()
    })

    it('includes context messages when context is provided', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      await handleInitiateEvent(discordIntegrationId, {
        ...baseInitiatePayload,
        context: {
          linkedConversationId: 'conv-abc',
          text: 'Background info',
        },
      })

      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ type: 'bot', text: 'Hello from bot!' }),
          ]),
        })
      )
    })

    it('sends initiate event through sendEvent', async () => {
      await sendEvent(discordIntegrationId, {
        type: INITIATE_EVENT_TYPE,
        payload: baseInitiatePayload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/discord/${discordIntegrationId}/queue`,
        { type: INITIATE_EVENT_TYPE, payload: baseInitiatePayload },
        {}
      )
    })

    it('returns early when integration has no bot configured', async () => {
      const { captureUnexpectedState } = await import('@/lib/error')
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.discordIntegration.findUnique.mockResolvedValueOnce({
        id: discordIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: null,
        botToken: 'valid-token',
        sessionDuration: 0,
        ephemeral: false,
      })

      await handleInitiateEvent(discordIntegrationId, baseInitiatePayload)

      expect(captureUnexpectedState).toHaveBeenCalledWith(
        expect.stringContaining('no bot configured'),
        expect.objectContaining({ discordIntegrationId })
      )
      expect(createConversation).not.toHaveBeenCalled()
    })
  })
})
