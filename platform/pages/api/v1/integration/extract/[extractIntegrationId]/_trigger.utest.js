import prisma from '@/prisma/client'

import handler from './trigger'
import { IDLE_EVENT_TYPE, sendEvent } from './queue'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    extractIntegration: {
      findUnique: jest.fn(),
    },
    conversation: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('./queue', () => ({
  IDLE_EVENT_TYPE: 'idle',
  sendEvent: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('joi'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  notFound: jest.fn(() => ({ status: 404 })),
  notAuthorized: jest.fn(() => ({ status: 403 })),
  ok: jest.fn((data) => ({ status: 200, data })),
}))

const USER_ID = 'user-001'
const OTHER_USER_ID = 'user-002'
const INTEGRATION_ID = 'ext-001'

const mockSession = { user: { id: USER_ID } }

function makeReq(overrides = {}) {
  return {
    query: { extractIntegrationId: INTEGRATION_ID },
    ...overrides,
  }
}

describe('POST /api/v1/integration/extract/[extractIntegrationId]/trigger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sendEvent.mockResolvedValue(undefined)
  })

  describe('authorization', () => {
    it('should return 404 when the integration is not found', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(null)

      const result = await handler(makeReq(), mockSession, {})

      expect(result.status).toBe(404)
    })

    it('should return 403 when the integration belongs to a different user', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue({
        id: INTEGRATION_ID,
        userId: OTHER_USER_ID,
        botId: null,
      })

      const result = await handler(makeReq(), mockSession, {})

      expect(result.status).toBe(403)
    })

    it('should proceed when the integration belongs to the session user', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue({
        id: INTEGRATION_ID,
        userId: USER_ID,
        botId: null,
      })
      prisma.conversation.findMany.mockResolvedValue([])

      const result = await handler(makeReq(), mockSession, {})

      expect(result.status).toBe(200)
    })
  })

  describe('sample mode (no conversationIds provided)', () => {
    const integration = { id: INTEGRATION_ID, userId: USER_ID, botId: null }

    it('should use a default sample of 20 when no sample is provided', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(integration)
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(makeReq(), mockSession, {})

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          orderBy: { createdAt: 'desc' },
        })
      )
    })

    it('should respect a custom sample value', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(integration)
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(makeReq(), mockSession, { sample: 50 })

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      )
    })

    it('should filter by userId', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(integration)
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(makeReq(), mockSession, {})

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_ID }),
        })
      )
    })

    it('should not add a botId filter when the integration has no botId', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue({ ...integration, botId: null })
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(makeReq(), mockSession, {})

      const query = prisma.conversation.findMany.mock.calls[0][0]

      expect(query.where).not.toHaveProperty('botId')
    })

    it('should add a botId filter when the integration has a botId', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue({
        ...integration,
        botId: 'bot-999',
      })
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(makeReq(), mockSession, {})

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ botId: 'bot-999' }),
        })
      )
    })
  })

  describe('specific conversationIds mode', () => {
    const integration = { id: INTEGRATION_ID, userId: USER_ID, botId: null }

    it('should query by the provided conversation IDs', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(integration)
      prisma.conversation.findMany.mockResolvedValue([{ id: 'conv-1' }, { id: 'conv-2' }])

      await handler(makeReq(), mockSession, { conversationIds: ['conv-1', 'conv-2'] })

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['conv-1', 'conv-2'] },
          }),
        })
      )
    })

    it('should not apply orderBy or take when conversation IDs are provided', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(integration)
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(makeReq(), mockSession, { conversationIds: ['conv-1'] })

      const query = prisma.conversation.findMany.mock.calls[0][0]

      expect(query).not.toHaveProperty('orderBy')
      expect(query).not.toHaveProperty('take')
    })

    it('should add botId filter in IDs mode when the integration has a botId', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue({
        ...integration,
        botId: 'bot-999',
      })
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(makeReq(), mockSession, { conversationIds: ['conv-1'] })

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ botId: 'bot-999' }),
        })
      )
    })
  })

  describe('event queuing', () => {
    const integration = { id: INTEGRATION_ID, userId: USER_ID, botId: null }

    it('should queue an IDLE event for each returned conversation', async () => {
      const conversations = [{ id: 'conv-1' }, { id: 'conv-2' }, { id: 'conv-3' }]

      prisma.extractIntegration.findUnique.mockResolvedValue(integration)
      prisma.conversation.findMany.mockResolvedValue(conversations)

      await handler(makeReq(), mockSession, {})

      expect(sendEvent).toHaveBeenCalledTimes(3)
      expect(sendEvent).toHaveBeenCalledWith(INTEGRATION_ID, {
        type: IDLE_EVENT_TYPE,
        payload: { conversationId: 'conv-1' },
      })
      expect(sendEvent).toHaveBeenCalledWith(INTEGRATION_ID, {
        type: IDLE_EVENT_TYPE,
        payload: { conversationId: 'conv-2' },
      })
    })

    it('should not call sendEvent when no conversations are found', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(integration)
      prisma.conversation.findMany.mockResolvedValue([])

      await handler(makeReq(), mockSession, {})

      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('response', () => {
    const integration = { id: INTEGRATION_ID, userId: USER_ID, botId: null }

    it('should return the integration id and triggered count', async () => {
      const conversations = [{ id: 'conv-1' }, { id: 'conv-2' }]

      prisma.extractIntegration.findUnique.mockResolvedValue(integration)
      prisma.conversation.findMany.mockResolvedValue(conversations)

      const result = await handler(makeReq(), mockSession, {})

      expect(result.status).toBe(200)
      expect(result.data).toEqual({ id: INTEGRATION_ID, triggered: 2 })
    })

    it('should return triggered: 0 when no conversations match', async () => {
      prisma.extractIntegration.findUnique.mockResolvedValue(integration)
      prisma.conversation.findMany.mockResolvedValue([])

      const result = await handler(makeReq(), mockSession, {})

      expect(result.data).toEqual({ id: INTEGRATION_ID, triggered: 0 })
    })
  })
})
