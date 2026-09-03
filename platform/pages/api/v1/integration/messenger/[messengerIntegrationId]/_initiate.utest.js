/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './initiate'
import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    messengerIntegration: {
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

describe('POST /api/v1/integration/messenger/{messengerIntegrationId}/initiate', () => {
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
      pageId: 'page-123',
      recipientId: 'recipient-123',
      text: 'Write a friendly hello',
    })

    expect(error).toBeUndefined()
  })

  it('should reject invalid initiate body', () => {
    const invalidBodies = [
      { pageId: '   ', recipientId: 'recipient-123', text: 'hello' },
      { pageId: 'page-123', recipientId: '   ', text: 'hello' },
      { pageId: 'page-123', recipientId: 'recipient-123', text: '   ' },
    ]

    for (const body of invalidBodies) {
      const { error } = bodySchema.validate(body)

      expect(error).toBeDefined()
    }
  })

  it('should enqueue known-recipient initiation', async () => {
    const stream = makeStream()

    prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'messenger-1',
      botId: 'bot-1',
      accessToken: 'access-token',
      userId: 'user-1',
    })

    await handler(
      { query: { messengerIntegrationId: 'messenger-1' } },
      stream,
      session,
      {
        pageId: 'page-123',
        recipientId: 'recipient-123',
        text: 'Write a friendly hello',
      }
    )

    expect(
      prisma.messengerIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'messenger-1')
    expect(sendEvent).toHaveBeenCalledWith('messenger-1', {
      type: INITIATE_EVENT_TYPE,
      payload: {
        pageId: 'page-123',
        recipientId: 'recipient-123',
        text: 'Write a friendly hello',
      },
    })
    expect(stream.result).toHaveBeenCalledWith({ id: 'messenger-1' })
  })

  it('should return not found when integration is missing', async () => {
    prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      { query: { messengerIntegrationId: 'missing' } },
      makeStream(),
      session,
      {
        pageId: 'page-123',
        recipientId: 'recipient-123',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 404 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return not authorized when user does not own integration', async () => {
    prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'messenger-1',
      userId: 'other-user',
    })

    const result = await handler(
      { query: { messengerIntegrationId: 'messenger-1' } },
      makeStream(),
      session,
      {
        pageId: 'page-123',
        recipientId: 'recipient-123',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 403 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when bot is not configured', async () => {
    prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'messenger-1',
      botId: null,
      accessToken: 'access-token',
      userId: 'user-1',
    })

    await expect(
      handler(
        { query: { messengerIntegrationId: 'messenger-1' } },
        makeStream(),
        session,
        {
          pageId: 'page-123',
          recipientId: 'recipient-123',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow('Messenger integration does not have a bot configured')
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when access token is not configured', async () => {
    prisma.messengerIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'messenger-1',
      botId: 'bot-1',
      accessToken: null,
      userId: 'user-1',
    })

    await expect(
      handler(
        { query: { messengerIntegrationId: 'messenger-1' } },
        makeStream(),
        session,
        {
          pageId: 'page-123',
          recipientId: 'recipient-123',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow('Messenger integration does not have an access token')
    expect(sendEvent).not.toHaveBeenCalled()
  })
})
