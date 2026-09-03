/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query?.[param]),
}))

jest.mock('@/lib/usage.record', () => ({
  recordMessageUsage: jest.fn(),
}))

jest.mock('@/lib/pii', () => ({
  detectPiiEntities: jest.fn(() => []),
  getSafeTextAndEntities: jest.fn((text, _entities, knownEntities) => ({
    safeText: text,
    safeEntities: knownEntities,
  })),
}))

jest.mock('@/lib/message', () => ({
  getMessageType: jest.fn((type) => type),
}))

describe('POST /api/v1/conversation/{conversationId}/message/create', () => {
  const { recordMessageUsage } = require('@/lib/usage.record')
  const { detectPiiEntities, getSafeTextAndEntities } = require('@/lib/pii')

  const mockSession = {
    user: { id: 'user_abc123' },
  }

  const mockReq = { query: { conversationId: 'conv_xyz789' } }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('authorization', () => {
    it('should return 404 when conversation is not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const body = { type: 'user', text: 'hello' }
      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(404)
      expect(prisma.message.create).not.toHaveBeenCalled()
    })

    it('should return 401 when conversation belongs to a different user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_xyz789',
        userId: 'user_different',
      })

      const body = { type: 'user', text: 'hello' }
      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(401)
      expect(prisma.message.create).not.toHaveBeenCalled()
    })
  })

  describe('basic message creation', () => {
    it('should create a message with required fields', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_xyz789',
        userId: 'user_abc123',
      })
      prisma.message.create.mockResolvedValue({ id: 'msg_123' })

      const body = { type: 'user', text: 'hello world' }
      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('msg_123')
      expect(result.body.entities).toEqual([])

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv_xyz789',
          name: undefined,
          description: undefined,
          type: 'user',
          text: 'hello world',
          meta: undefined,
        },
        select: { id: true },
      })
    })

    it('should create a message with all optional fields', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_xyz789',
        userId: 'user_abc123',
      })
      prisma.message.create.mockResolvedValue({ id: 'msg_456' })

      const body = {
        name: 'Test Message',
        description: 'A test',
        type: 'bot',
        text: 'response text',
        meta: { key: 'value' },
      }
      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv_xyz789',
          name: 'Test Message',
          description: 'A test',
          type: 'bot',
          text: 'response text',
          meta: { key: 'value' },
        },
        select: { id: true },
      })
    })

    it('should record message usage after creation', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_xyz789',
        userId: 'user_abc123',
      })
      prisma.message.create.mockResolvedValue({ id: 'msg_789' })

      const body = { type: 'user', text: 'hello' }

      await handler(mockReq, mockSession, body)

      expect(recordMessageUsage).toHaveBeenCalledWith({
        user: mockSession.user,
        count: 1,
      })
    })
  })

  describe('PII handling', () => {
    it('should NOT run PII detection when no knownEntities are provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_xyz789',
        userId: 'user_abc123',
      })
      prisma.message.create.mockResolvedValue({ id: 'msg_nopii' })

      const body = { type: 'user', text: 'my text' }

      await handler(mockReq, mockSession, body)

      expect(detectPiiEntities).not.toHaveBeenCalled()
      expect(getSafeTextAndEntities).not.toHaveBeenCalled()

      // text is stored as-is
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ text: 'my text' }),
        })
      )
    })

    it('should run PII detection when knownEntities are provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_xyz789',
        userId: 'user_abc123',
      })
      prisma.message.create.mockResolvedValue({ id: 'msg_pii' })

      const knownEntities = [{ type: 'EMAIL', value: 'test@example.com' }]

      detectPiiEntities.mockResolvedValue([{ type: 'EMAIL', start: 0, end: 16 }])
      getSafeTextAndEntities.mockReturnValue({
        safeText: '[REDACTED]',
        safeEntities: knownEntities,
      })

      const body = {
        type: 'user',
        text: 'test@example.com is my email',
        entities: knownEntities,
      }
      const result = await handler(mockReq, mockSession, body)

      expect(result.status).toBe(200)
      expect(detectPiiEntities).toHaveBeenCalledWith('test@example.com is my email')
      expect(getSafeTextAndEntities).toHaveBeenCalled()
      expect(result.body.entities).toEqual(knownEntities)

      // stores redacted text
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ text: '[REDACTED]' }),
        })
      )
    })

    it('should return safeEntities from PII detection in response', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_xyz789',
        userId: 'user_abc123',
      })
      prisma.message.create.mockResolvedValue({ id: 'msg_safe' })

      const knownEntities = [{ type: 'PHONE', value: '555-1234' }]
      const safeEntities = [{ type: 'PHONE', value: '[PHONE]' }]

      detectPiiEntities.mockResolvedValue([])
      getSafeTextAndEntities.mockReturnValue({
        safeText: 'call [PHONE]',
        safeEntities,
      })

      const body = {
        type: 'user',
        text: 'call 555-1234',
        entities: knownEntities,
      }
      const result = await handler(mockReq, mockSession, body)

      expect(result.body.entities).toEqual(safeEntities)
    })
  })

  describe('bodySchema', () => {
    it('should require type field', () => {
      const { error } = bodySchema.validate({ text: 'hello' })

      expect(error).toBeDefined()
    })

    it('should require text field', () => {
      const { error } = bodySchema.validate({ type: 'user' })

      expect(error).toBeDefined()
    })

    it('should accept valid user message', () => {
      const { error } = bodySchema.validate({ type: 'user', text: 'hello' })

      expect(error).toBeUndefined()
    })

    it('should accept valid bot message', () => {
      const { error } = bodySchema.validate({ type: 'bot', text: 'response' })

      expect(error).toBeUndefined()
    })

    it('should accept all optional fields', () => {
      const { error } = bodySchema.validate({
        type: 'user',
        text: 'hello',
        name: 'msg',
        description: 'desc',
        entities: [],
        meta: {},
      })

      expect(error).toBeUndefined()
    })
  })
})
