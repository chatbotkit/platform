/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './initiate'
import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    whatsappIntegration: {
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

describe('POST /api/v1/integration/whatsapp/{whatsappIntegrationId}/initiate', () => {
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
    const { error, value } = bodySchema.validate({
      to: '+1 (415) 523-8886',
      text: 'Hello WhatsApp',
    })

    expect(error).toBeUndefined()
    expect(value.to).toBe('14155238886')
  })

  it('should reject invalid initiate body fields', () => {
    const invalidBodies = [
      {
        to: '123',
        text: 'Hello WhatsApp',
      },
      {
        to: '14155238886',
        text: '   ',
      },
    ]

    for (const body of invalidBodies) {
      const { error } = bodySchema.validate(body)

      expect(error).toBeDefined()
    }
  })

  it('should enqueue phone-number-based initiation', async () => {
    const stream = makeStream()

    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'whatsapp-1',
      botId: 'bot-1',
      accessToken: 'access-token',
      phoneNumberId: 'phone-number-id',
      userId: 'user-1',
    })

    await handler(
      {
        query: {
          whatsappIntegrationId: 'whatsapp-1',
        },
      },
      stream,
      session,
      {
        to: '14155238886',
        text: 'Hello WhatsApp',
      }
    )

    expect(
      prisma.whatsappIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'whatsapp-1')
    expect(sendEvent).toHaveBeenCalledWith('whatsapp-1', {
      type: INITIATE_EVENT_TYPE,
      payload: {
        id: expect.any(String),
        to: '14155238886',
        text: 'Hello WhatsApp',
      },
    })
    expect(stream.result).toHaveBeenCalledWith({ id: 'whatsapp-1' })
  })

  it('uses a caller-supplied idempotency key as the delivery id', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'whatsapp-1',
      botId: 'bot-1',
      accessToken: 'access-token',
      phoneNumberId: 'phone-number-id',
      userId: 'user-1',
    })

    await handler(
      { query: { whatsappIntegrationId: 'whatsapp-1' } },
      makeStream(),
      session,
      {
        to: '14155238886',
        text: 'Hello WhatsApp',
        idempotencyKey: 'order-123-reminder',
      }
    )

    expect(sendEvent).toHaveBeenCalledWith(
      'whatsapp-1',
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'order-123-reminder' }),
      })
    )
  })

  it('should return not found when integration is missing', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      {
        query: {
          whatsappIntegrationId: 'missing',
        },
      },
      makeStream(),
      session,
      {
        to: '14155238886',
        text: 'Hello WhatsApp',
      }
    )

    expect(result).toEqual({ status: 404 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return not authorized when user does not own integration', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'whatsapp-1',
      userId: 'other-user',
    })

    const result = await handler(
      {
        query: {
          whatsappIntegrationId: 'whatsapp-1',
        },
      },
      makeStream(),
      session,
      {
        to: '14155238886',
        text: 'Hello WhatsApp',
      }
    )

    expect(result).toEqual({ status: 403 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when bot is not configured', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'whatsapp-1',
      botId: null,
      accessToken: 'access-token',
      phoneNumberId: 'phone-number-id',
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            whatsappIntegrationId: 'whatsapp-1',
          },
        },
        makeStream(),
        session,
        {
          to: '14155238886',
          text: 'Hello WhatsApp',
        }
      )
    ).rejects.toThrow('WhatsApp integration does not have a bot configured')
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when access token is not configured', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'whatsapp-1',
      botId: 'bot-1',
      accessToken: null,
      phoneNumberId: 'phone-number-id',
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            whatsappIntegrationId: 'whatsapp-1',
          },
        },
        makeStream(),
        session,
        {
          to: '14155238886',
          text: 'Hello WhatsApp',
        }
      )
    ).rejects.toThrow('WhatsApp integration does not have an access token')
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when phone number ID is not configured', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'whatsapp-1',
      botId: 'bot-1',
      accessToken: 'access-token',
      phoneNumberId: null,
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            whatsappIntegrationId: 'whatsapp-1',
          },
        },
        makeStream(),
        session,
        {
          to: '14155238886',
          text: 'Hello WhatsApp',
        }
      )
    ).rejects.toThrow(
      'WhatsApp integration does not have a phone number ID configured'
    )
    expect(sendEvent).not.toHaveBeenCalled()
  })
})
