/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { accountConversationalLimitsOk } from '@/lib/limit.core'
import queue from '@/lib/queue'
import { getRecallMeetingSession } from '@/lib/recall.session'

import {
  FINALISE_EVENT_TYPE,
  handleFinaliseEvent,
  sendEvent,
} from '@/pages/api/v1/integration/recall/[recallIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    recallIntegration: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/limit.core', () => ({
  accountConversationalLimitsOk: jest.fn(),
}))

jest.mock('@/lib/recall.session', () => ({
  getRecallMeetingSession: jest.fn(),
}))

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return { ...actual, captureInputError: jest.fn(), captureUnexpectedState: jest.fn() }
})

jest.mock('@/lib/context.store', () => ({
  setContextUser: jest.fn(),
  setContextNamespace: jest.fn(),
}))

jest.mock('@/lib/session.context', () => ({ updateSessionStore: jest.fn() }))

jest.mock('@/lib/user.session', () => ({
  userToSessionUser: jest.fn((u) => u),
}))

jest.mock('@/lib/activity', () => ({
  makeActivityMessagePair: jest.fn(() => [
    { role: 'activity', text: '_recallMeetingEnded' },
    { role: 'activity_result', text: '' },
  ]),
}))

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(async () => ({
    send: jest.fn(async () => undefined),
    receive: jest.fn(async () => ({ text: 'summary', messages: [] })),
    addMessages: jest.fn(async () => undefined),
    dispose: jest.fn(async () => undefined),
  })),
}))

jest.mock('@/lib/zod.schema', () => {
  const actual = jest.requireActual('@/lib/zod.schema')

  return {
    ...actual,
    parseAsync: jest.fn(async (schema, value) => schema.parse(value)),
  }
})

// --- Helpers ---

function makeIntegration({ withBot = true, withUser = true } = {}) {
  return {
    id: 'recall-int-1',
    userId: 'user-1',
    user: withUser ? { id: 'user-1', email: 'u@example.com' } : null,
    bot: withBot ? { id: 'bot-1', name: 'Meeting Bot' } : null,
  }
}

