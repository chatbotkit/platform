/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './initiate'
import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    twilioIntegration: {
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

describe('POST /api/v1/integration/twilio/{twilioIntegrationId}/initiate', () => {
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

  it('should accept and normalize initiate phone number fields', async () => {
    const value = await bodySchema.validateAsync({
      from: '+1 (651) 395-6925',
      to: '+44 7911 123456',
      text: 'Write a friendly hello',
    })

    expect(value).toEqual({
      channel: 'sms',
      from: '+16513956925',
      to: '+447911123456',
      text: 'Write a friendly hello',
    })
  })

  it('should reject invalid initiate phone number fields', () => {
    const { error } = bodySchema.validate({
      from: 'ChatBotKit12',
      to: '+44 7911 123456',
      text: 'Write a friendly hello',
    })

    expect(error).toBeDefined()
  })

  it('should reject empty initiate text', () => {
    const { error } = bodySchema.validate({
      from: '+1 (651) 395-6925',
      to: '+44 7911 123456',
      text: '   ',
    })

    expect(error).toBeDefined()
  })

  it('should accept alphanumeric initiate sender fields', async () => {
    const value = await bodySchema.validateAsync({
      from: 'ChatBotKit',
      to: '+44 7911 123456',
      text: 'Write a friendly hello',
    })

    expect(value).toEqual({
      channel: 'sms',
      from: 'ChatBotKit',
      to: '+447911123456',
      text: 'Write a friendly hello',
    })
  })

  it('should accept and normalize initiate channel address fields', async () => {
    const value = await bodySchema.validateAsync({
      from: 'whatsapp:+1 (651) 395-6925',
      to: 'whatsapp:+44 7911 123456',
      text: 'Write a friendly hello',
    })

    expect(value).toEqual({
      channel: 'sms',
      from: 'whatsapp:+16513956925',
      to: 'whatsapp:+447911123456',
      text: 'Write a friendly hello',
    })
  })

  it('should reject alphanumeric initiate recipient fields', () => {
    const { error } = bodySchema.validate({
      from: '+1 (651) 395-6925',
      to: 'ChatBotKit',
      text: 'Write a friendly hello',
    })

    expect(error).toBeDefined()
  })

  it('should enqueue instruction-based SMS initiation', async () => {
    const stream = makeStream()

    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'twilio-1',
      accountSid: 'AC123',
      authToken: 'auth-token',
      botId: 'bot-1',
      userId: 'user-1',
    })

    await handler(
      {
        query: {
          twilioIntegrationId: 'twilio-1',
        },
      },
      stream,
      session,
      {
        from: '+10987654321',
        to: '+1234567890',
        text: 'Write a friendly hello',
      }
    )

    expect(
      prisma.twilioIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'twilio-1')
    expect(sendEvent).toHaveBeenCalledWith('twilio-1', {
      type: INITIATE_EVENT_TYPE,
      payload: {
        channel: 'sms',
        from: '+10987654321',
        to: '+1234567890',
        text: 'Write a friendly hello',
      },
    })
    expect(stream.result).toHaveBeenCalledWith({ id: 'twilio-1' })
  })

  it('should enqueue instruction-based call initiation', async () => {
    const stream = makeStream()

    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'twilio-1',
      accountSid: 'AC123',
      authToken: 'auth-token',
      botId: 'bot-1',
      userId: 'user-1',
    })

    await handler(
      {
        query: {
          twilioIntegrationId: 'twilio-1',
        },
      },
      stream,
      session,
      {
        channel: 'call',
        from: '+10987654321',
        to: '+1234567890',
        text: 'Write a friendly call greeting',
      }
    )

    expect(sendEvent).toHaveBeenCalledWith('twilio-1', {
      type: INITIATE_EVENT_TYPE,
      payload: {
        channel: 'call',
        from: '+10987654321',
        to: '+1234567890',
        text: 'Write a friendly call greeting',
      },
    })
    expect(stream.result).toHaveBeenCalledWith({ id: 'twilio-1' })
  })

  it('should return not found when integration is missing', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      {
        query: {
          twilioIntegrationId: 'missing',
        },
      },
      makeStream(),
      session,
      {
        from: '+10987654321',
        to: '+1234567890',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 404 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return not authorized when user does not own integration', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'twilio-1',
      userId: 'other-user',
    })

    const result = await handler(
      {
        query: {
          twilioIntegrationId: 'twilio-1',
        },
      },
      makeStream(),
      session,
      {
        from: '+10987654321',
        to: '+1234567890',
        text: 'Write a friendly hello',
      }
    )

    expect(result).toEqual({ status: 403 })
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when bot is not configured', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'twilio-1',
      accountSid: 'AC123',
      authToken: 'auth-token',
      botId: null,
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            twilioIntegrationId: 'twilio-1',
          },
        },
        makeStream(),
        session,
        {
          from: '+10987654321',
          to: '+1234567890',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow('Twilio integration does not have a bot configured')
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('should return bad request when delivery credentials are not configured', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'twilio-1',
      accountSid: null,
      authToken: 'auth-token',
      botId: 'bot-1',
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            twilioIntegrationId: 'twilio-1',
          },
        },
        makeStream(),
        session,
        {
          from: '+10987654321',
          to: '+1234567890',
          text: 'Write a friendly hello',
        }
      )
    ).rejects.toThrow(
      'Twilio integration does not have delivery credentials configured'
    )
    expect(sendEvent).not.toHaveBeenCalled()
  })
})
