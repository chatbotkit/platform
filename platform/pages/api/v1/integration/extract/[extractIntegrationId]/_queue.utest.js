/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'
import { Trigger } from '@/prisma/types'

import { fetchPlusPlus } from '@/lib/egress.fetch'
import { captureError } from '@/lib/error'
import { extractData } from '@/lib/extract.data'
import { getFetchError } from '@/lib/fetch'
import { normalizeRequest, parseRequest } from '@/lib/http'
import { logEvent, logMetric } from '@/lib/log'
import { getSortedMessages } from '@/lib/message'
import { createHmacHexDigest } from '@/lib/webcrypto'

import { handleIdleEvent } from '@/pages/api/v1/integration/extract/[extractIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    extractIntegration: { findUnique: jest.fn() },
    conversation: { findUnique: jest.fn(), update: jest.fn() },
    extractIntegrationItem: { upsert: jest.fn() },
    message: { findMyriad: jest.fn() },
  },
}))

jest.mock('@/prisma/types', () => ({
  Trigger: {
    never: 'never',
    automatic: 'automatic',
  },
}))

jest.mock('@/lib/extract.data', () => ({
  extractData: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
  logMetric: jest.fn(),
}))

jest.mock('@/lib/message', () => ({
  getSortedMessages: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordLanguageTokenUsage: jest.fn(),
}))

/**
 * Helper to create a mock usage object for tests
 *
 * @returns {object} mock usage object with recordBaseTokens method
 */
function createMockUsage() {
  return {
    token: 0,
    items: [],
    recordBaseTokens: jest.fn().mockResolvedValue(undefined),
  }
}

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return { ...actual, captureError: jest.fn(), captureInputError: jest.fn() }
})

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/egress.fetch', () => ({
  fetchPlusPlus: jest.fn(),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/fetch'),
  getFetchError: jest.fn(),
}))

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

jest.mock('@/lib/http', () => ({
  normalizeRequest: jest.fn(),
  parseRequest: jest.fn(),
}))

jest.mock('@/lib/webcrypto', () => ({
  createHmacHexDigest: jest.fn(),
}))

/**
 * Collects the messages along an error's cause chain, so the assertion does
 * not depend on how many wrappers (retry, timeout) sit above the egress
 * refusal.
 *
 * @param {any} error
 * @returns {string}
 */
function causeChainMessages(error) {
  const messages = []

  for (let current = error; current; current = current.cause) {
    messages.push(String(current.message))
  }

  return messages.join(' <- ')
}

