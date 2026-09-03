/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { fetchPlusPlus } from '@/lib/egress.fetch'
import { normalizeRequest, parseRequest } from '@/lib/http'
import { logEvent } from '@/lib/log'
import queue from '@/lib/queue'
import { createHmacHexDigest } from '@/lib/webcrypto'

import {
  TRIGGER_EVENT_TYPE,
  handleTriggerEventType,
  sendEvent,
} from '@/pages/api/v1/webhook/[webhookId]/queue'

// @note virtual: true required because prisma client is not generated in this environment
jest.mock(
  '@/prisma/client',
  () => ({
    webhook: {
      findUnique: jest.fn(),
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/egress.fetch', () => ({
  fetchPlusPlus: jest.fn(),
}))

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

jest.mock('@/lib/http', () => ({
  parseRequest: jest.fn(),
  normalizeRequest: jest.fn(),
}))

jest.mock('@/lib/webcrypto', () => ({
  createHmacHexDigest: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: (_paramName, handlers) => handlers,
}))

jest.mock('@/lib/debug', () => {
  const chainable = { log: jest.fn() }

  chainable.log.mockReturnValue(chainable)

  return {
    __esModule: true,
    default: jest.fn(() => chainable),
  }
})

jest.mock('@/lib/error', () => ({
  captureInputError: jest.fn(),
}))

jest.mock('@/lib/zod.schema', () => ({
  parseAsync: jest.fn(async (schema, value) => value),
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

describe('webhook/[webhookId]/queue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleTriggerEventType', () => {
    it('returns early when webhook is not found', async () => {
      prisma.webhook.findUnique.mockResolvedValue(null)

      await handleTriggerEventType('webhook-1', {
        eventType: 'message.created',
        eventData: {},
      })

      expect(fetchPlusPlus).not.toHaveBeenCalled()
    })

    it('returns early when webhook has no request config', async () => {
      prisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        userId: 'user-1',
        request: null,
        events: 'message.created',
        secret: 'secret',
      })

      await handleTriggerEventType('webhook-1', {
        eventType: 'message.created',
        eventData: {},
      })

      expect(fetchPlusPlus).not.toHaveBeenCalled()
    })

    it('returns early when webhook has no events configured', async () => {
      prisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        userId: 'user-1',
        request: 'POST https://example.com/hook HTTP/1.1\n\n',
        events: null,
        secret: 'secret',
      })

      await handleTriggerEventType('webhook-1', {
        eventType: 'message.created',
        eventData: {},
      })

      expect(fetchPlusPlus).not.toHaveBeenCalled()
    })

    it('returns early when eventType is not in supported events list', async () => {
      prisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        userId: 'user-1',
        request: 'POST https://example.com/hook HTTP/1.1\n\n',
        events: 'conversation.created,conversation.updated',
        secret: 'secret',
      })

      await handleTriggerEventType('webhook-1', {
        eventType: 'message.created',
        eventData: {},
      })

      expect(fetchPlusPlus).not.toHaveBeenCalled()
    })

    it('sends HTTP request when event type matches supported events', async () => {
      const mockRequest = {
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      }

      prisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        userId: 'user-1',
        request: 'POST https://example.com/hook HTTP/1.1\n\n',
        events: 'message.created,conversation.created',
        secret: 'mysecret',
      })

      parseRequest.mockReturnValue(mockRequest)
      normalizeRequest.mockReturnValue({
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'message.created', eventData: {} }),
      })
      createHmacHexDigest.mockResolvedValue('abc123hmac')
      fetchPlusPlus.mockResolvedValue({ ok: true, body: null })

      await handleTriggerEventType('webhook-1', {
        eventType: 'message.created',
        eventData: { id: 'msg-1' },
      })

      expect(fetchPlusPlus).toHaveBeenCalledTimes(1)
    })

    it('sets x-hub-signature header with HMAC before dispatch', async () => {
      const capturedHeaders = {}

      const mockRequest = {
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: {},
        body: '{"eventType":"message.created","eventData":{}}',
      }

      prisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        userId: 'user-1',
        request: 'POST https://example.com/hook HTTP/1.1\n\n',
        events: 'message.created',
        secret: 'supersecret',
      })

      parseRequest.mockReturnValue(mockRequest)
      normalizeRequest.mockImplementation((req) => ({
        method: req.method,
        uri: req.uri,
        headers: { ...req.headers },
        body: req.body,
      }))
      createHmacHexDigest.mockResolvedValue('deadbeef1234')
      fetchPlusPlus.mockImplementation((_url, options) => {
        Object.assign(capturedHeaders, options.headers)

        return Promise.resolve({ ok: true, body: null })
      })

      await handleTriggerEventType('webhook-1', {
        eventType: 'message.created',
        eventData: {},
      })

      expect(createHmacHexDigest).toHaveBeenCalledWith(
        'sha256',
        'supersecret',
        expect.any(String)
      )
      expect(capturedHeaders['x-hub-signature']).toBe('sha256=deadbeef1234')
    })

    it('logs event on successful HTTP response', async () => {
      const mockRequest = {
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: {},
        body: '',
      }

      prisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        userId: 'user-1',
        request: 'POST https://example.com/hook HTTP/1.1\n\n',
        events: 'message.created',
        secret: 'secret',
      })

      parseRequest.mockReturnValue(mockRequest)
      normalizeRequest.mockReturnValue({
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: {},
        body: '',
      })
      createHmacHexDigest.mockResolvedValue('hmac')
      fetchPlusPlus.mockResolvedValue({ ok: true, status: 200, body: null })

      await handleTriggerEventType('webhook-1', {
        eventType: 'message.created',
        eventData: {},
      })

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-1' },
          type: 'webhook.request',
          relations: { webhookId: 'webhook-1' },
          meta: expect.objectContaining({ status: 200 }),
        })
      )
    })

    it('logs event and throws on non-OK HTTP response to trigger retry', async () => {
      const mockRequest = {
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: {},
        body: '',
      }

      prisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        userId: 'user-1',
        request: 'POST https://example.com/hook HTTP/1.1\n\n',
        events: 'message.created',
        secret: 'secret',
      })

      parseRequest.mockReturnValue(mockRequest)
      normalizeRequest.mockReturnValue({
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: {},
        body: '',
      })
      createHmacHexDigest.mockResolvedValue('hmac')
      fetchPlusPlus.mockResolvedValue({ ok: false, status: 503, body: null })

      await expect(
        handleTriggerEventType('webhook-1', {
          eventType: 'message.created',
          eventData: {},
        })
      ).rejects.toThrow('Webhook Request Failure')

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-1' },
          type: 'webhook.request',
          relations: { webhookId: 'webhook-1' },
          meta: expect.objectContaining({ status: 503 }),
        })
      )
    })

    it('refuses a private-IP literal webhook URL before any connection is attempted', async () => {
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

      prisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        userId: 'user-1',
        request: 'POST http://127.0.0.1/hook HTTP/1.1\n\n',
        events: 'message.created',
        secret: 'secret',
      })

      parseRequest.mockReturnValue({
        method: 'POST',
        uri: 'http://127.0.0.1/hook',
        headers: {},
        body: '',
      })
      normalizeRequest.mockReturnValue({
        method: 'POST',
        uri: 'http://127.0.0.1/hook',
        headers: {},
        body: '',
      })
      createHmacHexDigest.mockResolvedValue('hmac')

      await expect(
        handleTriggerEventType('webhook-1', {
          eventType: 'message.created',
          eventData: {},
        })
      ).rejects.toThrow()

      expect(fetchPlusPlus).toHaveBeenCalledWith(
        'http://127.0.0.1/hook',
        expect.any(Object)
      )
      expect(causeChainMessages(captured)).toMatch(
        /egress to 127\.0\.0\.1 is not allowed: not a public address/
      )
      expect(logEvent).not.toHaveBeenCalled()
    })

    it('encodes eventType and eventData in the request body', async () => {
      let capturedBody = ''

      const mockRequest = {
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: {},
        body: '',
      }

      prisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        userId: 'user-1',
        request: 'POST https://example.com/hook HTTP/1.1\n\n',
        events: 'task.completed',
        secret: 'secret',
      })

      parseRequest.mockReturnValue(mockRequest)
      normalizeRequest.mockImplementation((req) => ({
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: {},
        body: req.body,
      }))
      createHmacHexDigest.mockResolvedValue('hmac')
      fetchPlusPlus.mockImplementation((_url, options) => {
        capturedBody = options.body

        return Promise.resolve({ ok: true, status: 200, body: null })
      })

      await handleTriggerEventType('webhook-1', {
        eventType: 'task.completed',
        eventData: { taskId: 'task-42', result: 'ok' },
      })

      const parsedBody = JSON.parse(capturedBody)

      expect(parsedBody).toEqual({
        eventType: 'task.completed',
        eventData: { taskId: 'task-42', result: 'ok' },
      })
    })

    it('drains response body stream to completion on success', async () => {
      const mockRequest = {
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: {},
        body: '',
      }

      const consumed = []

      async function* _mockStream() {
        yield 'chunk1'
        yield 'chunk2'
      }

      prisma.webhook.findUnique.mockResolvedValue({
        id: 'webhook-1',
        userId: 'user-1',
        request: 'POST https://example.com/hook HTTP/1.1\n\n',
        events: 'message.created',
        secret: 'secret',
      })

      parseRequest.mockReturnValue(mockRequest)
      normalizeRequest.mockReturnValue({
        method: 'POST',
        uri: 'https://example.com/hook',
        headers: {},
        body: '',
      })
      createHmacHexDigest.mockResolvedValue('hmac')
      fetchPlusPlus.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of ['chunk1', 'chunk2']) {
              consumed.push(chunk)
              yield chunk
            }
          },
        },
      })

      await handleTriggerEventType('webhook-1', {
        eventType: 'message.created',
        eventData: {},
      })

      // All chunks should have been consumed
      expect(consumed).toEqual(['chunk1', 'chunk2'])
    })
  })

  describe('sendEvent', () => {
    it('queues event to the correct webhook queue path', async () => {
      await sendEvent('webhook-99', {
        type: TRIGGER_EVENT_TYPE,
        payload: {
          eventType: 'message.created',
          eventData: { id: 'msg-1' },
        },
      })

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/webhook/webhook-99/queue',
        expect.objectContaining({ type: TRIGGER_EVENT_TYPE }),
        expect.any(Object)
      )
    })

    it('queues with the provided payload intact', async () => {
      const payload = {
        eventType: 'task.completed',
        eventData: { result: 'done' },
      }

      await sendEvent('webhook-42', {
        type: TRIGGER_EVENT_TYPE,
        payload,
      })

      const [, event] = queue.mock.calls[0]

      expect(event.payload).toEqual(payload)
    })
  })
})
