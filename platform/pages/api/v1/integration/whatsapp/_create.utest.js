/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/prisma/types', () => ({
  IntegrationVisibility: {
    private: 'private',
    public: 'public',
    unlisted: 'unlisted',
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

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mocked-verify-token-hex'),
  })),
}))

describe('/api/v1/integration/whatsapp/create', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({})

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('creates a whatsapp integration and returns its id', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({
        id: 'whatsapp-int-456',
      })

      const body = {
        name: 'My WhatsApp Bot',
        description: 'A test bot',
        phoneNumberId: '123456789',
        accessToken: 'token-abc',
      }

      const res = await handler(makeReq(), mockSession, body)

      expect(res.status).toBe(200)

      const data = await res.json()

      expect(data).toEqual({ id: 'whatsapp-int-456' })
    })

    it('stores userId from session', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
      })

      expect(prisma.whatsappIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      )
    })

    it('generates a unique verify token', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.verifyToken).toBe('mocked-verify-token-hex')
    })
  })

  describe('optional fields', () => {
    it('stores all provided optional fields', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      const body = {
        name: 'Bot',
        description: 'Test description',
        phoneNumberId: '987654321',
        accessToken: 'token-xyz',
        appSecret: 'meta-app-secret',
        contactCollection: true,
        sessionDuration: 3600000,
        attachments: true,
        allowFrom: '+15551234567,+15559876543',
        meta: { foo: 'bar' },
      }

      await handler(makeReq(), mockSession, body)

      expect(prisma.whatsappIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Bot',
            description: 'Test description',
            phoneNumberId: '987654321',
            accessToken: 'token-xyz',
            appSecret: 'meta-app-secret',
            contactCollection: true,
            sessionDuration: 3600000,
            attachments: true,
            allowFrom: '+15551234567,+15559876543',
            meta: { foo: 'bar' },
          }),
        })
      )
    })

    it('handles null and empty string values for optional fields', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      const body = {
        name: 'Bot',
        phoneNumberId: null,
        accessToken: '',
        allowFrom: null,
        sessionDuration: null,
      }

      await handler(makeReq(), mockSession, body)

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.phoneNumberId).toBeNull()
      expect(callData.accessToken).toBe('')
      expect(callData.allowFrom).toBeNull()
      expect(callData.sessionDuration).toBeNull()
    })
  })

  describe('masked credential handling', () => {
    it('strips accessToken when submitted as masked value "********"', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        phoneNumberId: '123456',
        accessToken: '********',
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.accessToken).toBeUndefined()
      expect(callData.phoneNumberId).toBe('123456')
    })

    it('preserves real accessToken that is not masked', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        accessToken: 'real-token-123',
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.accessToken).toBe('real-token-123')
    })
  })

  describe('blueprint and bot linking', () => {
    it('resolves blueprintId from nested object', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        blueprintId: { id: 'bp-123' },
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-123')
    })

    it('resolves botId from nested object', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        botId: { id: 'bot-456' },
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.botId).toBe('bot-456')
    })

    it('uses string blueprintId and botId directly', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        blueprintId: 'bp-string',
        botId: 'bot-string',
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-string')
      expect(callData.botId).toBe('bot-string')
    })
  })

  describe('sessionDuration validation', () => {
    it('accepts sessionDuration within valid range', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        sessionDuration: 86400000,
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.sessionDuration).toBe(86400000)
    })

    it('accepts zero as sessionDuration', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        sessionDuration: 0,
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.sessionDuration).toBe(0)
    })
  })

  describe('allowFrom filtering', () => {
    it('stores allowFrom as provided for specific numbers', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        allowFrom: '+15551234567',
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.allowFrom).toBe('+15551234567')
    })

    it('stores wildcard allowFrom for all senders', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        allowFrom: '*',
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.allowFrom).toBe('*')
    })

    it('stores empty allowFrom to deny all', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        allowFrom: '',
      })

      const callData = prisma.whatsappIntegration.create.mock.calls[0][0].data

      expect(callData.allowFrom).toBe('')
    })
  })

  describe('edge cases', () => {
    it('handles minimal required fields only', async () => {
      prisma.whatsappIntegration.create.mockResolvedValue({ id: 'wa-min' })

      await handler(makeReq(), mockSession, {
        name: 'Minimal Bot',
      })

      expect(prisma.whatsappIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            name: 'Minimal Bot',
            verifyToken: 'mocked-verify-token-hex',
          }),
        })
      )
    })
  })
})
