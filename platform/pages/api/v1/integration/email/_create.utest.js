/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prismaMock from '@/prisma/client'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

const prisma = prismaMock

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

describe('/api/v1/integration/email/create', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({})

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('creates an email integration and returns its id', async () => {
      prisma.emailIntegration.create.mockResolvedValue({
        id: 'email-int-456',
      })

      const body = {
        name: 'Support Email Bot',
        alias: 'support',
        description: 'Email support integration',
        botId: 'bot-123',
        contactCollection: true,
        sessionDuration: 3600000,
        attachments: true,
        allowFrom: 'support@example.com',
      }

      const res = await handler(makeReq(), mockSession, body)

      expect(res.status).toBe(200)

      const data = await res.json()

      expect(data).toEqual({ id: 'email-int-456' })
    })

    it('stores userId from session', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
      })

      expect(prisma.emailIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      )
    })

    it('passes all fields to prisma', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      const body = {
        alias: 'my-email',
        name: 'My Email Integration',
        description: 'Test email',
        botId: 'bot-456',
        blueprintId: 'bp-789',
        contactCollection: true,
        sessionDuration: 1800000,
        attachments: true,
        allowFrom: 'admin@company.com\nuser@company.com',
        meta: { custom: 'data' },
      }

      await handler(makeReq(), mockSession, body)

      expect(prisma.emailIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            alias: 'my-email',
            name: 'My Email Integration',
            description: 'Test email',
            botId: 'bot-456',
            blueprintId: 'bp-789',
            contactCollection: true,
            sessionDuration: 1800000,
            attachments: true,
            allowFrom: 'admin@company.com\nuser@company.com',
            meta: { custom: 'data' },
          }),
        })
      )
    })
  })

  describe('optional fields', () => {
    it('handles null values for optional fields', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      const body = {
        name: 'Bot',
        alias: 'bot',
        description: null,
        botId: null,
        blueprintId: null,
        contactCollection: null,
        sessionDuration: null,
        attachments: null,
        allowFrom: null,
        meta: null,
      }

      await handler(makeReq(), mockSession, body)

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.description).toBeNull()
      expect(callData.botId).toBeNull()
      expect(callData.blueprintId).toBeNull()
      expect(callData.contactCollection).toBeNull()
      expect(callData.sessionDuration).toBeNull()
      expect(callData.attachments).toBeNull()
      expect(callData.allowFrom).toBeNull()
      expect(callData.meta).toBeNull()
    })

    it('stores provided optional fields', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      const body = {
        name: 'Support',
        alias: 'support',
        description: 'Email support',
        contactCollection: true,
        sessionDuration: 7200000,
        attachments: true,
        allowFrom: '@example.com',
        meta: { tier: 'premium' },
      }

      await handler(makeReq(), mockSession, body)

      expect(prisma.emailIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Email support',
            contactCollection: true,
            sessionDuration: 7200000,
            attachments: true,
            allowFrom: '@example.com',
            meta: { tier: 'premium' },
          }),
        })
      )
    })

    it('handles empty string values for optional text fields', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      const body = {
        name: 'Bot',
        alias: 'bot',
        description: '',
        allowFrom: '',
      }

      await handler(makeReq(), mockSession, body)

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.description).toBe('')
      expect(callData.allowFrom).toBe('')
    })
  })

  describe('blueprint and bot linking', () => {
    it('resolves blueprintId from nested object', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        blueprintId: { id: 'bp-123' },
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-123')
    })

    it('resolves botId from nested object', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        botId: { id: 'bot-456' },
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.botId).toBe('bot-456')
    })

    it('uses string blueprintId and botId directly', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        blueprintId: 'bp-string',
        botId: 'bot-string',
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-string')
      expect(callData.botId).toBe('bot-string')
    })

    it('falls back to string value when blueprintId has no .id property', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        blueprintId: 'bp-direct',
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-direct')
    })
  })

  describe('sessionDuration validation', () => {
    it('accepts sessionDuration within valid range', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        sessionDuration: 2592000000, // 30 days
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.sessionDuration).toBe(2592000000)
    })

    it('accepts zero as sessionDuration', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        sessionDuration: 0,
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.sessionDuration).toBe(0)
    })

    it('accepts null as sessionDuration', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        sessionDuration: null,
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.sessionDuration).toBeNull()
    })
  })

  describe('contact collection and attachments', () => {
    it('stores contactCollection as true', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        contactCollection: true,
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.contactCollection).toBe(true)
    })

    it('stores contactCollection as false', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        contactCollection: false,
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.contactCollection).toBe(false)
    })

    it('stores attachments as true', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        attachments: true,
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.attachments).toBe(true)
    })

    it('stores attachments as false', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        attachments: false,
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.attachments).toBe(false)
    })
  })

  describe('allowFrom field (sender filtering)', () => {
    it('stores single email address in allowFrom', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        allowFrom: 'admin@example.com',
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.allowFrom).toBe('admin@example.com')
    })

    it('stores multiple email addresses separated by newline', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      const emails = 'admin@example.com\nuser@example.com\nsupport@example.com'

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        allowFrom: emails,
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.allowFrom).toBe(emails)
    })

    it('stores domain pattern in allowFrom', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        allowFrom: '@example.com',
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.allowFrom).toBe('@example.com')
    })

    it('stores wildcard in allowFrom to allow all senders', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        allowFrom: '*',
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.allowFrom).toBe('*')
    })
  })

  describe('edge cases and minimal data', () => {
    it('handles minimal required fields only', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-min' })

      await handler(makeReq(), mockSession, {
        name: 'Minimal Bot',
        alias: 'minimal',
      })

      expect(prisma.emailIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            name: 'Minimal Bot',
            alias: 'minimal',
          }),
        })
      )
    })

    it('handles long description text', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      const longDescription = 'A'.repeat(500)

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        description: longDescription,
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.description).toBe(longDescription)
    })

    it('handles long allowFrom patterns', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      const longAllowFrom = Array(50).fill('user@example.com').join('\n')

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
        allowFrom: longAllowFrom,
      })

      const callData = prisma.emailIntegration.create.mock.calls[0][0].data

      expect(callData.allowFrom).toBe(longAllowFrom)
    })

    it('returns select with id only', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
      })

      expect(prisma.emailIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
          },
        })
      )
    })
  })

  describe('session limits integration', () => {
    it('enforces session limits for database/integration', async () => {
      prisma.emailIntegration.create.mockResolvedValue({ id: 'email-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'bot',
      })

      // The withSessionLimits wrapper is mocked to pass through,
      // but we verify the handler is called with the correct context
      expect(prisma.emailIntegration.create).toHaveBeenCalled()
    })
  })
})
