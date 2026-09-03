/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './initiate'
import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    slackIntegration: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  throwBadRequest: jest.fn((message) => { throw new Error(message) }),
  throwNotAuthorized: jest.fn(() => ({ status: 403 })),
  throwNotFound: jest.fn(() => ({ status: 404 })),
}))

jest.mock('./queue', () => ({
  INITIATE_EVENT_TYPE: 'initiate',
  sendEvent: jest.fn(),
}))

describe('POST /api/v1/integration/slack/{slackIntegrationId}/initiate', () => {
  const session = {
    user: {
      id: 'user-1',
    },
  }

  const makeStream = () => ({
    result: jest.fn(),
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should accept initiate body fields', () => {
    const { error } = bodySchema.validate({
      channel: '#general',
      text: 'Write a friendly hello',
    })

    expect(error).toBeUndefined()
  })

  it('should reject invalid initiate body fields', () => {
    const invalidBodies = [
      {
        channel: '   ',
        text: 'Write a friendly hello',
      },
      {
        channel: '#general',
        text: '   ',
      },
    ]

    for (const body of invalidBodies) {
      const { error } = bodySchema.validate(body)

      expect(error).toBeDefined()
    }
  })

  it('should enqueue instruction-based initiation', async () => {
    const stream = makeStream()

    prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'slack-1',
      botId: 'bot-1',
      botToken: 'xoxb-token',
      userId: 'user-1',
    })

    await handler(
      {
        query: {
          slackIntegrationId: 'slack-1',
        },
      },
      stream,
      session,
      {
        channel: '#general',
        text: 'Write a friendly hello',
      }
    )

    expect(prisma.slackIntegration.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'slack-1'
    )
    expect(sendEvent).toHaveBeenCalledWith('slack-1', {
      type: INITIATE_EVENT_TYPE,
      payload: {
        channelId: '#general',
        text: 'Write a friendly hello',
      },
    })
    expect(stream.result).toHaveBeenCalledWith({ id: 'slack-1' })
  })

  it('should return not found when integration is missing', async () => {
    prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      {
        query: {
          slackIntegrationId: 'missing',
        },
      },
      makeStream(),
      session,
      {
        channel: '#general',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 404 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return not authorized when user does not own integration', async () => {
    prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'slack-1',
      userId: 'other-user',
    })

    const result = await handler(
      {
        query: {
          slackIntegrationId: 'slack-1',
        },
      },
      makeStream(),
      session,
      {
        channel: '#general',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 403 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when bot is not configured', async () => {
    prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'slack-1',
      botId: null,
      botToken: 'xoxb-token',
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            slackIntegrationId: 'slack-1',
          },
        },
        makeStream(),
        session,
        {
          channel: '#general',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow('Slack integration does not have a bot configured')
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when bot token is not configured', async () => {
    prisma.slackIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'slack-1',
      botId: 'bot-1',
      botToken: null,
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            slackIntegrationId: 'slack-1',
          },
        },
        makeStream(),
        session,
        {
          channel: '#general',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow('Slack integration does not have a bot token')
    expect(sendEvent).not.toHaveBeenCalled()
  })
})
