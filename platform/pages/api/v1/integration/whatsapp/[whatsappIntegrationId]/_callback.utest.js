/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { logEvent } from '@/lib/log'
import { parseRequestJson } from '@/lib/request'
import { validateWhatsAppRequest } from '@/lib/whatsapp.signature'

import handler from '@/pages/api/v1/integration/whatsapp/[whatsappIntegrationId]/callback'
import { sendEvent } from '@/pages/api/v1/integration/whatsapp/[whatsappIntegrationId]/queue'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  whatsappIntegration: {
    findUnique: jest.fn(),
  },
}))

jest.mock(
  '@/pages/api/v1/integration/whatsapp/[whatsappIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
  })
)

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/whatsapp.signature', () => ({
  validateWhatsAppRequest: jest.fn(),
}))

describe('WhatsApp callback API handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    validateWhatsAppRequest.mockResolvedValue(true)
  })

  function makeRequest(
    payload,
    {
      whatsappIntegrationId = 'int-123',
      method = 'POST',
      queryParams = {},
    } = {}
  ) {
    const queryString = new URLSearchParams({
      whatsappIntegrationId,
      ...queryParams,
    }).toString()
    const url = `https://example.com/api/v1/integration/whatsapp/${whatsappIntegrationId}/callback?${queryString}`

    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})

    return new Request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' ? body : undefined,
    })
  }

  describe('integration lookup', () => {
    it('returns notFound when integration does not exist', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue(null)

      const req = makeRequest({})
      const res = await handler(req)

      expect(res.status).toBe(404)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('looks up integration by whatsappIntegrationId from URL', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-456',
        userId: 'user-1',
        verifyToken: 'test-token',
      })
      parseRequestJson.mockResolvedValue({})

      const req = makeRequest({}, { whatsappIntegrationId: 'int-456' })

      await handler(req)

      expect(prisma.whatsappIntegration.findUnique).toHaveBeenCalledWith({
        where: { id: 'int-456' },
      })
    })
  })

  describe('webhook subscription verification', () => {
    it('returns challenge when verify token matches', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'my-verify-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const req = makeRequest(
        {},
        {
          method: 'GET',
          queryParams: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'my-verify-token',
            'hub.challenge': 'challenge123',
          },
        }
      )

      const res = await handler(req)

      expect(res.status).toBe(200)

      const text = await res.text()

      expect(text).toBe('challenge123')

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.whatsapp.callback.subscribe',
          meta: expect.objectContaining({
            status: 200,
            reason: 'OK',
          }),
        })
      )
    })

    it('returns notAuthorized when verify token does not match', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'my-verify-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const req = makeRequest(
        {},
        {
          method: 'GET',
          queryParams: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'wrong-token',
            'hub.challenge': 'challenge123',
          },
        }
      )

      const res = await handler(req)

      expect(res.status).toBe(403)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.whatsapp.callback.subscribe',
          meta: expect.objectContaining({
            status: 403,
            reason: 'Verification token does not match.',
          }),
        })
      )
    })
  })

  describe('message entry processing', () => {
    it('rejects a notification with an invalid signature', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        appSecret: 'meta-app-secret',
      })
      validateWhatsAppRequest.mockRejectedValueOnce(
        new Error('Invalid signature')
      )

      const payload = { entry: [] }
      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(403)
      expect(sendEvent).not.toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.whatsapp.configuration.error',
          meta: expect.objectContaining({ status: 403 }),
        })
      )
    })

    it('processes a notification without validation when no app secret is configured', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
      })

      const req = makeRequest({ entry: [] })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(validateWhatsAppRequest).not.toHaveBeenCalled()
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('validates the exact raw body before parsing a notification', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        appSecret: 'meta-app-secret',
      })
      parseRequestJson.mockResolvedValue({ entry: [] })

      const rawBody = '{ "entry": [] }'
      const req = makeRequest(rawBody)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(validateWhatsAppRequest).toHaveBeenCalledWith(
        req,
        rawBody,
        'meta-app-secret'
      )
    })

    it('processes a message once its signature is valid', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        appSecret: 'meta-app-secret',
      })

      const messagePayload = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      id: 'msg-1',
                      from: '1234567890',
                      type: 'text',
                      text: { body: 'Hi' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const req = makeRequest(messagePayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(validateWhatsAppRequest).toHaveBeenCalledWith(
        req,
        JSON.stringify(messagePayload),
        'meta-app-secret'
      )
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: messagePayload.entry[0].changes[0].value,
      })
    })

    it('returns not authorized when the body is not valid json', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
      })

      const req = makeRequest('this is not json')
      const res = await handler(req)

      expect(res.status).toBe(403)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('sends interact event for incoming messages', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const messagePayload = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      id: 'msg-1',
                      from: '1234567890',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                  contacts: [
                    {
                      wa_id: '1234567890',
                      profile: { name: 'Test User' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(messagePayload)

      const req = makeRequest(messagePayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.whatsapp.callback.notification',
        })
      )
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: messagePayload.entry[0].changes[0].value,
      })
    })

    it('processes multiple entries and changes', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const messagePayload = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [{ id: 'msg-1', from: '111', type: 'text' }],
                },
              },
              {
                field: 'messages',
                value: {
                  messages: [{ id: 'msg-2', from: '222', type: 'text' }],
                },
              },
            ],
          },
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [{ id: 'msg-3', from: '333', type: 'text' }],
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(messagePayload)

      const req = makeRequest(messagePayload)

      await handler(req)

      expect(sendEvent).toHaveBeenCalledTimes(3)
    })

    it('ignores changes that are not messages field', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })

      const payload = {
        entry: [
          {
            changes: [
              {
                field: 'statuses',
                value: { statuses: [{ status: 'delivered' }] },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(payload)

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('ignores messages field changes without messages array', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })

      const payload = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: { statuses: [{ status: 'read' }] },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(payload)

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('ignores an empty messages array', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
      })

      const req = makeRequest({
        entry: [{ changes: [{ field: 'messages', value: { messages: [] } }] }],
      })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('default handler', () => {
    it('returns ok for empty POST body', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })
      parseRequestJson.mockResolvedValue({})

      const req = makeRequest({})
      const res = await handler(req)

      expect(res.status).toBe(200)
    })

    it('returns ok for GET request without subscription params', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })

      const req = makeRequest({}, { method: 'GET' })
      const res = await handler(req)

      expect(res.status).toBe(200)
    })

    it('returns ok when entry is not an array', async () => {
      prisma.whatsappIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })
      parseRequestJson.mockResolvedValue({ entry: 'not-an-array' })

      const req = makeRequest({ entry: 'not-an-array' })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })
})
