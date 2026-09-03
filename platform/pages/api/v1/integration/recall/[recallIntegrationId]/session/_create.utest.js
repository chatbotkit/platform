/**
 * @jest-environment node
 */
import { createConversation } from '@/lib/conversation.create'
import { getRecallMeetingSeed } from '@/lib/recall.bot'
import {
  getRecallMeetingSession,
  updateRecallMeetingSession,
} from '@/lib/recall.session'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      recallIntegration: {
        findUnique: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(),
}))

jest.mock('@/lib/recall.session', () => ({
  getRecallMeetingSession: jest.fn(),
  updateRecallMeetingSession: jest.fn(),
}))

jest.mock('@/lib/recall.bot', () => ({
  getRecallMeetingSeed: jest.fn(),
}))

jest.mock(
  '@/pages/api/v1/conversation/[conversationId]/session/create',
  () => ({
    createConversationSessionToken: jest.fn(),
  })
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

const prisma = jest.requireMock('@/prisma/client').default

describe('POST /api/v1/integration/recall/[recallIntegrationId]/session/create', () => {
  const req = { query: { recallIntegrationId: 'recall-1' } }

  beforeEach(() => {
    jest.clearAllMocks()

    getRecallMeetingSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      recallIntegrationId: 'recall-1',
      recallBotId: 'recall-bot-1',
    })
    prisma.recallIntegration.findUnique.mockResolvedValue({
      id: 'recall-1',
      userId: 'user-1',
      botId: 'bot-1',
      apiKey: 'api-key',
      region: 'us-east-1',
    })
    createConversation.mockResolvedValue({ id: 'conversation-1' })
    createConversationSessionToken.mockResolvedValue('token-1')
    updateRecallMeetingSession.mockResolvedValue({ id: 'session-1' })
    getRecallMeetingSeed.mockResolvedValue({ room: 'meeting-room' })
  })

  it('returns 401 when session is missing or invalid for integration', async () => {
    getRecallMeetingSession.mockResolvedValue(null)

    const response = await handler(req, { sessionId: 'session-1' })

    expect(response.status).toBe(401)
  })

  it('returns 404 when recall integration does not exist', async () => {
    prisma.recallIntegration.findUnique.mockResolvedValue(null)

    const response = await handler(req, { sessionId: 'session-1' })

    expect(response.status).toBe(404)
  })

  it('returns 409 when recall integration has no api key', async () => {
    prisma.recallIntegration.findUnique.mockResolvedValue({
      id: 'recall-1',
      userId: 'user-1',
      botId: 'bot-1',
      apiKey: '',
      region: 'us-east-1',
    })

    const response = await handler(req, { sessionId: 'session-1' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      message: 'Recall integration requires an API key',
      code: 'CONFLICT',
    })
  })

  it('returns 409 when recall integration has no bot', async () => {
    prisma.recallIntegration.findUnique.mockResolvedValue({
      id: 'recall-1',
      userId: 'user-1',
      botId: null,
      apiKey: 'api-key',
      region: 'us-east-1',
    })

    const response = await handler(req, { sessionId: 'session-1' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      message: 'Recall integration requires a bot',
      code: 'CONFLICT',
    })
  })

  it('returns 401 when session user does not match integration owner', async () => {
    getRecallMeetingSession.mockResolvedValue({
      id: 'session-1',
      userId: 'other-user',
      recallIntegrationId: 'recall-1',
      recallBotId: 'recall-bot-1',
    })

    const response = await handler(req, { sessionId: 'session-1' })

    expect(response.status).toBe(401)
  })

  it('creates conversation session and returns meeting details', async () => {
    const response = await handler(req, { sessionId: 'session-1' })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(createConversation).toHaveBeenCalledWith('user-1', {
      botId: 'bot-1',
      meta: { app: 'recall', recall: { integrationId: 'recall-1' } },
    })
    expect(updateRecallMeetingSession).toHaveBeenCalledWith('session-1', {
      conversationId: 'conversation-1',
    })
    expect(createConversationSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conversation-1',
        userId: 'user-1',
      })
    )
    expect(getRecallMeetingSeed).toHaveBeenCalledWith({
      apiKey: 'api-key',
      region: 'us-east-1',
      recallBotId: 'recall-bot-1',
    })
    expect(body.id).toBe('recall-1')
    expect(body.conversationId).toBe('conversation-1')
    expect(body.token).toBe('token-1')
    expect(body.meeting).toEqual({ room: 'meeting-room' })
    expect(typeof body.expiresAt).toBe('number')
  })
})
