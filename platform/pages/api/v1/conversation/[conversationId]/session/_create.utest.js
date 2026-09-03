/**
 * @jest-environment node
 */
import { ONE_DAY_IN_SECONDS, ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { sign } from '@/lib/jwt'

import handler, {
  createConversationSessionToken,
} from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/jwt', () => ({
  sign: jest.fn().mockResolvedValue('mock.jwt.token'),
}))

jest.mock('@/lib/cuid', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue('generated-cuid'),
}))

describe('createConversationSessionToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call sign with correct conversationId and userId', async () => {
    const token = await createConversationSessionToken({
      conversationId: 'conv-123',
      userId: 'user-456',
      durationInSeconds: ONE_HOUR_IN_SECONDS,
    })

    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-123',
        userId: 'user-456',
      }),
      ONE_HOUR_IN_SECONDS,
      'enduser/conversation'
    )
    expect(token).toBe('mock.jwt.token')
  })

  it('should include a unique sub claim', async () => {
    await createConversationSessionToken({
      conversationId: 'conv-123',
      userId: 'user-456',
      durationInSeconds: 3600,
    })

    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'generated-cuid' }),
      expect.any(Number),
      expect.any(String)
    )
  })

  it('should forward extra payload fields into the signed token', async () => {
    await createConversationSessionToken({
      conversationId: 'conv-123',
      userId: 'user-456',
      durationInSeconds: 3600,
      extra: { role: 'admin' },
    })

    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' }),
      expect.any(Number),
      expect.any(String)
    )
  })

  it('should pass the requested duration to sign', async () => {
    const duration = ONE_DAY_IN_SECONDS

    await createConversationSessionToken({
      conversationId: 'conv-999',
      userId: 'user-999',
      durationInSeconds: duration,
    })

    expect(sign).toHaveBeenCalledWith(
      expect.any(Object),
      duration,
      expect.any(String)
    )
  })
})

describe('POST /api/v1/conversation/[conversationId]/session/create', () => {
  const mockSession = { user: { id: 'user_owner' } }
  const mockReq = { query: { conversationId: 'conv_abc' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authorization', () => {
    it('should return 404 when conversation is not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(404)
    })

    it('should return 403 when conversation belongs to a different user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_abc',
        userId: 'user_other',
      })

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(403)
    })

    it('should allow access when conversation belongs to the session user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_abc',
        userId: 'user_owner',
      })

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(200)
    })
  })

  describe('token generation', () => {
    beforeEach(() => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_abc',
        userId: 'user_owner',
      })
    })

    it('should return a token and expiry in the response body', async () => {
      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({
        id: 'conv_abc',
        token: 'mock.jwt.token',
        expiresAt: expect.any(Number),
      })
    })

    it('should default to ONE_HOUR_IN_SECONDS when no duration is provided', async () => {
      await handler(mockReq, mockSession, {})

      expect(sign).toHaveBeenCalledWith(
        expect.any(Object),
        ONE_HOUR_IN_SECONDS,
        'enduser/conversation'
      )
    })

    it('should use the provided durationInSeconds when given', async () => {
      const customDuration = ONE_DAY_IN_SECONDS

      await handler(mockReq, mockSession, { durationInSeconds: customDuration })

      expect(sign).toHaveBeenCalledWith(
        expect.any(Object),
        customDuration,
        'enduser/conversation'
      )
    })

    it('should set expiresAt based on the requested duration', async () => {
      const before = Date.now()
      const result = await handler(mockReq, mockSession, {
        durationInSeconds: ONE_HOUR_IN_SECONDS,
      })
      const after = Date.now()

      const expectedMin = before + ONE_HOUR_IN_SECONDS * 1000
      const expectedMax = after + ONE_HOUR_IN_SECONDS * 1000

      expect(result.body.expiresAt).toBeGreaterThanOrEqual(expectedMin)
      expect(result.body.expiresAt).toBeLessThanOrEqual(expectedMax)
    })

    it('should query the conversation by the conversationId path param', async () => {
      await handler(mockReq, mockSession, {})

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv_abc' },
        })
      )
    })
  })
})
