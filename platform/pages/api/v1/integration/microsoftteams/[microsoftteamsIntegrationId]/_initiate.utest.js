/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './initiate'
import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

jest.mock('@/prisma/client', () => ({
  microsoftteamsIntegration: {
    findUniqueByIdentifier: jest.fn(),
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
  throwBadRequest: jest.fn((message) => {
    throw new Error(message)
  }),
  throwNotAuthorized: jest.fn(() => ({ status: 403 })),
  throwNotFound: jest.fn(() => ({ status: 404 })),
}))

jest.mock('./queue', () => ({
  INITIATE_EVENT_TYPE: 'initiate',
  sendEvent: jest.fn(),
}))

describe('POST /api/v1/integration/microsoftteams/{microsoftteamsIntegrationId}/initiate', () => {
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

  it('should accept valid initiate body', () => {
    const { error } = bodySchema.validate({
      conversationId: '19:abc123@thread.tacv2',
      text: 'Write a friendly hello',
    })

    expect(error).toBeUndefined()
  })

  it('should reject invalid initiate body', () => {
    const invalidBodies = [
      {
        conversationId: '   ',
        text: 'Write a friendly hello',
      },
      {
        conversationId: '19:abc123@thread.tacv2',
        text: '   ',
      },
      {
        text: 'Write a friendly hello',
      },
    ]

    for (const body of invalidBodies) {
      const { error } = bodySchema.validate(body)

      expect(error).toBeDefined()
    }
  })

  it('should enqueue conversation-based initiation', async () => {
    const stream = makeStream()

    prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'teams-1',
      botId: 'bot-1',
      botFrameworkAppId: 'app-id',
      botFrameworkAppSecret: 'app-secret',
      userId: 'user-1',
    })

    await handler(
      {
        query: {
          microsoftteamsIntegrationId: 'teams-1',
        },
      },
      stream,
      session,
      {
        conversationId: '19:abc123@thread.tacv2',
        text: 'Write a friendly hello',
      }
    )

    expect(
      prisma.microsoftteamsIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'teams-1')
    expect(sendEvent).toHaveBeenCalledWith('teams-1', {
      type: INITIATE_EVENT_TYPE,
      payload: {
        conversationId: '19:abc123@thread.tacv2',
        text: 'Write a friendly hello',
      },
    })
    expect(stream.result).toHaveBeenCalledWith({ id: 'teams-1' })
  })

  it('should return not found when integration is missing', async () => {
    prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue(
      null
    )

    const result = await handler(
      {
        query: {
          microsoftteamsIntegrationId: 'missing',
        },
      },
      makeStream(),
      session,
      {
        conversationId: '19:abc123@thread.tacv2',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 404 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return not authorized when user does not own integration', async () => {
    prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'teams-1',
      userId: 'other-user',
    })

    const result = await handler(
      {
        query: {
          microsoftteamsIntegrationId: 'teams-1',
        },
      },
      makeStream(),
      session,
      {
        conversationId: '19:abc123@thread.tacv2',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 403 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when bot is not configured', async () => {
    prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'teams-1',
      botId: null,
      botFrameworkAppId: 'app-id',
      botFrameworkAppSecret: 'app-secret',
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            microsoftteamsIntegrationId: 'teams-1',
          },
        },
        makeStream(),
        session,
        {
          conversationId: '19:abc123@thread.tacv2',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow(
      'Microsoft Teams integration does not have a bot configured'
    )
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when Bot Framework app ID is not configured', async () => {
    prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'teams-1',
      botId: 'bot-1',
      botFrameworkAppId: null,
      botFrameworkAppSecret: 'app-secret',
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            microsoftteamsIntegrationId: 'teams-1',
          },
        },
        makeStream(),
        session,
        {
          conversationId: '19:abc123@thread.tacv2',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow(
      'Microsoft Teams integration does not have a Bot Framework app ID'
    )
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when Bot Framework app secret is not configured', async () => {
    prisma.microsoftteamsIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'teams-1',
      botId: 'bot-1',
      botFrameworkAppId: 'app-id',
      botFrameworkAppSecret: null,
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            microsoftteamsIntegrationId: 'teams-1',
          },
        },
        makeStream(),
        session,
        {
          conversationId: '19:abc123@thread.tacv2',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow(
      'Microsoft Teams integration does not have a Bot Framework app secret'
    )
    expect(sendEvent).not.toHaveBeenCalled()
  })

})
