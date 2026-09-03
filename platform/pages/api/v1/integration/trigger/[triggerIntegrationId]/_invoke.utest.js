/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from '@/pages/api/v1/integration/trigger/[triggerIntegrationId]/invoke'
import {
  INVOKE_EVENT_TYPE,
  sendEvent,
} from '@/pages/api/v1/integration/trigger/[triggerIntegrationId]/queue'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    triggerIntegration: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock(
  '@/pages/api/v1/integration/trigger/[triggerIntegrationId]/queue',
  () => ({
    INVOKE_EVENT_TYPE: 'invoke',
    sendEvent: jest.fn(),
  })
)

describe('Trigger invoke API handler', () => {
  const triggerIntegrationId = 'trigger-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function makeRequest({
    integrationId = triggerIntegrationId,
    method = 'POST',
  } = {}) {
    const queryString = new URLSearchParams({
      triggerIntegrationId: integrationId,
    }).toString()
    const url = `https://example.com/api/v1/integration/trigger/${integrationId}/invoke?${queryString}`

    return new Request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  function makeSession(userId = 'user-1') {
    return {
      user: {
        id: userId,
      },
    }
  }

  describe('integration lookup', () => {
    it('returns 404 when integration does not exist', async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = makeRequest()
      const session = makeSession()
      const res = await handler(req, session)

      expect(res.status).toBe(404)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('looks up integration by triggerIntegrationId from URL', async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'trigger-456',
        userId: 'user-1',
        schedule: 'daily',
      })

      const req = makeRequest({ integrationId: 'trigger-456' })
      const session = makeSession()

      await handler(req, session)

      expect(
        prisma.triggerIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        session.user,
        'trigger-456',
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            userId: true,
            schedule: true,
          }),
        })
      )
    })
  })

  describe('authorization', () => {
    it('returns 403 when user is not the owner', async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'other-user',
        schedule: 'daily',
      })

      const req = makeRequest()
      const session = makeSession('user-1')
      const res = await handler(req, session)

      expect(res.status).toBe(403)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('allows access when user is the owner', async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        schedule: 'daily',
      })

      const req = makeRequest()
      const session = makeSession('user-1')
      const res = await handler(req, session)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalled()
    })
  })

  describe('event sending', () => {
    it('queues an invoke event with the integration schedule', async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        schedule: 'hourly',
      })

      const req = makeRequest()
      const session = makeSession()

      await handler(req, session)

      expect(sendEvent).toHaveBeenCalledWith(triggerIntegrationId, {
        type: INVOKE_EVENT_TYPE,
        payload: { schedule: 'hourly' },
      })
    })

    it("falls back to 'never' when schedule is null", async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        schedule: null,
      })

      const req = makeRequest()
      const session = makeSession()

      await handler(req, session)

      expect(sendEvent).toHaveBeenCalledWith(triggerIntegrationId, {
        type: INVOKE_EVENT_TYPE,
        payload: { schedule: 'never' },
      })
    })

    it('forwards a cron schedule unchanged', async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        schedule: '*/5 * * * *',
      })

      const req = makeRequest()
      const session = makeSession()

      await handler(req, session)

      expect(sendEvent).toHaveBeenCalledWith(triggerIntegrationId, {
        type: INVOKE_EVENT_TYPE,
        payload: { schedule: '*/5 * * * *' },
      })
    })
  })

  describe('response handling', () => {
    it('returns ok with integration id on success', async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: triggerIntegrationId,
        userId: 'user-1',
        schedule: 'daily',
      })

      const req = makeRequest()
      const session = makeSession()
      const res = await handler(req, session)

      expect(res.status).toBe(200)

      const json = await res.json()

      expect(json).toEqual({ id: triggerIntegrationId })
    })

    it('returns correct integration id when different id is used', async () => {
      prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'different-trigger-id',
        userId: 'user-1',
        schedule: 'weekly',
      })

      const req = makeRequest({ integrationId: 'different-trigger-id' })
      const session = makeSession()
      const res = await handler(req, session)

      expect(res.status).toBe(200)

      const json = await res.json()

      expect(json).toEqual({ id: 'different-trigger-id' })
    })
  })
})
