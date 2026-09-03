/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getRecallMeetingSession } from '@/lib/recall.session'

import {
  getRecallScreenshareSessionContext,
  getRecallSessionControlContext,
} from './recall.screenshare'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    recallIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/recall.session', () => ({
  getRecallMeetingSession: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => {
    const url = new URL(req.url)
    const value = url.searchParams.get(key)

    if (!value) {
      throw new Error(`Missing required param: ${key}`)
    }

    return value
  }),
}))

jest.mock('@/lib/response', () => ({
  notAuthenticated: jest.fn(() => ({ __type: 'notAuthenticated' })),
  notFound: jest.fn(() => ({ __type: 'notFound' })),
  conflict: jest.fn((msg) => ({ __type: 'conflict', msg })),
  throwBadRequest: jest.fn(() => {
    throw new Error('Bad request')
  }),
}))

function makeRequest(params = {}) {
  const base = 'https://chatbotkit.test/api/v1/integration/recall'
  const { recallIntegrationId = 'recall-1', sessionId = 'session-1' } = params
  const url = `${base}/${recallIntegrationId}/session/${sessionId}/screenshare/start?recallIntegrationId=${recallIntegrationId}&sessionId=${sessionId}`

  return new Request(url)
}

const validSession = {
  id: 'session-1',
  userId: 'user-1',
  recallIntegrationId: 'recall-1',
  recallBotId: 'bot-1',
  pageRelayUrl: 'wss://relay.test/1',
  text: 'Hello',
  botName: 'Agent',
}

const validIntegration = {
  id: 'recall-1',
  userId: 'user-1',
  apiKey: 'secret-api-key',
  region: 'us-east-1',
}

describe('getRecallSessionControlContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('happy path', () => {
    it('returns ok:true with integration and session when all checks pass', async () => {
      getRecallMeetingSession.mockResolvedValue(validSession)
      prisma.recallIntegration.findUnique.mockResolvedValue(validIntegration)

      const result = await getRecallSessionControlContext(makeRequest())

      expect(result.ok).toBe(true)
      expect(result.recallIntegration).toEqual(validIntegration)
      expect(result.recallSession).toMatchObject({
        ...validSession,
        recallBotId: 'bot-1',
      })
    })

    it('passes the correct IDs to downstream lookups', async () => {
      getRecallMeetingSession.mockResolvedValue(validSession)
      prisma.recallIntegration.findUnique.mockResolvedValue(validIntegration)

      await getRecallSessionControlContext(makeRequest())

      expect(getRecallMeetingSession).toHaveBeenCalledWith('session-1')
      expect(prisma.recallIntegration.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'recall-1' } })
      )
    })
  })

  describe('session validation', () => {
    it('returns notAuthenticated when session is not found', async () => {
      getRecallMeetingSession.mockResolvedValue(null)

      const result = await getRecallSessionControlContext(makeRequest())

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({ __type: 'notAuthenticated' })
      expect(prisma.recallIntegration.findUnique).not.toHaveBeenCalled()
    })

    it('returns notAuthenticated when session belongs to a different integration', async () => {
      getRecallMeetingSession.mockResolvedValue({
        ...validSession,
        recallIntegrationId: 'recall-OTHER',
      })

      const result = await getRecallSessionControlContext(makeRequest())

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({ __type: 'notAuthenticated' })
      expect(prisma.recallIntegration.findUnique).not.toHaveBeenCalled()
    })

    it('returns conflict when session has no recallBotId', async () => {
      getRecallMeetingSession.mockResolvedValue({
        ...validSession,
        recallBotId: null,
      })
      // Integration should not be fetched - bot check comes first
      prisma.recallIntegration.findUnique.mockResolvedValue(validIntegration)

      const result = await getRecallSessionControlContext(makeRequest())

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({
        __type: 'conflict',
        msg: 'Recall session requires a bot',
      })
      expect(prisma.recallIntegration.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('integration validation', () => {
    it('returns notFound when the integration does not exist in the database', async () => {
      getRecallMeetingSession.mockResolvedValue(validSession)
      prisma.recallIntegration.findUnique.mockResolvedValue(null)

      const result = await getRecallSessionControlContext(makeRequest())

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({ __type: 'notFound' })
    })

    it('returns notAuthenticated when session and integration belong to different users', async () => {
      getRecallMeetingSession.mockResolvedValue({
        ...validSession,
        userId: 'user-1',
      })
      prisma.recallIntegration.findUnique.mockResolvedValue({
        ...validIntegration,
        userId: 'user-2',
      })

      const result = await getRecallSessionControlContext(makeRequest())

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({ __type: 'notAuthenticated' })
    })

    it('returns conflict when the integration has no API key', async () => {
      getRecallMeetingSession.mockResolvedValue(validSession)
      prisma.recallIntegration.findUnique.mockResolvedValue({
        ...validIntegration,
        apiKey: '',
      })

      const result = await getRecallSessionControlContext(makeRequest())

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({
        __type: 'conflict',
        msg: 'Recall integration requires an API key',
      })
    })

    it('returns conflict when the integration API key is null', async () => {
      getRecallMeetingSession.mockResolvedValue(validSession)
      prisma.recallIntegration.findUnique.mockResolvedValue({
        ...validIntegration,
        apiKey: null,
      })

      const result = await getRecallSessionControlContext(makeRequest())

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({
        __type: 'conflict',
        msg: 'Recall integration requires an API key',
      })
    })
  })

  describe('ordering of guards', () => {
    it('checks session existence before fetching integration from DB', async () => {
      getRecallMeetingSession.mockResolvedValue(null)

      await getRecallSessionControlContext(makeRequest())

      expect(prisma.recallIntegration.findUnique).not.toHaveBeenCalled()
    })

    it('checks recallBotId before fetching integration from DB', async () => {
      getRecallMeetingSession.mockResolvedValue({
        ...validSession,
        recallBotId: null,
      })

      await getRecallSessionControlContext(makeRequest())

      expect(prisma.recallIntegration.findUnique).not.toHaveBeenCalled()
    })
  })
})

describe('getRecallScreenshareSessionContext', () => {
  it('is an alias for getRecallSessionControlContext', () => {
    expect(getRecallScreenshareSessionContext).toBe(
      getRecallSessionControlContext
    )
  })
})