describe('Extract Integration Queue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleIdleEvent', () => {
    const mockIntegration = {
      id: 'extract-123',
      userId: 'user-123',
      trigger: Trigger.automatic,
      schema: {
        amount: { type: 'number', description: 'The amount', collect: true },
        score: { type: 'number', description: 'The score', collect: true },
        name: { type: 'string', description: 'The name' },
      },
      botId: 'bot-123',
      blueprintId: 'blueprint-123',
    }

    const mockConversation = {
      id: 'conv-123',
      userId: 'user-123',
      meta: {},
      user: { id: 'user-123' },
    }

    const mockMessages = [
      {
        id: 'msg-1',
        type: 'user',
        text: 'I need to transfer $500 to John',
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        type: 'bot',
        text: 'I can help with that',
        createdAt: new Date(),
      },
    ]

    it('should skip autonomous conversations (e.g. trigger runs)', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        meta: { app: 'trigger' },
      })

      await handleIdleEvent('extract-123', { conversationId: 'conv-123' })

      // Should bail before running extraction or persisting any data
      expect(extractData).not.toHaveBeenCalled()
      expect(prisma.conversation.update).not.toHaveBeenCalled()
    })

    describe('webhook delivery', () => {
      const mockIntegrationWithRequest = {
        ...mockIntegration,
        request: 'https://example.com/webhook',
      }

      beforeEach(() => {
        prisma.extractIntegration.findUnique.mockResolvedValue(
          mockIntegrationWithRequest
        )
        prisma.conversation.findUnique.mockResolvedValue(mockConversation)
        prisma.message.findMyriad.mockResolvedValue(mockMessages)
        getSortedMessages.mockReturnValue(mockMessages)

        extractData.mockResolvedValue({
          data: { amount: 500 },
          usage: createMockUsage(),
        })

        prisma.conversation.update.mockResolvedValue({})
        prisma.extractIntegrationItem.upsert.mockResolvedValue({})

        parseRequest.mockReturnValue({})
        normalizeRequest.mockReturnValue({
          method: 'POST',
          uri: 'https://example.com/webhook',
          headers: {},
          body: '{}',
        })
        createHmacHexDigest.mockResolvedValue('signature')
      })

      it('should record a request event on successful delivery', async () => {
        fetchPlusPlus.mockResolvedValue({ ok: true, status: 200, body: null })

        await expect(
          handleIdleEvent('extract-123', { conversationId: 'conv-123' })
        ).resolves.toBeUndefined()

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.extract.request',
            meta: expect.objectContaining({ status: 200 }),
          })
        )

        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.extract.request.error',
          })
        )

        expect(captureError).not.toHaveBeenCalled()
      })

      it('should not persist request headers or body in the request event', async () => {
        // @note operator request templates can carry credential headers
        // (authorization, api keys) - the persisted event records delivery
        // facts only

        normalizeRequest.mockReturnValue({
          method: 'POST',
          uri: 'https://example.com/webhook',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer sk-operator-secret',
            'x-api-key': 'ak-operator-key',
          },
          body: '{"conversation":"data"}',
        })

        fetchPlusPlus.mockResolvedValue({ ok: true, status: 200, body: null })

        await handleIdleEvent('extract-123', { conversationId: 'conv-123' })

        const requestEvent = logEvent.mock.calls
          .map(([event]) => event)
          .find((event) => event.type === 'integration.extract.request')

        expect(requestEvent).toBeDefined()
        expect(requestEvent.meta).toEqual({
          method: 'POST',
          url: 'https://example.com/webhook',
          status: 200,
        })
        expect(JSON.stringify(requestEvent)).not.toContain('sk-operator-secret')
      })

      it('refuses a private-IP literal endpoint and records the refusal as a request error', async () => {
        let captured

        // @note delegate to the real egress boundary with retries disabled so
        // the refusal is asserted once rather than after the backoff schedule
        fetchPlusPlus.mockImplementation((url, options) =>
          jest
            .requireActual('@/lib/egress.fetch')
            .fetchPlusPlus(url, { ...options, retries: 0 })
            .catch((e) => {
              captured = e

              throw e
            })
        )

        normalizeRequest.mockReturnValue({
          method: 'POST',
          uri: 'https://127.0.0.1/webhook',
          headers: {},
          body: '{}',
        })

        await expect(
          handleIdleEvent('extract-123', { conversationId: 'conv-123' })
        ).resolves.toBeUndefined()

        expect(fetchPlusPlus).toHaveBeenCalledWith(
          'https://127.0.0.1/webhook',
          expect.any(Object)
        )
        expect(causeChainMessages(captured)).toMatch(
          /egress to 127\.0\.0\.1 is not allowed: not a public address/
        )
        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.extract.request.error',
          })
        )
        expect(logEvent).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: 'integration.extract.request' })
        )
        expect(captureError).not.toHaveBeenCalled()
      })

      it('should log a request error instead of throwing when delivery times out', async () => {
        const timeoutError = new Error('TimeoutError')

        timeoutError.name = 'TimeoutError'

        fetchPlusPlus.mockRejectedValue(timeoutError)

        // @note the extraction itself has already succeeded; a webhook timeout
        // must not surface as an unhandled platform exception

        await expect(
          handleIdleEvent('extract-123', { conversationId: 'conv-123' })
        ).resolves.toBeUndefined()

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.extract.request.error',
            meta: expect.objectContaining({ error: 'TimeoutError' }),
          })
        )

        // @note the failure is recorded as an integration event, not escalated
        // to Sentry via runTasks' captureError path

        expect(captureError).not.toHaveBeenCalled()
      })

      it('should log a request error when the endpoint responds with a non-ok status', async () => {
        fetchPlusPlus.mockResolvedValue({ ok: false, status: 502, body: null })
        getFetchError.mockResolvedValue(new Error('Bad Gateway'))

        await expect(
          handleIdleEvent('extract-123', { conversationId: 'conv-123' })
        ).resolves.toBeUndefined()

        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'integration.extract.request.error',
            meta: expect.objectContaining({ error: 'Bad Gateway' }),
          })
        )

        expect(captureError).not.toHaveBeenCalled()
      })
    })

    it('should not record usage twice', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)
      getSortedMessages.mockReturnValue(mockMessages)

      const mockUsage = createMockUsage()

      extractData.mockResolvedValue({
        data: { amount: 500 },
        usage: mockUsage,
      })

      prisma.conversation.update.mockResolvedValue({})

      const payload = { conversationId: 'conv-123' }

      await handleIdleEvent('extract-123', payload)

      // @note usage should not be recorded in queue handler because
      // the conversation engine already records it internally
      expect(mockUsage.recordBaseTokens).not.toHaveBeenCalled()
    })

    it('should pass usageMeta and usageReferences to extractData', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)
      getSortedMessages.mockReturnValue(mockMessages)

      extractData.mockResolvedValue({
        data: { amount: 500 },
        usage: createMockUsage(),
      })

      prisma.conversation.update.mockResolvedValue({})

      const payload = { conversationId: 'conv-123' }

      await handleIdleEvent('extract-123', payload)

      // @note verify extractData is called with proper usage metadata
      // so the conversation engine can record usage with correct reason
      expect(extractData).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          usageMeta: { reason: 'conversation/extract' },
          usageReferences: { conversationId: 'conv-123' },
        })
      )
    })

    it('forwards the queue monitor signal to extractData', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)
      getSortedMessages.mockReturnValue(mockMessages)

      extractData.mockResolvedValue({
        data: { amount: 500 },
        usage: createMockUsage(),
      })

      prisma.conversation.update.mockResolvedValue({})

      const signal = { aborted: false }

      await handleIdleEvent(
        'extract-123',
        { conversationId: 'conv-123' },
        { signal }
      )

      // @note the hard-timeout signal must reach the extraction completion so a
      // slow extraction aborts promptly instead of running to the hard kill
      expect(extractData).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ signal })
      )
    })

    it('should record metric events when numeric values are extracted for fields marked with collect: true', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)
      getSortedMessages.mockReturnValue(mockMessages)

      extractData.mockResolvedValue({
        data: {
          amount: 500,
          name: 'John',
          score: 85.5,
        },
        usage: createMockUsage(),
      })

      prisma.conversation.update.mockResolvedValue({})

      const payload = { conversationId: 'conv-123' }

      await handleIdleEvent('extract-123', payload)

      // verify metric events were logged for numeric values

      expect(logMetric).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        name: 'amount',
        type: 'integration.extract[extract-123].amount',
        value: 500,
        relations: {
          extractIntegrationId: 'extract-123',
          conversationId: 'conv-123',
          botId: 'bot-123',
          blueprintId: 'blueprint-123',
        },
      })

      expect(logMetric).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        name: 'score',
        type: 'integration.extract[extract-123].score',
        value: 85.5,
        relations: {
          extractIntegrationId: 'extract-123',
          conversationId: 'conv-123',
          botId: 'bot-123',
          blueprintId: 'blueprint-123',
        },
      })

      // should not log metrics for non-numeric values

      expect(logMetric).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'name',
        })
      )
    })

    it('should not record metric events when fields do not have collect: true', async () => {
      const integrationWithoutMetrics = {
        ...mockIntegration,
        schema: {
          amount: { type: 'number', description: 'The amount' }, // no collect: true
          name: { type: 'string', description: 'The name' },
        },
      }

      prisma.extractIntegration.findUnique.mockResolvedValue(
        integrationWithoutMetrics
      )
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)
      getSortedMessages.mockReturnValue(mockMessages)

      extractData.mockResolvedValue({
        data: {
          amount: 500,
          name: 'John',
        },
        usage: createMockUsage(),
      })

      prisma.conversation.update.mockResolvedValue({})

      const payload = { conversationId: 'conv-123' }

      await handleIdleEvent('extract-123', payload)

      // should not log any metric events since no fields have collect: true

      expect(logMetric).not.toHaveBeenCalled()
    })

    it('should not record metric events when no numeric values are extracted', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)
      getSortedMessages.mockReturnValue(mockMessages)

      extractData.mockResolvedValue({
        data: {
          name: 'John',
          email: 'john@example.com',
        },
        usage: createMockUsage(),
      })

      prisma.conversation.update.mockResolvedValue({})

      const payload = { conversationId: 'conv-123' }

      await handleIdleEvent('extract-123', payload)

      // should not log any metric events

      expect(logMetric).not.toHaveBeenCalled()
    })

    it('should not record metric events when extraction returns null schema', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)

      getSortedMessages.mockReturnValue(mockMessages)

      extractData.mockResolvedValue({
        schema: null,
        usage: createMockUsage(),
      })

      prisma.conversation.update.mockResolvedValue({})

      const payload = { conversationId: 'conv-123' }

      await handleIdleEvent('extract-123', payload)

      // should not log any metric events

      expect(logMetric).not.toHaveBeenCalled()
    })

    it('should handle NaN values correctly', async () => {
      const integrationWithValidAmountField = {
        ...mockIntegration,
        schema: {
          amount: { type: 'number', description: 'The amount', collect: true },
          validAmount: {
            type: 'number',
            description: 'Valid amount',
            collect: true,
          },
        },
      }

      prisma.extractIntegration.findUnique.mockResolvedValue(
        integrationWithValidAmountField
      )
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)
      getSortedMessages.mockReturnValue(mockMessages)

      extractData.mockResolvedValue({
        data: {
          amount: NaN,
          validAmount: 100,
        },
        usage: createMockUsage(),
      })

      prisma.conversation.update.mockResolvedValue({})

      const payload = { conversationId: 'conv-123' }

      await handleIdleEvent('extract-123', payload)

      // should only log metrics for valid numeric values

      expect(logMetric).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        name: 'validAmount',
        type: 'integration.extract[extract-123].validAmount',
        value: 100,
        relations: {
          extractIntegrationId: 'extract-123',
          conversationId: 'conv-123',
          botId: 'bot-123',
          blueprintId: 'blueprint-123',
        },
      })

      // should not log metrics for NaN

      expect(logMetric).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'amount',
        })
      )
    })

    it('should not record metrics for numeric values without collect: true', async () => {
      const integrationWithMixedFields = {
        ...mockIntegration,
        schema: {
          amount: { type: 'number', description: 'The amount', collect: true },
          score: { type: 'number', description: 'The score' }, // no collect: true
          quantity: {
            type: 'number',
            description: 'The quantity',
            collect: false,
          }, // explicitly false
        },
      }

      prisma.extractIntegration.findUnique.mockResolvedValue(
        integrationWithMixedFields
      )
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)

      getSortedMessages.mockReturnValue(mockMessages)

      extractData.mockResolvedValue({
        data: {
          amount: 500,
          score: 95,
          quantity: 10,
        },
        usage: createMockUsage(),
      })

      prisma.conversation.update.mockResolvedValue({})

      const payload = { conversationId: 'conv-123' }

      await handleIdleEvent('extract-123', payload)

      // should only log metrics for the amount field (collect: true)

      expect(logMetric).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        name: 'amount',
        type: 'integration.extract[extract-123].amount',
        value: 500,
        relations: {
          extractIntegrationId: 'extract-123',
          conversationId: 'conv-123',
          botId: 'bot-123',
          blueprintId: 'blueprint-123',
        },
      })

      // should not log metrics for score (no collect property)

      expect(logMetric).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'score',
        })
      )

      // should not log metrics for quantity (collect: false)

      expect(logMetric).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'quantity',
        })
      )

      // verify only one metric was logged

      expect(logMetric).toHaveBeenCalledTimes(1)
    })

    it('should pass configured model to extractData when model is set', async () => {
      const integrationWithModel = {
        ...mockIntegration,
        model: 'gpt-4o',
      }

      prisma.extractIntegration.findUnique.mockResolvedValue(
        integrationWithModel
      )
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)
      getSortedMessages.mockReturnValue(mockMessages)

      extractData.mockResolvedValue({
        data: { amount: 500 },
        usage: createMockUsage(),
      })

      prisma.conversation.update.mockResolvedValue({})

      const payload = { conversationId: 'conv-123' }

      await handleIdleEvent('extract-123', payload)

      expect(extractData).toHaveBeenCalledWith(
        mockMessages,
        integrationWithModel.schema,
        expect.objectContaining({
          user: mockConversation.user,
          model: 'gpt-4o',
        })
      )
    })

    it('should not pass model to extractData when model is null', async () => {
      const integrationWithoutModel = {
        ...mockIntegration,
        model: null,
      }

      prisma.extractIntegration.findUnique.mockResolvedValue(
        integrationWithoutModel
      )
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      prisma.message.findMyriad.mockResolvedValue(mockMessages)
      getSortedMessages.mockReturnValue(mockMessages)

      extractData.mockResolvedValue({
        data: { amount: 500 },
        usage: createMockUsage(),
      })

      prisma.conversation.update.mockResolvedValue({})

      const payload = { conversationId: 'conv-123' }

      await handleIdleEvent('extract-123', payload)

      expect(extractData).toHaveBeenCalledWith(
        mockMessages,
        integrationWithoutModel.schema,
        expect.objectContaining({
          user: mockConversation.user,
          model: undefined,
        })
      )
    })
  })
})
