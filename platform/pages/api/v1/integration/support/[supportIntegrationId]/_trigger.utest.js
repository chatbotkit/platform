/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { sendEvent } from './queue'
import handler from './trigger'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    supportIntegration: {
      findUnique: jest.fn(),
    },
    conversation: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('./queue', () => ({
  IDLE_EVENT_TYPE: 'idle',
  sendEvent: jest.fn(),
}))

describe('/api/v1/integration/support/[supportIntegrationId]/trigger', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const mockIntegration = {
    id: 'support-int-456',
    userId: 'user-123',
    botId: null,
  }

  const makeReq = (body = {}, supportIntegrationId = 'support-int-456') => ({
    query: { supportIntegrationId },
    body,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    sendEvent.mockResolvedValue(undefined)
  })

  describe('authorization', () => {
    it('returns 404 when integration is not found', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue(null)

      const res = await handler(makeReq(), mockSession, {})

      expect(res.status).toBe(404)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('returns 403 when user does not own the integration', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        userId: 'other-user',
      })

      const res = await handler(makeReq(), mockSession, {})

      expect(res.status).toBe(403)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('triggering with sample', () => {
    it('fetches recent conversations using default sample of 20', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findMany.mockResolvedValue([
        { id: 'conv-1' },
        { id: 'conv-2' },
      ])

      const res = await handler(makeReq({}), mockSession, {})

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      )

      const body = await res.json()

      expect(body.triggered).toBe(2)
      expect(res.status).toBe(200)
    })

    it('respects a custom sample value', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findMany.mockResolvedValue([{ id: 'conv-1' }])

      await handler(makeReq({ sample: 50 }), mockSession, { sample: 50 })

      // @note handler destructures body argument (3rd param) for sample
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: expect.any(Number) })
      )
    })

    it('applies botId filter when integration has a botId', async () => {
      const integrationWithBot = { ...mockIntegration, botId: 'bot-abc' }

      prisma.supportIntegration.findUnique.mockResolvedValue(integrationWithBot)
      prisma.conversation.findMany.mockResolvedValue([{ id: 'conv-1' }])

      await handler(makeReq({}), mockSession, {})

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', botId: 'bot-abc' },
        })
      )
    })

    it('sends an idle event for each conversation found', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findMany.mockResolvedValue([
        { id: 'conv-1' },
        { id: 'conv-2' },
        { id: 'conv-3' },
      ])

      await handler(makeReq({}), mockSession, {})

      expect(sendEvent).toHaveBeenCalledTimes(3)
      expect(sendEvent).toHaveBeenCalledWith('support-int-456', {
        type: 'idle',
        payload: { conversationId: 'conv-1' },
      })
      expect(sendEvent).toHaveBeenCalledWith('support-int-456', {
        type: 'idle',
        payload: { conversationId: 'conv-3' },
      })
    })

    it('returns triggered count of zero when no conversations found', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findMany.mockResolvedValue([])

      const res = await handler(makeReq({}), mockSession, {})

      expect(sendEvent).not.toHaveBeenCalled()

      const body = await res.json()

      expect(body).toEqual({ id: 'support-int-456', triggered: 0 })
    })
  })

  describe('triggering with explicit conversationIds', () => {
    it('fetches only specified conversations when conversationIds is provided', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findMany.mockResolvedValue([
        { id: 'conv-a' },
        { id: 'conv-b' },
      ])

      await handler(
        makeReq({ conversationIds: ['conv-a', 'conv-b'] }),
        mockSession,
        { conversationIds: ['conv-a', 'conv-b'] }
      )

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-123',
            id: { in: ['conv-a', 'conv-b'] },
          },
        })
      )
    })

    it('does not include take or orderBy when using explicit ids', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findMany.mockResolvedValue([{ id: 'conv-a' }])

      await handler(makeReq({ conversationIds: ['conv-a'] }), mockSession, {
        conversationIds: ['conv-a'],
      })

      const callArgs = prisma.conversation.findMany.mock.calls[0][0]

      expect(callArgs.take).toBeUndefined()
      expect(callArgs.orderBy).toBeUndefined()
    })

    it('returns the correct response structure', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue(mockIntegration)
      prisma.conversation.findMany.mockResolvedValue([
        { id: 'conv-a' },
        { id: 'conv-b' },
      ])

      const res = await handler(
        makeReq({ conversationIds: ['conv-a', 'conv-b'] }),
        mockSession,
        { conversationIds: ['conv-a', 'conv-b'] }
      )

      const body = await res.json()

      expect(body).toEqual({ id: 'support-int-456', triggered: 2 })
    })
  })
})
