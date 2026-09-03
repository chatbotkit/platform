/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './initiate'
import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    emailIntegration: {
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

describe('POST /api/v1/integration/email/{emailIntegrationId}/initiate', () => {
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
      email: 'recipient@example.com',
      subject: 'Hello',
      text: 'Write a friendly hello',
    })

    expect(error).toBeUndefined()
  })

  it('should reject invalid initiate body fields', () => {
    const invalidBodies = [
      {
        email: 'not-an-email',
        subject: 'Hello',
        text: 'Write a friendly hello',
      },
      {
        email: 'recipient@example.com',
        subject: '   ',
        text: 'Write a friendly hello',
      },
      {
        email: 'recipient@example.com',
        subject: 'Hello',
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

    prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'email-1',
      botId: 'bot-1',
      userId: 'user-1',
    })

    await handler(
      {
        query: {
          emailIntegrationId: 'email-1',
        },
      },
      stream,
      session,
      {
        email: 'recipient@example.com',
        subject: 'Hello',
        text: 'Write a friendly hello',
      }
    )

    expect(prisma.emailIntegration.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'email-1'
    )
    expect(sendEvent).toHaveBeenCalledWith('email-1', {
      type: INITIATE_EVENT_TYPE,
      payload: {
        email: 'recipient@example.com',
        subject: 'Hello',
        text: 'Write a friendly hello',
      },
    })
    expect(stream.result).toHaveBeenCalledWith({ id: 'email-1' })
  })

  it('should return not found when integration is missing', async () => {
    prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      {
        query: {
          emailIntegrationId: 'missing',
        },
      },
      makeStream(),
      session,
      {
        email: 'recipient@example.com',
        subject: 'Hello',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 404 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return not authorized when user does not own integration', async () => {
    prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'email-1',
      userId: 'other-user',
    })

    const result = await handler(
      {
        query: {
          emailIntegrationId: 'email-1',
        },
      },
      makeStream(),
      session,
      {
        email: 'recipient@example.com',
        subject: 'Hello',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 403 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when bot is not configured', async () => {
    prisma.emailIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'email-1',
      botId: null,
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            emailIntegrationId: 'email-1',
          },
        },
        makeStream(),
        session,
        {
          email: 'recipient@example.com',
          subject: 'Hello',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow('Email integration does not have a bot configured')
    expect(sendEvent).not.toHaveBeenCalled()
  })
})
