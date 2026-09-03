/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from '@/pages/api/v1/integration/trigger/[triggerIntegrationId]/event'
import {
  INTERACT_EVENT_TYPE,
  sendEvent,
} from '@/pages/api/v1/integration/trigger/[triggerIntegrationId]/queue'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    triggerIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock(
  '@/pages/api/v1/integration/trigger/[triggerIntegrationId]/queue',
  () => ({
    INTERACT_EVENT_TYPE: 'interact',
    sendEvent: jest.fn(),
  })
)

describe('Trigger event API handler', () => {
  const triggerIntegrationId = 'trigger-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function makeRequest({
    integrationId = triggerIntegrationId,
    method = 'POST',
    body = '{"data": "test event"}',
    queryParams = {},
    authorization = null,
  } = {}) {
    const queryString = new URLSearchParams({
      triggerIntegrationId: integrationId,
      ...queryParams,
    }).toString()
    const url = `https://example.com/api/v1/integration/trigger/${integrationId}/event?${queryString}`

    const headers = {
      'Content-Type': 'application/json',
    }

    if (authorization) {
      headers.Authorization = authorization
    }

    return new Request(url, {
      method,
      headers,
      body: method !== 'GET' ? body : undefined,
    })
  }

  describe('integration lookup', () => {
    it('returns 404 when integration does not exist', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue(null)

      const req = makeRequest()
      const res = await handler(req)

      expect(res.status).toBe(404)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('looks up integration by triggerIntegrationId from URL', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: 'trigger-456',
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: false,
      })

      const req = makeRequest({ integrationId: 'trigger-456' })

      await handler(req)

      expect(prisma.triggerIntegration.findUnique).toHaveBeenCalledWith({
        where: { id: 'trigger-456' },
      })
    })
  })

  describe('authentication', () => {
    it('returns 401 when authentication required but no header provided', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: true,
      })

      const req = makeRequest()
      const res = await handler(req)

      expect(res.status).toBe(401)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('returns 401 when authentication required but wrong token provided', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: true,
      })

      const req = makeRequest({
        body: '{"data": "test"}',
        authorization: 'Bearer wrong-token',
      })

      const res = await handler(req)

      expect(res.status).toBe(401)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('allows access when authentication required and correct token provided', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: true,
      })

      const req = makeRequest({
        body: '{"data": "test"}',
        authorization: 'Bearer secret-token',
      })

      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalled()
    })

    it('allows access when authentication is disabled', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: false,
      })

      const req = makeRequest()
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalled()
    })
  })

  describe('event sending', () => {
    it('sends trigger with correct payload from POST body', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: false,
      })

      const req = makeRequest({ body: '{"order_id": "12345"}' })

      await handler(req)

      expect(sendEvent).toHaveBeenCalledWith(
        triggerIntegrationId,
        expect.objectContaining({
          type: INTERACT_EVENT_TYPE,
          payload: expect.objectContaining({
          body: '{"order_id": "12345"}',
          }),
        })
        )
    })

    it('sends trigger with empty body for GET requests', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: false,
      })

      const req = makeRequest({ method: 'GET' })

      await handler(req)

      expect(sendEvent).toHaveBeenCalledWith(
        triggerIntegrationId,
        expect.objectContaining({
          type: INTERACT_EVENT_TYPE,
          payload: expect.objectContaining({
          body: '',
          }),
        })
        )
    })

    it('includes session from query parameter', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: false,
      })

      const req = makeRequest({
        queryParams: { session: 'checkout_abc123' },
      })

      await handler(req)

      expect(sendEvent).toHaveBeenCalledWith(
        triggerIntegrationId,
        expect.objectContaining({
          type: INTERACT_EVENT_TYPE,
          payload: expect.objectContaining({
          session: 'checkout_abc123',
          }),
        })
        )
    })

    it('includes contact info from dot notation query parameters', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: false,
      })

      const req = makeRequest({
        queryParams: {
          'contact.name': 'John Smith',
          'contact.email': 'john@example.com',
          'contact.phone': '555-0123',
        },
      })

      await handler(req)

      expect(sendEvent).toHaveBeenCalledWith(
        triggerIntegrationId,
        expect.objectContaining({
          type: INTERACT_EVENT_TYPE,
          payload: expect.objectContaining({
          contact: {
            name: 'John Smith',
            email: 'john@example.com',
            phone: '555-0123',
          },
          }),
        })
        )
    })

    it('includes contact info from underscore notation query parameters', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: false,
      })

      const req = makeRequest({
        queryParams: {
          contact_name: 'Jane Doe',
          contact_email: 'jane@example.com',
          contact_phone: '555-0456',
        },
      })

      await handler(req)

      expect(sendEvent).toHaveBeenCalledWith(
        triggerIntegrationId,
        expect.objectContaining({
          type: INTERACT_EVENT_TYPE,
          payload: expect.objectContaining({
          contact: {
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: '555-0456',
          },
          }),
        })
        )
    })

    it('prefers dot notation over underscore notation for contact params', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: false,
      })

      const req = makeRequest({
        queryParams: {
          'contact.name': 'DotName',
          contact_name: 'UnderscoreName',
        },
      })

      await handler(req)

      expect(sendEvent).toHaveBeenCalledWith(
        triggerIntegrationId,
        expect.objectContaining({
          type: INTERACT_EVENT_TYPE,
          payload: expect.objectContaining({
          contact: expect.objectContaining({
            name: 'DotName',
          }),
          }),
        })
        )
    })
  })

  describe('response handling', () => {
    it('returns ok response on success', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        secret: 'secret-token',
        authenticate: false,
      })

      const req = makeRequest()
      const res = await handler(req)

      expect(res.status).toBe(200)
    })
  })

  describe('HTTP method handling', () => {
    it('handles POST requests', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        authenticate: false,
      })

      const req = makeRequest({ method: 'POST' })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalled()
    })

    it('handles GET requests', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        authenticate: false,
      })

      const req = makeRequest({ method: 'GET' })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalled()
    })

    it('handles PUT requests', async () => {
      prisma.triggerIntegration.findUnique.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        authenticate: false,
      })

      const req = makeRequest({ method: 'PUT', body: '{"data": "test"}' })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalled()
    })
  })
})
