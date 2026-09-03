/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './initiate'
import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

jest.mock('@/prisma/client', () => ({
  googlechatIntegration: {
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

describe('POST /api/v1/integration/googlechat/{googlechatIntegrationId}/initiate', () => {
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
      space: 'spaces/AAAA',
      text: 'Write a friendly hello',
    })

    expect(error).toBeUndefined()
  })

  it('should accept a user notation in the space field', () => {
    const { error } = bodySchema.validate({
      space: 'person@example.com',
      text: 'Write a friendly hello',
    })

    expect(error).toBeUndefined()
  })

  it('should reject invalid initiate body', () => {
    const invalidBodies = [
      {
        space: '   ',
        text: 'Write a friendly hello',
      },
      {
        space: 'spaces/AAAA',
        thread: 'spaces/AAAA/threads/BBBB',
        text: 'Write a friendly hello',
      },
      {
        text: 'Write a friendly hello',
      },
      {
        space: 'spaces/AAAA',
        text: '   ',
      },
    ]

    for (const body of invalidBodies) {
      const { error } = bodySchema.validate(body)

      expect(error).toBeDefined()
    }
  })

  it('should enqueue space-based initiation', async () => {
    const stream = makeStream()

    prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'googlechat-1',
      botId: 'bot-1',
      serviceAccountKey: '{"type":"service_account"}',
      userId: 'user-1',
    })

    await handler(
      {
        query: {
          googlechatIntegrationId: 'googlechat-1',
        },
      },
      stream,
      session,
      {
        space: 'spaces/AAAA',
        text: 'Write a friendly hello',
      }
    )

    expect(
      prisma.googlechatIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'googlechat-1')
    expect(sendEvent).toHaveBeenCalledWith('googlechat-1', {
      type: INITIATE_EVENT_TYPE,
      payload: {
        space: 'spaces/AAAA',
        text: 'Write a friendly hello',
      },
    })
    expect(stream.result).toHaveBeenCalledWith({ id: 'googlechat-1' })
  })

  it('should enqueue user notation in the space field', async () => {
    const stream = makeStream()

    prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'googlechat-1',
      botId: 'bot-1',
      serviceAccountKey: '{"type":"service_account"}',
      userId: 'user-1',
    })

    await handler(
      {
        query: {
          googlechatIntegrationId: 'googlechat-1',
        },
      },
      stream,
      session,
      {
        space: 'person@example.com',
        text: 'Write a friendly hello',
      }
    )

    expect(sendEvent).toHaveBeenCalledWith('googlechat-1', {
      type: INITIATE_EVENT_TYPE,
      payload: {
        space: 'person@example.com',
        text: 'Write a friendly hello',
      },
    })
    expect(stream.result).toHaveBeenCalledWith({ id: 'googlechat-1' })
  })

  it('should return not found when integration is missing', async () => {
    prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      {
        query: {
          googlechatIntegrationId: 'missing',
        },
      },
      makeStream(),
      session,
      {
        space: 'spaces/AAAA',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 404 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return not authorized when user does not own integration', async () => {
    prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'googlechat-1',
      userId: 'other-user',
    })

    const result = await handler(
      {
        query: {
          googlechatIntegrationId: 'googlechat-1',
        },
      },
      makeStream(),
      session,
      {
        space: 'spaces/AAAA',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 403 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when bot is not configured', async () => {
    prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'googlechat-1',
      botId: null,
      serviceAccountKey: '{"type":"service_account"}',
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            googlechatIntegrationId: 'googlechat-1',
          },
        },
        makeStream(),
        session,
        {
          space: 'spaces/AAAA',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow('Google Chat integration does not have a bot configured')
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when service account key is not configured', async () => {
    prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'googlechat-1',
      botId: 'bot-1',
      serviceAccountKey: null,
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            googlechatIntegrationId: 'googlechat-1',
          },
        },
        makeStream(),
        session,
        {
          space: 'spaces/AAAA',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow(
      'Google Chat integration does not have a service account key'
    )
    expect(sendEvent).not.toHaveBeenCalled()
  })
})
