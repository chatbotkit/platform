/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { fetch } from '@/lib/fetch'
import { getRecallMeetingSession } from '@/lib/recall.session'

import resumeHandler from './resume'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    recallIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/fetch', () => ({
  fetch: jest.fn(),
}))

jest.mock('@/lib/recall.session', () => ({
  getRecallMeetingSession: jest.fn(),
}))

function makeRequest(path) {
  return new Request(`https://chatbotkit.test${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
}

describe('POST recall session recording resume', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('resumes recording for a valid recall session', async () => {
    getRecallMeetingSession.mockResolvedValue({
      id: 'session-1',
      recallIntegrationId: 'recall-1',
      userId: 'user-1',
      recallBotId: 'bot-1',
    })
    prisma.recallIntegration.findUnique.mockResolvedValue({
      id: 'recall-1',
      userId: 'user-1',
      apiKey: 'recall-api-key',
      region: 'us-east-1',
    })
    fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })))

    const response = await resumeHandler(
      makeRequest(
        '/api/v1/integration/recall/recall-1/session/session-1/recording/resume?recallIntegrationId=recall-1&sessionId=session-1'
      )
    )

    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://us-east-1.recall.ai/api/v1/bot/bot-1/resume_recording/',
      {
        method: 'POST',
        headers: {
          Authorization: 'recall-api-key',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({}),
      }
    )
  })

  it('rejects a session that does not belong to the integration', async () => {
    getRecallMeetingSession.mockResolvedValue({
      id: 'session-1',
      recallIntegrationId: 'other-recall',
      userId: 'user-1',
      recallBotId: 'bot-1',
    })

    const response = await resumeHandler(
      makeRequest(
        '/api/v1/integration/recall/recall-1/session/session-1/recording/resume?recallIntegrationId=recall-1&sessionId=session-1'
      )
    )

    expect(response.status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })
})
