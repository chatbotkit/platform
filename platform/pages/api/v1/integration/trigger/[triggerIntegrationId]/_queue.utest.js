/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { accountConversationalLimitsOk } from '@/lib/limit.core'
import memcache from '@/lib/memcache'
import queue from '@/lib/queue'
import { getNext } from '@/lib/task.schedule'
import { parseAsync } from '@/lib/zod.schema'

import {
  INTERACT_EVENT_TYPE,
  INVOKE_EVENT_TYPE,
  InteractPayloadSchema,
  InvokePayloadSchema,
  handleInteractEvent,
  handleInvokeEvent,
  sendEvent,
} from '@/pages/api/v1/integration/trigger/[triggerIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    triggerIntegration: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  Schedule: {
    never: 'never',
    hourly: 'hourly',
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
  },
}))

jest.mock('@/lib/limit.core', () => ({
  accountConversationalLimitsOk: jest.fn(),
}))

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
}))

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return { ...actual, captureInputError: jest.fn() }
})

jest.mock('@/lib/log', () => ({ logEvent: jest.fn() }))

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
}))

jest.mock('@/lib/integration.context', () => ({
  setupFrontendHostContext: jest.fn(),
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

jest.mock('@/lib/task.schedule', () => ({
  getNext: jest.fn(() => new Date('2030-01-01T00:00:00.000Z')),
}))

jest.mock('@/lib/conversation.find', () => ({
  hasConversation: jest.fn(async () => false),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(async () => ({
    send: jest.fn(async () => undefined),
    receive: jest.fn(async () => ({
      text: 'reply',
      messages: [],
      reason: 'abort',
    })),
    addMessages: jest.fn(async () => [{ id: 'msg-1' }]),
    dispose: jest.fn(async () => undefined),
  })),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(() => ({})),
}))

jest.mock('@/lib/contact.create', () => ({
  ensureUntrustedContact: jest.fn(async () => ({ id: 'contact-1' })),
}))

jest.mock('@/lib/user.session', () => ({
  userToSessionUser: jest.fn((u) => u),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(async () => ({ id: 'conv-1' })),
}))

jest.mock('@/lib/activity', () => ({
  makeActivityMessagePair: jest.fn(() => [
    { type: 'activity', text: 'request' },
    { type: 'activity', text: 'response' },
  ]),
}))

jest.mock('@/lib/response', () => ({
  throwLimitsReached: jest.fn((message) => ({ status: 429, message })),
  throwNotFound: jest.fn((message) => ({ status: 404, message })),
}))

describe('Trigger queue module', () => {
  const triggerIntegrationId = 'trigger-xyz'

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.triggerIntegration.findUnique.mockResolvedValue({
      id: triggerIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      botId: 'bot-1',
      blueprintId: 'bp-1',
      name: 'Test Trigger',
      description: 'Test description',
      sessionDuration: 86400000,
      schedule: 'daily',
      timezone: 'America/New_York',
      meta: null,
    })

    prisma.triggerIntegration.update.mockResolvedValue({})

    accountConversationalLimitsOk.mockResolvedValue(true)

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)

    parseAsync.mockResolvedValue(undefined)
  })

  describe('constants and exports', () => {
    it('exports INTERACT_EVENT_TYPE constant', () => {
      expect(INTERACT_EVENT_TYPE).toBe('interact')
    })

    it('exports INVOKE_EVENT_TYPE constant', () => {
      expect(INVOKE_EVENT_TYPE).toBe('invoke')
    })

    it('exports payload schemas', () => {
      expect(InteractPayloadSchema.parse).toBeDefined()
      expect(InvokePayloadSchema.parse).toBeDefined()
    })
  })

  describe('sendEvent', () => {
    it('enqueues interact event without deduplication id', async () => {
      const payload = {
        body: 'test message',
      }

      await sendEvent(triggerIntegrationId, {
        type: INTERACT_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/trigger/${triggerIntegrationId}/queue`,
        { type: INTERACT_EVENT_TYPE, payload },
        expect.not.objectContaining({
          deduplicationId: expect.anything(),
        })
      )
    })

    it('enqueues invoke event with deduplication id', async () => {
      const payload = {
        schedule: 'daily',
      }

      await sendEvent(triggerIntegrationId, {
        type: INVOKE_EVENT_TYPE,
        payload,
      })

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        `/api/v1/integration/trigger/${triggerIntegrationId}/queue`,
        { type: INVOKE_EVENT_TYPE, payload },
        expect.objectContaining({
          deduplicationId: expect.stringContaining(
            `trigger-${triggerIntegrationId}-invoke`
          ),
        })
      )
    })

    it('rejects when payload schema fails', async () => {
      parseAsync.mockRejectedValueOnce(new Error('invalid'))

      await expect(
        sendEvent(triggerIntegrationId, {
          type: INTERACT_EVENT_TYPE,
          payload: /** @type any */ ({}),
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })
  })

  describe('handleInteractEvent', () => {
    it('returns not found when integration is missing', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValueOnce(null)

      await expect(
        handleInteractEvent(triggerIntegrationId, { body: 'hello' })
      ).resolves.toEqual({ status: 404, message: expect.any(String) })
    })

    it('returns limits reached when conversational limits are exceeded', async () => {
      accountConversationalLimitsOk.mockResolvedValueOnce(false)

      await expect(
        handleInteractEvent(triggerIntegrationId, { body: 'hello' })
      ).resolves.toEqual({ status: 429, message: 'Limits exceeded' })
    })

    it('sets up frontend host context for the integration user', async () => {
      const { setupFrontendHostContext } = await import(
        '@/lib/integration.context'
      )

      await handleInteractEvent(triggerIntegrationId, { body: 'hello' })

      expect(setupFrontendHostContext).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' })
      )
    })

    it('creates or reuses a trigger conversation and runs the engine', async () => {
      const { createConversation } = await import('@/lib/conversation.create')
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      await handleInteractEvent(triggerIntegrationId, {
        session: 'session-1',
        body: 'hello',
      })

      expect(memcache.get).toHaveBeenCalledWith(
        `trigger-session-${triggerIntegrationId}-session-1`
      )
      expect(createConversation).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          name: 'Test Trigger',
          description: 'Test description',
          meta: {
            app: 'trigger',
            trigger: {
              integrationId: triggerIntegrationId,
            },
          },
        })
      )
      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-1',
          options: expect.objectContaining({
            userId: 'user-1',
            features: expect.arrayContaining([
              { name: 'batch', options: { settle: true } },
              expect.objectContaining({
                name: 'notes',
                options: expect.objectContaining({
                  notes: expect.arrayContaining([
                    expect.stringContaining(
                      'multiple independent trigger runs'
                    ),
                  ]),
                }),
              }),
            ]),
          }),
        })
      )
    })

    it('persists the session mapping with the configured TTL', async () => {
      await handleInteractEvent(triggerIntegrationId, {
        session: 'session-1',
        body: 'hello',
      })

      expect(memcache.set).toHaveBeenCalledWith(
        `trigger-session-${triggerIntegrationId}-session-1`,
        'conv-1',
        { ex: 86400 }
      )
    })

    it('uses the default 1 day TTL when sessionDuration is unset (auto)', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValueOnce({
        id: triggerIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botId: 'bot-1',
        blueprintId: 'bp-1',
        name: 'Test Trigger',
        description: 'Test description',
        sessionDuration: null,
        schedule: 'daily',
        timezone: 'America/New_York',
        meta: null,
      })

      await handleInteractEvent(triggerIntegrationId, {
        session: 'session-1',
        body: 'hello',
      })

      expect(memcache.get).toHaveBeenCalledWith(
        `trigger-session-${triggerIntegrationId}-session-1`
      )
      expect(memcache.set).toHaveBeenCalledWith(
        `trigger-session-${triggerIntegrationId}-session-1`,
        'conv-1',
        { ex: 86400 }
      )
    })

    it('does not look up or store a session when sessionDuration is 0 (no session)', async () => {
      const { createConversation } = await import('@/lib/conversation.create')

      prisma.triggerIntegration.findUnique.mockResolvedValueOnce({
        id: triggerIntegrationId,
        userId: 'user-1',
        user: { id: 'user-1', name: 'Test' },
        bot: { id: 'bot-1' },
        botId: 'bot-1',
        blueprintId: 'bp-1',
        name: 'Test Trigger',
        description: 'Test description',
        sessionDuration: 0,
        schedule: 'daily',
        timezone: 'America/New_York',
        meta: null,
      })

      await handleInteractEvent(triggerIntegrationId, {
        session: 'session-1',
        body: 'hello',
      })

      // no session: every event starts a fresh conversation
      expect(memcache.get).not.toHaveBeenCalled()
      expect(memcache.set).not.toHaveBeenCalled()
      expect(createConversation).toHaveBeenCalled()
    })

    it('creates untrusted contact when contact details are provided', async () => {
      const { ensureUntrustedContact } = await import('@/lib/contact.create')

      await handleInteractEvent(triggerIntegrationId, {
        body: 'hello',
        contact: {
          name: 'Ada',
          email: 'ada@example.com',
        },
      })

      expect(ensureUntrustedContact).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          name: 'Ada',
          email: 'ada@example.com',
        })
      )
    })

    it('records the run as complete when the model settles (reason abort)', async () => {
      const { makeActivityMessagePair } = await import('@/lib/activity')

      await handleInteractEvent(triggerIntegrationId, { body: 'hello' })

      expect(makeActivityMessagePair).toHaveBeenCalledWith(
        '_checkTriggerRunStatus',
        {},
        { status: 'complete' }
      )
    })

    it('records the run as incomplete when the model never settles', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { makeActivityMessagePair } = await import('@/lib/activity')

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: jest.fn(async () => undefined),
        receive: jest.fn(async () => ({
          text: 'reply',
          messages: [],
          reason: 'stop',
        })),
        addMessages: jest.fn(async () => [{ id: 'msg-1' }]),
        dispose: jest.fn(async () => undefined),
      })

      await handleInteractEvent(triggerIntegrationId, { body: 'hello' })

      expect(makeActivityMessagePair).toHaveBeenCalledWith(
        '_checkTriggerRunStatus',
        {},
        { status: 'incomplete' }
      )
    })

    it('wires the hard-timeout signal from the queue monitor into the engine', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const signal = { aborted: false }

      await handleInteractEvent(
        triggerIntegrationId,
        { body: 'hello' },
        { signal, markSignals: [] }
      )

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ signal }),
        })
      )
    })

    it('records the run as incomplete (timeout) when the hard signal aborted, even though settle surfaces reason abort', async () => {
      const { makeActivityMessagePair } = await import('@/lib/activity')

      // @note default engine mock returns reason 'abort' (the same value a
      // successful settlement produces); the fired hard-timeout signal must
      // override it so a timed-out run is not mislabelled as complete
      await handleInteractEvent(
        triggerIntegrationId,
        { body: 'hello' },
        { signal: { aborted: true }, markSignals: [] }
      )

      expect(makeActivityMessagePair).toHaveBeenCalledWith(
        '_checkTriggerRunStatus',
        {},
        { status: 'incomplete', reason: 'timeout' }
      )
    })

    it('still records a terminal status breadcrumb when receive throws', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )
      const { makeActivityMessagePair } = await import('@/lib/activity')

      getStatefulConversationEngine.mockResolvedValueOnce({
        send: jest.fn(async () => undefined),
        receive: jest.fn(async () => {
          throw new Error('boom')
        }),
        addMessages: jest.fn(async () => [{ id: 'msg-1' }]),
        dispose: jest.fn(async () => undefined),
      })

      await expect(
        handleInteractEvent(triggerIntegrationId, { body: 'hello' })
      ).rejects.toThrow('boom')

      expect(makeActivityMessagePair).toHaveBeenCalledWith(
        '_checkTriggerRunStatus',
        {},
        { status: 'incomplete' }
      )
    })
  })

  describe('handleInvokeEvent', () => {
    it('updates lastTriggerAt and nextTriggerAt for the schedule', async () => {
      await handleInvokeEvent(triggerIntegrationId, { schedule: 'daily' })

      expect(getNext).toHaveBeenCalledWith('daily', {
        timezone: 'America/New_York',
      })

      expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: triggerIntegrationId },
          data: expect.objectContaining({
            lastTriggerAt: expect.any(Date),
            nextTriggerAt: new Date('2030-01-01T00:00:00.000Z'),
          }),
        })
      )
    })

    it('clears nextTriggerAt when the schedule has no future run', async () => {
      getNext.mockReturnValueOnce(null)

      await handleInvokeEvent(triggerIntegrationId, { schedule: 'never' })

      expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: triggerIntegrationId },
          data: expect.objectContaining({
            lastTriggerAt: expect.any(Date),
            nextTriggerAt: null,
          }),
        })
      )
    })

    it('returns not found when the integration does not exist', async () => {
      const { throwNotFound } = await import('@/lib/response')

      prisma.triggerIntegration.findUnique.mockResolvedValueOnce(null)

      await handleInvokeEvent(triggerIntegrationId, { schedule: 'daily' })

      expect(throwNotFound).toHaveBeenCalledWith(
        expect.stringContaining(triggerIntegrationId)
      )
      expect(prisma.triggerIntegration.update).not.toHaveBeenCalled()
    })

    it('forwards the queue monitor signal and markSignals through to the engine (the queue-timeout regression)', async () => {
      const { getStatefulConversationEngine } = await import(
        '@/lib/conversation.engine'
      )

      const signal = { aborted: false }
      const markSignals = [{ aborted: false }]

      // @note a scheduled trigger runs via this invoke path. The hard-timeout
      // signal MUST reach the engine here, exactly as it does on the interact
      // path - otherwise the abort/salvage and timeout-budget machinery stay
      // dormant and a timed-out run is hard-killed having persisted nothing.
      await handleInvokeEvent(
        triggerIntegrationId,
        { schedule: 'daily' },
        { signal, markSignals }
      )

      expect(getStatefulConversationEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ signal, markSignals }),
        })
      )
    })
  })
})
