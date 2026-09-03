/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { logEvent } from '@/lib/log'
import { parseRequestJson } from '@/lib/request'
import { verifyBotFrameworkToken } from '@/lib/microsoftteams.auth'

import { sendEvent } from '@/pages/api/v1/integration/microsoftteams/[microsoftteamsIntegrationId]/queue'

import handler from './callback'

jest.mock('@/prisma/client', () => ({
  microsoftteamsIntegration: {
    findUnique: jest.fn(),
  },
}))

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/microsoftteams.auth', () => ({
  verifyBotFrameworkToken: jest.fn(),
}))

jest.mock(
  '@/pages/api/v1/integration/microsoftteams/[microsoftteamsIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
  })
)

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => {
    const url = new URL(req.url, 'http://localhost')
    const value = url.searchParams.get(param) || req.query?.[param]

    if (!value) {
      const error = new Error('Bad request')

      error.name = 'SystemError'

      throw error
    }

    return value
  }),
}))

jest.mock('@/lib/debug', () => {
  const debug = () => ({ log: jest.fn() })

  return { __esModule: true, default: debug }
})

/**
 * @param {object} body
 * @param {object} [opts]
 * @param {string} [opts.microsoftteamsIntegrationId]
 * @param {string} [opts.method]
 * @param {string} [opts.authorization]
 */
function makeRequest(body, opts = {}) {
  const integrationId = opts.microsoftteamsIntegrationId || 'ti-abc123'
  const method = opts.method || 'POST'
  const authorization = opts.authorization || 'Bearer mock-token'

  const url = `http://localhost/api/v1/integration/microsoftteams/${integrationId}/callback?microsoftteamsIntegrationId=${integrationId}`

  const req = new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
    },
    ...(method !== 'GET' && body ? { body: JSON.stringify(body) } : {}),
  })

  // @note attach query for requiredUrlParam mock
  req.query = { microsoftteamsIntegrationId: integrationId }

  return req
}