function makeSession({ recallIntegrationId = 'recall-int-1', conversationId = 'conv-1' } = {}) {
  return {
    id: 'sess-1',
    recallIntegrationId,
    userId: 'user-1',
    conversationId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function makeFinalisePayload({
  sessionId = 'sess-1',
  recallBotId = 'recall-bot-abc',
  subCode = '',
} = {}) {
  return {
    sessionId,
    ...(recallBotId ? { recallBotId } : {}),
    ...(subCode ? { subCode } : {}),
  }
}

// --- Tests ---

describe('recall queue handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleFinaliseEvent', () => {
    describe('integration not found', () => {
      it('throws not found when integration does not exist', async () => {
        prisma.recallIntegration.findUnique.mockResolvedValue(null)

        await expect(
          handleFinaliseEvent('recall-int-1', makeFinalisePayload())
        ).rejects.toThrow()

        const { getStatefulConversationEngine } = await import('@/lib/conversation.engine')

        expect(getStatefulConversationEngine).not.toHaveBeenCalled()
      })
    })

    describe('no bot configured', () => {
      it('returns early without driving the conversation engine', async () => {
        prisma.recallIntegration.findUnique.mockResolvedValue(makeIntegration({ withBot: false }))
        accountConversationalLimitsOk.mockResolvedValue(true)

        await handleFinaliseEvent('recall-int-1', makeFinalisePayload())

        const { getStatefulConversationEngine } = await import('@/lib/conversation.engine')

        expect(getStatefulConversationEngine).not.toHaveBeenCalled()
      })
    })

    describe('limits exceeded', () => {
      it('throws limits reached when account is over quota', async () => {
        prisma.recallIntegration.findUnique.mockResolvedValue(makeIntegration())
        accountConversationalLimitsOk.mockResolvedValue(false)

        await expect(
          handleFinaliseEvent('recall-int-1', makeFinalisePayload())
        ).rejects.toThrow()

        const { getStatefulConversationEngine } = await import('@/lib/conversation.engine')

        expect(getStatefulConversationEngine).not.toHaveBeenCalled()
      })
    })

    describe('session validation', () => {
      it('returns early when session does not exist in redis', async () => {
        prisma.recallIntegration.findUnique.mockResolvedValue(makeIntegration())
        accountConversationalLimitsOk.mockResolvedValue(true)
        getRecallMeetingSession.mockResolvedValue(null)

        await handleFinaliseEvent('recall-int-1', makeFinalisePayload())

        const { getStatefulConversationEngine } = await import('@/lib/conversation.engine')

        expect(getStatefulConversationEngine).not.toHaveBeenCalled()
      })

      it('returns early when session belongs to a different integration', async () => {
        prisma.recallIntegration.findUnique.mockResolvedValue(makeIntegration())
        accountConversationalLimitsOk.mockResolvedValue(true)
        getRecallMeetingSession.mockResolvedValue(
          makeSession({ recallIntegrationId: 'other-integration' })
        )

        await handleFinaliseEvent('recall-int-1', makeFinalisePayload())

        const { getStatefulConversationEngine } = await import('@/lib/conversation.engine')

        expect(getStatefulConversationEngine).not.toHaveBeenCalled()
      })

      it('returns early when session has no conversation id', async () => {
        prisma.recallIntegration.findUnique.mockResolvedValue(makeIntegration())
        accountConversationalLimitsOk.mockResolvedValue(true)
        getRecallMeetingSession.mockResolvedValue(
          makeSession({ conversationId: null })
        )

        await handleFinaliseEvent('recall-int-1', makeFinalisePayload())

        const { getStatefulConversationEngine } = await import('@/lib/conversation.engine')

        expect(getStatefulConversationEngine).not.toHaveBeenCalled()
      })
    })

    describe('happy path - full execution', () => {
      async function runHappyPath(payload = makeFinalisePayload()) {
        prisma.recallIntegration.findUnique.mockResolvedValue(makeIntegration())
        accountConversationalLimitsOk.mockResolvedValue(true)
        getRecallMeetingSession.mockResolvedValue(makeSession())

        const { getStatefulConversationEngine } = await import('@/lib/conversation.engine')

        const mockEngine = {
          send: jest.fn(async () => undefined),
          receive: jest.fn(async () => ({ text: 'meeting summary', messages: [] })),
          addMessages: jest.fn(async () => undefined),
          dispose: jest.fn(async () => undefined),
        }

        getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

        await handleFinaliseEvent('recall-int-1', payload)

        return { mockEngine, getStatefulConversationEngine }
      }

      it('builds engine with correct conversation id and user id', async () => {
        const { getStatefulConversationEngine } = await runHappyPath()

        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            conversationId: 'conv-1',
            options: expect.objectContaining({ userId: 'user-1' }),
          })
        )
      })

      it('adds activity message pair before steering the engine', async () => {
        const { mockEngine } = await runHappyPath()

        expect(mockEngine.addMessages).toHaveBeenCalledTimes(1)
      })

      it('sends the closing summary instruction', async () => {
        const { mockEngine } = await runHappyPath()

        expect(mockEngine.send).toHaveBeenCalledWith(
          expect.stringContaining('meeting'),
          expect.objectContaining({ type: 'instruction' })
        )
      })

      it('calls receive to collect the engine response', async () => {
        const { mockEngine } = await runHappyPath()

        expect(mockEngine.receive).toHaveBeenCalledTimes(1)
      })

      it('looks up session by the sessionId from the payload', async () => {
        await runHappyPath({ sessionId: 'custom-session', recallBotId: 'bot-x' })

        expect(getRecallMeetingSession).toHaveBeenCalledWith('custom-session')
      })

      it('passes abort signal through to the engine when provided', async () => {
        prisma.recallIntegration.findUnique.mockResolvedValue(makeIntegration())
        accountConversationalLimitsOk.mockResolvedValue(true)
        getRecallMeetingSession.mockResolvedValue(makeSession())

        const { getStatefulConversationEngine } = await import('@/lib/conversation.engine')

        const mockEngine = {
          send: jest.fn(async () => undefined),
          receive: jest.fn(async () => ({ text: '', messages: [] })),
          addMessages: jest.fn(async () => undefined),
          dispose: jest.fn(async () => undefined),
        }

        getStatefulConversationEngine.mockResolvedValueOnce(mockEngine)

        const signal = new AbortController().signal

        await handleFinaliseEvent('recall-int-1', makeFinalisePayload(), { signal })

        expect(getStatefulConversationEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({ signal }),
          })
        )
      })
    })

    describe('payload validation', () => {
      it('rejects payload missing sessionId', async () => {
        prisma.recallIntegration.findUnique.mockResolvedValue(makeIntegration())
        accountConversationalLimitsOk.mockResolvedValue(true)

        await expect(
          handleFinaliseEvent('recall-int-1', { recallBotId: 'bot-1' })
        ).rejects.toThrow()
      })

      it('rejects payload with extra unknown fields', async () => {
        prisma.recallIntegration.findUnique.mockResolvedValue(makeIntegration())
        accountConversationalLimitsOk.mockResolvedValue(true)

        await expect(
          handleFinaliseEvent('recall-int-1', { sessionId: 'sess-1', unknownField: true })
        ).rejects.toThrow()
      })
    })
  })

  describe('sendEvent', () => {
    it('calls queue with the correct route for the integration', async () => {
      await sendEvent('recall-int-42', {
        type: FINALISE_EVENT_TYPE,
        payload: { sessionId: 'sess-1' },
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/integration/recall/recall-int-42/queue',
        expect.objectContaining({ type: FINALISE_EVENT_TYPE }),
        expect.anything()
      )
    })

    it('uses a deduplication id that includes integrationId, eventType and sessionId', async () => {
      await sendEvent('int-ABC', {
        type: FINALISE_EVENT_TYPE,
        payload: { sessionId: 'sess-XYZ' },
      })

      expect(queue).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.objectContaining({
          deduplicationId: `recall-int-ABC-${FINALISE_EVENT_TYPE}-sess-XYZ`,
        })
      )
    })

    it('rejects finalise event with invalid payload (missing sessionId)', async () => {
      await expect(
        sendEvent('int-1', {
          type: FINALISE_EVENT_TYPE,
          payload: {},
        })
      ).rejects.toThrow()

      expect(queue).not.toHaveBeenCalled()
    })
  })
})
