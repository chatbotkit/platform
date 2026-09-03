/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import { logEvent } from '@/lib/log'
import { verifyRecallSignature } from '@/lib/recall.signature'

import prisma from '@/prisma/client'

import { sendEvent } from '@/pages/api/v1/integration/recall/[recallIntegrationId]/queue'
import handler from '@/pages/api/v1/integration/recall/[recallIntegrationId]/webhook'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock(
  '@/pages/api/v1/integration/recall/[recallIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
    FINALISE_EVENT_TYPE: 'finalise',
  })
)

jest.mock('@/lib/debug', () => {
  const logger = { log: jest.fn() }
  const debug = jest.fn(() => logger)

  return {
    __esModule: true,
    default: debug,
    warn: jest.fn(() => logger),
    assert: (test, message) => {
      if (!test) {
        throw new Error(message)
      }
    },
  }
})

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

// @note the verifier has its own suite (lib/recall.signature.utest.js); here
// it is a switch, so the handler's two outcomes can be asserted directly
jest.mock('@/lib/recall.signature', () => ({
  verifyRecallSignature: jest.fn(async () => true),
}))

describe('Recall webhook handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function makeRequest(body, { recallIntegrationId = 'int-recall-1' } = {}) {
    const url = `https://example.com/api/v1/integration/recall/${recallIntegrationId}/webhook?recallIntegrationId=${recallIntegrationId}`

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body ?? {})

    return new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    })
  }

  function makeCallEndedPayload({
    sessionId = 'session-abc',
    recallBotId = 'bot-xyz',
    subCode = '',
  } = {}) {
    return {
      event: 'bot.call_ended',
      bot: {
        id: recallBotId,
        metadata: {
          sessionId,
        },
      },
      data: {
        ...(subCode ? { sub_code: subCode } : {}),
      },
    }
  }

  describe('integration lookup', () => {
    it('returns 404 when integration is not found', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue(null)

      const res = await handler(makeRequest(makeCallEndedPayload()))

      expect(res.status).toBe(404)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('returns 200 and does nothing when integration exists but event is irrelevant', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      const res = await handler(makeRequest({ event: 'bot.status_changed' }))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('event filtering', () => {
    it('ignores events other than bot.call_ended', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      const payloads = [
        { event: 'bot.joining_call' },
        { event: 'bot.in_waiting_room' },
        { event: 'bot.in_call_not_recording' },
        { event: 'bot.recording_permission_allowed' },
      ]

      for (const payload of payloads) {
        jest.clearAllMocks()
        prisma.recallIntegration.findUnique.mockResolvedValue({
          id: 'int-recall-1',
        })

        const res = await handler(makeRequest(payload))

        expect(res.status).toBe(200)
        expect(sendEvent).not.toHaveBeenCalled()
      }
    })

    it('queues finalise for bot.call_ended event with all fields', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      sendEvent.mockResolvedValue(undefined)

      const res = await handler(
        makeRequest(
          makeCallEndedPayload({
            sessionId: 'session-abc',
            recallBotId: 'bot-xyz',
            subCode: 'completed',
          })
        )
      )

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-recall-1', {
        type: 'finalise',
        payload: {
          sessionId: 'session-abc',
          recallBotId: 'bot-xyz',
          subCode: 'completed',
        },
      })
    })

    it('omits recallBotId from event payload when bot id is absent', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      sendEvent.mockResolvedValue(undefined)

      const payload = {
        event: 'bot.call_ended',
        bot: {
          // @note no id field
          metadata: { sessionId: 'session-abc' },
        },
        data: {},
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith(
        'int-recall-1',
        expect.objectContaining({
          payload: expect.not.objectContaining({
            recallBotId: expect.anything(),
          }),
        })
      )
    })

    it('omits subCode from event payload when sub_code is absent', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      sendEvent.mockResolvedValue(undefined)

      const res = await handler(
        makeRequest(
          makeCallEndedPayload({
            sessionId: 'session-abc',
            recallBotId: 'bot-xyz',
            subCode: '',
          })
        )
      )

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith(
        'int-recall-1',
        expect.objectContaining({
          payload: expect.not.objectContaining({ subCode: expect.anything() }),
        })
      )
    })

    it('returns 200 without queueing when sessionId is missing from bot metadata', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      const payload = {
        event: 'bot.call_ended',
        bot: {
          id: 'bot-xyz',
          metadata: {
            // @note sessionId omitted
          },
        },
        data: {},
      }

      const res = await handler(makeRequest(payload))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('body parsing', () => {
    it('returns 200 without queueing when body is empty', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      const req = new Request(
        'https://example.com/api/v1/integration/recall/int-recall-1/webhook?recallIntegrationId=int-recall-1',
        { method: 'POST', body: '' }
      )

      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('returns 200 without queueing when body is not valid JSON', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      const res = await handler(makeRequest('not-json-at-all'))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('returns 200 without queueing when body is a JSON array (not an object)', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      const res = await handler(makeRequest('[1, 2, 3]'))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('returns 200 without queueing when event field is not a string', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      const res = await handler(makeRequest({ event: 42 }))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('handles deeply nested missing bot metadata gracefully', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      // bot.call_ended but bot object is absent
      const res = await handler(makeRequest({ event: 'bot.call_ended' }))

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('handles bot present but metadata is not an object', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
      })

      const res = await handler(
        makeRequest({
          event: 'bot.call_ended',
          bot: { id: 'bot-xyz', metadata: 'string-not-object' },
          data: {},
        })
      )

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('correct integration id is used', () => {
    it('looks up integration using the path param, not any body field', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue(null)

      const req = makeRequest(makeCallEndedPayload(), {
        recallIntegrationId: 'target-int-id',
      })

      await handler(req)

      expect(prisma.recallIntegration.findUnique).toHaveBeenCalledWith({
        where: { id: 'target-int-id' },
      })
    })
  })

  describe('signature verification', () => {
    const callEnded = {
      event: 'bot.call_ended',
      bot: { id: 'bot-1', metadata: { sessionId: 'sess-1' } },
    }

    it('verifies and proceeds when the webhook secret is set', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
        userId: 'user-1',
        webhookSecret: 'whsec_abc',
      })

      verifyRecallSignature.mockResolvedValueOnce(true)

      const res = await handler(makeRequest(callEnded))

      expect(verifyRecallSignature).toHaveBeenCalledWith(
        expect.objectContaining({ webhookSecret: 'whsec_abc' })
      )
      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalled()
    })

    it('rejects with 403 and records a configuration error when the signature fails', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
        userId: 'user-1',
        webhookSecret: 'whsec_abc',
      })

      verifyRecallSignature.mockResolvedValueOnce(false)

      const res = await handler(makeRequest(callEnded))

      expect(res.status).toBe(403)
      expect(sendEvent).not.toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.recall.configuration.error',
        })
      )
    })

    it('skips verification, logged, when no webhook secret is configured', async () => {
      // @note the documented bypass: an integration configured before the
      // secret existed keeps working rather than breaking on upgrade
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
        userId: 'user-1',
      })

      const res = await handler(makeRequest(callEnded))

      expect(verifyRecallSignature).not.toHaveBeenCalled()
      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalled()
    })

    it('ignores a delivery whose metadata names a different integration', async () => {
      prisma.recallIntegration.findUnique.mockResolvedValue({
        id: 'int-recall-1',
        userId: 'user-1',
      })

      const res = await handler(
        makeRequest({
          event: 'bot.call_ended',
          bot: {
            id: 'bot-1',
            metadata: { sessionId: 'sess-1', recallIntegrationId: 'other' },
          },
        })
      )

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })
})
