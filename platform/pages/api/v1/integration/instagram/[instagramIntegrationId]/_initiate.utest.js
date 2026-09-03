/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './initiate'
import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    instagramIntegration: {
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

describe('POST /api/v1/integration/instagram/{instagramIntegrationId}/initiate', () => {
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
      instagramUserId: 'ig-user-123',
      recipientId: 'recipient-123',
      text: 'Write a friendly hello',
    })

    expect(error).toBeUndefined()
  })

  it('should reject invalid initiate body', () => {
    const invalidBodies = [
      { instagramUserId: '   ', recipientId: 'recipient-123', text: 'hello' },
      { instagramUserId: 'ig-user-123', recipientId: '   ', text: 'hello' },
      { instagramUserId: 'ig-user-123', recipientId: 'recipient-123', text: '   ' },
    ]

    for (const body of invalidBodies) {
      const { error } = bodySchema.validate(body)

      expect(error).toBeDefined()
    }
  })

  it('should enqueue known-recipient initiation', async () => {
    const stream = makeStream()

    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'instagram-1',
      botId: 'bot-1',
      accessToken: 'access-token',
      userId: 'user-1',
    })

    await handler(
      { query: { instagramIntegrationId: 'instagram-1' } },
      stream,
      session,
      {
        instagramUserId: 'ig-user-123',
        recipientId: 'recipient-123',
        text: 'Write a friendly hello',
      }
    )

    expect(
      prisma.instagramIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'instagram-1')
    expect(sendEvent).toHaveBeenCalledWith('instagram-1', {
      type: INITIATE_EVENT_TYPE,
      payload: {
        instagramUserId: 'ig-user-123',
        recipientId: 'recipient-123',
        text: 'Write a friendly hello',
      },
    })
    expect(stream.result).toHaveBeenCalledWith({ id: 'instagram-1' })
  })

  it('should return not found when integration is missing', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      { query: { instagramIntegrationId: 'missing' } },
      makeStream(),
      session,
      {
        instagramUserId: 'ig-user-123',
        recipientId: 'recipient-123',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 404 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return not authorized when user does not own integration', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'instagram-1',
      userId: 'other-user',
    })

    const result = await handler(
      { query: { instagramIntegrationId: 'instagram-1' } },
      makeStream(),
      session,
      {
        instagramUserId: 'ig-user-123',
        recipientId: 'recipient-123',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 403 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when bot is not configured', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'instagram-1',
      botId: null,
      accessToken: 'access-token',
      userId: 'user-1',
    })

    await expect(
      handler(
        { query: { instagramIntegrationId: 'instagram-1' } },
        makeStream(),
        session,
        {
          instagramUserId: 'ig-user-123',
          recipientId: 'recipient-123',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow('Instagram integration does not have a bot configured')
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when access token is not configured', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'instagram-1',
      botId: 'bot-1',
      accessToken: null,
      userId: 'user-1',
    })

    await expect(
      handler(
        { query: { instagramIntegrationId: 'instagram-1' } },
        makeStream(),
        session,
        {
          instagramUserId: 'ig-user-123',
          recipientId: 'recipient-123',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow('Instagram integration does not have an access token')
    expect(sendEvent).not.toHaveBeenCalled()
  })
})