describe('POST /api/v1/integration/microsoftteams/{microsoftteamsIntegrationId}/callback', () => {
  const mockIntegration = {
    id: 'ti-abc123',
    userId: 'user-123',
    botFrameworkAppId: 'app-id-123',
    botFrameworkAppSecret: 'app-secret-123',
    botId: 'bot-456',
    blueprintId: null,
  }

  beforeEach(() => {
    jest.clearAllMocks()

    verifyBotFrameworkToken.mockResolvedValue(true)
  })

  describe('integration lookup', () => {
    it('should return 404 when integration not found', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(null)

      parseRequestJson.mockResolvedValue({ type: 'message' })

      const req = makeRequest({ type: 'message' })

      const result = await handler(req)

      expect(result.status).toBe(404)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('authentication', () => {
    it('should validate Bot Framework token', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)
      verifyBotFrameworkToken.mockResolvedValue(true)
      parseRequestJson.mockResolvedValue({ type: 'message', text: 'hello' })

      const req = makeRequest(
        { type: 'message', text: 'hello' },
        { authorization: 'Bearer valid-token' }
      )

      await handler(req)

      expect(verifyBotFrameworkToken).toHaveBeenCalledWith(
        'Bearer valid-token',
        'app-id-123'
      )
    })

    it('should return 403 when token validation fails', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)
      verifyBotFrameworkToken.mockResolvedValue(false)
      parseRequestJson.mockResolvedValue({ type: 'message' })

      const req = makeRequest({ type: 'message' })

      const result = await handler(req)

      expect(result.status).toBe(403)
      expect(sendEvent).not.toHaveBeenCalled()

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.microsoftteams.callback.unauthorized',
        })
      )
    })

    it('should return 409 when Bot Framework App ID is missing', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        botFrameworkAppId: null,
      })

      parseRequestJson.mockResolvedValue({ type: 'message' })

      const req = makeRequest({ type: 'message' })

      const result = await handler(req)

      expect(result.status).toBe(409)
      expect(sendEvent).not.toHaveBeenCalled()

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.microsoftteams.configuration.error',
        })
      )
    })
  })

  describe('message activities', () => {
    it('should queue interact event for incoming message', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)

      const messagePayload = {
        type: 'message',
        id: 'activity-789',
        text: 'Hello bot!',
        from: { id: 'user-teams-1', name: 'Test User' },
        conversation: { id: 'conv-123' },
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
      }

      parseRequestJson.mockResolvedValue(messagePayload)

      const req = makeRequest(messagePayload)

      const result = await handler(req)

      expect(result.status).toBe(200)

      expect(sendEvent).toHaveBeenCalledWith('ti-abc123', {
        type: 'interact',
        payload: {
          activityId: 'activity-789',
          conversationId: 'conv-123',
          serviceUrl: 'https://smba.trafficmanager.net/teams/',
          fromId: 'user-teams-1',
          fromName: 'Test User',
          message: 'Hello bot!',
        },
      })
    })

    it('should not queue event when text is missing', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)

      parseRequestJson.mockResolvedValue({
        type: 'message',
        id: 'activity-789',
        from: { id: 'user-teams-1', name: 'Test User' },
        conversation: { id: 'conv-123' },
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
      })

      const req = makeRequest({})

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('should not queue event when fromId is missing', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)

      parseRequestJson.mockResolvedValue({
        type: 'message',
        id: 'activity-789',
        text: 'Hello',
        conversation: { id: 'conv-123' },
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
      })

      const req = makeRequest({})

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('should not queue event when conversationId is missing', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)

      parseRequestJson.mockResolvedValue({
        type: 'message',
        id: 'activity-789',
        text: 'Hello',
        from: { id: 'user-teams-1' },
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
      })

      const req = makeRequest({})

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('should use empty string for fromName when not provided', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)

      parseRequestJson.mockResolvedValue({
        type: 'message',
        id: 'activity-789',
        text: 'Hello',
        from: { id: 'user-teams-1' },
        conversation: { id: 'conv-123' },
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
      })

      const req = makeRequest({})

      const result = await handler(req)

      expect(result.status).toBe(200)

      expect(sendEvent).toHaveBeenCalledWith(
        'ti-abc123',
        expect.objectContaining({
          payload: expect.objectContaining({
            fromName: '',
          }),
        })
      )
    })

    it('should log message event with correct relations', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)

      parseRequestJson.mockResolvedValue({
        type: 'message',
        id: 'activity-789',
        text: 'Hello',
        from: { id: 'user-teams-1', name: 'User' },
        conversation: { id: 'conv-123' },
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
      })

      const req = makeRequest({})

      await handler(req)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.microsoftteams.callback.message',
          relations: expect.objectContaining({
            microsoftteamsIntegrationId: 'ti-abc123',
            botId: 'bot-456',
          }),
        })
      )
    })
  })

  describe('conversation update activities', () => {
    it('should log conversationUpdate activity', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)

      parseRequestJson.mockResolvedValue({
        type: 'conversationUpdate',
        membersAdded: [{ id: 'user-1' }],
      })

      const req = makeRequest({})

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.microsoftteams.callback.conversationUpdate',
        })
      )
    })

    it('should log installationUpdate activity', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)

      parseRequestJson.mockResolvedValue({
        type: 'installationUpdate',
        action: 'add',
      })

      const req = makeRequest({})

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.microsoftteams.callback.installationUpdate',
        })
      )
    })
  })

  describe('default handling', () => {
    it('should return 200 for unknown activity types', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)

      parseRequestJson.mockResolvedValue({
        type: 'typing',
      })

      const req = makeRequest({})

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('should return 200 for empty body', async () => {
      prisma.microsoftteamsIntegration.findUnique.mockResolvedValue(mockIntegration)

      parseRequestJson.mockResolvedValue({})

      const req = makeRequest({})

      const result = await handler(req)

      expect(result.status).toBe(200)
    })
  })
})
